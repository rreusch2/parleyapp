const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ 
    message: 'Predictive Play Backend API',
    status: 'running',
    timestamp: new Date().toISOString()
  });
});

// Import and use trend routes
const trendsRoutes = require('./routes/trendsRoutes');
app.use('/api/trends', trendsRoutes);

// Existing routes (if any)
// Import your existing route files here
// Example:
// const playersRoutes = require('./routes/playersRoutes');
// app.use('/api/players', playersRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    message: `The requested endpoint ${req.method} ${req.originalUrl} does not exist`
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Trends API available at http://localhost:${PORT}/api/trends`);
  console.log(`🏥 Health check: http://localhost:${PORT}`);
});
