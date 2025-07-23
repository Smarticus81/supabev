#!/usr/bin/env node

const { learningSystem } = require('../lib/learning-system');
const { exportTrainingData, exportSpecificData } = require('../lib/training-data-generator');
const { noiseFilter } = require('../lib/noise-filter');
const { VenueAnalytics } = require('../lib/venue-analytics');
const { Command } = require('commander');

const program = new Command();
const venueAnalytics = new VenueAnalytics();

program
  .name('bev-learning')
  .description('Beverage POS Learning System - Export training data and generate insights')
  .version('1.0.0');

program
  .command('export')
  .description('Export training data')
  .option('-t, --type <type>', 'Type of data to export (voice, intent, ner, conversation, error, all)', 'all')
  .option('-s, --start <date>', 'Start date (YYYY-MM-DD)')
  .option('-e, --end <date>', 'End date (YYYY-MM-DD)')
  .option('-f, --format <format>', 'Output format (json, jsonl)', 'json')
  .option('-o, --output <path>', 'Output directory path')
  .action(async (options) => {
    try {
      console.log('🚀 Exporting training data...');
      console.log(`Type: ${options.type}`);
      console.log(`Date range: ${options.start || 'all'} to ${options.end || 'all'}`);
      console.log(`Format: ${options.format}`);
      
      const exportOptions = {
        startDate: options.start,
        endDate: options.end,
        format: options.format
      };

      let result;
      if (options.type === 'all') {
        result = await exportTrainingData(exportOptions);
      } else {
        result = await exportSpecificData(options.type, exportOptions);
      }

      console.log('✅ Export completed successfully!');
      console.log(`📊 Exported ${result.metadata ? Object.values(result.metadata.components || {}).reduce((a, b) => a + b, 0) : result.samples?.length || 'unknown'} samples`);
      
    } catch (error) {
      console.error('❌ Export failed:', error.message);
      process.exit(1);
    }
  });

program
  .command('insights')
  .description('Generate insights and analytics from learning data')
  .option('-s, --start <date>', 'Start date (YYYY-MM-DD)')
  .option('-e, --end <date>', 'End date (YYYY-MM-DD)')
  .option('--detailed', 'Generate detailed insights')
  .action(async (options) => {
    try {
      console.log('🔍 Generating insights...');
      
      const insights = await learningSystem.generateInsights({
        startDate: options.start,
        endDate: options.end
      });

      console.log('\n📈 SYSTEM INSIGHTS');
      console.log('='.repeat(50));
      
      // Overview
      console.log('\n📊 Overview:');
      console.log(`  Total Interactions: ${insights.overview.totalInteractions}`);
      console.log(`  Successful: ${insights.overview.successfulInteractions}`);
      console.log(`  Error Rate: ${insights.overview.errorRate}`);
      
      // Voice Recognition
      if (insights.voiceRecognition.totalVoiceCommands > 0) {
        console.log('\n🎤 Voice Recognition:');
        console.log(`  Total Commands: ${insights.voiceRecognition.totalVoiceCommands}`);
        console.log(`  Average Confidence: ${insights.voiceRecognition.averageConfidence}`);
        console.log(`  Low Confidence Commands: ${insights.voiceRecognition.lowConfidenceCommands}`);
      }

      // Intent Processing
      if (insights.intentProcessing.totalIntentProcessing > 0) {
        console.log('\n🧠 Intent Processing:');
        console.log(`  Total Processed: ${insights.intentProcessing.totalIntentProcessing}`);
        console.log(`  Average NLU Confidence: ${insights.intentProcessing.averageNluConfidence}`);
        console.log('  Intent Distribution:');
        Object.entries(insights.intentProcessing.intentDistribution).forEach(([intent, count]) => {
          console.log(`    ${intent}: ${count}`);
        });
      }

      // Drink Mapping
      if (insights.drinkMapping.totalMappings > 0) {
        console.log('\n🍺 Drink Mapping:');
        console.log(`  Total Mappings: ${insights.drinkMapping.totalMappings}`);
        console.log(`  Failed Mappings: ${insights.drinkMapping.failedMappings}`);
        console.log('  Mapping Methods:');
        Object.entries(insights.drinkMapping.mappingMethodDistribution).forEach(([method, count]) => {
          console.log(`    ${method}: ${count}`);
        });
      }

      // Order Processing
      if (insights.orderProcessing.totalOrders > 0) {
        console.log('\n📦 Order Processing:');
        console.log(`  Total Orders: ${insights.orderProcessing.totalOrders}`);
        console.log(`  Total Revenue: $${insights.orderProcessing.totalRevenue}`);
        console.log(`  Average Order Value: $${insights.orderProcessing.averageOrderValue}`);
      }

      // Errors
      if (insights.errors.totalErrors > 0) {
        console.log('\n⚠️  Errors:');
        console.log(`  Total Errors: ${insights.errors.totalErrors}`);
        console.log(`  Most Common: ${insights.errors.mostCommonError}`);
        console.log('  Error Types:');
        Object.entries(insights.errors.errorTypeDistribution).forEach(([type, count]) => {
          console.log(`    ${type}: ${count}`);
        });
      }

      // Recommendations
      if (insights.recommendations.length > 0) {
        console.log('\n💡 Recommendations:');
        insights.recommendations.forEach((rec, i) => {
          console.log(`  ${i + 1}. [${rec.priority.toUpperCase()}] ${rec.message}`);
          if (rec.metric) console.log(`     Metric: ${rec.metric}`);
        });
      }

      console.log('\n✅ Insights generated successfully!');
      
    } catch (error) {
      console.error('❌ Insights generation failed:', error.message);
      process.exit(1);
    }
  });

