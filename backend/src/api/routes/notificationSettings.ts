
import { Router } from 'express';
import { supabase } from '../../config/supabaseClient';
import { authenticate } from '../../middleware/authenticate';

const router = Router();

// Get user's notification settings
router.get('/', authenticate, async (req, res) => {
  const { userId } = req;

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('notification_settings')
      .eq('id', userId)
      .single();

    if (error) throw error;

    res.json(data.notification_settings || {});
  } catch (error) {
    console.error('Error fetching notification settings:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// Update user's notification settings
router.put('/', authenticate, async (req, res) => {
  const { userId } = req;
  const { settings } = req.body;

  // Validate that settings object exists
  if (!settings || typeof settings !== 'object') {
    return res.status(400).json({ error: 'Invalid settings format' });
  }

  // Validate allowed notification types
  const allowedSettings = ['ai_picks', 'bet_results', 'weekly_summary', 'promotions'];
  const hasValidKeys = Object.keys(settings).every(key => allowedSettings.includes(key));
  
  if (!hasValidKeys) {
    return res.status(400).json({ error: 'Invalid notification setting keys' });
  }

  try {
    const { data, error } = await supabase
      .from('profiles')
      .update({ notification_settings: settings })
      .eq('id', userId)
      .select('notification_settings');

    if (error) {
      console.error('Supabase error:', error);
      throw error;
    }

    res.status(200).json({ 
      message: 'Settings updated successfully',
      settings: data?.[0]?.notification_settings 
    });
  } catch (error: any) {
    console.error('Error updating notification settings:', error);
    res.status(500).json({ 
      error: 'Failed to update settings',
      details: error.message 
    });
  }
});

export default router;
