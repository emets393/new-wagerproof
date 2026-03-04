import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform, Alert, Linking } from 'react-native';
import { supabase } from './supabase';

// =============================================================================
// State
// =============================================================================

let isInitialized = false;

// =============================================================================
// Initialization
// =============================================================================

/**
 * Create Android notification channel and set foreground handler.
 * Call once at app start.
 */
export async function initializeNotifications(): Promise<void> {
  if (isInitialized) {
    console.log('🔔 Already initialized, skipping');
    return;
  }
  isInitialized = true;
  console.log('🔔 Initializing notifications...');
  console.log('🔔 Device.isDevice:', Device.isDevice);
  console.log('🔔 Platform:', Platform.OS);

  // Set foreground notification handler
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });

  // Create Android notification channel
  if (Platform.OS === 'android') {
    try {
      await Notifications.setNotificationChannelAsync('agent-picks', {
        name: 'Agent Pick Alerts',
        importance: Notifications.AndroidImportance.HIGH,
        description: 'Notifications when your AI agents generate new picks',
      });
      console.log('🔔 Android notification channel created');
    } catch (err) {
      console.warn('🔔 Failed to create Android channel:', (err as Error).message);
    }
  }

  console.log('🔔 Notifications initialized');
}

// =============================================================================
// Permission
// =============================================================================

/**
 * Returns current permission status without prompting.
 */
export async function getNotificationPermissionStatus(): Promise<'granted' | 'denied' | 'undetermined'> {
  const { status } = await Notifications.getPermissionsAsync();
  return status;
}

/**
 * Triggers the OS permission dialog.
 */
export async function requestNotificationPermission(): Promise<'granted' | 'denied' | 'undetermined'> {
  const { status } = await Notifications.requestPermissionsAsync();
  return status;
}

// =============================================================================
// Token Management
// =============================================================================

/**
 * Gets the Expo push token. Returns null on simulator or if unavailable.
 */
export async function getExpoPushToken(): Promise<string | null> {
  if (!Device.isDevice) {
    console.log('🔔 Not a physical device, skipping token fetch');
    return null;
  }

  try {
    // Try multiple paths — Constants.expoConfig is null in standalone/TestFlight builds
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      (Constants as any).manifest?.extra?.eas?.projectId ??
      (Constants as any).manifest2?.extra?.expoClient?.extra?.eas?.projectId ??
      'e00a12fb-670d-4d36-87f4-ae8c63d715d5'; // hardcoded fallback from app.json

    console.log('🔔 Using projectId:', projectId);

    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
    console.log('🔔 Got push token:', data?.slice(0, 30));
    return data;
  } catch (err) {
    console.error('🔔 Failed to get push token:', (err as Error).message, err);
    return null;
  }
}

/**
 * Upserts the push token to `user_push_tokens` via Supabase.
 * Also ensures `user_notification_preferences` row exists.
 */
export async function registerPushToken(userId: string): Promise<void> {
  const token = await getExpoPushToken();
  if (!token) return;

  try {
    const { error: tokenError } = await supabase
      .from('user_push_tokens')
      .upsert(
        {
          user_id: userId,
          expo_push_token: token,
          platform: Platform.OS,
          device_name: Device.modelName || 'Unknown',
          is_active: true,
          last_used_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,expo_push_token' }
      );

    if (tokenError) {
      console.warn('🔔 Failed to register push token:', tokenError.message);
      return;
    }

    // Ensure notification preferences row exists (no-op if already present)
    await supabase
      .from('user_notification_preferences')
      .upsert(
        { user_id: userId, auto_pick_ready: true },
        { onConflict: 'user_id', ignoreDuplicates: true }
      );

    console.log('🔔 Push token registered successfully');
  } catch (err) {
    console.warn('🔔 registerPushToken error:', (err as Error).message);
  }
}

/**
 * Deactivates all push tokens for a user (call on sign-out).
 */
export async function deactivatePushTokens(userId: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('user_push_tokens')
      .update({ is_active: false })
      .eq('user_id', userId);

    if (error) {
      console.warn('🔔 Failed to deactivate push tokens:', error.message);
    } else {
      console.log('🔔 Push tokens deactivated');
    }
  } catch (err) {
    console.warn('🔔 deactivatePushTokens error:', (err as Error).message);
  }
}

/**
 * If permission is already granted, silently register/refresh the token.
 * Called on app start after auth.
 */
export async function syncTokenIfPermitted(userId: string): Promise<void> {
  try {
    const status = await getNotificationPermissionStatus();
    if (status === 'granted') {
      await registerPushToken(userId);
    } else {
      console.log('🔔 Permission not granted, skipping token sync');
    }
  } catch (err) {
    console.warn('🔔 syncTokenIfPermitted error:', (err as Error).message);
  }
}

// =============================================================================
// Permission Prompt Helper (for auto-gen flows)
// =============================================================================

/**
 * Shared permission prompt used when auto-generation is toggled ON.
 * Non-blocking — never prevents the auto-gen toggle from proceeding.
 */
export async function ensureAutoPickNotificationPermission(userId: string): Promise<void> {
  console.log('🔔 ensureAutoPickNotificationPermission called, userId:', userId);
  console.log('🔔 Device.isDevice:', Device.isDevice);
  if (!Device.isDevice) {
    console.log('🔔 Not a physical device, returning early');
    return;
  }

  try {
    const status = await getNotificationPermissionStatus();
    console.log('🔔 Current permission status:', status);

    if (status === 'granted') {
      await registerPushToken(userId);
      return;
    }

    if (status === 'undetermined') {
      return new Promise<void>((resolve) => {
        Alert.alert(
          'Get Notified When Picks Drop',
          'Enable notifications so you know the moment your agent generates new picks.',
          [
            {
              text: 'Not Now',
              style: 'cancel',
              onPress: () => resolve(),
            },
            {
              text: 'Enable Notifications',
              onPress: async () => {
                const result = await requestNotificationPermission();
                if (result === 'granted') {
                  await registerPushToken(userId);
                }
                resolve();
              },
            },
          ]
        );
      });
    }

    if (status === 'denied') {
      return new Promise<void>((resolve) => {
        Alert.alert(
          'Notifications Disabled',
          "You won't be notified when your agent's picks are ready. You can enable notifications in Settings.",
          [
            {
              text: 'Dismiss',
              style: 'cancel',
              onPress: () => resolve(),
            },
            {
              text: 'Open Settings',
              onPress: () => {
                Linking.openSettings();
                resolve();
              },
            },
          ]
        );
      });
    }
  } catch (err) {
    console.warn('🔔 ensureAutoPickNotificationPermission error:', (err as Error).message);
  }
}

// =============================================================================
// Deep-Link Routing
// =============================================================================

/**
 * Extracts a navigation route from a notification tap response.
 */
export function getRouteFromNotificationResponse(
  response: Notifications.NotificationResponse
): string | null {
  const data = response.notification.request.content.data;
  if (data?.type === 'auto_pick_ready' && data?.agent_id) {
    return `/(drawer)/(tabs)/agents/${data.agent_id}`;
  }
  return null;
}

/**
 * Cold-start: checks if the app was launched from a notification tap.
 */
export async function getLastNotificationRoute(): Promise<string | null> {
  try {
    const response = await Notifications.getLastNotificationResponseAsync();
    if (response) {
      return getRouteFromNotificationResponse(response);
    }
  } catch (err) {
    console.warn('🔔 getLastNotificationRoute error:', (err as Error).message);
  }
  return null;
}
