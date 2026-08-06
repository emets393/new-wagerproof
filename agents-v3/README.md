# Wagerproof Agents V3 on Trigger.dev

**The canonical pick-generation engine.** Both shipping clients route generation here — the
web app via `src/services/agentPicksService.ts` → `trigger-v3-run`, and iOS native via
`WagerproofKit/Sources/WagerproofServices/AgentPicksService.swift`. Rows with
`agent_generation_runs.engine_version = 'v3_trigger'` are the ledger for these runs.

The legacy V2 edge-function queue still exists but is reachable only from the deprecated
React Native app (`wagerproof-mobile/`), which is being phased out.

> **Runtime constraint:** `trigger.config.ts` must set `runtime: "node-22"`. supabase-js
> ≥2.108 throws at `createClient` on Node 21 — shipping without this took prod down once.

## Tasks

- `generate-v3-picks`: one agentic V3 generation run.
  - Global queue concurrency: 10.
  - `maxDuration`: 600 seconds.
  - Retries: 3 attempts with exponential backoff.
  - Emits live progress to Trigger.dev run `metadata` (`phase`, `turn`,
    `currentTool`, `toolCalls`, `picksAccepted`, etc.).
- `daily-auto-gen-v3`: scheduled eligibility scan every 10 minutes. It inserts
  `v3_trigger` ledger rows and batch-triggers `generate-v3-picks`. Note this task
  states it *replaces* the legacy pg_cron auto-generation enqueue — but the migrations
  touching `v2-enqueue-auto-generation` all unschedule-then-reschedule it, so it is likely
  still active. Verify prod `cron.job` before assuming auto-generation fires exactly once.
- `weekly-parlay-auto-gen-v3` (`trigger/weeklyParlayAutoGenV3.ts`): weekly parlay
  generation pass.

## Transports (which model talks to which wire)

The loop owns the conversation and the governor; a **Transport** owns the wire
(`src/loop/transport.ts`). `resolveProvider(model)` in `src/loop/runV3Generation.ts` is the
single routing decision — nothing downstream re-tests the model string:

| Model id | Wire | File |
|---|---|---|
| `gpt-*`, `o*` (default `gpt-5.6-luna`) | `POST /v1/responses` | `responsesTransport.ts` |
| `deepseek*` | `POST /v1/chat/completions` | `chatCompletionsTransport.ts` |

Why two: Chat Completions **discards the model's reasoning between tool turns**, so every
turn of a research loop re-derives what it already worked out, and a real reasoning effort
alongside function tools may not be reachable there at all. `/v1/responses` returns
reasoning as a first-class item that is echoed back verbatim on the next turn
(`store: false` + `include: ["reasoning.encrypted_content"]`, so nothing is retained
server-side). DeepSeek stays on Chat Completions because it is the outage fallback and does
not implement the Responses API. Deleting DeepSeek later = deleting
`chatCompletionsTransport.ts` and one branch of `resolveProvider`.

Differences that are deliberate, not oversights:

- **Only the Chat transport downgrades reasoning effort on a 400.** There, a refusal may be
  the wire genuinely rejecting tools + effort. On Responses that combination is supported, so
  a 400 is a defect (or an effort the model lacks) and must surface — a silent downgrade
  would leave the port "working" while delivering none of its benefit.
- **`maxTokensOut` (40,000) means different things per wire.** DeepSeek budgets CoT
  separately, so there it caps only the visible answer; `max_output_tokens` on Responses
  covers reasoning tokens too, which is why the cap was raised — at `xhigh` the thinking can
  consume the whole budget before a tool call is emitted, and the loop's truncation guard
  (`finish: "truncated"` → trip, repair, then fail loudly) is what stops that from becoming a
  green run with zero picks.
- **`tokenCeiling` (320,000) is a cumulative sum of per-turn prompt+completion tokens**, not
  a context-window measure — both wires re-bill the whole conversation each turn. Echoing
  reasoning items makes prompts grow faster, so it trips a little earlier than before.
