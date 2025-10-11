import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { logger } from '../utils/logger';
// import sportRadarRoutes from './routes/sportradar'; // TODO: Create this route if needed
import aiRoutes from './routes/ai';
import userRoutes from './routes/user';
import sportsBettingStatusRoutes from './routes/sportsBettingStatus';
import { validationRoutes } from './routes/validation';
import playerPropsRoutes from './routes/playerProps';
import parlayRoutes from './routes/parlays';
import overUnderRoutes from './routes/overUnder';
import sportsEventsRoutes from './routes/sportsEvents';
import sportsDataRoutes from './routes/sportsData';
import sportsDataAdminRoutes from './routes/sportsDataAdmin';
import injuriesRoutes from './routes/injuries';
import trendsRoutes from './routes/trends';
import insightsRoutes from './routes/insights';
import adminRoutes from './routes/admin';
import adsRoutes from './routes/ads';
import soraVideosRoutes from './routes/soraVideos';

// Initialize express app
const app = express();

// CORS configuration
const corsOptions = {
  origin: [
    'http://localhost:19006',
    'exp://localhost:19000',
    'http://localhost:19000',
    'http://localhost:8081',
    'http://localhost:8082',
    'http://192.168.1.58:8081',
    'http://192.168.1.58:8082',
    'exp://192.168.1.58:8081',
    'exp://192.168.1.58:8082',
    'exp://192.168.1.58:19000',
    'exp://192.168.1.58:19006',
    'http://192.168.1.99:8081',
    'http://192.168.1.99:8082', 
    'exp://192.168.1.99:8081',
    'exp://192.168.1.99:8082',
    'exp://192.168.1.99:19000',
    'exp://192.168.1.99:19006',
    // Allow all expo go clients in development
    /^exp:\/\/192\.168\.1\.58:\d+$/,
    /^http:\/\/192\.168\.1\.58:\d+$/,
    /^exp:\/\/192\.168\.1\.99:\d+$/,
    /^http:\/\/192\.168\.1\.99:\d+$/
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  optionsSuccessStatus: 200
};

// Middleware
app.use(helmet()); // Security headers
app.use(cors(corsOptions)); // Enable CORS with proper configuration
app.use(express.json()); // Parse JSON bodies
app.use(morgan('dev')); // HTTP request logging

// Routes
// app.use('/api/sportradar', sportRadarRoutes); // TODO: Enable when route exists
app.use('/api/ai', aiRoutes);
app.use('/api/user', userRoutes);
app.use('/api/sports-betting', sportsBettingStatusRoutes);
app.use('/api/validation', validationRoutes);
app.use('/api/player-props', playerPropsRoutes);
app.use('/api/parlays', parlayRoutes);
app.use('/api/over-under', overUnderRoutes);
app.use('/api/sports-events', sportsEventsRoutes);
app.use('/api/sports-data', sportsDataRoutes);
app.use('/api/sports-data-admin', sportsDataAdminRoutes);
app.use('/api/injuries', injuriesRoutes);
app.use('/api/trends', trendsRoutes);
app.use('/api/insights', insightsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/ads', adsRoutes);
app.use('/api/sora', soraVideosRoutes);

// Fetch tomorrow's games endpoint
app.post('/api/fetch-tomorrow-games', async (req, res) => {
  try {
    console.log('🚀 Manual fetch tomorrow games triggered from API endpoint');
    
    // Import the fetch tomorrow games function
    const { fetchTomorrowGames } = await import('../scripts/fetchTomorrowGames');
    
    // Execute the fetch
    await fetchTomorrowGames();
    
    res.json({
      success: true,
      message: 'Successfully fetched tomorrow\'s games',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error fetching tomorrow\'s games:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch tomorrow\'s games',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

// Debug date endpoint
app.get('/api/debug-date', async (req, res) => {
  try {
    const now = new Date();
    const today = new Date();
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    // Format date for ESPN API
    const formatDateForESPN = (date: Date): string => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}${month}${day}`;
    };
    
    const todayFormatted = formatDateForESPN(today);
    const tomorrowFormatted = formatDateForESPN(tomorrow);
    
    // Test ESPN API call for today
    const testUrl = `http://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard?dates=${todayFormatted}`;
    
    let testResponse = null;
    try {
      const fetch = require('node-fetch');
      const response = await fetch(testUrl);
      const data = await response.json();
      testResponse = {
        success: true,
        gamesFound: data.events?.length || 0,
        url: testUrl
      };
    } catch (error) {
      testResponse = {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        url: testUrl
      };
    }
    
    res.json({
      systemDate: {
        now: now.toISOString(),
        today: today.toDateString(),
        tomorrow: tomorrow.toDateString(),
        todayFormatted,
        tomorrowFormatted
      },
      testApi: testResponse
    });
  } catch (error) {
    console.error('❌ Error in debug date endpoint:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to debug date',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

// Health check endpoints
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'Predictive Play-backend', timestamp: new Date().toISOString() });
});

app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'Predictive Play-backend', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error(`Error: ${err.message}`);
  res.status(err.status || 500).json({
    error: {
      message: err.message || 'Internal server error',
    },
  });
});

export default app; 