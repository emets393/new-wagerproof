# Ticket #016 — Picks widget sync deferred

**Status:** open
**Filed by:** b05-implementer
**Filed:** 2026-05-20
**Affects screen / file:** `wagerproof-mobile/app/(drawer)/(tabs)/picks.tsx` → `wagerproof_ios_native/Wagerproof/Features/Picks/PicksView.swift`

## What we couldn't ship in scope

The RN picks screen has a `useEffect` (Platform.OS === 'ios' only) that maps the first five picks into a widget-friendly format and writes them to the App Group `UserDefaults` via `syncWidgetData(...)`. The Swift port doesn't yet write to the widget.

## Why

The widget data bridge (`modules/widget-data-bridge` in RN) ports as `WagerproofSharedKit/WidgetDataBridge.swift`. Hooking it into picks before the bridge stabilizes would create a circular fix-up cycle. Widget-bridge implementation lands as part of the Widget batch (TBD ordering).

## Impact

The iOS widget shows whatever data the RN app last wrote. Once the Swift app replaces RN in production, the widget will go stale until this is implemented.

## Acceptance criteria

- `WagerproofSharedKit/WidgetDataBridge.swift` exposes `syncWidgetData(...)` with the same App Group key schema as RN
- `EditorPicksStore` calls into the bridge in a `.didSet` on `picks` (or via a separate `.task` in `PicksView`) so the first 5 picks land in the widget every time the feed updates
- The fade-alert / Polymarket / agent fields are preserved across writes (don't clobber other widget data)

## Linked code

- No inline waiver — the widget sync `useEffect` is just absent from `PicksView`. Inventory.overrides.csv flags this as `candidate` with a note pointing to this ticket.

## Notes

RN's debug `console.log` calls in `syncPicksToWidget` should NOT be ported.
