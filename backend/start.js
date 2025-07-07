// Robust startup script with error handling
const fs = require('fs');
const path = require('path');

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

// Start the main application directly
try {
  require(`./${serverPath}`);
} catch (error) {
  console.error('Error starting application:', error);
  process.exit(1);
}
