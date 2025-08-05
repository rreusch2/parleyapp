import express from 'express';
import { authenticateToken, isAdmin } from '../../middleware/authenticate';
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
  
  logger.info(`Forwarding admin command to Python Scripts Service: ${command}`);
  
  // Forward command to Python Scripts Service
  const scriptsServiceUrl = process.env.PYTHON_SCRIPTS_SERVICE_URL;
  if (!scriptsServiceUrl) {
    return res.status(500).json({
      success: false,
      error: 'Python Scripts Service URL not configured'
    });
  }
  
  try {
    const fetch = require('node-fetch');
    const response = await fetch(`${scriptsServiceUrl}/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ command }),
      timeout: 300000 // 5 minute timeout
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      return res.status(response.status).json(data);
    }
    
    logger.info(`Command executed successfully via Scripts Service: ${command}`);
    return res.json(data);
    
  } catch (error) {
    logger.error(`Error calling Python Scripts Service: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: `Failed to execute command: ${error.message}`
    });
  }
});

export default router;