- **`estimated_cost_usd` charges every input token at the cache-miss rate** even though the
  Responses path sets `prompt_cache_key`. That overstates spend and so throttles the
  `V3_DAILY_SPEND_CAP_USD` gate early — the safe direction. Modeling
  `input_tokens_details.cached_tokens` is a follow-up.

> **Not yet exercised against the live API.** The Responses path is verified only against
> synthetic SSE fixtures — no request has been sent to `api.openai.com` from this code. See
> "First live run" below before trusting it in prod.

### How the seam is shaped

`transport.ts` defines a provider-neutral conversation model. Nothing in it names `messages`,
`input`, `finish_reason` or `prompt_tokens`:

- `ConversationItem[]` — an **ordered flat list** (`system` / `user` / `assistant` /
  `toolResult`). Order is load-bearing: the loop injects repair instructions *between* the
  tool results of one assistant turn, so any "group by role" shape would lose the real
  sequence. Assistant items are one-per-model-turn (text + tool calls + reasoning together),
  which expands losslessly into the Responses flat item stream but not the other way round.
- `NeutralToolCall {id, name, arguments}` — flat, and `arguments` stays a **raw string** so
  only the loop (which owns the malformed-JSON circuit) decides what unparseable args mean.
- `ReasoningCarrier {text, raw}` — `text` is human-readable CoT for `ctx.reasoningTrace`
  (audit only); `raw` is provider-opaque and the loop never reads it. The Responses transport
  parks the whole `response.output[]` there and echoes it back byte-for-byte next turn.
- `FinishSignal` — `"truncated"` is explicit because it is the one signal the loop must act
  on differently. A transport that fails to map its own spelling onto it (`finish_reason:
  "length"` / `status: "incomplete"`) turns a cut-off run into a silent green zero-pick run.
- `TransportCapabilities` — today just `forcedToolChoice`. The loop branches on capabilities,
  **never** on `transport.wire` (which exists for span attributes and routing tests only).

### Adding a third provider

1. Write `<name>Transport.ts` exporting `create<Name>Transport(...) => Transport`. It owns
   the request body, the retry ladder, the streaming parser, and every accommodation that
   provider needs. Nothing provider-specific may leak upward.
2. Render `ConversationItem[]` into that wire's shape and normalize the response back into
   `TurnResult`. The two things most likely to be got wrong, both silent: mapping the
   provider's truncation status onto `FinishSignal.truncated`, and reporting
   `NormalizedUsage.outputTokens` **inclusive** of reasoning tokens (never the sum of the two).
3. If it cannot express a forced `tool_choice`, set `capabilities.forcedToolChoice: false` —
   the loop then forces the terminal submit with a prompt instruction instead.
4. Add a branch to `resolveProvider()` in `src/loop/runV3Generation.ts` with its `keyEnv`.
   That function is the **only** place the model string is tested; re-testing it downstream is
   how a run gets routed to one wire while configured for the other.
5. Add a `MODEL_COSTS` entry (`runV3Generation.ts`) or the ledger's `estimated_cost_usd`
   silently falls back to the DeepSeek-pro rate.
6. Add fixture tests (see Testing) — a routing case plus parser cases. Do not test against
   the live API.

## Testing

`agents-v3` has **no vitest of its own by design** — the repo-root vitest is the single gate
for web and the worker together:

```bash
npx vitest run                       # from the worktree root — runs src/** and agents-v3/**
cd agents-v3 && npm run build        # tsc --noEmit; excludes **/*.test.ts
```

`vitest.config.ts` (root) includes `agents-v3/**/*.test.ts`; `agents-v3/tsconfig.json`
excludes `**/*.test.ts` because the worker has no `vitest` dependency to typecheck against.
Runtime resolution works because Node walks up to the root `node_modules`.

Synthetic SSE fixtures live in `src/loop/__fixtures__/sseStream.ts`:

- `sseStream(events, {chunkSize})` — **chunkSize defaults to 1 byte**, so every event is split
  across chunk boundaries by default. Pass `Infinity` for a single chunk.
