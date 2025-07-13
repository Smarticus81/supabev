"use client";

import { useState, useEffect, useRef } from 'react';

interface OrderItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  serving_name?: string;
}

interface OrderUpdateData {
  action: 'add_items';
  items: OrderItem[];
  order_id: number;
}

interface CartUpdateData {
  cart: OrderItem[];
}

interface InventoryUpdateData {
  drinks: any[];
  timestamp: number;
}

type VoiceMode = 'wake_word' | 'command' | 'processing';

const useVoiceAssistant = (
  onTranscript: (text: string) => void,
  onOrderUpdate?: (data: OrderUpdateData) => void,
  onCartUpdate?: (data: CartUpdateData) => void,
  onCartClear?: () => void,
  onInventoryUpdate?: (data: InventoryUpdateData) => void
) => {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [mode, setMode] = useState<VoiceMode>('wake_word');
  const [wakeWordDetected, setWakeWordDetected] = useState(false);

  const socketRef = useRef<WebSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const audioQueueRef = useRef<Array<{ data: string; type?: string; priority?: 'high' | 'normal' }>>([]);
  const isPlayingAudioRef = useRef(false);

  // Play audio from base64 data with queue management and interruptability
  const playAudio = (base64Data: string, audioType?: string, priority: 'high' | 'normal' = 'normal') => {
    const audioItem = { data: base64Data, type: audioType, priority };
    
    // High priority audio interrupts current playback
    if (priority === 'high') {
      // Stop current audio immediately
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        currentAudioRef.current.currentTime = 0;
        currentAudioRef.current = null;
      }
      
      // Clear queue and add high priority item to front
      audioQueueRef.current = [audioItem];
      isPlayingAudioRef.current = false;
      processAudioQueue();
    } else {
      // Normal priority audio goes to queue
      audioQueueRef.current.push(audioItem);
      
      // Process queue if not already playing
      if (!isPlayingAudioRef.current) {
        processAudioQueue();
      }
    }
  };

  const processAudioQueue = () => {
    if (audioQueueRef.current.length === 0) {
      isPlayingAudioRef.current = false;
      return;
    }

    isPlayingAudioRef.current = true;
    const audioItem = audioQueueRef.current.shift()!;

    try {
      // Stop any currently playing audio
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        currentAudioRef.current.currentTime = 0;
        currentAudioRef.current = null;
      }

      const audioData = atob(audioItem.data);
      const audioBuffer = new Uint8Array(audioData.length);
      for (let i = 0; i < audioData.length; i++) {
        audioBuffer[i] = audioData.charCodeAt(i);
      }
      
      let mimeType = 'audio/wav';
      if (audioItem.type === 'tts_response') {
        mimeType = 'audio/mp3';
      }
      
      const audioBlob = new Blob([audioBuffer], { type: mimeType });
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      
      currentAudioRef.current = audio;
      
      audio.onended = () => {
        URL.revokeObjectURL(audioUrl);
        currentAudioRef.current = null;
        // Process next item in queue
        const delay = audioItem.priority === 'high' ? 50 : 100; // Shorter delay for high priority
        setTimeout(() => processAudioQueue(), delay);
      };
      
      audio.onerror = () => {
        console.error('Error playing audio');
        URL.revokeObjectURL(audioUrl);
        currentAudioRef.current = null;
        // Process next item in queue even on error
        setTimeout(() => processAudioQueue(), 100);
      };
      
      audio.play().catch(err => {
        console.error('Error playing audio:', err);
        currentAudioRef.current = null;
        // Process next item in queue even on error
        setTimeout(() => processAudioQueue(), 100);
      });
    } catch (error) {
      console.error('Error processing audio:', error);
      // Process next item in queue even on error
      setTimeout(() => processAudioQueue(), 100);
    }
  };

  useEffect(() => {
    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        const recorder = new MediaRecorder(stream, {
          mimeType: 'audio/webm'
        });

        mediaRecorderRef.current = recorder;

        recorder.onstart = () => setIsSpeaking(true);
        recorder.onstop = () => setIsSpeaking(false);

        recorder.ondataavailable = (event) => {
          if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
            socketRef.current.send(event.data);
          }
        };

        recorder.start(250); // emit chunks every 250ms
      } catch (err) {
        console.error('Error accessing microphone', err);
      }
    }

    if (isListening) {
      // Open WS connection
      socketRef.current = new WebSocket('ws://localhost:3001');

      socketRef.current.onopen = () => start();

      socketRef.current.onmessage = (event) => {
        const message = JSON.parse(event.data);
        
        if (message.type === 'response') {
          const text: string = message.data;
          onTranscript(text);
          
          // Update mode if provided
          if (message.mode) {
            setMode(message.mode);
          }
        } else if (message.type === 'wake_word_detected') {
          console.log('Wake word detected:', message.data);
          setWakeWordDetected(true);
          setMode('command');
          
          // Reset wake word detected state after a short delay
          setTimeout(() => setWakeWordDetected(false), 2000);
        } else if (message.type === 'audio') {
          // High priority for wake word chimes and success tones for immediate feedback
          const priority = (message.audioType === 'wake_word_chime' || message.audioType === 'success_tone') ? 'high' : 'normal';
          playAudio(message.data, message.audioType, priority);
        } else if (message.type === 'order_update' && onOrderUpdate) {
          console.log('Received order update:', message.data);
          onOrderUpdate(message.data);
        } else if (message.type === 'cart_update' && onCartUpdate) {
          console.log('Received cart update:', message.data);
          console.log('Cart update data.cart type:', typeof message.data.cart);
          console.log('Cart update data.cart isArray:', Array.isArray(message.data.cart));
          console.log('Cart update data.cart value:', message.data.cart);
          onCartUpdate(message.data);
        } else if (message.type === 'cart_clear' && onCartClear) {
          console.log('Received cart clear message:', message.data);
          onCartClear();
        } else if (message.type === 'inventory_update' && onInventoryUpdate) {
          console.log('Received inventory update:', message.data);
          onInventoryUpdate(message.data);
        }
      };

      socketRef.current.onclose = () => {
        console.log('WebSocket connection closed');
        setMode('wake_word');
      };

      socketRef.current.onerror = (error) => {
        console.error('WebSocket error:', error);
      };
    } else {
      // stop everything
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
        mediaRecorderRef.current.stream.getTracks().forEach((t) => t.stop());
      }
      if (socketRef.current) {
        socketRef.current.close();
      }
      // Stop any playing audio and clear queue
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        currentAudioRef.current.currentTime = 0;
        currentAudioRef.current = null;
      }
      audioQueueRef.current = [];
      isPlayingAudioRef.current = false;
      setMode('wake_word');
      setWakeWordDetected(false);
    }

    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
        mediaRecorderRef.current.stream.getTracks().forEach((t) => t.stop());
      }
      if (socketRef.current) {
        socketRef.current.close();
      }
      // Stop any playing audio and clear queue
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        currentAudioRef.current.currentTime = 0;
        currentAudioRef.current = null;
      }
      audioQueueRef.current = [];
      isPlayingAudioRef.current = false;
    };
  }, [isListening, onOrderUpdate, onCartUpdate, onCartClear, onInventoryUpdate]);

  const toggleListening = () => setIsListening((prev) => !prev);

  return { 
    isListening, 
    isSpeaking, 
    toggleListening, 
    mode, 
    wakeWordDetected 
  };
};

export default useVoiceAssistant; 