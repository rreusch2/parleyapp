import { supabase } from './api/supabaseClient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';

interface GiveawayEntry {
  id: string;
  userId: string;
  entryMethod: 'subscription' | 'referral' | 'social_share' | 'app_review' | 'daily_login';
  entryDate: string;
  isValid: boolean;
  metadata?: {
    subscriptionTier?: string;
    referralCount?: number;
    reviewRating?: number;
    consecutiveDays?: number;
  };
}

interface GiveawayStats {
  totalEntries: number;
  userEntries: number;
  nextDrawDate: string;
  isEligible: boolean;
  entryMethods: string[];
}

class GiveawayService {
  private static instance: GiveawayService;
  private readonly STORAGE_KEY = 'parley_giveaway_data';

  public static getInstance(): GiveawayService {
    if (!GiveawayService.instance) {
      GiveawayService.instance = new GiveawayService();
    }
    return GiveawayService.instance;
  }

  /**
   * Enter user into monthly giveaway with various entry methods
   */
  async enterGiveaway(userId: string, entryMethod: GiveawayEntry['entryMethod'], metadata?: GiveawayEntry['metadata']): Promise<boolean> {
    try {
      // Check if user already has this entry method for current month
      const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM format
      
      const { data: existingEntry, error: checkError } = await supabase
        .from('giveaway_entries')
        .select('id')
        .eq('user_id', userId)
        .eq('entry_method', entryMethod)
        .gte('entry_date', `${currentMonth}-01`)
        .lt('entry_date', this.getNextMonthStart(currentMonth))
        .single();

      if (existingEntry) {
        console.log(`User already has ${entryMethod} entry for this month`);
        return false;
      }

      // Add new giveaway entry
      const { error: insertError } = await supabase
        .from('giveaway_entries')
        .insert({
          user_id: userId,
          entry_method: entryMethod,
          entry_date: new Date().toISOString(),
          is_valid: true,
          metadata: metadata || {}
        });

      if (insertError) throw insertError;

      console.log(`✅ Giveaway entry added: ${entryMethod} for user ${userId}`);
      return true;
    } catch (error) {
      console.error('Error entering giveaway:', error);
      return false;
    }
  }

  /**
   * Get user's giveaway stats for current month
   */
  async getUserGiveawayStats(userId: string): Promise<GiveawayStats> {
    try {
      const currentMonth = new Date().toISOString().slice(0, 7);
      
      // Get user's entries for current month
      const { data: userEntries, error: userError } = await supabase
        .from('giveaway_entries')
        .select('entry_method')
        .eq('user_id', userId)
        .eq('is_valid', true)
        .gte('entry_date', `${currentMonth}-01`)
        .lt('entry_date', this.getNextMonthStart(currentMonth));

      if (userError) throw userError;

      // Get total entries for current month
      const { count: totalEntries, error: totalError } = await supabase
        .from('giveaway_entries')
        .select('id', { count: 'exact' })
        .eq('is_valid', true)
        .gte('entry_date', `${currentMonth}-01`)
        .lt('entry_date', this.getNextMonthStart(currentMonth));

      if (totalError) throw totalError;

      // Calculate next draw date (last day of current month)
      const nextDrawDate = this.getLastDayOfMonth(currentMonth);

      return {
        totalEntries: totalEntries || 0,
        userEntries: userEntries?.length || 0,
        nextDrawDate,
        isEligible: (userEntries?.length || 0) > 0,
        entryMethods: userEntries?.map(entry => entry.entry_method) || []
      };
    } catch (error) {
      console.error('Error getting giveaway stats:', error);
      return {
        totalEntries: 0,
        userEntries: 0,
        nextDrawDate: '',
        isEligible: false,
        entryMethods: []
      };
    }
  }

