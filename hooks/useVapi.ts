'use client'

import { useState, useEffect, useRef } from 'react';
import Vapi from '@vapi-ai/web';

export function useVapi() {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [volumeLevel, setVolumeLevel] = useState(0);
  const vapiRef = useRef<any>(null);

  useEffect(() => {
    const vapi = new (Vapi as any)('1717e761-4d6a-4467-9336-121f6c208447');
    
    vapiRef.current = vapi;

    vapi.on('speech-start', () => {
      setIsSpeaking(true);
    });

    vapi.on('speech-end', () => {
      setIsSpeaking(false);
    });

    vapi.on('volume-level', (volume: number) => {
      setVolumeLevel(volume);
    });

    // Add listeners for call lifecycle to track listening state
    vapi.on('call-start', () => {
      setIsListening(true);
    });

    vapi.on('call-end', () => {
      setIsListening(false);
    });
    
    return () => {
      vapi.stop();
    };
  }, []);

  const toggleCall = () => {
    if (isListening) {
      vapiRef.current.stop();
      // Fallback in case call-end event is delayed
      setIsListening(false);
    } else {
      vapiRef.current.start({
        model: {
          provider: 'openai',
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content: 'You are a helpful assistant for a beverage POS system.',
            },
          ],
        },
        voice: {
          provider: '11labs',
          voiceId: 'burt',
        },
        serverUrl: '/api/voice',
      });
      // Fallback until call-start event fires
      setIsListening(true);
    }
  };

  return { isListening, isSpeaking, volumeLevel, toggleCall };
} 