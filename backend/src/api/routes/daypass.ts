import express from 'express';
import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';

const router = express.Router();

// Initialize Supabase admin client
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface DayPassPurchaseRequest {
  userId: string;
  productId: string;
  tier: 'pro' | 'elite';
  receiptData?: string;
  transactionId?: string;
}

// Activate day pass for user
router.post('/activate', express.json(), async (req, res) => {
  try {
    const { userId, productId, tier, receiptData, transactionId } = req.body as DayPassPurchaseRequest;
    
    console.log('🎯 Activating day pass:', { userId, productId, tier });
    
    if (!userId || !productId || !tier) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields' 
      });
    }
    
    // Validate product IDs
    const validDayPassProducts = {
      'dailypasspro': 'pro',
      'com.parleyapp.prodaypass': 'pro',
      'com.parleyapp.elitedaypass': 'elite',
      'elite_daypass': 'elite',
      'pro_daypass': 'pro'
    };
    
    const expectedTier = validDayPassProducts[productId];
    if (!expectedTier || expectedTier !== tier) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid product or tier mismatch' 
      });
    }
    
    // Calculate expiry (24 hours from now)
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);
    
    // Get current user profile
    const { data: currentProfile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('subscription_tier, base_subscription_tier')
      .eq('id', userId)
      .single();
    
    if (profileError || !currentProfile) {
      console.error('❌ Failed to get user profile:', profileError);
      return res.status(404).json({ 
        success: false, 
        error: 'User not found' 
      });
    }
    
    // Store current subscription as base if user has an active subscription
    const baseSubscription = currentProfile.subscription_tier !== 'free' 
      ? currentProfile.subscription_tier 
      : 'free';
    
    // Update user profile with temporary tier (day pass)
    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({
        // Keep the base subscription_tier unchanged or set to the temporary tier
        subscription_tier: tier, // This makes the UI work immediately
        base_subscription_tier: baseSubscription, // Store original tier
        temporary_tier_active: true,
        temporary_tier: tier,
        temporary_tier_expires_at: expiresAt.toISOString(),
        
        // Set subscription product info for tracking
        subscription_product_id: productId,
        subscription_expires_at: expiresAt.toISOString(),
        subscription_status: 'active',
        subscription_plan_type: 'daypass',
        
        // Store receipt if provided
        ...(receiptData && { apple_receipt_data: receiptData }),
        
        // Clear welcome bonus since they paid
        welcome_bonus_claimed: false,
        welcome_bonus_expires_at: null,
        
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);
    
    if (updateError) {
      console.error('❌ Failed to update user profile:', updateError);
      return res.status(500).json({ 
        success: false, 
        error: 'Failed to activate day pass' 
      });
    }
    
    // Log the purchase for analytics
    await supabaseAdmin
      .from('subscription_events')
      .insert({
        user_id: userId,
        event_type: 'day_pass_purchase',
        product_id: productId,
        tier: tier,
        transaction_id: transactionId,
        expires_at: expiresAt.toISOString(),
        metadata: {
          receipt_data: receiptData,
          duration_hours: 24
        }
      })
      .select()
      .single();
    
    console.log(`✅ Day pass activated for user ${userId}: ${tier} tier until ${expiresAt.toISOString()}`);
    
    res.json({ 
      success: true, 
      tier: tier,
      expiresAt: expiresAt.toISOString(),
      message: `${tier === 'elite' ? 'Elite' : 'Pro'} Day Pass activated for 24 hours!`
    });
    
  } catch (error) {
    console.error('❌ Day pass activation error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

// Check day pass status
router.get('/status/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const { data: profile, error } = await supabaseAdmin
      .from('profiles')
      .select('subscription_tier, temporary_tier_active, temporary_tier, temporary_tier_expires_at, base_subscription_tier')
      .eq('id', userId)
      .single();
    
    if (error || !profile) {
      return res.status(404).json({ 
        success: false, 
        error: 'User not found' 
      });
    }
    
    // Check if temporary tier is active and not expired
    const now = new Date();
    const expiresAt = profile.temporary_tier_expires_at ? new Date(profile.temporary_tier_expires_at) : null;
    
    const isDayPassActive = profile.temporary_tier_active && 
                           expiresAt && 
                           expiresAt > now;
    
    res.json({
      success: true,
      isDayPassActive,
      currentTier: isDayPassActive ? profile.temporary_tier : profile.subscription_tier,
      dayPassTier: profile.temporary_tier,
      expiresAt: profile.temporary_tier_expires_at,
      baseTier: profile.base_subscription_tier || 'free'
    });
    
  } catch (error) {
    console.error('❌ Day pass status check error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

// Expire day passes (can be called by cron job)
router.post('/expire', async (req, res) => {
  try {
    // Reset expired temporary tiers
    const { data: expired, error } = await supabaseAdmin
      .rpc('reset_expired_temporary_tiers');
    
    if (error) {
      console.error('❌ Failed to expire day passes:', error);
      return res.status(500).json({ 
        success: false, 
        error: 'Failed to expire day passes' 
      });
    }
    
    console.log('✅ Expired day passes processed');
    
    res.json({ 
      success: true, 
      message: 'Expired day passes processed' 
    });
    
  } catch (error) {
    console.error('❌ Day pass expiry error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

export default router;