- `rawStream(text)` for malformed wire text the typed builder can't express; `streamFromParts`
  to place a boundary at an exact offset (e.g. mid-escaped-quote inside a JSON argument).
- Chat Completions builders: `chatDelta`, `chatToolCallDelta`, `chatUsage`, `DONE`.
- Responses builders: `respEvent`, `respFunctionCallItem`, `respReasoningItem`,
  `respOutputItemAdded/Done`, `respArgsDelta/Done`, `respCompleted/Incomplete/Failed`,
  `respUsage`.

To add a case: build the event list, feed it to `consumeChatStreamV3` /
`consumeResponsesStream`, assert on the `TurnResult`. Run parser cases at several chunk sizes
(`it.each([1, 7, Infinity])`) — chunk-boundary bugs are the whole reason the default is 1.
For transport-level cases, stub `globalThis.fetch` with a scripted fake as
`responsesTransport.test.ts` and `transportRouting.test.ts` do. **Never call a live API from a
test** — there is no key in CI and requests cost money.

One locked-in asymmetry the tests pin: `consumeChatStreamV3` **drops** a trailing frame with
no terminating newline; `consumeResponsesStream` **flushes** it (on that wire the dropped
frame could be the only terminal event).

## Local

```bash
cp .env.example .env   # then fill in (see "Required Environment" below)
npm install
npm run build
npm run dev
```

`trigger.config.ts` lives in this directory, so the CLI must run from here — run
`npm run dev` from `agents-v3/`, not the worktree root (from the root the CLI
errors with "Couldn't find your trigger.config.ts file"). For convenience the
**root** `package.json` proxies it so you don't have to `cd`:

```bash
npm run trigger:dev      # from the worktree root → runs agents-v3's worker
npm run trigger:deploy   # from the worktree root → deploys to prod
```

The `trigger.dev` CLI is a pinned devDependency, so `npm run dev` / `npm run deploy`
resolve it from `node_modules` — no global install or `npx` needed. (Its npm bin
is `trigger`, which is what those scripts call.)

In Conductor, every new workspace is provisioned automatically (`.conductor/settings.toml`):
`scripts/conductor-setup.sh` copies your canonical `agents-v3/.env` (fill it in once
in the root checkout or `$WAGERPROOF_SECRETS_DIR`), and `scripts/conductor-deps.sh`
runs `npm install` here so `npm run dev` works out of the box. See `.conductor/README.md`.
`npm run dev`/`deploy` read `TRIGGER_SECRET_KEY` and the rest from this `.env`.

The Trigger.dev project ref is pinned in `trigger.config.ts`:
`proj_ughxoicacuqodceiwlus`.

## Required Environment

The task itself reads these at runtime (`src/runtimeHelpers.ts`,
`src/loop/runV3Generation.ts`, `src/shared/revenuecat.ts`):

- `OPENAI_API_KEY` — **primary since 2026-08-01.** The loop defaults to `gpt-5.6-luna` on
  `/v1/responses` at `reasoning.effort: "xhigh"` (see Transports above). Pin the full id —
  the bare `gpt-5.6` alias routes to Sol.
- `DEEPSEEK_API_KEY` — still needed; DeepSeek stays routable via the debug pickers and via
  the ledger `model_name`, and it is the fallback when OpenAI is down. `deepseek-reasoner` /
  `deepseek-chat` are retired aliases, and no reasoning param is ever sent to DeepSeek.
- optional `V3_REASONING_EFFORT` (`none|low|medium|high|xhigh|max`) — override the effort
  without redeploying the constant. This is also the lever if `xhigh` turns out to be
  unavailable on Luna: the Responses transport does **not** downgrade on a 400, it fails.
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `CFB_SUPABASE_URL`
- `CFB_SUPABASE_ANON_KEY`
- `REVENUECAT_SECRET_API_KEY`
- `REVENUECAT_ENTITLEMENT_IDENTIFIER`
- `V3_DAILY_SPEND_CAP_USD` (optional; defaults to `25`)

