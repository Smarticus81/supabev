const { learningSystem } = require('./learning-system');
const fs = require('fs').promises;
const path = require('path');

/**
 * Training Data Generator and Exporter
 * Transforms collected interaction data into formats suitable for model fine-tuning
 */
class TrainingDataGenerator {
  constructor() {
    this.outputDir = path.join(process.cwd(), 'data', 'training-datasets');
    this.ensureOutputDirectory();
  }

  async ensureOutputDirectory() {
    try {
      await fs.mkdir(this.outputDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create training datasets directory:', error);
    }
  }

  /**
   * Generate training data for voice recognition model
   */
  async generateVoiceTrainingData(options = {}) {
    const { startDate, endDate, minConfidence = 0.8 } = options;
    
    console.log('Generating voice recognition training data...');
    
    const logs = await learningSystem.readLogs(startDate, endDate, ['voice_command']);
    
    // Filter high-quality voice samples
    const highQualitySamples = logs.filter(log => 
      log.recognitionMetrics?.confidence >= minConfidence
    );

    const trainingData = {
      metadata: {
        created: new Date().toISOString(),
        totalSamples: highQualitySamples.length,
        confidenceThreshold: minConfidence,
        dateRange: { startDate, endDate }
      },
      samples: highQualitySamples.map(log => ({
        audio_path: log.audioPath || null, // If audio files are saved
        transcript: log.originalText,
        confidence: log.recognitionMetrics.confidence,
        alternatives: log.recognitionMetrics.alternatives,
        context: {
          sessionId: log.sessionId,
          timestamp: log.timestamp,
          recognitionSource: log.recognitionSource
        }
      }))
    };

    const filename = `voice-training-${new Date().toISOString().split('T')[0]}.json`;
    await this.writeTrainingFile(filename, trainingData);
    
    console.log(`Voice training data saved: ${filename} (${trainingData.samples.length} samples)`);
    return trainingData;
  }

  /**
   * Generate training data for intent classification
   */
  async generateIntentTrainingData(options = {}) {
    const { startDate, endDate, includeContext = true } = options;
    
    console.log('Generating intent classification training data...');
    
    const logs = await learningSystem.readLogs(startDate, endDate, ['intent_processing']);
    
    const trainingData = {
      metadata: {
        created: new Date().toISOString(),
        totalSamples: logs.length,
        includesContext: includeContext,
        dateRange: { startDate, endDate }
      },
      samples: logs.map(log => ({
        text: log.inputText,
        intent: log.nluResult?.intent,
        confidence: log.nluResult?.score,
        entities: log.nluResult?.entities || [],
        context: includeContext ? {
          sessionId: log.sessionId,
          conversationTurn: log.conversationContext?.turnNumber,
          previousIntent: log.conversationContext?.lastIntent,
          timestamp: log.timestamp
        } : null
      })).filter(sample => sample.intent) // Only include samples with identified intents
    };

    const filename = `intent-training-${new Date().toISOString().split('T')[0]}.json`;
    await this.writeTrainingFile(filename, trainingData);
    
    console.log(`Intent training data saved: ${filename} (${trainingData.samples.length} samples)`);
    return trainingData;
  }

  /**
   * Generate training data for drink name entity recognition
   */
  async generateDrinkNERTrainingData(options = {}) {
    const { startDate, endDate } = options;
    
    console.log('Generating drink NER training data...');
    
    const mappingLogs = await learningSystem.readLogs(startDate, endDate, ['drink_mapping']);
    const intentLogs = await learningSystem.readLogs(startDate, endDate, ['intent_processing']);
    
    const nerSamples = [];
    
    // From drink mappings
    mappingLogs.forEach(log => {
      if (log.mappingMetrics?.mappingMethod !== 'failed') {
        nerSamples.push({
          text: `I want ${log.mappingMetrics.inputName}`,
          entities: [{
            entity: 'drink_name',
            value: log.mappingMetrics.mappedName,
            start: 7, // Position after "I want "
            end: 7 + log.mappingMetrics.inputName.length,
            confidence: log.mappingMetrics.confidence
          }],
          mappingMethod: log.mappingMetrics.mappingMethod
        });
      }
    });

    // From intent processing with drink entities
    intentLogs.forEach(log => {
      const drinkEntities = (log.nluResult?.entities || []).filter(e => 
        e.entity === 'drink_name' || e.entity === 'drink'
      );
      
      if (drinkEntities.length > 0) {
        nerSamples.push({
          text: log.inputText,
          entities: drinkEntities,
          intent: log.nluResult.intent,
          confidence: log.nluResult.score
        });
      }
    });

    const trainingData = {
      metadata: {
        created: new Date().toISOString(),
        totalSamples: nerSamples.length,
        dateRange: { startDate, endDate }
      },
      samples: nerSamples
    };

    const filename = `drink-ner-training-${new Date().toISOString().split('T')[0]}.json`;
    await this.writeTrainingFile(filename, trainingData);
    
    console.log(`Drink NER training data saved: ${filename} (${trainingData.samples.length} samples)`);
    return trainingData;
  }

  /**
   * Generate conversation flow training data for dialog management
   */
  async generateConversationTrainingData(options = {}) {
    const { startDate, endDate } = options;
    
    console.log('Generating conversation flow training data...');
    
    const conversationLogs = await learningSystem.readLogs(startDate, endDate, ['conversation_flow']);
    
    // Group by session to create conversation sequences
    const sessionConversations = {};
    conversationLogs.forEach(log => {
      if (!sessionConversations[log.sessionId]) {
        sessionConversations[log.sessionId] = [];
      }
      sessionConversations[log.sessionId].push(log);
    });

    const conversationSequences = Object.entries(sessionConversations).map(([sessionId, turns]) => {
      const sortedTurns = turns.sort((a, b) => a.conversationMetrics.turnNumber - b.conversationMetrics.turnNumber);
      
      return {
        sessionId,
        totalTurns: sortedTurns.length,
        startTime: sortedTurns[0]?.timestamp,
        endTime: sortedTurns[sortedTurns.length - 1]?.timestamp,
        turns: sortedTurns.map(turn => ({
          turnNumber: turn.conversationMetrics.turnNumber,
          intent: turn.intent,
          confidence: turn.confidence,
          dialogState: turn.conversationMetrics.dialogState,
          contextMaintained: turn.conversationMetrics.contextMaintained,
          clarificationNeeded: turn.conversationMetrics.clarificationNeeded,
          entities: turn.entities,
          timestamp: turn.timestamp
        })),
        success: sortedTurns.some(turn => turn.intent?.includes('order') && turn.dialogState === 'complete')
      };
    });

    const trainingData = {
      metadata: {
        created: new Date().toISOString(),
        totalConversations: conversationSequences.length,
        totalTurns: conversationLogs.length,
        dateRange: { startDate, endDate }
      },
      conversations: conversationSequences
    };

    const filename = `conversation-training-${new Date().toISOString().split('T')[0]}.json`;
    await this.writeTrainingFile(filename, trainingData);
    
    console.log(`Conversation training data saved: ${filename} (${trainingData.conversations.length} conversations)`);
    return trainingData;
  }

  /**
   * Generate training data for error prediction and recovery
   */
  async generateErrorTrainingData(options = {}) {
    const { startDate, endDate } = options;
    
    console.log('Generating error prediction training data...');
    
    const errorLogs = await learningSystem.readLogs(startDate, endDate, ['error']);
    const allLogs = await learningSystem.readLogs(startDate, endDate, ['all']);
    
    // Create training samples for error prediction
    const errorSamples = errorLogs.map(log => ({
      context: {
        toolName: log.toolName,
        parameters: log.parameters,
        sessionContext: log.context,
        systemContext: log.systemContext
      },
      errorType: log.errorAnalytics.errorType,
      errorMessage: log.errorAnalytics.errorMessage,
      userImpact: log.errorAnalytics.userImpact,
      recoveryAction: log.errorAnalytics.recoveryAction,
      timestamp: log.timestamp
    }));

    // Create negative samples (successful operations)
    const successSamples = allLogs
      .filter(log => log.type === 'tool_invocation' && log.toolMetrics?.success)
      .slice(0, errorSamples.length * 2) // 2:1 ratio of success to error
      .map(log => ({
        context: {
          toolName: log.toolName,
          parameters: log.parameters,
          sessionContext: log.context
        },
        errorType: null,
        success: true,
        timestamp: log.timestamp
      }));

    const trainingData = {
      metadata: {
        created: new Date().toISOString(),
        errorSamples: errorSamples.length,
        successSamples: successSamples.length,
        dateRange: { startDate, endDate }
      },
      samples: [...errorSamples, ...successSamples]
    };

    const filename = `error-prediction-training-${new Date().toISOString().split('T')[0]}.json`;
    await this.writeTrainingFile(filename, trainingData);
    
    console.log(`Error prediction training data saved: ${filename} (${trainingData.samples.length} samples)`);
    return trainingData;
  }

  /**
   * Generate comprehensive dataset for general model fine-tuning
   */
  async generateComprehensiveDataset(options = {}) {
    const { startDate, endDate, format = 'json' } = options;
    
    console.log('Generating comprehensive training dataset...');
    
    const [
      voiceData,
      intentData,
      nerData,
      conversationData,
      errorData
    ] = await Promise.all([
      this.generateVoiceTrainingData({ startDate, endDate }),
      this.generateIntentTrainingData({ startDate, endDate }),
      this.generateDrinkNERTrainingData({ startDate, endDate }),
      this.generateConversationTrainingData({ startDate, endDate }),
      this.generateErrorTrainingData({ startDate, endDate })
    ]);

    const comprehensiveDataset = {
      metadata: {
        created: new Date().toISOString(),
        dateRange: { startDate, endDate },
        components: {
          voice: voiceData.samples.length,
          intent: intentData.samples.length,
          ner: nerData.samples.length,
          conversation: conversationData.conversations.length,
          error: errorData.samples.length
        }
      },
      voice_recognition: voiceData,
      intent_classification: intentData,
      named_entity_recognition: nerData,
      conversation_flow: conversationData,
      error_prediction: errorData
    };

    const filename = `comprehensive-dataset-${new Date().toISOString().split('T')[0]}.json`;
    await this.writeTrainingFile(filename, comprehensiveDataset);
    
    console.log(`Comprehensive dataset saved: ${filename}`);
    
    // Also generate in other formats if requested
    if (format === 'jsonl') {
      await this.generateJSONLDataset(comprehensiveDataset);
    }
    
    return comprehensiveDataset;
  }

  /**
   * Generate JSONL format for streaming/incremental training
   */
  async generateJSONLDataset(dataset) {
    const jsonlSamples = [];
    
    // Convert all samples to unified JSONL format
    dataset.intent_classification.samples.forEach(sample => {
      jsonlSamples.push({
        type: 'intent',
        input: sample.text,
        output: sample.intent,
        confidence: sample.confidence,
        context: sample.context
      });
    });

    dataset.named_entity_recognition.samples.forEach(sample => {
      jsonlSamples.push({
        type: 'ner',
        input: sample.text,
        output: sample.entities,
        metadata: { mappingMethod: sample.mappingMethod }
      });
    });

    // Add conversation turns
    dataset.conversation_flow.conversations.forEach(conv => {
      conv.turns.forEach(turn => {
        jsonlSamples.push({
          type: 'conversation',
          input: {
            turnNumber: turn.turnNumber,
            intent: turn.intent,
            entities: turn.entities
          },
          output: {
            dialogState: turn.dialogState,
            contextMaintained: turn.contextMaintained,
            clarificationNeeded: turn.clarificationNeeded
          },
          sessionId: conv.sessionId
        });
      });
    });

    const jsonlContent = jsonlSamples.map(sample => JSON.stringify(sample)).join('\n');
    const filename = `unified-training-${new Date().toISOString().split('T')[0]}.jsonl`;
    
    await fs.writeFile(path.join(this.outputDir, filename), jsonlContent);
    console.log(`JSONL dataset saved: ${filename} (${jsonlSamples.length} samples)`);
    
    return jsonlSamples;
  }

  /**
   * Write training file with proper formatting
   */
  async writeTrainingFile(filename, data) {
    const filepath = path.join(this.outputDir, filename);
    await fs.writeFile(filepath, JSON.stringify(data, null, 2));
  }

  /**
   * Generate training statistics and recommendations
   */
  async generateTrainingStats(dataset) {
    const stats = {
      sampleDistribution: {},
      qualityMetrics: {},
      recommendations: []
    };

    // Analyze intent distribution
    if (dataset.intent_classification) {
      const intentCounts = {};
      dataset.intent_classification.samples.forEach(sample => {
        intentCounts[sample.intent] = (intentCounts[sample.intent] || 0) + 1;
      });
      
      stats.sampleDistribution.intents = intentCounts;
      
      // Check for class imbalance
      const intentValues = Object.values(intentCounts);
      const maxCount = Math.max(...intentValues);
      const minCount = Math.min(...intentValues);
      
      if (maxCount / minCount > 10) {
        stats.recommendations.push({
          type: 'class_imbalance',
          message: 'Intent classes are imbalanced. Consider data augmentation for underrepresented intents.',
          ratio: maxCount / minCount
        });
      }
    }

    // Analyze confidence distributions
    const confidenceThresholds = [0.9, 0.8, 0.7, 0.6];
    stats.qualityMetrics.confidenceDistribution = {};
    
    if (dataset.voice_recognition) {
      confidenceThresholds.forEach(threshold => {
        const count = dataset.voice_recognition.samples.filter(s => s.confidence >= threshold).length;
        stats.qualityMetrics.confidenceDistribution[`above_${threshold}`] = count;
      });
    }

    return stats;
  }
}

// Export functions for CLI usage
async function exportTrainingData(options = {}) {
  const generator = new TrainingDataGenerator();
  return await generator.generateComprehensiveDataset(options);
}

async function exportSpecificData(type, options = {}) {
  const generator = new TrainingDataGenerator();
  
  switch (type) {
    case 'voice':
      return await generator.generateVoiceTrainingData(options);
    case 'intent':
      return await generator.generateIntentTrainingData(options);
    case 'ner':
      return await generator.generateDrinkNERTrainingData(options);
    case 'conversation':
      return await generator.generateConversationTrainingData(options);
    case 'error':
      return await generator.generateErrorTrainingData(options);
    default:
      throw new Error(`Unknown training data type: ${type}`);
  }
}

module.exports = {
  TrainingDataGenerator,
  exportTrainingData,
  exportSpecificData
};
