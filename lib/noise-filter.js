/**
 * Noise Filter for Learning System
 * Reduces logging spam and low-value data collection
 */

class NoiseFilter {
  constructor() {
    // Track recent activities to prevent spam logging
    this.recentActivity = new Map();
    this.healthCheckThrottle = new Map();
    
    // Configurable thresholds
    this.config = {
      healthCheckInterval: 10000, // Only log health checks every 10 seconds
      rapidFireWindow: 2000,      // Window for detecting rapid fire events
      maxSameEventPer5Min: 5,     // Max same events per 5 minutes
      compilationThrottle: 30000, // Only log compilation issues every 30 seconds
    };
  }

  /**
   * Filter health check spam
   */
  shouldLogHealthCheck(data) {
    const now = Date.now();
    const key = 'health_check';
    const lastLog = this.healthCheckThrottle.get(key) || 0;
    
    // Only log health checks if:
    // 1. It's been more than 10 seconds since last log
    // 2. There's an error/failure
    if (data.success === false || data.error) {
      this.healthCheckThrottle.set(key, now);
      return true;
    }
    
    if (now - lastLog > this.config.healthCheckInterval) {
      this.healthCheckThrottle.set(key, now);
      return true;
    }
    
    return false;
  }

  /**
   * Filter cart polling spam
   */
  shouldLogCartActivity(data) {
    const now = Date.now();
    const key = `cart_${data.sessionId || 'unknown'}`;
    const lastLog = this.recentActivity.get(key) || 0;
    
    // Only log cart activities if:
    // 1. Cart state actually changed
    // 2. It's been more than 5 seconds since last cart log
    if (data.stateChanged || now - lastLog > 5000) {
      this.recentActivity.set(key, now);
      return true;
    }
    
    return false;
  }

  /**
   * Filter compilation spam
   */
  shouldLogCompilation(data) {
    const now = Date.now();
    const key = 'compilation';
    const lastLog = this.recentActivity.get(key) || 0;
    
    // Only log compilation if:
    // 1. There's an error
    // 2. It's been more than 30 seconds since last log
    if (data.hasError || now - lastLog > this.config.compilationThrottle) {
      this.recentActivity.set(key, now);
      return true;
    }
    
    return false;
  }

  /**
   * Filter rapid fire events
   */
  shouldLogEvent(eventType, sessionId = 'unknown') {
    const now = Date.now();
    const key = `${eventType}_${sessionId}`;
    const recentEvents = this.recentActivity.get(key) || [];
    
    // Clean old events (older than 5 minutes)
    const fiveMinutesAgo = now - 300000;
    const filteredEvents = recentEvents.filter(time => time > fiveMinutesAgo);
    
    // Check if we've hit the spam threshold
    if (filteredEvents.length >= this.config.maxSameEventPer5Min) {
      return false;
    }
    
    // Add current event
    filteredEvents.push(now);
    this.recentActivity.set(key, filteredEvents);
    
    return true;
  }

  /**
   * Check if a tool call is noise
   */
  isNoisyTool(toolName) {
    const noisyTools = [
      'health_check',
      'system_status',
      'ping',
      'heartbeat',
      'get_system_time',
      'check_connection',
      'validate_session',
      'refresh_token',
      'keep_alive'
    ];
    
    return noisyTools.includes(toolName);
  }

  /**
   * Check if an interaction is low value
   */
  isLowValueInteraction(interactionType) {
    const lowValueTypes = [
      'page_reload',
      'tab_switch',
      'window_focus',
      'window_blur',
      'idle_timeout',
      'connection_check',
      'status_poll',
      'keepalive',
      'compilation_cycle',
      'auto_refresh',
      'websocket_ping',
      'session_heartbeat'
    ];
    
    return lowValueTypes.includes(interactionType);
  }

  /**
   * Get quality score for interaction (0-100)
   */
  getInteractionQuality(data) {
    let score = 50; // Base score
    
    // Boost scores for valuable interactions
    if (data.userInitiated) score += 20;
    if (data.hasIntent) score += 15;
    if (data.hasResponse) score += 10;
    if (data.toolsUsed && data.toolsUsed.length > 0) score += 15;
    if (data.errorResolved) score += 20;
    
    // Reduce scores for noise
    if (this.isNoisyTool(data.toolName)) score -= 30;
    if (this.isLowValueInteraction(data.interactionType)) score -= 25;
    if (data.isAutomated) score -= 15;
    if (data.isRepetitive) score -= 20;
    
    return Math.max(0, Math.min(100, score));
  }

  /**
   * Clean up old tracking data
   */
  cleanup() {
    const now = Date.now();
    const oneHourAgo = now - 3600000;
    
    // Clean up health check throttle
    for (const [key, time] of this.healthCheckThrottle.entries()) {
      if (time < oneHourAgo) {
        this.healthCheckThrottle.delete(key);
      }
    }
    
    // Clean up recent activity
    for (const [key, data] of this.recentActivity.entries()) {
      if (Array.isArray(data)) {
        const filtered = data.filter(time => time > oneHourAgo);
        if (filtered.length === 0) {
          this.recentActivity.delete(key);
        } else {
          this.recentActivity.set(key, filtered);
        }
      } else if (data < oneHourAgo) {
        this.recentActivity.delete(key);
      }
    }
  }

  /**
   * Get noise reduction statistics
   */
  getStats() {
    return {
      healthCheckThrottles: this.healthCheckThrottle.size,
      trackedActivities: this.recentActivity.size,
      config: this.config
    };
  }
}

// Singleton instance
const noiseFilter = new NoiseFilter();

// Clean up every hour
setInterval(() => {
  noiseFilter.cleanup();
}, 3600000);

module.exports = { NoiseFilter, noiseFilter };
