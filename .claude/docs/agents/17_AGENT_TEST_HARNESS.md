# 17 — Agent Test Harness (the "flight simulator")

**Status:** Internal runbook. How to test the V3 agent pick-generation engine
**end-to-end WITHOUT touching the live worker or real users.** Used throughout the
2026-06 V3 work to validate fixes against the dryrun slate + live MLB.

## What it is (plain English)

A throwaway sandbox that runs a real agent through the whole pick-generation flow —
reads games, calls its tools, reasons, picks bets — but **saves nothing** and is
**deleted afterward**. Think flight simulator: the agent flies the full mission, no
real plane is in the air, and we read the "flight recorder" (the run's trace) to see
exactly what it did.

## The pieces

- **Test copy of the engine** — a full copy of the `process-agent-generation-job-v3`
  edge function, deployed as `process-agent-generation-job-v3-test`. The live one is
  never modified.
- **Fake test agent** — a row inserted straight into `avatar_profiles` (name `ZZZ_…`),
  with a hand-written personality that forces the feature under test.
- **Stand-in data** — football comes from the frozen **dryrun** tables (no live
  football off-season); baseball comes from the **live** feed (MLB is in season). The
  agent treats whatever the slate returns as "today's games."
- **Dry-run mode** — `dry_run=true` on the run: the engine does all its work but the
  final database write is skipped, so nothing real is created.
- **The trigger** — the engine is "poked" exactly the way the live dispatcher does it:
  a `net.http_post` from Postgres using the real keys stored in `public._internal_config`.

## Two Supabase projects (don't mix them up)

- **Main** `gnjrklxotmbvnxbnnqgq` — the edge functions, the `avatar_*` tables,
  `_internal_config` (auth keys), and the cron jobs.
- **Research** `jpxnjuwglavsjbgbasnl` — the dryrun tables (`nfl_dryrun_games` = Wk12,
  `cfb_dryrun_games` = Wk7) + live MLB (`mlb_games_today`, keyed by `official_date`).

## Runbook

**1. Copy + deploy the test slug** (from repo root):
```
cp -r supabase/functions/process-agent-generation-job-v3 \
      supabase/functions/process-agent-generation-job-v3-test
supabase functions deploy process-agent-generation-job-v3-test \
      --no-verify-jwt --project-ref gnjrklxotmbvnxbnnqgq
```
`--no-verify-jwt` matches the live worker's config (the function authenticates itself
in-body via the internal-secret / service bearer). *Optional:* to read the FULL list
of submitted picks (not a summary), widen the trace capture in the copy's
`agenticGenerationLoop.ts`: `args.slice(0, 200)` → `args.slice(0, 6000)`.

**2. Create a fake agent** (main project) — insert into `avatar_profiles` with a
`ZZZ_…` name, an owner `user_id` (any premium user), `preferred_sports`,
`personality_params`, and a `custom_insights.betting_philosophy` nudge that exercises
the target feature (e.g. "bet NFL and MLB, lean into parlays").

**3. Queue a dry-run** — insert into `agent_generation_runs`: `avatar_id`, `user_id`,
`generation_type='manual'`, `target_date` (use **today** if you want live MLB; the
dryrun football fetch ignores the date and grabs the newest saved week),
`engine_version='v3'`, `dry_run=true`, `status='queued'`, `next_attempt_at=now()`.

**4. Pause the dispatcher, fire the test, re-enable** (main project SQL):
```sql
SELECT cron.alter_job(job_id := 54, active := false);   -- pause v3-dispatch-workers
UPDATE agent_generation_runs SET next_attempt_at = now() WHERE id = '<run id>';
SELECT net.http_post(
  url := 'https://gnjrklxotmbvnxbnnqgq.supabase.co/functions/v1/process-agent-generation-job-v3-test',
  headers := jsonb_build_object(
    'Authorization', 'Bearer ' || (SELECT value FROM public._internal_config WHERE key='service_role_key'),
    'x-internal-secret', (SELECT value FROM public._internal_config WHERE key='internal_function_secret'),
    'Content-Type', 'application/json'),
  body := '{}'::jsonb);
```
**Why pause job 54:** the every-minute `v3-dispatch-workers` cron would otherwise grab
the queued run and hand it to the LIVE worker. Once the test slug has claimed it
(`status='processing'`, `lease_owner='worker-v3-…'`), re-enable —
`SELECT cron.alter_job(54, active := true);` — the cron skips a leased run, so it's safe.

**5. Read the results** — the run blocks ~1–4 min, then `agent_generation_runs` carries:
`v3_engine_used` (want `v3`, with `v3_fallback_reason` null), `v3_tool_call_count`,
`v3_deep_fetch_count`, `picks_generated`, `v3_tool_trace` (every tool call + result),
`v3_reasoning_trace`. The `submit_picks` / `submit_parlay` trace entries' `args_digest`
show exactly what it bet.

## Cleanup (always do this)
```
supabase functions delete process-agent-generation-job-v3-test --project-ref gnjrklxotmbvnxbnnqgq
rm -rf supabase/functions/process-agent-generation-job-v3-test
```
```sql
DELETE FROM agent_generation_runs WHERE avatar_id IN (SELECT id FROM avatar_profiles WHERE name LIKE 'ZZZ\_%' ESCAPE '\');
DELETE FROM avatar_picks          WHERE avatar_id IN (SELECT id FROM avatar_profiles WHERE name LIKE 'ZZZ\_%' ESCAPE '\');
DELETE FROM avatar_profiles       WHERE name LIKE 'ZZZ\_%' ESCAPE '\';
```
Then confirm **cron 54 is active**: `SELECT active FROM cron.job WHERE jobid=54;` → `true`.

## Safety rules

- Never deploy to or modify the live `process-agent-generation-job-v3` — only the `-test` copy.
- Always `dry_run=true` (no real picks written). A real-write test would additionally
  require the V3 branch migrations applied to prod (`avatar_parlays` + the prop/h1/
  team_total columns) — dry-run needs none of that.
- The cron-54 pause is brief (pause → fire → re-enable once the run is leased); never leave it paused.
- The auth keys are read from `_internal_config` inline — never print them.
