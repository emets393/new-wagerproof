# Ticket #015 — Admin / Pro flags on PicksView are local @State

**Status:** open
**Filed by:** b05-implementer
**Filed:** 2026-05-20
**Affects screen / file:** `wagerproof-mobile/app/(drawer)/(tabs)/picks.tsx` → `wagerproof_ios_native/Wagerproof/Features/Picks/PicksView.swift`

## What we couldn't ship in scope

RN's picks tab consumes `useAdminMode()` and `useProAccess()` from app-wide contexts. The Swift port currently keeps `adminModeEnabled` and `isPro` as `@State` on `PicksView` — they're false in production and only flipped via the screenshot harness.

## Why

The `AdminModeStore` and `ProAccessStore` (RevenueCat-backed) haven't been ported yet. `AdminModeStore` is part of B14 (Dev Tools); `ProAccessStore` is part of B08 (Settings + RevenueCat paywall). Wiring them now would jump the batch order.

## Impact

- Editors can't see admin controls on iOS until B14 ships and the picks tab subscribes to the store.
- Non-pro users see free picks unlocked (RN locks them via `useProAccess`). Production-blocking only for the picks-tab paywall — every other paywall in the app gates separately at the RevenueCat level.

## Acceptance criteria

- `AdminModeStore` exists in `WagerproofStores`; mirrors RN `useAdminMode`
- `ProAccessStore` exists in `WagerproofStores`; mirrors RN `useProAccess` (delegates to `Purchases.shared.customerInfo`)
- `PicksView` reads `@Environment(AdminModeStore.self)` + `@Environment(ProAccessStore.self)` instead of local state
- The locked pick wrapper triggers a real paywall presentation when tapped

## Linked code

- `// FIDELITY-WAIVER #015: admin / pro flags ship as plain @State seeded from AuthStore/ProAccessStore when those stores wire up in B08.` in `Wagerproof/Features/Picks/PicksView.swift`

## Notes

The harness simulates an admin or pro session via init args — that path stays usable after the stores port.
