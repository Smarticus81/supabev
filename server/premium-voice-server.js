/**
 * Premium WebRTC Voice Server with Web Speech API Integration
 * State-of-the-art voice processing with P2P connectivity
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });
const WebSocket = require('ws');
const OpenAI = require('openai');
const { processTranscript } = require('./intent-processor');

if (!process.env.OPENAI_API_KEY) {
  console.error('The OPENAI_API_KEY environment variable is missing. Please add it to your .env file.');
  process.exit(1);
}

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Premium Voice Server Configuration
const VOICE_SERVER_PORT = 3002;
const SIGNALING_SERVER_PORT = 3003;

// Voice Modes
const VOICE_MODE = {
  WAKE_WORD: 'wake_word',
  COMMAND: 'command',
  PROCESSING: 'processing',
  INACTIVE: 'inactive'
};

// Agent States
const AGENT_STATE = {
  IDLE: 'idle',
  LISTENING: 'listening',
  PROCESSING: 'processing',
  SPEAKING: 'speaking'
};

class PremiumVoiceServer {
  constructor() {
    this.clients = new Map();
    this.voiceServer = null;
    this.signalingServer = null;
    this.commandModeTimers = new Map(); // For inactivity timeout in command mode
  }

  // Initialize premium voice servers
  async initialize() {
    try {
      console.log('🚀 Initializing Premium WebRTC Voice Infrastructure...');
      
      // Start WebRTC signaling server
      await this.startSignalingServer();
      
      // Start voice processing server
      await this.startVoiceServer();
      
      console.log('✅ Premium Voice Infrastructure Ready');
      console.log(`📡 Signaling Server: ws://localhost:${SIGNALING_SERVER_PORT}`);
      console.log(`🎤 Voice Server: ws://localhost:${VOICE_SERVER_PORT}`);
      console.log('🎯 Using Web Speech API for speech recognition');
      
    } catch (error) {
      console.error('❌ Failed to initialize premium voice infrastructure:', error);
      process.exit(1);
    }
  }

  // Start WebRTC signaling server
  async startSignalingServer() {
    this.signalingServer = new WebSocket.Server({ 
      port: SIGNALING_SERVER_PORT,
      perMessageDeflate: false // Disable compression for lower latency
    });

    this.signalingServer.on('connection', (ws) => {
      console.log('📡 WebRTC signaling client connected');
      
      ws.on('message', (message) => {
        try {
          const data = JSON.parse(message);
          console.log('📡 Signaling message:', data.type);
          
          // Broadcast signaling messages to other clients
          this.signalingServer.clients.forEach(client => {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify(data));
            }
          });
          
        } catch (error) {
          console.error('📡 Signaling message error:', error);
        }
      });

      ws.on('close', () => {
        console.log('📡 WebRTC signaling client disconnected');
      });
    });

    console.log(`📡 WebRTC Signaling Server started on port ${SIGNALING_SERVER_PORT}`);
  }

  // Start voice processing server
  async startVoiceServer() {
    this.voiceServer = new WebSocket.Server({ 
      port: VOICE_SERVER_PORT,
      perMessageDeflate: false,
      maxPayload: 1024 * 1024, // 1MB max payload for audio
      clientTracking: true,
      // Optimize for low latency
      verifyClient: (info) => {
        // Fast client verification
        return true;
      }
    });

    this.voiceServer.on('connection', (ws) => {
      const clientId = this.generateClientId();
      console.log(`🎤 Premium voice client connected: ${clientId}`);
      
      // Initialize client state
      const clientState = {
        id: clientId,
        voiceMode: VOICE_MODE.WAKE_WORD,
        agentState: AGENT_STATE.IDLE,
        lastActivity: Date.now(),
        speechRecognitionActive: false
      };
      
      this.clients.set(ws, clientState);
      
      // Set up premium client handlers
      this.setupClientHandlers(ws, clientState);
      
      // Send welcome message
      this.sendToClient(ws, {
        type: 'connected',
        message: 'Premium Voice Server Connected - Using Web Speech API',
        timestamp: Date.now()
      });
    });

    console.log(`🎤 Premium Voice Server started on port ${VOICE_SERVER_PORT}`);
  }

  // Setup client event handlers
  setupClientHandlers(ws, clientState) {
    ws.on('message', async (message) => {
      try {
        clientState.lastActivity = Date.now();
        
        // Convert message to string and parse as JSON
        const messageString = message.toString();
        const controlMessage = JSON.parse(messageString);
        await this.handleControlMessage(ws, clientState, controlMessage);
        
      } catch (error) {
        console.error(`🎤 Client message error for ${clientState.id}:`, error);
        console.error(`🎤 Raw message received:`, message);
      }
    });

    ws.on('close', () => {
      console.log(`🎤 Premium voice client disconnected: ${clientState.id}`);
      this.cleanupClient(ws, clientState);
    });

    ws.on('error', (error) => {
      console.error(`🎤 Client error (${clientState.id}):`, error);
      this.cleanupClient(ws, clientState);
    });

    // Set up heartbeat
    ws.isAlive = true;
    ws.on('pong', () => {
      ws.isAlive = true;
    });
  }

  // Handle control messages
  async handleControlMessage(ws, clientState, message) {
    console.log(`🎤 Control message from ${clientState.id}:`, message.type);
    
    switch (message.type) {
      case 'mode_change':
        await this.handleModeChange(ws, clientState, message.mode);
        break;
      
      case 'transcript':
        await this.handleTranscript(ws, clientState, message);
        break;
      
      case 'speech_start':
        clientState.agentState = AGENT_STATE.LISTENING;
        this.sendToClient(ws, { type: 'agent_state', state: AGENT_STATE.LISTENING });
        break;
        
      case 'speech_end':
        clientState.agentState = AGENT_STATE.IDLE;
        this.sendToClient(ws, { type: 'agent_state', state: AGENT_STATE.IDLE });
        break;
      
      case 'ping':
        this.sendToClient(ws, { type: 'pong', timestamp: Date.now() });
        break;
        
      default:
        console.warn(`🎤 Unknown control message: ${message.type}`);
    }
  }

  // Handle mode changes
  async handleModeChange(ws, clientState, newMode) {
    const oldMode = clientState.voiceMode;
    clientState.voiceMode = newMode;
    
    console.log(`🎤 Mode change (${clientState.id}): ${oldMode} -> ${newMode}`);
    
    // Send confirmation back to client
    this.sendToClient(ws, {
      type: 'mode_changed',
      mode: newMode,
      timestamp: Date.now()
    });
  }

  // Handle transcript from Web Speech API
  async handleTranscript(ws, clientState, message) {
    try {
      const { transcript, isFinal, confidence } = message;
      
      console.log(`🎤 Transcript for ${clientState.id}: "${transcript}" (final: ${isFinal}, confidence: ${confidence})`);
      
      // Reset inactivity timer on any transcript activity in command mode
      this.resetCommandModeTimer(ws, clientState);
      
      if (!transcript || !isFinal) return;

      // Handle based on current mode
      switch (clientState.voiceMode) {
        case VOICE_MODE.WAKE_WORD:
          await this.handleWakeWordDetection(ws, clientState, transcript);
          break;
          
        case VOICE_MODE.COMMAND:
          await this.handleCommand(ws, clientState, transcript);
          break;
          
        default:
          console.log(`🎤 Ignoring transcript in mode: ${clientState.voiceMode}`);
      }
      
    } catch (error) {
      console.error(`🎤 Transcript handling error for ${clientState.id}:`, error);
    }
  }

  // Handle wake word detection
  async handleWakeWordDetection(ws, clientState, transcript) {
    const normalizedTranscript = transcript.toLowerCase().trim();
    const wakeWords = [
      'hey bev', 'hey beth', 'hey beb', 'hey beverage',
      'hi bev', 'hello bev', 'bev', 'beverage'
    ];
    
    for (const wakeWord of wakeWords) {
      if (normalizedTranscript.includes(wakeWord)) {
        console.log(`🎯 Wake word detected for ${clientState.id}: "${wakeWord}" in "${transcript}"`);
        
        // Switch to command mode
        clientState.voiceMode = VOICE_MODE.COMMAND;
        
        // Notify client
        this.sendToClient(ws, {
          type: 'wake_word_detected',
          transcript: transcript,
          wakeWord: wakeWord,
          timestamp: Date.now()
        });
        
        // Start inactivity timer for command mode
        this.startCommandModeTimer(ws, clientState);
        
        return;
      }
    }
    
    console.log(`🎤 No wake word in: "${transcript}"`);
  }

  // Handle voice commands
  async handleCommand(ws, clientState, transcript) {
    console.log(`🎤 Processing command for ${clientState.id}: "${transcript}"`);
    
    clientState.agentState = AGENT_STATE.PROCESSING;
    this.sendToClient(ws, { type: 'agent_state', state: AGENT_STATE.PROCESSING });
    
    try {
      // Process with intent processor (don't await for faster response)
      const processingPromise = processTranscript(transcript, ws, this.voiceServer.clients, 'command');
      
      // Immediately acknowledge command received
      this.sendToClient(ws, {
        type: 'command_acknowledged',
        transcript,
        timestamp: Date.now()
      });
      
      // Wait for processing to complete
      await processingPromise;
      
      // Return to wake word mode with reduced delay
      setTimeout(() => {
        if (this.clients.has(ws)) {
          clientState.voiceMode = VOICE_MODE.WAKE_WORD;
          clientState.agentState = AGENT_STATE.IDLE;
          
          this.sendToClient(ws, {
            type: 'processing_complete',
            timestamp: Date.now()
          });
        }
      }, 500); // Reduced from 1000ms to 500ms
      
    } catch (error) {
      console.error(`🎤 Command processing error for ${clientState.id}:`, error);
      
      // Return to wake word mode on error
      clientState.voiceMode = VOICE_MODE.WAKE_WORD;
      clientState.agentState = AGENT_STATE.IDLE;
    }
  }

  // Start inactivity timer for command mode
  startCommandModeTimer(ws, clientState) {
    // Clear any existing timer
    if (this.commandModeTimers.has(clientState.id)) {
      clearTimeout(this.commandModeTimers.get(clientState.id));
    }

    // Set a new timer (e.g., 10 seconds of inactivity)
    const timer = setTimeout(() => {
      if (clientState.voiceMode === VOICE_MODE.COMMAND) {
        console.log(`⏰ Inactivity timeout for ${clientState.id}, returning to wake word mode.`);
        clientState.voiceMode = VOICE_MODE.WAKE_WORD;
        this.sendToClient(ws, {
          type: 'mode_changed',
          mode: VOICE_MODE.WAKE_WORD,
          reason: 'inactivity_timeout'
        });
      }
      this.commandModeTimers.delete(clientState.id);
    }, 10000); // 10 seconds

    this.commandModeTimers.set(clientState.id, timer);
  }

  // Reset inactivity timer
  resetCommandModeTimer(ws, clientState) {
    if (clientState.voiceMode === VOICE_MODE.COMMAND) {
      this.startCommandModeTimer(ws, clientState);
    }
  }

  // Send message to client
  sendToClient(ws, message) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  // Generate unique client ID
  generateClientId() {
    return 'client_' + Math.random().toString(36).substr(2, 9);
  }

  // Cleanup client resources
  cleanupClient(ws, clientState) {
    // Remove from clients map
    this.clients.delete(ws);
    
    console.log(`🎤 Cleanup complete for ${clientState.id}`);
  }

  // Start heartbeat monitoring
  startHeartbeat() {
    setInterval(() => {
      this.voiceServer.clients.forEach((ws) => {
        if (!ws.isAlive) {
          console.log('🎤 Terminating inactive client');
          ws.terminate();
          return;
        }
        
        ws.isAlive = false;
        ws.ping();
      });
    }, 30000); // 30 second heartbeat
  }

  // Start cleanup monitoring
  startCleanupMonitoring() {
    setInterval(() => {
      const now = Date.now();
      this.clients.forEach((clientState, ws) => {
        // Cleanup inactive clients (5 minutes)
        if (now - clientState.lastActivity > 5 * 60 * 1000) {
          console.log(`🎤 Cleaning up inactive client: ${clientState.id}`);
          this.cleanupClient(ws, clientState);
          ws.terminate();
        }
      });
    }, 60000); // Check every minute
  }
}

// Initialize and start premium voice server
const premiumVoiceServer = new PremiumVoiceServer();

premiumVoiceServer.initialize().then(() => {
  premiumVoiceServer.startHeartbeat();
  premiumVoiceServer.startCleanupMonitoring();
  
  console.log('🎤 Premium WebRTC Voice Infrastructure Online');
  console.log('🎯 Ready for state-of-the-art voice interactions');
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('🎤 Shutting down Premium Voice Infrastructure...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('🎤 Shutting down Premium Voice Infrastructure...');
  process.exit(0);
});
