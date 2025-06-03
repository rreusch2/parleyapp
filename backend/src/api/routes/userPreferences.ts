import { Router } from 'express';
import { authenticateUser } from '../middleware/auth';
import { validatePreferences } from '../middleware/validation';
import {
  getUserPreferences,
  createUserPreferences,
  updateUserPreferences
} from '../controllers/preferences';

const router = Router();

// Apply authentication middleware to all user preferences routes
router.use(authenticateUser);

// Get user preferences
router.get('/', getUserPreferences);

// Create user preferences
router.post('/', validatePreferences, createUserPreferences);

// Update user preferences
router.put('/', validatePreferences, updateUserPreferences);

export default router; 