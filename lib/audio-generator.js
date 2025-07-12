// Simple audio generator for wake word notifications
class AudioGenerator {
    // Generate a pleasant two-tone chime as base64 encoded WAV
    static generateWakeWordChime() {
        const sampleRate = 44100;
        const duration = 0.5; // 500ms
        const samples = Math.floor(sampleRate * duration);
        
        // Create stereo audio buffer
        const buffer = new ArrayBuffer(44 + samples * 4); // WAV header + stereo samples
        const view = new DataView(buffer);
        
        // WAV header
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
        view.setUint16(20, 1, true); // PCM format
        view.setUint16(22, 2, true); // Stereo
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * 4, true);
        view.setUint16(32, 4, true);
        view.setUint16(34, 16, true);
        writeString(36, 'data');
        view.setUint32(40, samples * 4, true);
        
        // Generate pleasant two-tone chime
        for (let i = 0; i < samples; i++) {
            const t = i / sampleRate;
            
            // First tone: 800Hz, second tone: 1000Hz
            const freq1 = 800;
            const freq2 = 1000;
            
            // Envelope: quick attack, gradual decay
            const envelope = Math.exp(-t * 3) * (t < 0.1 ? t * 10 : 1);
            
            // Mix two tones with phase shift for pleasant harmony
            const sample1 = Math.sin(2 * Math.PI * freq1 * t) * envelope * 0.3;
            const sample2 = Math.sin(2 * Math.PI * freq2 * t + Math.PI / 4) * envelope * 0.2;
            
            const mixedSample = (sample1 + sample2) * 0.7;
            const intSample = Math.max(-32767, Math.min(32767, mixedSample * 32767));
            
            // Write stereo samples
            view.setInt16(44 + i * 4, intSample, true);     // Left
            view.setInt16(44 + i * 4 + 2, intSample, true); // Right
        }
        
        // Convert to base64
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.length; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        
        return btoa(binary);
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