import express from 'express';
import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';

const router = express.Router();

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface PurchaseVerificationRequest {
  platform: 'ios' | 'android';
  purchaseToken?: string; // Android
  receipt?: string; // iOS
  productId: string;
  transactionId: string;
}

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

    // Get user from JWT token
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or invalid authorization header' });
    }

    const token = authHeader.substring(7);
    let userId: string;

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
      userId = decoded.sub || decoded.userId;
    } catch (error) {
      return res.status(401).json({ error: 'Invalid token' });
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

    // Map product ID to subscription tier
    const subscriptionTier = getSubscriptionTier(productId);
    
    // Store purchase in database
    const { error: purchaseError } = await supabase
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

    // Update user's subscription status
    const { error: userError } = await supabase
      .from('profiles')
      .update({
        subscription_tier: subscriptionTier,
        subscription_status: 'active',
        subscription_expires_at: expirationDate,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    if (userError) {
      console.error('❌ Failed to update user subscription:', userError);
      return res.status(500).json({ error: 'Failed to update subscription' });
    }

    console.log(`✅ Purchase verified and stored for user ${userId}`);
    
    res.json({
      success: true,
      subscriptionTier,
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
    // First try production environment
    let response = await fetch('https://buy.itunes.apple.com/verifyReceipt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        'receipt-data': receiptData,
        'password': process.env.APPLE_SHARED_SECRET, // Your App Store Connect shared secret
        'exclude-old-transactions': true,
      }),
    });

    let result = await response.json();

    // If status is 21007, try sandbox environment
    if (result.status === 21007) {
      response = await fetch('https://sandbox.itunes.apple.com/verifyReceipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          'receipt-data': receiptData,
          'password': process.env.APPLE_SHARED_SECRET,
          'exclude-old-transactions': true,
        }),
      });
      result = await response.json();
    }

    if (result.status === 0) {
      // Find the latest subscription
      const latestReceipt = result.latest_receipt_info?.[0];
      const expirationDate = latestReceipt?.expires_date_ms 
        ? new Date(parseInt(latestReceipt.expires_date_ms))
        : null;

      return {
        isValid: true,
        expirationDate,
      };
    }

    console.log('Apple receipt verification failed:', result);
    return { isValid: false, expirationDate: null };

  } catch (error) {
    console.error('Apple receipt verification error:', error);
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

// Map product ID to subscription tier
function getSubscriptionTier(productId: string): string {
  if (productId.includes('monthly')) return 'pro_monthly';
  if (productId.includes('yearly')) return 'pro_yearly';
  if (productId.includes('lifetime')) return 'pro_lifetime';
  return 'free';
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
      // Update user's subscription status
      const subscriptionTier = getSubscriptionTier(activePurchase.product_id);
      
      await supabase
        .from('profiles')
        .update({
          subscription_tier: subscriptionTier,
          subscription_status: 'active',
          subscription_expires_at: activePurchase.expires_at,
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

export default router;