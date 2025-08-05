const express = require('express');
const cors = require('cors');
const { PythonShell } = require('python-shell');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Create Express app
const app = express();
const PORT = process.env.PORT || 5001;

// Copy the StatMuse API server script
const statmuseScriptPath = path.join(__dirname, 'statmuse_api_server.py');
fs.writeFileSync(
  statmuseScriptPath, 
  fs.readFileSync(path.join(__dirname, '../statmuse_api_server.py'))
);

// Enable CORS for all routes
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'StatMuse API Service',
    timestamp: new Date().toISOString()
  });
});

// Start the Python StatMuse API server in a separate process
console.log('🚀 Starting StatMuse API server...');

const pyshell = new PythonShell('statmuse_api_server.py', {
  mode: 'text',
  pythonOptions: ['-u']  // Unbuffered output
});

// Forward requests to the Python server
app.use((req, res) => {
  // Simple proxy to forward requests to the Python server running on port 5001
  const fetch = require('node-fetch');
  
  // Extract URL and method from incoming request
  const url = `http://localhost:5001${req.originalUrl}`;
  const method = req.method;
  const headers = {
    'Content-Type': 'application/json'
  };
  
  // Forward the request to the Python server
  fetch(url, {
    method,
    headers,
    body: method === 'GET' ? undefined : JSON.stringify(req.body)
  })
  .then(response => response.json())
  .then(data => res.json(data))
  .catch(error => {
    console.error('Error forwarding request to StatMuse API server:', error);
    res.status(500).json({
      error: 'Failed to communicate with StatMuse API server',
      details: error.message
    });
  });
});

// Handle output from the Python script
pyshell.on('message', message => {
  console.log(`StatMuse: ${message}`);
});

// Handle errors
pyshell.on('error', error => {
  console.error('StatMuse API server error:', error);
});

// Listen for the server to be ready
let serverStarted = false;
pyshell.on('message', message => {
  if (message.includes('Starting StatMuse API Server') && !serverStarted) {
    serverStarted = true;
    console.log('✅ StatMuse API server running');
    
    // Start Express server
    app.listen(PORT, () => {
      console.log(`🚀 Express proxy server listening on port ${PORT}`);
    });
  }
});

// Handle process termination
process.on('SIGINT', () => {
  console.log('Shutting down StatMuse API server...');
  pyshell.end((err) => {
    if (err) console.error('Error shutting down StatMuse API server:', err);
    process.exit(0);
  });
});