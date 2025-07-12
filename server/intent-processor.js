const { Groq } = require('groq-sdk');
const { createClient } = require('@deepgram/sdk');
const { invokeMcpTool } = require('./mcp-client');
const { getDb } = require('../lib/db');
const WakeWordDetector = require('../lib/wake-word-detector');
const AudioGenerator = require('../lib/audio-generator');
const fs = require('fs');
const path = require('path');

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

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const deepgram = createClient(process.env.DEEPGRAM_API_KEY);

// Voice assistant state management
const clientStates = new Map(); // Track state per client

// States: 'wake_word', 'command', 'processing'
function getClientState(clientId) {
    if (!clientStates.has(clientId)) {
        clientStates.set(clientId, {
            mode: 'wake_word',
            wakeWordDetector: new WakeWordDetector(),
            lastActivity: Date.now(),
            commandBuffer: []
        });
    }
    return clientStates.get(clientId);
}

// Get available drinks from database
function getAvailableDrinks() {
  try {
    const db = getDb();
    const drinks = db.prepare('SELECT name FROM drinks').all();
    return drinks.map(d => d.name);
  } catch (error) {
    console.error('Error getting drinks from database:', error);
    return [];
  }
}

async function processTranscript(transcript, ws, connectedClients = new Set()) {
    try {
        // Use WebSocket object as client ID
        const clientId = ws;
        const clientState = getClientState(clientId);
        
        console.log(`[${clientState.mode.toUpperCase()}] Transcript: "${transcript}"`);

        // Update last activity
        clientState.lastActivity = Date.now();

        // Handle based on current mode
        if (clientState.mode === 'wake_word') {
            return await handleWakeWordMode(transcript, ws, clientState, connectedClients);
        } else if (clientState.mode === 'command') {
            return await handleCommandMode(transcript, ws, clientState, connectedClients);
        }

    } catch (error) {
        console.error("Error in processTranscript:", error);
        ws.send(JSON.stringify({ 
            type: 'response', 
            data: "There was an error processing your request.",
            mode: 'wake_word'
        }));
        
        // Reset to wake word mode on error
        const clientState = getClientState(ws);
        clientState.mode = 'wake_word';
    }
}

async function handleWakeWordMode(transcript, ws, clientState, connectedClients) {
    const wakeWordResult = clientState.wakeWordDetector.detectWakeWord(transcript);
    
    if (wakeWordResult.detected) {
        console.log(`Wake word detected! Confidence: ${wakeWordResult.confidence.toFixed(2)}, Phrase: "${wakeWordResult.matchedPhrase}"`);
        
        // Switch to command mode
        clientState.mode = 'command';
        
        // Send wake word acknowledgment with pleasant chime
        const chimeAudio = AudioGenerator.generateWakeWordChime();
        
        ws.send(JSON.stringify({ 
            type: 'wake_word_detected',
            data: {
                confidence: wakeWordResult.confidence,
                matchedPhrase: wakeWordResult.matchedPhrase
            }
        }));
        
        ws.send(JSON.stringify({ 
            type: 'audio', 
            data: chimeAudio,
            audioType: 'wake_word_chime'
        }));
        
        ws.send(JSON.stringify({ 
            type: 'response', 
            data: "Yes? How can I help you?",
            mode: 'command'
        }));
        
        // Generate TTS for the response
        const ttsResponse = await deepgram.speak.request(
            { text: "Yes? How can I help you?" },
            { model: 'aura-2-juno-en' }
        );

        const ttsStream = await ttsResponse.getStream();
        const chunks = [];
        for await (const chunk of ttsStream) {
            chunks.push(chunk);
        }
        
        const buffer = Buffer.concat(chunks);
        ws.send(JSON.stringify({ 
            type: 'audio', 
            data: buffer.toString('base64'),
            audioType: 'tts_response'
        }));
        
        // Set timeout to return to wake word mode if no commands
        setTimeout(() => {
            if (clientState.mode === 'command' && Date.now() - clientState.lastActivity > 30000) {
                clientState.mode = 'wake_word';
                ws.send(JSON.stringify({ 
                    type: 'response', 
                    data: "Going back to wake word mode.",
                    mode: 'wake_word'
                }));
            }
        }, 30000);
    }
    
    // In wake word mode, we don't respond to other speech
    return;
}

