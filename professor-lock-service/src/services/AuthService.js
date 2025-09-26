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
      // Get profile from Supabase (we use 'profiles' not 'users')
      const { data: profile, error: profileError } = await this.supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (profileError) {
        logger.error('User lookup error (profiles):', profileError);
        return null;
      }

      if (!profile || profile.is_active === false) {
        logger.warn(`User ${userId} not found in profiles or inactive`);
        return null;
      }

      // Determine effective subscription using view if available
      let effectiveTier = profile.subscription_tier || profile.base_subscription_tier || 'free';
      let effectiveTierExpiresAt = null;
      try {
        const { data: tierRow, error: tierError } = await this.supabase
          .from('v_profiles_effective_tier')
          .select('effective_tier,effective_tier_expires_at,base_subscription_tier,subscription_status')
          .eq('id', userId)
          .single();
        if (!tierError && tierRow) {
          effectiveTier = tierRow.effective_tier || effectiveTier;
          effectiveTierExpiresAt = tierRow.effective_tier_expires_at || null;
        }
      } catch (e) {
        // Fallback handled above
      }

      const hasActiveSubscription = (effectiveTier && effectiveTier.toLowerCase() !== 'free');

      return {
        ...profile,
        subscription: {
          effective_tier: effectiveTier,
          effective_tier_expires_at: effectiveTierExpiresAt,
          base_subscription_tier: profile.base_subscription_tier,
          subscription_status: profile.subscription_status
        },
        hasActiveSubscription
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
      // Profiles table doesn't track last_activity; update updated_at as a heartbeat
      await this.supabase
        .from('profiles')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', userId);
    } catch (error) {
      logger.error('Failed to update last activity:', error);
    }
  }

  async logAgentInteraction(userId, sessionId, interactionData) {
    try {
      // Use admin_chats as a lightweight log (table exists, RLS off for service key)
      await this.supabase
        .from('admin_chats')
        .insert({
          user_id: userId,
          content: JSON.stringify({
            session_id: sessionId,
            type: interactionData.type,
            content: interactionData.content,
            tools_used: interactionData.toolsUsed || [],
            response_time_ms: interactionData.responseTime,
          }),
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
      // Use admin_chats as a proxy for interactions
      const { count: todayInteractions } = await this.supabase
        .from('admin_chats')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gte('created_at', startOfDay.toISOString());

      // Define limits based on subscription tier
      const limits = {
        'free': { daily: 10, concurrent: 1 },
        'pro': { daily: 100, concurrent: 3 },
        'elite': { daily: 500, concurrent: 5 }
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
      // No user_sessions table in schema; noop with log for compatibility
      logger.info(`revokeUserSession called for ${userId} (${reason}) - no user_sessions table, skipping`);
    } catch (error) {
      logger.error('Failed to revoke user session:', error);
    }
  }
}

module.exports = { AuthService };
