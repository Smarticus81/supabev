/**
 * Performance Monitoring Utility for Latency Optimization
 * Tracks response times and identifies bottlenecks
 */

interface PerformanceMetric {
  operation: string;
  duration: number;
  timestamp: number;
  success: boolean;
  details?: any;
}

class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private activeTimers = new Map<string, number>();

  // Start timing an operation
  startTimer(operationId: string): void {
    this.activeTimers.set(operationId, performance.now());
  }

  // End timing and record metric
  endTimer(operationId: string, operation: string, success: boolean = true, details?: any): number {
    const startTime = this.activeTimers.get(operationId);
    if (!startTime) {
      console.warn(`No start time found for operation: ${operationId}`);
      return 0;
    }

    const duration = performance.now() - startTime;
    this.activeTimers.delete(operationId);

    const metric: PerformanceMetric = {
      operation,
      duration,
      timestamp: Date.now(),
      success,
      details
    };

    this.metrics.push(metric);

    // Log slow operations (>500ms)
    if (duration > 500) {
      console.warn(`🐌 Slow operation detected: ${operation} took ${duration.toFixed(2)}ms`);
    }

    // Keep only last 1000 metrics to prevent memory leaks
    if (this.metrics.length > 1000) {
      this.metrics = this.metrics.slice(-1000);
    }

    return duration;
  }

  // Get performance statistics
  getStats(operation?: string): {
    count: number;
    avgDuration: number;
    minDuration: number;
    maxDuration: number;
    successRate: number;
  } {
    let filteredMetrics = this.metrics;
    
    if (operation) {
      filteredMetrics = this.metrics.filter(m => m.operation === operation);
    }

    if (filteredMetrics.length === 0) {
      return {
        count: 0,
        avgDuration: 0,
        minDuration: 0,
        maxDuration: 0,
        successRate: 0
      };
    }

    const durations = filteredMetrics.map(m => m.duration);
    const successCount = filteredMetrics.filter(m => m.success).length;

    return {
      count: filteredMetrics.length,
      avgDuration: durations.reduce((a, b) => a + b, 0) / durations.length,
      minDuration: Math.min(...durations),
      maxDuration: Math.max(...durations),
      successRate: (successCount / filteredMetrics.length) * 100
    };
  }

  // Get slowest operations
  getSlowestOperations(limit: number = 10): PerformanceMetric[] {
    return [...this.metrics]
      .sort((a, b) => b.duration - a.duration)
      .slice(0, limit);
  }

  // Clear metrics
  clearMetrics(): void {
    this.metrics = [];
    this.activeTimers.clear();
  }

  // Export metrics for analysis
  exportMetrics(): PerformanceMetric[] {
    return [...this.metrics];
  }
}

// Singleton instance
export const performanceMonitor = new PerformanceMonitor();

// Utility function for timing async operations
export async function timeOperation<T>(
  operationName: string,
  operation: () => Promise<T>
): Promise<T> {
  const operationId = `${operationName}_${Date.now()}_${Math.random()}`;
  
  performanceMonitor.startTimer(operationId);
  
  try {
    const result = await operation();
    performanceMonitor.endTimer(operationId, operationName, true);
    return result;
  } catch (error) {
    performanceMonitor.endTimer(operationId, operationName, false, { error: error.message });
    throw error;
  }
}

// Decorator for timing class methods
export function timed(operationName?: string) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    const operation = operationName || `${target.constructor.name}.${propertyKey}`;

    descriptor.value = async function (...args: any[]) {
      return timeOperation(operation, () => originalMethod.apply(this, args));
    };

    return descriptor;
  };
}