require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });
const { invokeMcpTool } = require('./mcp-client');
const AudioGenerator = require('../lib/audio-generator');
const fs = require('fs');
const path = require('path');
const { cartBroadcaster } = require('../lib/cart-broadcaster');

// Correct path to intents.json
const intentsPath = path.resolve(__dirname, '..', 'data', 'intents.json');

let intents;
try {
  const intentsFile = fs.readFileSync(intentsPath, 'utf-8');
  intents = JSON.parse(intentsFile);
} catch (error) {
  console.error(`Error reading or parsing intents.json at ${intentsPath}`, error);
  process.exit(1);
}

// Voice assistant state management
const clientStates = new Map();

// Default client state structure
const createDefaultClientState = () => ({
            conversationContext: {
                lastIntent: null,
                lastEntities: {},
    pendingConfirmation: null,
    recentDrinks: [],
                recentInventoryChecks: [],
    conversationHistory: []
  },
  voiceConfig: {
    provider: 'openai',
    voice: 'shimmer',
    temperature: 0.7,
    rate: 1.0
  }
});

function getClientState(clientId) {
  if (!clientStates.has(clientId)) {
    clientStates.set(clientId, createDefaultClientState());
    }
    return clientStates.get(clientId);
}

// 🎯 MAIN PROCESSING FUNCTION - Optimized for OpenAI WebRTC
async function processTranscript(transcript, ws, wssClients, mode = 'realtime') {
  try {
    console.log(`🎯 Processing transcript in ${mode} mode: "${transcript}"`);
    
    const clientId = ws?.clientId || 'default';
    const clientState = getClientState(clientId);
    
    // Enhanced context for OpenAI WebRTC
    const contextString = buildEnhancedContext(clientState);
    
    // Direct MCP tool integration for ultra-low latency
    const result = await enhancedIntentProcessing(transcript, clientState);
    
    // Store conversation in client state
    clientState.conversationContext.conversationHistory.push({
      transcript: transcript,
      response: result.conversational_response,
      intent: result.intent,
      entities: result.entities,
      timestamp: new Date().toISOString()
    });
    
    // Keep history manageable
    if (clientState.conversationContext.conversationHistory.length > 10) {
      clientState.conversationContext.conversationHistory = 
        clientState.conversationContext.conversationHistory.slice(-10);
    }
    
    // Broadcast cart updates if this was a cart-related action
    if (['cart_add', 'cart_remove', 'cart_clear', 'cart_create_order'].includes(result.intent)) {
      console.log('🛒 Broadcasting cart update after cart operation');
      setTimeout(() => {
        cartBroadcaster.broadcastCartUpdate();
      }, 100);
    }
    
    // For OpenAI WebRTC mode, return structured result for further processing
    if (mode === 'realtime') {
      return {
        success: true,
        intent: result.intent,
        entities: result.entities,
        response: result.conversational_response,
        reasoning: result.reasoning
      };
    }
    
    // For legacy modes, send response via WebSocket
    if (ws && ws.readyState === 1) {
      ws.send(JSON.stringify({
        type: 'assistant_response',
        message: result.conversational_response,
        intent: result.intent,
        entities: result.entities,
        reasoning: result.reasoning
      }));
    }
    
    return result;
    
    } catch (error) {
    console.error('❌ Error in processTranscript:', error);
    const fallbackResponse = "I apologize, I'm having trouble processing that request. Please try again.";
    
    if (ws && ws.readyState === 1) {
      ws.send(JSON.stringify({
        type: 'assistant_response',
        message: fallbackResponse,
        error: true
      }));
        }
        
        return {
      intent: 'error',
            entities: {},
            reasoning: 'AI error - fallback',
            conversational_response: fallbackResponse
        };
    }
}

function buildEnhancedContext(clientState) {
    const context = clientState.conversationContext;
    let contextString = `Current Time: ${new Date().toLocaleTimeString()}\n`;

    if (context.lastIntent) {
        contextString += `Last Action: ${context.lastIntent} with entities ${JSON.stringify(context.lastEntities)}\n`;
    }

    if (context.pendingConfirmation) {
        contextString += `Awaiting Confirmation For: ${context.pendingConfirmation}\n`;
    }

    if (context.recentDrinks.length > 0) {
        contextString += `Recent Drinks Mentioned: ${context.recentDrinks.slice(-3).join(', ')}\n`;
    }
    if (context.recentInventoryChecks.length > 0) {
        contextString += `Recent Inventory Checks: ${context.recentInventoryChecks.slice(-2).join(', ')}\n`;
    }

    if (context.conversationHistory.length > 0) {
        contextString += `Recent Interactions:\n`;
        context.conversationHistory.slice(-3).forEach(entry => {
            contextString += `- User: "${entry.transcript}" → Bev: "${entry.response}"\n`;
        });
    }

    return contextString;
}