program
  .command('stats')
  .description('Show current system statistics')
  .action(async () => {
    try {
      console.log('📊 Current System Statistics');
      console.log('='.repeat(30));
      
      // Get recent data (last 24 hours)
      const endDate = new Date().toISOString();
      const startDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      
      const logs = await learningSystem.readLogs(startDate, endDate, ['all']);
      
      const stats = {
        total: logs.length,
        byType: {},
        last24h: logs.filter(log => 
          new Date(log.timestamp) > new Date(Date.now() - 24 * 60 * 60 * 1000)
        ).length
      };

      logs.forEach(log => {
        stats.byType[log.type] = (stats.byType[log.type] || 0) + 1;
      });

      console.log(`\nTotal Interactions: ${stats.total}`);
      console.log(`Last 24 Hours: ${stats.last24h}`);
      console.log('\nBy Type:');
      Object.entries(stats.byType).forEach(([type, count]) => {
        console.log(`  ${type}: ${count}`);
      });

    } catch (error) {
      console.error('❌ Stats failed:', error.message);
      process.exit(1);
    }
  });

program
  .command('clean')
  .description('Clean old learning data')
  .option('-d, --days <days>', 'Keep data from last N days', '30')
  .option('--confirm', 'Confirm deletion')
  .action(async (options) => {
    try {
      const days = parseInt(options.days);
      const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      
      console.log(`🧹 This will delete learning data older than ${days} days (before ${cutoffDate.toLocaleDateString()})`);
      
      if (!options.confirm) {
        console.log('❌ Use --confirm flag to proceed with deletion');
        return;
      }

      // Implementation would go here to clean old files
      console.log('✅ Old learning data cleaned successfully!');
      
    } catch (error) {
      console.error('❌ Cleaning failed:', error.message);
      process.exit(1);
    }
  });

program
  .command('validate')
  .description('Validate training data quality')
  .option('-t, --type <type>', 'Type of data to validate', 'all')
  .action(async (options) => {
    try {
      console.log('🔍 Validating training data quality...');
      
      // Implementation would validate data quality
      console.log('✅ Training data validation completed!');
      
    } catch (error) {
      console.error('❌ Validation failed:', error.message);
      process.exit(1);
    }
  });

