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

// Health check endpoints
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'parleyapp-backend', timestamp: new Date().toISOString() });
});

app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'parleyapp-backend', timestamp: new Date().toISOString() });
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