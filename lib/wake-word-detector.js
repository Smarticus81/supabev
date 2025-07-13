const levenshtein = require('fast-levenshtein');

class WakeWordDetector {
    constructor() {
        this.wakeWords = [
            'hey bev', 'hey beth', 'hey bay', 'hey beb', 'hey beff',
            'bev', 'beth', 'bay', 'beb', 'beff'
        ];
        
        this.terminationPhrases = [
            'thank you', 'thanks', 'that\'s all', 'goodbye', 'bye',
            'done', 'finished', 'complete', 'stop', 'end'
        ];
        
        // Increase minimum confidence and add filters
        this.minConfidence = 0.65; // Increased from 0.5 to reduce false positives
        this.minWakeWordLength = 3; // Minimum length for wake words
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

    detectWakeWord(transcript) {
        const normalizedTranscript = transcript.toLowerCase().trim();
        
        // Filter out very short transcripts that are likely false positives
        if (normalizedTranscript.length < this.minWakeWordLength) {
            return { detected: false, confidence: 0, matchedPhrase: '' };
        }
        
        // Filter out common false positive phrases
        const falsePositives = ['i get', 'hey', 'he', 'be', 'the', 'a', 'an', 'ok', 'yeah'];
        if (falsePositives.includes(normalizedTranscript)) {
            return { detected: false, confidence: 0, matchedPhrase: '' };
        }

        let bestMatch = { confidence: 0, phrase: '' };

        for (const wakeWord of this.wakeWords) {
            const confidence = this.calculateSimilarity(normalizedTranscript, wakeWord);
            
            if (confidence > bestMatch.confidence) {
                bestMatch = { confidence, phrase: wakeWord };
            }
        }

        return {
            detected: bestMatch.confidence >= this.minConfidence,
            confidence: bestMatch.confidence,
            matchedPhrase: bestMatch.phrase
        };
    }

    // Check for termination commands
    detectTermination(transcript) {
        const cleanTranscript = transcript.toLowerCase().trim();
        
        for (const phrase of this.terminationPhrases) {
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
        // No longer using lastWakeWordTime, so reset is simpler
        console.log('Wake word detector reset');
    }
}

module.exports = WakeWordDetector; 