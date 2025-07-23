# Beverage POS Learning System

## Overview

The Beverage POS Learning System is a comprehensive data collection and machine learning pipeline designed to capture, analyze, and learn from user interactions with your beverage point-of-sale system. This system enables continuous improvement through:

- **Voice Recognition Training Data**: High-quality speech-to-text samples with confidence scores
- **Intent Classification**: Natural language understanding training datasets
- **Named Entity Recognition**: Drink name mapping and entity extraction
- **Conversation Flow Management**: Dialog state tracking and context management
- **Error Prediction**: Failure pattern analysis and recovery strategies
- **Performance Analytics**: System insights and optimization recommendations

## 🚀 Features

### Data Collection
- **Real-time Interaction Logging**: Captures every user interaction with contextual information
- **Voice Command Processing**: Records speech recognition results with confidence metrics
- **Intent Processing**: Logs NLU results and entity extraction
- **Tool Invocation Tracking**: Monitors function calls and performance
- **Error Analytics**: Comprehensive error tracking and pattern analysis

### Training Data Generation
- **Multiple Export Formats**: JSON, JSONL, CSV for different ML frameworks
- **Data Quality Filtering**: Confidence-based filtering and validation
- **Balanced Datasets**: Automatic class balancing recommendations
- **Time-based Filtering**: Export data from specific date ranges
- **Context Enrichment**: Includes conversation context and session information

### Analytics & Insights
- **Performance Metrics**: Success rates, confidence distributions, processing times
- **Usage Patterns**: Intent distributions, popular drinks, error frequencies
- **Quality Assessment**: Data quality metrics and improvement suggestions
- **Trend Analysis**: Historical performance tracking and anomaly detection

## 📁 Architecture

```
lib/
├── learning-system.js      # Core logging and data collection
├── enhanced-nlu.js         # NLU wrapper with learning capabilities
├── training-data-generator.js  # Export and format training data
└── tools.js               # Enhanced tools with logging integration

data/
├── learning-logs/          # Raw interaction logs (JSONL format)
│   ├── interactions-YYYY-MM-DD.jsonl
│   ├── voice-commands-YYYY-MM-DD.jsonl
│   ├── intent-processing-YYYY-MM-DD.jsonl
│   ├── tool-invocations-YYYY-MM-DD.jsonl
│   └── errors-YYYY-MM-DD.jsonl
└── training-datasets/      # Processed training data
    ├── voice-training-YYYY-MM-DD.json
    ├── intent-training-YYYY-MM-DD.json
    ├── conversation-training-YYYY-MM-DD.json
    └── comprehensive-dataset-YYYY-MM-DD.json

scripts/
└── learning-cli.js         # Command-line interface for data management
```

## 🛠️ Installation & Setup

1. **Install Dependencies**:
   ```bash
   npm install commander
   ```

2. **Initialize Learning System**:
   The learning system automatically initializes when your application starts and begins collecting data immediately.

3. **Set Up Data Directories**:
   ```bash
   mkdir -p data/learning-logs
   mkdir -p data/training-datasets
   ```

## 📊 Usage

### Command Line Interface

The learning system includes a comprehensive CLI for data management:

```bash
# Export all training data
npm run learning:export

# Export specific data types
npm run learning:export -- --type voice --start 2025-01-01 --end 2025-01-31

# Generate insights and analytics
npm run learning:insights

# View current system statistics
npm run learning:stats

# Clean old data (keep last 30 days)
npm run learning:clean --days 30 --confirm

# Validate data quality
npm run learning:validate
```

### Export Options

```bash
# Export voice recognition training data
node scripts/learning-cli.js export --type voice --format jsonl

# Export intent classification data with date range
node scripts/learning-cli.js export --type intent --start 2025-01-01 --end 2025-01-31

# Export comprehensive dataset for fine-tuning
node scripts/learning-cli.js export --type all --format json
```

### Programmatic Usage

```javascript
const { learningSystem } = require('./lib/learning-system');
const { exportTrainingData } = require('./lib/training-data-generator');

// Log a user interaction
await learningSystem.logInteraction({
  sessionId: 'user123',
  type: 'voice_command',
  inputText: 'I want a beer',
  confidence: 0.95,
  intent: 'order.drink',
  success: true
});

// Export training data
const dataset = await exportTrainingData({
  startDate: '2025-01-01',
  endDate: '2025-01-31',
  format: 'json'
});
```

## 📈 Data Types Collected

### 1. Voice Commands
```json
{
  "timestamp": "2025-01-22T10:30:00Z",
  "sessionId": "user123",
  "type": "voice_command",
  "originalText": "I want a corona",
  "recognitionMetrics": {
    "confidence": 0.95,
    "alternatives": ["I want to corona", "I want a car owner"],
    "processingTime": 150
  }
}
```

### 2. Intent Processing
```json
{
  "timestamp": "2025-01-22T10:30:01Z",
  "sessionId": "user123",
  "type": "intent_processing",
  "inputText": "I want a corona",
  "nluMetrics": {
    "confidence": 0.89,
    "intent": "order.drink",
    "entities": [
      {
        "entity": "drink_name",
        "value": "Corona Extra",
        "confidence": 0.92
      }
    ]
  }
}
```

### 3. Tool Invocations
```json
{
  "timestamp": "2025-01-22T10:30:02Z",
  "sessionId": "user123",
  "type": "tool_invocation",
  "toolName": "create_order",
  "parameters": {
    "items": [{"drink_name": "Corona Extra", "quantity": 1}]
  },
  "success": true,
  "executionTime": 45
}
```

