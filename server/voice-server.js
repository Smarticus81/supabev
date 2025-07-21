require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });
const punycode = require('punycode');
const WebSocket = require('ws');
const { Writable } = require('stream');
const { processTranscript } = require('./intent-processor');
const OpenAI = require('openai');
const { createClient } = require('@deepgram/sdk');

if (!process.env.OPENAI_API_KEY) {
  console.error('The OPENAI_API_KEY environment variable is missing. Please add it to your .env file.');
  process.exit(1);
}

if (!process.env.DEEPGRAM_API_KEY) {
  console.error('The DEEPGRAM_API_KEY environment variable is missing. Please add it to your .env file.');
  process.exit(1);
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const deepgram = createClient(process.env.DEEPGRAM_API_KEY);

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
  console.log('Client connected');
  let agentState = AGENT_STATE.IDLE;
  let clientMode = CLIENT_MODE.INACTIVE;
  let deepgramConnection = null;
  let connectionRetries = 0;
  const maxRetries = 3;

  // Function to update agent state and notify client
  const setAgentState = (newState) => {
    agentState = newState;
    ws.send(JSON.stringify({ type: 'agent_state', state: newState }));
  };

  // Function to update client mode
  const setClientMode = (newMode) => {
    console.log(`Client mode changed: ${clientMode} -> ${newMode}`);
    clientMode = newMode;
    
    // Handle mode transitions
    if (newMode === CLIENT_MODE.COMMAND || newMode === CLIENT_MODE.WAKE_WORD) {
      createDeepgramConnection();
    } else if (newMode === CLIENT_MODE.INACTIVE) {
      if (deepgramConnection) {
        deepgramConnection.finish();
        deepgramConnection = null;
        connectionRetries = 0;
      }
    }
  };

  // Function to check for wake word in transcript
  const checkForWakeWord = (transcript) => {
    const normalizedTranscript = transcript.toLowerCase().trim();
    const wakeWords = [
      'hey bev',
      'hey beth',
      'hey beb',
      'hey beverage',
      'hi bev',
      'hello bev',
      'bev',
      'beverage'
    ];
    
    for (const wakeWord of wakeWords) {
      if (normalizedTranscript.includes(wakeWord)) {
        console.log(`Wake word detected: "${wakeWord}" in "${transcript}"`);
        return true;
      }
    }
    return false;
  };

  // Function to create Deepgram connection
  const createDeepgramConnection = () => {
    if (deepgramConnection) {
      console.log('Deepgram connection already exists');
      return;
    }

    try {
      console.log('Creating Deepgram connection...');
      deepgramConnection = deepgram.listen.live({
        model: 'nova-2',
        language: 'en',
        smart_format: true,
        interim_results: true,
        utterance_end_ms: 1000,
        vad_events: true
        // Let Deepgram auto-detect the format
      });

      deepgramConnection.on('open', () => {
        console.log('✅ Deepgram connection established successfully');
        connectionRetries = 0;
      });

      deepgramConnection.on('metadata', (data) => {
        console.log('📊 Deepgram metadata:', JSON.stringify(data, null, 2));
      });

      deepgramConnection.on('error', (err) => {
        console.error('❌ Deepgram connection error:', err.message);
        
        if (connectionRetries < maxRetries && clientMode !== CLIENT_MODE.INACTIVE) {
          connectionRetries++;
          console.log(`Retrying Deepgram connection (${connectionRetries}/${maxRetries})...`);
          setTimeout(() => {
            deepgramConnection = null;
            createDeepgramConnection();
          }, 2000 * connectionRetries);
        } else {
          console.error('Max Deepgram connection retries reached or client inactive. Speech recognition disabled.');
          deepgramConnection = null;
        }
      });

      deepgramConnection.on('speechStarted', () => {
        console.log('🎤 Speech started');
        setAgentState(AGENT_STATE.LISTENING);
        if (agentState === AGENT_STATE.SPEAKING) {
          ws.send(JSON.stringify({ type: 'interrupt' }));
        }
      });

      deepgramConnection.on('speechEnded', () => {
        console.log('🎤 Speech ended');
      });

      deepgramConnection.on('transcript', async (data) => {
        console.log('🎧 Deepgram transcript event received:', JSON.stringify(data, null, 2));
        
        if (!data.channel || !data.channel.alternatives || data.channel.alternatives.length === 0) {
          console.log('⚠️ No transcript alternatives found');
          return;
        }
        
        const transcript = data.channel.alternatives[0].transcript.trim();
        console.log(`📝 Transcript received: "${transcript}" (is_final: ${data.is_final}, clientMode: ${clientMode})`);
        
        if (transcript && data.is_final) {
          console.log('📝 Final transcript:', transcript);
          
          // Check for wake word when in wake_word mode
          if (clientMode === CLIENT_MODE.WAKE_WORD) {
            if (checkForWakeWord(transcript)) {
              console.log('🎯 Wake word detected! Switching to command mode');
              ws.send(JSON.stringify({ type: 'wake_word_detected', transcript: transcript }));
              setClientMode(CLIENT_MODE.COMMAND);
              return;
            } else {
              console.log('👂 Listening for wake word... (heard: "' + transcript + '")');
              return; // Stay in wake word mode
            }
          }
          
          setAgentState(AGENT_STATE.PROCESSING);
          
          try {
            // Process based on current mode
            if (clientMode === CLIENT_MODE.COMMAND) {
              // In command mode, process as voice command
              await processTranscript(transcript, ws, wss.clients, 'command');
            }
          } catch (error) {
            console.error('Error processing transcript:', error);
          } finally {
            setAgentState(AGENT_STATE.IDLE);
          }
        }
      });

      deepgramConnection.on('utteranceEnd', (data) => {
        console.log('🔚 Utterance end');
        setAgentState(AGENT_STATE.IDLE);
      });

      deepgramConnection.on('close', (event) => {
        console.log('Deepgram connection closed:', event);
        if (connectionRetries < maxRetries && ws.readyState === WebSocket.OPEN && clientMode !== CLIENT_MODE.INACTIVE) {
          connectionRetries++;
          console.log(`Reconnecting to Deepgram (${connectionRetries}/${maxRetries})...`);
          setTimeout(() => {
            deepgramConnection = null;
            createDeepgramConnection();
          }, 1000 * connectionRetries);
        } else {
          deepgramConnection = null;
        }
      });

    } catch (error) {
      console.error('Error creating Deepgram connection:', error);
      if (connectionRetries < maxRetries && clientMode !== CLIENT_MODE.INACTIVE) {
        connectionRetries++;
        setTimeout(() => {
          deepgramConnection = null;
          createDeepgramConnection();
        }, 2000 * connectionRetries);
      }
    }
  };

  // --- Heartbeat logic ---
  ws.isAlive = true;
  ws.on('pong', () => {
    ws.isAlive = true;
  });

  // Handle client messages
  ws.on('message', (message) => {
    // Check if message is JSON (control message) or binary (audio data)
    try {
      const controlMessage = JSON.parse(message);
      
      if (controlMessage.type === 'mode_change') {
        setClientMode(controlMessage.mode);
        return;
      }
    } catch (e) {
      // Not JSON, treat as audio data
      console.log(`[Voice Server] Received audio data: ${message.length} bytes, clientMode: ${clientMode}`);
      if (deepgramConnection && deepgramConnection.getReadyState() === 1 && clientMode !== CLIENT_MODE.INACTIVE) {
        console.log(`[Voice Server] Sending audio to Deepgram (readyState: ${deepgramConnection.getReadyState()})`);
        deepgramConnection.send(message);
      } else {
        if (clientMode === CLIENT_MODE.INACTIVE) {
          console.log('Client inactive, dropping audio chunk');
        } else {
          console.log('Deepgram not ready, dropping audio chunk');
        }
      }
    }
  });

  ws.on('close', () => {
    console.log('Client disconnected');
    if (deepgramConnection) {
      deepgramConnection.finish();
    }
    if (ws.heartbeatInterval) clearInterval(ws.heartbeatInterval);
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
    if (deepgramConnection) {
      deepgramConnection.finish();
    }
    if (ws.heartbeatInterval) clearInterval(ws.heartbeatInterval);
  });

  setAgentState(AGENT_STATE.IDLE);
  setClientMode(CLIENT_MODE.COMMAND); // Set to command mode on connection

  // Start heartbeat
  ws.heartbeatInterval = setInterval(() => {
    if (ws.isAlive === false) {
      console.log('No pong received, terminating client');
      return ws.terminate();
    }
    ws.isAlive = false;
    ws.ping();
  }, HEARTBEAT_INTERVAL);
});

console.log(`🚀 WebSocket server started on port ${port}`);

// Clean up dead connections globally
setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) return ws.terminate();
    ws.isAlive = false;
    ws.ping();
  });
}, HEARTBEAT_TIMEOUT);