import { createClient } from '@supabase/supabase-js';

// Initialize Supabase admin client
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Handle subscription renewal
const handleSubscriptionRenewal = async (userId: string, productId: string, expiresDate: number): Promise<void> => {
  console.log('🔄 Handling subscription renewal for user:', userId);
  
  const newExpiryDate = new Date(expiresDate * 1000);
  
  // Map product ID to plan type
  const productToPlanMap: { [key: string]: string } = {
    'com.parleyapp.premium_weekly': 'weekly',
    'com.parleyapp.premium_monthly': 'monthly', 
    'com.parleyapp.premiumyearly': 'yearly',
    'com.parleyapp.premium_lifetime': 'lifetime'
  };
  
  const planType = productToPlanMap[productId] || null;
  
  const { error } = await supabaseAdmin
    .from('profiles')
    .update({
      subscription_tier: 'pro',
      subscription_status: 'active',
      subscription_expires_at: newExpiryDate.toISOString(),
      subscription_plan_type: planType,
      subscription_product_id: productId,
      subscription_renewed_at: new Date().toISOString(),
      // CRITICAL FIX: Clear welcome bonus when user upgrades to paid subscription
      welcome_bonus_claimed: false,
      welcome_bonus_expires_at: null,
      updated_at: new Date().toISOString()
    })
    .eq('id', userId);
    
  if (error) {
    console.error('❌ Failed to update renewal:', error);
    throw error;
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
      auto_renew_enabled: false,
      updated_at: new Date().toISOString()
    })
    .eq('id', userId);
    
  if (error) {
    console.error('❌ Failed to update cancellation:', error);
    throw error;
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
      subscription_plan_type: null,
      subscription_product_id: null,
      auto_renew_enabled: null,
      updated_at: new Date().toISOString()
    })
    .eq('id', userId);
    
  if (error) {
    console.error('❌ Failed to handle expiration:', error);
    throw error;
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
    throw error;
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
      subscription_plan_type: null,
      subscription_product_id: null,
      auto_renew_enabled: null,
      updated_at: new Date().toISOString()
    })
    .eq('id', userId);
    
  if (error) {
    console.error('❌ Failed to handle refund:', error);
    throw error;
  } else {
    console.log('✅ User refunded and downgraded to free tier');
  }
};

// Process a single Apple notification
async function processAppleNotification(webhookEvent: any) {
  try {
    const signedPayload = webhookEvent.notification_data.signedPayload;
    console.log(`🔄 Processing webhook event ${webhookEvent.id}...`);
    
    // Decode the JWT payload (basic implementation)
    const parts = signedPayload.split('.');
    if (parts.length !== 3) {
      console.error('❌ Invalid JWT format for webhook:', webhookEvent.id);
      return false;
    }
    
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
    const notificationType = payload.notificationType;
    const subtype = payload.subtype;
    const data = payload.data;
    
    if (!data || !data.appAppleId) {
      console.log('ℹ️ No app data in notification, marking as processed');
      return true; // Mark as processed since it's not actionable
    }
    
    // Extract transaction info
    const transactionInfo = data.signedTransactionInfo;
    
    if (!transactionInfo) {
      console.log('ℹ️ No transaction info in notification');
      return true; // Mark as processed since it's not actionable
    }
    
    // Decode transaction info
    const transactionParts = transactionInfo.split('.');
    if (transactionParts.length !== 3) {
      console.error('❌ Invalid transaction JWT format');
      return false;
    }
    
    const transaction = JSON.parse(Buffer.from(transactionParts[1], 'base64').toString());
    console.log('💳 Transaction details:', {
      originalTransactionId: transaction.originalTransactionId,
      productId: transaction.productId,
      purchaseDate: transaction.purchaseDate,
      expiresDate: transaction.expiresDate,
      transactionId: transaction.transactionId
    });
    
    // For sandbox/test events, we might not have real users
    // Try to find user by RevenueCat customer ID or create a test scenario
    let userId = null;
    
    // Try to find user by RevenueCat customer ID
    if (transaction.appAccountToken) {
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('revenuecat_customer_id', transaction.appAccountToken)
        .single();
      
      if (profile) {
        userId = profile.id;
        console.log('✅ Found user by app account token:', userId);
      }
    }
    
    // If not found, try to find by apple receipt data
    if (!userId && transaction.originalTransactionId) {
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .ilike('apple_receipt_data', `%${transaction.originalTransactionId}%`)
        .single();
      
      if (profile) {
        userId = profile.id;
        console.log('✅ Found user by original transaction ID:', userId);
      }
    }
    
    if (!userId) {
      console.log('⚠️ Could not find user for transaction (likely sandbox/test data)');
      // For sandbox events, we'll mark as processed since they're test data
      return true;
    }
    
    // Process based on notification type
    console.log(`🔔 Processing ${notificationType} for user ${userId}`);
    
    switch (notificationType) {
      case 'SUBSCRIBED':
      case 'DID_RENEW':
        await handleSubscriptionRenewal(userId, transaction.productId, transaction.expiresDate / 1000);
        break;
        
      case 'DID_CHANGE_RENEWAL_STATUS':
        if (subtype === 'AUTO_RENEW_DISABLED') {
          await handleSubscriptionCancellation(userId, transaction.productId, transaction.expiresDate / 1000);
        }
        break;
        
      case 'EXPIRED':
        await handleSubscriptionExpiration(userId, transaction.productId);
        break;
        
      case 'DID_FAIL_TO_RENEW':
        await handlePaymentFailure(userId, transaction.productId);
        break;
        
      case 'REFUND':
        await handleRefund(userId, transaction.productId);
        break;
        
      default:
        console.log(`ℹ️ Unhandled notification type: ${notificationType}`);
    }
    
    return true;
    
  } catch (error) {
    console.error('❌ Error processing Apple notification:', error);
    return false;
  }
}

