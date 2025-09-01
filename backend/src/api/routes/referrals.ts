import { Router, Response, Request } from 'express';
import { supabaseAdmin } from '../../services/supabaseClient';

// Define AuthenticatedRequest interface
interface AuthenticatedRequest extends Request {
  user?: any; // Using any to avoid type conflicts with Express Request.user
}

const router = Router();

// Get available rewards catalog
router.get('/rewards', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { data: rewards, error: rewardsError } = await supabaseAdmin
      .from('reward_catalog')
      .select('*')
      .eq('is_active', true)
      .order('points_cost', { ascending: true });

    if (rewardsError) throw rewardsError;

    res.json({ success: true, rewards });
  } catch (error) {
    console.error('Error fetching rewards:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch rewards' });
  }
});

// Get user's current referral status and points
router.get('/status', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'User not authenticated' });
    }

    // Get user's profile with referral data
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select(`
        referral_code, 
        referral_points, 
        subscription_tier
      `)
      .eq('id', userId)
      .single();

    if (profileError) throw profileError;

    // Get active reward claims
    const { data: activeClaims, error: claimsError } = await supabaseAdmin
      .from('user_reward_claims')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('expires_at', { ascending: true });

    if (claimsError) throw claimsError;

    // Calculate effective tier
    const effectiveTier = getEffectiveUserTier(profile);

    res.json({
      success: true,
      referralCode: profile.referral_code,
      points: {
        available: profile.referral_points || 0,
        pending: 0, // TODO: Add pending points tracking
        lifetime: 0 // TODO: Add lifetime points tracking
      },
      subscription: {
        baseTier: profile.subscription_tier || 'free',
        effectiveTier: profile.subscription_tier || 'free',
        temporaryUpgrade: null // TODO: Add temporary upgrade tracking
      },
      activeClaims: activeClaims || []
    });
  } catch (error) {
    console.error('Error fetching referral status:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch referral status' });
  }
});

// Claim a reward
router.post('/claim-reward', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { rewardId } = req.body;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'User not authenticated' });
    }

    if (!rewardId) {
      return res.status(400).json({ success: false, error: 'Reward ID is required' });
    }

    // Get reward details
    const { data: reward, error: rewardError } = await supabaseAdmin
      .from('reward_catalog')
      .select('*')
      .eq('id', rewardId)
      .eq('is_active', true)
      .single();

    if (rewardError) throw rewardError;
    if (!reward) {
      return res.status(404).json({ success: false, error: 'Reward not found' });
    }

    // Get user's current data
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (profileError) throw profileError;

    // Check if user has enough points
    if (profile.referral_points < reward.points_cost) {
      return res.status(400).json({ 
        success: false, 
        error: 'Insufficient points',
        required: reward.points_cost,
        available: profile.referral_points
      });
    }

    // Calculate expiration time
    const expiresAt = reward.duration_hours ? 
      new Date(Date.now() + reward.duration_hours * 60 * 60 * 1000) : null;

    // Handle different reward types
    if (reward.reward_type === 'temporary_upgrade') {
      await handleTemporaryUpgrade(userId, profile, reward, expiresAt);
    }

    // Create reward claim record
    const { data: claim, error: claimError } = await supabaseAdmin
      .from('user_reward_claims')
      .insert({
        user_id: userId,
        reward_id: rewardId,
        points_spent: reward.points_cost,
        expires_at: expiresAt,
        original_tier: profile.subscription_tier,
        metadata: { claimedAt: new Date().toISOString() }
      })
      .select()
      .single();

    if (claimError) throw claimError;

    // Deduct points from user
    const { error: pointsError } = await supabaseAdmin
      .from('profiles')
      .update({
        referral_points: profile.referral_points - reward.points_cost,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);

    if (pointsError) throw pointsError;

    res.json({
      success: true,
      message: `Successfully claimed ${reward.reward_name}!`,
      claim,
      newPointsBalance: profile.referral_points - reward.points_cost
    });

  } catch (error) {
    console.error('Error claiming reward:', error);
    res.status(500).json({ success: false, error: 'Failed to claim reward' });
  }
});

// Helper function to handle temporary tier upgrades
async function handleTemporaryUpgrade(
  userId: string, 
  profile: any, 
  reward: any, 
  expiresAt: Date | null
) {
  const currentTier = profile.subscription_tier || 'free';
  const upgradeTier = reward.upgrade_tier;
  
  // Store the base tier if not already set
  const baseTier = profile.base_subscription_tier || currentTier;
  
  // Only apply upgrade if it's actually an upgrade
  const tierHierarchy = { 'free': 0, 'pro': 1, 'elite': 2 };
  const currentLevel = tierHierarchy[currentTier] || 0;
  const upgradeLevel = tierHierarchy[upgradeTier] || 0;
  
  if (upgradeLevel > currentLevel) {
    const { error } = await supabaseAdmin
      .from('profiles')
      .update({
        base_subscription_tier: baseTier,
        subscription_tier: upgradeTier,
        temporary_tier_active: true,
        temporary_tier: upgradeTier,
        temporary_tier_expires_at: expiresAt?.toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);
    
    if (error) throw error;
  }
}

// Helper function to get effective user tier
function getEffectiveUserTier(profile: any): string {
  // If temporary upgrade is active and not expired
  if (profile.temporary_tier_active && profile.temporary_tier_expires_at) {
    const expiresAt = new Date(profile.temporary_tier_expires_at);
    if (expiresAt > new Date()) {
      return profile.temporary_tier;
    }
  }
  
  return profile.subscription_tier || 'free';
}

// Get referral statistics
router.get('/stats', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'User not authenticated' });
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('referral_code')
      .eq('id', userId)
      .single();

    if (profileError) throw profileError;

    // Count successful referrals
    const { count: referralCount } = await supabaseAdmin
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('referred_by', profile.referral_code)
      .eq('phone_verified', true); // Only count verified users

    // Get recent claims
    const { data: recentClaims, error: claimsError } = await supabaseAdmin
      .from('user_reward_claims')
      .select(`
        *,
        referral_rewards (reward_name, points_cost)
      `)
      .eq('user_id', userId)
      .order('claimed_at', { ascending: false })
      .limit(5);

    if (claimsError) throw claimsError;

    res.json({
      success: true,
      stats: {
        totalReferrals: referralCount || 0,
        recentClaims: recentClaims || []
      }
    });

  } catch (error) {
    console.error('Error fetching referral stats:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch referral stats' });
  }
});

export default router;
