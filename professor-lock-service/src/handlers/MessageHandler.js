const logger = require('../utils/logger');

class MessageHandler {
  constructor() {
    this.messageTypes = new Map();
    this.registerMessageHandlers();
  }

  registerMessageHandlers() {
    // Register handlers for different message types
    this.messageTypes.set('user_message', this.handleUserMessage.bind(this));
    this.messageTypes.set('tool_interaction', this.handleToolInteraction.bind(this));
    this.messageTypes.set('agent_interrupt', this.handleAgentInterrupt.bind(this));
    this.messageTypes.set('ping', this.handlePing.bind(this));
    this.messageTypes.set('get_status', this.handleGetStatus.bind(this));
    this.messageTypes.set('get_history', this.handleGetHistory.bind(this));
    this.messageTypes.set('clear_conversation', this.handleClearConversation.bind(this));
    
    logger.info(`MessageHandler initialized with ${this.messageTypes.size} handlers`);
  }

  async processMessage(session, message, callbacks = {}) {
    const { type } = message;
    const handler = this.messageTypes.get(type);
    
    if (!handler) {
      logger.warn(`No handler found for message type: ${type}`);
      throw new Error(`Unsupported message type: ${type}`);
    }

    try {
      logger.debug(`Processing ${type} message for session ${session.id}`);
      return await handler(session, message, callbacks);
    } catch (error) {
      logger.error(`Error processing ${type} message:`, error);
      throw error;
    }
  }

  async handleUserMessage(session, message, callbacks) {
    const { content, messageId, userTier, context } = message;
    
    // Validate message content
    if (!content || typeof content !== 'string') {
      throw new Error('Invalid message content');
    }

    if (content.trim().length === 0) {
      throw new Error('Empty message content');
    }

    if (content.length > 10000) { // 10k character limit
      throw new Error('Message too long');
    }

    // Add user message to session history
    const userMessage = {
      id: messageId || Date.now().toString(),
      role: 'user',
      content: content.trim(),
      timestamp: new Date(),
      context: context || {}
    };

    session.messageHistory = session.messageHistory || [];
    session.messageHistory.push(userMessage);

    // Prepare for agent processing
    const processingContext = {
      messageId: userMessage.id,
      userTier: userTier || session.user.subscription_tier || 'free',
      conversationHistory: session.messageHistory,
      userPreferences: session.user.betting_preferences || {},
      sessionContext: {
        toolsUsed: Array.from(session.activeTools || []),
        conversationLength: session.messageHistory.length
      }
    };

    return {
      type: 'user_message_processed',
      messageId: userMessage.id,
      processingContext,
      userMessage
    };
  }

  async handleToolInteraction(session, message, callbacks) {
    const { toolName, action, data, interactionId } = message;
    
    // Validate tool interaction
    if (!toolName || !action) {
      throw new Error('Tool name and action are required');
    }

    // Log tool interaction
    logger.info(`Tool interaction: ${toolName}.${action} for session ${session.id}`, {
      toolName,
      action,
      interactionId,
      dataKeys: data ? Object.keys(data) : []
    });

    // Prepare interaction context
    const interactionContext = {
      sessionId: session.id,
      userId: session.userId,
      toolName,
      action,
      data: data || {},
      timestamp: new Date(),
      interactionId: interactionId || Date.now().toString()
    };

    return {
      type: 'tool_interaction_processed',
      interactionContext
    };
  }

  async handleAgentInterrupt(session, message, callbacks) {
    const { reason, force } = message;
    
    logger.info(`Agent interrupt requested for session ${session.id}:`, {
      reason: reason || 'user_requested',
      force: force || false
    });

    // Clear active tools if force interrupt
    if (force && session.activeTools) {
      session.activeTools.clear();
    }

    return {
      type: 'agent_interrupt_processed',
      reason: reason || 'user_requested',
      timestamp: new Date()
    };
  }

  async handlePing(session, message, callbacks) {
    // Simple ping/pong for connection health check
    return {
      type: 'pong',
      timestamp: new Date(),
      sessionUptime: Date.now() - session.createdAt.getTime()
    };
  }

