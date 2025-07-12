"use client"

import { useState, useEffect } from "react"

interface WaveformOverlayProps {
  isVisible: boolean
  isSpeaking: boolean
  volumeLevel: number
}

export default function WaveformOverlay({ isVisible, isSpeaking, volumeLevel }: WaveformOverlayProps) {
  const [waves, setWaves] = useState<number[]>([])

  useEffect(() => {
    if (isSpeaking) {
      const newWaves = Array.from({ length: 40 }, () => (Math.random() * 0.5 + 0.5) * volumeLevel * 100 + 5)
      setWaves(newWaves)
    } else {
      // Smoothly transition to a flat line when not speaking
      const interval = setInterval(() => {
        setWaves(currentWaves => {
          const newWaves = currentWaves.map(w => Math.max(5, w * 0.95));
          if (newWaves.every(w => w === 5)) {
            clearInterval(interval);
            return [];
          }
          return newWaves;
        });
      }, 50);

      return () => clearInterval(interval);
    }
  }, [isSpeaking, volumeLevel])

  if (!isVisible) return null

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          // Close overlay when clicking outside
          window.dispatchEvent(new CustomEvent("closeVoiceOverlay"))
        }
      }}
    >
      {/* Waveform visualization */}
      <div className="flex items-end space-x-2 h-[150px]">
        {waves.map((waveHeight, index) => (
          <div
            key={index}
            className="bg-white transition-all duration-100 ease-in-out"
            style={{
              height: `${waveHeight}px`,
              width: "5px",
              borderRadius: "2px",
            }}
          />
        ))}
      </div>
    </div>
  )
}
