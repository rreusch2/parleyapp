import app from './app';
// import { initGameStartScheduler } from './services/notifications/scheduler'; // [REMOVED] Game start notifications
import { initScheduler } from './services/sportsData/scheduler';
import { subscriptionChecker } from './services/subscriptionChecker';

const PORT = process.env.PORT || 3000;

// [REMOVED] Game start notification scheduler removed as per user request

// Initialize sports data scheduler (for game status updates)
initScheduler();

// Initialize subscription checker (for expired subscriptions)
subscriptionChecker.start();

// Start the server
app.listen(PORT, async () => {
  console.log(`⚡ Server listening on port ${PORT}`);
  // Remove the initializeDailyGames() call
}); 