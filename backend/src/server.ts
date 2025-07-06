import app from './app';
import { initGameStartScheduler } from './services/notifications/scheduler';
import { initScheduler } from './services/sportsData/scheduler';

const PORT = process.env.PORT || 3001;

// Initialize notification scheduler
initGameStartScheduler();

// Initialize sports data scheduler (for game status updates)
initScheduler();

// Start the server
app.listen(PORT, async () => {
  console.log(`⚡ Server listening on port ${PORT}`);
  // Remove the initializeDailyGames() call
}); 