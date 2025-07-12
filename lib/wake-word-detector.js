const levenshtein = require('fast-levenshtein');

class WakeWordDetector {
    constructor() {
        this.wakeWords = [
            'hey bev',
            'hi bev', 
            'hello bev',
            'hey dev',  // common misheard
            'hey beth', // common misheard
            'a bev',    // common misheard
            'hey ben',  // common misheard
        ];
        this.confidenceThreshold = 0.5; // 50% confidence
        this.lastWakeWordTime = 0;
        this.minTimeBetweenWakeWords = 2000; // 2 seconds cooldown
    }

    // Calculate similarity between two strings using Levenshtein distance
    calculateSimilarity(str1, str2) {
        const maxLength = Math.max(str1.length, str2.length);
        if (maxLength === 0) return 1.0;
        
        const distance = levenshtein.get(str1.toLowerCase(), str2.toLowerCase());
        return (maxLength - distance) / maxLength;
    }

    // Extract potential wake word phrases from transcript
    extractPotentialWakeWords(transcript) {
        const words = transcript.toLowerCase().split(/\s+/);
        const phrases = [];
        
        // Extract 2-word combinations that might be wake words
        for (let i = 0; i < words.length - 1; i++) {
            phrases.push(`${words[i]} ${words[i + 1]}`);
        }
        
        // Also check single words in case "hey" or "bev" appears alone
        phrases.push(...words);
        
        return phrases;
    }

    // Check if transcript contains wake word
    detectWakeWord(transcript) {
        const now = Date.now();
        
        // Cooldown check to prevent rapid triggering
        if (now - this.lastWakeWordTime < this.minTimeBetweenWakeWords) {
            return { detected: false, confidence: 0, matchedPhrase: null };
        }

        const potentialPhrases = this.extractPotentialWakeWords(transcript);
        let bestMatch = { confidence: 0, phrase: null, wakeWord: null };

        // Check each potential phrase against all wake words
        for (const phrase of potentialPhrases) {
            for (const wakeWord of this.wakeWords) {
                const similarity = this.calculateSimilarity(phrase, wakeWord);
                
                if (similarity > bestMatch.confidence) {
                    bestMatch = {
                        confidence: similarity,
                        phrase: phrase,
                        wakeWord: wakeWord
                    };
                }
            }
        }

        // Check if best match exceeds threshold
        if (bestMatch.confidence >= this.confidenceThreshold) {
            this.lastWakeWordTime = now;
            return {
                detected: true,
                confidence: bestMatch.confidence,
                matchedPhrase: bestMatch.phrase,
                targetWakeWord: bestMatch.wakeWord,
                transcript: transcript
            };
        }

        return { detected: false, confidence: bestMatch.confidence, matchedPhrase: bestMatch.phrase };
    }

    // Check for termination commands
    detectTermination(transcript) {
        const terminationPhrases = [
            'stop listening',
            'stop recording',
            'end session',
            'go back',
            'wake word mode',
            'standby',
            'sleep',
            'stop',
            'done',
            'finished',
            'that\'s all',
            'thank you bev',
            'thanks bev',
            'goodbye',
            'bye',
            'exit'
        ];

        const cleanTranscript = transcript.toLowerCase().trim();
        
        for (const phrase of terminationPhrases) {
            const similarity = this.calculateSimilarity(cleanTranscript, phrase);
            if (similarity >= 0.6) { // Higher threshold for termination
                return {
                    detected: true,
                    confidence: similarity,
                    matchedPhrase: phrase,
                    transcript: transcript
                };
            }
        }

        return { detected: false, confidence: 0, matchedPhrase: null };
    }

    // Reset the detector state
    reset() {
        this.lastWakeWordTime = 0;
    }
}

module.exports = WakeWordDetector; 