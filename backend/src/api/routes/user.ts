import express from 'express';
import { createLogger } from '../../utils/logger';
import { supabase, supabaseAdmin } from '../../services/supabase/client';

const router = express.Router();
const logger = createLogger('userRoutes');

/**
 * @route GET /api/user/stats
 * @desc Get user betting statistics
 * @access Private
 */
router.get('/stats', async (req, res) => {
  try {
    logger.info('Fetching user stats');
    
    // This would normally fetch real user stats from your database
    // For now, returning calculated stats based on user's betting history
    const stats = {
      todayPicks: 3,
      winRate: '67%',
      roi: '+22.4%',
      streak: 5,
      totalBets: 86,
      profitLoss: '+$2,456'
    };
    
    return res.status(200).json({
      success: true,
      stats
    });
  } catch (error: any) {
    logger.error(`Error fetching user stats: ${error instanceof Error ? error.message : String(error)}`);
    return res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch user stats' 
    });
  }
});

/**
 * @route PUT /api/user/preferences
 * @desc Save user betting preferences
 * @access Private
 */
router.put('/preferences', async (req, res) => {
  try {
    const preferences = req.body;
    const { authorization } = req.headers;
    
    if (!authorization) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized: Authentication token required'
      });
    }
    
    // Extract token from Bearer
    const token = authorization.replace('Bearer ', '');
    
    // Get user from token
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      logger.error(`Auth error: ${authError?.message}`);
      return res.status(401).json({
        success: false,
        error: 'Unauthorized: Invalid authentication token'
      });
    }
    
    if (!preferences) {
      return res.status(400).json({
        success: false,
        error: 'Preferences data is required'
      });
    }
    
    logger.info(`Updating preferences for user ${user.id}:`, preferences);
    
    // Update the specific columns in profiles table
    const updateData: Record<string, any> = {};
    
    // Map incoming preferences to database columns
    if (preferences.sport_preferences !== undefined) {
      updateData.sport_preferences = preferences.sport_preferences;
    }
    
    if (preferences.betting_style !== undefined) {
      updateData.betting_style = preferences.betting_style;
    }
    
    if (preferences.pick_distribution !== undefined) {
      updateData.pick_distribution = preferences.pick_distribution;
    }
    
    if (preferences.preferred_sports !== undefined) {
      updateData.preferred_sports = preferences.preferred_sports;
    }
    
    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid preferences provided for update'
      });
    }
    
    // Update profile with new preferences
    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update(updateData)
      .eq('id', user.id);
    
    if (updateError) {
      logger.error(`Error updating preferences: ${updateError.message}`);
      return res.status(500).json({
        success: false,
        error: 'Failed to save preferences to database'
      });
    }
    
    return res.status(200).json({
      success: true,
      message: 'Preferences saved successfully'
    });
  } catch (error: any) {
    logger.error(`Error saving preferences: ${error instanceof Error ? error.message : String(error)}`);
    return res.status(500).json({ 
      success: false, 
      error: 'Failed to save preferences' 
    });
  }
});

/**
 * @route GET /api/user/preferences
 * @desc Get user betting preferences
 * @access Private
 */
router.get('/preferences', async (req, res) => {
  try {
    logger.info('Fetching user preferences');
    
    // This would normally fetch from your database
    const preferences = {
      risk_tolerance: 'medium',
      sports: ['Basketball', 'Football', 'Baseball'],
      bet_types: ['moneyline', 'spread', 'total'],
      max_bet_size: 500,
      notification_preferences: {
        frequency: 'daily',
        types: ['new_predictions', 'bet_results']
      }
    };
    
    return res.status(200).json({
      success: true,
      preferences
    });
  } catch (error: any) {
    logger.error(`Error fetching preferences: ${error instanceof Error ? error.message : String(error)}`);
    return res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch preferences' 
    });
  }
});

/**
 * @route GET /api/user/profile
 * @desc Get user profile information
 * @access Private
 */
