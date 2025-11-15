import { useCallback, useRef, useEffect } from 'react';

type SportFilter = 'all' | 'nfl' | 'cfb' | 'nba' | 'ncaab';

interface TodayInSportsUIState {
  // Expansion states
  showAllValueAlerts: boolean;
  showAllFadeAlerts: boolean;
  showAllTailedGames: boolean;
  
  // Sport filters for each section
  todayGamesFilter: SportFilter;
  valueAlertsFilter: SportFilter;
  fadeAlertsFilter: SportFilter;
  tailedGamesFilter: SportFilter;
  
  // Scroll position
  scrollPosition: number;
  
  // Timestamp for cache validation
  timestamp: number;
}

const CACHE_KEY = 'wagerproof_today_in_sports_ui_state';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Lightweight UI state cache for Today in Sports page
 * Note: Data is already cached by React Query, so we only cache UI state
 */
export function useTodayInSportsCache() {
  const scrollPositionRef = useRef<number>(0);
  const lastScrollSaveRef = useRef<number>(0);

  /**
   * Get cached UI state if it exists and is not expired
   */
  const getCachedUIState = useCallback((): Omit<TodayInSportsUIState, 'timestamp'> | null => {
    try {
      const cached = sessionStorage.getItem(CACHE_KEY);
      if (!cached) return null;

      const data: TodayInSportsUIState = JSON.parse(cached);
      const now = Date.now();
      const age = now - data.timestamp;

      // Check if cache is expired
      if (age > CACHE_TTL) {
        sessionStorage.removeItem(CACHE_KEY);
        return null;
      }

      scrollPositionRef.current = data.scrollPosition || 0;
      return data;
    } catch (error) {
      return null;
    }
  }, []);

  /**
   * Save UI state to cache
   */
  const setCachedUIState = useCallback((state: Omit<TodayInSportsUIState, 'timestamp' | 'scrollPosition'>) => {
    try {
      const cacheData: TodayInSportsUIState = {
        ...state,
        scrollPosition: scrollPositionRef.current,
        timestamp: Date.now(),
      };
      sessionStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
    } catch (error) {
      // Silently fail - cache is not critical
    }
  }, []);

  /**
   * Clear cache
   */
  const clearCache = useCallback(() => {
    try {
      sessionStorage.removeItem(CACHE_KEY);
      scrollPositionRef.current = 0;
    } catch (error) {
      // Silently fail
    }
  }, []);

  /**
   * Save scroll position (optimized)
   */
  const saveScrollPosition = useCallback(() => {
    const currentScroll = window.scrollY || 0;
    const now = Date.now();
    
    // Only update if scroll changed significantly (> 10px) or 2+ seconds passed
    if (Math.abs(scrollPositionRef.current - currentScroll) > 10 || 
        (now - lastScrollSaveRef.current) > 2000) {
      scrollPositionRef.current = currentScroll;
      lastScrollSaveRef.current = now;
      
      // Update scroll position in cache if it exists
      try {
        const cached = sessionStorage.getItem(CACHE_KEY);
        if (cached) {
          const data: TodayInSportsUIState = JSON.parse(cached);
          data.scrollPosition = currentScroll;
          sessionStorage.setItem(CACHE_KEY, JSON.stringify(data));
        }
      } catch (error) {
        // Silently fail
      }
    }
  }, []);

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
      const currentScroll = window.scrollY || 0;
      scrollPositionRef.current = currentScroll;
      try {
        const cached = sessionStorage.getItem(CACHE_KEY);
        if (cached) {
          const data: TodayInSportsUIState = JSON.parse(cached);
          data.scrollPosition = currentScroll;
          sessionStorage.setItem(CACHE_KEY, JSON.stringify(data));
        }
      } catch (error) {
        // Silently fail
      }
    };

    // Save scroll position periodically (debounced)
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
  }, [saveScrollPosition]);

  return {
    getCachedUIState,
    setCachedUIState,
    clearCache,
    restoreScrollPosition,
  };
}

