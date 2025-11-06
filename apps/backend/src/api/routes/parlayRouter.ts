import { Router, Request, Response } from 'express';
import { parlayOrchestrator } from '../../ai/orchestrator/parlayOrchestrator';
import { createLogger } from '../../utils/logger';

const logger = createLogger('parlayRouter');
const router = Router();

interface ParlayGenerateRequest extends Request {
  body: {
    config: {
      legs: number;
      riskLevel: 'safe' | 'balanced' | 'risky';
      betType: 'player' | 'team' | 'mixed';
      bankrollPercentage: number;
      sports?: string[];
      sport?: string;
    };
    userId: string;
  };
}

/**
 * POST /api/ai/parlay/generate
 * Generate an AI-powered parlay with streaming updates
 */
router.post('/generate', async (req: ParlayGenerateRequest, res: Response) => {
  try {
    const { config, userId } = req.body;

    if (!config || !userId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters: config and userId'
      });
    }

    // Set up SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable Nginx buffering

    // Send initial connection event
    res.write(`event: open\ndata: ${JSON.stringify({ connected: true })}\n\n`);

    // Keep connection alive
    const keepAliveInterval = setInterval(() => {
      res.write(': keep-alive\n\n');
    }, 30000);

    // Handle client disconnect
    req.on('close', () => {
      clearInterval(keepAliveInterval);
      logger.info('Client disconnected from parlay generation');
    });

    // Generate parlay with streaming
    await parlayOrchestrator.generateParlay(
      { config, userId },
      (data: any) => {
        // Send SSE event
        res.write(`event: message\ndata: ${JSON.stringify(data)}\n\n`);
      }
    );

    // Clean up
    clearInterval(keepAliveInterval);
    res.end();

  } catch (error) {
    logger.error('Error in parlay generation:', error);
    
    // If headers haven't been sent yet, send error response
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: 'Failed to generate parlay'
      });
    } else {
      // Send error event through SSE
      res.write(`event: error\ndata: ${JSON.stringify({ error: 'Generation failed' })}\n\n`);
      res.end();
    }
  }
});

/**
 * GET /api/ai/parlay/health
 * Health check endpoint
 */
router.get('/health', (req: Request, res: Response) => {
  res.json({
    success: true,
    service: 'parlay-orchestrator',
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

export default router;
