# Ticket #051 — Push token format mismatch (APNs vs. Expo)

**Status:** open
**Filed by:** b08-implementer-2026-05-21
**Filed:** 2026-05-21
**Affects screen / file:** `wagerproof-mobile/services/notificationService.ts` → `wagerproof_ios_native/WagerproofKit/Sources/WagerproofServices/NotificationService.swift`

## What we couldn't ship in scope

The RN app stores Expo-format push tokens (`ExponentPushToken[xxxxxxxxxxxx]`) in the `user_push_tokens.expo_push_token` column. The native iOS port has no Expo runtime — it writes the raw APNs hex device token into the same column. Both formats coexist in the table.

## Why

We can't dispatch native APNs through the Expo Push API without an Expo project ID + Expo's push delivery service. The native build owns its own APNs entitlement and certificate chain, so writing the raw APNs token (which is what APNs needs anyway) is the correct format for any native push handler.

## Impact

The `send-auto-pick-ready` edge function (and any other server-side dispatcher) must detect token format before sending:

- Token starts with `ExponentPushToken[` → POST to Expo Push API.
- Otherwise → POST APNs payload via the Apple HTTP/2 push interface (or Supabase's `pg_net` extension with a JWT-signed APNs request).

Until the dispatcher is updated, picks generated on the native iOS app may not deliver notifications.

## Acceptance criteria

- Edge function `send-auto-pick-ready` (and any sibling functions) branches on token shape.
- New `platform_token_type` column added to `user_push_tokens` so the writer side encodes intent rather than the reader having to sniff.
- Smoke test: register a token from the native iOS app, queue an auto-pick-ready job, observe the push arriving on-device.

## Linked code

- `NotificationService.registerPushToken(userId:)` in `NotificationService.swift` — column name preserved for backend compat.

## Notes

A safer interim path: keep using Expo Push by bundling `Expo.Push` SDK (via `expo-modules-core`) inside the native app. This was rejected because we want to remove the Expo dependency surface, not extend it.
