/**
 * Venue-Specific Analytics for Knotting Hill Place Estate
 * Generates insights specific to wedding venue operations
 */

const fs = require('fs').promises;
const path = require('path');

class VenueAnalytics {
  constructor() {
    this.logsDir = path.join(process.cwd(), 'data', 'learning-logs');
  }

  /**
   * Analyze wedding-specific conversation patterns
   */
  async analyzeWeddingInteractions() {
    try {
      const conversationsPath = path.join(this.logsDir, 'conversations.jsonl');
      const data = await fs.readFile(conversationsPath, 'utf8');
      const conversations = data.trim().split('\n').map(line => JSON.parse(line));

      const weddingKeywords = [
        'wedding', 'bride', 'groom', 'ceremony', 'reception', 'marriage',
        'bridal', 'honeymoon', 'engagement', 'anniversary', 'vows',
        'garden gazebo', 'dove courtyard', 'manor bar', 'veranda bar',
        'lavender hill spritz', 'veranda peach mule', 'brighton abbey'
      ];

      const eventKeywords = [
        'event', 'party', 'celebration', 'gathering', 'function',
        'corporate', 'anniversary', 'birthday', 'reunion'
      ];

      const venueSpaces = {
        'garden gazebo': 0,
        'dove courtyard': 0,
        'manor bar': 0,
        'veranda bar': 0,
        'hidden cellar bar': 0,
        'bridal suite': 0,
        'groom\'s den': 0
      };

      const signatureDrinks = {
        'lavender hill spritz': 0,
        'veranda peach mule': 0
      };

      let weddingConversations = 0;
      let eventConversations = 0;
      let venueInquiries = 0;

      conversations.forEach(conv => {
        const text = (conv.userMessage + ' ' + conv.assistantResponse).toLowerCase();
        
        // Check for wedding-related conversations
        if (weddingKeywords.some(keyword => text.includes(keyword))) {
          weddingConversations++;
        }

        // Check for general event conversations
        if (eventKeywords.some(keyword => text.includes(keyword))) {
          eventConversations++;
        }

        // Track venue space mentions
        Object.keys(venueSpaces).forEach(space => {
          if (text.includes(space)) {
            venueSpaces[space]++;
          }
        });

        // Track signature drink mentions
        Object.keys(signatureDrinks).forEach(drink => {
          if (text.includes(drink)) {
            signatureDrinks[drink]++;
          }
        });

        // Check for venue inquiry patterns
        if (text.includes('capacity') || text.includes('guest') || text.includes('book') || 
            text.includes('available') || text.includes('price') || text.includes('package')) {
          venueInquiries++;
        }
      });

      return {
        totalConversations: conversations.length,
        weddingConversations,
        eventConversations,
        venueInquiries,
        venueSpaceMentions: venueSpaces,
        signatureDrinkMentions: signatureDrinks,
        weddingFocus: (weddingConversations / conversations.length * 100).toFixed(1) + '%',
        mostMentionedSpace: Object.entries(venueSpaces).sort((a, b) => b[1] - a[1])[0],
        mostMentionedDrink: Object.entries(signatureDrinks).sort((a, b) => b[1] - a[1])[0]
      };
    } catch (error) {
      return { error: error.message };
    }
  }

