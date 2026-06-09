# 079 — Agent pick audit (real payload sourcing)

**Status**: deferred
**Owner**: B16 follow-up
**Source**: `wagerproof-mobile/components/agents/AgentPickPayloadAuditWidget.tsx` +
            inline derivation in `app/(drawer)/(tabs)/agents/[id]/index.tsx:571-633`

## Summary

The RN audit widget reads four JSONB columns from `avatar_picks`:
`ai_decision_trace`, `ai_audit_payload`, `archived_personality`, and
`archived_game_data`. These contain the actual LLM input/output payload and
the leaned-metrics trace the agent produced.

The Swift `AgentPick` model in `WagerproofModels/AgentPick.swift` only types
the public columns (no JSONB). Our B15 audit widget therefore renders a
**synthesized** payload using `pick.reasoningText`, `pick.keyFactors`, and the
game identifiers — useful for parity but not the real LLM-produced data.

## Required work

1. Extend `AgentPick` with optional JSONB fields:
   - `aiDecisionTrace: [String: AnyDecodable]?`
   - `aiAuditPayload: [String: AnyDecodable]?`
   - `archivedPersonality: [String: AnyDecodable]?`
   - `archivedGameData: [String: AnyDecodable]?`
2. Update `AgentPickAuditStore.buildPayload` to read from those fields,
   falling back to the synthesized form only when they're absent (matches
   the RN `useMemo` block).
3. Optional: ship an `agent-pick-audit` edge function (already named in B15
   batch spec) that returns the formatted payload server-side so the client
   doesn't need to decode untyped JSONB.
