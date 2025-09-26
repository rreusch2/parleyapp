const logger = require('../utils/logger');

class ToolManager {
  constructor() {
    this.availableTools = new Map();
    this.toolSessions = new Map(); // sessionId -> Set of active tools
    this.initializeTools();
  }

  initializeTools() {
    // Define available tools and their configurations
    const tools = [
      {
        name: 'browser_use',
        displayName: 'Browser Control',
        description: 'Automated web browsing with live screenshots',
        enabled: process.env.ENABLE_BROWSER_TOOL === 'true',
        capabilities: [
          'Navigate to websites',
          'Click elements and fill forms', 
          'Take live screenshots',
          'Extract page content',
          'Monitor page changes'
        ],
        icon: 'Globe',
        color: 'blue'
      },
      {
        name: 'statmuse_query',
        displayName: 'StatMuse Sports Data',
        description: 'Real-time sports statistics and analysis',
        enabled: process.env.ENABLE_STATMUSE_TOOL === 'true',
        capabilities: [
          'Historical player stats',
          'Team performance data',
          'Betting trend analysis',
          'Head-to-head comparisons',
          'Season averages and splits'
        ],
        icon: 'BarChart3',
        color: 'green'
      },
      {
        name: 'web_search',
        displayName: 'Web Search',
        description: 'Intelligent web search for current information',
        enabled: process.env.ENABLE_WEB_SEARCH_TOOL === 'true',
        capabilities: [
          'News and injury reports',
          'Line movement tracking',
          'Expert predictions',
          'Weather conditions',
          'Roster updates'
        ],
        icon: 'Search',
        color: 'purple'
      },
      {
        name: 'python_execute',
        displayName: 'Data Analysis',
        description: 'Advanced statistical calculations and visualization',
        enabled: process.env.ENABLE_PYTHON_TOOL === 'true',
        capabilities: [
          'Statistical modeling',
          'Data visualization',
          'Probability calculations',
          'Trend analysis',
          'Performance backtesting'
        ],
        icon: 'Cpu',
        color: 'orange'
      },
      {
        name: 'supabase_query',
        displayName: 'Database Query',
        description: 'Access ParleyApp historical data and predictions',
        enabled: true,
        capabilities: [
          'Historical betting data',
          'User preferences',
          'Past predictions',
          'Performance analytics',
          'Trend identification'
        ],
        icon: 'Database',
        color: 'cyan'
      }
    ];

    tools.forEach(tool => {
      if (tool.enabled) {
        this.availableTools.set(tool.name, tool);
        logger.info(`Tool registered: ${tool.displayName}`);
      }
    });

    logger.info(`ToolManager initialized with ${this.availableTools.size} tools`);
  }

  getAvailableTools() {
    return Array.from(this.availableTools.values());
  }

  getToolConfig(toolName) {
    return this.availableTools.get(toolName);
  }

  isToolEnabled(toolName) {
    return this.availableTools.has(toolName);
  }

  initializeSession(sessionId) {
    this.toolSessions.set(sessionId, new Set());
    logger.debug(`Tool session initialized: ${sessionId}`);
  }

  startTool(sessionId, toolName, parameters = {}) {
    if (!this.isToolEnabled(toolName)) {
      throw new Error(`Tool ${toolName} is not available`);
    }

    const sessionTools = this.toolSessions.get(sessionId);
    if (!sessionTools) {
      throw new Error(`Session ${sessionId} not found`);
    }

    sessionTools.add(toolName);
    logger.debug(`Tool ${toolName} started for session ${sessionId}`);

    return {
      name: toolName,
      status: 'running',
      parameters,
      startTime: new Date(),
      config: this.getToolConfig(toolName)
    };
  }

  updateTool(sessionId, toolName, update) {
    const sessionTools = this.toolSessions.get(sessionId);
    if (!sessionTools || !sessionTools.has(toolName)) {
      logger.warn(`Tool ${toolName} not active in session ${sessionId}`);
      return false;
    }

    logger.debug(`Tool ${toolName} updated for session ${sessionId}:`, update);
    return true;
  }

  completeTool(sessionId, toolName, result = {}) {
    const sessionTools = this.toolSessions.get(sessionId);
    if (!sessionTools) {
      logger.warn(`Session ${sessionId} not found when completing tool ${toolName}`);
      return false;
    }

    sessionTools.delete(toolName);
    logger.debug(`Tool ${toolName} completed for session ${sessionId}`);

    return {
      name: toolName,
      status: 'completed',
      result,
      endTime: new Date(),
      config: this.getToolConfig(toolName)
    };
  }

  errorTool(sessionId, toolName, error) {
    const sessionTools = this.toolSessions.get(sessionId);
    if (sessionTools) {
      sessionTools.delete(toolName);
    }

    logger.error(`Tool ${toolName} error in session ${sessionId}:`, error);

    return {
      name: toolName,
      status: 'error',
      error: error.message || error,
      endTime: new Date(),
      config: this.getToolConfig(toolName)
    };
  }