  /**
   * Analyze inventory patterns specific to wedding venue needs
   */
  async analyzeWeddingInventoryPatterns() {
    try {
      const inventoryPath = path.join(this.logsDir, 'inventory-operations.jsonl');
      const data = await fs.readFile(inventoryPath, 'utf8');
      const operations = data.trim().split('\n').map(line => JSON.parse(line));

      const weddingBeverages = {
        champagne: 0,
        wine: 0,
        cocktails: 0,
        beer: 0,
        'non-alcoholic': 0
      };

      const premiumItems = {
        'premium whiskey': 0,
        'craft cocktails': 0,
        'vintage wine': 0,
        'top shelf': 0
      };

      operations.forEach(op => {
        const item = op.drinkName?.toLowerCase() || '';
        
        // Categorize by wedding-appropriate beverages
        if (item.includes('champagne') || item.includes('prosecco') || item.includes('sparkling')) {
          weddingBeverages.champagne++;
        } else if (item.includes('wine') || item.includes('chardonnay') || item.includes('pinot')) {
          weddingBeverages.wine++;
        } else if (item.includes('cocktail') || item.includes('mixed') || item.includes('spritz') || item.includes('mule')) {
          weddingBeverages.cocktails++;
        } else if (item.includes('beer') || item.includes('lager') || item.includes('ale')) {
          weddingBeverages.beer++;
        } else if (item.includes('water') || item.includes('soda') || item.includes('juice')) {
          weddingBeverages['non-alcoholic']++;
        }

        // Track premium items
        Object.keys(premiumItems).forEach(premium => {
          if (item.includes(premium)) {
            premiumItems[premium]++;
          }
        });
      });

      return {
        totalOperations: operations.length,
        weddingBeverageBreakdown: weddingBeverages,
        premiumItemActivity: premiumItems,
        mostActiveCategory: Object.entries(weddingBeverages).sort((a, b) => b[1] - a[1])[0],
        premiumRatio: (Object.values(premiumItems).reduce((a, b) => a + b, 0) / operations.length * 100).toFixed(1) + '%'
      };
    } catch (error) {
      return { error: error.message };
    }
  }

  /**
   * Generate venue-specific recommendations
   */
  async generateVenueRecommendations() {
    const conversationAnalysis = await this.analyzeWeddingInteractions();
    const inventoryAnalysis = await this.analyzeWeddingInventoryPatterns();

    const recommendations = [];

    // Wedding focus recommendations
    if (conversationAnalysis.weddingConversations > conversationAnalysis.eventConversations) {
      recommendations.push({
        category: 'Marketing Focus',
        recommendation: 'Continue emphasizing wedding packages - wedding conversations dominate interactions',
        priority: 'medium'
      });
    }

    // Venue space recommendations
    const topSpace = conversationAnalysis.mostMentionedSpace;
    if (topSpace && topSpace[1] > 0) {
      recommendations.push({
        category: 'Popular Spaces',
        recommendation: `${topSpace[0]} is most discussed - consider highlighting this space in marketing`,
        priority: 'high'
      });
    }

    // Signature drink recommendations
    const topDrink = conversationAnalysis.mostMentionedDrink;
    if (topDrink && topDrink[1] > 0) {
      recommendations.push({
        category: 'Signature Beverages',
        recommendation: `${topDrink[0]} is popular - ensure adequate inventory and train staff on preparation`,
        priority: 'high'
      });
    }

    // Inventory recommendations
    const topCategory = inventoryAnalysis.mostActiveCategory;
    if (topCategory) {
      recommendations.push({
        category: 'Inventory Management',
        recommendation: `${topCategory[0]} is the most active category - monitor stock levels closely`,
        priority: 'medium'
      });
    }

    return {
      recommendations,
      conversationInsights: conversationAnalysis,
      inventoryInsights: inventoryAnalysis,
      generatedAt: new Date().toISOString()
    };
  }

  /**
   * Generate wedding season analysis
   */
  async analyzeWeddingSeason() {
    try {
      const eventPath = path.join(this.logsDir, 'tool-invocations.jsonl');
      const data = await fs.readFile(eventPath, 'utf8');
      const events = data.trim().split('\n').map(line => JSON.parse(line));

      const weddingBookings = events.filter(event => 
        event.toolName === 'book_event' && 
        event.success !== false
      );

      const monthlyBookings = {};
      const packagePopularity = {};

      weddingBookings.forEach(booking => {
        const date = new Date(booking.timestamp);
        const month = date.toLocaleString('default', { month: 'long' });
        
        monthlyBookings[month] = (monthlyBookings[month] || 0) + 1;

        if (booking.parameters?.package) {
          const pkg = booking.parameters.package;
          packagePopularity[pkg] = (packagePopularity[pkg] || 0) + 1;
        }
      });

      return {
        totalBookings: weddingBookings.length,
        monthlyDistribution: monthlyBookings,
        packagePopularity,
        peakMonth: Object.entries(monthlyBookings).sort((a, b) => b[1] - a[1])[0],
        mostPopularPackage: Object.entries(packagePopularity).sort((a, b) => b[1] - a[1])[0]
      };
    } catch (error) {
      return { error: error.message };
    }
  }
}

module.exports = { VenueAnalytics };
