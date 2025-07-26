import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

// Enhanced connection configuration for production
const connectionString = process.env.DATABASE_URL || 
  process.env.NEXT_PUBLIC_SUPABASE_URL 
  ? `postgresql://postgres.axjxyfqfrrmckfhktwdw:Munyaradzi1!@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true`
  : 'postgresql://localhost:5432/beverage_pos';

// Production-optimized postgres client configuration
const client = postgres(connectionString, {
  // Connection pooling settings
  max: 20, // Maximum number of connections in the pool
  idle_timeout: 20, // Close idle connections after 20 seconds
  connect_timeout: 10, // Connection timeout in seconds
  
  // Performance settings
  prepare: false, // Disable prepared statements for PgBouncer compatibility
  ssl: process.env.NODE_ENV === 'production' ? 'require' : false,
  
  // Error handling
  onnotice: process.env.NODE_ENV === 'development' ? console.log : undefined,
  
  // Connection optimization
  transform: postgres.camel, // Transform snake_case to camelCase automatically
  
  // Retry configuration
  connection: {
    application_name: 'beverage-pos-app',
    statement_timeout: 30000, // 30 seconds
    idle_in_transaction_session_timeout: 60000, // 1 minute
  }
});

// Enhanced Drizzle configuration
const db = drizzle(client, { 
  schema,
  casing: 'snake_case',
  logger: process.env.NODE_ENV === 'development',
});

// Enhanced caching system with performance monitoring
const cacheStats = {
  hits: 0,
  misses: 0,
  evictions: 0
};

const drinkCache = new Map();
const inventoryCache = new Map();
const orderCache = new Map();
const cacheExpiry = new Map();

const CACHE_TTL = {
  drinks: 30000, // 30 seconds for drinks data
  inventory: 10000, // 10 seconds for inventory (more frequent updates)
  orders: 5000, // 5 seconds for orders (real-time needs)
  default: 30000
};

// Cache management functions
export const clearCache = (key?: string, cacheType?: 'drinks' | 'inventory' | 'orders') => {
  if (key) {
    drinkCache.delete(key);
    inventoryCache.delete(key);
    orderCache.delete(key);
    cacheExpiry.delete(key);
    cacheStats.evictions++;
  } else if (cacheType) {
    switch (cacheType) {
      case 'drinks':
        drinkCache.clear();
        break;
      case 'inventory':
        inventoryCache.clear();
        break;
      case 'orders':
        orderCache.clear();
        break;
    }
    cacheStats.evictions++;
  } else {
    drinkCache.clear();
    inventoryCache.clear();
    orderCache.clear();
    cacheExpiry.clear();
    cacheStats.evictions++;
  }
};

export const getCachedData = (key: string, cache: Map<any, any>) => {
  const expiry = cacheExpiry.get(key);
  if (expiry && Date.now() < expiry) {
    cacheStats.hits++;
    return cache.get(key);
  }
  cacheStats.misses++;
  return null;
};

export const setCachedData = (key: string, data: any, cache: Map<any, any>, ttl?: number) => {
  cache.set(key, data);
  cacheExpiry.set(key, Date.now() + (ttl || CACHE_TTL.default));
};

// Health check function
export const checkDatabaseHealth = async () => {
  try {
    const start = Date.now();
    await client`SELECT 1 as health_check`;
    const latency = Date.now() - start;
    
    return {
      status: 'healthy',
      latency,
      pool: {
        totalConnections: client.options.max,
        // Note: Pool statistics not available in this postgres client version
        status: 'monitored'
      },
      cache: {
        ...cacheStats,
        hitRate: cacheStats.hits / (cacheStats.hits + cacheStats.misses) || 0
      }
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};

// Graceful shutdown
export const closeDatabase = async () => {
  try {
    await client.end();
    clearCache();
    console.log('Database connection closed gracefully');
  } catch (error) {
    console.error('Error closing database connection:', error);
  }
};

// Export the enhanced database instance and utilities
export { drinkCache, inventoryCache, orderCache, cacheStats, CACHE_TTL };
export default db;
