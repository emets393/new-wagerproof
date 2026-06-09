# Ticket #073 — PixelOffice + CompanyDashboardBanner not ported

**Status:** resolved (PixelOffice — seated agents; walking deferred to #082)
**Filed by:** B13 implementer
**Filed:** 2026-05-21
**Closed:** 2026-05-24 (PixelOffice scene + CompanyDashboardBanner mounted on My Agents branch)
**Affects screen / file:** `wagerproof-mobile/components/agents/PixelOffice.tsx`, `wagerproof-mobile/components/agents/CompanyDashboardBanner.tsx` → not present in `wagerproof_ios_native/`

## What we couldn't ship in scope

The RN agents hub renders two large visual surfaces above the agent grid:

1. **PixelOffice** — a pixel-art scene populated with up to six of the user's agents as standing characters. ~700 lines plus sprite assets, animation state, and InteractionManager-deferred mounting.
2. **CompanyDashboardBanner** — a rollup stats banner showing total agents, combined record, total units, and best/worst performer. ~600 lines.

The Swift hub omits both and goes straight to the inner-tab picker + agent grid.

## Why

PixelOffice depends on sprite-sheet assets (separate ticket #074 for the asset pipeline) and a tweening engine that doesn't have a 1-to-1 SwiftUI primitive. CompanyDashboardBanner is the lighter port but reads aggregations that aren't yet computed by any Swift store (it iterates the agents array and computes 6+ derived stats). Both are pure-cosmetic surfaces — none of their data is destination-bound, so they can ship later without blocking creation, leaderboard, or pick generation.

## Impact

The agents hub on iOS opens directly to the grid; users miss the "office full of agent characters" hero scene and the at-a-glance combined-stats banner. They still get the same grid, leaderboard, and top-picks content.

## Acceptance criteria

- PixelOffice ported as `AgentOfficeView` rendering a Canvas-backed pixel-art scene (asset pipeline lands in ticket #074).
- CompanyDashboardBanner ported as `CompanyDashboardBannerView` reading derived stats from `AgentsStore`.
- Both render above the inner-tab picker on the `.myAgents` branch.

## Linked code

- `// FIDELITY-WAIVER #073` in `AgentsView.swift` (top doc-comment).

## Notes

Consider whether the pixel-office surface is worth porting at all — it's a delightful flourish in RN but iOS users may expect a more system-native feel. Worth a design review before sinking the implementation time.
