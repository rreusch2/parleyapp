
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

  try {
    const { data, error } = await supabase
      .from('profiles')
      .update({ notification_settings: settings })
      .eq('id', userId);

    if (error) throw error;

    res.status(200).json({ message: 'Settings updated successfully' });
  } catch (error) {
    console.error('Error updating notification settings:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

export default router;