### 4. Drink Mappings
```json
{
  "timestamp": "2025-01-22T10:30:00Z",
  "sessionId": "user123",
  "type": "drink_mapping",
  "inputName": "corona",
  "mappedName": "Corona Extra",
  "mappingMethod": "alias",
  "confidence": 1.0
}
```

## 🎯 Model Fine-Tuning Applications

### 1. Voice Recognition Model
- **Training Data**: High-confidence speech samples with transcriptions
- **Use Case**: Improve speech recognition for beverage-specific vocabulary
- **Format**: Audio files + transcriptions or text-only for language model adaptation

### 2. Intent Classification Model
- **Training Data**: User utterances with labeled intents and confidence scores
- **Use Case**: Better understanding of customer requests and commands
- **Format**: `{"text": "I want a beer", "intent": "order.drink", "confidence": 0.95}`

### 3. Named Entity Recognition (NER)
- **Training Data**: Drink name variations and mappings with context
- **Use Case**: Improved drink name recognition and fuzzy matching
- **Format**: BIO tags or entity spans with drink categories

### 4. Conversation Management
- **Training Data**: Complete conversation flows with dialog states
- **Use Case**: Better context management and multi-turn conversations
- **Format**: Conversation sequences with turn-level annotations

### 5. Error Prediction Model
- **Training Data**: System contexts that led to errors vs. successes
- **Use Case**: Proactive error prevention and system reliability
- **Format**: Feature vectors with binary success/failure labels

## 📊 Analytics Dashboard

The learning system provides detailed insights:

```bash
npm run learning:insights
```

**Sample Output**:
```
📈 SYSTEM INSIGHTS
==================================================

📊 Overview:
  Total Interactions: 1,247
  Successful: 1,156
  Error Rate: 7.3%

🎤 Voice Recognition:
  Total Commands: 892
  Average Confidence: 0.87
  Low Confidence Commands: 89

🧠 Intent Processing:
  Total Processed: 1,247
  Average NLU Confidence: 0.91
  Intent Distribution:
    order.drink: 645
    inventory.check: 234
    cart.add: 178

🍺 Drink Mapping:
  Total Mappings: 645
  Failed Mappings: 23
  Mapping Methods:
    alias: 456
    exact: 123
    fuzzy: 43
    failed: 23

💡 Recommendations:
  1. [HIGH] Consider improving voice recognition model
     Metric: 10.0% low confidence commands
  2. [MEDIUM] Add more drink aliases for failed mappings
     Metric: 3.6% mapping failure rate
```

## 🔧 Configuration

### Environment Variables
```bash
# Optional: Custom data directories
LEARNING_LOGS_DIR=/custom/path/to/logs
TRAINING_DATA_DIR=/custom/path/to/datasets

# Optional: Data retention policy
LEARNING_DATA_RETENTION_DAYS=90

# Optional: Export batch size
LEARNING_EXPORT_BATCH_SIZE=1000
```

### Integration with Existing Code

The learning system is designed to integrate seamlessly:

```javascript
// In your tools.js or similar
const { learningSystem } = require('./learning-system');

async function processOrder(params, context) {
  const startTime = Date.now();
  
  try {
    // Your existing logic
    const result = await createOrder(params);
    
    // Log successful operation
    await learningSystem.logInteraction({
      sessionId: context.sessionId,
      type: 'order_success',
      parameters: params,
      result: result,
      executionTime: Date.now() - startTime
    });
    
    return result;
  } catch (error) {
    // Log error for learning
    await learningSystem.logError({
      sessionId: context.sessionId,
      operation: 'create_order',
      error: error,
      context: context
    });
    
    throw error;
  }
}
```

## 🚀 Best Practices

### 1. Data Privacy & Compliance
- **PII Filtering**: Automatically filters sensitive information
- **Session Anonymization**: Use anonymous session IDs
- **Data Retention**: Implement retention policies for compliance
- **Export Controls**: Secure access to training data exports

### 2. Data Quality
- **Confidence Thresholds**: Filter low-quality samples
- **Duplicate Detection**: Remove redundant training examples
- **Class Balance**: Monitor and address class imbalances
- **Validation**: Regular data quality checks

### 3. Performance Optimization
- **Async Logging**: Non-blocking data collection
- **Batch Processing**: Efficient data export and processing
- **Storage Management**: Automatic cleanup of old logs
- **Monitoring**: Track system performance impact

## 📋 Maintenance

### Regular Tasks
1. **Daily**: Monitor system statistics with `npm run learning:stats`
2. **Weekly**: Generate insights with `npm run learning:insights`
3. **Monthly**: Export training data for model updates
4. **Quarterly**: Clean old data with retention policies

### Monitoring
- **Disk Usage**: Monitor `data/learning-logs` directory size
- **Error Rates**: Track system error frequencies
- **Data Quality**: Validate confidence score distributions
- **Performance**: Monitor logging overhead

## 🤝 Contributing

To extend the learning system:

1. **Add New Data Types**: Extend `LearningSystem` class with new log methods
2. **Custom Exports**: Add formatters in `TrainingDataGenerator`
3. **Analytics**: Extend insight generation methods
4. **CLI Commands**: Add new commands to `learning-cli.js`

## 📜 License

This learning system is part of the Beverage POS project and follows the same licensing terms.

---

**Ready to start learning?** 🎓

```bash
# Start collecting data immediately
npm run dev

# View what's been collected
npm run learning:stats

# Export your first training dataset
npm run learning:export
```
