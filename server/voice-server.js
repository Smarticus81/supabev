require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });
const punycode = require('punycode');
const WebSocket = require('ws');
const { Writable } = require('stream');
const { processTranscript } = require('./intent-processor');
const OpenAI = require('openai');
const { cartBroadcaster } = require('../lib/cart-broadcaster');

if (!process.env.OPENAI_API_KEY) {
  console.error('The OPENAI_API_KEY environment variable is missing. Please add it to your .env file.');
  process.exit(1);
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const port = 3002;
const wss = new WebSocket.Server({ port });

// Heartbeat interval (ms)
const HEARTBEAT_INTERVAL = 15000;
const HEARTBEAT_TIMEOUT = 30000;

const AGENT_STATE = {
  IDLE: 'idle',
  LISTENING: 'listening',
  PROCESSING: 'processing',
  SPEAKING: 'speaking',
};

const CLIENT_MODE = {
  INACTIVE: 'inactive',
  WAKE_WORD: 'wake_word',
  COMMAND: 'command',
  PROCESSING: 'processing'
};

wss.on('connection', (ws) => {
  console.log('Client connected to OpenAI WebRTC voice server');
  // Register with cart broadcaster
  cartBroadcaster.addClient(ws);
  
  let agentState = AGENT_STATE.IDLE;
  let clientMode = CLIENT_MODE.INACTIVE;

  // Function to update agent state and notify client
  const setAgentState = (newState) => {
    agentState = newState;
    ws.send(JSON.stringify({ type: 'agent_state', state: newState }));
  };

  // Function to update client mode
  const setClientMode = (newMode) => {
    console.log(`Client mode changed: ${clientMode} -> ${newMode}`);
    clientMode = newMode;
  };

  // Function to check for wake word in transcript
  const checkForWakeWord = (transcript) => {
    const normalizedTranscript = transcript.toLowerCase().trim();
    const wakeWords = [
      'hey bev', 'bev', 'beverage', 'hey beverage'
    ];
    
    return wakeWords.some(word => normalizedTranscript.includes(word));
  };

  // Heartbeat mechanism
  let isAlive = true;
  ws.isAlive = true;
  
  ws.on('pong', () => {
    ws.isAlive = true;
  });

  const heartbeat = setInterval(() => {
    if (ws.isAlive === false) {
      console.log('Client heartbeat failed, terminating connection');
      cartBroadcaster.removeClient(ws);
      return ws.terminate();
    }
    
    ws.isAlive = false;
    ws.ping();
  }, HEARTBEAT_INTERVAL);

  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message);
      console.log('Received message:', data);

      switch (data.type) {
        case 'start_listening':
          console.log('🎤 Starting OpenAI WebRTC listening mode');
          setAgentState(AGENT_STATE.LISTENING);
          setClientMode(CLIENT_MODE.COMMAND);
          break;

        case 'stop_listening':
          console.log('🛑 Stopping listening mode');
          setAgentState(AGENT_STATE.IDLE);
          setClientMode(CLIENT_MODE.INACTIVE);
          break;

        case 'audio_data':
          // Handle audio data for OpenAI WebRTC (this would be handled by the browser WebRTC implementation)
          console.log('📡 Audio data received (WebRTC handles this)');
          break;

        case 'wake_word_detected':
          console.log('👂 Wake word detected via client');
          setAgentState(AGENT_STATE.LISTENING);
          setClientMode(CLIENT_MODE.COMMAND);
          
          // Send acknowledgment
          ws.send(JSON.stringify({
            type: 'wake_word_acknowledged',
            message: 'Wake word detected, ready for command'
          }));
          break;

        default:
          console.log('Unknown message type:', data.type);
      }
    } catch (error) {
      console.error('Error processing message:', error);
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Failed to process message'
      }));
    }
  });

  ws.on('close', () => {
    console.log('Client disconnected');
    cartBroadcaster.removeClient(ws);
    clearInterval(heartbeat);
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
    cartBroadcaster.removeClient(ws);
    clearInterval(heartbeat);
  });

  // Send initial state
  setAgentState(AGENT_STATE.IDLE);
  
  // Send welcome message
  ws.send(JSON.stringify({
    type: 'connected',
    message: 'Connected to premium OpenAI WebRTC voice server',
    capabilities: ['wake_word_detection', 'real_time_conversation', 'cart_management']
  }));
});

// Cleanup on server shutdown
const cleanup = () => {
  console.log('🧹 Shutting down voice server...');
  wss.close();
};

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

console.log(`🚀 Premium OpenAI WebRTC Voice Server running on port ${port}`);
console.log('🎯 Features: Real-time conversation, Wake word detection, Cart management');
console.log('🔊 Voice Provider: OpenAI Realtime API with WebRTC');