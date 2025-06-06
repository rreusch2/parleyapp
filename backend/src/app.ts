import express from 'express';
import cors from 'cors';
import userPreferencesRouter from './api/routes/userPreferences';
import predictionsRouter from './api/routes/predictions';
import sportsEventsRouter from './api/routes/sportsEvents';
import betHistoryRouter from './api/routes/betHistory';
import sportsDataAdminRouter from './api/routes/sportsDataAdmin';
import sportsDataRouter from './api/routes/sportsData';
import { initScheduler } from './services/sportsData/scheduler';

const app = express();

// CORS configuration
const corsOptions = {
  origin: [
    'http://localhost:19006',
    'exp://localhost:19000',
    'http://localhost:19000',
    'http://192.168.1.58:8081',
    'http://192.168.1.58:8082',
    'exp://192.168.1.58:8081',
    'exp://192.168.1.58:8082',
    'exp://192.168.1.58:19000',
    'exp://192.168.1.58:19006',
    // Allow all expo go clients in development
    /^exp:\/\/192\.168\.1\.58:\d+$/,
    /^http:\/\/192\.168\.1\.58:\d+$/
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.use(express.json());

// API Routes
app.use('/api/user-preferences', userPreferencesRouter);
app.use('/api/predictions', predictionsRouter);
app.use('/api/sports-events', sportsEventsRouter);
app.use('/api/bets', betHistoryRouter);
app.use('/api/sports-data-admin', sportsDataAdminRouter);
app.use('/api/sports-data', sportsDataRouter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Test auth endpoint - Returns the auth token for testing
app.get('/api/auth-test', (req, res) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    return res.status(200).json({ 
      message: 'No auth header provided. For testing, add Authorization header with Bearer token', 
      authPresent: false 
    });
  }
  
  const token = authHeader.split(' ')[1];
  return res.status(200).json({ 
    message: 'Auth header detected', 
    authPresent: true,
    tokenFirstChars: token.substring(0, 10) + '...' // Show just the beginning for verification
  });
});

// Initialize sports data scheduler
initScheduler();

export default app; 