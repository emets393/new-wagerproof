# Generation V3 Trigger.dev Path

This is the parallel native-client execution path for V3 pick generation. It
does not replace the legacy V2 queue or the Supabase edge-function V3 worker.

## Architecture

1. The iOS app calls the new `trigger-v3-run` Supabase Edge Function.
2. The gateway validates the authenticated user, entitlement, ownership, and the
   3/day manual generation cap.
3. The gateway creates or reuses an `agent_generation_runs` ledger row with
   `engine_version = 'v3_trigger'`.
4. The gateway triggers the Trigger.dev task `generate-v3-picks` and stores the
   Trigger run id in `agent_generation_runs.trigger_run_id`.
5. The app polls Trigger.dev run status with a run-scoped public access token
   and renders live `metadata`.
6. The task writes picks to `avatar_picks`; existing grading and snapshots are
   unchanged.

## Isolation

Legacy workers ignore this path:

- V2 claim/dispatch filters `engine_version = 'v2'`.
- Supabase V3 claim/dispatch filters `engine_version = 'v3'`.
- Trigger rows use `engine_version = 'v3_trigger'`.

The only shared tables are the ledger (`agent_generation_runs`) and final picks
(`avatar_picks`).

## Trigger Features Used

- Task queue with global concurrency limit.
- Retries with exponential backoff.
- Scheduled task for auto-generation fan-out.
- Batch trigger for auto-generation.
- Idempotency keys for manual and auto runs.
- Tags for dashboard filtering (`avatar:*`, `user:*`, `type:*`).
- Run `metadata` for live client status and dashboard visibility.

`concurrencyKey` is intentionally not used. In Trigger.dev it creates per-key
queue copies, which would turn the global cap into a per-user cap.

## Files

- `agents-v3/trigger/generateV3Picks.ts`
- `agents-v3/trigger/dailyAutoGenV3.ts`
- `agents-v3/src/loop/*`
- `supabase/functions/trigger-v3-run/index.ts`
- `supabase/migrations/20260629180000_agent_generation_v3_triggerdev.sql`
- `wagerproof-ios-native/Wagerproof/Features/Agents/Components/LiveAgentRunView.swift`
- `wagerproof-ios-native/WagerproofKit/Sources/WagerproofServices/TriggerRunStatusService.swift`

## Required Secrets

Trigger.dev environment:

- `DEEPSEEK_API_KEY`
- `OPENAI_API_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `CFB_SUPABASE_URL`
- `CFB_SUPABASE_ANON_KEY`
- optional `V3_DAILY_SPEND_CAP_USD`

Supabase Edge Function secrets:

- `TRIGGER_SECRET_KEY`

## Verification

Run:

```bash
npm run --prefix agents-v3 build
deno check supabase/functions/trigger-v3-run/index.ts
cd wagerproof-ios-native
xcodegen generate
xcodebuild -project Wagerproof.xcodeproj -scheme Wagerproof -configuration Debug -destination 'generic/platform=iOS Simulator' CODE_SIGNING_ALLOWED=NO build
```