async function handleCommandMode(transcript, ws, clientState, connectedClients) {
    // Check for termination first
    const terminationResult = clientState.wakeWordDetector.detectTermination(transcript);
    
    if (terminationResult.detected) {
        console.log(`Termination detected: "${terminationResult.matchedPhrase}"`);
        
        clientState.mode = 'wake_word';
        
        ws.send(JSON.stringify({ 
            type: 'response', 
            data: "Going back to wake word mode. Say 'Hey Bev' when you need me.",
            mode: 'wake_word'
        }));
        
        const ttsResponse = await deepgram.speak.request(
            { text: "Going back to wake word mode. Say Hey Bev when you need me." },
            { model: 'aura-2-juno-en' }
        );

        const ttsStream = await ttsResponse.getStream();
        const chunks = [];
        for await (const chunk of ttsStream) {
            chunks.push(chunk);
        }
        
        const buffer = Buffer.concat(chunks);
        ws.send(JSON.stringify({ 
            type: 'audio', 
            data: buffer.toString('base64'),
            audioType: 'tts_response'
        }));
        
        return;
    }

    // Process the command using the existing AI logic
    const availableDrinks = getAvailableDrinks();
    const drinksList = availableDrinks.join(', ');
    
    const stream = await groq.chat.completions.create({
        messages: [
            {
                role: 'system',
                content: `You are "Bev", an AI assistant working for a professional bartender at an upscale wedding venue called "Knotting Hill Place". You are in COMMAND MODE - the user has said "Hey Bev" and you are now actively listening for orders and commands.

**Your Role & Personality:**
- You are a trusted partner to the bartender, not just a tool
- You speak professionally but warmly, like an experienced bar manager
- You understand the fast-paced nature of wedding service
- You're proactive about inventory management and service efficiency
- You maintain composure during busy periods

**Available Drinks in Our Bar:**
${drinksList}

**Your Core Responsibilities:**
1. **Order Management**: Take drink orders quickly and accurately
2. **Inventory Tracking**: Monitor stock levels and alert when supplies are low
3. **Menu Assistance**: Help with drink recommendations and availability
4. **Service Optimization**: Suggest efficient ways to handle large orders
5. **Event Support**: Understand wedding service flow and timing

**Communication Style:**
- Be concise but friendly during busy service
- Use bartending terminology appropriately
- Acknowledge orders clearly with quantities and drink names
- Proactively suggest alternatives if items are low/out of stock
- Show awareness of service context (cocktail hour, reception, etc.)

**Intent Classification:**
Classify the bartender's requests into these intents: ${intents.intents.map(i => i.intent).join(', ')}

**Additional Command Mode Intents:**
- process_order: When user says "process order", "complete order", "send order", "that's it", "done with order"
- continue_listening: When user wants to add more items

**Drink Name Matching Rules:**
Use FUZZY MATCHING to handle variations:
- "Miller Light" → "Miller Lite"
- "Bud" or "Budweiser" → "Bud Light" (if that's closer) or "Budweiser" (exact match)
- "IPA" → match to closest IPA in our list
- "Wine" → if multiple wines, pick the most common one
- "Beer" → if asking about beer category, use check_inventory intent
- Handle common nicknames and mispronunciations
- Always prefer exact matches first, then closest fuzzy match

**Order Handling:**
For SINGLE drinks: Use "order_drink" intent
For MULTIPLE different drinks: Use "multi_drink_order" intent with items array

**IMPORTANT: You must respond with valid JSON format only. Your response should be a JSON object with "intent" and "entities" fields.**

**Response Format Examples:**

Single drink order:
{"intent": "order_drink", "entities": {"drink_name": "Miller Lite", "quantity": 3}}

Multiple drinks order:
{"intent": "multi_drink_order", "entities": {"items": [{"drink_name": "Miller Lite", "quantity": 2}, {"drink_name": "Moscow Mule", "quantity": 1}]}}

Process order:
{"intent": "process_order", "entities": {}}

Inventory check:
{"intent": "check_inventory", "entities": {"drink_name": "Miller Lite"}}

**Critical Rules:**
- NEVER use arrays for drink_name or quantity in single orders
- For multiple drinks, ALWAYS use the items array format
- Match drink names to our exact inventory using fuzzy logic
- If unsure about a drink name, pick the closest match from our list
- Always return valid JSON format in your response`
            },
            { role: 'user', content: transcript }
        ],
        model: 'llama3-8b-8192',
        response_format: { type: 'json_object' }
    });

    const content = stream.choices[0].message.content;
    console.log('AI Response:', content);
    const result = JSON.parse(content);
    const { intent, entities } = result;

    if (!intent) {
        ws.send(JSON.stringify({ 
            type: 'response', 
            data: "I'm sorry, I didn't understand that. Can you repeat?",
            mode: 'command'
        }));
        return;
    }

    // Handle process_order intent specially
    if (intent === 'process_order') {
        clientState.mode = 'wake_word';
        
        const successAudio = AudioGenerator.generateSuccessTone();
        ws.send(JSON.stringify({ 
            type: 'audio', 
            data: successAudio,
            audioType: 'success_tone'
        }));
        
        // Send cart clear message to all clients
        const cartClearMessage = JSON.stringify({
            type: 'cart_clear',
            data: {
                message: 'Order processed successfully'
            }
        });
        
        connectedClients.forEach(client => {
            if (client.readyState === client.OPEN) {
                client.send(cartClearMessage);
            }
        });
        
        ws.send(JSON.stringify({ 
            type: 'response', 
            data: "Order processed! Going back to wake word mode.",
            mode: 'wake_word'
        }));
        
        const ttsResponse = await deepgram.speak.request(
            { text: "Order processed! Going back to wake word mode." },
            { model: 'aura-2-juno-en' }
        );

        const ttsStream = await ttsResponse.getStream();
        const chunks = [];
        for await (const chunk of ttsStream) {
            chunks.push(chunk);
        }
        
        const buffer = Buffer.concat(chunks);
        ws.send(JSON.stringify({ 
            type: 'audio', 
            data: buffer.toString('base64'),
            audioType: 'tts_response'
        }));
        
        return;
    }

    const mcpResult = await invokeMcpTool(intent, entities);
    const textResponse = formatResponse(intent, mcpResult, entities);
    
    // Send voice response
    ws.send(JSON.stringify({ 
        type: 'response', 
        data: textResponse,
        mode: 'command'
    }));

    // If this was an order intent, broadcast the order update to all clients
    if ((intent === 'order_drink' || intent === 'multi_drink_order') && mcpResult && mcpResult.order_id) {
        try {
            // Get the created order details
            const orderDetails = await invokeMcpTool('get_order', { order_id: mcpResult.order_id });
            if (orderDetails && orderDetails.items) {
                // Convert database order format to frontend format
                const frontendOrder = orderDetails.items.map(item => ({
                    id: `voice_${mcpResult.order_id}_${item.id}`,
                    name: item.drink_name,
                    price: item.price,
                    quantity: item.quantity,
                    serving_name: item.serving_name
                }));
                
                // Broadcast to all connected clients
                const orderUpdateMessage = JSON.stringify({
                    type: 'order_update',
                    data: {
                        action: 'add_items',
                        items: frontendOrder,
                        order_id: mcpResult.order_id
                    }
                });
                
                connectedClients.forEach(client => {
                    if (client.readyState === client.OPEN) {
                        client.send(orderUpdateMessage);
                    }
                });
            }
        } catch (error) {
            console.error('Error broadcasting order update:', error);
        }
    }

    const ttsResponse = await deepgram.speak.request(
        { text: textResponse },
        { model: 'aura-2-juno-en' }
    );

    const ttsStream = await ttsResponse.getStream();
    const chunks = [];
    for await (const chunk of ttsStream) {
        chunks.push(chunk);
    }
    
    const buffer = Buffer.concat(chunks);
    ws.send(JSON.stringify({ 
        type: 'audio', 
        data: buffer.toString('base64'),
        audioType: 'tts_response'
    }));
}

