import { useEffect, useState, useCallback } from 'react';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';

interface NetworkState {
  isConnected: boolean;
  isInternetReachable: boolean | null;
  isSlowConnection: boolean;
  connectionType: string | null;
}

/**
 * Hook for monitoring network connectivity state.
 *
 * Provides real-time network status including:
 * - Connection state (connected/disconnected)
 * - Internet reachability (can actually reach the internet)
 * - Slow connection detection (for showing appropriate UI feedback)
 * - Connection type (wifi, cellular, etc.)
 */
export function useNetworkState(): NetworkState {
  const [networkState, setNetworkState] = useState<NetworkState>({
    isConnected: true, // Assume connected initially to avoid false negatives
    isInternetReachable: true,
    isSlowConnection: false,
    connectionType: null,
  });

  useEffect(() => {
    // Subscribe to network state updates
    const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      const isConnected = state.isConnected ?? true;
      const isInternetReachable = state.isInternetReachable;

      // Consider it a slow connection if:
      // 1. Connected but internet is not reachable (yet)
      // 2. Internet reachability is still being determined (null)
      const isSlowConnection = isConnected && (
        isInternetReachable === false ||
        isInternetReachable === null
      );

      setNetworkState({
        isConnected,
        isInternetReachable,
        isSlowConnection,
        connectionType: state.type,
      });

      // Log network state changes for debugging
      if (!isConnected) {
        console.log('📶 Network: Disconnected');
      } else if (isInternetReachable === false) {
        console.log('📶 Network: Connected but no internet');
      } else if (isInternetReachable === null) {
        console.log('📶 Network: Checking internet reachability...');
      }
    });

    // Get initial state
    NetInfo.fetch().then((state: NetInfoState) => {
      const isConnected = state.isConnected ?? true;
      const isInternetReachable = state.isInternetReachable;

      setNetworkState({
        isConnected,
        isInternetReachable,
        isSlowConnection: isConnected && (
          isInternetReachable === false ||
          isInternetReachable === null
        ),
        connectionType: state.type,
      });
    });

    return () => {
      unsubscribe();
    };
  }, []);

  return networkState;
}

/**
 * Simplified hook that just returns whether the app should show
 * slow connection feedback to the user.
 */
export function useIsSlowConnection(): boolean {
  const { isSlowConnection } = useNetworkState();
  return isSlowConnection;
}

/**
 * Hook that returns whether the device is currently offline.
 */
export function useIsOffline(): boolean {
  const { isConnected } = useNetworkState();
  return !isConnected;
}