`trigger.config.ts` wires the `syncEnvVars` build extension to push these into
whatever environment you deploy to (`npm run deploy` → prod), reading them
from the CLI process env — which is loaded from this directory's `.env` by
default. So filling in `.env` and running `npm run deploy` is enough; you
don't need to hand-copy anything into the Trigger.dev dashboard.

`TRIGGER_SECRET_KEY` (in `.env`) is different — it's the CLI/deploy
credential Trigger.dev's own tooling uses to authenticate `npm run dev` /
`npm run deploy`, not a var the task reads, so it is intentionally excluded
from the sync list.

Set this in Supabase Edge Function secrets (read by both `trigger-v3-run` and
`trigger-run-status`):

- `TRIGGER_SECRET_KEY_PROD` — the **Production** environment secret key from
  the Trigger.dev dashboard (Project → API Keys). Deliberately a different
  name from the local `.env`'s `TRIGGER_SECRET_KEY` (a dev key) so the two
  can't be silently swapped for each other — the edge functions must always
  trigger against the deployed prod tasks, never a developer's local `trigger
  dev` session.

The Supabase runtime already supplies `SUPABASE_URL` and
`SUPABASE_SERVICE_ROLE_KEY`.

## Deployment Order

1. Apply `supabase/migrations/20260629180000_agent_generation_v3_triggerdev.sql`.
2. Set `TRIGGER_SECRET_KEY_PROD` in Supabase Edge Function secrets (one-time,
   or whenever the Trigger.dev prod key rotates).
3. Deploy the gateways: `supabase functions deploy trigger-v3-run` and
   `supabase functions deploy trigger-run-status`.
4. Deploy Trigger.dev tasks from this directory: `npm run deploy` (syncs env
   vars and deploys to prod).
5. In Trigger.dev, confirm `generate-v3-picks` and `daily-auto-gen-v3` are
   registered and the schedule is active for the `prod` environment.

## First live run (the Responses path is fixture-verified only)

Nothing in this repo has ever sent a request to `/v1/responses`. Everything above was built
and verified against synthetic fixtures. Before trusting it, do **one** real generation run
and check these, in this order — each has a distinct failure signature:

1. **The run returns 200 at all.** A 400 here is most likely `reasoning.effort: "xhigh"` not
   being available on `gpt-5.6-luna`. The Responses transport deliberately does **not**
   downgrade; set `V3_REASONING_EFFORT=high` (env var, no redeploy) if so.
2. **The synthetic slate seed is accepted.** Turn 1 sends a fabricated `function_call` with
   `call_id: "slate_0"` naming a `get_slate` tool that is not in `tools[]`. The serialization
   is fixture-asserted; whether OpenAI *accepts* it can only be settled live. If it 400s, the
   fix (moving the slate into user content) is a product change, not a transport change.
3. **Reasoning actually persists.** `agent_generation_runs.p_reasoning_trace` should be
   non-empty — the transport requests `reasoning.summary: "auto"` specifically so it stops
   being blank on OpenAI.
4. **The ledger numbers look sane.** `input_tokens` grows turn over turn (reasoning items are
   echoed), `output_tokens` is reasoning-inclusive, `estimated_cost_usd` is non-zero and
   overstated rather than zero. A `succeeded` row with 0 picks and $0 cost is the failure mode
   to hunt for, not evidence of a quiet slate.

## Client Flow

The native app calls `trigger-v3-run`, receives `{ ledger_run_id, run_id }`, then polls run
status **through the `trigger-run-status` edge proxy**, which authenticates with the
`TRIGGER_SECRET_KEY_PROD` secret server-side (`WagerproofKit/.../TriggerRunStatusService.swift`).

Do **not** call `api.trigger.dev` directly from a client. Hand-rolled public-access-token
JWTs are rejected with 401 — that bug is what the proxy exists to work around.

The returned `metadata` drives `LiveAgentRunView`. Picks still write to
`avatar_picks`, so existing grading and snapshot reads continue to work.
