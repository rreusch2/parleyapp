/**
 * Railway Cron Service for Daily Predictions
 * Runs daily at 10:00 PM EST to generate next day's predictions
 */

const { spawn } = require('child_process');
const cron = require('node-cron');
const fs = require('fs').promises;
const path = require('path');

// Configuration
const LOG_DIR = path.join(__dirname, 'logs');
const PROJECT_ROOT = __dirname;

// Ensure logs directory exists
async function ensureLogDir() {
  try {
    await fs.mkdir(LOG_DIR, { recursive: true });
  } catch (err) {
    console.error('Failed to create logs directory:', err);
  }
}

// Logging utility
function log(message, level = 'INFO') {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [${level}] ${message}`;
  console.log(logMessage);
  return logMessage;
}

// Run shell command
function runCommand(command, args = [], options = {}) {
  return new Promise((resolve, reject) => {
    log(`Running: ${command} ${args.join(' ')}`);
    
    const proc = spawn(command, args, {
      cwd: options.cwd || PROJECT_ROOT,
      env: { ...process.env, ...options.env },
      shell: true
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
      process.stdout.write(data);
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
      process.stderr.write(data);
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr, code });
      } else {
        reject(new Error(`Command failed with code ${code}: ${stderr}`));
      }
    });

    proc.on('error', (err) => {
      reject(err);
    });
  });
}

// Main automation function
async function runDailyAutomation() {
  const startTime = Date.now();
  const date = new Date().toISOString().split('T')[0];
  const logFile = path.join(LOG_DIR, `railway-cron-${date}.log`);
  
  log('🚀 Starting Daily Automation');
  log(`📝 Log file: ${logFile}`);

  const results = {
    statmuse: false,
    odds: false,
    teams: {},
    props: {}
  };

  const sports = ['NBA', 'NFL', 'CFB', 'NHL', 'MLB', 'WNBA'];

  try {
    // Step 1: Start StatMuse API Server
    log('📡 Step 1/4: Starting StatMuse API Server...');
    try {
      // Check if already running
      const checkCmd = await runCommand('pgrep', ['-f', 'statmuse_api_server.py']);
      log('✅ StatMuse API server already running');
      results.statmuse = true;
    } catch (err) {
      // Not running, start it
      log('⚠️  Starting StatMuse API server...');
      runCommand('python', ['statmuse_api_server.py'], { 
        detached: true 
      }).catch(() => {
        log('⚠️  StatMuse server failed to start', 'WARN');
      });
      
      // Wait for it to start
      await new Promise(resolve => setTimeout(resolve, 15000));
      results.statmuse = true;
    }

    // Step 2: Fetch Odds Data
    log('🎲 Step 2/4: Fetching odds and games data...');
    try {
      await runCommand('npm', ['run', 'odds:v2'], {
        cwd: path.join(PROJECT_ROOT, 'apps', 'backend')
      });
      log('✅ Odds v2 integration completed');
      results.odds = true;
    } catch (err) {
      log(`❌ Odds fetch failed: ${err.message}`, 'ERROR');
    }

    // Step 3: Generate Team Picks
    log('🏆 Step 3/4: Generating team picks for all sports...');
    for (const sport of sports) {
      try {
        log(`🏅 Processing team picks for ${sport}...`);
        await runCommand('python', [
          'teams_enhanced.py',
          '--tomorrow',
          '--sport',
          sport
        ]);
        log(`✅ Team picks completed for ${sport}`);
        results.teams[sport] = true;
      } catch (err) {
        log(`❌ Team picks failed for ${sport}: ${err.message}`, 'ERROR');
        results.teams[sport] = false;
      }
    }

    // Step 4: Generate Prop Picks
    log('🎯 Step 4/4: Generating prop picks for all sports...');
    for (const sport of sports) {
      try {
        log(`📊 Processing prop picks for ${sport}...`);
        await runCommand('python', [
          'props_intelligent_v3.py',
          '--sport',
          sport,
          '--tomorrow'
        ]);
        log(`✅ Prop picks completed for ${sport}`);
        results.props[sport] = true;
      } catch (err) {
        log(`❌ Prop picks failed for ${sport}: ${err.message}`, 'ERROR');
        results.props[sport] = false;
      }
    }

    const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(2);
    log('');
    log('🎉 ================================================');
    log('🎉 Daily Automation Completed');
    log('🎉 ================================================');
    log(`⏱️  Duration: ${duration} minutes`);
    log(`📊 Results: ${JSON.stringify(results, null, 2)}`);
    log('');

  } catch (err) {
    log(`❌ Fatal error in automation: ${err.message}`, 'ERROR');
    throw err;
  }
}

// Health check endpoint
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    service: 'railway-cron',
    timestamp: new Date().toISOString()
  });
});

app.get('/run', async (req, res) => {
  res.json({ status: 'starting', message: 'Daily automation job started' });
  
  // Run in background
  runDailyAutomation().catch(err => {
    log(`Error in manual run: ${err.message}`, 'ERROR');
  });
});

app.listen(PORT, () => {
  log(`Railway cron service listening on port ${PORT}`);
});

// Schedule daily run at 10:00 PM EST (3:00 AM UTC next day)
// Cron format: second minute hour day month weekday
cron.schedule('0 3 * * *', async () => {
  log('⏰ Scheduled job triggered');
  try {
    await runDailyAutomation();
  } catch (err) {
    log(`❌ Scheduled job failed: ${err.message}`, 'ERROR');
  }
}, {
  scheduled: true,
  timezone: "UTC"
});

log('✅ Railway cron service started');
log('📅 Scheduled: Daily at 10:00 PM EST (3:00 AM UTC)');
log('🌐 Health check: http://localhost:' + PORT + '/health');
log('🔧 Manual trigger: http://localhost:' + PORT + '/run');

// Initialize
ensureLogDir();