async function enhancedEntityNormalization(intent, entities, clientState) {
    const normalized = { ...entities };
    const availableDrinks = getAvailableDrinks();
    
    // Handle cart_add_multiple with arrays in drink_name (fix AI format issues)
    if (intent === 'cart_add_multiple' && Array.isArray(normalized.drink_name)) {
        const items = [];
        const drinkNames = normalized.drink_name;
        const quantities = Array.isArray(normalized.quantity) ? normalized.quantity : [];
        
        // Group drinks by name and calculate quantities
    const drinkGroups = {};
    drinkNames.forEach((name, index) => {
      const qty = quantities[index] || 1;
      if (drinkGroups[name]) {
        drinkGroups[name] += qty;
      } else {
        drinkGroups[name] = qty;
      }
    });
    
    // Convert back to arrays
    normalized.drink_name = Object.keys(drinkGroups);
    normalized.quantity = Object.values(drinkGroups);
  }
  
  // Normalize drink names using fuzzy matching
  if (normalized.drink_name) {
    if (Array.isArray(normalized.drink_name)) {
      normalized.drink_name = normalized.drink_name.map(name => {
        const bestMatch = findBestDrinkMatch(name, availableDrinks);
        return bestMatch || name;
      });
    } else {
        const bestMatch = findBestDrinkMatch(normalized.drink_name, availableDrinks);
        if (bestMatch) {
            normalized.drink_name = bestMatch;
      }
    }
  }
  
  // Set default quantity if missing
  if (intent.includes('cart_add') && !normalized.quantity) {
    normalized.quantity = 1;
    }
    
    return normalized;
}

function findBestDrinkMatch(input, availableDrinks) {
  if (!input || !availableDrinks) return null;
  
  const inputLower = input.toLowerCase().trim();
  
  // First try exact match
  for (const drink of availableDrinks) {
    if (drink.toLowerCase() === inputLower) {
      return drink;
    }
  }
  
  // Then try partial match
  for (const drink of availableDrinks) {
    if (drink.toLowerCase().includes(inputLower) || inputLower.includes(drink.toLowerCase())) {
      return drink;
    }
  }
  
  // Finally try fuzzy matching with Levenshtein distance if available
  try {
    const levenshtein = require('fast-levenshtein');
    let bestMatch = null;
    let bestDistance = Infinity;
    
    for (const drink of availableDrinks) {
      const distance = levenshtein.get(inputLower, drink.toLowerCase());
      const threshold = Math.max(2, Math.min(drink.length * 0.3, 4));
      
      if (distance < threshold && distance < bestDistance) {
        bestDistance = distance;
        bestMatch = drink;
      }
    }
    
    return bestMatch;
  } catch (error) {
    console.warn('Levenshtein distance not available for fuzzy matching');
    return null;
  }
}

function getAvailableDrinks() {
  // This would typically come from your database
  // For now, return a basic list for demonstration
  return [
    'Bud Light', 'Miller Lite', 'Coors Light', 'Corona Extra', 'Heineken',
    'Stella Artois', 'Dos XX', 'Michelob Ultra', 'Guinness', 'Blue Moon',
    'Chardonnay', 'Pinot Grigio', 'Sauvignon Blanc', 'Merlot', 'Cabernet Sauvignon',
    'Pinot Noir', 'Moscato', 'Riesling', 'Prosecco', 'Champagne',
    'Vodka', 'Gin', 'Rum', 'Whiskey', 'Bourbon', 'Tequila', 'Scotch',
    'Jim Beam', 'Jack Daniels', 'Crown Royal', 'Jameson', 'Patron',
    'Grey Goose', 'Titos Vodka', 'Bombay Sapphire', 'Hendricks Gin',
    'Captain Morgan', 'Bacardi', 'Malibu'
  ];
}

