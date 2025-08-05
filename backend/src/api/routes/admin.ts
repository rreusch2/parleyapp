import express from 'express';
import { authenticateToken, isAdmin } from '../middleware/auth';
import { exec } from 'child_process';
import { logger } from '../../utils/logger';

const router = express.Router();

// Middleware to ensure user is authenticated and an admin
router.use(authenticateToken);
router.use(isAdmin);

// Endpoint to execute commands
router.post('/execute-command', async (req, res) => {
  const { command } = req.body;
  
  if (!command) {
    return res.status(400).json({ success: false, error: 'Command is required' });
  }
  
  // List of allowed commands for security
  const allowedCommands = [
    'python props_enhanced.py',
    'python props_enhanced.py --tomorrow',
    'python teams_enhanced.py',
    'python teams_enhanced.py --tomorrow',
    'cd backend && npm run odds',
    'python insights_personalized_enhanced.py',
    'python daily_trends_generator.py',
    'python statmuse_api_server.py'
  ];
  
  // Check if the command is allowed
  if (!allowedCommands.some(cmd => command.startsWith(cmd))) {
    logger.warn(`Rejected unauthorized command: ${command}`);
    return res.status(403).json({ 
      success: false, 
      error: 'Command not allowed for security reasons'
    });
  }
  
  logger.info(`Executing admin command: ${command}`);
  
  // Execute the command
  exec(command, { maxBuffer: 1024 * 1024 * 10 }, (error, stdout, stderr) => {
    if (error) {
      logger.error(`Command execution error: ${error.message}`);
      return res.status(500).json({ 
        success: false, 
        error: error.message,
        stderr: stderr
      });
    }
    
    // Handle process output
    const output = stdout || stderr;
    logger.info(`Command executed successfully: ${command}`);
    
    return res.json({
      success: true,
      output: output.substring(0, 1000), // Limit response size
      command
    });
  });
});

export default router;