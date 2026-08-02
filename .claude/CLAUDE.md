# WagerProof - Claude Context File

> Last verified against code: 2026-07-25, with the AI-model, generation-engine, and
> chat/voice/Roast sections re-verified 2026-08-01 (the gpt-5.6-luna migration, then the
> V3 loop's port to the Responses API later the same day). Route,
> flag, and file-path claims below were checked against `src/App.tsx`,
> `supabase/functions/`, and the native app trees on those dates.
> **Start at "Model inventory" for anything LLM-related.**

## Project Overview

WagerProof is a professional-grade sports betting analytics and predictions platform that provides data-driven insights for sports bettors. The app delivers predictive models, betting line analysis, live scoring, and AI-powered analysis across multiple sports leagues.

## Core Value Proposition

- Data-driven sports betting predictions using machine learning models
- Model-generated probabilities for betting outcomes (spread, moneyline, totals)
- Line movement and public betting sentiment analysis
- AI agent picks and community insights
- Multi-sport coverage: NFL, College Football (CFB), NBA, College Basketball (NCAAB), MLB

## The Four Codebases — READ THIS FIRST

There are four app codebases in this repo. Three ship; one is being phased out. Work on the
wrong one is wasted work, so confirm your target before starting.

| Codebase | Status | Stack | Ships via |
|---|---|---|---|
| `src/` | **SHIPPING** — web | React 18.3 + Vite | Netlify → wagerproof.bet |
| `wagerproof-ios-native/` | **SHIPPING** — iOS (3.5.9) | SwiftUI | Xcode Cloud on push to `main` |
| `wagerproof-android-native/` | **SHIPPING** — Android (versionCode 49) | Kotlin / Compose | `.github/workflows/android-native.yml` → Play |
| `wagerproof-mobile/` | **DEPRECATED — phasing out** | React Native + Expo | nothing; no CI path |

### `wagerproof-mobile/` is deprecated

The React Native app is being retired in favor of the two native apps. It is frozen as a
release target — `app.json` still declares version 3.5.6 / buildNumber 40 and has not been
touched since 2026-06-09, while iOS shipped 3.5.9 and Android moved to versionCode 49. It
claims the same bundle id (`com.wagerproof.mobile`) as the native apps, so it *cannot* ship
alongside them.

**Do not add new features to `wagerproof-mobile/`.** New mobile work goes to
`wagerproof-ios-native/` and `wagerproof-android-native/`. Touch the RN tree only for
bug fixes that matter to users still on an old build, or for deletions as the phase-out
proceeds. It already lags badly: 21-step v1 onboarding vs iOS's 25-step v2, RevenueCat's
stock paywall vs the custom SwiftUI one, and no Parlay God or Systems implementation at all.

The RN app is also the **only remaining caller of the V2 agent-generation engine**
(`wagerproof-mobile/services/agentPicksService.ts`). When it goes, V1 and V2 can go with it.

## Tech Stack

### Web (`src/`)
- **Framework**: React 18.3 + Vite
- **Styling**: Tailwind CSS, shadcn-ui components
- **Routing**: React Router DOM v6
- **State**: React Query (TanStack Query), React Context
- **UI**: Radix UI primitives, Recharts for visualization

### iOS native (`wagerproof-ios-native/`)
- **Framework**: SwiftUI, iOS 26+ (Liquid Glass design language)
- **Shared code**: `WagerproofKit/` SPM package — Models, Services, Stores, Design, SharedKit
- **Project file**: `project.yml` is the source of truth. The `.pbxproj` is GENERATED —
  run `xcodegen generate` after adding files; never hand-edit or `git checkout` the pbxproj.

### Android native (`wagerproof-android-native/`)
- **Framework**: Kotlin + Jetpack Compose
- **Structure**: `core/` (models, services, stores, design) + `features/`
- **Parity tracking**: `wagerproof-android-native/docs/PARITY.md`

### Backend & Services
- **Database**: Supabase (PostgreSQL) — two instances, see Data Architecture below
- **Auth**: Supabase Authentication + Google Sign-In
- **Subscriptions**: RevenueCat
- **Payments**: Stripe
- **Analytics**: Mixpanel
- **Agent pick generation**: Trigger.dev worker in `agents-v3/`
- **MCP connector**: `wagerproof-mcp/` (Cloudflare Worker) + `wagerproof-tool-core/`

## Project Structure

### Web App (`/src`)
```
src/
├── pages/              # Route pages (Agents.tsx, Scoreboard.tsx, admin/, support/)
├── features/           # Split-view feature modules — each has its own README
│   ├── games/          # Unified /games split view (all 5 sports)
│   │   ├── api/        # Per-sport data adapters (fetch+merge, ex-page logic)
│   │   ├── hooks/      # useGamesFeed, useGamesUrlState...
│   │   ├── components/ # Feed panel, sport picker, game list cards
│   │   └── detail/     # Detail pane + per-sport widget sections
│   ├── analysis/       # /historical-trends workbench + saved Systems
│   ├── trendsToday/    # /todays-trends
│   ├── mlbTools/       # /mlb/f5-splits, /mlb/pitcher-matchups, regression report
│   ├── outliers/       # Outliers board
│   └── parlayGod/      # Parlay God engine surfaces
├── components/         # React components
│   ├── ui/            # shadcn-ui primitives
│   ├── ios/           # iOS-style primitives (GlassCard, FilterPill, shimmer...)
│   ├── layout/        # SplitViewLayout (master/detail shell)
│   ├── agents/        # Agent components (+ split/ for the split view)
│   └── PolymarketWidget, etc.
├── api/               # API route helpers
├── data/              # Static/mock data sets
├── services/          # API clients
├── contexts/          # React Context (Auth, Theme, RevenueCat)
├── hooks/             # Custom React hooks
├── integrations/      # Supabase clients (main + college-football)
├── utils/             # Helper functions
├── types/             # TypeScript interfaces
└── __tests__/         # Vitest tests
```

### iOS native (`/wagerproof-ios-native`)
```
wagerproof-ios-native/
├── Wagerproof/
│   ├── Features/          # Games, Agents, Outliers, Props, Search, Onboarding, Paywall...
│   └── Info.plist         # version strings
├── WagerproofKit/         # SPM package: Models, Services, Stores, Design, SharedKit
├── WagerProofWidgetExtension/  # TopOutliersWidget, AgentMonitorWidget
├── ci_scripts/            # Xcode Cloud hooks (ci_post_clone.sh runs xcodegen)
└── project.yml            # XcodeGen source of truth
```

## Key Features

### 1. Game Predictions (`/games`)
- Machine learning models generate win/spread/total probabilities
- Compare model odds vs Vegas lines to find value
- Weather data integration for outdoor games
- ONE unified iOS-style split-view page for all 5 sports (`/games?sport=nfl|cfb|nba|ncaab|mlb&game=<id>`): left = feed list (sport picker, search, sort), right = detail pane (per-sport widget sections in `src/features/games/detail/sections/`)
- Legacy routes `/nfl`, `/college-football`, `/nba`, `/ncaab`, `/mlb` redirect into `/games`
- The per-game MLB tools (`/mlb/f5-splits`, `/mlb/pitcher-matchups`) are themselves split views under `src/features/mlbTools/` — see that folder's README

### 2. Historical Trends (`/historical-trends`) and Today's Trends (`/todays-trends`)
- `/historical-trends` — the trends workbench (`src/features/analysis/`): filter taxonomy, as-of aggregation, saved "Systems" with a leaderboard
- `/todays-trends` — today's slate through the same filter engine (`src/features/trendsToday/`)
- The old per-sport analytics routes (`/nfl-analytics`, `/cfb-analytics`, `/mlb-analytics`) and per-sport betting-trends pages now redirect here via `LegacyTrendsRedirect` / `LegacyTodaysTrendsRedirect`
- **Documentation**: `.claude/docs/trends-systems/`

### 3. Live Scores (`/scoreboard`)
- Real-time game updates via ESPN/Sports API
- Live score tracking with prediction overlays

### 4. Editor's Picks (Retired)
- Human-curated picks with a win/loss stats dashboard, previously at `/editors-picks`.
- **Retired** — replaced functionally by AI Agents (§6), which track performance the same way (W-L-P, +/- units) but are AI-generated and user-configurable.
- Removed from the web route/nav and from the iOS native app's side menu. `EditorsPicks.tsx` and `ValueFindsSection.tsx` remain on disk on web as dead code (not yet deleted); iOS native's equivalent files were deleted outright. The RN app still routes a `picks.tsx` tab — it dies with the RN phase-out.
- **Still live, do not delete**: `EditorPickCard.tsx` (used by the routed `/free-picks` page) and `ValueFindEditorCard.tsx` (used by the admin-only `AIValueFindsPreview` on `/admin/ai-settings`).
- The `editors_picks` Supabase table remains queryable for historical purposes. Its
  `get_editor_picks` chat tool belongs to WagerBot, which is itself retired (§5).

### 5. WagerBot chat, WagerBot voice, and Roast (DEPRECATED 2026-08-01)
- **All three AI-conversation surfaces are RETIRED.** They were annotated
  `DEPRECATED 2026-08-01` in code on that date, deliberately **NOT** migrated to
  `gpt-5.6-luna`, and are frozen on whatever model they run today until they are
  deleted. Do not build on them, do not extend the tool registries, do not
  "modernize" their models.
- Nothing was deleted and **no UI entry point was removed** — the native apps still
  route to chat/voice. Hiding those entry points is an outstanding owner action
  (see "Outstanding manual work" below).
- What is annotated:
  - `supabase/functions/wagerbot-chat/` (`index.ts`, `agent.ts`) — the live chat
    loop: OpenAI Responses API, **gpt-4o** (thread auto-titling uses gpt-4o-mini)
  - `supabase/functions/wagerbot-agent/` (all files + its README) — the parallel
    multi-provider fork (OpenAI + DeepSeek, Chat Completions), default gpt-4o
  - `supabase/functions/create-wagerbot-voice-session/` — GA Realtime ephemeral-key
    minter, `gpt-realtime` / `gpt-realtime-mini`
  - `supabase/functions/get-gemini-key/` — Roast. **Security note recorded in its
    header**: it returns the raw `GOOGLE_AI_API_KEY` to any authenticated caller,
    and its only consumer (Roast) was never built (the iOS driver is a no-op stub).
    Revoking/rotating that key and deleting the function is an outstanding action.
  - Native model pickers: `WagerproofKit/.../WagerBotModelSelection.swift`,
    `core/services/.../WagerBotModelSelection.kt`
- **Never had a web UI.** `/wagerbot-chat` redirects to `/account`;
  `src/pages/WagerBotChat.tsx` is unrouted dead code.
- **Documentation**: `.claude/docs/02_chat_wagerbot.md` (also carries the retirement banner)

### 6. AI Agents
- **Premium Feature**: Free users get 1 active agent; Pro users can create up to 30 AI-powered "Virtual Picks Experts" with up to 10 active at once; admins are unlimited
- Personalized betting agents with 50+ tunable parameters
- On-demand pick generation based on agent personality; automated performance tracking (W-L-P, +/- units); public leaderboard for shared agents
- Web: `/agents` is an iOS-style split view (left: My Agents / Leaderboard + filter pills; right: unified detail pane in `src/components/agents/split/`). Legacy `/agents/:id` + `/agents/public/:id` redirect to `/agents?selected=<id>`; Create/Settings remain separate pages
- **Generation engine**: see the next section — this is the most confusing part of the codebase
- **Documentation**: `.claude/docs/agents/` — but note the accuracy warnings there

### 7. Parlay God
- 100%-streak parlay engine, Pro-gated, multi-sport (MLB + NFL team legs)
- Surfaces: Outliers rail, Search, Props Cheats, MLB/NFL matchup widgets
- **Documentation**: `.claude/docs/16_parlay_god.md`. iOS only — no Android or RN port yet.

### 8. Widget Headline Summaries
- One bold plain-language sentence at the top of each game-detail widget, answering
  that card's question ("Model lays points with DEN -4.5 — its own line is -8.2")
- **Deterministic**, computed client-side by pure formatters in
  `src/features/games/detail/headlines/`. Each takes values the component has
  ALREADY derived and rendered, so a headline cannot contradict the numbers under
  it. Returns `string | null`; `null` = no headline, which is a normal outcome
- **The LLM pipeline is DEPRECATED** — a writer LLM → gate → LLM judge job
  (`daily-widget-summaries` in `agents-v3/`) writing `ai_completions.headline_text`.
  It kept getting side attribution backwards (calling a −3.3 home edge "+3.3 for
  the home team"), which QC did not reliably catch.
  `agents-v3/trigger/dailyWidgetSummaries.ts` and `agents-v3/src/summaries/runDailySummaries.ts`
  now carry a `DEPRECATED 2026-08-01` header. **The schedule lives in code
  (`dailyWidgetSummaries.ts:32`, `0 11 * * *` ET) and a comment does not stop it** — it is
  still firing daily and writing an output with zero readers repo-wide. Disabling it is a
  Trigger.dev dashboard action the owner must still do. Do not build on any of it
- **No LLM read remains.** `getGameHeadlines()` and the `headlines` prop are
  deleted; `useAiCompletions` fetches completion bodies only. The only repo-wide hits on
  `ai_completions.headline_text` are the writer, the column DDL, and prose
- **NFL has no model fair line.** `nfl_predictions_epa` is a CLASSIFIER (cover /
  OU probabilities only) with no `model_fair_*` or `pred_*_score` columns, so
  `home_spread_diff` / `over_line_diff` are permanently null for NFL and its
  headlines quote confidence rather than a model-vs-Vegas gap. Do NOT try to fix
  this by widening the `.select()` in `api/nflGames.ts` — the columns don't exist
- **Web only.** Neither native app renders headlines
- **Documentation**: `.claude/docs/17_widget_headlines.md`, and
  `src/features/games/detail/headlines/README.md` for how to add one

### 9. Agent Consensus on game cards
- A row on each `/games` feed card showing what the public AI agents bet, plus a
  green **BET** flag on the rare games where they strongly agree
- The flag keys off AGREEMENT, not participation: "any agent bet this" fires on
  96% of a slate because agents bet nearly everything. The calibrated rule
  (`≥max(8, 8% of the day) on one side AND ≥55% agreement`) fires on ~21%
- Served by the `get_game_agent_consensus` RPC — **SECURITY DEFINER**, because
  `avatar_picks` is RLS-gated and the anon key sees ZERO rows. Picks live in MAIN
  and the feed in CFB, so there is no SQL join: clients merge by `game_id` lookup,
  and it must be a LEFT join (picks exist before predictions populate)
- **Shipped on web, iOS, and Android.** MLB is the only sport exercising it today (others offseason).
  The feed-card strip is on all three; the game-detail widget is web + iOS only;
  the Outliers matchup-tile row is web only
- **Documentation**: `.claude/docs/18_agent_consensus.md`

### 10. MCP Connector (`/connect-ai`)
- Public read-only MCP server (`wagerproof-mcp/`, Cloudflare Worker) sharing tool logic with `wagerproof-tool-core/`
- Users connect it from `/connect-ai` on web or Settings in iOS native
- Deployed at a `*.workers.dev` subdomain (the `mcp.wagerproof.bet` custom domain is not yet live)
- Consent page offers **Google, Apple, and email** sign-in (`GOOGLE_ENABLED` /
  `APPLE_ENABLED` / `EMAIL_ENABLED` vars). Copy is deliberately provider-neutral
  ("your AI provider"), never "Claude" — the connector also serves ChatGPT et al.
- **Apple web sign-in needs a client-secret JWT that expires every 6 months** and
  fails silently because native iOS Apple sign-in uses a different mechanism with
  no secret. Symptom: `Unable to exchange external code`. See the
  `apple-web-signin-secret` skill and `.claude/docs/06_auth_seo_deploy.md`
- The Supabase redirect allowlist glob-matches the WHOLE `redirect_to` and falls
  back to Site URL on mismatch, so the consent page keeps its `ls` handle in
  localStorage, not a query param — don't "tidy" it back into the URL

### 10. Meta Attribution
- Acquisition funnel reported to Meta Ads: install, CompleteRegistration, ViewContent
  (paywall), InitiateCheckout, StartTrial/Subscribe — on iOS native and web
- iOS fires through `MetaAnalyticsService` + `PaywallConversionTracker` (never inline in a
  paywall view — the tracker dedupes by order id and covers all 8 paywall surfaces)
- Web uses the browser pixel (`src/lib/metaPixel.ts`) for top-of-funnel only
- **`Subscribe`/`StartTrial` are sent server-side by RevenueCat's Facebook integration.
  This repo sends NO purchase conversion to Meta from the webhook or the browser — a second
  sender has no shared `event_id` and would double-count every subscription**
- **Documentation**: `.claude/docs/18_meta_attribution.md`

### Disabled / flagged-off surfaces
These exist in code but are switched off. Do not describe them as features:
- **Bet Slip Grader** (`/bet-slip-grader`) — `ENABLE_BET_SLIP_GRADER = false` (`src/App.tsx:78`), renders `<AccessDenied />`
- **Community Voting** (`/community-voting`) — `ENABLE_COMMUNITY_PICKS = false` (`src/App.tsx:77`), renders `<AccessDenied />`
- **Teaser Sharpness Tool** — no route, no page. Only a `LearnTeaserTool` lesson inside `src/pages/LearnWagerProof.tsx`.
- **WagerBot chat, WagerBot voice, Roast** — retired 2026-08-01 (§5). Code is annotated but
  still deployed, and the native UI entry points are **still visible**. Treat as
  deprecated-in-progress, not as a shipping feature.

## Model inventory (as of 2026-08-01)

Which surface calls which model. This table is the artifact that stops the next person
re-deriving it from twelve edge functions.

| Surface | File | Model | API / params | Status |
|---|---|---|---|---|
| **Agent pick generation (V3, canonical)** | `agents-v3/src/loop/{runV3Generation,responsesTransport}.ts` | `gpt-5.6-luna` | **Responses API** (`/v1/responses`), `reasoning: {effort: xhigh, summary: auto, context: all_turns}`, `store:false` + `include:["reasoning.encrypted_content"]`, `max_output_tokens`, no `temperature` | **LIVE — migrated; Responses path is FIXTURE-VERIFIED ONLY, no live call yet** |
| Agent pick generation — DeepSeek fallback | `agents-v3/src/loop/chatCompletionsTransport.ts` | `deepseek-v4-flash` / `-pro` | Chat Completions, `max_tokens`, `tool_choice:"auto"` only, `reasoning_content` passed back, **no reasoning param** | **LIVE — deliberately retained fallback** |
| Agent generation SQL defaults | `20260801120000_retire_deepseek_hotfix_default_luna.sql` | `gpt-5.6-luna` | `model_name` COALESCE + insert trigger remap | **LIVE — migrated** |
| NL filter patch (`/historical-trends` natural language) | `supabase/functions/nl-filter-patch/index.ts` | `gpt-5.6-luna` | Chat Completions, **default effort (medium)**, `max_completion_tokens: 4000`, strict `json_schema`, **no `temperature`** | **LIVE — migrated** |
| Page-level analysis / Value Finds | `supabase/functions/generate-page-level-analysis/index.ts` | `gpt-5.6-luna` | Chat Completions, default effort, strict `json_schema`, no max-tokens param, no `temperature` | **LIVE — migrated** |
| Game widget AI completions | `supabase/functions/generate-ai-completion/index.ts` | `gpt-4o-mini` | Responses API + `web_search_preview` tool | **GATED — not migrated** |
| Today in Sports completion | `supabase/functions/generate-today-in-sports-completion/index.ts` | `gpt-4o` | Responses API + `web_search_preview` tool | **GATED — not migrated** |
| Backfill of missing completions | `supabase/functions/check-missing-completions/index.ts` | — | Sends no `model`; inherits from the two functions above | inherits |
| WagerBot chat | `supabase/functions/wagerbot-chat/` | `gpt-4o` (titles `gpt-4o-mini`) | Responses API | **DEPRECATED + FROZEN** |
| WagerBot agent (multi-provider fork) | `supabase/functions/wagerbot-agent/` | `gpt-4o` default; DeepSeek `v4-flash`/`v4-pro` selectable | Chat Completions | **DEPRECATED + FROZEN** |
| WagerBot voice | `supabase/functions/create-wagerbot-voice-session/` | `gpt-realtime` / `gpt-realtime-mini` | GA Realtime client secrets | **DEPRECATED + FROZEN** |
| Roast | `supabase/functions/get-gemini-key/` | Google (`GOOGLE_AI_API_KEY`) | key handed to client | **DEPRECATED + FROZEN; never built; key should be revoked** |
| Widget headline writer/judge | `agents-v3/src/summaries/`, `trigger/dailyWidgetSummaries.ts` | unchanged | — | **DEPRECATED; schedule still firing** |
| Legacy generation V1 / V2 / edge-V3 | `supabase/functions/{generate-avatar-picks,auto-generate-avatar-picks,process-agent-generation-job-v2,process-agent-generation-job-v3,request-avatar-picks-generation-v2}/` | unchanged (V2 uses `gpt-5-mini`) | — | **DEPRECATED; annotated only, still deployed & cron-referenced** |

Rules that fall out of this:
- **Never send `temperature` to `gpt-5.6-luna`** — GPT-5-series reasoning models reject it.
  (Contract lists this as *inferred*, so it is guarded by omission rather than assumed.)
- `max_tokens` is rejected; use `max_completion_tokens` (Chat Completions) or
  `max_output_tokens` (Responses).
- A reasoning effort is sent on **exactly one** surface (V3 generation, as
  `reasoning.effort` on Responses). Everything else takes the API default.
- The bare `gpt-5.6` alias routes to **Sol**, not Luna. Always pin the full id.

### Why the two web-search functions were NOT migrated (gated, 2026-08-01)
`generate-ai-completion` and `generate-today-in-sports-completion` both pass
`{ type: 'web_search_preview' }` as their only tool, and both prompts are built around live
web grounding. `web_search_preview` is a legacy tool that GPT-5-series models are reported to
reject; Luna's model page lists `web_search` instead. Migrating would have produced either a
hard 400 or — worse — an ungrounded model quietly answering from a Feb 2026 knowledge cutoff.
Swapping the tool type at the same time would have stacked a second unverified change on the
first. **To unblock:** one throwaway `/v1/responses` request with `model: "gpt-5.6-luna"` and
`tools: [{ type: "web_search" }]`. If it returns 200, both functions move to Luna **and**
change `web_search_preview` → `web_search` in the same edit — the two changes are inseparable.

### Things to watch on the first deploy after this migration
- Strict structured outputs (`json_schema` + `strict: true`) on Luna is high-confidence but
  not literally documented. `nl-filter-patch` and `generate-page-level-analysis` both rely on
  it; a 400 on `response_format` is the tell. Schemas were preserved byte-for-byte rather than
  defensively loosened, so the failure is clean, not silent.
- `nl-filter-patch` **lost `temperature: 0`**, its only determinism lever. Identical sentences
  can now yield different-but-both-valid patches. Client-side re-validation still blocks an
  invalid op, so this is a consistency regression, not a correctness one. It also now runs at
  medium reasoning effort on a user-blocking, keystroke-adjacent path — if latency is bad, the
  fix is `reasoning_effort: "low"`/`"none"`, **not** reintroducing `temperature`.

## Agent Pick Generation — which engine actually runs

Four generations of the engine exist in the repo. Get this right before touching generation code.

| Engine | Location | Status |
|---|---|---|
| **V3 / Trigger.dev** | `agents-v3/trigger/generateV3Picks.ts` (task `generate-v3-picks`) | **CANONICAL** — what web + iOS native call |
| V3 edge mirror | `supabase/functions/process-agent-generation-job-v3/` | DEPRECATED 2026-08-01 (annotated, not deleted). Diverged fork of `agents-v3/src/loop/`. **It is NOT unreferenced** — see the prod-verification note below |
| V2 queue | `process-agent-generation-job-v2` + `request-avatar-picks-generation-v2` | DEPRECATED 2026-08-01. Reachable from the deprecated RN app AND live from `agent-authorized-action-v1` |
| V1 | `generate-avatar-picks/` + `auto-generate-avatar-picks/` | DEPRECATED 2026-08-01. Only a test script calls it. **Exception:** that directory's `pickSchema.ts` and `promptBuilder.ts` are still load-bearing for `shared/agentGameHelpers.ts` and the edge-V3 mirror, so they are deliberately unannotated — do not move or gut them |

- Web entry: `src/services/agentPicksService.ts` → edge fn `trigger-v3-run` → Trigger.dev
- iOS entry: `WagerproofKit/Sources/WagerproofServices/AgentPicksService.swift`
- Run status is polled through the `trigger-run-status` edge proxy (uses the SECRET key).
  Do NOT fetch `api.trigger.dev` directly from a client — hand-rolled public tokens 401.
- `agents-v3` must run `runtime: "node-22"` in `trigger.config.ts` — supabase-js ≥2.108 throws
  at `createClient` on Node 21 and this took prod down once.
- **Default model is OpenAI `gpt-5.6-luna` at `reasoning_effort: "xhigh"`** (migrated
  2026-08-01). Pick quality is the one surface that buys the extra thinking. Pin the
  FULL id — the bare `gpt-5.6` alias routes to Sol, not Luna.
  - Set in three code constants (`agents-v3/src/loop/runV3Generation.ts`,
    `trigger/dailyAutoGenV3.ts`, `trigger/weeklyParlayAutoGenV3.ts`) — but the
    **ledger `agent_generation_runs.model_name` wins over all of them**.
  - `V3_REASONING_EFFORT` env var overrides the effort without a redeploy (valid:
    `none|low|medium|high|xhigh|max`). Luna's xhigh is reported to benchmark roughly
    flat vs `high` while costing materially more output tokens — an A/B is worth it.
  - **The loop speaks two wires.** `resolveProvider()` (`src/loop/runV3Generation.ts`) is the
    single routing decision: `deepseek*` → `/v1/chat/completions`, everything else →
    `/v1/responses`. See `agents-v3/README.md` → "Transports" and
    `.claude/docs/agents/18_GENERATION_V3_TRIGGERDEV.md`.
  - **RESOLVED (2026-08-01): the "xhigh may be unreachable" concern was a Chat Completions
    limitation, and the loop no longer uses that wire for OpenAI.** The gpt-5.6 upgrade guide
    said function tools on `/v1/chat/completions` may only be compatible with effective
    reasoning `none`; the port to `/v1/responses` was done for that reason **and** for
    reasoning persistence across tool turns, which Chat Completions discards every turn.
    The Chat transport keeps its "400 mentioning reasoning → downgrade to `none` and re-run
    the turn once" guard, but only DeepSeek reaches that code now, and DeepSeek is never sent
    a reasoning param.
  - **`xhigh` on Luna is still unconfirmed against the live API, and there is deliberately no
    code-side fallback on the Responses path** — a 400 there is a defect or an unsupported
    enum and must surface rather than silently buy the port's benefit back out. If it fires,
    every OpenAI run fails retryably until `V3_REASONING_EFFORT=high` is set (env var, no
    redeploy).
  - No reasoning param is ever sent to DeepSeek (it rejects unknown body keys), and DeepSeek
    gets `max_tokens` while OpenAI gets `max_output_tokens`.
  - **The whole Responses path is fixture-verified only — no request has ever been sent to
    `api.openai.com` from this code.** One real dryRun generation is required before trusting
    it; `agents-v3/README.md` → "First live run" lists exactly what to check.
- **The 2026-07-25 DeepSeek-balance hotfix trigger is KEPT, retargeted at Luna.**
  `trg_hotfix_remap_deepseek_model_on_insert` on `agent_generation_runs` now rewrites
  NULL and `deepseek%` `model_name` to `gpt-5.6-luna` (was `gpt-4.1-mini`). It must not
  be dropped: **both shipping native apps always send an explicit `deepseek-v4-flash`**
  (`AgentDetailStore.swift:550` / `AgentDetailStore.kt:514`, defaulting to
  `AgentV3SettingsStore.models[0]`), so without the trigger iOS and Android would go
  back to the DeepSeek account whose 402 Insufficient Balance caused the 2026-07-25
  outage. Web sends no model and picks up the RPC default. Migration:
  `supabase/migrations/20260801120000_retire_deepseek_hotfix_default_luna.sql`, which
  also repoints `enqueue_manual_generation_run_v3_trigger` /
  `enqueue_weekly_parlay_run_v3_trigger` COALESCE defaults to `gpt-5.6-luna`. The
  older non-`_trigger` RPCs still default to `deepseek-v4-flash` and rely on the
  trigger for coverage.
- The `deepseek-reasoner`/`-chat` aliases are retired. **DeepSeek is deliberately retained**
  as the fallback provider (a DeepSeek 402 caused the 2026-07-25 outage; removing the
  fallback was explicitly out of scope) and is still routable via the debug pickers as
  `deepseek-v4-flash` / `-pro`. It keeps its own transport on Chat Completions, so deleting
  DeepSeek later means deleting `chatCompletionsTransport.ts` and one branch of
  `resolveProvider` — nothing else. Note `src/summaries/runDailySummaries.ts` (the deprecated
  widget-headline job) still has its own independent provider split that does not use the seam.
- Legacy generation paths (V1, V2, the edge-V3 mirror) were annotated
  `DEPRECATED 2026-08-01` and left on their existing models. **Nothing was deleted and no
  cron expression was changed** — see the prod-verification items below.
- Migration history is out of sync with prod: `select_due_auto_avatars_v3_trigger` is called
  by `dailyAutoGenV3.ts` but exists in no migration file.

#### Prod cron state is UNVERIFIED — verify before retiring anything

A 2026-08-01 audit of migration history found the "legacy is dead" premise is **false on
paper**. Nothing was deleted or unscheduled in that pass; these are open questions for the
owner to answer against prod `cron.job` and `agent_generation_runs`:

- `v3-dispatch-workers` (`20260609000000_agent_generation_v3_engine.sql:486`) is scheduled
  **every minute** and pg_net POSTs `process-agent-generation-job-v3` (`:316`). No later
  migration disables it, and `:496` even schedules `v3-circuit-daily-reset` to re-arm its
  breaker. So the edge-V3 mirror is *referenced*, not orphaned.
- `v2-enqueue-auto-generation` (`20260416193000...:19`, `*/10`) is still active → calls
  `enqueue-auto-generation-runs-v3` → RPC `enqueue_due_auto_generation_runs_v2`, which since
  `20260706120000_auto_generation_all_v3.sql:60` stamps **every** auto run
  `engine_version='v3'` — the rows only the edge mirror claims.
- Meanwhile `agents-v3/trigger/dailyAutoGenV3.ts:21` runs its own `*/10` schedule producing
  `engine_version='v3_trigger'`. **The two paths do not dedupe against each other** (SQL
  relies on `ON CONFLICT` over the legacy run identity, Trigger.dev on its own idempotency
  keys). Auto-generation may be double-firing. Check the `engine_version` split.
- `v2-dispatch-workers` (`20260303000003...:66`, every minute) is scheduled and never
  disabled; `agent-authorized-action-v1/index.ts:188,:208` also routes `request_generation`
  into V2/edge-V3 live. That function is **live and cannot be deprecated as a file** — its
  `request_generation` branch (`:159-215`) needs a rewrite onto
  `enqueue_manual_generation_run_v3_trigger`, the way `trigger-v3-run/index.ts:101` does.
- `v2-recover-expired-leases` is **shared with V3** (`20260609000000...:480`) despite the
  `v2-` prefix. Do not retire it alongside V2.

## Outstanding manual work from the 2026-08-01 model migration

None of these can be done from the repo. Until they are done, the repo state and the prod
state disagree.

1. **Verify prod cron before retiring any legacy engine.** Query `cron.job` for
   `v3-dispatch-workers`, `v2-dispatch-workers`, `v2-enqueue-auto-generation`,
   `v3-circuit-daily-reset`, and the `engine_version` split (`'v3'` vs `'v3_trigger'`) in
   recent `agent_generation_runs`. Migration history says all of them are still active. No
   cron job, edge function, or DB object was deleted in this pass — deletion was explicitly
   out of scope.
2. **Do one live `generate-v3-picks` run on the `/v1/responses` path.** The whole transport
   port is fixture-verified only — no request has ever been sent to `api.openai.com` from
   this code. Confirm, in order: the run returns 200 at all (a 400 is most likely `xhigh`
   being unavailable on Luna → set `V3_REASONING_EFFORT=high`); the synthetic `slate_0` seed
   turn is accepted (it names a tool absent from `tools[]`); `p_reasoning_trace` is non-empty
   (the transport requests `reasoning.summary: "auto"` for exactly this); and the ledger shows
   growing `input_tokens` with a non-zero `estimated_cost_usd`. A `succeeded` row with 0 picks
   and $0 cost is the failure mode to hunt for. Details: `agents-v3/README.md` →
   "First live run".
3. **Disable the `daily-widget-summaries` Trigger.dev schedule** in the Trigger.dev
   dashboard. Its schedule is declared in code, so the deprecation header does not stop it
   from running daily against an output nothing reads.
4. **Revoke / rotate `GOOGLE_AI_API_KEY` and delete `get-gemini-key`.** The function hands
   the raw key to any authenticated caller and its only consumer (Roast) was never built.
5. **Hide the WagerBot chat and voice UI entry points** in the iOS and Android apps. The
   backend is annotated deprecated but the native navigation still reaches it.
6. **Watch the first prod runs** for 400s on `response_format`/`strict` from
   `nl-filter-patch` and `generate-page-level-analysis` (both still on Chat Completions).
   The old `rejected reasoning_effort` watch item no longer applies to V3 generation — that
   downgrade guard now only exists on the DeepSeek transport, which is never sent the param.
7. **A/B `xhigh` vs `high` on Luna** before leaving xhigh on — reported benchmarks are
   roughly flat while output-token cost is materially higher. `V3_REASONING_EFFORT=high`
   flips it with no redeploy.
8. **Unblock the two web-search functions** with the single throwaway `/v1/responses` +
   `web_search` request described above.
9. **Rewrite `agent-authorized-action-v1`'s `request_generation` branch** onto
   `enqueue_manual_generation_run_v3_trigger`. It is a live function whose generation branch
   still routes exclusively into deprecated engines.

## Data Sources & APIs

### Sports Data
- **Predictions Database**: Supabase tables with model-generated predictions
- **Live Scores**: `liveScoresService.ts` - ESPN/Sports API integration
- **Weather**: Weather service for game conditions

### Betting Data
- **The Odds API** (`theOddsApi.ts`): Real-time odds from US sportsbooks
- **Polymarket** (`polymarketService.ts`): Blockchain prediction market odds
- **Public Betting Splits**: Money/percentage on each side

### AI Services
- **AI Completions** (`aiCompletionService.ts`): Game analysis and insights
- **Value Finds**: AI-identified high-value betting opportunities (admin-only surface)

## Key Service Files

| File | Purpose |
|------|---------|
| `src/services/polymarketService.ts` | Polymarket API integration |
| `src/services/liveScoresService.ts` | Live game scores |
| `src/services/theOddsApi.ts` | Sportsbook odds and betslip links |
| `src/services/aiCompletionService.ts` | AI-generated analysis |
| `src/services/agentPicksService.ts` | Agent pick generation (V3 entry point) |
| `src/integrations/supabase/client.ts` | Main Supabase client |
| `src/integrations/supabase/college-football-client.ts` | CFB Supabase client (all sports predictions) |

## Data Architecture

### Supabase Instances
- **Main** (`gnjrklxotmbvnxbnnqgq`): Auth, user data, agents, AI completions, Polymarket cache
- **CFB** (`jpxnjuwglavsjbgbasnl`): ALL sports predictions data (NFL, CFB, NBA, NCAAB, MLB)
- Edge functions reach sports data via the `CFB_SUPABASE_URL` secret; the web app uses
  `VITE_CFB_SUPABASE_URL`. **Both must be set or the app cannot load predictions.**

### Data Tables by Sport
| Sport | Input Table | Predictions Table |
|-------|-------------|-------------------|
| NFL | `v_input_values_with_epa` | `nfl_predictions_epa` |
| CFB | `cfb_live_weekly_inputs` | `cfb_api_predictions` |
| NBA | `nba_input_values_view` | `nba_predictions` |
| NCAAB | `v_cbb_input_values` | `ncaab_predictions` |
| MLB | Statcast pregame tables | `mlb_training_snapshots` + model predictions |

### Data Availability (matters for AI Agents)
- **NFL/CFB**: Model predictions, weather, public betting labels — NO team ratings, NO trends
- **NBA**: Richest data — team ratings, L3/L5 trends, streaks, ATS%, luck, consistency
- **NCAAB**: Team ratings, rankings, context flags — NO trends, NO streaks
- **MLB**: Rich — Statcast pregame (SP, bullpen, batting), game signals, park factors, power ratings, situational trends, model predictions (ML, O/U, F5)

### SQL layout
SQL lives in `supabase/migrations/` (182 files) and `scripts/sql/`. **There is no
`supabase/sql/` directory** — older docs that reference one are wrong.

There are ~30 pg_cron jobs across the migrations (V2/V3 dispatch, 8 `grade-avatar-picks-*`
windows, 5 `refresh_mlb_*_daily`, `value-finds-scheduler-master`,
`update-polymarket-cache-hourly`, `reconcile-avatar-performance`). None are enumerated in
any doc — read the migrations.

## Authentication & Monetization

### Auth Flow
- Email/password via Supabase
- Google Sign-In (native on mobile)
- Onboarding guard before main app access
- Web OAuth redirects to `/agents` after sign-in

### Freemium Model
- **Free tier**: Limited predictions (`allowFreemium=true` on the route)
- **Pro/Premium**: Full access via RevenueCat subscriptions
- **Web RevenueCat is live** — `RevenueCatProvider` (`src/contexts/RevenueCatContext.tsx`) is
  mounted in `src/App.tsx`, and `src/services/revenuecatWeb.ts` drives offerings, the custom
  paywall (`src/components/paywall/CustomPaywall.tsx`), and entitlement checks
  (`useAccessControl`, `useAgentEntitlements`, `ProGate`). Its `rcb_` billing public keys are
  hardcoded in `revenuecatWeb.ts:21-22`, not read from env — don't "clean up" that path.
- iOS uses a custom SwiftUI paywall (`Features/Paywall/CustomPaywallView.swift`) gated by
  RevenueCat offering metadata flags (`custom_paywall_enabled`, `paywall_close_enabled`)
- **Documentation**: `.claude/docs/03_payments_billing.md`

## Deployment

- **Web**: Netlify (`netlify.toml`) → wagerproof.bet
- **iOS**: Xcode Cloud on push to `main`. The shared scheme MUST be declared in `project.yml`
  — regenerating without it means no TestFlight build. Version strings are hardcoded in
  several files; bump them together.
- **Android**: `.github/workflows/android-native.yml` → `:app:bundleRelease` → Play
- **Agent worker**: Trigger.dev prod (`agents-v3`), deployed with `npx trigger deploy`
- **Research crons**: `render.yaml` runs 6 cron services against `research/`

## Common Development Tasks

```bash
npm run dev          # web app
npm test             # vitest — covers BOTH src/**/*.test.ts and agents-v3/**/*.test.ts
cd agents-v3 && npm run dev     # Trigger.dev worker (CLI bin is `trigger`, not `trigger.dev`)
cd agents-v3 && npm run build   # tsc --noEmit for the worker (excludes **/*.test.ts)
xcodegen generate    # after adding iOS files, from wagerproof-ios-native/
```

`agents-v3` has **no vitest of its own by design** — the root config includes its tests so one
`npm test` is the single gate, and `agents-v3/tsconfig.json` excludes `**/*.test.ts` because
the worker has no `vitest` dependency to typecheck against. Synthetic SSE fixtures for the V3
transport parsers live in `agents-v3/src/loop/__fixtures__/sseStream.ts`; see
`agents-v3/README.md` → "Testing" for how to add a case. **Never call a live LLM API from a
test.**

## Notes for Development

- Game details open in bottom sheets (native) or split-view detail panes (web)
- Dark mode is fully supported via ThemeContext
- Most data fetching uses React Query with aggressive caching
- AI features require API keys and have admin controls
- Canonical unit math (Formula B) lives in `src/utils/unitsCalculation.ts` with 28 tests

## Documentation Accuracy Warnings

A freshness audit on 2026-07-25 found these docs materially wrong. Verify against code
before trusting them:

- `.claude/docs/00_CODEBASE_OVERVIEW.md` — says "two main applications"; there are four
- `.claude/docs/01_buildship_api.md` — mobile chat moved off BuildShip to an edge function
- `.claude/docs/04_sports_predictions.md` — names 8 deleted web files
- `.claude/docs/05_ui_design_theme.md` — predates `src/components/ios/` and `SplitViewLayout`
- `.claude/docs/08_database_caching.md` — documents a deleted hook; edge-fn list superseded by `11_`
- `.claude/docs/11_edge_functions.md` — verified March 2026; 13 of ~46 functions are undocumented (model ids + deprecation status refreshed 2026-08-01)
- `.claude/docs/agents/06_IMPLEMENTATION.md` — pre-V2 engine, and any model id in it is stale; see "Model inventory"
- `.claude/docs/agents/01_DATA_PAYLOADS.md`, `06_IMPLEMENTATION.md` — describe the pre-V2 engine
- `.claude/docs/agents/03_DATABASE_SCHEMA.md` — omits `agent_generation_runs`, `avatar_parlays`, prop columns
- `.claude/docs/agents/20_PIXEL_OFFICE_FULL_SPEC.md` + `21_` — **PROPOSAL, not built**
- `docs/` (root-level) — frozen ≤2026-06-22 and unmaintained. `.claude/docs/` is authoritative.
- `docs/wagerproof-migration/` — archive of the finished RN→SwiftUI port; paths in it are wrong

## Inline Code Comments

Write inline comments that help future developers (and AI agents) understand **why** code exists, not what it does. The code itself shows what — comments explain the reasoning, constraints, and non-obvious decisions.

### When to comment

- **Architecture decisions**: Why this approach was chosen over alternatives. E.g. `// PagerView instead of FlatList — native paging runs on UI thread, zero JS bridge work`
- **Non-obvious constraints**: Business rules, platform quirks, or race conditions. E.g. `// Must cache locally FIRST — if DB write fails, user should never re-see onboarding`
- **Integration boundaries**: Where this code talks to external systems and what assumptions it makes. E.g. `// RevenueCat SDK caches offerings after first fetch — subsequent calls resolve from cache`
- **"Why not" explanations**: When you intentionally avoided the obvious approach. E.g. `// Don't await this — Supabase sync is background-only, never blocks the user`
- **Feature doc references**: When a block implements a documented feature, link to the doc. E.g. `// See .claude/docs/agents/10_GENERATION_V2_QUEUE.md for the queue architecture`

### When NOT to comment

- Self-explanatory code (`const userId = user.id` does not need a comment)
- Type annotations that already describe intent
- Simple CRUD operations, standard React patterns, obvious hooks
- Restating what the next line of code does (`// Set loading to true` before `setLoading(true)`)

### Style

- Keep comments to 1-2 lines. If you need more, the code might need refactoring or a doc file.
- Use `//` for inline. Use `/** */` JSDoc only for exported functions/components that aren't self-documenting.
- Write in plain language, not formal prose. `// Hack: iOS crashes if we hide splash before our view paints` is better than `// This addresses a known iOS rendering lifecycle issue`.
- When referencing a feature doc, use relative paths from repo root: `// See .claude/docs/agents/01_DATA_PAYLOADS.md`

### Comment density

Aim for comments on ~10-20% of logical blocks. A 100-line file might have 3-5 comments. A file with zero comments is fine if the code is truly self-explanatory. A file where every other line has a comment is over-documented.

## Documentation Standards

### Rule: Always Update Docs With Code Changes

When you modify, add, or delete code, you MUST check whether any .md files document the affected area. If they do, update them in the same commit. This is not optional — stale docs are worse than no docs.

Specifically:
- If you change a module's behavior → update its README or doc
- If you add a new feature, endpoint, or system → add documentation for it
- If you rename or move files → update any docs that reference old paths
- If you delete code → check for and remove/update docs that reference it
- If you change env vars, config, or dependencies → update setup/config docs
- If you change architecture or data flow → update architecture docs

### Rule: Documentation Lives Next to Code

- Module-level docs go in the module directory as README.md
- Project-level docs go in /docs or the repo root
- Don't create deeply nested doc structures — keep it flat and findable

### Rule: Doc Quality Standards

- Write for someone who knows the tech stack but is new to this codebase
- Start with WHAT it does and WHY, then HOW
- Include example usage when it helps
- No aspirational content — only document what currently exists
- Keep it concise. If a doc is over 200 lines, consider splitting it

### Rule: Mark Status Explicitly

Every doc describing something not yet built MUST carry a `STATUS: PROPOSAL` banner at the
top. Every doc describing something retired MUST say so in its first paragraph. A spec that
reads as documentation for a shipped feature but describes unbuilt work is the worst failure
mode in this repo.

### Rule: After Multi-File Changes, Do a Doc Sweep

If a task touches 5+ files or changes architecture, do a quick scan of all .md files in affected directories to make sure nothing is stale. Mention what you checked in your commit message.

### Rule: Never Create Stub Docs

Don't create placeholder docs that say "TODO" or "Coming soon." Either write the doc properly or don't create the file. Empty docs create false confidence that something is documented.

### Rule: PR Description as Doc Check

Before finalizing any PR or set of changes, ask yourself: "If someone reads only the docs, will they understand the current state of this system?" If not, fix the docs.
