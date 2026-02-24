import { supabase } from './supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ============================================================================
// CONSTANTS
// ============================================================================

const LAST_ACTIVITY_KEY = 'agent_last_activity_tracked';
const DEBOUNCE_INTERVAL_MS = 60 * 60 * 1000; // 1 hour in milliseconds

// ============================================================================
// ACTIVITY TRACKING
// ============================================================================

/**
 * Track app open event by updating owner_last_active_at for user's agents.
 * Debounced to once per hour to avoid excessive database writes.
 */
export async function trackAppOpen(userId: string): Promise<void> {
  try {
    // Check if we've already tracked activity recently
    const lastTracked = await AsyncStorage.getItem(LAST_ACTIVITY_KEY);
    const now = Date.now();

    if (lastTracked) {
      const lastTrackedTime = parseInt(lastTracked, 10);
      if (now - lastTrackedTime < DEBOUNCE_INTERVAL_MS) {
        // Skip - activity already tracked within the debounce window
        console.log('Activity tracking skipped - already tracked recently');
        return;
      }
    }

    // Update owner_last_active_at via RPC (bypasses RLS for this specific update)
    const { error } = await supabase.rpc('update_owner_last_active_at', {
      p_user_id: userId,
    });

    if (error) {
      console.error('Error tracking activity:', error);
      // Don't throw - this is non-critical
      return;
    }

    // Store the timestamp of this tracking event
    await AsyncStorage.setItem(LAST_ACTIVITY_KEY, now.toString());
    console.log('Activity tracked for user agents');
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
    const { error } = await supabase.rpc('update_owner_last_active_at', {
      p_user_id: userId,
    });

    if (error) {
      console.error('Error force tracking activity:', error);
      return;
    }

    // Update the last tracked timestamp
    await AsyncStorage.setItem(LAST_ACTIVITY_KEY, Date.now().toString());
    console.log('Activity force tracked for user agents');
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
    console.log('Activity debounce cleared');
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
