# Ticket #017 — Onboarding offline write queue not ported

**Status:** open
**Filed by:** b02-implementer
**Filed:** 2026-05-20
**Affects screen / file:** `wagerproof-mobile/contexts/OnboardingContext.tsx` (line 46: `enqueueWrite`) → `wagerproof_ios_native/WagerproofKit/Sources/WagerproofStores/OnboardingStore.swift`

## What we couldn't ship in scope

RN's `syncOnboardingToServer` falls back to `enqueueWrite({ type: 'onboarding_completion', ... })`
when the Supabase write fails or times out, persisting the write to local
storage so a future foreground retry can flush it. The Swift port logs +
drops the failure — the local cache (App Group UserDefaults) is the source
of truth for the boolean `isComplete`, but the survey + agent-draft fields
written into `profiles.onboarding_data` are lost on network failure.

## Why

`services/offlineQueue.ts` is a non-trivial sub-system (queue file format,
foreground/background scheduling, retry policy) that isn't ported yet. Doing
it inside B02 would expand scope significantly.

## Impact

A user who completes onboarding with no network connectivity will keep the
local `isComplete` flag (so they don't re-see onboarding), but their survey
answers won't reach Supabase. This matters for:

- Marketing acquisition attribution (`acquisitionSource`)
- Personalization defaults applied to agents (`bettorType`, `mainGoal`, `favoriteSports`)
- The `agentFormState` payload used by the auto-generation cron

If the user has any future write to `profiles` (display-name change, etc.),
this data can be opportunistically written then.

## Acceptance criteria

- Port `services/offlineQueue.ts` to `WagerproofServices/OfflineWriteQueue.swift`.
- On `OnboardingStore.syncToSupabase` failure, enqueue the payload.
- Flush queue on next `MainSupabase` successful round-trip.

## Linked code

- `// FIDELITY-WAIVER #017` in `WagerproofKit/Sources/WagerproofStores/OnboardingStore.swift`

## Notes

This ticket also covers any other RN call sites that use `enqueueWrite`. A
single audit of `services/offlineQueue.ts` consumers would resolve all of
them at once.
