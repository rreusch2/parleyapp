
import { Router } from 'express';
import { sendNewPicksNotification } from '../../services/notifications/expo';

const router = Router();

router.post('/notify-picks-ready', async (req, res) => {
  try {
    await sendNewPicksNotification();
    res.status(200).json({ message: 'Notifications sent successfully' });
  } catch (error) {
    console.error('Failed to send notifications:', error);
    res.status(500).json({ error: 'Failed to send notifications' });
  }
});



export default router;
