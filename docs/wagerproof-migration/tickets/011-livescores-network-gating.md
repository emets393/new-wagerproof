# Ticket #011 — Live scores polling — defer network-state gating to B22 hardening

**Status:** open
**Filed by:** B07 implementer
**Filed:** 2026-05-20
**Closed:** —
**Affects screen / file:** `wagerproof-mobile/hooks/useLiveScores.ts:10–11,27–36` → `wagerproof_ios_native/WagerproofKit/Sources/WagerproofStores/LiveScoresStore.swift:54` (polling loop body)

## What we couldn't ship in scope

The RN `useLiveScores` hook gates its 2-minute polling on `useNetworkState().isConnected && isInternetReachable !== false` — if the device is offline, no fetch fires. The Swift `LiveScoresStore.start()` polling loop fires `await refresh()` unconditionally every 120s regardless of connectivity.

## Why

URLSession retries are cheap — a request fired against a missing network fails fast at the system level, and the failure flows into `loadState = .failed` where the existing error banner covers the UX. Adding `NWPathMonitor` (or a `NetworkStateStore`) just for the scoreboard isn't worth the complexity in Phase 2; B22 is the hardening batch and is the right time to add network-state awareness as a global concern alongside the rest of the offline-handling pass.

## Impact

A device with no connectivity will fire useless requests every 120s while the scoreboard tab is mounted. URLSession fails quickly (no socket, no DNS) so no battery hot-loop, and the error banner already informs the user. The only cost is a tiny amount of wasted CPU + log noise.

## Acceptance criteria

- A `NetworkStateStore` exists (or `NWPathMonitor` is integrated directly) and `LiveScoresStore.start()`'s polling Task gates `await fetchGames()` on the current connectivity state. The behavior should mirror RN's `if (!isOnline) return;` short-circuit inside the interval body.
- The `// FIDELITY-WAIVER #011` comment in `LiveScoresStore.swift` is removed.

## Linked code

- `// FIDELITY-WAIVER #011: Polling fires unconditionally; network-state gating (mirrors RN's useNetworkState check) lands in B22 hardening.` in `wagerproof_ios_native/WagerproofKit/Sources/WagerproofStores/LiveScoresStore.swift` (start of polling-loop body)

## Notes

Scope this with the wider B22 offline-handling pass so the network-state store is shared across all polling stores, not just `LiveScoresStore`.
