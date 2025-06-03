import { Router } from 'express';
import { 
  getSportsEvents, 
  getSportsEventById, 
  searchSportsEvents 
} from '../controllers/sportsEvents';
import { authenticateUser } from '../middleware/auth';

const router = Router();

// Apply authentication middleware to all sports events routes
router.use(authenticateUser);

// Get all sports events with optional filters
router.get('/', getSportsEvents);

// Search sports events
router.get('/search', searchSportsEvents);

// Get a specific sports event by ID
router.get('/:id', getSportsEventById);

export default router; 