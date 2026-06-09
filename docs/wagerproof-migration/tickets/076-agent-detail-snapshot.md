# 076 — Agent detail snapshot V2 integration

**Status**: candidate (in progress)
**Owner**: B15 implementer
**Source**: `wagerproof-mobile/services/agentPicksService.ts` (`fetchAgentDetailSnapshotV2`, `fetchAgentPicksPageV2`)

## Summary

B15 ports the `agent-authorized-action-v1` edge-function-backed snapshot fetch
(action `detail_snapshot`) into Swift, with a typed `AgentDetailSnapshot`
Codable mirror. Wire-up lives in:

- `WagerproofModels/AgentDetailSnapshot.swift` — Codable mirror of the RN
  `AgentDetailSnapshotV2` interface plus supporting structs.
- `WagerproofServices/AgentAuthorizedActionsService.swift` — wraps the
  edge-function invocation (`agent-authorized-action-v1`) with a generic
  `invoke<Body, Response>` helper.
- `WagerproofServices/AgentPicksService.swift` — convenience wrappers
  (`fetchDetailSnapshot`, `fetchPicksPage`, `requestGeneration`).
- `WagerproofStores/AgentDetailStore.swift` — observable store driving the
  detail screen state machine (snapshot + history + generation).

## Remaining work

- B16 should backfill `AgentPick` with the JSONB columns (`ai_audit_payload`,
  `ai_decision_trace`, `archived_personality`, `archived_game_data`,
  `overlap`) so the audit widget renders the real LLM payload instead of the
  synthesized fallback in `AgentPickAuditStore`.
- B14's generation queue lands `request_generation` and the worker polling
  loop. AgentDetailStore.generatePicks() will switch to polling once that's
  in place; for now it relies on the single-shot edge-function response.

## Edge function contract (verbatim)

```
POST /functions/v1/agent-authorized-action-v1
{ "action": "detail_snapshot", "agent_id": "<uuid>" }
→ { "success": true, "data": AgentDetailSnapshotV2 }

POST /functions/v1/agent-authorized-action-v1
{ "action": "picks_page", "agent_id": "<uuid>", "filter": "all|won|lost|pending|push", "page_size": 20, "cursor": null, "include_overlap": false, "game_date": null }
→ { "success": true, "data": AgentPicksPageV2 }

POST /functions/v1/agent-authorized-action-v1
{ "action": "request_generation", "agent_id": "<uuid>", "idempotency_key": null }
→ { "success": true, "data": GenerationRequestResult }
```