// 🚀 ENHANCED INTENT PROCESSING WITH DIRECT MCP INTEGRATION
async function enhancedIntentProcessing(transcript, clientState) {
  try {
    console.log('🧠 Enhanced intent processing for OpenAI WebRTC pipeline');
    
    // Direct pattern matching for common intents (ultra-fast)
    const quickIntent = matchQuickIntents(transcript);
    if (quickIntent) {
      console.log(`⚡ Quick intent match: ${quickIntent.intent}`);
      
      // Normalize entities
      const normalizedEntities = await enhancedEntityNormalization(
        quickIntent.intent, 
        quickIntent.entities, 
        clientState
      );
      
      // Execute via MCP
      const mcpResult = await invokeMcpTool(quickIntent.intent, normalizedEntities);
      
      return {
        intent: quickIntent.intent,
        entities: normalizedEntities,
        reasoning: 'Quick pattern match',
        conversational_response: formatMcpResponse(mcpResult, quickIntent.intent)
      };
    }
    
    // Fallback to basic intent classification for complex requests
    const fallbackIntent = classifyBasicIntent(transcript);
    
    return {
      intent: fallbackIntent.intent,
      entities: fallbackIntent.entities,
      reasoning: 'Basic classification',
      conversational_response: 'I understood your request. Let me help you with that.'
    };
    
  } catch (error) {
    console.error('Error in enhanced intent processing:', error);
    return {
      intent: 'error',
      entities: {},
      reasoning: 'Processing error',
      conversational_response: 'I apologize, I had trouble understanding that. Could you please try again?'
    };
  }
}

function matchQuickIntents(transcript) {
  const lower = transcript.toLowerCase();
  
  // Cart operations
  if (lower.includes('add') || lower.includes('order') || lower.includes('get me')) {
    const drink = extractDrinkName(transcript);
    const quantity = extractQuantity(transcript);
    return {
      intent: 'cart_add',
      entities: { drink_name: drink, quantity: quantity || 1 }
    };
  }
  
  if (lower.includes('remove') || lower.includes('delete')) {
    const drink = extractDrinkName(transcript);
    return {
      intent: 'cart_remove',
      entities: { drink_name: drink }
    };
  }
  
  if (lower.includes('clear cart') || lower.includes('empty cart')) {
    return {
      intent: 'cart_clear',
      entities: {}
    };
  }
  
  if (lower.includes('process') || lower.includes('checkout') || lower.includes('complete order')) {
    return {
      intent: 'cart_create_order',
      entities: {}
    };
  }
  
  if (lower.includes('show cart') || lower.includes('view cart') || lower.includes('what\'s in')) {
    return {
      intent: 'cart_view',
      entities: {}
    };
  }
  
  // Inventory checks
  if (lower.includes('inventory') || lower.includes('stock') || lower.includes('available')) {
    const drink = extractDrinkName(transcript);
    return {
      intent: 'inventory_check',
      entities: { drink_name: drink }
    };
  }
  
  return null;
}

function extractDrinkName(transcript) {
  // Simple extraction - in production you'd use more sophisticated NLP
  const words = transcript.toLowerCase().split(' ');
  const drinkKeywords = ['beer', 'wine', 'vodka', 'gin', 'rum', 'whiskey', 'bourbon', 'tequila'];
  
  for (let i = 0; i < words.length; i++) {
    if (drinkKeywords.includes(words[i])) {
      return words[i];
    }
  }
  
  // Look for common drink names
  const drinks = getAvailableDrinks();
  for (const drink of drinks) {
    if (transcript.toLowerCase().includes(drink.toLowerCase())) {
      return drink;
    }
  }
  
  return 'drink'; // Default fallback
}

function extractQuantity(transcript) {
  const numbers = transcript.match(/\b(\d+)\b/);
  return numbers ? parseInt(numbers[1]) : 1;
}

function classifyBasicIntent(transcript) {
  // Basic fallback classification
  const lower = transcript.toLowerCase();
  
  if (lower.includes('help')) {
    return { intent: 'help', entities: {} };
  }
  
  if (lower.includes('menu') || lower.includes('drinks')) {
    return { intent: 'menu_view', entities: {} };
  }
  
  return { intent: 'general_inquiry', entities: {} };
}

function formatMcpResponse(mcpResult, intent) {
  if (!mcpResult || mcpResult.isError) {
    return "I'm sorry, I couldn't complete that request. Please try again.";
  }
  
  // Format response based on intent type
  switch (intent) {
    case 'cart_add':
      return "Perfect! I've added that to your cart.";
    case 'cart_remove':
      return "Done! I've removed that from your cart.";
    case 'cart_clear':
      return "Your cart has been cleared.";
    case 'cart_create_order':
      return "Excellent! Your order has been processed successfully.";
    case 'cart_view':
      return "Here's what's currently in your cart.";
    case 'inventory_check':
      return "Let me check our current inventory for you.";
    default:
      return "I've processed your request successfully.";
  }
}

module.exports = {
  processTranscript,
  getClientState,
  enhancedIntentProcessing
}; 