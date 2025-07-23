const fs = require('fs').promises;
const path = require('path');
const { getDb } = require('./tools');
const { noiseFilter } = require('./noise-filter');

/**
 * Learning System for Beverage POS
 * Captures user interactions, voice commands, intent processing, and system responses
 * for model fine-tuning and system improvement
 */
class LearningSystem {
  constructor() {
    this.logDir = path.join(process.cwd(), 'data', 'learning-logs');
    this.sessionData = new Map(); // Store session-level data
    this.ensureLogDirectory();
  }

  async ensureLogDirectory() {
    try {
      await fs.mkdir(this.logDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create learning logs directory:', error);
    }
  }

  /**
   * Log user interaction with complete context and intelligent noise filtering
   */
  async logInteraction(data) {
    // Use noise filter to check if this is a low-value interaction
    if (noiseFilter.isLowValueInteraction(data.interactionType)) {
      return;
    }
    
    // Check quality score
    const qualityScore = noiseFilter.getInteractionQuality(data);
    if (qualityScore < 25) {
      return; // Skip very low-quality interactions
    }
    
    // Handle cart activity with special filtering
    if (data.interactionType === 'cart_activity') {
      if (!noiseFilter.shouldLogCartActivity(data)) {
        return;
      }
    }
    
    // General event filtering for rapid fire
    if (!noiseFilter.shouldLogEvent(data.interactionType, data.sessionId)) {
      return;
    }
    
    const timestamp = new Date().toISOString();
    const sessionId = data.sessionId || 'unknown';
    
    const interactionLog = {
      timestamp,
      sessionId,
      type: 'interaction',
      qualityScore,
      ...data,
      // Add system context
      systemContext: await this.getSystemContext(),
      // Add session context
      sessionContext: this.sessionData.get(sessionId) || {}
    };

    await this.writeLog('interactions', interactionLog);
    this.updateSessionData(sessionId, data);
  }

  /**
   * Log voice command processing with full pipeline
   */
  async logVoiceCommand(data) {
    const timestamp = new Date().toISOString();
    
    const voiceLog = {
      timestamp,
      type: 'voice_command',
      ...data,
      // Speech recognition quality metrics
      recognitionMetrics: {
        confidence: data.confidence || null,
        alternatives: data.alternatives || [],
        processingTime: data.processingTime || null
      }
    };

    await this.writeLog('voice-commands', voiceLog);
  }

  /**
   * Log intent processing and NLU results
   */
  async logIntentProcessing(data) {
    const timestamp = new Date().toISOString();
    
    const intentLog = {
      timestamp,
      type: 'intent_processing',
      ...data,
      // NLU performance metrics
      nluMetrics: {
        confidence: data.nluResult?.score || null,
        intent: data.nluResult?.intent || null,
        entities: data.nluResult?.entities || [],
        processingTime: data.processingTime || null,
        alternatives: data.nluResult?.classifications || []
      }
    };

    await this.writeLog('intent-processing', intentLog);
  }

  /**
   * Log tool invocation and results with intelligent noise filtering
   */
  async logToolInvocation(data) {
    // Use noise filter to determine if we should log this tool call
    if (noiseFilter.isNoisyTool(data.toolName)) {
      if (data.toolName === 'health_check') {
        if (!noiseFilter.shouldLogHealthCheck(data)) {
          return; // Skip logging this health check
        }
      } else {
        // For other noisy tools, only log if there's an error
        if (!data.error && data.success !== false) {
          return;
        }
      }
    }
    
    // Check quality score
    const qualityScore = noiseFilter.getInteractionQuality(data);
    if (qualityScore < 30) {
      return; // Skip low-quality interactions
    }
    
    // Skip logging for rapid repeated calls of the same tool
    if (!noiseFilter.shouldLogEvent(`tool_${data.toolName}`, data.sessionId)) {
      return;
    }
    
    const timestamp = new Date().toISOString();
    
    const toolLog = {
      timestamp,
      type: 'tool_invocation',
      qualityScore,
      ...data,
      // Tool performance metrics
      toolMetrics: {
        executionTime: data.executionTime || null,
        success: data.success || false,
        errorType: data.error?.type || null,
        errorMessage: data.error?.message || null
      }
    };

    await this.writeLog('tool-invocations', toolLog);
  }

  /**
   * Log drink name mapping and fuzzy matching results
   */
  async logDrinkMapping(data) {
    const timestamp = new Date().toISOString();
    
    const mappingLog = {
      timestamp,
      type: 'drink_mapping',
      ...data,
      // Mapping performance metrics
      mappingMetrics: {
        inputName: data.inputName,
        mappedName: data.mappedName,
        mappingMethod: data.mappingMethod, // 'exact', 'alias', 'fuzzy', 'failed'
        confidence: data.confidence || null,
        alternatives: data.alternatives || [],
        fuzzyScore: data.fuzzyScore || null
      }
    };

    await this.writeLog('drink-mappings', mappingLog);
  }

  /**
   * Log order processing with complete context
   */
  async logOrderProcessing(data) {
    const timestamp = new Date().toISOString();
    
    const orderLog = {
      timestamp,
      type: 'order_processing',
      ...data,
      // Order analytics
      orderAnalytics: {
        totalItems: data.items?.length || 0,
        totalValue: data.total || 0,
        averageItemPrice: data.items?.length ? (data.total / data.items.length) : 0,
        drinkCategories: this.analyzeDrinkCategories(data.items),
        processingSteps: data.processingSteps || []
      }
    };

    await this.writeLog('order-processing', orderLog);
  }

  /**
   * Log conversation flows and dialog management
   */
  async logConversationFlow(data) {
    const timestamp = new Date().toISOString();
    
    const conversationLog = {
      timestamp,
      type: 'conversation_flow',
      ...data,
      // Conversation analytics
      conversationMetrics: {
        turnNumber: data.turnNumber || 1,
        dialogState: data.dialogState || 'unknown',
        contextMaintained: data.contextMaintained || false,
        clarificationNeeded: data.clarificationNeeded || false,
        userSatisfaction: data.userSatisfaction || null
      }
    };

    await this.writeLog('conversation-flows', conversationLog);
  }

  /**
   * Log errors and failures for learning
   */
  async logError(data) {
    const timestamp = new Date().toISOString();
    
    const errorLog = {
      timestamp,
      type: 'error',
      ...data,
      // Error analytics
      errorAnalytics: {
        errorType: data.error?.name || 'Unknown',
        errorMessage: data.error?.message || '',
        stackTrace: data.error?.stack || '',
        recoveryAction: data.recoveryAction || null,
        userImpact: data.userImpact || 'unknown',
        context: data.context || {}
      }
    };

    await this.writeLog('errors', errorLog);
  }

  /**
   * Log inventory operations and predictions
   */
  async logInventoryOperation(data) {
    const timestamp = new Date().toISOString();
    
    const inventoryLog = {
      timestamp,
      type: 'inventory_operation',
      ...data,
      // Inventory analytics
      inventoryMetrics: {
        operation: data.operation, // 'check', 'update', 'add', 'consume'
        drinkName: data.drinkName,
        beforeAmount: data.beforeAmount || null,
        afterAmount: data.afterAmount || null,
        changeAmount: data.changeAmount || null,
        lowStockAlert: data.lowStockAlert || false,
        predictionAccuracy: data.predictionAccuracy || null
      }
    };

    await this.writeLog('inventory-operations', inventoryLog);
  }

  /**
   * Get current system context for logging
   */
  async getSystemContext() {
    try {
      const db = getDb();
      
      // Get current inventory levels
      const inventoryStatus = db.prepare(`
        SELECT 
          COUNT(*) as total_drinks,
          COUNT(CASE WHEN inventory_oz < 10 THEN 1 END) as low_stock_drinks,
          AVG(inventory_oz) as avg_inventory
        FROM drinks 
        WHERE inventory_oz IS NOT NULL
      `).get();

      // Get recent order activity
      const recentOrders = db.prepare(`
        SELECT COUNT(*) as recent_orders 
        FROM orders 
        WHERE created_at > datetime('now', '-1 hour')
      `).get();

      return {
        venue: {
          name: 'Knotting Hill Place Estate',
          location: 'Little Elm, TX (North Dallas)',
          type: 'Premier luxury wedding and events venue',
          capacity: '50-300 seated guests, up to 400 cocktail-style',
          bars: ['Manor Bar', 'Veranda Bar', 'Hidden Cellar Bar'],
          specialties: ['Lavender Hill Spritz', 'Veranda Peach Mule'],
          sisterProperty: 'Brighton Abbey (Celina, TX)',
          established: '2015 (renovated 2022)',
          acreage: '15 gated acres'
        },
        inventoryStatus,
        recentActivity: recentOrders,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return { 
        venue: {
          name: 'Knotting Hill Place Estate',
          location: 'Little Elm, TX (North Dallas)',
          type: 'Premier luxury wedding and events venue'
        },
        error: error.message 
      };
    }
  }

  /**
   * Update session-level data for context
   */
  updateSessionData(sessionId, data) {
    if (!this.sessionData.has(sessionId)) {
      this.sessionData.set(sessionId, {
        startTime: new Date().toISOString(),
        interactions: 0,
        successfulOrders: 0,
        errors: 0,
        drinkMappings: []
      });
    }

    const session = this.sessionData.get(sessionId);
    session.interactions++;
    session.lastActivity = new Date().toISOString();

    if (data.type === 'order_success') {
      session.successfulOrders++;
    } else if (data.type === 'error') {
      session.errors++;
    } else if (data.type === 'drink_mapping') {
      session.drinkMappings.push(data.mappedName);
    }

    this.sessionData.set(sessionId, session);
  }

  /**
   * Analyze drink categories in orders
   */
  analyzeDrinkCategories(items) {
    if (!items) return {};
    
    const categories = {};
    items.forEach(item => {
      const category = item.category || 'unknown';
      categories[category] = (categories[category] || 0) + item.quantity;
    });
    
    return categories;
  }

  /**
   * Write log entry to file
   */
  async writeLog(logType, logData) {
    try {
      const filename = `${logType}-${new Date().toISOString().split('T')[0]}.jsonl`;
      const filepath = path.join(this.logDir, filename);
      const logLine = JSON.stringify(logData) + '\n';
      
      await fs.appendFile(filepath, logLine);
    } catch (error) {
      console.error(`Failed to write ${logType} log:`, error);
    }
  }

  /**
   * Export training data in various formats
   */
  async exportTrainingData(options = {}) {
    const {
      startDate = null,
      endDate = null,
      format = 'jsonl', // 'jsonl', 'json', 'csv'
      includeTypes = ['all']
    } = options;

    try {
      const logs = await this.readLogs(startDate, endDate, includeTypes);
      
      switch (format) {
        case 'jsonl':
          return this.formatAsJsonl(logs);
        case 'json':
          return this.formatAsJson(logs);
        case 'csv':
          return this.formatAsCsv(logs);
        default:
          throw new Error(`Unsupported export format: ${format}`);
      }
    } catch (error) {
      console.error('Failed to export training data:', error);
      throw error;
    }
  }

  /**
   * Read logs from files based on criteria
   */
  async readLogs(startDate, endDate, includeTypes) {
    const logs = [];
    
    try {
      const files = await fs.readdir(this.logDir);
      
      for (const file of files) {
        if (!file.endsWith('.jsonl')) continue;
        
        const filepath = path.join(this.logDir, file);
        const content = await fs.readFile(filepath, 'utf8');
        
        content.split('\n').forEach(line => {
          if (line.trim()) {
            try {
              const logEntry = JSON.parse(line);
              
              // Filter by date range
              if (startDate && new Date(logEntry.timestamp) < new Date(startDate)) return;
              if (endDate && new Date(logEntry.timestamp) > new Date(endDate)) return;
              
              // Filter by type
              if (!includeTypes.includes('all') && !includeTypes.includes(logEntry.type)) return;
              
              logs.push(logEntry);
            } catch (parseError) {
              console.warn('Failed to parse log line:', parseError);
            }
          }
        });
      }
    } catch (error) {
      console.error('Failed to read logs:', error);
    }
    
    return logs.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  }

  /**
   * Format logs for different training purposes
   */
  formatAsJsonl(logs) {
    return logs.map(log => JSON.stringify(log)).join('\n');
  }

  formatAsJson(logs) {
    return JSON.stringify(logs, null, 2);
  }

  formatAsCsv(logs) {
    if (logs.length === 0) return '';
    
    const headers = new Set();
    logs.forEach(log => {
      this.flattenObject(log).forEach((value, key) => headers.add(key));
    });
    
    const csvHeaders = Array.from(headers).join(',');
    const csvRows = logs.map(log => {
      const flatLog = this.flattenObject(log);
      return Array.from(headers).map(header => {
        const value = flatLog.get(header) || '';
        return `"${String(value).replace(/"/g, '""')}"`;
      }).join(',');
    });
    
    return [csvHeaders, ...csvRows].join('\n');
  }

  /**
   * Flatten nested objects for CSV export
   */
  flattenObject(obj, prefix = '') {
    const flattened = new Map();
    
    Object.entries(obj).forEach(([key, value]) => {
      const newKey = prefix ? `${prefix}.${key}` : key;
      
      if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        const nested = this.flattenObject(value, newKey);
        nested.forEach((nestedValue, nestedKey) => {
          flattened.set(nestedKey, nestedValue);
        });
      } else {
        flattened.set(newKey, Array.isArray(value) ? JSON.stringify(value) : value);
      }
    });
    
    return flattened;
  }

  /**
   * Generate insights and analytics from collected data
   */
  async generateInsights(options = {}) {
    const logs = await this.readLogs(options.startDate, options.endDate, ['all']);
    
    const insights = {
      overview: this.generateOverviewInsights(logs),
      voiceRecognition: this.generateVoiceInsights(logs),
      intentProcessing: this.generateIntentInsights(logs),
      drinkMapping: this.generateMappingInsights(logs),
      orderProcessing: this.generateOrderInsights(logs),
      errors: this.generateErrorInsights(logs),
      recommendations: this.generateRecommendations(logs)
    };
    
    return insights;
  }

  generateOverviewInsights(logs) {
    const totalInteractions = logs.length;
    const successfulInteractions = logs.filter(log => log.success !== false).length;
    const errorRate = ((totalInteractions - successfulInteractions) / totalInteractions * 100).toFixed(2);
    
    return {
      totalInteractions,
      successfulInteractions,
      errorRate: `${errorRate}%`,
      timeRange: {
        start: logs[0]?.timestamp,
        end: logs[logs.length - 1]?.timestamp
      }
    };
  }

  generateVoiceInsights(logs) {
    const voiceLogs = logs.filter(log => log.type === 'voice_command');
    
    const avgConfidence = voiceLogs.reduce((sum, log) => 
      sum + (log.recognitionMetrics?.confidence || 0), 0) / voiceLogs.length;
    
    return {
      totalVoiceCommands: voiceLogs.length,
      averageConfidence: avgConfidence?.toFixed(2),
      lowConfidenceCommands: voiceLogs.filter(log => 
        (log.recognitionMetrics?.confidence || 0) < 0.7).length
    };
  }

  generateIntentInsights(logs) {
    const intentLogs = logs.filter(log => log.type === 'intent_processing');
    
    const intentDistribution = {};
    intentLogs.forEach(log => {
      const intent = log.nluMetrics?.intent || 'unknown';
      intentDistribution[intent] = (intentDistribution[intent] || 0) + 1;
    });
    
    return {
      totalIntentProcessing: intentLogs.length,
      intentDistribution,
      averageNluConfidence: (intentLogs.reduce((sum, log) => 
        sum + (log.nluMetrics?.confidence || 0), 0) / intentLogs.length)?.toFixed(2)
    };
  }

  generateMappingInsights(logs) {
    const mappingLogs = logs.filter(log => log.type === 'drink_mapping');
    
    const mappingMethods = {};
    mappingLogs.forEach(log => {
      const method = log.mappingMetrics?.mappingMethod || 'unknown';
      mappingMethods[method] = (mappingMethods[method] || 0) + 1;
    });
    
    return {
      totalMappings: mappingLogs.length,
      mappingMethodDistribution: mappingMethods,
      failedMappings: mappingLogs.filter(log => 
        log.mappingMetrics?.mappingMethod === 'failed').length
    };
  }

  generateOrderInsights(logs) {
    const orderLogs = logs.filter(log => log.type === 'order_processing');
    
    const totalRevenue = orderLogs.reduce((sum, log) => 
      sum + (log.orderAnalytics?.totalValue || 0), 0);
    
    return {
      totalOrders: orderLogs.length,
      totalRevenue: totalRevenue.toFixed(2),
      averageOrderValue: (totalRevenue / orderLogs.length).toFixed(2)
    };
  }

  generateErrorInsights(logs) {
    const errorLogs = logs.filter(log => log.type === 'error');
    
    const errorTypes = {};
    errorLogs.forEach(log => {
      const errorType = log.errorAnalytics?.errorType || 'Unknown';
      errorTypes[errorType] = (errorTypes[errorType] || 0) + 1;
    });
    
    return {
      totalErrors: errorLogs.length,
      errorTypeDistribution: errorTypes,
      mostCommonError: Object.entries(errorTypes).sort((a, b) => b[1] - a[1])[0]?.[0]
    };
  }

  generateRecommendations(logs) {
    const recommendations = [];
    
    // Add recommendations based on analysis
    const voiceLogs = logs.filter(log => log.type === 'voice_command');
    const lowConfidenceRate = voiceLogs.filter(log => 
      (log.recognitionMetrics?.confidence || 0) < 0.7).length / voiceLogs.length;
    
    if (lowConfidenceRate > 0.3) {
      recommendations.push({
        type: 'voice_recognition',
        priority: 'high',
        message: 'Consider improving voice recognition model or microphone setup',
        metric: `${(lowConfidenceRate * 100).toFixed(1)}% low confidence commands`
      });
    }
    
    return recommendations;
  }
}

// Create singleton instance
const learningSystem = new LearningSystem();

module.exports = { LearningSystem, learningSystem };
