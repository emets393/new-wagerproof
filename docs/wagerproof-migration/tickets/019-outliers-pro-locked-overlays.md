# Ticket #019 — Outliers Pro locked-overlay placeholders deferred to B08

**Status:** open
**Filed by:** B06 implementer
**Filed:** 2026-05-20
**Closed:** —
**Affects screen / file:** `wagerproof-mobile/app/(drawer)/(tabs)/outliers.tsx:1142–1150, 1960–2169` (`shouldShowLocks`, `LockedOverlay` placeholders) → not yet wired in `wagerproof_ios_native/Wagerproof/Features/Outliers/OutliersDetailView.swift`

## What we couldn't ship in scope

The RN detail view caps non-Pro users at 2 visible alert cards per section + up to 3 `LockedOverlay` placeholder cards (`Math.min(3, Math.max(0, alerts.length - 2))`). Pro users see all alerts. The Swift port currently renders all alerts for every user — the `LockedOverlay` ports with the paywall/RevenueCat pass in B08.

## Why

The `ProAccessStore` (mirroring RN's `useProAccess()`) is part of B08 (Settings + RevenueCat). Without it there's no source-of-truth for whether the user is Pro, so the lock cap can't be honoured without inventing fake Pro state. The Outliers tab is the wrong place to introduce that fiction.

## Impact

Non-Pro users see every Outlier alert today. There's no paywall friction inside the Outliers feature until B08 lands.

## Acceptance criteria

- `ProAccessStore` exists in `WagerproofKit/Sources/WagerproofStores/` and is injected into the environment.
- `OutliersDetailView.valueAlertsList` / `fadeAlertsList` cap the rendered cards at 2 + render N `LockedOverlayView` placeholders (cap = `min(3, max(0, total - 2))`) when `!isPro`.
- The `// FIDELITY-WAIVER #019` comment (added when this code lands) is removed.

## Linked code

- Not yet linked — no waiver comment in source. This ticket prospectively tracks the gap so B08 picks it up.

## Notes

Editor's Picks (B05) is shipping the same lock gap via waiver #015 ("admin and pro flags on picks"). Resolve both with the same `ProAccessStore` so we don't end up with two flag sources.
