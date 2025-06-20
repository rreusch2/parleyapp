import { createClient } from '@supabase/supabase-js';
import { createLogger } from '../../utils/logger';
import dotenv from 'dotenv';

dotenv.config();

const logger = createLogger('dailyInsightsService');

// Supabase configuration
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY; // Use service key for backend operations

if (!supabaseUrl || !supabaseServiceKey) {
  logger.error('Missing Supabase configuration. Please check SUPABASE_URL and SUPABASE_SERVICE_KEY environment variables.');
  throw new Error('Missing Supabase configuration');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Daily insights interface (matches database schema)
export interface DailyInsight {
  id?: string;
  user_id: string;
  title: string;
  description: string;
  type: 'analysis' | 'alert' | 'value' | 'trend' | 'prediction';
  category: 'analysis' | 'news' | 'injury' | 'weather' | 'line_movement';
  source: string;
  impact: 'low' | 'medium' | 'high';
  tools_used?: string[];
  impact_score?: number;
  date: string; // YYYY-MM-DD format
  metadata?: {
    gameId?: string;
    sport?: string;
    processingTime?: number;
    confidence?: number;
    [key: string]: any;
  };
  created_at?: string;
  updated_at?: string;
}

export class DailyInsightsService {
  
  /**
   * Store daily insights for a user
   */
  async storeDailyInsights(insights: DailyInsight[]): Promise<DailyInsight[]> {
    try {
      logger.info(`💾 Storing ${insights.length} daily insights to Supabase`);
      
      // Prepare insights for insertion
      const insightsToInsert = insights.map(insight => ({
        user_id: insight.user_id,
        title: insight.title,
        description: insight.description,
        type: insight.type,
        category: insight.category,
        source: insight.source,
        impact: insight.impact,
        tools_used: insight.tools_used || [],
        impact_score: insight.impact_score,
        date: insight.date,
        metadata: insight.metadata || {}
      }));

      const { data, error } = await supabase
        .from('daily_insights')
        .insert(insightsToInsert)
        .select();

      if (error) {
        logger.error('Error storing daily insights:', error);
        throw error;
      }

      logger.info(`✅ Successfully stored ${data.length} daily insights`);
      return data;

    } catch (error) {
      logger.error(`💥 Error in storeDailyInsights: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Get daily insights for a user by date
   */
  async getDailyInsights(userId: string, date: string): Promise<DailyInsight[]> {
    try {
      logger.info(`📥 Fetching daily insights for user ${userId} on ${date}`);

      const { data, error } = await supabase
        .from('daily_insights')
        .select('*')
        .eq('user_id', userId)
        .eq('date', date)
        .order('impact_score', { ascending: false });

      if (error) {
        logger.error('Error fetching daily insights:', error);
        throw error;
      }

      logger.info(`📊 Found ${data.length} daily insights for ${userId} on ${date}`);
      return data || [];

    } catch (error) {
      logger.error(`💥 Error in getDailyInsights: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Check if daily insights exist for a user on a specific date
   */
  async hasInsightsForDate(userId: string, date: string): Promise<boolean> {
    try {
      const { count, error } = await supabase
        .from('daily_insights')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('date', date);

      if (error) {
        logger.error('Error checking insights existence:', error);
        return false;
      }

      return (count || 0) > 0;

    } catch (error) {
      logger.error(`💥 Error in hasInsightsForDate: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }

  /**
   * Delete existing insights for a user on a specific date (for regeneration)
   */
  async deleteInsightsForDate(userId: string, date: string): Promise<void> {
    try {
      logger.info(`🗑️ Deleting existing insights for user ${userId} on ${date}`);

      const { error } = await supabase
        .from('daily_insights')
        .delete()
        .eq('user_id', userId)
        .eq('date', date);

      if (error) {
        logger.error('Error deleting insights:', error);
        throw error;
      }

      logger.info(`✅ Successfully deleted insights for ${userId} on ${date}`);

    } catch (error) {
      logger.error(`💥 Error in deleteInsightsForDate: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Get insight history for a user (last N days)
   */
  async getInsightHistory(userId: string, days: number = 7): Promise<DailyInsight[]> {
    try {
      logger.info(`📈 Fetching ${days} days of insight history for user ${userId}`);

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      const startDateStr = startDate.toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('daily_insights')
        .select('*')
        .eq('user_id', userId)
        .gte('date', startDateStr)
        .order('date', { ascending: false })
        .order('impact_score', { ascending: false });

      if (error) {
        logger.error('Error fetching insight history:', error);
        throw error;
      }

      logger.info(`📊 Found ${data.length} insights in the last ${days} days`);
      return data || [];

    } catch (error) {
      logger.error(`💥 Error in getInsightHistory: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Clean up old insights (older than specified days)
   */
  async cleanupOldInsights(days: number = 30): Promise<number> {
    try {
      logger.info(`🧹 Cleaning up insights older than ${days} days`);

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);
      const cutoffDateStr = cutoffDate.toISOString().split('T')[0];

      const { count, error } = await supabase
        .from('daily_insights')
        .delete()
        .lt('date', cutoffDateStr);

      if (error) {
        logger.error('Error cleaning up old insights:', error);
        throw error;
      }

      const deletedCount = count || 0;
      logger.info(`✅ Cleaned up ${deletedCount} old insights`);
      return deletedCount;

    } catch (error) {
      logger.error(`💥 Error in cleanupOldInsights: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Get insights statistics for a user
   */
  async getInsightStats(userId: string): Promise<{
    totalInsights: number;
    insightsThisWeek: number;
    averageImpactScore: number;
    mostUsedTools: string[];
  }> {
    try {
      logger.info(`📈 Fetching insight statistics for user ${userId}`);

      // Get total insights
      const { count: totalInsights } = await supabase
        .from('daily_insights')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);

      // Get insights this week
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      const weekAgoStr = weekAgo.toISOString().split('T')[0];

      const { count: insightsThisWeek } = await supabase
        .from('daily_insights')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gte('date', weekAgoStr);

      // Get insights with impact scores for average calculation
      const { data: insightsWithScores } = await supabase
        .from('daily_insights')
        .select('impact_score, tools_used')
        .eq('user_id', userId)
        .not('impact_score', 'is', null);

      // Calculate average impact score
      const scores = insightsWithScores?.map(i => i.impact_score).filter(s => s !== null) || [];
      const averageImpactScore = scores.length > 0 
        ? scores.reduce((sum, score) => sum + score, 0) / scores.length 
        : 0;

      // Count most used tools
      const toolUsage: { [tool: string]: number } = {};
      insightsWithScores?.forEach(insight => {
        if (insight.tools_used && Array.isArray(insight.tools_used)) {
          insight.tools_used.forEach((tool: string) => {
            toolUsage[tool] = (toolUsage[tool] || 0) + 1;
          });
        }
      });

      const mostUsedTools = Object.entries(toolUsage)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5)
        .map(([tool]) => tool);

      return {
        totalInsights: totalInsights || 0,
        insightsThisWeek: insightsThisWeek || 0,
        averageImpactScore: Math.round(averageImpactScore * 10) / 10,
        mostUsedTools
      };

    } catch (error) {
      logger.error(`💥 Error in getInsightStats: ${error instanceof Error ? error.message : String(error)}`);
      return {
        totalInsights: 0,
        insightsThisWeek: 0,
        averageImpactScore: 0,
        mostUsedTools: []
      };
    }
  }
}

// Create singleton instance
export const dailyInsightsService = new DailyInsightsService(); 