  async handleGetStatus(session, message, callbacks) {
    // Return current session status
    const activeTools = Array.from(session.activeTools || []);
    const messageCount = (session.messageHistory || []).length;
    
    return {
      type: 'session_status',
      status: {
        sessionId: session.id,
        userId: session.userId,
        isActive: session.agentState !== 'idle',
        agentState: session.agentState || 'idle',
        activeTools,
        messageCount,
        lastActivity: session.lastActivity,
        uptime: Date.now() - session.createdAt.getTime(),
        subscription: {
          tier: session.user.subscription_tier,
          hasActive: session.user.hasActiveSubscription
        }
      }
    };
  }

  async handleGetHistory(session, message, callbacks) {
    const { limit, offset, messageTypes } = message;
    
    const history = session.messageHistory || [];
    let filteredHistory = history;

    // Filter by message types if specified
    if (messageTypes && Array.isArray(messageTypes)) {
      filteredHistory = history.filter(msg => messageTypes.includes(msg.role));
    }

    // Apply pagination
    const startIndex = offset || 0;
    const endIndex = startIndex + (limit || 50);
    const paginatedHistory = filteredHistory.slice(startIndex, endIndex);

    return {
      type: 'conversation_history',
      history: paginatedHistory,
      pagination: {
        total: filteredHistory.length,
        offset: startIndex,
        limit: limit || 50,
        hasMore: endIndex < filteredHistory.length
      }
    };
  }

  async handleClearConversation(session, message, callbacks) {
    const { confirmationToken } = message;
    
    // Require confirmation for destructive action
    if (!confirmationToken || confirmationToken !== 'CLEAR_CONFIRMED') {
      return {
        type: 'confirmation_required',
        message: 'Conversation clearing requires confirmation',
        requiredToken: 'CLEAR_CONFIRMED'
      };
    }

    const clearedCount = (session.messageHistory || []).length;
    
    // Clear conversation history
    session.messageHistory = [];
    session.activeTools = session.activeTools || new Set();
    session.activeTools.clear();

    logger.info(`Conversation cleared for session ${session.id}: ${clearedCount} messages removed`);

    return {
      type: 'conversation_cleared',
      clearedMessageCount: clearedCount,
      timestamp: new Date()
    };
  }

  // Validate message structure
  validateMessage(message) {
    if (!message || typeof message !== 'object') {
      throw new Error('Message must be an object');
    }

    if (!message.type || typeof message.type !== 'string') {
      throw new Error('Message type is required and must be a string');
    }

    return true;
  }

  // Sanitize message content for security
  sanitizeMessage(message) {
    const sanitized = { ...message };

    // Remove potentially dangerous fields
    delete sanitized.__proto__;
    delete sanitized.constructor;

    // Sanitize string content
    if (sanitized.content && typeof sanitized.content === 'string') {
      sanitized.content = sanitized.content
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove scripts
        .replace(/javascript:/gi, '') // Remove javascript: links
        .replace(/on\w+\s*=/gi, ''); // Remove event handlers
    }

    return sanitized;
  }

  // Format message for logging (remove sensitive data)
  formatForLogging(message) {
    const loggable = { ...message };
    
    // Remove sensitive fields
    delete loggable.apiKey;
    delete loggable.password;
    delete loggable.token;
    delete loggable.credentials;

    // Truncate long content
    if (loggable.content && loggable.content.length > 500) {
      loggable.content = loggable.content.substring(0, 500) + '... (truncated)';
    }

    return loggable;
  }

  // Get message handler statistics
  getStats() {
    return {
      registeredHandlers: Array.from(this.messageTypes.keys()),
      handlerCount: this.messageTypes.size
    };
  }

  // Register custom message handler
  registerHandler(messageType, handler) {
    if (typeof handler !== 'function') {
      throw new Error('Handler must be a function');
    }

    this.messageTypes.set(messageType, handler);
    logger.info(`Custom message handler registered: ${messageType}`);
  }

  // Unregister message handler
  unregisterHandler(messageType) {
    const removed = this.messageTypes.delete(messageType);
    if (removed) {
      logger.info(`Message handler unregistered: ${messageType}`);
    }
    return removed;
  }
}

module.exports = { MessageHandler };