  getActiveTools(sessionId) {
    const sessionTools = this.toolSessions.get(sessionId);
    return sessionTools ? Array.from(sessionTools) : [];
  }

  async handleInteraction(sessionId, toolName, action, data) {
    if (!this.isToolEnabled(toolName)) {
      throw new Error(`Tool ${toolName} is not available`);
    }

    const toolConfig = this.getToolConfig(toolName);
    
    switch (toolName) {
      case 'browser_use':
        return await this.handleBrowserInteraction(sessionId, action, data);
      case 'statmuse_query':
        return await this.handleStatMuseInteraction(sessionId, action, data);
      case 'web_search':
        return await this.handleWebSearchInteraction(sessionId, action, data);
      case 'python_execute':
        return await this.handlePythonInteraction(sessionId, action, data);
      case 'supabase_query':
        return await this.handleSupabaseInteraction(sessionId, action, data);
      default:
        throw new Error(`No interaction handler for tool ${toolName}`);
    }
  }

  async handleBrowserInteraction(sessionId, action, data) {
    // Handle browser tool interactions
    switch (action) {
      case 'get_screenshot':
        return { 
          type: 'screenshot_requested',
          message: 'Taking fresh screenshot...',
          timestamp: new Date()
        };
      case 'navigate':
        return {
          type: 'navigation_requested', 
          url: data.url,
          message: `Navigating to ${data.url}...`,
          timestamp: new Date()
        };
      case 'extract_content':
        return {
          type: 'extraction_requested',
          selector: data.selector,
          message: 'Extracting page content...',
          timestamp: new Date()
        };
      default:
        throw new Error(`Unknown browser action: ${action}`);
    }
  }

  async handleStatMuseInteraction(sessionId, action, data) {
    // Handle StatMuse tool interactions
    switch (action) {
      case 'query':
        return {
          type: 'query_submitted',
          query: data.query,
          sport: data.sport,
          message: `Querying StatMuse for: ${data.query}`,
          timestamp: new Date()
        };
      case 'get_trends':
        return {
          type: 'trends_requested',
          player: data.player,
          timeframe: data.timeframe,
          message: `Analyzing trends for ${data.player}`,
          timestamp: new Date()
        };
      default:
        throw new Error(`Unknown StatMuse action: ${action}`);
    }
  }

  async handleWebSearchInteraction(sessionId, action, data) {
    // Handle web search interactions
    switch (action) {
      case 'search':
        return {
          type: 'search_submitted',
          query: data.query,
          searchType: data.searchType || 'web',
          message: `Searching the web for: ${data.query}`,
          timestamp: new Date()
        };
      case 'refine_search':
        return {
          type: 'search_refined',
          originalQuery: data.originalQuery,
          refinedQuery: data.refinedQuery,
          message: `Refining search from "${data.originalQuery}" to "${data.refinedQuery}"`,
          timestamp: new Date()
        };
      default:
        throw new Error(`Unknown web search action: ${action}`);
    }
  }

  async handlePythonInteraction(sessionId, action, data) {
    // Handle Python execution interactions
    switch (action) {
      case 'execute':
        return {
          type: 'code_submitted',
          code: data.code,
          message: 'Executing Python analysis...',
          timestamp: new Date()
        };
      case 'get_variables':
        return {
          type: 'variables_requested',
          message: 'Retrieving current variables...',
          timestamp: new Date()
        };
      default:
        throw new Error(`Unknown Python action: ${action}`);
    }
  }

  async handleSupabaseInteraction(sessionId, action, data) {
    // Handle Supabase database interactions
    switch (action) {
      case 'query':
        return {
          type: 'database_query',
          table: data.table,
          filters: data.filters,
          message: `Querying ${data.table} table...`,
          timestamp: new Date()
        };
      case 'get_predictions':
        return {
          type: 'predictions_requested',
          userId: data.userId,
          limit: data.limit,
          message: 'Fetching recent predictions...',
          timestamp: new Date()
        };
      default:
        throw new Error(`Unknown Supabase action: ${action}`);
    }
  }

  cleanupSession(sessionId) {
    const sessionTools = this.toolSessions.get(sessionId);
    if (sessionTools) {
      logger.debug(`Cleaning up ${sessionTools.size} active tools for session ${sessionId}`);
      this.toolSessions.delete(sessionId);
    }
  }

  getToolUsageStats() {
    const stats = {
      totalSessions: this.toolSessions.size,
      activeTools: 0,
      toolBreakdown: {}
    };

    // Initialize tool breakdown
    this.availableTools.forEach((tool, name) => {
      stats.toolBreakdown[name] = 0;
    });

    // Count active tools
    this.toolSessions.forEach(sessionTools => {
      stats.activeTool += sessionTools.size;
      sessionTools.forEach(toolName => {
        if (stats.toolBreakdown[toolName] !== undefined) {
          stats.toolBreakdown[toolName]++;
        }
      });
    });

    return stats;
  }
}

module.exports = { ToolManager };
