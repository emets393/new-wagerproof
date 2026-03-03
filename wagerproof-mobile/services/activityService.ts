import { supabase } from './supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ============================================================================
// CONSTANTS
// ============================================================================

const LAST_ACTIVITY_KEY = 'agent_last_activity_tracked';
const DEBOUNCE_INTERVAL_MS = 12 * 60 * 60 * 1000; // 12 hours (matches server throttle)

// ============================================================================
// ACTIVITY TRACKING (V2 — uses canonical profiles.last_seen_at)
// ============================================================================

/**
 * Track app open event by updating canonical profiles.last_seen_at.
 * Server-side throttled to once per 12 hours; client debounce matches.
 * Falls back to V1 RPC if V2 is not yet deployed.
 */
export async function trackAppOpen(userId: string): Promise<void> {
  try {
    // Check if we've already tracked activity recently
    const lastTracked = await AsyncStorage.getItem(LAST_ACTIVITY_KEY);
    const now = Date.now();

    if (lastTracked) {
      const lastTrackedTime = parseInt(lastTracked, 10);
      if (now - lastTrackedTime < DEBOUNCE_INTERVAL_MS) {
        return;
      }
    }

    // Try V2 canonical touch first
    const { error } = await supabase.rpc('touch_owner_activity_if_stale', {
      p_user_id: userId,
    });

    if (error) {
      // Fall back to V1 RPC if V2 function doesn't exist yet
      if (error.message?.includes('function') || error.code === '42883' || error.code === 'PGRST202') {
        const { error: v1Error } = await supabase.rpc('update_owner_last_active_at', {
          p_user_id: userId,
        });
        if (v1Error) {
          console.error('Error tracking activity (V1 fallback):', v1Error);
          return;
        }
      } else {
        console.error('Error tracking activity:', error);
        return;
      }
    }

    // Store the timestamp of this tracking event
    await AsyncStorage.setItem(LAST_ACTIVITY_KEY, now.toString());
  } catch (error) {
    console.error('Error in trackAppOpen:', error);
    // Don't throw - this is non-critical functionality
  }
}

/**
 * Force track activity regardless of debounce.
 * Use sparingly - only for specific user actions like manually generating picks.
 */
export async function forceTrackActivity(userId: string): Promise<void> {
  try {
    // Try V2 first, with immediate interval to bypass server throttle
    const { error } = await supabase.rpc('touch_owner_activity_if_stale', {
      p_user_id: userId,
      p_min_interval: '0 seconds',
    });

    if (error) {
      // Fall back to V1
      if (error.message?.includes('function') || error.code === '42883' || error.code === 'PGRST202') {
        const { error: v1Error } = await supabase.rpc('update_owner_last_active_at', {
          p_user_id: userId,
        });
        if (v1Error) {
          console.error('Error force tracking activity (V1 fallback):', v1Error);
          return;
        }
      } else {
        console.error('Error force tracking activity:', error);
        return;
      }
    }

    // Update the last tracked timestamp
    await AsyncStorage.setItem(LAST_ACTIVITY_KEY, Date.now().toString());
  } catch (error) {
    console.error('Error in forceTrackActivity:', error);
  }
}

/**
 * Clear the activity tracking debounce (useful for testing)
 */
export async function clearActivityDebounce(): Promise<void> {
  try {
    await AsyncStorage.removeItem(LAST_ACTIVITY_KEY);
  } catch (error) {
    console.error('Error clearing activity debounce:', error);
  }
}

/**
 * Get the last activity tracking timestamp
 */
export async function getLastActivityTimestamp(): Promise<number | null> {
  try {
    const lastTracked = await AsyncStorage.getItem(LAST_ACTIVITY_KEY);
    return lastTracked ? parseInt(lastTracked, 10) : null;
  } catch (error) {
    console.error('Error getting last activity timestamp:', error);
    return null;
  }
}
