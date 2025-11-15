import { useCallback, useEffect } from 'react';
import debug from '@/utils/debug';

// Cache expiration time: 5 minutes
const CACHE_TTL = 5 * 60 * 1000;

export type SportType = 'nfl' | 'nba' | 'ncaab' | 'college-football';

interface CachedData<T = any> {
  predictions: T[];
  teamMappings?: any[];
  lastUpdated: number;
  searchQuery: string;
  sortKey: string;
  sortAscending: boolean;
  scrollPosition: number;
  activeFilters?: string[];
  timestamp: number;
}

/**
 * Lightweight session-based cache for sports pages
 * Stores fetched data and UI state to reduce API calls and improve UX
 */
export function useSportsPageCache<T = any>(sportType: SportType) {
  const cacheKey = `wagerproof_${sportType}_cache`;

  /**
   * Get cached data if it exists and is not expired
   */
  const getCachedData = useCallback((): CachedData<T> | null => {
    try {
      const cached = sessionStorage.getItem(cacheKey);
      if (!cached) {
        debug.log(`[Cache] No cache found for ${sportType}`);
        return null;
      }

      const data: CachedData<T> = JSON.parse(cached);
      const now = Date.now();
      const age = now - data.timestamp;

      // Check if cache is expired
      if (age > CACHE_TTL) {
        debug.log(`[Cache] Cache expired for ${sportType} (age: ${Math.round(age / 1000)}s)`);
        sessionStorage.removeItem(cacheKey);
        return null;
      }

      debug.log(`[Cache] Retrieved valid cache for ${sportType} (age: ${Math.round(age / 1000)}s, ${data.predictions.length} items)`);
      return data;
    } catch (error) {
      debug.error(`[Cache] Error reading cache for ${sportType}:`, error);
      return null;
    }
  }, [sportType, cacheKey]);

  /**
   * Save data to cache
   */
  const setCachedData = useCallback((data: Omit<CachedData<T>, 'timestamp'>) => {
    try {
      const cacheData: CachedData<T> = {
        ...data,
        timestamp: Date.now(),
      };
      sessionStorage.setItem(cacheKey, JSON.stringify(cacheData));
      debug.log(`[Cache] Saved cache for ${sportType} (${data.predictions.length} items)`);
    } catch (error) {
      debug.error(`[Cache] Error saving cache for ${sportType}:`, error);
      // If quota exceeded, try to clear old caches
      if (error instanceof Error && error.name === 'QuotaExceededError') {
        debug.warn('[Cache] Storage quota exceeded, clearing old caches');
        clearAllCaches();
      }
    }
  }, [sportType, cacheKey]);

  /**
   * Clear cache for this sport
   */
  const clearCache = useCallback(() => {
    try {
      sessionStorage.removeItem(cacheKey);
      debug.log(`[Cache] Cleared cache for ${sportType}`);
    } catch (error) {
      debug.error(`[Cache] Error clearing cache for ${sportType}:`, error);
    }
  }, [sportType, cacheKey]);

  /**
   * Clear all sports caches
   */
  const clearAllCaches = useCallback(() => {
    const sports: SportType[] = ['nfl', 'nba', 'ncaab', 'college-football'];
    sports.forEach(sport => {
      try {
        sessionStorage.removeItem(`wagerproof_${sport}_cache`);
      } catch (error) {
        debug.error(`[Cache] Error clearing cache for ${sport}:`, error);
      }
    });
    debug.log('[Cache] Cleared all sports caches');
  }, []);

  /**
   * Save current scroll position
   */
  const saveScrollPosition = useCallback(() => {
    const cached = getCachedData();
    if (cached) {
      setCachedData({
        ...cached,
        scrollPosition: window.scrollY,
      });
    }
  }, [getCachedData, setCachedData]);

  /**
   * Restore scroll position from cache
   */
  const restoreScrollPosition = useCallback((position: number) => {
    // Use requestAnimationFrame to ensure DOM is ready
    requestAnimationFrame(() => {
      window.scrollTo(0, position);
      debug.log(`[Cache] Restored scroll position for ${sportType}: ${position}px`);
    });
  }, [sportType]);

  /**
   * Save scroll position before navigating away
   */
  useEffect(() => {
    const handleBeforeUnload = () => {
      saveScrollPosition();
    };

    // Save scroll position periodically (every 2 seconds of scrolling)
    let scrollTimeout: NodeJS.Timeout;
    const handleScroll = () => {
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(saveScrollPosition, 2000);
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('scroll', handleScroll);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('scroll', handleScroll);
      clearTimeout(scrollTimeout);
    };
  }, [saveScrollPosition]);

  return {
    getCachedData,
    setCachedData,
    clearCache,
    clearAllCaches,
    restoreScrollPosition,
  };
}