  /**
   * Automatic entry triggers for various user actions
   */
  async triggerAutoEntry(userId: string, action: string, metadata?: any): Promise<void> {
    try {
      switch (action) {
        case 'subscription_purchase':
          await this.enterGiveaway(userId, 'subscription', {
            subscriptionTier: metadata?.tier
          });
          break;

        case 'successful_referral':
          await this.enterGiveaway(userId, 'referral', {
            referralCount: metadata?.count
          });
          break;

        case 'app_review':
          if (metadata?.rating >= 4) {
            await this.enterGiveaway(userId, 'app_review', {
              reviewRating: metadata.rating
            });
          }
          break;

        case 'social_share':
          await this.enterGiveaway(userId, 'social_share');
          break;

        case 'daily_login_streak':
          if (metadata?.consecutiveDays >= 7) {
            await this.enterGiveaway(userId, 'daily_login', {
              consecutiveDays: metadata.consecutiveDays
            });
          }
          break;
      }
    } catch (error) {
      console.error('Error triggering auto entry:', error);
    }
  }

  /**
   * Admin function to conduct monthly drawing
   */
  async conductMonthlyDrawing(): Promise<{ winner: any; totalEntries: number }> {
    try {
      const currentMonth = new Date().toISOString().slice(0, 7);
      
      // Get all valid entries for current month
      const { data: entries, error } = await supabase
        .from('giveaway_entries')
        .select(`
          id,
          user_id,
          entry_method,
          profiles!inner(username, email)
        `)
        .eq('is_valid', true)
        .gte('entry_date', `${currentMonth}-01`)
        .lt('entry_date', this.getNextMonthStart(currentMonth));

      if (error) throw error;

      if (!entries || entries.length === 0) {
        throw new Error('No valid entries found for this month');
      }

      // Randomly select winner
      const randomIndex = Math.floor(Math.random() * entries.length);
      const winner = entries[randomIndex];

      // Award lifetime subscription to winner
      await supabase
        .from('profiles')
        .update({
          subscription_tier: 'pro',
          subscription_plan_type: 'lifetime',
          subscription_product_id: 'com.parleyapp.premium_lifetime',
          subscription_started_at: new Date().toISOString(),
          auto_renew_enabled: false
        })
        .eq('id', winner.user_id);

      // Mark all entries as processed
      await supabase
        .from('giveaway_entries')
        .update({ is_valid: false })
        .gte('entry_date', `${currentMonth}-01`)
        .lt('entry_date', this.getNextMonthStart(currentMonth));

      console.log(`🎉 Monthly giveaway winner: ${(winner as any).profiles.username} (${(winner as any).profiles.email})`);

      return {
        winner: {
          userId: winner.user_id,
          username: (winner as any).profiles.username,
          email: (winner as any).profiles.email,
          entryMethod: winner.entry_method
        },
        totalEntries: entries.length
      };
    } catch (error) {
      console.error('Error conducting monthly drawing:', error);
      throw error;
    }
  }

  /**
   * Get available entry methods for user
   */
  async getAvailableEntryMethods(userId: string): Promise<string[]> {
    try {
      const currentMonth = new Date().toISOString().slice(0, 7);
      
      // Get user's existing entries for current month
      const { data: existingEntries, error } = await supabase
        .from('giveaway_entries')
        .select('entry_method')
        .eq('user_id', userId)
        .eq('is_valid', true)
        .gte('entry_date', `${currentMonth}-01`)
        .lt('entry_date', this.getNextMonthStart(currentMonth));

      if (error) throw error;

      const usedMethods = existingEntries?.map(entry => entry.entry_method) || [];
      const allMethods = ['subscription', 'referral', 'social_share', 'app_review', 'daily_login'];
      
      return allMethods.filter(method => !usedMethods.includes(method));
    } catch (error) {
      console.error('Error getting available entry methods:', error);
      return [];
    }
  }

  private getNextMonthStart(currentMonth: string): string {
    const date = new Date(`${currentMonth}-01`);
    date.setMonth(date.getMonth() + 1);
    return date.toISOString().slice(0, 7) + '-01';
  }

  private getLastDayOfMonth(month: string): string {
    const date = new Date(`${month}-01`);
    date.setMonth(date.getMonth() + 1);
    date.setDate(0); // Last day of previous month
    return date.toISOString().split('T')[0];
  }
}

export default GiveawayService;
export type { GiveawayEntry, GiveawayStats };
