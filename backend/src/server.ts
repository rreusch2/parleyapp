import app from './app';
// import { initGameStartScheduler } from './services/notifications/scheduler'; // [REMOVED] Game start notifications
import { initScheduler } from './services/sportsData/scheduler';

const PORT = process.env.PORT || 3000;

// [REMOVED] Game start notification scheduler removed as per user request

// Initialize sports data scheduler (for game status updates)
initScheduler();

// Start the server
app.listen(PORT, async () => {
  console.log(`⚡ Server listening on port ${PORT}`);
  // Remove the initializeDailyGames() call
}); 