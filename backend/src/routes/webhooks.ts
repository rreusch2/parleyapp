import express from 'express';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const router = express.Router();

// Initialize Supabase admin client
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Apple App Store Server Notifications V2
router.post('/apple', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    console.log('🍎 Received Apple webhook notification');
    
    // TODO: Verify JWT signature for production
    // For now, we'll process the notification payload
    const signedPayload = req.body.toString();
    
    // Store webhook event
    const { error: webhookError } = await supabaseAdmin
      .from('webhook_events')
      .insert({
        source: 'apple',
        event_type: 'server_notification',
        notification_data: { signedPayload },
        processed: false,
      });

    if (webhookError) {
      console.error('❌ Failed to store Apple webhook:', webhookError);
      return res.status(500).json({ error: 'Failed to store webhook' });
    }

    // Process the notification asynchronously
    processAppleNotification(signedPayload).catch(error => {
      console.error('❌ Error processing Apple notification:', error);
    });

    res.status(200).json({ status: 'received' });
  } catch (error) {
    console.error('❌ Apple webhook error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Google Play Real-time Developer Notifications
router.post('/google', express.json(), async (req, res) => {
  try {
    console.log('🤖 Received Google Play webhook notification');
    
    const { message } = req.body;
    if (!message?.data) {
      return res.status(400).json({ error: 'Invalid payload' });
    }

    // Decode base64 data
    const notificationData = JSON.parse(Buffer.from(message.data, 'base64').toString());
    
    // Store webhook event
    const { error: webhookError } = await supabaseAdmin
      .from('webhook_events')
      .insert({
        source: 'google',
        event_type: notificationData.notificationType || 'unknown',
        notification_data: notificationData,
        processed: false,
      });

    if (webhookError) {
      console.error('❌ Failed to store Google webhook:', webhookError);
      return res.status(500).json({ error: 'Failed to store webhook' });
    }

    // Process the notification asynchronously
    processGoogleNotification(notificationData).catch(error => {
      console.error('❌ Error processing Google notification:', error);
    });

    res.status(200).json({ status: 'received' });
  } catch (error) {
    console.error('❌ Google webhook error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Process Apple notification
async function processAppleNotification(signedPayload: string) {
  try {
    // In production, you would:
    // 1. Verify the JWT signature using Apple's public key
    // 2. Decode the JWT payload
    // 3. Process the notification based on notificationType
    
    console.log('🔄 Processing Apple notification...');
    
    // For now, just log that we received it
    // TODO: Implement proper JWT verification and processing
    console.log('✅ Apple notification processed (stub)');
    
  } catch (error) {
    console.error('❌ Error processing Apple notification:', error);
    throw error;
  }
};

// Handle subscription renewal
const handleSubscriptionRenewal = async (userId: string, productId: string, expiresDate: number): Promise<void> => {
  console.log('🔄 Handling subscription renewal for user:', userId);
  
  const newExpiryDate = new Date(expiresDate * 1000);
  
  const { error } = await supabaseAdmin
    .from('profiles')
    .update({
      subscription_status: 'active',
      subscription_expires_at: newExpiryDate.toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', userId);
    
  if (error) {
    console.error('❌ Failed to update renewal:', error);
  } else {
    console.log('✅ Subscription renewed until:', newExpiryDate.toISOString());
  }
};

// Handle subscription cancellation
const handleSubscriptionCancellation = async (userId: string, productId: string, expiresDate?: number): Promise<void> => {
  console.log('🚫 Handling subscription cancellation for user:', userId);
  
  // User cancelled but subscription remains active until expiration
  const { error } = await supabaseAdmin
    .from('profiles')
    .update({
      subscription_status: 'cancelled', // Still active but won't renew
      updated_at: new Date().toISOString()
    })
    .eq('id', userId);
    
  if (error) {
    console.error('❌ Failed to update cancellation:', error);
  } else {
    console.log('✅ Subscription marked as cancelled (active until expiry)');
  }
};

// Handle subscription expiration
const handleSubscriptionExpiration = async (userId: string, productId: string): Promise<void> => {
  console.log('⏰ Handling subscription expiration for user:', userId);
  
  // Downgrade user to free tier
  const { error } = await supabaseAdmin
    .from('profiles')
    .update({
      subscription_tier: 'free',
      subscription_status: 'expired',
      subscription_expires_at: null,
      updated_at: new Date().toISOString()
    })
    .eq('id', userId);
    
  if (error) {
    console.error('❌ Failed to handle expiration:', error);
  } else {
    console.log('✅ User downgraded to free tier');
  }
};

// Handle payment failure
const handlePaymentFailure = async (userId: string, productId: string): Promise<void> => {
  console.log('💳 Handling payment failure for user:', userId);
  
  // Mark subscription as past due but don't immediately downgrade
  const { error } = await supabaseAdmin
    .from('profiles')
    .update({
      subscription_status: 'past_due',
      updated_at: new Date().toISOString()
    })
    .eq('id', userId);
    
  if (error) {
    console.error('❌ Failed to handle payment failure:', error);
  } else {
    console.log('✅ Subscription marked as past due');
  }
};

// Handle refund
const handleRefund = async (userId: string, productId: string): Promise<void> => {
  console.log('💰 Handling refund for user:', userId);
  
  // Immediately downgrade user to free tier
  const { error } = await supabaseAdmin
    .from('profiles')
    .update({
      subscription_tier: 'free',
      subscription_status: 'refunded',
      subscription_expires_at: null,
      updated_at: new Date().toISOString()
    })
    .eq('id', userId);
    
  if (error) {
    console.error('❌ Failed to handle refund:', error);
  } else {
    console.log('✅ User refunded and downgraded to free tier');
  }
};

// Process Google Play notification
async function processGoogleNotification(notificationData: any) {
  try {
    console.log('🔄 Processing Google notification:', notificationData.notificationType);
    
    const { subscriptionNotification, testNotification } = notificationData;
    
    if (testNotification) {
      console.log('✅ Google test notification received');
      return;
    }
    
    if (subscriptionNotification) {
      const { subscriptionId, purchaseToken, notificationType } = subscriptionNotification;
      
      // Find the user purchase record
      const { data: purchase, error: purchaseError } = await supabaseAdmin
        .from('user_purchases')
        .select('user_id, product_id')
        .eq('purchase_token', purchaseToken)
        .single();
        
      if (purchaseError || !purchase) {
        console.warn('⚠️ Purchase not found for token:', purchaseToken);
        return;
      }
      
      // Update subscription status based on notification type
      let newStatus = 'active';
      switch (notificationType) {
        case 1: // SUBSCRIPTION_RECOVERED
        case 2: // SUBSCRIPTION_RENEWED
          newStatus = 'active';
          break;
        case 3: // SUBSCRIPTION_CANCELED
        case 13: // SUBSCRIPTION_EXPIRED
          newStatus = 'cancelled';
          break;
        case 4: // SUBSCRIPTION_PURCHASED
          newStatus = 'active';
          break;
        case 12: // SUBSCRIPTION_REVOKED
          newStatus = 'refunded';
          break;
        default:
          console.warn('⚠️ Unknown notification type:', notificationType);
          return;
      }
      
      // Update purchase status
      await supabaseAdmin
        .from('user_purchases')
        .update({ 
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('purchase_token', purchaseToken);
      
      // Update user profile subscription status
      await supabaseAdmin
        .from('profiles')
        .update({
          subscription_status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', purchase.user_id);
        
      console.log(`✅ Updated subscription ${subscriptionId} to ${newStatus}`);
    }
    
  } catch (error) {
    console.error('❌ Error processing Google notification:', error);
    throw error;
  }
}

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    timestamp: new Date().toISOString(),
    webhooks: ['apple', 'google']
  });
});

export default router;
