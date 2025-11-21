/**
 * Cache for The Odds API responses to prevent excessive API calls
 * Caches responses for 5 minutes to balance freshness and quota usage
 */

import { OddsApiEvent } from './theOddsApi';

interface CachedOdds {
  events: OddsApiEvent[];
  timestamp: number;
  sportKey: string;
}

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds
const cache = new Map<string, CachedOdds>();

/**
 * Get cached odds for a sport if available and not expired
 */
export function getCachedOdds(sportKey: string): OddsApiEvent[] | null {
  const cached = cache.get(sportKey);
  if (!cached) {
    return null;
  }

  const now = Date.now();
  const age = now - cached.timestamp;

  if (age > CACHE_DURATION) {
    // Cache expired, remove it
    cache.delete(sportKey);
    return null;
  }

  return cached.events;
}

/**
 * Store odds in cache
 */
export function setCachedOdds(sportKey: string, events: OddsApiEvent[]): void {
  cache.set(sportKey, {
    events,
    timestamp: Date.now(),
    sportKey,
  });
}

/**
 * Clear cache for a specific sport or all sports
 */
export function clearCache(sportKey?: string): void {
  if (sportKey) {
    cache.delete(sportKey);
  } else {
    cache.clear();
  }
}

/**
 * Get cache age in seconds
 */
export function getCacheAge(sportKey: string): number | null {
  const cached = cache.get(sportKey);
  if (!cached) {
    return null;
  }
  return Math.floor((Date.now() - cached.timestamp) / 1000);
}

