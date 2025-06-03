import { Router } from 'express';
import { 
  getPredictions, 
  getPredictionById, 
  generatePrediction, 
  updatePredictionStatus 
} from '../controllers/predictions';
import { authenticateUser } from '../middleware/auth';

const router = Router();

// Apply authentication middleware to all prediction routes
router.use(authenticateUser);

// Get all predictions with optional filters
router.get('/', getPredictions);

// Get a specific prediction by ID
router.get('/:id', getPredictionById);

// Generate a new prediction
router.post('/', generatePrediction);

// Update prediction status (e.g., mark as won/lost)
router.patch('/:id/status', updatePredictionStatus);

export default router; 