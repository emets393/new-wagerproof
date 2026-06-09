# Ticket #022 — Outliers inner tabs (Top Agent Picks / Leaderboard) defer to B13/B16

**Status:** open
**Filed by:** B06 implementer
**Filed:** 2026-05-20
**Closed:** —
**Affects screen / file:** `wagerproof-mobile/app/(drawer)/(tabs)/outliers.tsx:37–38, 1473–1499` (TopAgentPicksFeed + AgentLeaderboard embeds) → `wagerproof_ios_native/Wagerproof/Features/Outliers/OutliersView.swift:agentPicksPlaceholder / leaderboardPlaceholder`

## What we couldn't ship in scope

The Outliers tab's three-way inner picker (Outliers / Top Agent Picks / Leaderboard) only ships the "Outliers" hub branch in B06. The other two branches render `ContentUnavailableView` placeholders. The RN screen embeds `TopAgentPicksFeed` and `AgentLeaderboard` components from `components/agents/`, which depend on the Agents feature (avatar profiles, picks, leaderboard view).

## Why

The Agents feature is a large standalone batch (B13: data + creation flow; B16: leaderboard + sharing). Trying to inline even minimal versions here would force premature ports of `avatar_profiles`, `avatar_picks`, and `avatar_performance_cache` tables, plus their RLS-protected fetch logic. The placeholder approach keeps the inner-picker structurally identical to RN (same 3 segments) while the real content waits for its proper batch.

## Impact

Users tapping either of the non-Outliers segments see a "land in B13 / B16" `ContentUnavailableView`. The Outliers hub itself is fully functional; only the cross-feature tabs are blank.

## Acceptance criteria

- `TopAgentPicksFeedView` exists (B13) and renders inside the `OutliersStore.InnerTab.agentPicks` branch of `OutliersView.swift`.
- `AgentLeaderboardView` exists (B16) and renders inside the `OutliersStore.InnerTab.leaderboard` branch.
- The two `ContentUnavailableView` placeholders (`agentPicksPlaceholder`, `leaderboardPlaceholder`) are removed.
- The `// FIDELITY-WAIVER #013` comments are removed.

## Linked code

- `// FIDELITY-WAIVER #013: Top Agent Picks lands in B13.` in `wagerproof_ios_native/Wagerproof/Features/Outliers/OutliersView.swift` (above `agentPicksPlaceholder`)
- `// FIDELITY-WAIVER #013: Leaderboard lands in B16.` in the same file (above `leaderboardPlaceholder`)

## Notes

The picker still has all 3 segments visible — tapping them produces selection haptics and renders the placeholder body. This matches the RN layout (the user can see the inner tabs exist) without delivering broken content.
