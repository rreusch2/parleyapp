import app from './app';

const PORT = process.env.PORT || 3001;

// Start the server
app.listen(PORT, async () => {
  console.log(`⚡ Server listening on port ${PORT}`);
  // Remove the initializeDailyGames() call
}); 