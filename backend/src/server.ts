import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
// import { startTemporaryUpgradeCleanup } from './jobs/temporaryUpgradeCleanup';
import app from './app';
// import { initGameStartScheduler } from './services/notifications/scheduler'; // [REMOVED] Game start notifications
import { initScheduler } from './services/sportsData/scheduler';
// import { subscriptionChecker } from './services/subscriptionChecker';

const PORT = process.env.PORT || 3000;

// [REMOVED] Game start notification scheduler removed as per user request

// Initialize sports data scheduler (for game status updates)
initScheduler();

// Disabled: subscription checker may mutate profiles.subscription_tier outside RevenueCat webhook
// subscriptionChecker.start();

// Disabled: temporary upgrade cleanup job may mutate profiles.subscription_tier
// startTemporaryUpgradeCleanup();

// Start the server
app.listen(PORT, async () => {
  console.log(`⚡ Server listening on port ${PORT}`);
  // Remove the initializeDailyGames() call
}); 