import { useEffect, useState, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useRevenueCat } from '../contexts/RevenueCatContext';
import { useNetworkState } from './useNetworkState';

interface AppReadyState {
  isReady: boolean;
  isSlowLoad: boolean;
  loadingStage: 'auth' | 'revenuecat' | 'ready';
}

// Timeout before we consider it a "slow load" (show feedback to user)
const SLOW_LOAD_THRESHOLD_MS = 3000;

// Maximum time to wait before forcing app to be ready
const MAX_WAIT_TIME_MS = 10000;

/**
 * Unified hook for determining when the app is ready to show content.
 *
 * Consolidates multiple loading states (auth, RevenueCat) into a single
 * source of truth, preventing cascading re-renders and screen flashing.
 *
 * Features:
 * - Tracks auth and RevenueCat loading in parallel
 * - Detects slow loads and provides feedback state
 * - Forces ready after MAX_WAIT_TIME to prevent infinite loading
 * - Considers network state for better UX on slow connections
 */
export function useAppReady(): AppReadyState {
  const { loading: authLoading } = useAuth();
  const { isLoading: rcLoading } = useRevenueCat();
  const { isSlowConnection } = useNetworkState();

  const [isSlowLoad, setIsSlowLoad] = useState(false);
  const [forcedReady, setForcedReady] = useState(false);
  const startTimeRef = useRef(Date.now());

  // Determine current loading stage for debugging/logging
  const loadingStage = authLoading
    ? 'auth'
    : rcLoading
    ? 'revenuecat'
    : 'ready';

  // Natural readiness (all providers done loading)
  const naturallyReady = !authLoading && !rcLoading;

  // App is ready if naturally ready OR forced ready
  const isReady = naturallyReady || forcedReady;

  // Slow load detection
  useEffect(() => {
    if (isReady) {
      // Already ready, no need for slow load detection
      return;
    }

    const slowLoadTimer = setTimeout(() => {
      if (!isReady) {
        console.log('⏱️ App: Slow load detected (>3s)');
        setIsSlowLoad(true);
      }
    }, SLOW_LOAD_THRESHOLD_MS);

    return () => clearTimeout(slowLoadTimer);
  }, [isReady]);

  // Force ready after max wait time (prevents infinite loading)
  useEffect(() => {
    if (isReady) {
      // Already ready, no timeout needed
      return;
    }

    const forceReadyTimer = setTimeout(() => {
      if (!naturallyReady) {
        const elapsed = Date.now() - startTimeRef.current;
        console.warn(`⚠️ App: Forcing ready after ${elapsed}ms (max wait reached)`);
        console.warn(`⚠️ App: Auth loading: ${authLoading}, RC loading: ${rcLoading}`);
        setForcedReady(true);
      }
    }, MAX_WAIT_TIME_MS);

    return () => clearTimeout(forceReadyTimer);
  }, [naturallyReady, authLoading, rcLoading, isReady]);

  // Log state changes for debugging
  useEffect(() => {
    if (naturallyReady && !forcedReady) {
      const elapsed = Date.now() - startTimeRef.current;
      console.log(`✅ App: Ready naturally in ${elapsed}ms`);
    }
  }, [naturallyReady, forcedReady]);

  // If on slow connection, lower our expectations and show slow load UI earlier
  useEffect(() => {
    if (isSlowConnection && !isReady && !isSlowLoad) {
      // On slow connections, show slow load feedback immediately
      console.log('📶 App: Slow connection detected, showing slow load UI');
      setIsSlowLoad(true);
    }
  }, [isSlowConnection, isReady, isSlowLoad]);

  return {
    isReady,
    isSlowLoad,
    loadingStage,
  };
}
