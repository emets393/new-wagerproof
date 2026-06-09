# Ticket #013 — Editor-picks-stats route push from stats banner deferred to B16

**Status:** open
**Filed by:** orchestrator (post B05 review)
**Filed:** 2026-05-20
**Affects screen / file:** `wagerproof-mobile/components/EditorPicksStatsBanner.tsx:25` → `wagerproof_ios_native/Wagerproof/Features/EditorPicks/Components/EditorPicksStatsBanner.swift`

## What we couldn't ship in scope

RN's `EditorPicksStatsBanner` first card pushes `/editor-picks-stats` when tapped. The Swift port defines an `onEditorPicksTap` closure in `EditorPicksStatsBanner.swift` but the closure body is currently a no-op — the destination view `EditorPicksStatsView.swift` is owned by B16 (top-agent-picks + leaderboard widget sync) and does not exist yet.

## Why

B05's scope is the Picks tab + its sheets. Pushing into a separate screen that doesn't exist yet would require either porting that screen out-of-scope or wiring a placeholder destination. B16 will land `EditorPicksStatsView`; the same batch will wire the `onEditorPicksTap` closure to push it.

## Impact

Tapping the first card of the stats banner currently does nothing. The "Coming Soon" alert for the second card (model history) still fires correctly.

## Acceptance criteria

- `Features/EditorPicks/EditorPicksStatsView.swift` ports (B16).
- The `onEditorPicksTap` closure in `EditorPicksStatsBanner` is wired to a `NavigationLink(value:)` or `navigationPath.append(.editorPicksStats)` that pushes the new view.

## Linked code

- `// FIDELITY-WAIVER #013` in `wagerproof_ios_native/Wagerproof/Features/EditorPicks/Components/EditorPicksStatsBanner.swift` at the `onEditorPicksTap` closure.

## Notes

The route is also surfaced from the Picks tab's drawer (B03's SideMenu) — that path will need wiring once `EditorPicksStatsView` lands.
