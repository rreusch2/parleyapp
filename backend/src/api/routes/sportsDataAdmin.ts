import { Router } from 'express';
import { 
  triggerSportsDataUpdate, 
  getLeaguesAdmin,
  updateGameStatuses
} from '../controllers/sportsDataAdmin';
import { authenticateUser } from '../middleware/auth';

const router = Router();

// Apply authentication middleware to all admin routes
router.use(authenticateUser);

// Trigger a sports data update
router.post('/update', triggerSportsDataUpdate);

// Get leagues (admin)
router.get('/leagues', getLeaguesAdmin);

// Update game statuses
router.post('/update-statuses', updateGameStatuses);

export default router; 