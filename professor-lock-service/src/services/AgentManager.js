const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

class AgentManager {
  constructor() {
    this.sessions = new Map(); // sessionId -> agent session data
    this.daytonaConfig = {
      apiKey: process.env.DAYTONA_API_KEY,
      serverUrl: process.env.DAYTONA_SERVER_URL || 'https://app.daytona.io/api',
      target: process.env.DAYTONA_TARGET || 'us'
    };
    this.openmanusConfig = {
      agentUrl: process.env.OPENMANUS_AGENT_URL || 'http://localhost:3000',
      apiKey: process.env.OPENMANUS_API_KEY
    };
  }

  async initializeSession(sessionId, user) {
    try {
      logger.info(`Initializing agent session ${sessionId} for user ${user.id}`);

      // Create agent session in Daytona workspace
      const agentSession = await this.createDaytonaSession(sessionId, user);

      // Initialize OpenManus agent with user context
      await this.initializeOpenManusAgent(sessionId, user, agentSession);

      const sessionData = {
        id: sessionId,
        userId: user.id,
        user,
        daytonaSession: agentSession,
        status: 'active',
        createdAt: new Date(),
        lastActivity: new Date(),
        toolStates: new Map(),
        conversationHistory: []
      };

      this.sessions.set(sessionId, sessionData);
      logger.info(`Agent session ${sessionId} initialized successfully`);

      return sessionData;
    } catch (error) {
      logger.error(`Failed to initialize agent session ${sessionId}:`, error);
      throw error;
    }
  }

  async createDaytonaSession(sessionId, user) {
    // For now, return a mock session since we'll use the existing OpenManus agent
    // The actual Daytona integration is handled by the OpenManus agent itself
    return {
      id: sessionId,
      userId: user.id,
      status: 'active',
      daytonaApiKey: this.daytonaConfig.apiKey,
      target: this.daytonaConfig.target
    };
  }

