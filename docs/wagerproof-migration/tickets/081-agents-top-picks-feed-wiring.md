# Ticket #081 — Wire TopAgentPicksFeed into AgentsView.topPicksBranch

**Status:** open
**Filed by:** B16 implementer
**Filed:** 2026-05-21
**Closed:** —
**Affects screen / file:** `wagerproof_ios_native/Wagerproof/Features/Agents/AgentsView.swift` (`topPicksBranch`)

## What we couldn't ship in scope

B16 built `TopAgentPicksFeed` + `TopAgentPicksFeedStore` + `FavoriteAgentsStore`
+ `TopAgentPicksFeedContainer` (the integration shim), but did **not** edit
`AgentsView.swift` directly because B14 (creation wizard) and B15
(detail/settings) are co-editing that file in parallel. The current
`topPicksBranch` still renders the inline `TopPickRow` list that B13 shipped
and pulls from `AgentsStore.refreshTopPicks` (single-mode, no search, no
pagination).

## Why

Avoiding three-way merge conflicts on `AgentsView.swift`. The integration
itself is a single replacement of `topPicksBranch`'s `default:` arm with
`TopAgentPicksFeedContainer(...)`.

## Impact

iOS users still see the B13 placeholder feed (top10 only, no search, no
pagination) until this ticket ships. The data layer is ready —
`AgentPicksService.fetchTopAgentPicksFeed` accepts filter mode, search, and
cursor; `TopAgentPicksFeedStore` orchestrates pagination; the view is
production-ready.

## Acceptance criteria

After B14 + B15 land:

1. In `AgentsView.swift`, replace the `default:` arm of `topPicksBranch`'s
   switch with:

   ```swift
   TopAgentPicksFeedContainer(
       viewerUserId: currentUserId,
       onAgentTap: { id in
           navPath.append(AgentsRoute.publicAgentDetail(agentId: id))
       },
       onPickTap: { row in
           // B15 wires this into the pick-detail sheet; for now drill
           // into the agent so the user has a path forward.
           navPath.append(AgentsRoute.publicAgentDetail(agentId: row.avatarId))
       }
   )
   ```

2. Add `.searchable(text: $topPicksFeedStore.searchText, ...)` to the
   `NavigationStack` when `store.activeTab == .topPicks`. The container's
   `.task(id:)` already debounces and pumps the store.

3. Delete the inline `TopPickRow` private struct from `AgentsView.swift` —
   it's superseded by the new component.

4. Mark FIDELITY-WAIVER #070 as RESOLVED at the top of its ticket and add
   the closing date.

## Linked code

- `Wagerproof/Features/Agents/AgentsView+TopPicks.swift` — the container.
- `Wagerproof/Features/Agents/Components/TopAgentPicksFeed.swift` — the
  component.
- Resolves ticket #070.
