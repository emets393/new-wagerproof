# Personal achievement backend

The migration `supabase/migrations/20260910120000_user_achievements.sql` defines 24 durable user awards. Unlocks are insert-only under concurrent refreshes; deleting an agent or reducing its statistics never revokes an award or changes its original earned date. Source agent UUIDs remain available after deletion. Current locked progress is recomputed independently.

## Metrics

- First Agent, First Follow and First Picks use owned profiles, follows of another public agent, and generated straight picks or parlay tickets.
- Experience 10/50/100/500 uses **one owned agent's** settled `avatar_performance_cache.total_picks`. It never combines agents. The existing grader includes each settled parlay ticket once.
- Streak 3/5/10/15 uses one owned agent's `best_streak`, which the existing grader derives from straight picks, ignoring pending picks and pushes.
- First Win and +10/+25 Units use one owned agent's wins and net units. Consistent requires at least 100 decided picks and at least 55% wins, excluding pushes from the decided denominator.
- Top 100/Top 10/Number One uses currently observed overall, all-time public-agent rankings with at least ten settled picks and one decided pick. Ordering matches the source leaderboard: net units, win rate, current streak descending, then UUID ascending. No historical ranking is fabricated.
- Game Analyst, Props Scout and Trend Explorer accept authenticated completed-feature-use events `game_analysis`, `props`, `historical_analysis`. These are honest usage signals, not independently provable research outcomes.
- System Builder requires a persisted NFL/CFB/MLB saved system with verdict and RPC filters. WagerBot Partner requires a nonempty persisted assistant message owned through its chat thread. Connected Researcher requires the service-only MCP success event.

## RPC contract

`get_user_achievements()` and `record_achievement_activity(activity text)` return the same JSON object:

```json
{"catalog_version":1,"initialized_at":"ISO timestamp","generated_at":"ISO timestamp","achievements":[{"id":"first-agent","progress":1,"current_value":1,"target_value":1,"earned_at":"ISO timestamp or null","is_backfilled":false,"credited_agent_id":"UUID or null"}],"newly_unlocked_ids":["first-agent"]}
```

First initialization quietly backfills existing qualifying evidence. Later pending awards remain in `newly_unlocked_ids` until the authenticated owner calls `acknowledge_achievement_celebrations(achievement_ids text[])`. Acknowledgment cannot grant awards. The app may suppress its initial snapshot celebration according to Honeydew behavior. `record_achievement_activity` accepts only the three completed-feature values above, never achievement IDs, statistics or user IDs.

`record_achievement_service_activity(p_user_id uuid, activity text)` accepts only `mcp_tool_success` and is executable only by service_role. The MCP HTTP handler records this after successful tool execution with the verified OAuth grant's user ID, using the existing Main service key and `ExecutionContext.waitUntil`. Missing credentials or event failure does not change the tool response. No OAuth scopes or credentials were added. Successful requests before migration deployment cannot be reconstructed later from this hook.

All tables enable RLS and owner-only authenticated reads, with no client writes. Internal evaluators have no authenticated/anonymous execute grant. Security-definer functions pin their search path, bind public RPCs to `auth.uid()`, serialize per-user refreshes and use unique conflict-safe award insertion. Source insert/cache-update triggers preserve observed awards before later decreases. They run synchronously in the source transaction.

## Validation and release boundary

Run isolated PostgreSQL behavior tests:

```sh
npm install --prefix /private/tmp/wagerproof-achievement-sql-test @electric-sql/pglite
node supabase/tests/achievements.test.mjs
npm --prefix wagerproof-mcp run typecheck
node wagerproof-mcp/tests/achievements.test.mjs
```

Tests cover 24-row snapshots, quiet backfill, per-agent thresholds, streaks, consistency, units, source deletion/stat decrease, source events, owner isolation, denied grants, pending celebration acknowledgment and service-only MCP use. MCP HTTP tests cover server-bound identity, unsuccessful tools, absent credentials and recording failures. The isolated fixture is not a replay of the entire production migration history; concurrent sessions were not stress-tested.

Production deployment completed September 9, 2026 against Main project `gnjrklxotmbvnxbnnqgq`. A privileged schema dump verified source RLS, grants, trigger columns and the exact canonical leaderboard ordering. The chat trigger resolves TEXT ownership through `auth.users`, avoiding unsafe UUID casts of legacy IDs.

Migration `20260910120000` was applied and recorded atomically, without replaying unrelated historical migrations. The MCP Worker was deployed afterward as version `88756806-5cab-49df-b266-197133ab2bfe`, preserving production variables. Its existing `MAIN_SERVICE_ROLE_KEY` binding was confirmed, and the deployed OAuth metadata endpoint returned HTTP 200.

Rollback-only checks against the live database passed for the authenticated 24-award contract, quiet backfill, new activity unlocks, acknowledgment, repeated-event idempotence, owner RLS and service-only MCP recognition. No simulated test awards were retained. A complete real OAuth tool call and two-device account synchronization remain user acceptance checks; the HTTP handler itself passed local success/failure tests.
