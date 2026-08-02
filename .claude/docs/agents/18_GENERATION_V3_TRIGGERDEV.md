# Generation V3 Trigger.dev Path

**This is the canonical pick-generation path.** Verified 2026-07-25. It was originally
built as a parallel native-client path, but both shipping clients now route through it:
iOS native and the web app (`src/services/agentPicksService.ts` → `trigger-v3-run`).

What it superseded, and what remains:
- **Legacy V2 queue** — still reachable, but only from the deprecated React Native app.
- **Supabase edge-function V3 worker** (`process-agent-generation-job-v3/`) — a fork of the
  same loop that has since diverged. It shares 9 module names with `agents-v3/src/loop/`
  but the code differs (`agenticGenerationLoop.ts` alone is 111 diff lines), and each has
  its own entry point (`index.ts` vs `runV3Generation.ts`). Nothing triggers it from this
  path. Fixes applied to one copy do not reach the other.
- **Auto-generation** — `agents-v3/trigger/dailyAutoGenV3.ts` states it replaces the legacy
  pg_cron enqueue. Three migrations (`20260303000003`, `20260416114500`, `20260416193000`)
  call `cron.unschedule('v2-enqueue-auto-generation')`, but each is a drop-then-recreate —
  the last one re-schedules it, and nothing since removes it. So the legacy cron is likely
  still active alongside the Trigger.dev scan. **Verify prod `cron.job` before changing
  auto-generation; it may currently double-fire.**

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

## Transports (2026-08-01)

The loop owns the conversation and the governor; a **Transport** (`src/loop/transport.ts`)
owns the wire. `resolveProvider(model)` in `src/loop/runV3Generation.ts` is the single
routing decision, and nothing downstream re-tests the model string:

| Model id | Wire | Implementation |
|---|---|---|
| `gpt-*`, `o*` (default `gpt-5.6-luna`) | `POST /v1/responses` | `src/loop/responsesTransport.ts` |
| `deepseek*` | `POST /v1/chat/completions` | `src/loop/chatCompletionsTransport.ts` |

Chat Completions discards the model's reasoning between tool turns, so a research loop
re-derives its own conclusions every turn. `/v1/responses` returns reasoning as a
first-class item that is echoed back **verbatim** in the next turn's `input[]`
(`store: false` + `include: ["reasoning.encrypted_content"]`, `reasoning.context:
"all_turns"`), which is the reason for the port. DeepSeek stays on Chat Completions: it is
the outage fallback and does not implement the Responses API. Removing DeepSeek later means
deleting `chatCompletionsTransport.ts` and one branch of `resolveProvider` — nothing else.

Asymmetries that are intentional:

- **Only the Chat transport downgrades reasoning effort on a 400.** There a refusal may be
  the wire genuinely rejecting tools + effort. On Responses that combination is supported, so
  a 400 is a plumbing defect (e.g. a reasoning item echoed without its following item) or an
  unsupported effort — both must fail loudly rather than quietly buy the port's benefit back
  out.
- **`maxTokensOut` was raised 24,000 → 40,000** (`src/loop/loopGuards.ts`) because
  `max_output_tokens` on Responses covers reasoning tokens, unlike DeepSeek's separately
  budgeted CoT. A turn whose `xhigh` thinking exhausts the cap before emitting a tool call
  comes back truncated with zero tool calls; the loop trips the circuit, injects one repair
  instruction, and throws if nothing was ever accepted (it must never end as a green
  zero-pick run).
- **`tokenCeiling` (320,000) is unchanged** and is a cumulative sum of per-turn
  prompt+completion tokens, not a context-window measure — both wires re-bill the whole
  conversation every turn. Echoed reasoning items make prompts grow faster, so it trips
  somewhat earlier than pre-port; retune from telemetry (`p_circuit_tripped`, ledger
  `input_tokens`), not from a guess.
- **Cost is overstated on the Responses path.** `MODEL_COSTS` charges every input token at
  the cache-miss rate even though `prompt_cache_key` is set per run, so `estimated_cost_usd`
  runs high and `isOverDailySpendCap` throttles early — the safe direction. Modeling
  `input_tokens_details.cached_tokens` is a follow-up.

Usage normalization: `output_tokens` from Responses is **inclusive of**
`output_tokens_details.reasoning_tokens`. The transport passes the total through and carries
the reasoning count only as a breakdown; adding them would double-charge the governor's
ceiling and the ledger.

### What the loop now knows, and what it doesn't

The loop holds a `ConversationItem[]` and calls `transport.sendTurn(...)`. It branches on
`transport.capabilities`, never on `transport.wire` (that field is span attributes and routing
tests only). The two provider accommodations that used to be inline model-string tests —
DeepSeek's refusal of a named `tool_choice`, and its requirement that each tool-calling turn's
CoT be handed back — now live in `resolveProvider`'s DeepSeek branch as
`supportsForcedToolChoice: false` and `passBackReasoning: true`.

Reasoning persistence works by the transport parking OpenAI's entire `response.output[]` in an
opaque `ReasoningCarrier.raw` and spreading it verbatim into the next turn's `input[]` —
reasoning item, then its `function_call`s, each matched by exactly one `function_call_output`.
The loop must never read, hash, truncate or reconstruct that value.

### Fixture-verified only — no live request has been made

The `/v1/responses` path was built and tested entirely against synthetic SSE fixtures
(`agents-v3/src/loop/__fixtures__/sseStream.ts`); no request has been sent to
`api.openai.com` from this code. `agents-v3/README.md` → "First live run" lists the four
things one real `generate-v3-picks` run must confirm. The two most likely live-only failures:
`reasoning.effort: "xhigh"` being unavailable on Luna (there is deliberately no code-side
downgrade; `V3_REASONING_EFFORT=high` is the lever), and OpenAI rejecting the synthetic
`slate_0` seed turn, which serializes as a `function_call` naming a tool absent from `tools[]`.

Tests live beside the source and run under the **repo-root** vitest (`npx vitest run` from the
worktree root); `agents-v3` has no vitest of its own, and its `tsconfig.json` excludes
`**/*.test.ts` for that reason. See `agents-v3/README.md` → "Testing".

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

- `OPENAI_API_KEY` — **the primary key since 2026-08-01.** The loop defaults to
  `gpt-5.6-luna` on `/v1/responses` at `reasoning.effort: "xhigh"`
  (`src/loop/runV3Generation.ts`, `src/loop/responsesTransport.ts`). Pin the full id: the
  bare `gpt-5.6` alias routes to Sol, not Luna.
- `DEEPSEEK_API_KEY` — still required. DeepSeek is the outage fallback (a DeepSeek 402 took
  generation down on 2026-07-25) and stays routable through the debug model pickers and any
  run whose ledger `model_name` says so; `deepseek-reasoner` / `deepseek-chat` are retired
  aliases. No reasoning param is **ever** sent to DeepSeek (it rejects unknown body keys).
- optional `V3_REASONING_EFFORT` — overrides the effort without a redeploy. Valid:
  `none|low|medium|high|xhigh|max`. Luna's `xhigh` reportedly benchmarks ~flat vs `high` at
  materially higher output-token cost, so an A/B is worth running.
  - **Unverified:** the docs list `xhigh` for the GPT-5.6 family but publish no per-variant
    matrix, so `xhigh` on Luna is plausible-but-unconfirmed. The Responses transport does
    **not** downgrade on a 400 — it throws, and the run fails retryably. If prod logs show
    `LLM 400` mentioning `effort`, set `V3_REASONING_EFFORT=high`; that is a env change, not
    a deploy.
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
