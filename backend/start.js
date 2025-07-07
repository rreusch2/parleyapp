// Robust startup script with error handling
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// Log startup information
console.log('==== STARTUP DIAGNOSTICS ====');
console.log(`Current directory: ${process.cwd()}`);
console.log(`Files in current directory: ${fs.readdirSync('.').join(', ')}`);
console.log(`NODE_ENV: ${process.env.NODE_ENV}`);
console.log(`PORT: ${process.env.PORT || '(not set)'}`);
console.log('==== END DIAGNOSTICS ====');

// Create a basic health endpoint to respond to Railway's health check
const http = require('http');
const healthServer = http.createServer((req, res) => {
  if (req.url === '/api/health' || req.url === '/health') {
    console.log(`[${new Date().toISOString()}] Received health check request at ${req.url}`);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }));
  } else {
    res.writeHead(404);
    res.end();
  }
});

// Start the health server on port 3000 to handle Railway health checks
const HEALTH_PORT = process.env.PORT || 3000;
healthServer.listen(HEALTH_PORT, () => {
  console.log(`Health check server running on port ${HEALTH_PORT}`);
  
  // Now try to start the main application
  try {
    let serverPath = 'dist/server.js';
    if (!fs.existsSync(serverPath)) {
      console.log(`Server file not found at ${serverPath}, checking alternatives...`);
      if (fs.existsSync('server.js')) {
        serverPath = 'server.js';
      } else if (fs.existsSync('dist/index.js')) {
        serverPath = 'dist/index.js';
      } else {
        console.error('ERROR: Could not find server entry point');
      }
    }

    console.log(`Starting application from ${serverPath}`);
    const app = spawn('node', [serverPath], { stdio: 'inherit' });
    
    app.on('error', (err) => {
      console.error('Failed to start application:', err);
    });
    
    app.on('exit', (code) => {
      console.log(`Application exited with code ${code}`);
      if (code !== 0) {
        console.error('Application crashed, but health check server will keep running');
      }
    });
  } catch (error) {
    console.error('Error starting application:', error);
  }
});
