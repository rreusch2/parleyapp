import express, { Request, Response } from 'express'
import { broadcast } from '../../utils/sseHub'
import { createLogger } from '../../utils/logger'

const logger = createLogger('agentRoutes')
const router = express.Router()

// Simple header-based auth for external agent emitters
function verifyAgent(req: Request): boolean {
  const headerSecret = (req.headers['x-agent-secret'] || req.headers['x-agent-key']) as string | undefined
  const querySecret = (req.query.secret as string | undefined)
  const expected = process.env.AGENT_EVENTS_SECRET
  if (!expected) {
    // If unset, allow only in development
    const env = process.env.NODE_ENV || 'development'
    if (env !== 'development') {
      logger.warn('AGENT_EVENTS_SECRET not set and env=%s; rejecting', env)
      return false
    }
    return true
  }
  return headerSecret === expected || querySecret === expected
}

router.get('/health', (req, res) => {
  res.json({ success: true, service: 'agent-events', timestamp: new Date().toISOString() })
})

// Publish a tool event into the user's live stream
router.post('/events', (req: Request, res: Response) => {
  try {
    if (!verifyAgent(req)) {
      return res.status(401).json({ success: false, error: 'Unauthorized agent' })
    }

    const { userId, type, message, data } = req.body || {}
    if (!userId || !type) {
      return res.status(400).json({ success: false, error: 'userId and type are required' })
    }

    const event = {
      type,
      message,
      data: data || {},
      timestamp: new Date().toISOString(),
    }

    const delivered = broadcast(userId, event)
    logger.info('Agent event delivered to %d client(s) for user %s: %s', delivered, userId, type)

    return res.json({ success: true, delivered })
  } catch (error: any) {
    logger.error('Error in /api/agent/events: %s', error?.message || String(error))
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

export default router
