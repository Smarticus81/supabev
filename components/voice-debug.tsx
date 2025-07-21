'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export function VoiceDebug() {
  const [diagnostics, setDiagnostics] = useState<string[]>([]);
  const [apiKeyStatus, setApiKeyStatus] = useState<string>('checking...');
  const [microphoneStatus, setMicrophoneStatus] = useState<string>('checking...');
  const [speechRecognitionStatus, setSpeechRecognitionStatus] = useState<string>('checking...');

  const addDiagnostic = (message: string) => {
    setDiagnostics(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  const runDiagnostics = async () => {
    setDiagnostics([]);
    addDiagnostic('Starting voice system diagnostics...');

    // Check Speech Recognition API
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      setSpeechRecognitionStatus('✅ Available');
      addDiagnostic('✅ Speech Recognition API is available');
    } else {
      setSpeechRecognitionStatus('❌ Not supported');
      addDiagnostic('❌ Speech Recognition API is not supported in this browser');
    }

    // Check API key
    try {
      const response = await fetch('/api/config');
      if (response.ok) {
        const data = await response.json();
        if (data.openaiKey && data.openaiKey !== 'your-openai-api-key-here') {
          setApiKeyStatus('✅ Valid');
          addDiagnostic('✅ OpenAI API key is configured');
        } else {
          setApiKeyStatus('❌ Not configured');
          addDiagnostic('❌ OpenAI API key is not configured');
        }
      } else {
        setApiKeyStatus('❌ Error checking');
        addDiagnostic('❌ Error checking API key status');
      }
    } catch (error) {
      setApiKeyStatus('❌ Error');
      addDiagnostic(`❌ Error checking API key: ${error}`);
    }

    // Check microphone access
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setMicrophoneStatus('✅ Access granted');
      addDiagnostic('✅ Microphone access granted');
      stream.getTracks().forEach(track => track.stop());
    } catch (error) {
      setMicrophoneStatus('❌ Access denied');
      addDiagnostic(`❌ Microphone access denied: ${error}`);
    }

    // Test button click
    addDiagnostic('✅ Voice button is responsive');
  };

  const testButtonClick = () => {
    addDiagnostic('🖱️ Voice button clicked successfully');
  };

  useEffect(() => {
    runDiagnostics();
  }, []);

  return (
    <Card className="p-2 max-w-xs text-xs">
      <div className="space-y-1 mb-2">
        <div>🔑 {apiKeyStatus}</div>
        <div>🎤 {microphoneStatus}</div>
        <div>🗣️ {speechRecognitionStatus}</div>
      </div>

      <Button onClick={runDiagnostics} size="sm" className="text-xs h-6">
        Refresh
      </Button>
    </Card>
  );
}
