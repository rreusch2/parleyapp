#!/usr/bin/env node

// CFB integration for August 28, 2025 - Modified date range
require('dotenv').config();

async function runCFBAug28() {
  console.log('🏈 Running CFB integration for August 28, 2025...\n');
  
  // Set environment to CFB only with extended date range
  process.env.ACTIVE_SPORTS = 'CFB';
  process.env.ENABLE_CFB_DATA = 'true';
  process.env.ENABLE_MLB_DATA = 'false';
  process.env.ENABLE_WNBA_DATA = 'false';
  process.env.ENABLE_UFC_DATA = 'false';
  process.env.ENABLE_NFL_DATA = 'false';
  
  // Override date range to include August 28th
  process.env.OVERRIDE_START_DATE = '2025-08-28T00:00:00Z';
  process.env.OVERRIDE_END_DATE = '2025-08-29T06:00:00Z';  // Include early Aug 29 for late games
  
  console.log('🔧 Settings:');
  console.log('  - ACTIVE_SPORTS=CFB only');
  console.log('  - Date range: Aug 28 00:00 - Aug 29 06:00 UTC');
  console.log('  - This should capture those 15 CFB games\n');
  
  try {
    const { spawn } = require('child_process');
    
    const child = spawn('npx', ['ts-node', 'src/scripts/setupOddsIntegration.ts'], {
      cwd: __dirname,
      stdio: 'inherit',
      env: { ...process.env }
    });
    
    child.on('close', (code) => {
      console.log(`\n🏈 CFB August 28th script finished with code ${code}`);
      process.exit(code);
    });
    
  } catch (error) {
    console.error('❌ Error running CFB script:', error);
  }
}

runCFBAug28();