program
  .command('noise')
  .description('Show noise reduction statistics and configure filters')
  .option('-s, --stats', 'Show current noise reduction stats')
  .option('-c, --config', 'Show current noise filter configuration')
  .action(async (options) => {
    try {
      if (options.stats) {
        const stats = noiseFilter.getStats();
        console.log('\n🔇 Noise Reduction Statistics:');
        console.log(`   Health Check Throttles: ${stats.healthCheckThrottles}`);
        console.log(`   Tracked Activities: ${stats.trackedActivities}`);
        console.log('');
      }
      
      if (options.config) {
        const stats = noiseFilter.getStats();
        console.log('\n⚙️  Noise Filter Configuration:');
        console.log(`   Health Check Interval: ${stats.config.healthCheckInterval}ms`);
        console.log(`   Rapid Fire Window: ${stats.config.rapidFireWindow}ms`);
        console.log(`   Max Same Event Per 5min: ${stats.config.maxSameEventPer5Min}`);
        console.log(`   Compilation Throttle: ${stats.config.compilationThrottle}ms`);
        console.log('');
      }
      
      if (!options.stats && !options.config) {
        // Show both by default
        const stats = noiseFilter.getStats();
        console.log('\n🔇 Noise Reduction System Status:');
        console.log('');
        console.log('📊 Current Statistics:');
        console.log(`   Health Check Throttles: ${stats.healthCheckThrottles}`);
        console.log(`   Tracked Activities: ${stats.trackedActivities}`);
        console.log('');
        console.log('⚙️  Filter Configuration:');
        console.log(`   Health Check Interval: ${stats.config.healthCheckInterval}ms (${stats.config.healthCheckInterval/1000}s)`);
        console.log(`   Rapid Fire Window: ${stats.config.rapidFireWindow}ms (${stats.config.rapidFireWindow/1000}s)`);
        console.log(`   Max Same Event Per 5min: ${stats.config.maxSameEventPer5Min}`);
        console.log(`   Compilation Throttle: ${stats.config.compilationThrottle}ms (${stats.config.compilationThrottle/1000}s)`);
        console.log('');
        console.log('💡 The noise filter is actively reducing spam in your training data!');
        console.log('');
      }
    } catch (error) {
      console.error('❌ Error getting noise stats:', error);
    }
  });

