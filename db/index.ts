import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';

// Configure Neon for minimal latency
const sql = neon(process.env.DATABASE_URL!, {
  fetchConnectionCache: true,
  fullResults: false,
});

// Configure Drizzle with caching and performance optimizations
const db = drizzle(sql, { 
  schema,
  casing: 'snake_case',
});

// In-memory caches for frequent queries
const drinkCache = new Map();
const inventoryCache = new Map();
const cacheExpiry = new Map();

const CACHE_TTL = 30000; // 30 seconds

export const clearCache = (key?: string) => {
  if (key) {
    drinkCache.delete(key);
    inventoryCache.delete(key);
    cacheExpiry.delete(key);
  } else {
    drinkCache.clear();
    inventoryCache.clear();
    cacheExpiry.clear();
  }
};

export const getCachedData = (key: string, cache: Map<any, any>) => {
  const expiry = cacheExpiry.get(key);
  if (expiry && Date.now() < expiry) {
    return cache.get(key);
  }
  return null;
};

export const setCachedData = (key: string, data: any, cache: Map<any, any>) => {
  cache.set(key, data);
  cacheExpiry.set(key, Date.now() + CACHE_TTL);
};

export { drinkCache, inventoryCache };
export default db;
