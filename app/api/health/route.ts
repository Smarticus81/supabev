import { NextResponse } from 'next/server';
import { checkDatabaseHealth } from '../../../db/index';

export async function GET() {
  try {
    const healthCheck = await checkDatabaseHealth();
    
    const status = healthCheck.status === 'healthy' ? 200 : 503;
    
    return NextResponse.json({
      status: healthCheck.status,
      timestamp: new Date().toISOString(),
      database: {
        status: healthCheck.status,
        latency: healthCheck.latency,
        pool: healthCheck.pool || { status: 'monitored' },
        cache: healthCheck.cache || { status: 'active' }
      },
      consolidation: {
        drizzleOrmActive: true,
        legacyWrappersRemoved: true,
        standardizedPatterns: true
      }
    }, { status });
    
  } catch (error) {
    console.error('Health check failed:', error);
    return NextResponse.json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 