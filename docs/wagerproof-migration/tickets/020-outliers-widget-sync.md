# Ticket #020 — Outliers iOS Widget App-Group sync deferred to B22

**Status:** open
**Filed by:** B06 implementer
**Filed:** 2026-05-20
**Closed:** —
**Affects screen / file:** `wagerproof-mobile/app/(drawer)/(tabs)/outliers.tsx:740–797` (syncToWidget effect) → not yet wired in Swift port

## What we couldn't ship in scope

The RN Outliers screen runs a `useEffect` that, on iOS only, transforms the latest 5 value alerts + 5 fade alerts into widget-friendly shapes and writes them through the `widget-data-bridge` module to the App Group container. The companion iOS Widget extension reads from that container to show fade/value alerts on the lock screen. The Swift port currently doesn't write to the App Group at all.

## Why

The App-Group write requires:
1. Defining a shared App Group entitlement (currently only the main app has its own non-shared entitlement).
2. A Swift port of the `widget-data-bridge` module's `syncWidgetData(...)` and `getWidgetData()`.
3. The iOS widget target itself (a separate `WidgetKit` extension that doesn't exist in the project yet).

All three land together in B22 (Hardening + iOS Widget) so the entitlement, the data bridge, and the consumer ship as one coherent change rather than letting B06 introduce a half-implemented bridge with no consumer.

## Impact

The iOS lock-screen widget continues to show whatever the RN app last wrote (if anything). Users on the Swift-only build (when it ships) won't see Outliers alerts on their widget until B22.

## Acceptance criteria

- A `WidgetDataBridge` actor / module exists in `WagerproofKit/Sources/WagerproofServices/` with the same `editorPicks` / `fadeAlerts` / `polymarketValues` / `topAgentPicks` fields the RN JSON shape uses.
- `OutliersStore.refresh()` (or a dedicated `.onChange` in `OutliersView`) calls `WidgetDataBridge.shared.syncOutliers(values:fades:)` after a successful fetch.
- The new sync preserves existing `editorPicks` + `topAgentPicks` slots (read-modify-write).
- Sync is iOS-only (skip on macOS/Catalyst).
- The `// FIDELITY-WAIVER #020` comment (added when the sync ships) is removed.

## Linked code

- Not yet linked — no waiver comment in source. This ticket prospectively tracks the gap so B22 picks it up.

## Notes

`picks-widget-sync` (#016) tracks the editor-picks half of the same App-Group write. B22 should land both ports together to avoid stomp-then-overwrite issues between the two stores.
