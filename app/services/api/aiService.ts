import { supabase } from './supabaseClient';

// Use proper environment variables with better fallback logic
const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://zooming-rebirth-production-a305.up.railway.app';

const PYTHON_API_URL = process.env.EXPO_PUBLIC_PYTHON_API_URL || 'https://zooming-rebirth-production-a305.up.railway.app';

export interface AIPrediction {
  id: string;
  match: string;
  pick: string;
  odds: string;
  confidence: number;
  sport: string;
  eventTime: string;
  reasoning: string;
  value?: number;
  roi_estimate?: number;
  status?: 'pending' | 'won' | 'lost';
  created_at?: string;
}

export interface AIInsight {
  id: string;
  title: string;
  description: string;
  type: 'trend' | 'value' | 'alert' | 'prediction';
  impact: 'high' | 'medium' | 'low';
  timestamp: string;
  data?: any;
}

export interface UserStats {
  todayPicks: number;
  winRate: string;
  roi: string;
  streak: number;
  totalBets: number;
  profitLoss: string;
}

// Enhanced interface for daily insights (matches Supabase schema)
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
  date: string; // YYYY-MM-DD format for daily grouping
  metadata?: {
    gameId?: string;
    sport?: string;
    processingTime?: number;
    confidence?: number;
  };
  created_at?: string;
  updated_at?: string;
  
  // Legacy fields for backward compatibility (frontend expects these)
  userId?: string;
  timestamp?: string;
  toolsUsed?: string[];
}

