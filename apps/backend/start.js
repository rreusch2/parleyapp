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

// Find the correct entry point
let serverPath = 'dist/index.js';
if (!fs.existsSync(serverPath)) {
  console.log(`Server file not found at ${serverPath}, checking alternatives...`);
  if (fs.existsSync('dist/server.js')) {
    serverPath = 'dist/server.js';
  } else if (fs.existsSync('server.js')) {
    serverPath = 'server.js';
  } else {
    console.error('ERROR: Could not find server entry point');
    process.exit(1);
  }
}

console.log(`Starting application from ${serverPath}`);

// Start the main application using spawn
const app = spawn('node', [serverPath], { stdio: 'inherit' });

app.on('error', (err) => {
  console.error('Failed to start application:', err);
  process.exit(1);
});

app.on('exit', (code) => {
  console.log(`Application exited with code ${code}`);
  if (code !== 0) {
    process.exit(code);
  }
});
