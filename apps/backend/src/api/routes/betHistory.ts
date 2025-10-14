import { Router } from 'express';
import { 
  getUserBets, 
  createBet, 
  updateBetResult, 
  getBetById 
} from '../controllers/betHistory';
import { authenticateUser } from '../middleware/auth';
import { validateBet } from '../middleware/validation';

const router = Router();

// Apply authentication middleware to all bet history routes
router.use(authenticateUser);

// Get all user bets with optional filters
router.get('/', getUserBets);

// Get a specific bet by ID
router.get('/:id', getBetById);

// Create a new bet
router.post('/', validateBet, createBet);

// Update bet result
router.patch('/:id/result', updateBetResult);

export default router; 