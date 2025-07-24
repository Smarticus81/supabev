require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });
const { Groq } = require('groq-sdk');
const { createClient } = require('@deepgram/sdk');
const { ElevenLabsClient } = require('@elevenlabs/elevenlabs-js');
const { HumeClient } = require('hume');
const { invokeMcpTool } = require('./mcp-client');
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

// States: 'command', 'processing'
function getClientState(clientId) {
    if (!clientStates.has(clientId)) {
        clientStates.set(clientId, {
            mode: 'command', // Default to command mode
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

// Get available drinks from database via API
async function getAvailableDrinks() {
  try {
    // Use Node.js built-in fetch (Node 18+) or fallback
    const fetchFn = global.fetch || require('node-fetch');
    const response = await fetchFn('http://localhost:3000/api/drinks');
    const drinks = await response.json();
    return drinks.map(d => d.name);
  } catch (error) {
    console.error('Error getting drinks from API:', error);
    // Fallback to static list if API is not available
    return [
      'Bud Light', 'Coors Light', 'Miller Lite', 'Heineken', 'Corona Extra',
      'Stella Artois', 'Dos XX', 'White Claw', "Truly's Seltzer", 'Michelob Ultra',
      'Shiner Bock', "Tito's Vodka", 'G.Goose Vodka', 'Captain Morgan'
    ];
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

async function processTranscript(transcript, ws, connectedClients = new Set(), mode = null) {
    try {
        const clientId = ws;
        const clientState = getClientState(clientId);
        
        // Update mode if provided
        if (mode && mode !== clientState.mode) {
            console.log(`Mode changed from ${clientState.mode} to ${mode}`);
            clientState.mode = mode;
        }
        
        // Prevent duplicate processing
        if (clientState.isProcessing) {
            console.log('Already processing, skipping duplicate:', transcript);
            return;
        }
        
        console.log(`[${clientState.mode.toUpperCase()}] Transcript: "${transcript}"`);

        // Update last activity
        clientState.lastActivity = Date.now();

        // Always handle as command
        return await handleCommandMode(transcript, ws, clientState, connectedClients);

    } catch (error) {
        console.error("Error in processTranscript:", error);
        const clientState = getClientState(ws);
        clientState.isProcessing = false; // Reset processing flag
        
        // Provide more specific error responses based on error type
        let errorMessage = "Sorry, I'm having a bit of trouble right now. Let's try that again.";
        
        if (error.name === 'SyntaxError') {
            errorMessage = "That didn't quite parse right. Could you rephrase it for me?";
        } else if (error.message && error.message.includes('timeout')) {
            errorMessage = "Timed out there. Give it another shot.";
        } else if (error.message && error.message.includes('connection')) {
            errorMessage = "Connection hiccup. Trying again?";
        } else {
            errorMessage = "Hmm, something's off. What were you saying?";
        }
        
        await sendResponse(ws, errorMessage, 'command');
        // Don't force back to wake_word mode, stay in command mode for retry
    }
}

// Improved response sending with better error handling and speculative acknowledgments
async function sendResponse(ws, message, mode = 'command', audioType = 'tts_response', isSpeculative = false) {
    try {
        // Send text response
        ws.send(JSON.stringify({ 
            type: 'response', 
            data: message,
            mode: mode,
            isSpeculative
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

                    // Build utterance
                    const utterance = {
                        text: message.substring(0, 500),
                        voice: tts_voice,
                        prosody: {
                            style: 'conversational'
                        }
                    };

                    const ttsStream = await hume.empathicVoice.speech.synthesize(utterance);
                    const chunks = [];
                    for await (const chunk of ttsStream) {
                        chunks.push(chunk);
                    }
                    buffer = Buffer.concat(chunks);
                } else if (tts_provider === 'rime') {
                    const rime = require('rime-sdk-nodejs');
                    const rimeApiKey = process.env.RIME_API_KEY;

                    const client = new rime.RimeClient(rimeApiKey);
                    const speakerId = tts_voice;
                    const samplingRate = 22050; // Use 22050 or 44100 as per Rime docs

                    const audioContent = await client.speech.synthesize(
                        message.substring(0, 200),
                        speakerId,
                        samplingRate
                    );
                    
                    buffer = Buffer.from(audioContent);
                }

                if (buffer) {
                    ws.send(JSON.stringify({ 
                        type: 'audio', 
                        data: buffer.toString('base64'), 
                        audioType: audioType 
                    }));
                }
            } catch (ttsError) {
                console.error('Error generating or sending TTS audio:', ttsError);
            }
        }

    } catch (error) {
        console.error('Error sending response:', error);
    }
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
        
        // Send speculative acknowledgment for low latency feel
        const speculativeAck = getSpeculativeAcknowledgment(transcript);
        if (speculativeAck) {
            await sendResponse(ws, speculativeAck, 'command', 'tts_ack', true);
        }

        // Process the command using improved AI logic
        const result = await processWithImprovedAI(transcript, clientState);
        
        if (!result || !result.intent) {
            await sendResponse(ws, "Sorry, I didn't quite get that. Could you say it again?", 'command');
            return;
        }

        const { intent, entities, reasoning, conversational_response } = result;
        console.log(`AI Intent: ${intent}, Reasoning: ${reasoning}`);
        
        // Enhanced entity validation and normalization
        const normalizedEntities = await enhancedEntityNormalization(intent, entities, clientState);
        console.log('Enhanced normalized entities:', normalizedEntities);
        
        // Validate and execute the intent
        await executeIntent(intent, normalizedEntities, conversational_response, transcript, ws, clientState, connectedClients);
        
    } finally {
        clientState.isProcessing = false; // Always reset processing flag
    }
}

// New function for speculative speech acknowledgments
function getSpeculativeAcknowledgment(transcript) {
    const lowerTranscript = transcript.toLowerCase();
    if (lowerTranscript.includes('add') || lowerTranscript.includes('order')) {
        return "Adding that now...";
    } else if (lowerTranscript.includes('check') || lowerTranscript.includes('inventory')) {
        return "Checking stock...";
    } else if (lowerTranscript.includes('total') || lowerTranscript.includes('cart')) {
        return "Pulling up the cart...";
    } else if (lowerTranscript.includes('remove') || lowerTranscript.includes('clear')) {
        return "Updating the cart...";
    } else if (lowerTranscript.includes('insight') || lowerTranscript.includes('sales')) {
        return "Analyzing data...";
    }
    return null; // No speculative ack if unclear
}

async function processWithImprovedAI(transcript, clientState) {
    const availableDrinks = getAvailableDrinks();
    const drinksList = availableDrinks.join(', ');
    
    // Build enhanced conversation context
    const context = buildEnhancedContext(clientState);
    
    const systemPrompt = `You are "Bev," an expert AI assistant for bartenders at an upscale wedding venue. Think of yourself as the seasoned, lightning-fast colleague behind the bar—always one step ahead, never missing a beat.

**Your Core Directives**
• **Blazing Speed:** Respond instantly. Open with speculative acknowledgements like "Got it," "On it," or "Checking..." to signal immediate action.
• **Proactive Partner:** Anticipate needs. If stock is low, suggest alternatives. If multiple liquors are added, ask if mixers are needed. Be the bartender’s extra set of eyes and intuition.
• **Friendly Professionalism:** Sound like an experienced coworker—warm, concise, never robotic. Vary phrasing to avoid repetition while keeping responses under ~50 words for rapid TTS.
• **Insight Driven:** Leverage inventory & sales data for quick insights ("2 bottles left—running low" or "Tito's, White Claw, and Jameson are tonight’s top sellers").
• **Accuracy Above All:** Only match drink names that exist. If unsure, clarify naturally ("Did you mean Patron Silver or Don Julio?").

**Available Drinks:** ${drinksList}

**Conversation Context:**
${context}

**Valid Intents (use exactly):** check_inventory, add_inventory, cart_add, cart_add_multiple, cart_remove, cart_view, cart_clear, cart_create_order, view_menu, conversation, goodbye, inventory_insights, sales_insights.

**Entity Rules**
• drink_name: exact inventory match (use fuzzy only when confident).
• quantity: positive integer (default 1).
• items: array for multiples → [{"drink_name":"Exact","quantity":2}].

**Strict JSON Response Format**
{
  "intent": "one_of_valid_intents",
  "entities": {"key":"value"},
  "reasoning": "brief_reasoning",
  "conversational_response": "brief_natural_reply"
}

Keep JSON minified with no extra keys. If intent/entities are ambiguous, return intent "conversation" asking for clarification.`;

    try {
        const stream = await groq.chat.completions.create({
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: transcript }
            ],
            model: 'llama3-70b-8192',
            response_format: { type: 'json_object' },
            temperature: 0.6 // Slightly higher for varied natural language
        });

        const content = stream.choices[0].message.content;
        console.log('AI Response:', content);
        return JSON.parse(content);
    } catch (error) {
        console.error('Error processing with AI:', error);
        
        // Specific fallbacks
        let fallbackResponse = "Didn't get that. Try again?";
        
        if (error.status === 400) {
            fallbackResponse = "Bad input—rephrase?";
        } else if (error.status === 429) {
            fallbackResponse = "Busy signal. Retry in a sec.";
        } else if (error.message && error.message.includes('timeout')) {
            fallbackResponse = "Timed out. Shorter command?";
        } else if (error.message && error.message.includes('json')) {
            fallbackResponse = "Parsing issue. Be specific?";
        }
        
        return {
            intent: 'conversation',
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

async function executeIntent(intent, entities, conversationalResponse, transcript, ws, clientState, connectedClients) {
    console.log(`Executing intent: ${intent} with entities:`, entities);
    
    // Validate required entities for critical intents
    if (!validateEntitiesForIntent(intent, entities)) {
        await sendResponse(ws, 
            conversationalResponse || "Need more details—can you specify?", 
            'command'
        );
        return;
    }
    
    // Handle conversation intent without MCP tools
    if (intent === 'conversation') {
        const responseText = conversationalResponse || "What's up? How can I help with the bar?";
        await sendResponse(ws, responseText, 'command');
        updateConversationContext(clientState, intent, entities, responseText, transcript);
        return;
    }

    // Add client ID for cart-related operations - use consistent 'default' clientId
    if (['cart_add', 'cart_remove', 'cart_view', 'cart_clear', 'cart_add_multiple', 'cart_create_order'].includes(intent)) {
        entities.clientId = 'default'; // Use consistent client ID for voice cart synchronization
    }
    
    // Execute MCP tool with enhanced error handling
    let mcpResult;
    try {
        mcpResult = await invokeMcpTool(intent, entities);
        console.log('MCP Result:', mcpResult);
        
        if (mcpResult && mcpResult.error) {
            console.error('MCP returned error:', mcpResult.error);
            let errorMessage = `Issue: ${mcpResult.error}. Retry?`;
            if (mcpResult.error.includes('Unknown tool')) {
                errorMessage = "That action isn't available yet. What else can I do?";
            }
            await sendResponse(ws, errorMessage, 'command');
            return;
        }
        
    } catch (error) {
        console.error('MCP Tool Error:', error);
        await sendResponse(ws, "Couldn't process—system glitch. Try again?", 'command');
        return;
    }

    // Generate and send response
    const responseText = generateEnhancedResponse(intent, mcpResult, entities, conversationalResponse);
    await sendResponse(ws, responseText, 'command');

    // Update conversation context after response
    updateConversationContext(clientState, intent, entities, responseText, transcript);
    
    // Broadcast cart updates for relevant operations
    if (['cart_add', 'cart_remove', 'cart_clear', 'cart_add_multiple', 'cart_create_order'].includes(intent) && mcpResult) {
        await broadcastCartUpdate('default', connectedClients); // Use consistent 'default' clientId
    }
    
    // Broadcast inventory updates for operations that affect inventory
    if (['add_inventory', 'cart_create_order', 'create_order'].includes(intent) && mcpResult && mcpResult.success) {
        await broadcastInventoryUpdate(connectedClients);
    }
    
    // Send command completion message to return to wake word mode
    ws.send(JSON.stringify({ type: 'processing_complete' }));
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
    let enhanced = aiResponse;
    switch (intent) {
        case 'check_inventory':
            if (mcpResult && mcpResult.inventory_oz !== undefined && mcpResult.name) {
                const units = calculateUnits(mcpResult);
                const unitName = getUnitName(mcpResult);
                let insight;
                if (units < 3) {
                    insight = Math.random() > 0.5 ? "Heads up, running low—time to restock?" : "Stock's low, might want to grab more soon.";
                } else if (units < 10) {
                    insight = Math.random() > 0.5 ? "Decent amount left, but keep an eye." : "Moderate supply remaining.";
                } else {
                    insight = Math.random() > 0.5 ? "Plenty in stock right now." : "We're good on that one.";
                }
                enhanced += ` ${units} ${unitName} of ${mcpResult.name} available. ${insight}`;
            }
            break;
        case 'cart_view':
            if (mcpResult && mcpResult.cart) {
                if (mcpResult.cart.length === 0) {
                    enhanced += " Cart's clear. Anything to add?";
                } else {
                    const itemCount = mcpResult.cart.reduce((sum, item) => sum + item.quantity, 0);
                    const totalPrice = mcpResult.totalPrice || mcpResult.cart.reduce((sum, item) => sum + (item.quantity * item.price), 0).toFixed(2);
                    const cartItems = mcpResult.cart.map(item => `${item.quantity}x ${item.drink_name}`).join(', ');
                    enhanced += ` ${itemCount} items: ${cartItems}. Comes to $${totalPrice}. All set?`;
                }
            }
            break;
        case 'inventory_insights':
            if (mcpResult && mcpResult.lowStock) {
                const lowItems = mcpResult.lowStock.map(item => `${item.name} (${item.units} left)`).join(', ');
                enhanced += ` Low items: ${lowItems || 'All good'}.`;
            }
            break;
        case 'sales_insights':
            if (mcpResult && mcpResult.topSellers) {
                const top = mcpResult.topSellers.slice(0, 3).map(s => s.name).join(', ');
                enhanced += ` Hottest sellers: ${top}. Steady trends.`;
            }
            break;
        default:
            // Append general success if needed
            enhanced += mcpResult.success ? " All done." : "";
    }
    return enhanced.trim();
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

function updateConversationContext(clientState, intent, entities, response, transcript) {
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
        transcript: transcript || 'unknown',
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
        return "Couldn't complete that. Retry?";
    }
    if (result.error) {
        return `Error: ${result.error}. Fix and try again?`;
    }

    switch (intent) {
        case 'check_inventory':
            if (result && result.inventory_oz !== undefined && result.name) {
                const units = calculateUnits(result);
                const insight = units < 3 ? "Alert: Low—restock." : "Good.";
                return `${units} ${getUnitName(result)} of ${result.name}. ${insight}`;
            }
            return "Inventory checked.";
        case 'cart_add':
            if (result && result.success) {
                return `${result.message || 'Added.'} Next?`;
            }
            return "Item added.";
        case 'cart_view':
            if (result && result.cart) {
                if (result.cart.length === 0) {
                    return "Empty cart. Add something?";
                } else {
                    return result.message + " Ready?";
                }
            }
            return "Cart updated.";
        default:
            return result.message || "Processed. Next task?";
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

module.exports = { processTranscript }; 