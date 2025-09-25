import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { RevenueCatWebhookHandler } from '../services/revenueCatWebhookHandler';
import { supabaseAdmin } from '../config/supabase';

const router = Router();

// RevenueCat Webhook Secret (set in environment)
const REVENUECAT_WEBHOOK_SECRET = process.env.REVENUECAT_WEBHOOK_SECRET;

/**
 * Verify RevenueCat webhook signature
 */
function verifyWebhookSignature(payload: string, signature: string): boolean {
  if (!REVENUECAT_WEBHOOK_SECRET) {
    console.warn('⚠️ REVENUECAT_WEBHOOK_SECRET not set - skipping signature verification');
    return true; // Allow in development
  }

  try {
    const expectedSignature = crypto
      .createHmac('sha256', REVENUECAT_WEBHOOK_SECRET)
      .update(payload)
      .digest('hex');
    
    const receivedSignature = signature.replace('sha256=', '');
    
    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature, 'hex'),
      Buffer.from(receivedSignature, 'hex')
    );
  } catch (error) {
    console.error('Error verifying webhook signature:', error);
    return false;
  }
}

/**
 * Store webhook event for audit/debugging
 */
async function storeWebhookEvent(event: any, status: 'processed' | 'error' | 'ignored', errorMessage?: string) {
  try {
    await supabaseAdmin
      .from('revenuecat_webhook_events')
      .insert({
        event_id: event.event?.id || 'unknown',
        event_type: event.event?.type || 'unknown',
        app_user_id: event.event?.app_user_id,
        product_id: event.event?.product_id,
        event_data: event,
        status,
        error_message: errorMessage,
        processed_at: new Date().toISOString()
      });
  } catch (error) {
    console.error('Failed to store webhook event:', error);
  }
}

/**
 * POST /api/revenuecat/webhook
 * Handle RevenueCat webhook events
 */
router.post('/webhook', async (req: Request, res: Response) => {
  try {
    const signature = req.headers['x-revenuecat-signature'] as string;
    const payload = JSON.stringify(req.body);
    
    // Verify webhook signature
    if (!verifyWebhookSignature(payload, signature)) {
      console.error('❌ Invalid webhook signature');
      return res.status(401).json({ error: 'Invalid signature' });
    }

    const event = req.body;
    console.log(`🔔 Received RevenueCat webhook: ${event.event?.type} for user ${event.event?.app_user_id}`);

    // Process the webhook event
    await RevenueCatWebhookHandler.handleWebhook(event);
    
    // Store successful processing
    await storeWebhookEvent(event, 'processed');
    
    res.status(200).json({ received: true });

  } catch (error) {
    console.error('❌ Error processing RevenueCat webhook:', error);
    
    // Store error
    await storeWebhookEvent(req.body, 'error', error.message);
    
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/revenuecat/webhook/test
 * Test endpoint to verify webhook is accessible
 */
router.get('/webhook/test', (req: Request, res: Response) => {
  res.json({ 
    status: 'RevenueCat webhook endpoint is active',
    timestamp: new Date().toISOString(),
    hasSecret: !!REVENUECAT_WEBHOOK_SECRET
  });
});

/**
 * POST /api/revenuecat/day-pass/grant
 * Manual endpoint to grant day pass access
 */
router.post('/day-pass/grant', async (req: Request, res: Response) => {
  try {
    const { userId, tier } = req.body;
    
    if (!userId || !tier) {
      return res.status(400).json({ error: 'Missing userId or tier' });
    }
    
    if (!['pro', 'elite'].includes(tier)) {
      return res.status(400).json({ error: 'Invalid tier. Must be pro or elite' });
    }

    // Grant day pass using webhook handler
    await RevenueCatWebhookHandler.grantDayPass(userId, tier);
    
    res.json({ 
      success: true,
      message: `${tier} day pass granted to user ${userId}`,
      expiresIn: '24 hours'
    });

  } catch (error) {
    console.error('Error granting day pass:', error);
    res.status(500).json({ error: 'Failed to grant day pass' });
  }
});

export default router;