// Main processing function
async function processExistingWebhooks() {
  try {
    console.log('🚀 Starting processing of existing webhook events...');
    
    // Get all unprocessed webhook events
    const { data: webhookEvents, error } = await supabaseAdmin
      .from('webhook_events')
      .select('*')
      .eq('processed', false)
      .eq('source', 'apple')
      .order('created_at', { ascending: true });
    
    if (error) {
      console.error('❌ Failed to fetch webhook events:', error);
      return;
    }
    
    if (!webhookEvents || webhookEvents.length === 0) {
      console.log('✅ No unprocessed webhook events found');
      return;
    }
    
    console.log(`📊 Found ${webhookEvents.length} unprocessed webhook events`);
    
    let processedCount = 0;
    let errorCount = 0;
    
    for (const webhookEvent of webhookEvents) {
      try {
        const success = await processAppleNotification(webhookEvent);
        
        // Update webhook status
        const { error: updateError } = await supabaseAdmin
          .from('webhook_events')
          .update({
            processed: success,
            processed_at: success ? new Date().toISOString() : null,
            error_message: success ? null : 'Processing failed',
            subscription_event_type: success ? 'processed_batch' : null
          })
          .eq('id', webhookEvent.id);
        
        if (updateError) {
          console.error(`❌ Failed to update webhook ${webhookEvent.id}:`, updateError);
          errorCount++;
        } else if (success) {
          processedCount++;
          console.log(`✅ Processed webhook ${webhookEvent.id}`);
        } else {
          errorCount++;
          console.log(`❌ Failed to process webhook ${webhookEvent.id}`);
        }
        
      } catch (error) {
        console.error(`❌ Error processing webhook ${webhookEvent.id}:`, error);
        errorCount++;
        
        // Mark as failed
        await supabaseAdmin
          .from('webhook_events')
          .update({
            processed: false,
            error_message: error.message,
            retry_count: 1
          })
          .eq('id', webhookEvent.id);
      }
    }
    
    console.log('🎉 Webhook processing complete!');
    console.log(`📊 Results: ${processedCount} processed, ${errorCount} errors`);
    
  } catch (error) {
    console.error('❌ Fatal error in webhook processing:', error);
  }
}

// Run the script
if (require.main === module) {
  processExistingWebhooks()
    .then(() => {
      console.log('✅ Script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Script failed:', error);
      process.exit(1);
    });
}

export { processExistingWebhooks };
