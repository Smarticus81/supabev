const { enhancedNLU } = require('../lib/enhanced-nlu');
const { invoke } = require('../lib/tools');

/**
 * Example integration of the learning system with voice processing
 * This shows how to capture comprehensive learning data during voice interactions
 */

async function processVoiceCommand(audioData, sessionId, context = {}) {
  const processingStart = Date.now();
  
  try {
    // 1. Speech Recognition (you would integrate with your actual ASR)
    const speechResult = await recognizeSpeech(audioData);
    const speechProcessingTime = Date.now() - processingStart;
    
    // 2. Enhanced NLU Processing with Learning
    const nluStart = Date.now();
    const nluResult = await enhancedNLU.processWithLearning(speechResult.text, {
      sessionId,
      fromVoice: true,
      speechConfidence: speechResult.confidence,
      speechAlternatives: speechResult.alternatives,
      speechProcessingTime,
      recognitionSource: 'deepgram' // or whatever ASR you use
    });
    
    // 3. Tool Invocation with Context
    const toolStart = Date.now();
    const toolResult = await invoke(
      mapIntentToTool(nluResult.intent), 
      extractParameters(nluResult), 
      {
        sessionId,
        nluResult,
        voiceContext: context
      }
    );
    
    // 4. Response Generation
    const response = generateResponse(toolResult, nluResult);
    
    return {
      success: true,
      response,
      sessionId,
      processingTime: Date.now() - processingStart,
      debug: {
        speech: speechResult,
        nlu: nluResult,
        tool: toolResult
      }
    };
    
  } catch (error) {
    // Error is automatically logged by the enhanced tools
    return {
      success: false,
      error: error.message,
      sessionId,
      processingTime: Date.now() - processingStart
    };
  }
}

// Helper functions (you would implement these based on your specific setup)
async function recognizeSpeech(audioData) {
  // Your speech recognition implementation
  return {
    text: "I want a corona",
    confidence: 0.95,
    alternatives: ["I want to corona", "I want a car owner"]
  };
}

function mapIntentToTool(intent) {
  const intentToTool = {
    'order.drink': 'order_drink',
    'order.add': 'cart_add',
    'inventory.check': 'check_inventory',
    'cart.view': 'cart_view',
    'order.complete': 'cart_create_order'
  };
  
  return intentToTool[intent] || 'greeting';
}

function extractParameters(nluResult) {
  const params = {};
  
  // Extract entities as parameters
  (nluResult.entities || []).forEach(entity => {
    switch(entity.entity) {
      case 'drink_name':
      case 'drink':
        params.drink_name = entity.value;
        break;
      case 'quantity':
      case 'number':
        params.quantity = parseInt(entity.value) || 1;
        break;
      case 'serving_size':
        params.serving_name = entity.value;
        break;
    }
  });
  
  // Set defaults
  if (!params.quantity && nluResult.intent?.includes('order')) {
    params.quantity = 1;
  }
  
  return params;
}

function generateResponse(toolResult, nluResult) {
  // Generate appropriate response based on the tool result
  if (toolResult.success === false) {
    return `Sorry, I couldn't process that request: ${toolResult.message || 'Unknown error'}`;
  }
  
  switch(nluResult.intent) {
    case 'order.drink':
      if (toolResult.order_id) {
        return `Great! I've added that to your order. Your order number is ${toolResult.order_id} with a total of $${(toolResult.total / 100).toFixed(2)}.`;
      }
      break;
      
    case 'cart.add':
      return `I've added ${toolResult.message || 'that item'} to your cart.`;
      
    case 'inventory.check':
      if (toolResult.inventory_oz !== undefined) {
        const bottles = Math.floor(toolResult.inventory_oz / (toolResult.unit_volume_oz || 25.36));
        return `We currently have ${bottles} bottles of ${toolResult.name} in stock.`;
      }
      break;
      
    case 'cart.view':
      if (toolResult.cart && toolResult.cart.length > 0) {
        const itemList = toolResult.cart.map(item => 
          `${item.quantity} ${item.serving_name} ${item.drink_name}`
        ).join(', ');
        return `Your current cart contains: ${itemList}`;
      } else {
        return "Your cart is empty.";
      }
      break;
      
    default:
      return toolResult.message || "I've processed your request.";
  }
  
  return "I've processed your request.";
}

// Example usage in your voice server
async function handleVoiceMessage(audioData, sessionId) {
  const result = await processVoiceCommand(audioData, sessionId, {
    timestamp: new Date().toISOString(),
    source: 'voice_chat'
  });
  
  if (result.success) {
    console.log(`Voice command processed successfully in ${result.processingTime}ms`);
    return result.response;
  } else {
    console.error(`Voice command failed: ${result.error}`);
    return "Sorry, I didn't understand that. Could you please repeat?";
  }
}

module.exports = {
  processVoiceCommand,
  handleVoiceMessage
};
