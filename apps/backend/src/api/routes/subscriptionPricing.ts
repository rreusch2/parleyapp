import express from 'express';
import { supabaseAdmin } from '../../services/supabaseClient';

const router = express.Router();

/**
 * @route GET /api/subscription-pricing
 * @desc Get all subscription pricing from database
 * @access Public
 */
router.get('/', async (req, res) => {
  try {
    const { data: pricing, error } = await supabaseAdmin
      .from('subscription_pricing')
      .select('*')
      .eq('show_in_modals', true)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Error fetching subscription pricing:', error);
      return res.status(500).json({ 
        error: 'Failed to fetch subscription pricing',
        details: error.message 
      });
    }

    // Transform to frontend-friendly format
    const pricingMap = {};
    (pricing || []).forEach((item: any) => {
      pricingMap[item.plan_key] = {
        price: parseFloat(item.display_price),
        currency: item.currency_code || 'USD',
        periodLabel: item.period_label,
        disclosure: item.apple_disclosure,
        autoRenew: item.auto_renew
      };
    });

    console.log('✅ Subscription pricing served:', Object.keys(pricingMap).length, 'plans');
    
    res.json({
      success: true,
      pricing: pricingMap,
      lastUpdated: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('❌ Subscription pricing API error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});

/**
 * @route POST /api/subscription-pricing/refresh-cache
 * @desc Force refresh subscription pricing cache
 * @access Public
 */
router.post('/refresh-cache', async (req, res) => {
  try {
    console.log('🔄 Forcing subscription pricing cache refresh...');
    
    // Update the pricing record to trigger any cache invalidation
    const { data, error } = await supabaseAdmin
      .from('subscription_pricing')
      .update({ updated_at: new Date().toISOString() })
      .eq('plan_key', 'pro_monthly')
      .select();

    if (error) {
      console.error('❌ Error refreshing pricing cache:', error);
      return res.status(500).json({ error: 'Failed to refresh cache' });
    }

    console.log('✅ Subscription pricing cache refreshed for pro_monthly');
    
    res.json({
      success: true,
      message: 'Pricing cache refreshed successfully',
      updated: data?.length || 0,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('❌ Cache refresh error:', error);
    res.status(500).json({ 
      error: 'Failed to refresh cache',
      message: error.message 
    });
  }
});

export default router;