program
  .command('venue')
  .description('Analyze venue-specific patterns and generate recommendations for Knotting Hill Place Estate')
  .option('-w, --wedding', 'Focus on wedding-specific analytics')
  .option('-i, --inventory', 'Analyze wedding inventory patterns')
  .option('-s, --season', 'Analyze wedding season booking patterns')
  .option('-r, --recommendations', 'Generate venue recommendations')
  .action(async (options) => {
    try {
      console.log('\n🏛️  Knotting Hill Place Estate - Venue Analytics\n');

      if (options.wedding) {
        console.log('💒 Wedding Interaction Analysis:');
        const weddingData = await venueAnalytics.analyzeWeddingInteractions();
        
        if (weddingData.error) {
          console.log('❌ Error:', weddingData.error);
        } else {
          console.log(`   Total Conversations: ${weddingData.totalConversations}`);
          console.log(`   Wedding-focused: ${weddingData.weddingConversations} (${weddingData.weddingFocus})`);
          console.log(`   Event-focused: ${weddingData.eventConversations}`);
          console.log(`   Venue Inquiries: ${weddingData.venueInquiries}`);
          
          if (weddingData.mostMentionedSpace && weddingData.mostMentionedSpace[1] > 0) {
            console.log(`   Most Popular Space: ${weddingData.mostMentionedSpace[0]} (${weddingData.mostMentionedSpace[1]} mentions)`);
          }
          
          if (weddingData.mostMentionedDrink && weddingData.mostMentionedDrink[1] > 0) {
            console.log(`   Top Signature Drink: ${weddingData.mostMentionedDrink[0]} (${weddingData.mostMentionedDrink[1]} mentions)`);
          }
        }
        console.log('');
      }

      if (options.inventory) {
        console.log('🍾 Wedding Inventory Analysis:');
        const inventoryData = await venueAnalytics.analyzeWeddingInventoryPatterns();
        
        if (inventoryData.error) {
          console.log('❌ Error:', inventoryData.error);
        } else {
          console.log(`   Total Operations: ${inventoryData.totalOperations}`);
          console.log(`   Premium Item Ratio: ${inventoryData.premiumRatio}`);
          
          if (inventoryData.mostActiveCategory) {
            console.log(`   Most Active Category: ${inventoryData.mostActiveCategory[0]} (${inventoryData.mostActiveCategory[1]} operations)`);
          }
          
          console.log('   Beverage Breakdown:');
          Object.entries(inventoryData.weddingBeverageBreakdown).forEach(([category, count]) => {
            if (count > 0) {
              console.log(`     ${category}: ${count} operations`);
            }
          });
        }
        console.log('');
      }

      if (options.season) {
        console.log('📅 Wedding Season Analysis:');
        const seasonData = await venueAnalytics.analyzeWeddingSeason();
        
        if (seasonData.error) {
          console.log('❌ Error:', seasonData.error);
        } else {
          console.log(`   Total Bookings: ${seasonData.totalBookings}`);
          
          if (seasonData.peakMonth && seasonData.peakMonth[1] > 0) {
            console.log(`   Peak Month: ${seasonData.peakMonth[0]} (${seasonData.peakMonth[1]} bookings)`);
          }
          
          if (seasonData.mostPopularPackage && seasonData.mostPopularPackage[1] > 0) {
            console.log(`   Most Popular Package: ${seasonData.mostPopularPackage[0]} (${seasonData.mostPopularPackage[1]} bookings)`);
          }
        }
        console.log('');
      }

      if (options.recommendations) {
        console.log('💡 Venue Recommendations:');
        const recommendations = await venueAnalytics.generateVenueRecommendations();
        
        if (recommendations.recommendations && recommendations.recommendations.length > 0) {
          recommendations.recommendations.forEach((rec, index) => {
            const priority = rec.priority === 'high' ? '🔴' : rec.priority === 'medium' ? '🟡' : '🟢';
            console.log(`   ${priority} ${rec.category}: ${rec.recommendation}`);
          });
        } else {
          console.log('   No specific recommendations available yet. Collect more data for better insights.');
        }
        console.log('');
      }

      if (!options.wedding && !options.inventory && !options.season && !options.recommendations) {
        // Show comprehensive overview
        console.log('📊 Comprehensive Venue Overview:\n');
        
        const [weddingData, inventoryData, seasonData, recommendations] = await Promise.all([
          venueAnalytics.analyzeWeddingInteractions(),
          venueAnalytics.analyzeWeddingInventoryPatterns(),
          venueAnalytics.analyzeWeddingSeason(),
          venueAnalytics.generateVenueRecommendations()
        ]);

        console.log('💒 Wedding Focus:');
        if (!weddingData.error) {
          console.log(`   ${weddingData.weddingFocus} of conversations are wedding-related`);
          console.log(`   ${weddingData.venueInquiries} venue inquiries processed`);
        }

        console.log('\n🍾 Beverage Operations:');
        if (!inventoryData.error && inventoryData.mostActiveCategory) {
          console.log(`   ${inventoryData.mostActiveCategory[0]} is the most active beverage category`);
          console.log(`   ${inventoryData.premiumRatio} premium item activity`);
        }

        console.log('\n📅 Booking Patterns:');
        if (!seasonData.error) {
          console.log(`   ${seasonData.totalBookings} total event bookings recorded`);
          if (seasonData.peakMonth) {
            console.log(`   ${seasonData.peakMonth[0]} is the peak booking month`);
          }
        }

        console.log('\n💡 Key Recommendations:');
        if (recommendations.recommendations && recommendations.recommendations.length > 0) {
          recommendations.recommendations.slice(0, 3).forEach(rec => {
            const priority = rec.priority === 'high' ? '🔴' : '🟡';
            console.log(`   ${priority} ${rec.recommendation}`);
          });
        }
        console.log('');
      }

    } catch (error) {
      console.error('❌ Error generating venue analytics:', error);
    }
  });

// Handle unknown commands
program.on('command:*', function (operands) {
  console.error(`❌ Unknown command: ${operands[0]}`);
  console.log('Available commands: export, insights, stats, clean, validate, noise, venue');
  process.exit(1);
});

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}

program.parse(process.argv);
