import express from 'express';
import cors from 'cors';
import userPreferencesRouter from './api/routes/userPreferences';
import userRouter from './api/routes/user';
import predictionsRouter from './api/routes/predictions';
import sportsEventsRouter from './api/routes/sportsEvents';
import betHistoryRouter from './api/routes/betHistory';
import sportsDataAdminRouter from './api/routes/sportsDataAdmin';
import sportsDataRouter from './api/routes/sportsData';
import aiRouter from './api/routes/ai';
import newsRouter from './api/routes/news';
import trendsRouter from './api/routes/trends';
import insightsRouter from './api/routes/insights';
import adminRouter from './api/routes/admin';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { logger } from './utils/logger';
import automationRoutes from './routes/automation';
import purchasesRouter from './routes/purchases';
import webhooksRouter from './routes/webhooks';
// import { initScheduler } from './services/sportsData/scheduler'; // Removed - using TheOdds API manually

const app = express();

// Trust proxy for Railway deployment
app.set('trust proxy', 1);

// CORS configuration
const corsOptions = {
  origin: function(origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) {
      return callback(null, true);
    }
    
    // In production, allow any origin since mobile apps don't send origin headers
    if (process.env.NODE_ENV === 'production') {
      return callback(null, true);
    }
    
    // In development, allow specific origins
    const allowedOrigins = [
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
    ];
    
    // Allow all expo go clients in development
    if (origin.match(/^exp:\/\/192\.168\.1\.\d+:\d+$/) || 
        origin.match(/^http:\/\/192\.168\.1\.\d+:\d+$/)) {
      return callback(null, true);
    }
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cache-Control'],
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.use(express.json());

// Security middleware
app.use(helmet());

// Rate limiting - More generous for development
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 200 : 1000, // More generous in dev
  message: 'Too many requests from this IP'
});
app.use(limiter);

// Stricter rate limiting for automation endpoints
const automationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // Limit to 10 automation requests per hour
  message: 'Too many automation requests'
});

// API Routes
app.use('/api/user-preferences', userPreferencesRouter);
app.use('/api/user', userRouter);
app.use('/api/predictions', predictionsRouter);
app.use('/api/sports-events', sportsEventsRouter);
app.use('/api/bets', betHistoryRouter);
app.use('/api/sports-data-admin', sportsDataAdminRouter);
app.use('/api/sports-data', sportsDataRouter);
app.use('/api/ai', aiRouter);
app.use('/api/news', newsRouter);
app.use('/api/trends', trendsRouter);
app.use('/api/insights', insightsRouter);
app.use('/api/admin', adminRouter);
app.use('/api/purchases', purchasesRouter);
app.use('/api/webhooks', webhooksRouter);
app.use('/api/automation', automationLimiter, automationRoutes);

// Health check endpoints
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Additional health check endpoint at /api/health for Docker healthcheck
app.get('/api/health', (req, res) => {
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
// initScheduler(); // Removed - using TheOdds API manually now

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

export default app; 