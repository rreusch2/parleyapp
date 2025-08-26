#!/usr/bin/env node

// Fast CFB-only odds integration for testing
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function addCFBToSportsConfig() {
  console.log('🏈 Adding CFB to sports_config table...');
  
  const { data, error } = await supabase
    .from('sports_config')
    .upsert({
      sport_key: 'americanfootball_ncaaf',
      sport_name: 'College Football',
      is_active: true,
      current_season: '2024',
      metadata: {
        source: 'theodds_api',
        season_start: '2024-08-24',
        season_end: '2025-01-20'
      }
    }, { onConflict: 'sport_key' })
    .select();

  if (error) {
    console.error('❌ Failed to add CFB to sports_config:', error);
    return false;
  }
  
  console.log('✅ Added CFB to sports_config');
  return true;
}

async function runCFBOnly() {
  console.log('🏈 Running CFB-only odds integration...\n');
  
  // First add CFB to sports_config
  const added = await addCFBToSportsConfig();
  if (!added) {
    console.log('❌ Cannot proceed without sports_config entry');
    return;
  }
  
  // Set environment to CFB only
  process.env.ACTIVE_SPORTS = 'CFB';
  process.env.ENABLE_CFB_DATA = 'true';
  process.env.ENABLE_MLB_DATA = 'false';
  process.env.ENABLE_WNBA_DATA = 'false';
  process.env.ENABLE_UFC_DATA = 'false';
  process.env.ENABLE_NFL_DATA = 'false';
  
  console.log('🔧 Temporarily setting ACTIVE_SPORTS=CFB only for testing\n');
  
  // Now run the main script
  try {
    const { spawn } = require('child_process');
    
    const child = spawn('npx', ['ts-node', 'src/scripts/setupOddsIntegration.ts'], {
      cwd: __dirname,
      stdio: 'inherit',
      env: { ...process.env }
    });
    
    child.on('close', (code) => {
      console.log(`\n🏈 CFB-only script finished with code ${code}`);
      process.exit(code);
    });
    
  } catch (error) {
    console.error('❌ Error running CFB script:', error);
  }
}

runCFBOnly();
