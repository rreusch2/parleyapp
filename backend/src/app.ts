import express from 'express';
import cors from 'cors';
import userPreferencesRouter from './api/routes/userPreferences';
import predictionsRouter from './api/routes/predictions';

const app = express();

// CORS configuration
const corsOptions = {
  origin: ['http://localhost:19006', 'exp://localhost:19000', 'http://localhost:19000'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
};

app.use(cors(corsOptions));
app.use(express.json());

// API Routes
app.use('/api/user-preferences', userPreferencesRouter);
app.use('/api/predictions', predictionsRouter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

export default app; 