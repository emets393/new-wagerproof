# Ticket #070 — Agents Top Picks filter UI is a single-mode call

**Status:** open
**Filed by:** B13 implementer
**Filed:** 2026-05-21
**Closed:** —
**Affects screen / file:** `wagerproof-mobile/components/agents/TopAgentPicksFeed.tsx`, `wagerproof-mobile/services/agentPicksService.ts:315-343` → `wagerproof_ios_native/Wagerproof/Features/Agents/AgentsView.swift` (`topPicksBranch`)

## What we couldn't ship in scope

The RN Top Agent Picks tab has three filter modes — `top10`, `following`, `favorites` — plus a search field and pagination cursor. In B13 we ship only the `top10` mode with a fixed `limit: 50` so the tab is populated and tappable. There's no segmented control to switch modes, no search bar, and no infinite scroll.

## Why

The Top Picks filter machinery is the centerpiece of B16. Building it well requires the public agent detail screen (where "Following" links land) and the follow/unfollow surface (where users curate "Favorites"). Shipping a broken segmented control that points at empty branches would be worse than the static feed we have today.

## Impact

iOS users see only top-10 agents' upcoming picks. Following/favorites filtering and search are absent until B16 ships. The data layer (`AgentPicksService.fetchTopAgentPicksFeed`) already accepts the filter mode so wiring the UI later is mechanical.

## Acceptance criteria

- `topPicksBranch` in `AgentsView.swift` adds a segmented control for the three filter modes.
- Search bar wired via `.searchable`.
- Pagination via the cursor parameter (the RPC already returns one in the payload).
- Tapping a row drills into the public agent detail (lands in B16 — ticket #078).

## Linked code

- `// FIDELITY-WAIVER #070` referenced in `AgentsStore.swift` (`refreshTopPicks` doc-comment area).

## Notes

The B13 hub gets a working Top Picks tab so users see real data even before the full filter UI ships.
