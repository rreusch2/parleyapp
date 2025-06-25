import express from 'express';
import apiRoutes from './api';
// import paymentRoutes from './payments'; // Disabled - not using Stripe
import predictionRoutes from './predictionRoutes';

const router = express.Router();

// Mount all routes
router.use('/api', apiRoutes);
// router.use('/payments', paymentRoutes); // Disabled - not using Stripe
router.use('/predictions', predictionRoutes);

// Health check route
router.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

export default router; 