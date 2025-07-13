require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });
const { Groq } = require('groq-sdk');
const { createClient } = require('@deepgram/sdk');
const { ElevenLabsClient } = require('@elevenlabs/elevenlabs-js');
const { HumeClient } = require('hume');
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
const elevenlabs = new ElevenLabsClient({ apiKey: process.env.ELEVENLABS_API_KEY });

// Voice assistant state management
const clientStates = new Map();

// States: 'wake_word', 'command', 'processing'
function getClientState(clientId) {
    if (!clientStates.has(clientId)) {
        clientStates.set(clientId, {
            mode: 'wake_word',
            wakeWordDetector: new WakeWordDetector(),
            lastActivity: Date.now(),
            commandBuffer: [],
            lastProcessedTranscript: null,
            lastProcessedTime: 0,
            isProcessing: false, // Prevent duplicate processing
            conversationContext: {
                recentDrinks: [],
                lastIntent: null,
                lastEntities: {},
                recentInventoryChecks: [],
                conversationHistory: [],
                pendingConfirmation: null // Track what needs confirmation
            }
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

// Improved drink name validation and fuzzy matching
function findBestDrinkMatch(inputName, availableDrinks) {
    if (!inputName) return null;
    
    const input = inputName.toLowerCase().trim();
    
    // Exact match first
    const exactMatch = availableDrinks.find(drink => 
        drink.toLowerCase() === input
    );
    if (exactMatch) return exactMatch;
    
    // Partial match - input contains drink name or vice versa
    const partialMatch = availableDrinks.find(drink => {
        const drinkLower = drink.toLowerCase();
        return drinkLower.includes(input) || input.includes(drinkLower);
    });
    if (partialMatch) return partialMatch;
    
    // Common abbreviations and variations
    const variations = {
        'bud': 'Bud Light',
        'coors': 'Coors Light',
        'miller': 'Miller Lite',
        'heineken': 'Heineken',
        'corona': 'Corona Extra',
        'stella': 'Stella Artois',
        'dos': 'Dos XX',
        'white claw': 'White Claw',
        'truly': "Truly's Seltzer",
        'michelob': 'Michelob Ultra',
        'shiner': 'Shiner Bock',
        'titos': "Tito's Vodka",
        'grey goose': 'G.Goose Vodka',
        'captain': 'Captain Morgan',
        'jameson': 'Jameson Whiskey',
        'jack': "JD's Whiskey",
        'makers': 'Makers Mark',
        'patron': 'Patron Silver',
        'don julio': 'Don Julio',
        'bombay': 'Bombay Sapphire',
        'hendricks': 'Hendricks Gin'
    };
    
    const variationMatch = variations[input];
    if (variationMatch && availableDrinks.includes(variationMatch)) {
        return variationMatch;
    }
    
    return null;
}

async function processTranscript(transcript, ws, connectedClients = new Set()) {
    try {
        const clientId = ws;
        const clientState = getClientState(clientId);
        
        // Prevent duplicate processing
        if (clientState.isProcessing) {
            console.log('Already processing, skipping duplicate:', transcript);
            return;
        }
        
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
        const clientState = getClientState(ws);
        clientState.isProcessing = false; // Reset processing flag
        
        // Provide more specific error responses based on error type
        let errorMessage = "I'm sorry, I had trouble processing that.";
        
        if (error.name === 'SyntaxError') {
            errorMessage = "I'm having trouble understanding. Could you try rephrasing?";
        } else if (error.message && error.message.includes('timeout')) {
            errorMessage = "The request timed out. Please try again.";
        } else if (error.message && error.message.includes('connection')) {
            errorMessage = "I'm having connection issues. Please try again in a moment.";
        } else {
            errorMessage = "I'm sorry, something went wrong. What can I help you with?";
        }
        
        await sendResponse(ws, errorMessage, 'command');
        // Don't force back to wake_word mode, stay in command mode for retry
    }
}

// Improved response sending with better error handling
async function sendResponse(ws, message, mode = 'command', audioType = 'tts_response') {
    try {
        // Send text response
        ws.send(JSON.stringify({ 
            type: 'response', 
            data: message,
            mode: mode
        }));

        // Get TTS config from MCP
        const configResult = await invokeMcpTool('get_tts_config');
        const { tts_provider = 'deepgram', tts_voice = 'aura-2-juno-en' } = configResult.config || {};

        // Generate and send TTS only for reasonable length messages
        if (message && message.trim() && message.length < 500) { // Limit TTS to reasonable length
            try {
                let buffer;
                if (tts_provider === 'deepgram') {
                    // Normalize Deepgram voice IDs (map Aura-1 → Aura-2)
                    let finalVoice = tts_voice;
                    if (tts_voice.startsWith('aura-asteria-en')) {
                        finalVoice = 'aura-2-asteria-en';
                    } else if (tts_voice.startsWith('aura-luna-en')) {
                        finalVoice = 'aura-2-luna-en';
                    } else if (tts_voice.startsWith('aura-stella-en')) {
                        finalVoice = 'aura-2-stella-en';
                    } else if (tts_voice.startsWith('aura-juno-en')) {
                        finalVoice = 'aura-2-juno-en';
                    } else if (tts_voice.startsWith('aura-athena-en')) {
                        finalVoice = 'aura-2-athena-en';
                    } else if (tts_voice.startsWith('aura-zeus-en')) {
                        finalVoice = 'aura-2-zeus-en';
                    } else if (tts_voice.startsWith('aura-hera-en')) {
                        finalVoice = 'aura-2-hera-en';
                    } else if (!tts_voice.startsWith('aura-2-')) {
                        finalVoice = 'aura-2-juno-en';
                    }

                    const ttsResponse = await deepgram.speak.request(
                        { text: message.substring(0, 200) }, // Limit to 200 chars for TTS
                        { model: finalVoice }
                    );
                    const ttsStream = await ttsResponse.getStream();
                    const chunks = [];
                    for await (const chunk of ttsStream) {
                        chunks.push(chunk);
                    }
                    buffer = Buffer.concat(chunks);
                } else if (tts_provider === 'elevenlabs') {
                    const audio = await elevenlabs.textToSpeech.convert(tts_voice, {
                        text: message.substring(0, 200),
                        model_id: 'eleven_multilingual_v2'
                    });
                    
                    // Handle different response types from ElevenLabs
                    if (audio instanceof ReadableStream) {
                        const reader = audio.getReader();
                        const chunks = [];
                        while (true) {
                            const { done, value } = await reader.read();
                            if (done) break;
                            chunks.push(value);
                        }
                        buffer = Buffer.concat(chunks);
                    } else if (audio instanceof ArrayBuffer) {
                        buffer = Buffer.from(audio);
                    } else if (Buffer.isBuffer(audio)) {
                        buffer = audio;
                    } else {
                        throw new Error('Unsupported audio response type');
                    }
                } else if (tts_provider === 'hume') {
                    const hume = new HumeClient({ apiKey: process.env.HUME_API_KEY });
                    const result = await hume.tts.synthesizeJson({
                        utterances: [{ text: message.substring(0, 500) }]
                    });
                    const base64 = result?.generations?.[0]?.audio;
                    if (!base64) {
                        throw new Error('Hume TTS failed');
                    }
                    buffer = Buffer.from(base64, 'base64');
                } else if (tts_provider === 'rime') {
                    const rimeUrl = process.env.RIME_TTS_URL;
                    const rimeKey = process.env.RIME_API_KEY;
                    if (!rimeUrl || !rimeKey) {
                        throw new Error('RIME configuration missing');
                    }
                    const rimeResp = await fetch(rimeUrl, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${rimeKey}`
                        },
                        body: JSON.stringify({ text: message.substring(0, 500) })
                    });
                    if (!rimeResp.ok) {
                        throw new Error('RIME TTS request failed');
                    }
                    const rimeData = await rimeResp.json();
                    if (!rimeData.audio) {
                        throw new Error('Invalid RIME TTS response');
                    }
                    buffer = Buffer.from(rimeData.audio, 'base64');
                } else {
                    throw new Error(`Unsupported TTS provider: ${tts_provider}`);
                }

                ws.send(JSON.stringify({ 
                    type: 'audio', 
                    data: buffer.toString('base64'),
                    audioType: audioType
                }));
            } catch (ttsError) {
                console.warn('TTS generation failed:', ttsError.message);
                // Continue without TTS - text response already sent
            }
        }
    } catch (error) {
        console.error('Error sending response:', error);
        // Send fallback text-only response
        try {
            ws.send(JSON.stringify({ 
                type: 'response', 
                data: message || "Sorry, there was an audio issue.",
                mode: mode
            }));
        } catch (fallbackError) {
            console.error('Failed to send fallback response:', fallbackError);
        }
    }
}

async function broadcastInventoryUpdate(connectedClients) {
    try {
        console.log('Broadcasting inventory update to all clients');
        
        // Fetch current inventory data from database
        const inventoryResponse = await invokeMcpTool('view_menu', {});
        console.log('Inventory response from MCP:', inventoryResponse);
        
        if (!inventoryResponse || !inventoryResponse.drinks) {
            console.log('No inventory response received');
            return;
        }
        
        const inventoryUpdateMessage = JSON.stringify({
            type: 'inventory_update',
            data: {
                drinks: inventoryResponse.drinks,
                timestamp: Date.now()
            }
        });
        console.log('Broadcasting inventory update message');

        connectedClients.forEach(client => {
            if (client.readyState === client.OPEN) {
                console.log('Sending inventory update to client');
                client.send(inventoryUpdateMessage);
            }
        });
    } catch (error) {
        console.error('Error broadcasting inventory update:', error);
    }
}

async function broadcastCartUpdate(clientId, connectedClients) {
    try {
        console.log('Broadcasting cart update for client:', typeof clientId);
        const cartResponse = await invokeMcpTool('cart_view', { clientId });
        console.log('Cart response from MCP:', cartResponse);
        
        if (!cartResponse) {
            console.log('No cart response received');
            return;
        }
        
        const cartArray = cartResponse && cartResponse.cart ? cartResponse.cart : [];
        console.log('Cart array to broadcast:', cartArray);
        
        const cartUpdateMessage = JSON.stringify({
            type: 'cart_update',
            data: {
                cart: cartArray,
                timestamp: Date.now()
            }
        });
        console.log('Broadcasting cart update message:', cartUpdateMessage);

        connectedClients.forEach(client => {
            if (client.readyState === client.OPEN) {
                console.log('Sending cart update to client');
                client.send(cartUpdateMessage);
            }
        });
    } catch (error) {
        console.error('Error broadcasting cart update:', error);
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
        
        await sendResponse(ws, "Hi! Ready for the order.", 'command');
        
        // Set timeout to return to wake word mode if no commands
        setTimeout(() => {
            if (clientState.mode === 'command' && Date.now() - clientState.lastActivity > 30000) {
                clientState.mode = 'wake_word';
                sendResponse(ws, "Just Say Hey Bev when you need me.", 'wake_word');
            }
        }, 30000);
    }
    
    return;
}

async function handleCommandMode(transcript, ws, clientState, connectedClients) {
    // Set processing flag to prevent duplicates
    clientState.isProcessing = true;
    
    try {
        // Prevent processing duplicate transcripts within 3 seconds
        const now = Date.now();
        if (clientState.lastProcessedTranscript === transcript && 
            now - clientState.lastProcessedTime < 3000) {
            console.log('Skipping duplicate transcript:', transcript);
            return;
        }
        
        clientState.lastProcessedTranscript = transcript;
        clientState.lastProcessedTime = now;
        
        // Check for termination first
        const terminationResult = clientState.wakeWordDetector.detectTermination(transcript);
        
        if (terminationResult.detected) {
            console.log(`Termination detected: "${terminationResult.matchedPhrase}"`);
            clientState.mode = 'wake_word';
            await sendResponse(ws, "Thank you!", 'wake_word');
            return;
        }

        // Process the command using improved AI logic
        const result = await processWithImprovedAI(transcript, clientState);
        
        if (!result || !result.intent) {
            await sendResponse(ws, "I'm sorry, I didn't understand that. Can you repeat?", 'command');
            return;
        }

        const { intent, entities, reasoning, conversational_response } = result;
        console.log(`AI Intent: ${intent}, Reasoning: ${reasoning}`);
        
        // Enhanced entity validation and normalization
        const normalizedEntities = await enhancedEntityNormalization(intent, entities, clientState);
        console.log('Enhanced normalized entities:', normalizedEntities);
        
        // Validate and execute the intent
        await executeIntent(intent, normalizedEntities, conversational_response, ws, clientState, connectedClients);
        
    } finally {
        clientState.isProcessing = false; // Always reset processing flag
    }
}

async function processWithImprovedAI(transcript, clientState) {
    const availableDrinks = getAvailableDrinks();
    const drinksList = availableDrinks.join(', ');
    
    // Build enhanced conversation context
    const context = buildEnhancedContext(clientState);
    
    const systemPrompt = `You are "Bev", a friendly, enthusiastic AI bartender assistant who's always ready to help with a smile! I have a bubbly personality, love chatting about drinks, and provide spot-on recommendations and insights. I'm super accurate with orders and inventory, and I can share fun facts or suggestions based on what's popular or running low.

**Available Drinks:** ${drinksList}

**Context:** ${context}

**CRITICAL ACCURACY RULES:**
1. ONLY extract drink names that EXACTLY match our inventory - if unsure, ask nicely!
2. NEVER make up drinks or info - keep it real!
3. For vague requests, chat conversationally to clarify
4. For prices/totals, use "cart_view" and add helpful commentary
5. Always be engaging and personable in responses
6. Provide insights: Suggest alternatives if low stock, mention popular items, etc.

**Valid Intents (ONLY these, plus new ones):**
check_inventory: Check stock with insights (e.g., "Plenty left, it's popular!")
add_inventory: Add stock cheerfully
cart_add: Add drink with confirmation
cart_add_multiple: Add multiples enthusiastically
cart_remove: Remove politely
cart_view: Show cart with total and suggestions
cart_clear: Clear cart confirmingly
cart_create_order: Process order happily
payment_select: User selects payment method (entities: { method: "card" | "cash" })
payment_process: Confirm payment success
view_menu: Show menu with recommendations
conversation: Chat, clarify, be friendly
goodbye: Polite closing after transaction
create_order: Finalize order (deprecated by cart_create_order)
inventory_insights: Provide overall inventory analysis (low stock alerts, popular items)
sales_insights: Share sales trends and top sellers

**Entity Validation:**
- drink_name: Must be EXACT match from inventory list
- quantity: Must be positive integer
- clientId: Automatically added for cart operations
- items: For cart_add_multiple, use array of objects: [{"drink_name": "Bud Light", "quantity": 2}, {"drink_name": "Miller Lite", "quantity": 3}]

**Response Format (must return valid JSON object):**
{
  "intent": "exact_intent_name",
  "entities": {"validated_entities": "values"},
  "reasoning": "why_this_intent_was_chosen",
  "conversational_response": "natural_human_response"
}

**Examples:**
Input: "Check Bud Light inventory" → {"intent": "check_inventory", "entities": {"drink_name": "Bud Light"}}
Input: "What's the total?" → {"intent": "cart_view", "entities": {}}
Input: "How much is my order?" → {"intent": "cart_view", "entities": {}}
Input: "Can I get" → {"intent": "conversation", "entities": {}, "conversational_response": "What would you like?"}
Input: "Add 5 Heineken" → {"intent": "cart_add", "entities": {"drink_name": "Heineken", "quantity": 5}}
Input: "Can I get 2 Bud Light and 3 Miller Lite" → {"intent": "cart_add_multiple", "entities": {"items": [{"drink_name": "Bud Light", "quantity": 2}, {"drink_name": "Miller Lite", "quantity": 3}]}}

**CRITICAL: Only use drink names that exist in our inventory. If uncertain, use "conversation" intent to clarify.**

Please respond with a properly formatted JSON object containing the intent, entities, reasoning, and a fun, natural conversational_response.`;

    try {
        const stream = await groq.chat.completions.create({
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: transcript }
            ],
            model: 'llama3-70b-8192', // Upgrade model for better responses
            response_format: { type: 'json_object' },
            temperature: 0.7 // Slightly higher for more natural language
        });

        const content = stream.choices[0].message.content;
        console.log('AI Response:', content);
        return JSON.parse(content);
    } catch (error) {
        console.error('Error processing with AI:', error);
        
        // Provide more specific error responses based on error type
        let fallbackResponse = "I'm sorry, I had trouble understanding that. Could you repeat?";
        
        if (error.status === 400) {
            fallbackResponse = "I'm having trouble with that request. Could you try saying it differently?";
        } else if (error.status === 429) {
            fallbackResponse = "I'm getting too many requests right now. Please wait a moment and try again.";
        } else if (error.message && error.message.includes('timeout')) {
            fallbackResponse = "That took too long to process. Please try again with a simpler request.";
        } else if (error.message && error.message.includes('json')) {
            fallbackResponse = "I'm having trouble understanding. Could you be more specific about what you'd like?";
        }
        
        return {
            intent: 'conversation',
            entities: {},
            reasoning: 'Error in AI processing - providing fallback response',
            conversational_response: fallbackResponse
        };
    }
}

function buildEnhancedContext(clientState) {
    const context = clientState.conversationContext;
    let contextString = "";
    
    if (context.recentDrinks.length > 0) {
        contextString += `Recent drinks discussed: ${context.recentDrinks.slice(-3).join(', ')}\n`;
    }
    
    if (context.recentInventoryChecks.length > 0) {
        contextString += `Recent inventory checks: ${context.recentInventoryChecks.slice(-2).join(', ')}\n`;
    }
    
    if (context.lastIntent) {
        contextString += `Last action: ${context.lastIntent}\n`;
    }
    
    if (context.pendingConfirmation) {
        contextString += `Pending confirmation: ${context.pendingConfirmation}\n`;
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
        const drinkCounts = {};
        
        // Count occurrences of each drink
        for (const drinkName of drinkNames) {
            if (typeof drinkName === 'string') {
                const bestMatch = findBestDrinkMatch(drinkName, availableDrinks);
                if (bestMatch) {
                    drinkCounts[bestMatch] = (drinkCounts[bestMatch] || 0) + 1;
                }
            }
        }
        
        // Convert to items array
        for (const [drinkName, count] of Object.entries(drinkCounts)) {
            items.push({
                drink_name: drinkName,
                quantity: count,
                serving_name: 'bottle'
            });
        }
        
        normalized.items = items;
        delete normalized.drink_name;
        delete normalized.quantity;
    }
    
    // Enhanced drink name validation and correction for single drinks
    if (normalized.drink_name && typeof normalized.drink_name === 'string') {
        const bestMatch = findBestDrinkMatch(normalized.drink_name, availableDrinks);
        if (bestMatch) {
            normalized.drink_name = bestMatch;
            console.log(`Corrected drink name to: ${bestMatch}`);
        } else {
            console.log(`Invalid drink name: ${normalized.drink_name}`);
            // Don't remove invalid names, let intent handler decide
        }
    }
    
    // Handle multiple drinks in items array
    if (normalized.items && Array.isArray(normalized.items)) {
        normalized.items = normalized.items.map(item => {
            if (item.drink_name) {
                const bestMatch = findBestDrinkMatch(item.drink_name, availableDrinks);
                if (bestMatch) {
                    return { ...item, drink_name: bestMatch };
                }
            }
            return item;
        }).filter(item => item.drink_name); // Remove items without valid drink names
    }
    
    // Validate quantities
    if (normalized.quantity) {
        normalized.quantity = Math.max(1, parseInt(normalized.quantity) || 1);
    }
    
    return normalized;
}

async function executeIntent(intent, entities, conversationalResponse, ws, clientState, connectedClients) {
    console.log(`Executing intent: ${intent} with entities:`, entities);
    
    // Validate required entities for critical intents
    if (!validateEntitiesForIntent(intent, entities)) {
        await sendResponse(ws, 
            conversationalResponse || "I need more information. Can you be more specific?", 
            'command'
        );
        return;
    }
    
    // Handle conversation intent without MCP tools
    if (intent === 'conversation') {
        const responseText = conversationalResponse || "I'm here to help with anything bar-related. What do you need?";
        await sendResponse(ws, responseText, 'command');
        updateConversationContext(clientState, intent, entities, responseText);
        return;
    }

    // Add client ID for cart-related operations
    if (['cart_add', 'cart_remove', 'cart_view', 'cart_clear', 'cart_add_multiple', 'cart_create_order'].includes(intent)) {
        entities.clientId = `client_${ws._socket?.remoteAddress}_${ws._socket?.remotePort}` || `client_${Date.now()}`;
    }
    
    // Execute MCP tool with enhanced error handling
    let mcpResult;
    try {
        mcpResult = await invokeMcpTool(intent, entities);
        console.log('MCP Result:', mcpResult);
        
        if (mcpResult && mcpResult.error) {
            console.error('MCP returned error:', mcpResult.error);
            await sendResponse(ws, `Sorry, there was an issue: ${mcpResult.error}`, 'command');
            return;
        }
        
    } catch (error) {
        console.error('MCP Tool Error:', error);
        await sendResponse(ws, "Sorry, I couldn't process that request right now. Please try again.", 'command');
        return;
    }

    // Update conversation context
    updateConversationContext(clientState, intent, entities, conversationalResponse);
    
    // Broadcast cart updates for relevant operations
    if (['cart_add', 'cart_remove', 'cart_clear', 'cart_add_multiple', 'cart_create_order'].includes(intent) && mcpResult) {
        await broadcastCartUpdate(entities.clientId, connectedClients);
    }
    
    // Broadcast inventory updates for operations that affect inventory
    if (['add_inventory', 'cart_create_order', 'create_order'].includes(intent) && mcpResult && mcpResult.success) {
        await broadcastInventoryUpdate(connectedClients);
    }
    
    // Generate and send response
    const responseText = generateEnhancedResponse(intent, mcpResult, entities, conversationalResponse);
    await sendResponse(ws, responseText, 'command');
}

function validateEntitiesForIntent(intent, entities) {
    switch (intent) {
        case 'check_inventory':
        case 'add_inventory':
            return entities.drink_name && entities.drink_name.trim().length > 0;
        case 'cart_add':
            return entities.drink_name && entities.drink_name.trim().length > 0;
        case 'cart_add_multiple':
            return entities.items && Array.isArray(entities.items) && entities.items.length > 0;
        case 'cart_remove':
            return entities.drink_name && entities.drink_name.trim().length > 0;
        default:
            return true; // Most intents don't require specific validation
    }
}

function generateEnhancedResponse(intent, mcpResult, entities, conversationalResponse) {
    // Use AI conversational response when available and successful
    if (conversationalResponse && mcpResult && !mcpResult.error) {
        return enhanceConversationalResponse(conversationalResponse, intent, mcpResult, entities);
    }
    
    // Fallback to structured responses
    return formatResponse(intent, mcpResult, entities);
}

function enhanceConversationalResponse(aiResponse, intent, mcpResult, entities) {
    switch (intent) {
        case 'check_inventory':
            if (mcpResult && mcpResult.inventory_oz !== undefined && mcpResult.name) {
                const units = calculateUnits(mcpResult);
                const stockStatus = units < 3 ? "running low" : "good stock";
                return `We have ${units} ${getUnitName(mcpResult)} of ${mcpResult.name} left. ${stockStatus === "running low" ? "We're running low, might want to prep a backup." : "Good stock level."} What else can I help with?`;
            }
            break;
        case 'cart_view':
            if (mcpResult && mcpResult.cart) {
                if (mcpResult.cart.length === 0) {
                    return "Your cart is empty. What would you like to order?";
                } else {
                    const itemCount = mcpResult.cart.reduce((sum, item) => sum + item.quantity, 0);
                    const totalPrice = mcpResult.totalPrice || mcpResult.cart.reduce((sum, item) => sum + (item.quantity * item.price), 0).toFixed(2);
                    const cartItems = mcpResult.cart.map(item => `${item.quantity} ${item.drink_name}`).join(', ');
                    return `You have ${itemCount} item${itemCount !== 1 ? 's' : ''} in your cart: ${cartItems}. Your total is $${totalPrice}. Ready to place this order?`;
                }
            }
            break;
        default:
            return aiResponse;
    }
    return aiResponse;
}

function calculateUnits(result) {
    let unitSize = result.unit_volume_oz || 25.36;
    
    if (result.category === "Beer") {
        unitSize = result.subcategory === "Hard Seltzer" ? 12 : 12;
    } else if (result.category === "Wine") {
        unitSize = 25.36;
    } else if (result.category === "Non-Alcoholic") {
        unitSize = 12;
    }
    
    return Math.floor(result.inventory_oz / unitSize);
}

function getUnitName(result) {
    if (result.category === "Beer") {
        return result.subcategory === "Hard Seltzer" ? "cans" : "bottles";
    } else if (result.category === "Wine") {
        return "bottles";
    } else if (result.category === "Non-Alcoholic") {
        return "cans";
    }
    return "bottles";
}

function updateConversationContext(clientState, intent, entities, response) {
    const context = clientState.conversationContext;
    
    context.lastIntent = intent;
    context.lastEntities = { ...entities };
    
    if (entities.drink_name) {
        const existingIndex = context.recentDrinks.indexOf(entities.drink_name);
        if (existingIndex > -1) {
            context.recentDrinks.splice(existingIndex, 1);
        }
        context.recentDrinks.push(entities.drink_name);
        if (context.recentDrinks.length > 5) {
            context.recentDrinks.shift();
        }
    }
    
    if (intent === 'check_inventory' && entities.drink_name) {
        const existingIndex = context.recentInventoryChecks.indexOf(entities.drink_name);
        if (existingIndex > -1) {
            context.recentInventoryChecks.splice(existingIndex, 1);
        }
        context.recentInventoryChecks.push(entities.drink_name);
        if (context.recentInventoryChecks.length > 3) {
            context.recentInventoryChecks.shift();
        }
    }
    
    const contextEntry = {
        intent,
        entities: { ...entities },
        response,
        timestamp: Date.now()
    };
    context.conversationHistory.push(contextEntry);
    if (context.conversationHistory.length > 10) {
        context.conversationHistory.shift();
    }
}

function formatResponse(intent, result, entities) {
    if (!result) {
        return "Sorry, I couldn't process that request. What else can I help you with?";
    }
    if (result.error) {
        return `I encountered an issue: ${result.error}. What else do you need?`;
    }
    
    switch (intent) {
        case 'check_inventory':
            if (result && result.inventory_oz !== undefined && result.name) {
                const units = calculateUnits(result);
                return `We have ${units} ${getUnitName(result)} of ${result.name} left. ${units < 3 ? "Running low, might want to prep a backup." : "Good stock level."} What else?`;
            }
            return "I checked our inventory levels for you. What else can I help with?";
        case 'cart_add':
            if (result && result.success) {
                return `${result.message || 'Added to cart.'} What else can I get you?`;
            }
            return "Added to cart. What else would you like?";
        case 'cart_view':
            if (result && result.cart) {
                if (result.cart.length === 0) {
                    return "Your cart is empty. What would you like to order?";
                } else {
                    return result.message + " Ready to place this order?";
                }
            }
            return "Here's what you have so far.";
        default:
            return result.message || "Request processed. What else can I help with?";
    }
}

module.exports = { processTranscript }; 