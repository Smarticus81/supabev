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

type VoiceMode = 'wake_word' | 'command' | 'processing';

const useVoiceAssistant = (
  onTranscript: (text: string) => void,
  onOrderUpdate?: (data: OrderUpdateData) => void,
  onCartClear?: () => void
) => {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [mode, setMode] = useState<VoiceMode>('wake_word');
  const [wakeWordDetected, setWakeWordDetected] = useState(false);

  const socketRef = useRef<WebSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  // Play audio from base64 data
  const playAudio = (base64Data: string, audioType?: string) => {
    try {
      const audioData = atob(base64Data);
      const audioBuffer = new Uint8Array(audioData.length);
      for (let i = 0; i < audioData.length; i++) {
        audioBuffer[i] = audioData.charCodeAt(i);
      }
      
      let mimeType = 'audio/wav';
      if (audioType === 'tts_response') {
        mimeType = 'audio/mp3';
      }
      
      const audioBlob = new Blob([audioBuffer], { type: mimeType });
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      
      audio.onended = () => {
        URL.revokeObjectURL(audioUrl);
      };
      
      audio.play().catch(err => {
        console.error('Error playing audio:', err);
      });
    } catch (error) {
      console.error('Error processing audio:', error);
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
          playAudio(message.data, message.audioType);
        } else if (message.type === 'order_update' && onOrderUpdate) {
          console.log('Received order update:', message.data);
          onOrderUpdate(message.data);
        } else if (message.type === 'cart_clear' && onCartClear) {
          console.log('Received cart clear message:', message.data);
          onCartClear();
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
    };
  }, [isListening, onOrderUpdate, onCartClear]);

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