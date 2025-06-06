import { createClient, SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { createLogger } from '../../utils/logger';

// Load environment variables
dotenv.config();

const logger = createLogger('userData');

// Supabase client
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_ANON_KEY || '';
const supabase: SupabaseClient = createClient(supabaseUrl, supabaseKey);

// Define interfaces for user data
interface UserPreferences {
  userId: string;
  riskTolerance: 'low' | 'medium' | 'high';
  favoriteTeams: string[];
  favoritePlayers: string[];
  preferredBetTypes: string[];
  preferredSports: string[];
  preferredBookmakers: string[];
}

interface BettingHistoryItem {
  id: string;
  userId: string;
  gameId: string;
  betType: string;
  selection: string;
  odds: number;
  stake: number;
  potentialWin: number;
  result: 'win' | 'loss' | 'push' | 'pending';
  createdAt: string;
}

/**
 * Service for accessing user data from Supabase
 */
class UserDataService {
  /**
   * Get user preferences from Supabase
   * @param userId - User ID
   */
  async getUserPreferences(userId: string): Promise<UserPreferences> {
    try {
      logger.info(`Fetching preferences for user ${userId}`);
      
      // Query user_profiles table for preferences
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', userId)
        .single();
      
      if (error) {
        logger.error(`Error fetching user preferences: ${error.message}`);
        throw error;
      }
      
      if (!data) {
        logger.warn(`No preferences found for user ${userId}, returning defaults`);
        // Return default preferences if none found
        return {
          userId,
          riskTolerance: 'medium',
          favoriteTeams: [],
          favoritePlayers: [],
          preferredBetTypes: ['moneyline', 'spread', 'total'],
          preferredSports: ['NBA', 'NFL'],
          preferredBookmakers: []
        };
      }
      
      logger.info(`Successfully fetched preferences for user ${userId}`);
      
      // Transform data to match our interface
      return {
        userId,
        riskTolerance: data.risk_tolerance || 'medium',
        favoriteTeams: data.favorite_teams || [],
        favoritePlayers: data.favorite_players || [],
        preferredBetTypes: data.preferred_bet_types || ['moneyline', 'spread', 'total'],
        preferredSports: data.preferred_sports || ['NBA', 'NFL'],
        preferredBookmakers: data.preferred_bookmakers || []
      };
    } catch (error) {
      logger.error(`Error in getUserPreferences: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Get user betting history from Supabase
   * @param userId - User ID
   * @param limit - Maximum number of records to return
   */
  async getUserBettingHistory(userId: string, limit: number = 10): Promise<BettingHistoryItem[]> {
    try {
      logger.info(`Fetching betting history for user ${userId} (limit: ${limit})`);
      
      // Query betting_history table
      const { data, error } = await supabase
        .from('betting_history')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);
      
      if (error) {
        logger.error(`Error fetching user betting history: ${error.message}`);
        throw error;
      }
      
      if (!data || data.length === 0) {
        logger.warn(`No betting history found for user ${userId}`);
        return [];
      }
      
      logger.info(`Successfully fetched ${data.length} betting history items for user ${userId}`);
      
      // Transform data to match our interface
      return data.map(item => ({
        id: item.id,
        userId: item.user_id,
        gameId: item.game_id,
        betType: item.bet_type,
        selection: item.selection,
        odds: item.odds,
        stake: item.stake,
        potentialWin: item.potential_win,
        result: item.result,
        createdAt: item.created_at
      }));
    } catch (error) {
      logger.error(`Error in getUserBettingHistory: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Get user's recent performance statistics
   * @param userId - User ID
   */
  async getUserPerformanceStats(userId: string): Promise<any> {
    try {
      logger.info(`Calculating performance stats for user ${userId}`);
      
      // Query betting_history table
      const { data, error } = await supabase
        .from('betting_history')
        .select('*')
        .eq('user_id', userId)
        .not('result', 'eq', 'pending');
      
      if (error) {
        logger.error(`Error fetching user betting history for stats: ${error.message}`);
        throw error;
      }
      
      if (!data || data.length === 0) {
        logger.warn(`No completed bets found for user ${userId}`);
        return {
          totalBets: 0,
          winRate: 0,
          profitLoss: 0,
          roi: 0,
          averageOdds: 0,
          betTypeBreakdown: {}
        };
      }
      
      // Calculate statistics
      const totalBets = data.length;
      const wins = data.filter(bet => bet.result === 'win').length;
      const winRate = totalBets > 0 ? wins / totalBets : 0;
      
      let totalStake = 0;
      let totalProfit = 0;
      let totalOdds = 0;
      const betTypeCount: Record<string, number> = {};
      
      data.forEach(bet => {
        totalStake += bet.stake;
        totalOdds += bet.odds;
        
        if (bet.result === 'win') {
          totalProfit += bet.potential_win - bet.stake;
        } else if (bet.result === 'loss') {
          totalProfit -= bet.stake;
        }
        
        betTypeCount[bet.bet_type] = (betTypeCount[bet.bet_type] || 0) + 1;
      });
      
      const roi = totalStake > 0 ? (totalProfit / totalStake) * 100 : 0;
      const averageOdds = totalBets > 0 ? totalOdds / totalBets : 0;
      
      // Calculate bet type breakdown percentages
      const betTypeBreakdown: Record<string, number> = {};
      Object.entries(betTypeCount).forEach(([betType, count]) => {
        betTypeBreakdown[betType] = (count / totalBets) * 100;
      });
      
      logger.info(`Successfully calculated performance stats for user ${userId}`);
      
      return {
        totalBets,
        winRate: winRate * 100, // Convert to percentage
        profitLoss: totalProfit,
        roi,
        averageOdds,
        betTypeBreakdown
      };
    } catch (error) {
      logger.error(`Error in getUserPerformanceStats: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }
}

// Create and export service instance
export const userDataService = new UserDataService();

// Export tool functions for the LLM orchestrator
export const userDataGetUserPreferencesTool = async (userId: string) => {
  return await userDataService.getUserPreferences(userId);
};

export const userDataGetUserBettingHistoryTool = async (userId: string, limit: number = 10) => {
  return await userDataService.getUserBettingHistory(userId, limit);
}; 