router.get('/profile', async (req, res) => {
  try {
    const { userId } = req.query;
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    logger.info(`👤 Fetching profile for user ${userId}`);

    const { data: profile, error } = await supabaseAdmin
      .from('profiles')
      .select(`
        id, username, subscription_tier, subscription_status, 
        welcome_bonus_claimed, welcome_bonus_expires_at, 
        created_at, updated_at, sport_preferences, 
        betting_style, pick_distribution, trial_used
      `)
      .eq('id', userId)
      .single();

    if (error) {
      logger.error(`❌ Error fetching user profile: ${error.message}`);
      return res.status(500).json({ error: 'Failed to fetch user profile' });
    }

    if (!profile) {
      return res.status(404).json({ error: 'User profile not found' });
    }

    // Calculate welcome bonus status
    const now = new Date();
    const expiresAt = profile.welcome_bonus_expires_at ? new Date(profile.welcome_bonus_expires_at) : null;
    const isWelcomeBonusActive = profile.welcome_bonus_claimed && expiresAt && now < expiresAt;

    res.json({
      success: true,
      profile: {
        ...profile,
        welcome_bonus_active: isWelcomeBonusActive
      }
    });

  } catch (error) {
    logger.error('Error fetching user profile:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user profile'
    });
  }
});

/**
 * @route GET /api/coins/balance
 * @desc Get user coin balance (placeholder for future implementation)
 * @access Private
 */
router.get('/coins/balance', async (req, res) => {
  try {
    const { userId } = req.query;
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    logger.info(`🪙 Fetching coin balance for user ${userId}`);

    // Placeholder implementation - can be extended when coin system is implemented
    const balance = {
      coins: 0,
      earned_today: 0,
      lifetime_earned: 0,
      last_earned: null
    };

    res.json({
      success: true,
      balance
    });

  } catch (error) {
    logger.error('Error fetching coin balance:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch coin balance'
    });
  }
});

/**
 * @route GET /api/user/welcome-bonus-status
 * @desc Check if user has active welcome bonus
 * @access Private
 */
