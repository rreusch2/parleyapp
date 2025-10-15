import { Router } from 'express';
import OpenAI from 'openai';

const router = Router();

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Create ChatKit session endpoint
 * This generates a client token for the frontend to use ChatKit
 */
router.post('/session', async (req, res) => {
  try {
    const { deviceId, userId } = req.body;
    
    if (!deviceId) {
      return res.status(400).json({ error: 'deviceId is required' });
    }

    // Create ChatKit session using direct API call
    const response = await fetch('https://api.openai.com/v1/chatkit/sessions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'OpenAI-Beta': 'chatkit_beta=v1',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        workflow: { 
          id: process.env.CHATKIT_WORKFLOW_ID // You'll get this from Agent Builder
        },
        user: userId || deviceId,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
    }

    const session = await response.json() as { client_secret: string };

    res.json({ 
      client_secret: session.client_secret 
    });

  } catch (error) {
    console.error('ChatKit session creation error:', error);
    res.status(500).json({ 
      error: 'Failed to create ChatKit session',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Health check for ChatKit service
 */
router.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'chatkit',
    timestamp: new Date().toISOString()
  });
});

export default router;
