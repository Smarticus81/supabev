// Simple audio generator for wake word notifications
class AudioGenerator {
    // Generate or load a gentle chime as base64 encoded audio
    static generateWakeWordChime() {
        const fs = require('fs');
        const path = require('path');

        try {
            const chimePath = path.join(process.cwd(), 'chime.mp3');
            if (fs.existsSync(chimePath)) {
                const audioBuffer = fs.readFileSync(chimePath);
                return audioBuffer.toString('base64');
            }
        } catch (err) {
            console.warn('Failed to load custom chime, falling back to generated tone', err);
        }

        // Fallback: very soft sine fade
        const sampleRate = 44100;
        const duration = 0.4;
        const samples = Math.floor(sampleRate * duration);
        const buffer = new ArrayBuffer(44 + samples * 2); // mono 16-bit
        const view = new DataView(buffer);

        const writeStr = (o, s) => s.split('').forEach((c, i) => view.setUint8(o + i, c.charCodeAt(0)));
        writeStr(0, 'RIFF');
        view.setUint32(4, 36 + samples * 2, true);
        writeStr(8, 'WAVE');
        writeStr(12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true);
        view.setUint16(22, 1, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * 2, true);
        view.setUint16(32, 2, true);
        view.setUint16(34, 16, true);
        writeStr(36, 'data');
        view.setUint32(40, samples * 2, true);

        for (let i = 0; i < samples; i++) {
            const t = i / sampleRate;
            const env = Math.sin(Math.PI * (t / duration));
            const sample = Math.sin(2 * Math.PI * 440 * t) * 0.15 * env;
            view.setInt16(44 + i * 2, sample * 32767, true);
        }

        return Buffer.from(buffer).toString('base64');
    }

    // Generate a simple success tone
    static generateSuccessTone() {
        const sampleRate = 44100;
        const duration = 0.3;
        const samples = Math.floor(sampleRate * duration);
        
        const buffer = new ArrayBuffer(44 + samples * 4);
        const view = new DataView(buffer);
        
        // WAV header (same as above)
        const writeString = (offset, string) => {
            for (let i = 0; i < string.length; i++) {
                view.setUint8(offset + i, string.charCodeAt(i));
            }
        };
        
        writeString(0, 'RIFF');
        view.setUint32(4, 36 + samples * 4, true);
        writeString(8, 'WAVE');
        writeString(12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true);
        view.setUint16(22, 2, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * 4, true);
        view.setUint16(32, 4, true);
        view.setUint16(34, 16, true);
        writeString(36, 'data');
        view.setUint32(40, samples * 4, true);
        
        // Generate rising tone
        for (let i = 0; i < samples; i++) {
            const t = i / sampleRate;
            const freq = 600 + (t * 400); // Rising from 600Hz to 1000Hz
            const envelope = Math.sin(t * Math.PI / duration); // Bell curve envelope
            
            const sample = Math.sin(2 * Math.PI * freq * t) * envelope * 0.4;
            const intSample = Math.max(-32767, Math.min(32767, sample * 32767));
            
            view.setInt16(44 + i * 4, intSample, true);
            view.setInt16(44 + i * 4 + 2, intSample, true);
        }
        
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.length; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        
        return btoa(binary);
    }
}

module.exports = AudioGenerator; 