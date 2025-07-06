import { Router } from 'express';
import { logger } from '../utils/logger';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const router = Router();
const execAsync = promisify(exec);

// Middleware to verify automation requests (basic security)
const verifyAutomationRequest = (req: any, res: any, next: any) => {
  const authHeader = req.headers.authorization;
  const expectedToken = process.env.AUTOMATION_SECRET || 'parleyapp-automation-secret';
  
  if (!authHeader || authHeader !== `Bearer ${expectedToken}`) {
    return res.status(401).json({ 
      error: 'Unauthorized', 
      message: 'Valid authorization token required' 
    });
  }
  
  next();
};

// Daily automation endpoint for Railway cron
router.post('/daily', verifyAutomationRequest, async (req, res) => {
  const startTime = Date.now();
  const requestId = `auto-${Date.now()}`;
  
  logger.info(`[${requestId}] Starting daily automation via API endpoint`);
  
  try {
    // Set up paths
    const projectRoot = path.join(__dirname, '../../../');
    const scriptPath = path.join(projectRoot, 'scripts/daily-automated-workflow.sh');
    
    logger.info(`[${requestId}] Project root: ${projectRoot}`);
    logger.info(`[${requestId}] Script path: ${scriptPath}`);
    
    // Run the automation script
    const { stdout, stderr } = await execAsync(`cd ${projectRoot} && chmod +x scripts/daily-automated-workflow.sh && ./scripts/daily-automated-workflow.sh`, {
      timeout: 30 * 60 * 1000, // 30 minute timeout
      maxBuffer: 1024 * 1024 * 10 // 10MB buffer for logs
    });
    
    const duration = Date.now() - startTime;
    
    logger.info(`[${requestId}] Automation completed successfully in ${duration}ms`);
    
    res.json({
      success: true,
      message: 'Daily automation completed successfully',
      requestId,
      duration: `${Math.round(duration / 1000)}s`,
      timestamp: new Date().toISOString(),
      logs: {
        stdout: stdout.slice(-1000), // Last 1000 chars
        stderr: stderr.slice(-1000)
      }
    });
    
  } catch (error: any) {
    const duration = Date.now() - startTime;
    
    logger.error(`[${requestId}] Automation failed after ${duration}ms:`, error);
    
    res.status(500).json({
      success: false,
      error: 'Daily automation failed',
      requestId,
      duration: `${Math.round(duration / 1000)}s`,
      timestamp: new Date().toISOString(),
      message: error.message,
      logs: {
        stdout: error.stdout?.slice(-1000) || '',
        stderr: error.stderr?.slice(-1000) || ''
      }
    });
  }
});

// Test endpoint for manual testing
router.post('/test', verifyAutomationRequest, async (req, res) => {
  const requestId = `test-${Date.now()}`;
  
  logger.info(`[${requestId}] Running automation test (mock mode)`);
  
  try {
    const projectRoot = path.join(__dirname, '../../../');
    
    // Run in mock mode with reduced delays for testing
    const { stdout, stderr } = await execAsync(
      `cd ${projectRoot} && ./scripts/daily-automated-workflow.sh --mock --skip-delays`,
      {
        timeout: 5 * 60 * 1000, // 5 minute timeout for test
        maxBuffer: 1024 * 1024 * 5 // 5MB buffer
      }
    );
    
    logger.info(`[${requestId}] Test automation completed successfully`);
    
    res.json({
      success: true,
      message: 'Test automation completed successfully (mock mode)',
      requestId,
      timestamp: new Date().toISOString(),
      logs: {
        stdout: stdout.slice(-2000), // More logs for testing
        stderr: stderr.slice(-1000)
      }
    });
    
  } catch (error: any) {
    logger.error(`[${requestId}] Test automation failed:`, error);
    
    res.status(500).json({
      success: false,
      error: 'Test automation failed',
      requestId,
      timestamp: new Date().toISOString(),
      message: error.message,
      logs: {
        stdout: error.stdout?.slice(-1000) || '',
        stderr: error.stderr?.slice(-1000) || ''
      }
    });
  }
});

// Status endpoint to check automation health
router.get('/status', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'ParleyApp Daily Automation',
    timestamp: new Date().toISOString(),
    endpoints: {
      daily: 'POST /api/automation/daily - Run daily automation',
      test: 'POST /api/automation/test - Test automation (mock mode)',
      status: 'GET /api/automation/status - This endpoint'
    },
    environment: {
      nodeEnv: process.env.NODE_ENV,
      hasAutomationSecret: !!process.env.AUTOMATION_SECRET
    }
  });
});

export default router; 