# 11. Push Notifications for Agent Auto-Pick Readiness

## Overview

When a user's AI agent auto-generates picks via the V2 queue worker, a push notification is sent to the user's registered devices. The payload carries a `route` for the agents screen. iOS now routes on tap via `AppDelegate` → `DeepLinkRoute(pushRoute:)` → `RootRouter`. Android still only routes foreground taps (Play-services-rendered banners open the app without extras). See [Deep-Link Route](#deep-link-route).

**Architecture**: direct Supabase client writes for token registration (RLS-based, no Edge Function needed). Transport lives in `supabase/functions/shared/pushTransport.ts` and fans out to **three transports** — Expo, APNs, and FCM v1 — chosen per token shape. Callers: `send-agent-pick-ready-notification` (per auto-run) and `process-push-broadcast` (admin blasts).

**Only the V2 worker calls the send function.** The canonical V3 engine (`agents-v3/`, and the `process-agent-generation-job-v3` mirror) does not, so auto-runs that go through V3 currently produce no push. That gap is separate from the transport work below.

### Why three transports

`user_push_tokens.expo_push_token` is a text column whose name predates the native apps. Each client writes what it has:

| Client | Token written | Transport |
|---|---|---|
| `wagerproof-mobile/` (deprecated RN) | `ExponentPushToken[…]` | Expo Push API |
| `wagerproof-ios-native/` | 64-char hex APNs device token | APNs HTTP/2 |
| `wagerproof-android-native/` | FCM registration token | FCM v1 |

Before 2026-07-31 the function posted **every** row to Expo, which rejects bare APNs/FCM tokens — neither native app ever received this notification. See ticket `docs/wagerproof-migration/tickets/051-push-token-format-migration.md`.

## Database Tables

### `user_push_tokens`
- Stores one push token per user/device — Expo, APNs hex, or FCM (see table above)
- Upsert-friendly via `UNIQUE (user_id, expo_push_token)`
- Soft-disable via `is_active = false` when a provider reports the token dead
  (Expo `DeviceNotRegistered`/`InvalidCredentials`, APNs **410 only**, FCM 404/`UNREGISTERED`)
- Deliberately NOT deactivated: APNs `400 BadDeviceToken` (usually a wrong `APNS_ENV`) and
  FCM `INVALID_ARGUMENT` (usually a payload bug) — either would unsubscribe healthy devices
  en masse on a config mistake
- `last_used_at` updated on every app-start sync
- RLS: owner read/write

### `user_notification_preferences`
- Single row per user (lazy-created on first token registration)
- `auto_pick_ready` defaults to `true` — opt-out model for agent pick alerts
- `broadcast` defaults to `true` — separate opt-out for admin announcements
- Send paths treat "no row" as opted in (`COALESCE(..., true)`)
- RLS: owner read/write

### `sent_push_notifications`
- Audit log and dedupe guard
- `UNIQUE (run_id, user_id, notification_type)` prevents duplicate sends
- Status: `sent`, `partially_sent`, `failed`, `skipped`
- `skip_reason` records why a notification was not sent
- RLS: admin read only

## Edge Function: `send-agent-pick-ready-notification`

**Auth**: `verify_jwt = false`, requires `Bearer <SUPABASE_SERVICE_ROLE_KEY>`.

**Input**: `{ "run_id": "<uuid>" }`

**Flow**:
1. Validate run: assert `status = 'succeeded'`, `generation_type = 'auto'`, `picks_generated > 0`
2. Check preference: `user_notification_preferences.auto_pick_ready` (default true)
3. Load active tokens from `user_push_tokens` (`id, expo_push_token, platform`)
4. Fetch agent name and emoji from `avatar_profiles`
5. Bucket tokens by `classifyToken()` — `ExponentPushToken[…]` → Expo, 64-hex (non-android) → APNs, else FCM
6. Send all three buckets in parallel; each returns per-token outcomes instead of throwing, so one
   misconfigured provider cannot block the others
7. Soft-disable the tokens the providers reported dead
8. Record audit in `sent_push_notifications` (`expo_response` now holds `{ outcomes: [...] }` for every transport)

**Required secrets** — a transport whose secrets are missing fails only its own tokens, logs
`apns_not_configured` / `fcm_not_configured`, and never deactivates them:

| Transport | Secrets |
|---|---|
| Expo | none |
| APNs | `APNS_KEY_ID`, `APNS_TEAM_ID`, `APNS_PRIVATE_KEY` (.p8 PEM), `APNS_BUNDLE_ID`, `APNS_ENV` (`production` default / `sandbox`) |
| FCM v1 | `FCM_SERVICE_ACCOUNT_JSON` (Firebase service-account JSON verbatim; project id read from it) |

Both JWTs (APNs ES256, Google RS256) are signed in-function with WebCrypto — no third-party dep.

**Error handling**: All errors are recorded, never thrown. Notification failures don't affect generation runs.

## Worker Integration

**File**: `supabase/functions/process-agent-generation-job-v2/index.ts`

After `mark_generation_run_succeeded_v2` RPC, the worker calls the send function for auto-gen runs with picks. The call is `await`ed (Deno kills unawaited fetches) but wrapped in `try/catch` to ensure non-fatal behavior.

## Mobile Service: `notificationService.ts`

**File**: `wagerproof-mobile/services/notificationService.ts`

| Export | Purpose |
|--------|---------|
| `initializeNotifications()` | Create Android channel, set foreground handler |
| `getNotificationPermissionStatus()` | Returns status without prompting |
| `requestNotificationPermission()` | Triggers OS permission dialog |
| `getExpoPushToken()` | Gets token (guards on `Device.isDevice`) |
| `registerPushToken(userId)` | Upserts token to DB via Supabase client |
| `deactivatePushTokens(userId)` | Sets `is_active = false` for all user tokens |
| `syncTokenIfPermitted(userId)` | Silent register/refresh if permission granted |
| `ensureAutoPickNotificationPermission(userId)` | Shared permission prompt for auto-gen flows |
| `getRouteFromNotificationResponse(response)` | Extract deep-link route from notification tap |
| `getLastNotificationRoute()` | Cold-start notification tap check |

## Notification Data Contract

All three payloads carry the same `data`: `type: auto_pick_ready`, `agent_id`, `run_id`, and
`route: "agents"` (Android's `DeepLinkRoute` falls back to the feed for unknown values, so the
route is always sent explicitly).

### Expo Push Payload (RN app)
```json
{
  "to": "ExponentPushToken[...]",
  "sound": "default",
  "title": "{emoji} {name}'s picks are ready!",
  "body": "{count} new pick(s) just dropped. Tap to view.",
  "channelId": "agent-picks",
  "data": { "type": "auto_pick_ready", "agent_id": "…", "run_id": "…", "route": "agents" }
}
```

### APNs Payload (native iOS)
`POST https://api.push.apple.com/3/device/{hex-token}` with `apns-topic` = bundle id,
`apns-push-type: alert`, `apns-priority: 10`, `apns-collapse-id` = run id.
```json
{
  "aps": { "alert": { "title": "…", "body": "…" }, "sound": "default", "thread-id": "agent-generation-{agent_id}" },
  "type": "auto_pick_ready", "agent_id": "…", "run_id": "…", "route": "agents"
}
```

### FCM v1 Payload (native Android)
`POST https://fcm.googleapis.com/v1/projects/{project}/messages:send`. Sent as
`notification` **plus** `data`, not data-only: Play services renders it while the app is
backgrounded and `WagerproofMessagingService.onMessageReceived` renders it in the foreground,
so exactly one banner appears either way.
```json
{
  "message": {
    "token": "…",
    "notification": { "title": "…", "body": "…" },
    "android": {
      "priority": "HIGH",
      "collapse_key": "agent-picks-{agent_id}",
      "notification": { "channel_id": "wagerproof_updates", "sound": "default" }
    },
    "data": { "type": "auto_pick_ready", "agent_id": "…", "run_id": "…", "route": "agents" }
  }
}
```

**Channel id is load-bearing.** Android 8+ silently drops a push naming a channel the app never
created. The native app only ever creates `wagerproof_updates` (at process launch in
`WagerproofApplication.onCreate`, also the manifest's `default_notification_channel_id`) and
`agent_generation` (lazily, for LOCAL manual-run banners only) — so remote pushes must use
`wagerproof_updates`. The three declarations are pinned together by
`core/services/.../NotificationChannelContractTest.kt`, with the constant living in
`NotificationService.REMOTE_CHANNEL_ID`. The RN app's `agent-picks` channel is Expo-only.

### Deep-Link Route
- RN: `/(drawer)/(tabs)/agents/{agent_id}`
- Native apps: `wagerproof://agents` (no per-agent deep link yet).
- **iOS**: `AppDelegate.userNotificationCenter(_:didReceive:)` reads `userInfo["route"]`, maps it through `DeepLinkRoute.init?(pushRoute:)` (`feed` | `agents` | `outliers` only — never `reset-password`), and delivers `wagerproof://<route>` to `RootRouter` via a pending-URL box on `AppDelegate`. Cold-start taps are buffered until `WagerproofApp` attaches the handler. Do **not** `UIApplication.open` the URL — Meta / GoogleSignIn claim `.onOpenURL` first.
- **Android**: a tap on a Play-services-rendered banner opens the app without the deep link; foreground taps route.

## Permission Prompt Entry Points

1. **Agent Settings** (`settings.tsx`): When auto-generate toggled ON
2. **Agent Creation Review** (`Screen6_Review.tsx`): When auto-generate toggled ON
3. **App Start** (`_layout.tsx`): Silent token sync if permission already granted

The permission prompt is always non-blocking — auto-gen toggle proceeds regardless.

## App Integration Points

### iOS native — `AppDelegate` + `NotificationService`
- `Wagerproof/App/AppDelegate.swift` is the `UIApplicationDelegate` / `UNUserNotificationCenterDelegate`. `WagerproofApp` installs it with `@UIApplicationDelegateAdaptor`. `didFinishLaunching` must not touch stores (the adaptor is created before `WagerproofApp.init()`).
- `didRegisterForRemoteNotificationsWithDeviceToken` hex-encodes the token, caches it on `NotificationService`, and upserts if a session exists. `didFailToRegister` is expected on Simulator; Secret Settings surfaces the error.
- Token upsert writes `apns_env` (`sandbox` in DEBUG, `production` in Release) so `pushTransport.ts` hits the matching APNs host per token.
- Entitlements are split: Debug `Wagerproof.Debug.entitlements` (`aps-environment=development`), Release `Wagerproof.entitlements` (`production`). TestFlight archives Release.
- Re-register on `.authenticated` and every foreground `.active`. `AuthStore.signOut()` deactivates tokens before `auth.signOut()`.
- Permission prompt is still Settings-toggle / Secret Settings only — no onboarding prompt in this pass.

### `_layout.tsx` — `NotificationHandler` component (deprecated RN)
- Initializes notifications on mount
- Silent token sync on user auth
- Push token rotation listener
- Notification tap listener (warm start)
- Cold-start notification tap via `getLastNotificationResponseAsync()`

### `AuthContext.tsx` — Sign-out
- `deactivatePushTokens()` called before `supabase.auth.signOut()`

## Edge Cases

| Case | Behavior |
|------|----------|
| Permission denied | Auto-gen proceeds, Alert with "Open Settings" CTA |
| Simulator/emulator | All notification code no-ops |
| App killed + notification tap | `getLastNotificationResponseAsync()` on cold start |
| Token rotates | `addPushTokenListener` re-registers |
| User signs out/in | Tokens deactivated on sign-out, fresh registration on sign-in |
| 0 picks generated | No notification (guard in worker AND send function) |
| Duplicate send | Blocked by unique constraint |
| Provider unreachable | That provider's tokens recorded as failed; other providers still deliver; run unaffected |
| Provider secrets missing | Tokens fail with `apns_not_configured` / `fcm_not_configured`; never deactivated |
| Invalid token | Soft-disabled (`is_active = false`) — see the per-provider rules above |
| Manual generation | No notification |
| Multiple devices | All active tokens receive notification, across mixed platforms |
| Run generated by V3 | **No notification at all** — V3 never calls this function |

## Admin Broadcasts

Admins compose and send (or schedule) a notification to all registered devices from `/admin/push-notifications`.

### Tables
- `push_broadcasts` — campaign (title/body, deep link `feed|agents|outliers`, platform + subscription filters, status)
- `push_broadcast_recipients` — one row per user; leased work queue (`FOR UPDATE SKIP LOCKED`)
- Do **not** reuse `sent_push_notifications` (its `run_id` is NOT NULL and unique-on-NULL would not dedupe)

### RPCs
`count_push_broadcast_audience`, `send_push_broadcast_now`, `schedule_push_broadcast`, `cancel_push_broadcast`, `claim_push_broadcast_recipients`, `tick_push_broadcasts`, `finalize_push_broadcasts`. `send_now` is a single conditional `UPDATE ... WHERE status IN ('draft','scheduled')`; a second click raises `55000` (HTTP 409).

### Edge functions
- `admin-push-broadcast` (`verify_jwt = true` + `has_role`) — `test_send` / `send_now` / `schedule` / `cancel`
- `process-push-broadcast` (`verify_jwt = false`, dual auth) — claims batches of ≤500, 50s budget, self-reinvokes; cron is the safety net

Payload `data.type` is `admin_broadcast` (or `admin_broadcast_test` for test sends). Collapse id is the campaign uuid.

### Kill a blast in flight
```sql
SELECT public.cancel_push_broadcast('<broadcast-uuid>');
```

## Deployment

Secrets are set on project `gnjrklxotmbvnxbnnqgq`. APNs key id `68QT5AQCJX`, team `88DXY6L653`, bundle `com.wagerproof.mobile`, `APNS_ENV=production`. FCM uses `FCM_SERVICE_ACCOUNT_JSON` from Firebase project `wagerproof-aa5a1`.

1. Apply migration: `supabase db push` (`20260815120000_push_broadcasts.sql`)
2. Deploy: `supabase functions deploy send-agent-pick-ready-notification process-push-broadcast admin-push-broadcast`
3. Android local: `wagerproof-android-native/app/google-services.json` (gitignored). CI: `GOOGLE_SERVICES_JSON_BASE64`
4. iOS: Debug builds register sandbox tokens; TestFlight/App Store register production. Secret Settings → Push Diagnostics should show a 64-char hex APNs token on a physical device (Simulator always shows `<none>`).
5. First real blast should be staged (`platform=ios` + `subscription=pro`)

RN-only legacy steps (`npx expo install expo-notifications`, an EAS dev build, `eas credentials`)
apply to `wagerproof-mobile/` only and are irrelevant to the native apps — iOS carries its own
APNs entitlement and Android its own `google-services.json`.
