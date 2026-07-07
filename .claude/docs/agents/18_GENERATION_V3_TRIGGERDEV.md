# Generation V3 Trigger.dev Path

This is the parallel native-client execution path for V3 pick generation. It
does not replace the legacy V2 queue or the Supabase edge-function V3 worker.

## Architecture

1. The iOS app calls the new `trigger-v3-run` Supabase Edge Function.
2. The gateway validates the authenticated user, entitlement, ownership, and the
   relevant manual generation cap: 3/day for daily picks or 3/football-week for
   `window: "week"` weekly parlays.
3. The gateway creates or reuses an `agent_generation_runs` ledger row with
   `engine_version = 'v3_trigger'`.
4. The gateway triggers the Trigger.dev task `generate-v3-picks` and stores the
   Trigger run id in `agent_generation_runs.trigger_run_id`.
5. The app polls run status/metadata every 1.5s through the `trigger-run-status`
   edge function (which fetches the run with the Trigger SECRET key server-side
   and returns just the rendered fields) and renders live `metadata`.
6. The task writes daily picks to `avatar_picks` and daily/weekly tickets to
   `avatar_parlays`; the snapshot returns daily tickets under `todays_parlays`
   and week-long tickets under `weekly_parlays`.

## Windows

`trigger-v3-run` accepts an optional body field:

```json
{ "window": "week" }
```

Absent or `"day"` runs the daily product. `"week"` routes to
`enqueue_weekly_parlay_run_v3_trigger`, requires an NFL/CFB agent, uses the current ET Tuesday
football `week_key`, and returns 429 when the 3-per-football-week manual budget is exhausted.
Weekly runs force the V3 loop into one parlay-only ticket, capped at 6 legs, with
`scope='weekly'` and `target_date=week_key+6`.

The iOS client does not expose a second weekly generation control. When the user commits the main
"Generate Today's Picks" swipe, the detail screen runs the daily product first, then automatically
requests the weekly window if weekly parlays are enabled and budget remains.

### Why a status proxy (not a direct client poll)

Trigger.dev's run-retrieve API rejects hand-rolled "public access token" JWTs
with `401 Invalid Public Access Token` — those tokens must be minted by Trigger's
own SDK, which the Deno edge function can't do cheaply. So the client does NOT
hit `api.trigger.dev` directly. Instead `trigger-run-status` fetches the run with
`TRIGGER_SECRET_KEY_PROD` (which works) and returns `{ id, status, metadata, … }`,
enforcing that the run belongs to the caller. `trigger-v3-run` still returns a
`public_access_token` field for compatibility, but the client no longer uses it.

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
- `agents-v3/trigger/weeklyParlayAutoGenV3.ts`
- `agents-v3/src/loop/*`
- `supabase/functions/trigger-v3-run/index.ts`
- `supabase/functions/trigger-run-status/index.ts` (live status/metadata proxy)
- `supabase/migrations/20260629180000_agent_generation_v3_triggerdev.sql`
- `wagerproof-ios-native/Wagerproof/Features/Agents/Components/LiveAgentRunView.swift`
- `wagerproof-ios-native/WagerproofKit/Sources/WagerproofServices/TriggerRunStatusService.swift`

## Required Secrets

Trigger.dev `prod` environment (`agents-v3/trigger.config.ts`'s `syncEnvVars`
extension pushes these from `agents-v3/.env` into Trigger.dev Cloud on every
`npm run deploy` — no manual dashboard step needed as long as `.env` is filled
in):

- `DEEPSEEK_API_KEY`
- `OPENAI_API_KEY` (fallback provider; loop defaults to `deepseek-reasoner`)
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `CFB_SUPABASE_URL`
- `CFB_SUPABASE_ANON_KEY`
- `REVENUECAT_SECRET_API_KEY`
- `REVENUECAT_ENTITLEMENT_IDENTIFIER`
- optional `V3_DAILY_SPEND_CAP_USD`

Supabase Edge Function secrets (both `trigger-v3-run` and `trigger-run-status`):

- `TRIGGER_SECRET_KEY_PROD` — the Trigger.dev **Production** environment
  secret key (from the dashboard, Project → API Keys). Named differently from
  the CLI's local `.env` `TRIGGER_SECRET_KEY` (a dev key) on purpose, so the
  edge functions can never be pointed at a developer's local `trigger dev`
  session by mistake — they must always trigger the deployed prod tasks.
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`

## Deploy

```bash
supabase functions deploy trigger-v3-run
supabase functions deploy trigger-run-status
npm run --prefix agents-v3 deploy   # or `cd agents-v3 && npm run deploy`
```

`npm run deploy` builds, syncs the runtime env vars above into Trigger.dev
Cloud's `prod` environment, and deploys `generate-v3-picks`,
`daily-auto-gen-v3`, and `weekly-parlay-auto-gen-v3` as a new version.

## Verification

Run:

```bash
npm run --prefix agents-v3 build
deno check supabase/functions/trigger-v3-run/index.ts
deno check supabase/functions/trigger-run-status/index.ts
cd wagerproof-ios-native
xcodegen generate
xcodebuild -project Wagerproof.xcodeproj -scheme Wagerproof -configuration Debug -destination 'generic/platform=iOS Simulator' CODE_SIGNING_ALLOWED=NO build
```
