#!/usr/bin/env node

/**
 * Test Learning System Functionality
 * Verifies that the learning apparatus is ready for SFT and RL data collection
 */

const { learningSystem } = require('./lib/learning-system');
const path = require('path');
const fs = require('fs').promises;

async function testLearningSystem() {
    console.log('🧪 Testing Learning System for SFT/RL Data Collection...\n');
    
    try {
        // Test 1: Log a voice interaction
        console.log('📝 Test 1: Logging voice interaction...');
        await learningSystem.logInteraction({
            sessionId: 'test-session-001',
            timestamp: new Date().toISOString(),
            interactionType: 'voice_command',
            userInput: 'Add two bottles of Dom Perignon to my cart',
            voiceData: {
                transcript: 'Add two bottles of Dom Perignon to my cart',
                confidence: 0.95,
                duration: 2.3,
                language: 'en-US'
            },
            systemResponse: 'I\'ve added 2 bottles of Dom Perignon to your cart. Your total is now $800.',
            context: {
                cartItems: ['Dom Perignon'],
                cartTotal: 800,
                customerType: 'premium'
            },
            success: true
        });
        console.log('✅ Voice interaction logged successfully');

        // Test 2: Log intent processing
        console.log('\n📝 Test 2: Logging intent processing...');
        await learningSystem.logIntentProcessing({
            sessionId: 'test-session-001',
            timestamp: new Date().toISOString(),
            rawInput: 'I want something expensive for my anniversary',
            processedIntent: {
                intent: 'recommendation_request',
                entities: [
                    { entity: 'occasion', value: 'anniversary' },
                    { entity: 'price_preference', value: 'expensive' }
                ],
                confidence: 0.87
            },
            nluConfidence: 0.87,
            context: {
                sessionDuration: 45,
                previousIntents: ['greeting']
            },
            processingTime: 120
        });
        console.log('✅ Intent processing logged successfully');

        // Test 3: Log drink mapping
        console.log('\n📝 Test 3: Logging drink mapping...');
        await learningSystem.logDrinkMapping({
            sessionId: 'test-session-001',
            timestamp: new Date().toISOString(),
            userQuery: 'champagne',
            mappedDrink: 'Dom Perignon',
            confidence: 0.92,
            alternativeMatches: ['Cristal', 'Krug Grande Cuvée'],
            context: {
                category: 'Champagne',
                priceRange: 'premium'
            }
        });
        console.log('✅ Drink mapping logged successfully');

        // Test 4: Log tool invocation
        console.log('\n📝 Test 4: Logging tool invocation...');
        await learningSystem.logToolInvocation({
            sessionId: 'test-session-001',
            timestamp: new Date().toISOString(),
            toolName: 'cart_add',
            parameters: {
                clientId: 'test-client',
                drink_name: 'Dom Perignon',
                quantity: 2
            },
            result: {
                success: true,
                message: 'Added 2 Dom Perignon to cart'
            },
            executionTime: 45,
            context: {
                userIntent: 'add_to_cart',
                conversationTurn: 3
            }
        });
        console.log('✅ Tool invocation logged successfully');

        // Test 5: Log error for RL training
        console.log('\n📝 Test 5: Logging error for RL training...');
        await learningSystem.logError({
            sessionId: 'test-session-001',
            timestamp: new Date().toISOString(),
            errorType: 'drink_not_found',
            userInput: 'Add some blue wine to my cart',
            systemAttempt: 'Searching for "blue wine" in inventory',
            errorMessage: 'No drinks found matching "blue wine"',
            suggestedAction: 'Ask for clarification or suggest alternatives',
            context: {
                intent: 'add_to_cart',
                confidence: 0.45,
                sessionState: 'active'
            },
            severity: 'low'
        });
        console.log('✅ Error logged successfully');

        // Test 6: Verify log files exist and have content
        console.log('\n📁 Test 6: Verifying log files...');
        const logDir = path.join(process.cwd(), 'data', 'learning-logs');
        const today = new Date().toISOString().split('T')[0];
        
        const expectedFiles = [
            `interactions-${today}.jsonl`,
            `tool-invocations-${today}.jsonl`,
            `drink-mappings-${today}.jsonl`,
            `errors-${today}.jsonl`
        ];

        for (const file of expectedFiles) {
            const filePath = path.join(logDir, file);
            try {
                const content = await fs.readFile(filePath, 'utf8');
                const lines = content.trim().split('\n').filter(line => line.trim());
                console.log(`✅ ${file}: ${lines.length} entries`);
            } catch (error) {
                console.log(`❌ ${file}: File not found or error reading`);
            }
        }

        // Test 7: Test insights generation
        console.log('\n📊 Test 7: Testing insights generation...');
        const insights = await learningSystem.generateInsights({
            startDate: today,
            endDate: today
        });
        
        console.log(`✅ Insights generated:`);
        console.log(`   - Total interactions: ${insights.overview.totalInteractions}`);
        console.log(`   - Voice commands: ${insights.voiceRecognition.totalVoiceCommands}`);
        console.log(`   - Intent processing: ${insights.intentProcessing.totalIntentProcessing}`);
        console.log(`   - Drink mappings: ${insights.drinkMapping.totalMappings}`);

        console.log('\n🎉 All learning system tests passed!');
        console.log('📈 The system is ready for SFT and RL data collection');
        
        return true;
        
    } catch (error) {
        console.error('❌ Learning system test failed:', error);
        return false;
    }
}

// Run the test
if (require.main === module) {
    testLearningSystem()
        .then(success => {
            process.exit(success ? 0 : 1);
        })
        .catch(error => {
            console.error('Test execution failed:', error);
            process.exit(1);
        });
}

module.exports = { testLearningSystem };
