const { createClient } = require('@supabase/supabase-js');
const logger = require('../utils/logger');

class AuthService {
  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
  }

  async validateUser(userId) {
    try {
      // Get user from Supabase
      const { data: user, error } = await this.supabase
        .from('users')
        .select(`
          id,
          email,
          subscription_tier,
          betting_preferences,
          timezone,
          created_at,
          is_active
        `)
        .eq('id', userId)
        .single();

      if (error) {
        logger.error('User lookup error:', error);
        return null;
      }

      if (!user || !user.is_active) {
        logger.warn(`User ${userId} not found or inactive`);
        return null;
      }

      // Get subscription details
      const { data: subscription } = await this.supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'active')
        .single();

      return {
        ...user,
        subscription: subscription || null,
        hasActiveSubscription: !!subscription
      };

    } catch (error) {
      logger.error('Auth service error:', error);
      return null;
    }
  }

  async getUserPreferences(userId) {
    try {
      const { data: preferences, error } = await this.supabase
        .from('user_preferences')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') { // Not found is okay
        logger.error('Error fetching user preferences:', error);
        return {};
      }

      return preferences?.preferences || {};
    } catch (error) {
      logger.error('User preferences error:', error);
      return {};
    }
  }

  async updateLastActivity(userId) {
    try {
      await this.supabase
        .from('users')
        .update({ last_activity: new Date().toISOString() })
        .eq('id', userId);
    } catch (error) {
      logger.error('Failed to update last activity:', error);
    }
  }

  async logAgentInteraction(userId, sessionId, interactionData) {
    try {
      await this.supabase
        .from('agent_interactions')
        .insert({
          user_id: userId,
          session_id: sessionId,
          interaction_type: interactionData.type,
          message_content: interactionData.content,
          tools_used: interactionData.toolsUsed || [],
          response_time_ms: interactionData.responseTime,
          created_at: new Date().toISOString()
        });
    } catch (error) {
      logger.error('Failed to log agent interaction:', error);
    }
  }

  async checkUserLimits(userId, subscriptionTier) {
    try {
      const now = new Date();
      const startOfDay = new Date(now);
      startOfDay.setHours(0, 0, 0, 0);

      // Get today's interaction count
      const { count: todayInteractions } = await this.supabase
        .from('agent_interactions')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gte('created_at', startOfDay.toISOString());

      // Define limits based on subscription tier
      const limits = {
        'free': { daily: 5, concurrent: 1 },
        'pro': { daily: 100, concurrent: 3 },
        'premium': { daily: 500, concurrent: 5 }
      };

      const userLimits = limits[subscriptionTier] || limits['free'];

      return {
        canInteract: todayInteractions < userLimits.daily,
        dailyUsed: todayInteractions,
        dailyLimit: userLimits.daily,
        concurrentLimit: userLimits.concurrent
      };

    } catch (error) {
      logger.error('Error checking user limits:', error);
      return {
        canInteract: true, // Default to allowing interaction on error
        dailyUsed: 0,
        dailyLimit: 5,
        concurrentLimit: 1
      };
    }
  }

  async validateAPIKey(apiKey) {
    // For internal service authentication
    if (!apiKey || apiKey !== process.env.INTERNAL_API_KEY) {
      return false;
    }
    return true;
  }

  async createGuestSession() {
    // Create temporary guest session for demo purposes
    const guestId = `guest_${Date.now()}`;
    
    return {
      id: guestId,
      email: `${guestId}@demo.parleyapp.com`,
      subscription_tier: 'free',
      betting_preferences: {},
      timezone: 'UTC',
      created_at: new Date().toISOString(),
      is_active: true,
      isGuest: true,
      hasActiveSubscription: false
    };
  }

  async revokeUserSession(userId, reason = 'manual') {
    try {
      await this.supabase
        .from('user_sessions')
        .update({ 
          revoked: true, 
          revoked_at: new Date().toISOString(),
          revocation_reason: reason
        })
        .eq('user_id', userId);

      logger.info(`Revoked sessions for user ${userId}: ${reason}`);
    } catch (error) {
      logger.error('Failed to revoke user session:', error);
    }
  }
}

module.exports = { AuthService };
