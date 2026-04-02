import { useEffect, useState, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNetworkState } from './useNetworkState';

interface AppReadyState {
  isReady: boolean;
  isSlowLoad: boolean;
}

const SLOW_LOAD_THRESHOLD_MS = 3000;
const MAX_WAIT_TIME_MS = 8000;

/**
 * Determines when the app is ready to show content.
 *
 * Only gates on auth session restore (a local AsyncStorage read, ~5-50ms).
 * RevenueCat and other network-dependent services load in the background
 * and do NOT block the splash screen.
 */
export function useAppReady(): AppReadyState {
  const { loading: authLoading } = useAuth();
  const { isSlowConnection } = useNetworkState();

  const [isSlowLoad, setIsSlowLoad] = useState(false);
  const [forcedReady, setForcedReady] = useState(false);
  const startTimeRef = useRef(Date.now());

  // Auth is a local read — this is the only thing we wait for
  const naturallyReady = !authLoading;
  const isReady = naturallyReady || forcedReady;

  // Slow load detection
  useEffect(() => {
    if (isReady) return;

    const slowLoadTimer = setTimeout(() => {
      console.log('⏱️ App: Slow load detected (>3s)');
      setIsSlowLoad(true);
    }, SLOW_LOAD_THRESHOLD_MS);

    return () => clearTimeout(slowLoadTimer);
  }, [isReady]);

  // Force ready after max wait (prevents infinite loading)
  useEffect(() => {
    if (isReady) return;

    const forceReadyTimer = setTimeout(() => {
      const elapsed = Date.now() - startTimeRef.current;
      console.warn(`⚠️ App: Forcing ready after ${elapsed}ms`);
      setForcedReady(true);
    }, MAX_WAIT_TIME_MS);

    return () => clearTimeout(forceReadyTimer);
  }, [isReady]);

  useEffect(() => {
    if (naturallyReady && !forcedReady) {
      const elapsed = Date.now() - startTimeRef.current;
      console.log(`✅ App: Ready in ${elapsed}ms`);
    }
  }, [naturallyReady, forcedReady]);

  useEffect(() => {
    if (isSlowConnection && !isReady && !isSlowLoad) {
      setIsSlowLoad(true);
    }
  }, [isSlowConnection, isReady, isSlowLoad]);

  return { isReady, isSlowLoad };
}