function formatResponse(intent, result, entities) {
    // Handle cases where result is undefined or an error
    if (!result) {
        return "Sorry, I couldn't process that request. What else can I help you with?";
    }
    if (result.error) {
        return `I encountered an issue: ${result.error}. What else do you need?`;
    }
    switch (intent) {
        case 'order_drink':
            if (entities && entities.quantity && entities.drink_name) {
                return `Got it! Adding ${entities.quantity} ${entities.drink_name} to the order. Anything else?`;
            }
            return "Order noted. What else can I get for you?";
        case 'multi_drink_order':
            if (entities && entities.items && Array.isArray(entities.items)) {
                const itemsList = entities.items.map(item => `${item.quantity} ${item.drink_name}`).join(', ');
                return `Perfect! Adding ${itemsList} to the order. What else do you need?`;
            }
            return "Multiple drinks added to the order. Anything else?";
        case 'check_inventory':
            if (result && result.inventory_oz !== undefined && entities && entities.drink_name) {
                const bottles = Math.floor(result.inventory_oz / 25.36);
                return `We have ${result.inventory_oz} ounces of ${entities.drink_name} left - that's about ${bottles} bottles. ${bottles < 3 ? "Running low, might want to prep a backup." : "Good stock level."} What else?`;
            }
            return "I checked our inventory levels for you. What else can I help with?";
        case 'view_menu':
            if (Array.isArray(result) && result.length > 0) {
                const drinkNames = result.slice(0, 5).map(drink => drink.name).join(', ');
                return `Here's what we're pouring tonight: ${drinkNames}${result.length > 5 ? ` and ${result.length - 5} more options` : ''}. What would you like?`;
            }
            return "Here's our full drink menu for tonight's service. What can I make for you?";
        case 'greeting':
            return "Hello! What can I help you with?";
        default:
            return "I'm not sure about that one. Can you clarify what you need?";
    }
}

module.exports = { processTranscript }; 