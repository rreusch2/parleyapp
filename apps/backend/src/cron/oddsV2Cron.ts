import cron from 'node-cron';
import { logger } from '../utils/logger';
import { spawn } from 'child_process';
import path from 'path';

/**
 * Executes the odds:v2 script to fetch game odds and player props
 * This runs the same command as: npm run odds:v2
 */
async function runOddsV2Script(): Promise<void> {
  return new Promise((resolve, reject) => {
    logger.info('[oddsV2Cron] Starting odds:v2 data fetch...');
    
    const scriptPath = path.join(__dirname, '../../src/scripts/runOddsV2.ts');
    
    // Execute ts-node with the script
    const childProcess = spawn('npx', ['ts-node', scriptPath], {
      cwd: path.join(__dirname, '../..'),
      env: { ...process.env },
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    let stdout = '';
    let stderr = '';
    
    childProcess.stdout.on('data', (data) => {
      const output = data.toString();
      stdout += output;
      logger.info(`[oddsV2Cron] ${output.trim()}`);
    });
    
    childProcess.stderr.on('data', (data) => {
      const error = data.toString();
      stderr += error;
      logger.error(`[oddsV2Cron] STDERR: ${error.trim()}`);
    });
    
    childProcess.on('close', (code) => {
      if (code === 0) {
        logger.info('[oddsV2Cron] ✅ Odds:v2 data fetch completed successfully');
        resolve();
      } else {
        logger.error(`[oddsV2Cron] ❌ Odds:v2 data fetch failed with code ${code}`);
        reject(new Error(`Process exited with code ${code}`));
      }
    });
    
    childProcess.on('error', (error) => {
      logger.error('[oddsV2Cron] Failed to start odds:v2 script:', error);
      reject(error);
    });
  });
}

/**
 * Initialize the odds:v2 cron jobs
 * - Runs at 11:00 PM daily (23:00)
 * - Runs at 12:00 PM daily (noon)
 */
export function initOddsV2Cron() {
  const tz = process.env.ODDS_CRON_TZ || 'America/New_York';
  const enabled = process.env.ENABLE_ODDS_CRON === 'true' || process.env.NODE_ENV === 'production';
  
  if (!enabled) {
    logger.info('[oddsV2Cron] Disabled (set ENABLE_ODDS_CRON=true to enable)');
    return;
  }

  // Run at 11:00 PM (23:00) daily
  cron.schedule('0 0 23 * * *', async () => {
    logger.info('[oddsV2Cron] 11:00 PM job starting...');
    try {
      await runOddsV2Script();
    } catch (error) {
      logger.error('[oddsV2Cron] 11:00 PM job failed:', error);
    }
  }, { timezone: tz });

  // Run at 12:00 PM (noon) daily
  cron.schedule('0 0 12 * * *', async () => {
    logger.info('[oddsV2Cron] 12:00 PM (noon) job starting...');
    try {
      await runOddsV2Script();
    } catch (error) {
      logger.error('[oddsV2Cron] 12:00 PM job failed:', error);
    }
  }, { timezone: tz });

  logger.info(`[oddsV2Cron] ✅ Scheduled odds:v2 jobs (12:00 PM, 11:00 PM ${tz})`);
}
