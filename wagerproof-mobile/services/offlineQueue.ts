/**
 * Offline Queue Service
 *
 * Persists failed writes to AsyncStorage and retries them when network recovers.
 * Used for critical operations like onboarding completion saves that must
 * eventually succeed even when the network is unreliable.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { supabase } from './supabase';

const QUEUE_KEY = '@wagerproof/offline-queue';

export interface QueuedWrite {
  id: string;
  type: 'onboarding_completion';
  payload: Record<string, any>;
  userId: string;
  createdAt: number;
  retryCount: number;
}

/** Read the current queue from AsyncStorage. */
async function getQueue(): Promise<QueuedWrite[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/** Write the queue back to AsyncStorage. */
async function saveQueue(queue: QueuedWrite[]): Promise<void> {
  try {
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch (e) {
    console.warn('offlineQueue: Failed to persist queue:', e);
  }
}

/** Enqueue a failed write for later retry. Deduplicates by type + userId. */
export async function enqueueWrite(write: Omit<QueuedWrite, 'id' | 'createdAt' | 'retryCount'>): Promise<void> {
  const queue = await getQueue();

  // Deduplicate: replace existing entry of same type + userId
  const filtered = queue.filter(
    (q) => !(q.type === write.type && q.userId === write.userId)
  );

  filtered.push({
    ...write,
    id: `${write.type}_${write.userId}_${Date.now()}`,
    createdAt: Date.now(),
    retryCount: 0,
  });

  await saveQueue(filtered);
  console.log(`offlineQueue: Enqueued ${write.type} for user ${write.userId}`);
}

/** Process a single queued write. Returns true if successful. */
async function processWrite(write: QueuedWrite): Promise<boolean> {
  try {
    if (write.type === 'onboarding_completion') {
      const { error } = await supabase
        .from('profiles')
        .update({
          onboarding_data: write.payload.onboardingData,
          onboarding_completed: true,
        })
        .eq('user_id', write.userId);

      if (error) {
        console.warn(`offlineQueue: Failed to process ${write.type}:`, error.message);
        return false;
      }
      console.log(`offlineQueue: Successfully processed ${write.type} for ${write.userId}`);
      return true;
    }

    return false;
  } catch (e) {
    console.warn(`offlineQueue: Error processing ${write.type}:`, e);
    return false;
  }
}

/** Flush the queue — attempt all pending writes. Removes successful ones. */
export async function flushQueue(): Promise<void> {
  const queue = await getQueue();
  if (queue.length === 0) return;

  console.log(`offlineQueue: Flushing ${queue.length} queued write(s)...`);
  const remaining: QueuedWrite[] = [];

  for (const write of queue) {
    const success = await processWrite(write);
    if (!success) {
      // Keep in queue if under 10 retries and less than 7 days old
      if (write.retryCount < 10 && Date.now() - write.createdAt < 7 * 24 * 60 * 60 * 1000) {
        remaining.push({ ...write, retryCount: write.retryCount + 1 });
      } else {
        console.warn(`offlineQueue: Dropping expired/maxed write ${write.id}`);
      }
    }
  }

  await saveQueue(remaining);
}

/** Check if there's a pending onboarding completion for a user. */
export async function hasPendingOnboardingCompletion(userId: string): Promise<boolean> {
  const queue = await getQueue();
  return queue.some((q) => q.type === 'onboarding_completion' && q.userId === userId);
}

/**
 * Start listening for network recovery and flush the queue when connectivity returns.
 * Call once at app startup.
 */
let _listenerRegistered = false;
export function startOfflineQueueListener(): void {
  if (_listenerRegistered) return;
  _listenerRegistered = true;

  NetInfo.addEventListener((state) => {
    if (state.isConnected && state.isInternetReachable) {
      // Small delay to let the network stabilize
      setTimeout(() => {
        flushQueue().catch((e) =>
          console.warn('offlineQueue: Flush on reconnect failed:', e)
        );
      }, 2000);
    }
  });
}