router.get('/welcome-bonus-status', async (req, res) => {
  try {
    const { userId } = req.query;
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    logger.info(`🎁 Checking welcome bonus status for user ${userId}`);

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('welcome_bonus_claimed, welcome_bonus_expires_at, subscription_tier, subscription_expires_at, subscription_status, created_at')
      .eq('id', userId)
      .single();

    if (error) {
      logger.error(`❌ Error fetching user profile: ${error.message}`);
      return res.status(500).json({ error: 'Failed to fetch user profile' });
    }

    if (!profile) {
      return res.status(404).json({ error: 'User profile not found' });
    }

    const now = new Date();
    const expiresAt = profile.welcome_bonus_expires_at ? new Date(profile.welcome_bonus_expires_at) : null;
    const isWelcomeBonusActive = profile.welcome_bonus_claimed && expiresAt && now < expiresAt;
    
    // Calculate time remaining for welcome bonus
    const timeRemaining = isWelcomeBonusActive && expiresAt ? 
      Math.max(0, expiresAt.getTime() - now.getTime()) : 0;
    
    const hoursRemaining = Math.floor(timeRemaining / (1000 * 60 * 60));
    const minutesRemaining = Math.floor((timeRemaining % (1000 * 60 * 60)) / (1000 * 60));

    // Determine pick allowance
    let dailyPickLimit = 2; // Default free tier
    let bonusType = null;
    
    // CRITICAL FIX: Check subscription tier FIRST, welcome bonus should not override paid subscriptions
    if (profile.subscription_tier === 'pro' || profile.subscription_tier === 'elite') {
      // Check if subscription is still active (not expired)
      const now = new Date();
      const expiresAt = profile.subscription_expires_at ? new Date(profile.subscription_expires_at) : null;
      const isSubscriptionActive = !expiresAt || now < expiresAt;
      
      if (isSubscriptionActive) {
        if (profile.subscription_tier === 'pro') {
          dailyPickLimit = 20; // Pro tier gets 20 picks
          bonusType = 'pro_unlimited';
        } else if (profile.subscription_tier === 'elite') {
          dailyPickLimit = 30; // Elite tier gets 30 picks
          bonusType = 'elite_unlimited';
        }
      } else {
        // Subscription expired - downgrade to free and clear welcome bonus
        await supabase
          .from('profiles')
          .update({ 
            subscription_tier: 'free', 
            subscription_status: 'inactive',
            welcome_bonus_claimed: false,
            welcome_bonus_expires_at: null 
          })
          .eq('id', userId);
        
        dailyPickLimit = 2; // Free tier
        bonusType = null;
        logger.info(`⚠️ Subscription expired for user ${userId}, downgraded to free tier`);
      }
    } else if (isWelcomeBonusActive) {
      dailyPickLimit = 5; // Welcome bonus (only for free tier users)
      bonusType = 'welcome_bonus';
    }

    const status = {
      user_id: userId,
      subscription_tier: profile.subscription_tier,
      welcome_bonus_claimed: profile.welcome_bonus_claimed,
      welcome_bonus_active: isWelcomeBonusActive,
      welcome_bonus_expires_at: profile.welcome_bonus_expires_at,
      daily_pick_limit: dailyPickLimit,
      bonus_type: bonusType,
      time_remaining: {
        total_ms: timeRemaining,
        hours: hoursRemaining,
        minutes: minutesRemaining,
        display: isWelcomeBonusActive ? 
          `${hoursRemaining}h ${minutesRemaining}m remaining` : 
          null
      },
      created_at: profile.created_at
    };

    logger.info(`🎁 Welcome bonus status: ${JSON.stringify(status)}`);

    res.json({
      success: true,
      status
    });

  } catch (error: any) {
    logger.error(`💥 Error checking welcome bonus status: ${error instanceof Error ? error.message : String(error)}`);
    res.status(500).json({
      error: 'Failed to check welcome bonus status',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * @route DELETE /api/user/delete-account
 * @desc Delete user account and all associated data
 * @access Private
 */
router.delete('/delete-account', async (req, res) => {
  try {
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'User ID is required'
      });
    }
    
    logger.info(`Starting account deletion process for user: ${userId}`);
    
    // Start a transaction-like process by deleting data in dependency order
    const deletionSteps = [];
    
    try {
      // 1. Delete AI insights
      const { error: insightsError } = await supabase
        .from('ai_insights')
        .delete()
        .eq('user_id', userId);
      
      if (insightsError) {
        logger.error('Error deleting AI insights:', insightsError);
        deletionSteps.push('ai_insights: failed');
      } else {
        deletionSteps.push('ai_insights: success');
      }
      
      // 2. Delete AI predictions
      const { error: predictionsError } = await supabase
        .from('ai_predictions')
        .delete()
        .eq('user_id', userId);
      
      if (predictionsError) {
        logger.error('Error deleting AI predictions:', predictionsError);
        deletionSteps.push('ai_predictions: failed');
      } else {
        deletionSteps.push('ai_predictions: success');
      }
      
      // 3. Delete user preferences
      const { error: preferencesError } = await supabase
        .from('user_preferences')
        .delete()
        .eq('user_id', userId);
      
      if (preferencesError) {
        logger.error('Error deleting user preferences:', preferencesError);
        deletionSteps.push('user_preferences: failed');
      } else {
        deletionSteps.push('user_preferences: success');
      }
      
      // 4. Delete from profiles table (main user data)
      const { error: profileError } = await supabase
        .from('profiles')
        .delete()
        .eq('id', userId);
      
      if (profileError) {
        logger.error('Error deleting user profile:', profileError);
        deletionSteps.push('profiles: failed');
        
        return res.status(500).json({
          success: false,
          error: 'Failed to delete user profile',
          details: deletionSteps
        });
      } else {
        deletionSteps.push('profiles: success');
      }
      
      // 5. Delete from Supabase Auth (this should be done last)
      const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId);
      
      if (authError) {
        logger.error('Error deleting from auth:', authError);
        deletionSteps.push('auth: failed');
        
        return res.status(500).json({
          success: false,
          error: 'Failed to delete user from authentication system',
          details: deletionSteps
        });
      } else {
        deletionSteps.push('auth: success');
      }
      
      logger.info(`Account deletion completed successfully for user: ${userId}`);
      logger.info('Deletion steps:', deletionSteps);
      
      return res.status(200).json({
        success: true,
        message: 'Account deleted successfully',
        deletedData: {
          user_id: userId,
          steps: deletionSteps
        }
      });
      
    } catch (deletionError: any) {
      logger.error('Error during account deletion:', deletionError);
      
      return res.status(500).json({
        success: false,
        error: 'Failed to complete account deletion',
        details: deletionSteps,
        debugInfo: deletionError.message
      });
    }
    
  } catch (error: any) {
    logger.error(`Error in delete account endpoint: ${error instanceof Error ? error.message : String(error)}`);
    return res.status(500).json({ 
      success: false, 
      error: 'Internal server error during account deletion' 
    });
  }
});

export default router; 