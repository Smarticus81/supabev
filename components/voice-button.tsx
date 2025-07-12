"use client"

import { useState } from "react"
import { Mic, MicOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/use-toast"

interface VoiceButtonProps {
  onToggleCall: () => void
  isListening: boolean
}

export default function VoiceButton({ onToggleCall, isListening }: VoiceButtonProps) {
  const { toast } = useToast()

  const handleToggle = () => {
    onToggleCall()
    toast({
      title: isListening ? "Voice Deactivated" : "Voice Activated",
      description: isListening ? "Voice assistant has been turned off" : "Say 'Hey Bev' to start ordering",
    })
  }

  return (
    <Button
      variant="outline"
      size="icon"
      className={`h-10 w-10 rounded-full transition-all duration-300 ${
        isListening
          ? "bg-gradient-to-r from-blue-500 to-purple-600 text-white border-0 shadow-lg hover:shadow-xl"
          : "bg-white border-gray-300 text-gray-600 hover:bg-gray-50"
      } ${isListening ? "animate-pulse" : ""}`}
      onClick={handleToggle}
      title={isListening ? "Deactivate voice assistant" : "Activate voice assistant"}
    >
      {isListening ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
    </Button>
  )
}
