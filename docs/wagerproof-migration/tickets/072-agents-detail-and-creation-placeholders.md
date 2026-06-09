# Ticket #072 — Agent detail / creation / public detail routes are placeholders

**Status:** partially resolved — creation route shipped in B14, detail + public-detail still pending
**Filed by:** B13 implementer
**Filed:** 2026-05-21
**Updated:** 2026-05-21 — `createAgent` route now lands on the real `AgentCreationView` (B14). `agentDetail` + `publicAgentDetail` still hit placeholders.
**Closed:** —
**Affects screen / file:** `wagerproof-mobile/app/(drawer)/(tabs)/agents/{[id]/index,public/[id]}.tsx` → `wagerproof_ios_native/Wagerproof/Features/Agents/AgentsView.swift` (placeholders at the bottom). `create.tsx` ported in B14.

## What we couldn't ship in scope

Three navigation destinations off the Agents hub all push placeholder `ContentUnavailableView` screens in B13:

1. **Create Agent** ("+" FAB) — RN screen is a 6-step wizard at `agents/create.tsx`. Tracked separately as ticket #077.
2. **Agent Detail** (tap a card) — RN screen is a multi-tab detail at `agents/[id]/index.tsx`. Tracked as ticket #076.
3. **Public Agent Detail** (tap a leaderboard row or top-pick row) — RN screen at `agents/public/[id]`. Tracked as ticket #078.

## Why

B13 scope was the landing screen + data layer. The three downstream routes are large standalone batches:

- **B14** ships agent creation. ~1500 lines of sliders, sport pickers, archetype cards, custom-insights editor, autopilot scheduler.
- **B15** ships owner detail. Today's picks, autopilot toggle, performance breakdowns, edit personality.
- **B16** ships the public detail + follow/unfollow + sharing surface.

Each of those is a full batch. Shipping any one of them squeezed into B13 would compromise quality.

## Impact

Users can land on the Agents tab and see the My Agents grid, Leaderboard, and Top Picks. Tapping any nav target shows a clear `ContentUnavailableView` naming the batch number — no silent dead ends.

## Acceptance criteria

- This ticket closes only when all three child tickets (#076, #077, #078) close.

## Linked code

- `// FIDELITY-WAIVER #072` in `AgentsView.swift` doc-comment (header) — covers the three placeholder views at the bottom of the file.

## Notes

The placeholder views intentionally include the agent id (where applicable) so QA can verify the right id is being passed through navigation.