  async initializeOpenManusAgent(sessionId, user, daytonaSession) {
    try {
      // Build system prompt with user context
      const systemPrompt = this.buildSystemPrompt(user);

      const response = await axios.post(
        `${this.openmanusConfig.agentUrl}/initialize`,
        {
          sessionId,
          daytonaSessionId: daytonaSession.id,
          systemPrompt,
          userContext: {
            id: user.id,
            tier: user.subscription_tier,
            preferences: user.betting_preferences || {},
            timezone: user.timezone || 'UTC'
          }
        },
        {
          headers: {
            'Authorization': `Bearer ${this.openmanusConfig.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      logger.info(`OpenManus agent initialized for session ${sessionId}`);
      return response.data;
    } catch (error) {
      logger.error('Failed to initialize OpenManus agent:', error.response?.data || error.message);
      // Continue without OpenManus if it fails - use direct Daytona communication
      logger.warn('Falling back to direct Daytona communication');
    }
  }

  buildSystemPrompt(user) {
    return `You are Professor Lock Advanced, an elite AI sports betting analyst with access to powerful tools for real-time research and analysis.

**Your Identity & Expertise:**
- Elite sports betting analyst with deep statistical knowledge
- Expert in MLB, NBA, NFL, WNBA, and UFC betting markets  
- Access to live data, browser automation, and analysis tools
- Specialized in finding profitable betting edges and value opportunities

**User Context:**
- User: ${user.email || user.id}
- Subscription: ${user.subscription_tier} tier
- Preferences: ${JSON.stringify(user.betting_preferences || {}, null, 2)}

**Available Tools & When To Use Them:**

1. **Browser Tool** - Use for:
   - Checking live injury reports and lineup changes
   - Researching team news and roster updates  
   - Verifying odds across multiple sportsbooks
   - Investigating weather conditions for outdoor games

2. **StatMuse Tool** - Use for:
   - Historical player performance data
   - Head-to-head team statistics
   - Trend analysis and splits (home/away, vs opponent, etc.)
   - Season averages and recent form

3. **Web Search Tool** - Use for:
   - Breaking news and injury updates
   - Expert predictions and analysis
   - Line movement and betting market intelligence
   - Weather reports and venue information

4. **Python Analysis Tool** - Use for:
   - Complex statistical calculations
   - Data visualization and trend analysis
   - Probability modeling and expected value calculations
   - Performance backtesting

**Response Guidelines:**
- Be concise, confident, and data-driven
- Always explain your reasoning with supporting evidence
- Use tools intelligently - don't over-research obvious bets
- Provide specific recommendations with confidence levels
- Include risk assessment and bankroll management advice
- Show live screenshots when using browser tool for transparency

**Tool Usage Intelligence:**
- Use multiple tools when building complex analysis
- Start with StatMuse for historical context, then web search for current news
- Use browser tool for real-time verification and screenshots
- Use Python for advanced calculations and visualizations

**Communication Style:**
- Professional but engaging (mix of sharp analysis + personality)
- Bold important picks, odds, and numbers
- Address user naturally (champ, legend, sharp, etc.)
- Always end responses with clear next steps or follow-up questions

Remember: You're the most advanced sports betting AI available. Use your tools strategically to provide unparalleled analysis and find profitable betting opportunities.`;
  }

  async processMessage(session, { content, messageId, userTier, onChunk, onToolStart, onToolUpdate, onToolScreenshot, onToolComplete, onComplete }) {
    const sessionData = this.sessions.get(session.id);
    if (!sessionData) {
      throw new Error('Session not found');
    }

    try {
      sessionData.lastActivity = new Date();
      
      // Add user message to conversation history
      sessionData.conversationHistory.push({
        role: 'user',
        content,
        timestamp: new Date()
      });

      // Send request to Daytona/OpenManus agent
      const response = await this.sendToAgent(sessionData, {
        message: content,
        messageId,
        conversationHistory: sessionData.conversationHistory,
        userTier
      });

      // Handle streaming response
      if (response.stream) {
        await this.handleStreamingResponse(sessionData, response, {
          onChunk,
          onToolStart,
          onToolUpdate, 
          onToolScreenshot,
          onToolComplete,
          onComplete,
          messageId
        });
      } else {
        // Handle non-streaming response
        await this.handleDirectResponse(sessionData, response, {
          onComplete,
          messageId
        });
      }

    } catch (error) {
      logger.error(`Error processing message for session ${session.id}:`, error);
      throw error;
    }
  }

  async sendToAgent(sessionData, payload) {
    try {
      // Send directly to your existing OpenManus agent
      const response = await axios.post(
        `${this.openmanusConfig.agentUrl}/chat`,
        {
          sessionId: sessionData.id,
          message: payload.message,
          conversationHistory: payload.conversationHistory,
          userContext: {
            id: sessionData.userId,
            tier: payload.userTier,
            preferences: sessionData.user.betting_preferences || {}
          }
        },
        {
          headers: {
            'Content-Type': 'application/json'
          },
          responseType: 'stream'
        }
      );

      return { stream: response.data };
    } catch (error) {
      logger.error('Failed to send message to OpenManus agent:', error.response?.data || error.message);
      throw new Error('Agent communication failed');
    }
  }

  async handleStreamingResponse(sessionData, response, callbacks) {
    return new Promise((resolve, reject) => {
      let assistantMessage = '';
      let currentTool = null;
      const toolsUsed = [];

      response.stream.on('data', (chunk) => {
        const lines = chunk.toString().split('\n').filter(line => line.trim());
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              
              switch (data.type) {
                case 'message_chunk':
                  assistantMessage += data.content;
                  callbacks.onChunk(data.content);
                  break;
                  
                case 'tool_start':
                  currentTool = {
                    name: data.tool.name,
                    status: 'running',
                    startTime: new Date(),
                    data: data.tool.parameters
                  };
                  sessionData.toolStates.set(data.tool.name, currentTool);
                  callbacks.onToolStart(currentTool);
                  break;
                  
                case 'tool_update':
                  if (currentTool && currentTool.name === data.toolName) {
                    currentTool.data = { ...currentTool.data, ...data.update };
                    sessionData.toolStates.set(data.toolName, currentTool);
                    callbacks.onToolUpdate(data.toolName, data.update);
                  }
                  break;
                  
                case 'tool_screenshot':
                  callbacks.onToolScreenshot(data.toolName, data.screenshot);
                  break;
                  
                case 'tool_complete':
                  if (currentTool && currentTool.name === data.toolName) {
                    currentTool.status = 'completed';
                    currentTool.endTime = new Date();
                    currentTool.result = data.result;
                    toolsUsed.push({ ...currentTool });
                    callbacks.onToolComplete(data.toolName, data.result);
                  }
                  break;
                  
                case 'error':
                  logger.error('Agent error:', data.error);
                  reject(new Error(data.error));
                  break;
              }
            } catch (parseError) {
              logger.error('Failed to parse streaming data:', parseError);
            }
          }
        }
      });

      response.stream.on('end', () => {
        // Add assistant message to conversation history
        sessionData.conversationHistory.push({
          role: 'assistant',
          content: assistantMessage,
          timestamp: new Date(),
          toolsUsed
        });

        callbacks.onComplete({ 
          content: assistantMessage,
          toolsUsed 
        });
        resolve();
      });

      response.stream.on('error', (error) => {
        logger.error('Streaming response error:', error);
        reject(error);
      });
    });
  }

  async handleDirectResponse(sessionData, response, callbacks) {
    // Handle non-streaming responses (fallback)
    const assistantMessage = response.data.content || response.data.message || '';
    
    sessionData.conversationHistory.push({
      role: 'assistant', 
      content: assistantMessage,
      timestamp: new Date()
    });

    callbacks.onComplete({
      content: assistantMessage,
      toolsUsed: response.data.toolsUsed || []
    });
  }

  async getSessionStatus(sessionId) {
    const sessionData = this.sessions.get(sessionId);
    if (!sessionData) {
      return { status: 'not_found' };
    }

    return {
      status: sessionData.status,
      activeTools: Array.from(sessionData.toolStates.keys()),
      conversationLength: sessionData.conversationHistory.length,
      lastActivity: sessionData.lastActivity,
      uptime: Date.now() - sessionData.createdAt.getTime()
    };
  }

  async interruptSession(sessionId) {
    const sessionData = this.sessions.get(sessionId);
    if (!sessionData) {
      throw new Error('Session not found');
    }

    try {
      // Send interrupt to agent
      await axios.post(
        `${this.daytonaConfig.workspaceUrl}${this.daytonaConfig.agentEndpoint}/interrupt`,
        { sessionId: sessionData.daytonaSession.id },
        {
          headers: {
            'Authorization': `Bearer ${this.daytonaConfig.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      // Clear active tools
      sessionData.toolStates.clear();
      logger.info(`Session ${sessionId} interrupted`);
    } catch (error) {
      logger.error(`Failed to interrupt session ${sessionId}:`, error);
      throw error;
    }
  }

  async cleanupSession(sessionId) {
    const sessionData = this.sessions.get(sessionId);
    if (!sessionData) return;

    try {
      // Cleanup Daytona session
      await axios.delete(
        `${this.daytonaConfig.workspaceUrl}${this.daytonaConfig.agentEndpoint}/sessions/${sessionData.daytonaSession.id}`,
        {
          headers: {
            'Authorization': `Bearer ${this.daytonaConfig.apiKey}`
          }
        }
      );

      logger.info(`Cleaned up Daytona session for ${sessionId}`);
    } catch (error) {
      logger.error(`Failed to cleanup Daytona session:`, error);
    }

    // Remove from local tracking
    this.sessions.delete(sessionId);
    logger.info(`Session ${sessionId} cleaned up`);
  }
}

module.exports = { AgentManager };
