import { useCallback, useEffect, useRef } from 'react';
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
  // Cache scroll position in memory to avoid expensive sessionStorage reads
  const scrollPositionRef = useRef<number>(0);
  const lastScrollSaveRef = useRef<number>(0);

  /**
   * Get cached data if it exists and is not expired
   */
  const getCachedData = useCallback((): CachedData<T> | null => {
    try {
      const cached = sessionStorage.getItem(cacheKey);
      if (!cached) {
        return null;
      }

      const data: CachedData<T> = JSON.parse(cached);
      const now = Date.now();
      const age = now - data.timestamp;

      // Check if cache is expired
      if (age > CACHE_TTL) {
        sessionStorage.removeItem(cacheKey);
        return null;
      }

      // Store scroll position in memory for quick access
      scrollPositionRef.current = data.scrollPosition || 0;
      return data;
    } catch (error) {
      debug.error(`[Cache] Error reading cache for ${sportType}:`, error);
      return null;
    }
  }, [sportType, cacheKey]);

  /**
   * Clear all sports caches (defined early for use in setCachedData)
   */
  const clearAllCaches = useCallback(() => {
    const sports: SportType[] = ['nfl', 'nba', 'ncaab', 'college-football'];
    sports.forEach(sport => {
      try {
        sessionStorage.removeItem(`wagerproof_${sport}_cache`);
      } catch (error) {
        // Silently fail for individual cache clears
      }
    });
    scrollPositionRef.current = 0;
  }, []);

  /**
   * Save data to cache
   */
  const setCachedData = useCallback((data: Omit<CachedData<T>, 'timestamp'>) => {
    try {
      const cacheData: CachedData<T> = {
        ...data,
        scrollPosition: scrollPositionRef.current, // Use in-memory scroll position
        timestamp: Date.now(),
      };
      sessionStorage.setItem(cacheKey, JSON.stringify(cacheData));
    } catch (error) {
      debug.error(`[Cache] Error saving cache for ${sportType}:`, error);
      // If quota exceeded, try to clear old caches
      if (error instanceof Error && error.name === 'QuotaExceededError') {
        clearAllCaches();
      }
    }
  }, [sportType, cacheKey, clearAllCaches]);

  /**
   * Clear cache for this sport
   */
  const clearCache = useCallback(() => {
    try {
      sessionStorage.removeItem(cacheKey);
      scrollPositionRef.current = 0;
    } catch (error) {
      debug.error(`[Cache] Error clearing cache for ${sportType}:`, error);
    }
  }, [sportType, cacheKey]);

  /**
   * Save current scroll position (optimized - only updates in-memory ref)
   */
  const saveScrollPosition = useCallback(() => {
    const currentScroll = window.scrollY || 0;
    const now = Date.now();
    
    // Only update if scroll changed significantly (> 10px) or 2+ seconds passed
    if (Math.abs(scrollPositionRef.current - currentScroll) > 10 || 
        (now - lastScrollSaveRef.current) > 2000) {
      scrollPositionRef.current = currentScroll;
      lastScrollSaveRef.current = now;
      
      // Only write to sessionStorage if we have cached data (avoid unnecessary reads)
      try {
        const cached = sessionStorage.getItem(cacheKey);
        if (cached) {
          const data: CachedData<T> = JSON.parse(cached);
          data.scrollPosition = currentScroll;
          sessionStorage.setItem(cacheKey, JSON.stringify(data));
        }
      } catch (error) {
        // Silently fail - scroll position is not critical
      }
    }
  }, [cacheKey]);

  /**
   * Restore scroll position from cache
   */
  const restoreScrollPosition = useCallback((position: number) => {
    if (position <= 0) return;
    
    // Use requestAnimationFrame to ensure DOM is ready
    requestAnimationFrame(() => {
      window.scrollTo(0, position);
      scrollPositionRef.current = position;
    });
  }, []);

  /**
   * Save scroll position before navigating away
   */
  useEffect(() => {
    const handleBeforeUnload = () => {
      // Force save on unload
      const currentScroll = window.scrollY || 0;
      scrollPositionRef.current = currentScroll;
      try {
        const cached = sessionStorage.getItem(cacheKey);
        if (cached) {
          const data: CachedData<T> = JSON.parse(cached);
          data.scrollPosition = currentScroll;
          sessionStorage.setItem(cacheKey, JSON.stringify(data));
        }
      } catch (error) {
        // Silently fail
      }
    };

    // Save scroll position periodically (debounced - every 2 seconds of scrolling)
    let scrollTimeout: NodeJS.Timeout;
    const handleScroll = () => {
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(saveScrollPosition, 2000);
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('scroll', handleScroll);
      clearTimeout(scrollTimeout);
    };
  }, [saveScrollPosition, cacheKey]);

  return {
    getCachedData,
    setCachedData,
    clearCache,
    clearAllCaches,
    restoreScrollPosition,
  };
}

