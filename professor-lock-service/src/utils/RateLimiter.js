const logger = require('./logger');

class RateLimiter {
  constructor() {
    this.connectionLimits = new Map(); // userId -> connection count
    this.messageLimits = new Map(); // userId -> { count, resetTime }
    this.maxConnectionsPerUser = parseInt(process.env.MAX_CONNECTIONS_PER_USER) || 3;
    this.messageRateLimit = parseInt(process.env.MESSAGE_RATE_LIMIT) || 10;
    this.rateLimitWindow = parseInt(process.env.RATE_LIMIT_WINDOW) || 60000; // 1 minute
    
    // Cleanup expired entries every 5 minutes
    setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  checkConnectionLimit(userId) {
    const currentConnections = this.connectionLimits.get(userId) || 0;
    
    if (currentConnections >= this.maxConnectionsPerUser) {
      logger.warn(`Connection limit exceeded for user ${userId}: ${currentConnections}/${this.maxConnectionsPerUser}`);
      return false;
    }
    
    this.connectionLimits.set(userId, currentConnections + 1);
    logger.debug(`User ${userId} connection count: ${currentConnections + 1}/${this.maxConnectionsPerUser}`);
    return true;
  }

  releaseConnection(userId) {
    const currentConnections = this.connectionLimits.get(userId) || 0;
    if (currentConnections > 0) {
      this.connectionLimits.set(userId, currentConnections - 1);
      logger.debug(`User ${userId} connection released: ${currentConnections - 1}/${this.maxConnectionsPerUser}`);
    }
    
    // Remove entry if no connections
    if (currentConnections <= 1) {
      this.connectionLimits.delete(userId);
    }
  }

  checkMessageRate(userId) {
    const now = Date.now();
    const userLimit = this.messageLimits.get(userId);
    
    // First message or window expired
    if (!userLimit || now > userLimit.resetTime) {
      this.messageLimits.set(userId, {
        count: 1,
        resetTime: now + this.rateLimitWindow
      });
      return true;
    }
    
    // Check if within limit
    if (userLimit.count >= this.messageRateLimit) {
      logger.warn(`Message rate limit exceeded for user ${userId}: ${userLimit.count}/${this.messageRateLimit}`);
      return false;
    }
    
    // Increment count
    userLimit.count++;
    logger.debug(`User ${userId} message rate: ${userLimit.count}/${this.messageRateLimit}`);
    return true;
  }

  getRemainingMessages(userId) {
    const userLimit = this.messageLimits.get(userId);
    if (!userLimit || Date.now() > userLimit.resetTime) {
      return this.messageRateLimit;
    }
    return Math.max(0, this.messageRateLimit - userLimit.count);
  }

  getResetTime(userId) {
    const userLimit = this.messageLimits.get(userId);
    if (!userLimit || Date.now() > userLimit.resetTime) {
      return null;
    }
    return new Date(userLimit.resetTime);
  }

  // Advanced rate limiting for different subscription tiers
  checkTieredMessageRate(userId, subscriptionTier) {
    const tierLimits = {
      'free': { messages: 5, window: 60000 }, // 5 messages per minute
      'pro': { messages: 20, window: 60000 }, // 20 messages per minute  
      'premium': { messages: 50, window: 60000 } // 50 messages per minute
    };

    const limits = tierLimits[subscriptionTier] || tierLimits['free'];
    const now = Date.now();
    const userLimit = this.messageLimits.get(`${userId}_tiered`);
    
    // First message or window expired
    if (!userLimit || now > userLimit.resetTime) {
      this.messageLimits.set(`${userId}_tiered`, {
        count: 1,
        resetTime: now + limits.window,
        tier: subscriptionTier
      });
      return true;
    }
    
    // Check if within limit
    if (userLimit.count >= limits.messages) {
      logger.warn(`Tiered rate limit exceeded for ${subscriptionTier} user ${userId}: ${userLimit.count}/${limits.messages}`);
      return false;
    }
    
    // Increment count
    userLimit.count++;
    return true;
  }

  // Tool-specific rate limiting
  checkToolRate(userId, toolName, subscriptionTier = 'free') {
    const toolLimits = {
      'browser_use': { 
        free: { uses: 3, window: 300000 }, // 3 uses per 5 minutes
        pro: { uses: 15, window: 300000 },
        premium: { uses: 50, window: 300000 }
      },
      'statmuse_query': {
        free: { uses: 5, window: 60000 }, // 5 queries per minute
        pro: { uses: 30, window: 60000 },
        premium: { uses: 100, window: 60000 }
      },
      'web_search': {
        free: { uses: 10, window: 300000 }, // 10 searches per 5 minutes
        pro: { uses: 50, window: 300000 },
        premium: { uses: 200, window: 300000 }
      },
      'python_execute': {
        free: { uses: 2, window: 300000 }, // 2 executions per 5 minutes
        pro: { uses: 10, window: 300000 },
        premium: { uses: 25, window: 300000 }
      }
    };

    const toolLimit = toolLimits[toolName];
    if (!toolLimit) {
      return true; // Allow if no specific limit defined
    }

    const limits = toolLimit[subscriptionTier] || toolLimit['free'];
    const now = Date.now();
    const key = `${userId}_${toolName}`;
    const userToolLimit = this.messageLimits.get(key);
    
    // First use or window expired
    if (!userToolLimit || now > userToolLimit.resetTime) {
      this.messageLimits.set(key, {
        count: 1,
        resetTime: now + limits.window,
        tool: toolName,
        tier: subscriptionTier
      });
      return true;
    }
    
    // Check if within limit
    if (userToolLimit.count >= limits.uses) {
      logger.warn(`Tool rate limit exceeded for ${toolName} by ${subscriptionTier} user ${userId}: ${userToolLimit.count}/${limits.uses}`);
      return false;
    }
    
    // Increment count
    userToolLimit.count++;
    return true;
  }

  // Burst protection for rapid requests
  checkBurstLimit(userId, maxBurst = 5, burstWindow = 10000) {
    const now = Date.now();
    const key = `${userId}_burst`;
    const burstData = this.messageLimits.get(key) || { timestamps: [] };
    
    // Remove old timestamps outside the burst window
    burstData.timestamps = burstData.timestamps.filter(
      timestamp => now - timestamp < burstWindow
    );
    
    // Check if burst limit exceeded
    if (burstData.timestamps.length >= maxBurst) {
      logger.warn(`Burst limit exceeded for user ${userId}: ${burstData.timestamps.length}/${maxBurst} in ${burstWindow}ms`);
      return false;
    }
    
    // Add current timestamp
    burstData.timestamps.push(now);
    this.messageLimits.set(key, burstData);
    
    return true;
  }

  // Get comprehensive rate limit status for a user
  getRateLimitStatus(userId, subscriptionTier) {
    const now = Date.now();
    
    const status = {
      connections: {
        current: this.connectionLimits.get(userId) || 0,
        max: this.maxConnectionsPerUser
      },
      messages: {
        remaining: this.getRemainingMessages(userId),
        resetTime: this.getResetTime(userId)
      },
      tools: {}
    };

    // Check tool-specific limits
    const toolNames = ['browser_use', 'statmuse_query', 'web_search', 'python_execute'];
    toolNames.forEach(toolName => {
      const key = `${userId}_${toolName}`;
      const toolLimit = this.messageLimits.get(key);
      
      if (toolLimit && now <= toolLimit.resetTime) {
        status.tools[toolName] = {
          used: toolLimit.count,
          resetTime: new Date(toolLimit.resetTime)
        };
      }
    });

    return status;
  }

  cleanup() {
    const now = Date.now();
    let cleanedCount = 0;
    
    // Clean expired message limits
    for (const [key, limit] of this.messageLimits.entries()) {
      if (now > limit.resetTime) {
        this.messageLimits.delete(key);
        cleanedCount++;
      }
    }
    
    if (cleanedCount > 0) {
      logger.debug(`Rate limiter cleanup: removed ${cleanedCount} expired entries`);
    }
  }

  // Reset limits for a specific user (admin function)
  resetUserLimits(userId) {
    const keysToDelete = [];
    
    for (const key of this.messageLimits.keys()) {
      if (key.startsWith(userId)) {
        keysToDelete.push(key);
      }
    }
    
    keysToDelete.forEach(key => this.messageLimits.delete(key));
    this.connectionLimits.delete(userId);
    
    logger.info(`Reset rate limits for user ${userId}`);
  }

  // Get overall system stats
  getStats() {
    return {
      totalConnections: Array.from(this.connectionLimits.values()).reduce((a, b) => a + b, 0),
      uniqueUsers: this.connectionLimits.size,
      activeRateLimits: this.messageLimits.size,
      limits: {
        maxConnectionsPerUser: this.maxConnectionsPerUser,
        messageRateLimit: this.messageRateLimit,
        rateLimitWindow: this.rateLimitWindow
      }
    };
  }
}

module.exports = { RateLimiter };
