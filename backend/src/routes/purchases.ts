import express from 'express';
import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';

const router = express.Router();

// Initialize Supabase client with service role
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Regular client for user operations
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

interface PurchaseVerificationRequest {
  platform: 'ios' | 'android';
  purchaseToken?: string; // Android
  receipt?: string; // iOS
  productId: string;
  transactionId: string;
}

// Apple receipt verification types
interface AppleReceiptVerificationResponse {
  status: number;
  environment?: string;
  receipt?: {
    in_app: Array<{
      product_id: string;
      transaction_id: string;
      purchase_date_ms: string;
      expires_date_ms?: string;
    }>;
  };
  latest_receipt_info?: Array<{
    product_id: string;
    transaction_id: string;
    expires_date_ms: string;
    purchase_date_ms: string;
  }>;
  pending_renewal_info?: Array<{
    product_id: string;
    auto_renew_status: string;
  }>;
}

// TEMPORARY DEBUG ENDPOINT - REMOVE BEFORE PRODUCTION
router.get('/debug-env', (req, res) => {
  res.json({
    hasAppleSecret: !!process.env.APPLE_SHARED_SECRET,
    appleSecretLength: process.env.APPLE_SHARED_SECRET?.length || 0,
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString()
  });
});

// TEMPORARY TEST PURCHASE ENDPOINT FOR TESTFLIGHT DEBUGGING
router.post('/test-purchase', async (req, res) => {
  try {
    console.log('🧪 TEST PURCHASE ENDPOINT HIT');
    console.log('Headers:', req.headers);
    console.log('Body:', req.body);
    
    // Get auth header
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ 
        error: 'Missing or invalid authorization header',
        debug: 'No Bearer token found'
      });
    }

    const token = authHeader.substring(7);
    console.log('Token preview:', token.substring(0, 20) + '...');

    // Verify with Supabase
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return res.status(401).json({ 
        error: 'Invalid or expired token',
        debug: authError?.message || 'User not found'
      });
    }

    console.log('✅ User authenticated:', user.id);
    
    // Return success response
    res.json({
      success: true,
      message: 'Test purchase endpoint working correctly',
      userId: user.id,
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'unknown',
      hasAppleSecret: !!process.env.APPLE_SHARED_SECRET
    });
    
  } catch (error) {
    console.error('❌ Test purchase error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      debug: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Verify purchase endpoint
router.post('/verify', async (req, res) => {
  try {
    const {
      platform,
      purchaseToken,
      receipt,
      productId,
      transactionId,
    }: PurchaseVerificationRequest = req.body;

    console.log(`🔍 Verifying ${platform} purchase:`, {
      productId,
      transactionId: transactionId?.substring(0, 10) + '...',
    });

    // Get user from Supabase auth token
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or invalid authorization header' });
    }

    const token = authHeader.substring(7);
    let userId: string;

    try {
      // Verify with Supabase
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      if (authError || !user) {
        return res.status(401).json({ error: 'Invalid or expired token' });
      }
      userId = user.id;
    } catch (error) {
      console.error('❌ Auth verification error:', error);
      return res.status(401).json({ error: 'Authentication failed' });
    }

    // Verify the purchase with Apple/Google
    let isValid = false;
    let expirationDate: Date | null = null;

    if (platform === 'ios') {
      const result = await verifyAppleReceipt(receipt!);
      isValid = result.isValid;
      expirationDate = result.expirationDate;
    } else if (platform === 'android') {
      const result = await verifyGooglePurchase(productId, purchaseToken!);
      isValid = result.isValid;
      expirationDate = result.expirationDate;
    }

    if (!isValid) {
      console.log('❌ Purchase verification failed');
      return res.status(400).json({ error: 'Invalid purchase' });
    }

    // Get complete subscription details from product ID
    const subscriptionDetails = getSubscriptionDetails(productId);
    const { subscription_tier, subscription_plan_type, max_daily_picks, duration_days } = subscriptionDetails;
    
    console.log('🎯 Elite Subscription Processing:', {
      productId,
      subscription_tier,
      subscription_plan_type,
      max_daily_picks,
      duration_days
    });
    
    // Store purchase in database using admin client
    const { error: purchaseError } = await supabaseAdmin
      .from('user_purchases')
      .upsert({
        user_id: userId,
        platform,
        product_id: productId,
        transaction_id: transactionId,
        purchase_token: purchaseToken,
        receipt_data: receipt,
        status: 'active',
        expires_at: expirationDate,
        verified_at: new Date().toISOString(),
      }, {
        onConflict: 'transaction_id'
      });

    if (purchaseError) {
      console.error('❌ Failed to store purchase:', purchaseError);
      return res.status(500).json({ error: 'Failed to store purchase' });
    }

    // Update user's subscription status using admin client with complete subscription details
    const updateData: any = {
      subscription_tier: subscription_tier,
      subscription_plan_type: subscription_plan_type,
      subscription_status: 'active',
      max_daily_picks: max_daily_picks,
      subscription_started_at: new Date().toISOString(),
      subscription_renewed_at: new Date().toISOString(),
      auto_renew_enabled: subscription_plan_type !== 'lifetime',
      updated_at: new Date().toISOString(),
    };
    
    // Only set expiration for non-lifetime subscriptions
    if (subscription_plan_type !== 'lifetime') {
      updateData.subscription_expires_at = expirationDate;
    } else {
      updateData.subscription_expires_at = null; // Lifetime never expires
    }
    
    // Store receipt data for future verification
    if (platform === 'ios' && receipt) {
      updateData.apple_receipt_data = receipt;
    } else if (platform === 'android' && purchaseToken) {
      updateData.google_purchase_token = purchaseToken;
    }

    const { error: userError } = await supabaseAdmin
      .from('profiles')
      .update(updateData)
      .eq('id', userId);

    if (userError) {
      console.error('❌ Failed to update user subscription:', userError);
      return res.status(500).json({ error: 'Failed to update subscription' });
    }

    console.log(`✅ Elite subscription purchase verified and stored for user ${userId}:`, {
      subscription_tier,
      subscription_plan_type,
      max_daily_picks,
      expiresAt: expirationDate
    });
    
    res.json({
      success: true,
      subscriptionTier: subscription_tier,
      subscriptionPlanType: subscription_plan_type,
      maxDailyPicks: max_daily_picks,
      expiresAt: expirationDate,
    });

  } catch (error) {
    console.error('❌ Purchase verification error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Apple receipt verification
async function verifyAppleReceipt(receiptData: string): Promise<{ isValid: boolean; expirationDate: Date | null }> {
  try {
    console.log('🍎 Verifying Apple receipt...');
    
    const appleSharedSecret = process.env.APPLE_SHARED_SECRET;
    if (!appleSharedSecret) {
      console.error('❌ APPLE_SHARED_SECRET not configured');
      throw new Error('Apple shared secret not configured');
    }

    const requestBody = {
      'receipt-data': receiptData,
      'password': appleSharedSecret,
      'exclude-old-transactions': true,
    };

    // First try production environment (recommended by Apple)
    console.log('🍎 Attempting production verification first...');
    let response = await fetch('https://buy.itunes.apple.com/verifyReceipt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    let result = await response.json() as AppleReceiptVerificationResponse;
    console.log('🍎 Production verification result:', { status: result.status, environment: result.environment });

    // Handle different status codes according to Apple's documentation
    if (result.status === 21007) {
      // "Sandbox receipt used in production" - try sandbox environment
      console.log('🍎 Sandbox receipt detected, trying sandbox environment...');
      
      response = await fetch('https://sandbox.itunes.apple.com/verifyReceipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });
      
      result = await response.json() as AppleReceiptVerificationResponse;
      console.log('🍎 Sandbox verification result:', { status: result.status, environment: result.environment });
    } else if (result.status === 21008) {
      // "Production receipt used in sandbox" - this shouldn't happen in production but handle gracefully
      console.log('🍎 Production receipt in sandbox environment detected');
      return { isValid: false, expirationDate: null };
    } else if (result.status === 21010) {
      // "Receipt could not be authenticated" - invalid receipt
      console.log('🍎 Receipt could not be authenticated');
      return { isValid: false, expirationDate: null };
    } else if (result.status !== 0) {
      // Other error codes
      console.log('🍎 Apple receipt verification failed with status:', result.status);
      return { isValid: false, expirationDate: null };
    }

    // Success case (status === 0)
    if (result.status === 0) {
      console.log('✅ Apple receipt verified successfully');
      console.log('🍎 Verification environment:', result.environment);
      
      // Handle both auto-renewable subscriptions and non-consumable purchases
      let expirationDate: Date | null = null;
      
      if (result.latest_receipt_info && result.latest_receipt_info.length > 0) {
        // Auto-renewable subscription
        const latestReceipt = result.latest_receipt_info[0];
        console.log('🍎 Processing auto-renewable subscription:', latestReceipt.product_id);
        
        if (latestReceipt.expires_date_ms) {
          expirationDate = new Date(parseInt(latestReceipt.expires_date_ms));
          console.log('🍎 Subscription expires at:', expirationDate);
        }
      } else if (result.receipt && result.receipt.in_app && result.receipt.in_app.length > 0) {
        // Non-consumable purchase (lifetime)
        const purchase = result.receipt.in_app[0];
        console.log('🍎 Processing non-consumable purchase:', purchase.product_id);
        
        // Lifetime purchases don't expire
        expirationDate = null;
        console.log('🍎 Lifetime purchase - no expiration date');
      } else {
        console.log('⚠️ No purchase information found in receipt');
        return { isValid: false, expirationDate: null };
      }

      return {
        isValid: true,
        expirationDate,
      };
    }

    console.log('❌ Apple receipt verification failed:', result);
    return { isValid: false, expirationDate: null };

  } catch (error) {
    console.error('❌ Apple receipt verification error:', error);
    return { isValid: false, expirationDate: null };
  }
}

// Google Play purchase verification
async function verifyGooglePurchase(productId: string, purchaseToken: string): Promise<{ isValid: boolean; expirationDate: Date | null }> {
  try {
    // This requires Google Play Developer API setup
    // You'll need to configure OAuth2 credentials and use Google APIs
    
    // For now, return a placeholder - you'll implement this based on your Google Play setup
    console.log('🚧 Google Play verification not yet implemented');
    
    // TODO: Implement Google Play API verification
    // const response = await googlePlayDeveloperAPI.purchases.subscriptions.get({
    //   packageName: process.env.GOOGLE_PACKAGE_NAME,
    //   subscriptionId: productId,
    //   token: purchaseToken,
    // });

    return { isValid: true, expirationDate: null }; // Placeholder
    
  } catch (error) {
    console.error('Google Play verification error:', error);
    return { isValid: false, expirationDate: null };
  }
}

// Elite subscription plan configurations
const ELITE_PLANS = {
  'elite_weekly': {
    subscription_tier: 'elite',
    subscription_plan_type: 'weekly',
    max_daily_picks: 30,
    duration_days: 7
  },
  'elite_monthly': {
    subscription_tier: 'elite', 
    subscription_plan_type: 'monthly',
    max_daily_picks: 30,
    duration_days: 30
  },
  'elite_yearly': {
    subscription_tier: 'elite',
    subscription_plan_type: 'yearly', 
    max_daily_picks: 30,
    duration_days: 365
  }
};

// Pro subscription plan configurations
const PRO_PLANS = {
  'pro_weekly': {
    subscription_tier: 'pro',
    subscription_plan_type: 'weekly',
    max_daily_picks: 20,
    duration_days: 7
  },
  'pro_monthly': {
    subscription_tier: 'pro',
    subscription_plan_type: 'monthly',
    max_daily_picks: 20,
    duration_days: 30
  },
  'pro_yearly': {
    subscription_tier: 'pro',
    subscription_plan_type: 'yearly',
    max_daily_picks: 20,
    duration_days: 365
  },
  'pro_daypass': {
    subscription_tier: 'pro',
    subscription_plan_type: 'weekly', // Treat daypass as weekly for plan_type
    max_daily_picks: 20,
    duration_days: 1
  },
  'pro_lifetime': {
    subscription_tier: 'pro',
    subscription_plan_type: 'lifetime',
    max_daily_picks: 20,
    duration_days: null // No expiry
  }
};

// Enhanced function to get subscription details from product ID
function getSubscriptionDetails(productId: string): {
  subscription_tier: string;
  subscription_plan_type: string;
  max_daily_picks: number;
  duration_days: number | null;
} {
  console.log('🏷️ Mapping product ID to subscription details:', productId);
  
  // Complete product ID mapping with tier and plan type
  const productMapping: { [key: string]: any } = {
    // Legacy Pro tier products
    'com.parleyapp.premium_monthly': PRO_PLANS.pro_monthly,
    'com.parleyapp.premiumyearly': PRO_PLANS.pro_yearly, 
    'com.parleyapp.premium_lifetime': PRO_PLANS.pro_lifetime,
    'premium_monthly': PRO_PLANS.pro_monthly, // Android
    'premium_yearly': PRO_PLANS.pro_yearly,   // Android
    'premium_lifetime': PRO_PLANS.pro_lifetime, // Android
    
    // Current Pro tier products
    'com.parleyapp.pro_weekly': PRO_PLANS.pro_weekly,
    'com.parleyapp.pro_monthly': PRO_PLANS.pro_monthly,
    'com.parleyapp.pro_yearly': PRO_PLANS.pro_yearly,
    'com.parleyapp.pro_daypass': PRO_PLANS.pro_daypass,
    'com.parleyapp.pro_lifetime': PRO_PLANS.pro_lifetime,
    'pro_weekly': PRO_PLANS.pro_weekly, // Android
    'pro_monthly': PRO_PLANS.pro_monthly, // Android
    'pro_yearly': PRO_PLANS.pro_yearly, // Android
    'pro_daypass': PRO_PLANS.pro_daypass, // Android
    'pro_lifetime': PRO_PLANS.pro_lifetime, // Android
    
    // Elite tier products (using correct "allstar" product IDs)
    'com.parleyapp.allstarweekly': ELITE_PLANS.elite_weekly,
    'com.parleyapp.allstarmonthly': ELITE_PLANS.elite_monthly,
    'com.parleyapp.allstaryearly': ELITE_PLANS.elite_yearly,
    'com.parleyapp.elite_weekly': ELITE_PLANS.elite_weekly, // Backup mapping
    'com.parleyapp.elite_monthly': ELITE_PLANS.elite_monthly, // Backup mapping
    'com.parleyapp.elite_yearly': ELITE_PLANS.elite_yearly, // Backup mapping
    'elite_weekly': ELITE_PLANS.elite_weekly, // Android
    'elite_monthly': ELITE_PLANS.elite_monthly, // Android
    'elite_yearly': ELITE_PLANS.elite_yearly, // Android
    // Android Elite with full IDs
    'com.parleyapp.allstarweekly:weekly-elite2025': ELITE_PLANS.elite_weekly,
    'com.parleyapp.allstarmonthly:monthly-elite2025': ELITE_PLANS.elite_monthly,
    'com.parleyapp.allstaryearly:yearly-elite2025': ELITE_PLANS.elite_yearly
  };
  
  const details = productMapping[productId];
  if (details) {
    console.log('✅ Mapped to subscription details:', details);
    return details;
  }
  
  // Fallback to pattern matching for unknown products
  if (productId.includes('elite') || productId.includes('allstar')) {
    if (productId.includes('weekly')) return ELITE_PLANS.elite_weekly;
    if (productId.includes('monthly')) return ELITE_PLANS.elite_monthly;
    if (productId.includes('yearly')) return ELITE_PLANS.elite_yearly;
  }
  
  if (productId.includes('monthly')) return PRO_PLANS.pro_monthly;
  if (productId.includes('yearly')) return PRO_PLANS.pro_yearly;
  if (productId.includes('lifetime')) return PRO_PLANS.pro_lifetime;
  if (productId.includes('weekly')) return PRO_PLANS.pro_weekly;
  
  console.warn('⚠️ Unknown product ID, defaulting to free:', productId);
  return {
    subscription_tier: 'free',
    subscription_plan_type: 'monthly',
    max_daily_picks: 10,
    duration_days: 0
  };
}

// Legacy function for backward compatibility
function getSubscriptionTier(productId: string): string {
  return getSubscriptionDetails(productId).subscription_tier;
}

// Restore purchases endpoint
router.post('/restore', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing authorization header' });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    const userId = decoded.sub || decoded.userId;

    // Get user's active purchases
    const { data: purchases, error } = await supabase
      .from('user_purchases')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .gte('expires_at', new Date().toISOString());

    if (error) {
      console.error('❌ Failed to fetch purchases:', error);
      return res.status(500).json({ error: 'Failed to restore purchases' });
    }

    const activePurchase = purchases?.[0];
    if (activePurchase) {
      // Update user's subscription status with complete details
      const subscriptionDetails = getSubscriptionDetails(activePurchase.product_id);
      const { subscription_tier, subscription_plan_type, max_daily_picks } = subscriptionDetails;
      
      console.log('🔄 Restoring Elite subscription:', {
        productId: activePurchase.product_id,
        subscription_tier,
        subscription_plan_type,
        max_daily_picks
      });
      
      await supabase
        .from('profiles')
        .update({
          subscription_tier: subscription_tier,
          subscription_plan_type: subscription_plan_type,
          subscription_status: 'active',
          subscription_expires_at: activePurchase.expires_at,
          max_daily_picks: max_daily_picks,
          subscription_renewed_at: new Date().toISOString(),
          auto_renew_enabled: subscription_plan_type !== 'lifetime',
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId);
    }

    res.json({
      success: true,
      activePurchase: activePurchase || null,
    });

  } catch (error) {
    console.error('❌ Purchase restore error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user subscription status
router.get('/status', async (req, res) => {
  try {
    console.log('🔍 Checking subscription status...');

    // Get user from Supabase auth token
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or invalid authorization header' });
    }

    const token = authHeader.substring(7);
    let userId: string;

    try {
      // Verify with Supabase
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      if (authError || !user) {
        return res.status(401).json({ error: 'Invalid or expired token' });
      }
      userId = user.id;
    } catch (error) {
      console.error('❌ Auth verification error:', error);
      return res.status(401).json({ error: 'Authentication failed' });
    }

    // Get user profile with subscription info
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('subscription_tier, subscription_status, subscription_expires_at')
      .eq('id', userId)
      .single();

    if (profileError || !profile) {
      console.error('❌ Failed to fetch user profile:', profileError);
      return res.status(404).json({ error: 'User profile not found' });
    }

    // Calculate subscription status
    const tier = profile.subscription_tier || 'free';
    const status = profile.subscription_status || 'inactive';
    const expiresAt = profile.subscription_expires_at ? new Date(profile.subscription_expires_at) : null;
    
    const isLifetime = tier === 'pro_lifetime';
    const now = new Date();
    
    let isActive = false;
    let isPro = false;
    let daysRemaining: number | null = null;

    if (isLifetime) {
      // Lifetime subscriptions never expire
      isActive = status === 'active';
      isPro = true;
      daysRemaining = null;
    } else if (tier.startsWith('pro_') && expiresAt) {
      // Time-based subscriptions
      isActive = status === 'active' && expiresAt > now;
      isPro = isActive;
      daysRemaining = isActive ? Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : 0;
    } else {
      // Free tier or invalid subscription
      isActive = false;
      isPro = false;
      daysRemaining = null;
    }

    const response = {
      isActive,
      isPro,
      tier,
      status,
      expiresAt: expiresAt?.toISOString() || null,
      daysRemaining,
      isLifetime
    };

    console.log('✅ Subscription status:', { tier, isActive, isPro, daysRemaining });
    res.json(response);
    
  } catch (error) {
    console.error('❌ Subscription status check error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;