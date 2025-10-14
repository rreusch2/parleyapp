import express, { Request, Response } from 'express';
import { createLogger } from '../../utils/logger';
import { supabaseAdmin } from '../../services/supabase/client';
import { authenticateUser } from '../middleware/auth';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();
const logger = createLogger('referralRoutes');

// Generate unique referral code
function generateReferralCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

/**
 * @route GET /api/referrals/me
 * @desc Get user's referral info
 * @access Private
 */
router.get('/me', authenticateUser, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { data: profile, error } = await supabaseAdmin
      .from('profiles')
      .select('referral_code, referral_points, referral_points_pending, referral_points_lifetime')
      .eq('id', userId)
      .single();

    if (error) {
      logger.error('Error fetching referral info:', error);
      return res.status(500).json({ error: 'Failed to fetch referral info' });
    }

    return res.json({
      referral_code: profile.referral_code,
      referral_points: profile.referral_points || 0,
      referral_points_pending: profile.referral_points_pending || 0,
      referral_points_lifetime: profile.referral_points_lifetime || 0
    });
  } catch (error: any) {
    logger.error('Error in /me:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @route POST /api/referrals/generate
 * @desc Generate new referral code
 * @access Private
 */
router.post('/generate', authenticateUser, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Generate unique code
    let referralCode: string;
    let isUnique = false;
    let attempts = 0;

    while (!isUnique && attempts < 10) {
      referralCode = generateReferralCode();
      
      const { data: existing } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('referral_code', referralCode)
        .single();
      
      if (!existing) {
        isUnique = true;
      }
      attempts++;
    }

    if (!isUnique) {
      return res.status(500).json({ error: 'Failed to generate unique code' });
    }

    // Update user profile
    const { error } = await supabaseAdmin
      .from('profiles')
      .update({ referral_code: referralCode! })
      .eq('id', userId);

    if (error) {
      logger.error('Error updating referral code:', error);
      return res.status(500).json({ error: 'Failed to save referral code' });
    }

    return res.json({ referral_code: referralCode! });
  } catch (error: any) {
    logger.error('Error in /generate:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @route POST /api/referrals/claim
 * @desc Claim referral code on signup
 * @access Private
 */
router.post('/claim', authenticateUser, async (req, res) => {
  try {
    const userId = req.user?.id;
    const { code } = req.body;

    if (!userId || !code) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Find referrer
    const { data: referrer, error: referrerError } = await supabaseAdmin
      .from('profiles')
      .select('id, referral_points')
      .eq('referral_code', code.toUpperCase())
      .single();

    if (referrerError || !referrer) {
      return res.status(400).json({ error: 'Invalid referral code' });
    }

    if (referrer.id === userId) {
      return res.status(400).json({ error: 'Cannot use your own referral code' });
    }

    // Check if user already used a referral
    const { data: existingUser } = await supabaseAdmin
      .from('profiles')
      .select('referred_by')
      .eq('id', userId)
      .single();

    if (existingUser?.referred_by) {
      return res.status(400).json({ error: 'Referral code already used' });
    }

    // Award signup bonus (25 points to referrer)
    const signupBonus = 25;
    
    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({
        referred_by: referrer.id,
        referral_points_pending: (referrer.referral_points || 0) + signupBonus,
        referral_points_lifetime: (referrer.referral_points || 0) + signupBonus
      })
      .eq('id', referrer.id);

    if (updateError) {
      logger.error('Error updating referrer points:', updateError);
      return res.status(500).json({ error: 'Failed to process referral' });
    }

    // Update referee
    await supabaseAdmin
      .from('profiles')
      .update({ referred_by: referrer.id })
      .eq('id', userId);

    return res.json({ 
      success: true, 
      message: `Referral claimed! ${signupBonus} points pending for referrer.` 
    });
  } catch (error: any) {
    logger.error('Error in /claim:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @route POST /api/referrals/subscription-bonus
 * @desc Award referral bonus when referred user subscribes
 * @access Private (called internally)
 */
router.post('/subscription-bonus', async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'Missing userId' });
    }

    // Get user's referrer
    const { data: user, error } = await supabaseAdmin
      .from('profiles')
      .select('referred_by')
      .eq('id', userId)
      .single();

    if (error || !user?.referred_by) {
      return res.json({ success: true, message: 'No referrer to reward' });
    }

    // Award subscription bonus (100 points)
    const subscriptionBonus = 100;

    const { data: referrer } = await supabaseAdmin
      .from('profiles')
      .select('referral_points_pending, referral_points, referral_points_lifetime')
      .eq('id', user.referred_by)
      .single();

    if (referrer) {
      await supabaseAdmin
        .from('profiles')
        .update({
          referral_points: (referrer.referral_points || 0) + subscriptionBonus,
          referral_points_pending: Math.max(0, (referrer.referral_points_pending || 0) - 25), // Convert pending to active
          referral_points_lifetime: (referrer.referral_points_lifetime || 0) + subscriptionBonus
        })
        .eq('id', user.referred_by);
    }

    return res.json({ 
      success: true, 
      message: `${subscriptionBonus} points awarded to referrer` 
    });
  } catch (error: any) {
    logger.error('Error in /subscription-bonus:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