class AIService {
  private async getAuthToken(): Promise<string | null> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      return session?.access_token || null;
    } catch (error) {
      console.error('Error getting auth token:', error);
      return null;
    }
  }

  private async makeRequest(url: string, options: RequestInit & { timeout?: number } = {}): Promise<any> {
    const token = await this.getAuthToken();
    
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const { timeout = 10000, ...fetchOptions } = options;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(url, {
        ...fetchOptions,
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  }

  // AI Insights from your Gemini orchestrator
  async getAIInsights(): Promise<AIInsight[]> {
    try {
      // First try to get insights from your AI orchestrator
      const data = await this.makeRequest(`${BACKEND_URL}/api/ai/insights`);
      return data.insights || data || [];
    } catch (error) {
      console.error('Error fetching AI insights:', error);
      // Return fallback insights
      return [
        {
          id: '1',
          title: 'Value Opportunity Detected',
          description: 'Our AI identified 3 high-value bets with 85%+ confidence for tonight\'s games',
          type: 'value',
          impact: 'high',
          timestamp: new Date().toISOString(),
        },
        {
          id: '2',
          title: 'Hot Streak Alert',
          description: 'Lakers have won 7 straight against the spread when playing on back-to-back nights',
          type: 'trend',
          impact: 'medium',
          timestamp: new Date().toISOString(),
        },
        {
          id: '3',
          title: 'Weather Impact Analysis',
          description: 'Strong winds in Chicago may favor under bets for Bears vs Packers tonight',
          type: 'alert',
          impact: 'medium',
          timestamp: new Date().toISOString(),
        }
      ];
    }
  }

  // Get today's AI predictions with welcome bonus logic
  async getTodaysPicks(userId?: string, userTier?: string): Promise<AIPrediction[]> {
    try {
      const currentUserId = userId || await this.getCurrentUserId();
      
      // Get user's subscription tier if not provided
      let tier = userTier;
      if (!tier) {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const { data: profile } = await supabase
              .from('profiles')
              .select('subscription_tier')
              .eq('id', user.id)
              .single();
            tier = profile?.subscription_tier || 'free';
          } else {
            tier = 'free';
          }
        } catch (error) {
          console.error('Error getting user tier:', error);
          tier = 'free';
        }
      }

      // Use the picks endpoint that handles welcome bonus logic
      const data = await this.makeRequest(`${BACKEND_URL}/api/ai/daily-picks-combined`);
      
      if (data.success && data.total_picks > 0) {
        // Combine team picks and player props into a single array
        const allPicks = [
          ...(data.team_picks || []),
          ...(data.player_props_picks || [])
        ];
        
        console.log(`📚 Loaded ${allPicks.length} AI picks (${data.breakdown?.team_picks || 0} team + ${data.breakdown?.player_props_picks || 0} props)`);
        return allPicks;
      }
      
      // If no predictions found, return empty array
      console.log('📚 No predictions found in database');
      return [];
    } catch (error) {
      console.error('Error fetching today\'s picks:', error);
      // Return empty array - let the frontend handle empty state
      return [];
    }
  }

  // Generate new AI picks from your backend
  async generateNewPicks(userId?: string): Promise<AIPrediction[]> {
    try {
      console.log('🤖 Generating new AI picks via DeepSeek orchestrator...');
      const currentUserId = userId || await this.getCurrentUserId();
      
      const data = await this.makeRequest(`${BACKEND_URL}/api/ai/generate-picks`, {
        method: 'POST',
        body: JSON.stringify({ userId: currentUserId }),
        timeout: 30000 // Increase timeout to 30 seconds for DeepSeek processing
      });
      
      console.log('✅ New AI picks generated successfully');
      return data.predictions || [];
    } catch (error) {
      console.error('Error generating new picks:', error);
      throw error;
    }
  }

  // Helper to get current user ID
  private async getCurrentUserId(): Promise<string> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      return user?.id || 'f08b56d3-d4ec-4815-b502-6647d723d2a6'; // Fallback to default
    } catch (error) {
      console.error('Error getting current user:', error);
      return 'f08b56d3-d4ec-4815-b502-6647d723d2a6'; // Fallback to default
    }
  }

  // Check if user is new (no previous picks)
  async isNewUser(userId?: string): Promise<boolean> {
    try {
      const currentUserId = userId || await this.getCurrentUserId();
      
      const data = await this.makeRequest(`${BACKEND_URL}/api/ai/picks?userId=${currentUserId}`);
      const userPicks = data.predictions || [];
      
      return userPicks.length === 0;
    } catch (error) {
      console.error('Error checking if user is new:', error);
      return true; // Assume new user on error
    }
  }

  // Get best cached picks for new users (from daily generation)
  async getBestCachedPicks(limit: number = 2): Promise<AIPrediction[]> {
    try {
      // Get picks from the default user (daily cached picks)
      const data = await this.makeRequest(`${BACKEND_URL}/api/ai/picks?userId=f08b56d3-d4ec-4815-b502-6647d723d2a6&limit=${limit}`);
      return data.predictions || [];
    } catch (error) {
      console.error('Error getting cached picks:', error);
      return [];
    }
  }

  // Get instant starter picks for new users (optimized, no orchestration)
  async getStarterPicks(userId?: string): Promise<AIPrediction[]> {
    try {
      const currentUserId = userId || await this.getCurrentUserId();
      console.log('🎁 Getting instant starter picks for new user...');
      
      const data = await this.makeRequest(`${BACKEND_URL}/api/ai/starter-picks?userId=${currentUserId}`);
      
      if (data.success && data.predictions) {
        console.log(`✅ Received ${data.predictions.length} starter picks instantly!`);
        console.log(`📦 Source: ${data.metadata?.picksSource}`);
        return data.predictions;
      }
      
      return [];
    } catch (error) {
      console.error('Error getting starter picks:', error);
      return [];
    }
  }

  // Generate first picks for new user
  async generateFirstPicks(userId?: string): Promise<AIPrediction[]> {
    try {
      const currentUserId = userId || await this.getCurrentUserId();
      console.log('🎁 Generating first picks for new user...');
      
      const data = await this.makeRequest(`${BACKEND_URL}/api/ai/generate-picks`, {
        method: 'POST',
        body: JSON.stringify({ 
          userId: currentUserId, 
          isNewUser: true,
          pickLimit: 2  // Only generate 2 picks for new users
        }),
        timeout: 30000
      });
      
      console.log('✅ First picks generated for new user');
      return data.predictions || [];
    } catch (error) {
      console.error('Error generating first picks:', error);
      throw error;
    }
  }

  // Get user betting statistics
  async getUserStats(): Promise<UserStats> {
    try {
      const data = await this.makeRequest(`${BACKEND_URL}/api/user/stats`);
      return data.stats || data || {
        todayPicks: 3,
        winRate: '67%',
        roi: '+22.4%',
        streak: 5,
        totalBets: 86,
        profitLoss: '+$2,456'
      };
    } catch (error) {
      console.error('Error fetching user stats:', error);
      // Return fallback stats
      return {
        todayPicks: 3,
        winRate: '67%',
        roi: '+22.4%',
        streak: 5,
        totalBets: 86,
        profitLoss: '+$2,456'
      };
    }
  }

  // Get value bets from your sports betting API
  async getValueBets(): Promise<any[]> {
    try {
      const data = await this.makeRequest(`${PYTHON_API_URL}/api/value-bets`);
      return data.value_bets || [];
    } catch (error) {
      console.error('Error fetching value bets:', error);
      return [];
    }
  }

  // Get strategy performance from your sports betting API
  async getStrategyPerformance(): Promise<any> {
    try {
      const data = await this.makeRequest(`${PYTHON_API_URL}/api/strategy-performance`);
      return data.performance || {};
    } catch (error) {
      console.error('Error fetching strategy performance:', error);
      return {};
    }
  }

  // Run backtest using your sports betting API
  async runBacktest(config: any): Promise<any> {
    try {
      const data = await this.makeRequest(`${PYTHON_API_URL}/api/backtest`, {
        method: 'POST',
        body: JSON.stringify(config),
      });
      return data.results || {};
    } catch (error) {
      console.error('Error running backtest:', error);
      throw new Error('Failed to run backtest');
    }
  }

  // Get optimal configuration from your sports betting API
  async getOptimalConfig(): Promise<any> {
    try {
      const data = await this.makeRequest(`${PYTHON_API_URL}/api/optimal-config`);
      return data.config || {};
    } catch (error) {
      console.error('Error fetching optimal config:', error);
      return {};
    }
  }

  // Save user preferences to your backend
  async saveUserPreferences(preferences: any): Promise<void> {
    try {
      await this.makeRequest(`${BACKEND_URL}/api/user/preferences`, {
        method: 'PUT',
        body: JSON.stringify(preferences),
      });
    } catch (error) {
      console.error('Error saving user preferences:', error);
      throw new Error('Failed to save preferences');
    }
  }

  // Get live game data
  async getLiveGames(): Promise<any[]> {
    try {
      const data = await this.makeRequest(`${BACKEND_URL}/api/sports/live`);
      return data.games || [];
    } catch (error) {
      console.error('Error fetching live games:', error);
      return [];
    }
  }

  // Get predictions for specific games
  async getPredictionsForGame(gameId: string): Promise<AIPrediction[]> {
    try {
      const data = await this.makeRequest(`${BACKEND_URL}/api/predictions/game/${gameId}`);
      return data.predictions || [];
    } catch (error) {
      console.error('Error fetching game predictions:', error);
      return [];
    }
  }

  // Submit a bet to track
  async submitBet(bet: any): Promise<void> {
    try {
      await this.makeRequest(`${BACKEND_URL}/api/bets`, {
        method: 'POST',
        body: JSON.stringify(bet),
      });
    } catch (error) {
      console.error('Error submitting bet:', error);
      throw new Error('Failed to submit bet');
    }
  }

  // Get betting history
  async getBettingHistory(): Promise<any[]> {
    try {
      const data = await this.makeRequest(`${BACKEND_URL}/api/bets/history`);
      return data.bets || [];
    } catch (error) {
      console.error('Error fetching betting history:', error);
      return [];
    }
  }

  /**
   * Generate and store daily insights for a user
   */
  async generateDailyInsights(userId: string): Promise<DailyInsight[]> {
    try {
      const response = await fetch(`${BACKEND_URL}/api/ai/daily-insights/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data.insights || [];
    } catch (error) {
      console.error('Error generating daily insights:', error);
      // Return mock data for development
      return this.getMockDailyInsights(userId);
    }
  }

  /**
   * Get daily insights for a user (from database or cache)
   */
  async getDailyInsights(userId: string, date?: string): Promise<DailyInsight[]> {
    try {
      const dateParam = date || new Date().toISOString().split('T')[0];
      const response = await fetch(`${BACKEND_URL}/api/ai/daily-insights?userId=${userId}&date=${dateParam}`);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const insights = data.insights || [];
      
      // Transform database format to frontend format for compatibility
      return insights.map((insight: any) => ({
        ...insight,
        userId: insight.user_id, // Legacy field
        timestamp: insight.created_at || new Date().toISOString(), // Legacy field
        toolsUsed: insight.tools_used // Legacy field
      }));
    } catch (error) {
      console.error('Error fetching daily insights:', error);
      // Return mock data for development
      return this.getMockDailyInsights(userId);
    }
  }

  /**
   * Check if daily insights need to be regenerated
   */
  async shouldRegenerateDailyInsights(userId: string): Promise<boolean> {
    try {
      const response = await fetch(`${BACKEND_URL}/api/ai/daily-insights/status?userId=${userId}`);
      
      if (!response.ok) {
        return true; // If endpoint doesn't exist, assume we need to generate
      }

      const data = await response.json();
      return data.needsRegeneration || false;
    } catch (error) {
      console.error('Error checking daily insights status:', error);
      return true; // Default to regenerating if there's an error
    }
  }

  /**
   * Mock daily insights for development
   */
  private getMockDailyInsights(userId: string): DailyInsight[] {
    const today = new Date().toISOString().split('T')[0];
    const now = new Date().toISOString();
    
    return [
      {
        id: `daily_${userId}_1`,
        user_id: userId,
        userId, // Legacy field
        title: 'Multi-Tool Analysis Complete',
        description: '3-source intelligence: Statistical models show 59.3% win probability vs 52.4% implied odds. Real-time data confirms no injuries. User profile matches medium risk tolerance.',
        type: 'analysis',
        category: 'analysis',
        source: 'AI Orchestrator',
        impact: 'high',
        timestamp: now,
        date: today,
        tools_used: ['sportsDataIO_getGamePrediction', 'webSearch_performSearch', 'userData_getUserPreferences'],
        toolsUsed: ['sportsDataIO_getGamePrediction', 'webSearch_performSearch', 'userData_getUserPreferences'], // Legacy field
        impact_score: 8.7,
        metadata: {
          processingTime: 27000,
          confidence: 85
        }
      },
      {
        id: `daily_${userId}_2`,
        user_id: userId,
        userId, // Legacy field
        title: 'Real-Time Intelligence Alert',
        description: 'Live intelligence detected: No relevant injuries for today\'s games. Weather conditions favor offensive play. Line movement suggests sharp money on home teams.',
        type: 'alert',
        category: 'news',
        source: 'Web Search + ESPN API',
        impact: 'medium',
        timestamp: new Date(Date.now() - 1800000).toISOString(),
        date: today,
        tools_used: ['webSearch_performSearch', 'freeData_getTeamNews'],
        toolsUsed: ['webSearch_performSearch', 'freeData_getTeamNews'], // Legacy field
        impact_score: 7.2
      },
      {
        id: `daily_${userId}_3`,
        user_id: userId,
        userId, // Legacy field
        title: 'Smart Stake Calculator',
        description: 'Optimal bankroll management calculated: Average 2.8% of bankroll recommended. Expected values range 8-12%. Model confidence intervals tightened. Risk-adjusted recommendations active.',
        type: 'value',
        category: 'calculator',
        source: 'Statistical Analyzer',
        impact: 'high',
        timestamp: new Date(Date.now() - 600000).toISOString(),
        date: today,
        tools_used: ['sportsDataIO_getGamePrediction', 'sportsBetting_getOptimalConfiguration'],
        toolsUsed: ['sportsDataIO_getGamePrediction', 'sportsBetting_getOptimalConfiguration'], // Legacy field
        impact_score: 9.1
      },
      {
        id: `daily_${userId}_4`,
        user_id: userId,
        userId, // Legacy field
        title: 'Performance Validation',
        description: 'Backtesting complete: Current strategies show 58.3% win rate over 312 similar games. Average ROI: +11.8%. Model accuracy trending upward.',
        type: 'trend',
        category: 'performance',
        source: 'Historical Data',
        impact: 'medium',
        timestamp: new Date(Date.now() - 900000).toISOString(),
        date: today,
        tools_used: ['sportsBetting_backtestStrategy'],
        toolsUsed: ['sportsBetting_backtestStrategy'], // Legacy field
        impact_score: 8.0
      }
    ];
  }
}

export const aiService = new AIService();