const { learningSystem } = require('./learning-system');
const { processNlu } = require('./nlu');

/**
 * Enhanced NLU wrapper that captures learning data
 */
class EnhancedNLU {
  constructor() {
    this.conversationStates = new Map(); // Track conversation context per session
  }

  async processWithLearning(text, context = {}) {
    const startTime = Date.now();
    const sessionId = context.sessionId || context.clientId || 'default';
    
    try {
      // Get or initialize conversation state
      const conversationState = this.getConversationState(sessionId);
      conversationState.turnNumber++;
      
      // Log voice command if this came from speech
      if (context.fromVoice) {
        await learningSystem.logVoiceCommand({
          sessionId,
          originalText: text,
          confidence: context.speechConfidence || null,
          alternatives: context.speechAlternatives || [],
          recognitionSource: context.recognitionSource || 'unknown',
          processingTime: context.speechProcessingTime || null
        });
      }

      // Process with NLU
      const nluResult = await processNlu(text);
      const processingTime = Date.now() - startTime;

      // Enhanced intent processing with context
      const enhancedResult = {
        ...nluResult,
        sessionContext: {
          turnNumber: conversationState.turnNumber,
          lastIntent: conversationState.lastIntent,
          contextMaintained: this.checkContextContinuity(nluResult, conversationState),
          dialogState: this.determineDialogState(nluResult, conversationState)
        }
      };

      // Update conversation state
      conversationState.lastIntent = nluResult.intent;
      conversationState.lastEntities = nluResult.entities || [];
      conversationState.lastTimestamp = new Date().toISOString();

      // Log intent processing
      await learningSystem.logIntentProcessing({
        sessionId,
        inputText: text,
        nluResult: enhancedResult,
        processingTime,
        conversationContext: conversationState
      });

      // Log conversation flow
      await learningSystem.logConversationFlow({
        sessionId,
        turnNumber: conversationState.turnNumber,
        intent: nluResult.intent,
        confidence: nluResult.score,
        dialogState: enhancedResult.sessionContext.dialogState,
        contextMaintained: enhancedResult.sessionContext.contextMaintained,
        entities: nluResult.entities || [],
        clarificationNeeded: this.needsClarification(enhancedResult)
      });

      return enhancedResult;

    } catch (error) {
      await learningSystem.logError({
        sessionId,
        type: 'nlu_processing_error',
        error,
        inputText: text,
        context: context,
        userImpact: 'intent_processing_failure'
      });
      throw error;
    }
  }

  getConversationState(sessionId) {
    if (!this.conversationStates.has(sessionId)) {
      this.conversationStates.set(sessionId, {
        startTime: new Date().toISOString(),
        turnNumber: 0,
        lastIntent: null,
        lastEntities: [],
        lastTimestamp: null,
        currentCart: [],
        preferences: {}
      });
    }
    return this.conversationStates.get(sessionId);
  }

  checkContextContinuity(nluResult, conversationState) {
    // Check if current intent relates to previous conversation
    const currentIntent = nluResult.intent;
    const lastIntent = conversationState.lastIntent;
    
    if (!lastIntent) return false;
    
    // Define intent relationships
    const intentRelationships = {
      'order.drink': ['order.add', 'order.modify', 'order.complete'],
      'order.add': ['order.drink', 'order.modify', 'order.complete'],
      'inventory.check': ['inventory.update', 'inventory.add'],
      'cart.add': ['cart.view', 'cart.remove', 'order.create']
    };
    
    return intentRelationships[lastIntent]?.includes(currentIntent) || false;
  }

  determineDialogState(nluResult, conversationState) {
    const intent = nluResult.intent;
    const entities = nluResult.entities || [];
    
    // Determine what information we have vs what we need
    const requiredSlots = this.getRequiredSlots(intent);
    const filledSlots = entities.map(e => e.entity);
    const missingSlots = requiredSlots.filter(slot => !filledSlots.includes(slot));
    
    if (missingSlots.length === 0) {
      return 'complete';
    } else if (filledSlots.length > 0) {
      return 'partial';
    } else {
      return 'initial';
    }
  }

  getRequiredSlots(intent) {
    const slotRequirements = {
      'order.drink': ['drink_name', 'quantity'],
      'inventory.check': ['drink_name'],
      'inventory.update': ['drink_name', 'amount'],
      'cart.add': ['drink_name', 'quantity']
    };
    
    return slotRequirements[intent] || [];
  }

  needsClarification(enhancedResult) {
    const confidence = enhancedResult.score || 0;
    const dialogState = enhancedResult.sessionContext?.dialogState;
    
    return confidence < 0.7 || dialogState === 'partial';
  }

  // Analytics and insights methods
  async getSessionInsights(sessionId) {
    const conversationState = this.conversationStates.get(sessionId);
    if (!conversationState) return null;

    return {
      sessionDuration: new Date() - new Date(conversationState.startTime),
      totalTurns: conversationState.turnNumber,
      lastActivity: conversationState.lastTimestamp,
      currentContext: {
        lastIntent: conversationState.lastIntent,
        cartSize: conversationState.currentCart.length
      }
    };
  }

  async exportConversationData(sessionId = null) {
    if (sessionId) {
      return this.conversationStates.get(sessionId) || null;
    } else {
      // Export all conversation data
      const allConversations = {};
      for (const [id, state] of this.conversationStates.entries()) {
        allConversations[id] = state;
      }
      return allConversations;
    }
  }

  clearSessionData(sessionId) {
    this.conversationStates.delete(sessionId);
  }
}

// Create singleton instance
const enhancedNLU = new EnhancedNLU();

module.exports = { EnhancedNLU, enhancedNLU };
