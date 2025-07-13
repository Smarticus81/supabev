require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });
const WebSocket = require('ws');
const { createClient, LiveTranscriptionEvents } = require('@deepgram/sdk');
const { Writable } = require('stream');
const { processTranscript } = require('./intent-processor');

const deepgram = createClient(process.env.DEEPGRAM_API_KEY);
const port = 3001;

// Store connected clients for broadcasting
const connectedClients = new Set();

// Create WebSocket server
const wss = new WebSocket.Server({ port });

wss.on('connection', (ws) => {
  console.log('Client connected');
  connectedClients.add(ws);

  const deepgramConnection = deepgram.listen.live({
    punctuate: true,
    smart_format: true,
    model: 'nova-2',
  });

  const stream = new Writable({
    write(chunk, encoding, callback) {
      if (deepgramConnection.getReadyState() === 1) {
        deepgramConnection.send(chunk);
      }
      callback();
    }
  });

  deepgramConnection.on(LiveTranscriptionEvents.Transcript, async (data) => {
    const transcript = data.channel.alternatives[0].transcript;
    if (transcript) {
      await processTranscript(transcript, ws, connectedClients);
    }
  });

  ws.on('message', (message) => {
    stream.write(message);
  });

  ws.on('close', () => {
    console.log('Client disconnected');
    connectedClients.delete(ws);
    deepgramConnection.finish();
  });
});

console.log(`WebSocket server started on port ${port}`); 