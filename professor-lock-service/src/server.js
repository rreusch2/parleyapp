const express = require('express');
const WebSocket = require('ws');
const cors = require('cors');
const { createServer } = require('http');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const logger = require('./utils/logger');
const { AgentManager } = require('./services/AgentManager');
const { AuthService } = require('./services/AuthService');
const { RateLimiter } = require('./utils/RateLimiter');
const { MessageHandler } = require('./handlers/MessageHandler');
const { ToolManager } = require('./services/ToolManager');

class ProfessorLockServer {
  constructor() {
    this.app = express();
    this.server = createServer(this.app);
    this.wss = new WebSocket.Server({ server: this.server });
    this.clients = new Map(); // userId -> WebSocket[]
    this.sessions = new Map(); // sessionId -> session data
    
    this.agentManager = new AgentManager();
    this.authService = new AuthService();
    this.rateLimiter = new RateLimiter();
    this.messageHandler = new MessageHandler();
    this.toolManager = new ToolManager();
    
    this.setupExpress();
    this.setupWebSocket();
  }

  setupExpress() {
    // Middleware
    this.app.use(cors({
      origin: process.env.CORS_ORIGIN || 'http://localhost:3001',
      credentials: true
    }));
    this.app.use(express.json());

    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        connections: this.wss.clients.size,
        sessions: this.sessions.size
      });
    });

    // Agent status endpoint
    this.app.get('/status/:sessionId', async (req, res) => {
      const { sessionId } = req.params;
      const session = this.sessions.get(sessionId);
      
      if (!session) {
        return res.status(404).json({ error: 'Session not found' });
      }

      const agentStatus = await this.agentManager.getSessionStatus(sessionId);
      res.json(agentStatus);
    });

    // Tool configuration endpoint
    this.app.get('/tools', (req, res) => {
      res.json(this.toolManager.getAvailableTools());
    });
  }

  setupWebSocket() {
    this.wss.on('connection', (ws, req) => {
      logger.info('New WebSocket connection attempt');

      // Extract user info from URL path
      const url = new URL(req.url, `http://${req.headers.host}`);
      const pathSegments = url.pathname.split('/');
      
      if (pathSegments.length < 3 || pathSegments[1] !== 'professor-lock') {
        ws.close(1008, 'Invalid connection path');
        return;
      }

      const userId = pathSegments[2];
      if (!userId) {
        ws.close(1008, 'User ID required');
        return;
      }

      this.handleConnection(ws, userId);
    });
  }

  async handleConnection(ws, userId) {
    try {
      // Authenticate user (simplified for demo)
      const user = await this.authService.validateUser(userId);
      if (!user) {
        ws.close(1008, 'Authentication failed');
        return;
      }

      // Check rate limits
      if (!this.rateLimiter.checkConnectionLimit(userId)) {
        ws.close(1008, 'Too many connections');
        return;
      }

      // Create session
      const sessionId = uuidv4();
      const session = {
        id: sessionId,
        userId,
        user,
        ws,
        createdAt: new Date(),
        lastActivity: new Date(),
        agentState: 'idle',
        activeTools: new Set(),
        messageHistory: []
      };

      this.sessions.set(sessionId, session);
      
      // Track user connections
      if (!this.clients.has(userId)) {
        this.clients.set(userId, []);
      }
      this.clients.get(userId).push(ws);

      // Initialize agent session
      await this.agentManager.initializeSession(sessionId, user);

      logger.info(`User ${userId} connected with session ${sessionId}`);

      // Send welcome message
      this.sendToClient(ws, {
        type: 'connection_established',
        sessionId,
        message: 'Professor Lock Advanced Agent ready',
        capabilities: this.toolManager.getAvailableTools()
      });

      // Setup message handlers
      ws.on('message', (data) => this.handleMessage(sessionId, data));
      ws.on('close', () => this.handleDisconnection(sessionId));
      ws.on('error', (error) => this.handleError(sessionId, error));

      // Setup heartbeat
      ws.isAlive = true;
      ws.on('pong', () => { ws.isAlive = true; });

    } catch (error) {
      logger.error('Connection setup failed:', error);
      try {
        this.rateLimiter.releaseConnection(userId);
      } catch (e) {
        logger.error('Failed to release connection slot after setup error:', e);
      }
      ws.close(1011, 'Internal server error');
    }
  }

  async handleMessage(sessionId, data) {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    try {
      const message = JSON.parse(data);
      session.lastActivity = new Date();

      // Rate limiting
      if (!this.rateLimiter.checkMessageRate(session.userId)) {
        this.sendToClient(session.ws, {
          type: 'rate_limit_exceeded',
          message: 'Too many messages, please slow down'
        });
        return;
      }

      logger.debug(`Message from ${session.userId}:`, message);

      // Handle different message types
      switch (message.type) {
        case 'user_message':
          await this.handleUserMessage(session, message);
          break;
        case 'tool_interaction':
          await this.handleToolInteraction(session, message);
          break;
        case 'agent_interrupt':
          await this.handleAgentInterrupt(session, message);
          break;
        case 'ping':
          this.sendToClient(session.ws, { type: 'pong' });
          break;
        default:
          logger.warn(`Unknown message type: ${message.type}`);
      }

    } catch (error) {
      logger.error(`Message handling error for session ${sessionId}:`, error);
      this.sendToClient(session.ws, {
        type: 'error',
        message: 'Failed to process message'
      });
    }
  }

  async handleUserMessage(session, message) {
    const { content, messageId, userTier } = message;

    // Add to message history
    session.messageHistory.push({
      role: 'user',
      content,
      timestamp: new Date(),
      messageId
    });

    // Update agent state
    session.agentState = 'processing';
    this.broadcastAgentStatus(session);

    try {
      // Send typing indicator
      this.sendToClient(session.ws, {
        type: 'agent_typing',
        messageId
      });

      // Process with OpenManus agent
      await this.agentManager.processMessage(session, {
        content,
        messageId,
        userTier,
        onChunk: (chunk) => {
          this.sendToClient(session.ws, {
            type: 'message_chunk',
            messageId,
            chunk
          });
        },
        onToolStart: (tool) => {
          session.activeTools.add(tool.name);
          this.sendToClient(session.ws, {
            type: 'tool_start',
            tool: {
              ...tool,
              startTime: new Date()
            }
          });
          this.broadcastAgentStatus(session);
        },
        onToolUpdate: (toolName, update) => {
          this.sendToClient(session.ws, {
            type: 'tool_update',
            toolName,
            update
          });
        },
        onToolScreenshot: (toolName, screenshot) => {
          this.sendToClient(session.ws, {
            type: 'tool_screenshot',
            toolName,
            screenshot
          });
        },
        onToolComplete: (toolName, result) => {
          session.activeTools.delete(toolName);
          this.sendToClient(session.ws, {
            type: 'tool_complete',
            toolName,
            result: {
              ...result,
              endTime: new Date()
            }
          });
          this.broadcastAgentStatus(session);
        },
        onComplete: (response) => {
          session.agentState = 'idle';
          // For non-streaming responses, push the full content as a final chunk
          if (response && typeof response.content === 'string' && response.content.length) {
            this.sendToClient(session.ws, {
              type: 'message_chunk',
              messageId,
              chunk: response.content
            });
          }
          this.sendToClient(session.ws, {
            type: 'message_complete',
            messageId,
            toolsUsed: response.toolsUsed || []
          });
          this.broadcastAgentStatus(session);
        }
      });

    } catch (error) {
      logger.error(`Agent processing error:`, error);
      session.agentState = 'error';
      this.sendToClient(session.ws, {
        type: 'agent_error',
        messageId,
        error: 'Agent processing failed'
      });
      this.broadcastAgentStatus(session);
    }
  }

  async handleToolInteraction(session, message) {
    const { toolName, action, data } = message;
    
    try {
      const result = await this.toolManager.handleInteraction(
        session.id, 
        toolName, 
        action, 
        data
      );
      
      this.sendToClient(session.ws, {
        type: 'tool_interaction_result',
        toolName,
        action,
        result
      });
    } catch (error) {
      logger.error(`Tool interaction error:`, error);
      this.sendToClient(session.ws, {
        type: 'tool_interaction_error',
        toolName,
        error: error.message
      });
    }
  }

  async handleAgentInterrupt(session, message) {
    try {
      await this.agentManager.interruptSession(session.id);
      session.agentState = 'idle';
      session.activeTools.clear();
      
      this.sendToClient(session.ws, {
        type: 'agent_interrupted',
        message: 'Agent processing interrupted'
      });
      this.broadcastAgentStatus(session);
    } catch (error) {
      logger.error(`Agent interrupt error:`, error);
    }
  }

  broadcastAgentStatus(session) {
    this.sendToClient(session.ws, {
      type: 'agent_status',
      status: {
        isActive: session.agentState !== 'idle',
        currentTask: session.agentState === 'processing' ? 'Processing request...' : null,
        toolsInUse: Array.from(session.activeTools),
        progress: session.agentState === 'processing' ? 50 : 0
      }
    });
  }

  handleDisconnection(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    logger.info(`Session ${sessionId} disconnected`);

    // Clean up agent session
    this.agentManager.cleanupSession(sessionId);

    // Release rate limit slot for this user
    try {
      this.rateLimiter.releaseConnection(session.userId);
    } catch (e) {
      logger.error('Failed to release connection slot:', e);
    }

    // Remove from client tracking
    const userConnections = this.clients.get(session.userId);
    if (userConnections) {
      const index = userConnections.indexOf(session.ws);
      if (index > -1) {
        userConnections.splice(index, 1);
      }
      if (userConnections.length === 0) {
        this.clients.delete(session.userId);
      }
    }

    // Remove session
    this.sessions.delete(sessionId);
  }

  handleError(sessionId, error) {
    logger.error(`WebSocket error for session ${sessionId}:`, error);
  }

  sendToClient(ws, data) {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify(data));
      } catch (error) {
        logger.error('Failed to send message to client:', error);
      }
    }
  }

  setupHeartbeat() {
    setInterval(() => {
      this.wss.clients.forEach((ws) => {
        if (!ws.isAlive) {
          ws.terminate();
          return;
        }
        ws.isAlive = false;
        ws.ping();
      });
    }, 30000); // 30 seconds
  }

  start(port = process.env.PORT || 8080) {
    this.setupHeartbeat();
    
    this.server.listen(port, () => {
      logger.info(`Professor Lock Service running on port ${port}`);
      logger.info(`WebSocket endpoint: ws://localhost:${port}/professor-lock/{userId}`);
      logger.info(`Health check: http://localhost:${port}/health`);
    });
  }
}

// Start the server
if (require.main === module) {
  const server = new ProfessorLockServer();
  server.start();
}

module.exports = { ProfessorLockServer };
