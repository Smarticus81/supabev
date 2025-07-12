"use client";

import React from 'react';
import { Button } from '@/components/ui/button';
import { Mic, MicOff, Ear } from 'lucide-react';

type VoiceMode = 'wake_word' | 'command' | 'processing';

interface VoiceAssistantButtonProps {
    onTranscript: (transcript: string) => void;
    isListening: boolean;
    toggleListening: () => void;
    mode: VoiceMode;
    wakeWordDetected: boolean;
}

const VoiceAssistantButton: React.FC<VoiceAssistantButtonProps> = ({ 
    onTranscript, 
    isListening, 
    toggleListening,
    mode,
    wakeWordDetected
}) => {
    const getButtonState = () => {
        if (!isListening) {
            return {
                icon: <MicOff className="h-4 w-4" />,
                className: "bg-white border-gray-300 text-gray-600 hover:bg-gray-50",
                title: "Activate voice assistant"
            };
        }

        if (wakeWordDetected) {
            return {
                icon: <Mic className="h-4 w-4 text-green-500" />,
                className: "bg-gradient-to-r from-green-500 to-blue-600 text-white border-0 shadow-lg animate-pulse",
                title: "Wake word detected! Listening for commands..."
            };
        }

        if (mode === 'command') {
            return {
                icon: <Mic className="h-4 w-4 text-white" />,
                className: "bg-gradient-to-r from-blue-500 to-purple-600 text-white border-0 shadow-lg",
                title: "Command mode - Listening for orders"
            };
        }

        // wake_word mode
        return {
            icon: <Ear className="h-4 w-4 text-blue-500" />,
            className: "bg-blue-50 border-blue-300 text-blue-600 hover:bg-blue-100 animate-pulse",
            title: "Wake word mode - Say 'Hey Bev' to start"
        };
    };

    const buttonState = getButtonState();

    return (
        <div className="relative">
            <Button
                onClick={toggleListening}
                variant="outline"
                size="icon"
                className={`h-10 w-10 rounded-full transition-all duration-300 ${buttonState.className}`}
                title={buttonState.title}
            >
                {buttonState.icon}
                {isListening && mode === 'wake_word' && (
                    <span className="animate-ping absolute h-3 w-3 rounded-full bg-blue-400 opacity-75 top-1 right-1"></span>
                )}
                {isListening && mode === 'command' && (
                    <span className="animate-ping absolute h-3 w-3 rounded-full bg-purple-400 opacity-75 top-1 right-1"></span>
                )}
            </Button>
            
            {/* Mode indicator text */}
            {isListening && (
                <div className="absolute top-12 left-1/2 transform -translate-x-1/2 whitespace-nowrap">
                    <div className="bg-black text-white text-xs px-2 py-1 rounded shadow-lg">
                        {mode === 'wake_word' ? 'Say "Hey Bev"' : 
                         mode === 'command' ? 'Listening...' : 
                         'Processing...'}
                    </div>
                </div>
            )}
        </div>
    );
};

export default VoiceAssistantButton; 