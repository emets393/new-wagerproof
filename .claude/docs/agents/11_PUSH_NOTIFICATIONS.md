# 11. Push Notifications for Agent Auto-Pick Readiness

## Overview

When a user's AI agent auto-generates picks via the V2 queue worker, a push notification is sent to the user's registered devices. Tapping the notification deep-links to the relevant agent detail screen.

**Architecture**: Expo Push API (not Firebase-first), direct Supabase client writes for token registration (RLS-based, no Edge Function needed), single Edge Function for the send path called from the V2 worker.

## Database Tables

### `user_push_tokens`
- Stores Expo push tokens per user/device
- Upsert-friendly via `UNIQUE (user_id, expo_push_token)`
- Soft-disable via `is_active = false` when Expo reports invalid tokens
- `last_used_at` updated on every app-start sync
- RLS: owner read/write

### `user_notification_preferences`
- Single row per user (lazy-created on first token registration)
- `auto_pick_ready` defaults to `true` — opt-out model
- Send function treats "no row" as `true`
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
3. Load active tokens from `user_push_tokens`
4. Fetch agent name and emoji from `avatar_profiles`
5. POST to Expo Push API (`https://exp.host/--/api/v2/push/send`)
6. Process tickets: soft-disable tokens with `DeviceNotRegistered` or `InvalidCredentials`
7. Record audit in `sent_push_notifications`

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

### Expo Push Payload
```json
{
  "to": "ExponentPushToken[...]",
  "sound": "default",
  "title": "{emoji} {name}'s picks are ready!",
  "body": "{count} new pick(s) just dropped. Tap to view.",
  "channelId": "agent-picks",
  "data": {
    "type": "auto_pick_ready",
    "agent_id": "<avatar_id>",
    "run_id": "<run_id>"
  }
}
```

### Deep-Link Route
```
/(drawer)/(tabs)/agents/{agent_id}
```

## Permission Prompt Entry Points

1. **Agent Settings** (`settings.tsx`): When auto-generate toggled ON
2. **Agent Creation Review** (`Screen6_Review.tsx`): When auto-generate toggled ON
3. **App Start** (`_layout.tsx`): Silent token sync if permission already granted

The permission prompt is always non-blocking — auto-gen toggle proceeds regardless.

## App Integration Points

### `_layout.tsx` — `NotificationHandler` component
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
| Expo API unreachable | Recorded as `failed`, run unaffected |
| Invalid token | Soft-disabled (`is_active = false`) |
| Manual generation | No notification |
| Multiple devices | All active tokens receive notification |

## Deployment

1. Apply migration: `supabase db push`
2. Deploy send function: `supabase functions deploy send-agent-pick-ready-notification`
3. Deploy updated worker: `supabase functions deploy process-agent-generation-job-v2`
4. Install dep: `npx expo install expo-notifications`
5. New EAS dev build (native module)
6. Ensure APNs key configured via `eas credentials`
