# Notifications & Deep Linking

## Push Notification Setup

Notifications use `expo-notifications`. Initialization happens once at app start via a renderless `NotificationHandler` component mounted in `app/_layout.tsx`.

`initializeNotifications()` does two things:
1. Sets the foreground handler so notifications display as banners with sound while the app is open.
2. On Android, creates a high-importance channel called `agent-picks` ("Agent Pick Alerts").

A module-level `isInitialized` flag prevents duplicate initialization.

## Token Lifecycle

### Registration
`getExpoPushToken()` fetches an Expo push token. It returns `null` on simulators. The EAS `projectId` is resolved from `Constants.expoConfig`, falling back through manifest paths and ultimately to a hardcoded ID (`e00a12fb-670d-4d36-87f4-ae8c63d715d5`).

`registerPushToken(userId)` upserts the token into `user_push_tokens` in Supabase, keyed on `(user_id, expo_push_token)`. It stores platform, device name, `is_active: true`, and timestamps. It also ensures a `user_notification_preferences` row exists with `auto_pick_ready: true` (no-op if already present).

### Sync on App Start
`NotificationHandler` calls `syncTokenIfPermitted(userId)` 15 seconds after the user authenticates. The delay avoids competing with onboarding, RevenueCat, and analytics network calls. If permission is already granted, the token is silently registered/refreshed. If not, no prompt is shown.

### Token Rotation
A `Notifications.addPushTokenListener` subscription in `NotificationHandler` calls `registerPushToken` whenever the token changes mid-session.

### Deactivation
`deactivatePushTokens(userId)` sets `is_active: false` on all tokens for a user. Called on sign-out.

## Deep Link Schemes

### `wagerproof://` (iOS Widget)
Handled in `app/(drawer)/_layout.tsx`. Supports both cold start (`Linking.getInitialURL`) and warm start (`Linking.addEventListener`). Routes:

| Path | Destination |
|------|-------------|
| `picks` | `/(drawer)/(tabs)/picks` |
| `agents` | `/(drawer)/(tabs)/agents` |
| `outliers` | `/(drawer)/(tabs)/outliers` |
| `feed` | `/(drawer)/(tabs)` (default) |

Unknown paths fall through to feed.

### RevenueCat `rc-*://` (Web Purchase Redemption)
Handled by `WebPurchaseRedemptionHandler` in `app/_layout.tsx`. Detects URLs containing `redeem_web_purchase`, parses via `Purchases.parseAsWebPurchaseRedemption`, and calls `Purchases.redeemWebPurchase`. Handles five result types (SUCCESS, ERROR, INVALID_TOKEN, PURCHASE_BELONGS_TO_OTHER_USER, EXPIRED) with user-facing alerts. On success, refreshes RevenueCat customer info to update entitlements. Supports both cold and warm start via `Linking`.

## Notification Tap Routing

### Warm Start (App Running)
`NotificationHandler` registers a `Notifications.addNotificationResponseReceivedListener`. When a notification is tapped, `getRouteFromNotificationResponse` extracts the route from the notification data. Currently the only supported type is `auto_pick_ready` -- it routes to `/(drawer)/(tabs)/agents/{agent_id}`.

### Cold Start (App Killed)
On mount, `NotificationHandler` calls `getLastNotificationRoute()` which checks `Notifications.getLastNotificationResponseAsync()`. If a route is found, it navigates after a 500ms delay to allow the navigator to mount. A ref flag prevents duplicate handling.

Both paths use the same `getRouteFromNotificationResponse` function, which returns `null` for any unrecognized notification type.

## Agent Auto-Generation Notification Permission Flow

When a user toggles auto-generation ON for an agent, `ensureAutoPickNotificationPermission(userId)` is called. It is non-blocking and never prevents the toggle from succeeding.

The function handles three permission states:

1. **Granted** -- silently registers/refreshes the push token.
2. **Undetermined** -- shows an alert ("Get Notified When Picks Drop") with "Not Now" and "Enable Notifications" buttons. If the user taps enable, the OS permission dialog is triggered. On grant, the token is registered.
3. **Denied** -- shows an alert explaining notifications are disabled, with a "Dismiss" button and an "Open Settings" button that launches `Linking.openSettings()`.

On simulators (`Device.isDevice === false`), the function returns immediately.
