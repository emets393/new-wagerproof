# WagerProof - Claude Context File

> Last verified against code: 2026-07-25. Route, flag, and file-path claims below were
> checked against `src/App.tsx`, `supabase/functions/`, and the native app trees on that date.

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
| `wagerproof-ios-native/` | **SHIPPING** — iOS (3.5.8) | SwiftUI | Xcode Cloud on push to `main` |
| `wagerproof-android-native/` | **SHIPPING** — Android (versionCode 49) | Kotlin / Compose | `.github/workflows/android-native.yml` → Play |
| `wagerproof-mobile/` | **DEPRECATED — phasing out** | React Native + Expo | nothing; no CI path |

### `wagerproof-mobile/` is deprecated

The React Native app is being retired in favor of the two native apps. It is frozen as a
release target — `app.json` still declares version 3.5.6 / buildNumber 40 and has not been
touched since 2026-06-09, while iOS shipped 3.5.8 and Android moved to versionCode 49. It
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
- The `editors_picks` Supabase table and WagerBot's `get_editor_picks` chat tool remain queryable for historical/AI-chat purposes only.

### 5. WagerBot
- Agentic AI chat powered by a Supabase Edge Function + OpenAI Responses API (gpt-4o)
- 11 custom data tools (predictions, odds, Polymarket, editor picks, `present_analysis`) + built-in web search
- SSE streaming with real-time tool execution status; ContentBlock message model with thread persistence
- **No web UI.** `/wagerbot-chat` redirects to `/account`; `src/pages/WagerBotChat.tsx` is unrouted dead code. WagerBot ships in the native apps only.
- A parallel multi-provider edge function (`wagerbot-agent`, OpenAI + DeepSeek) exists alongside the live `wagerbot-chat`
- **Documentation**: `.claude/docs/02_chat_wagerbot.md`

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
  that card's question ("82% of the prediction market is on the under")
- Generated daily by the Trigger.dev task `daily-widget-summaries` (`agents-v3/`):
  writer LLM → deterministic gate → **LLM judge**. Only `qc_status IN ('pass','corrected')`
  is shown to users; a failed headline is withheld, not displayed
- Stored on `ai_completions` (`headline_text` + QC columns), keyed
  `(game_id, sport_type, widget_type)` — widget types are keyed to the betting
  QUESTION, not to a UI component, so one row serves web and both native apps
- **Shipped for MLB on web only.** The other four sports were out of season when
  this was built; iOS/Android are not wired up yet
- **Documentation**: `.claude/docs/17_widget_headlines.md`

### 9. MCP Connector (`/connect-ai`)
- Public read-only MCP server (`wagerproof-mcp/`, Cloudflare Worker) sharing tool logic with `wagerproof-tool-core/`
- Users connect it from `/connect-ai` on web or Settings in iOS native
- Deployed at a `*.workers.dev` subdomain (the `mcp.wagerproof.bet` custom domain is not yet live)

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

## Agent Pick Generation — which engine actually runs

Four generations of the engine exist in the repo. Get this right before touching generation code.

| Engine | Location | Status |
|---|---|---|
| **V3 / Trigger.dev** | `agents-v3/trigger/generateV3Picks.ts` (task `generate-v3-picks`) | **CANONICAL** — what web + iOS native call |
| V3 edge mirror | `supabase/functions/process-agent-generation-job-v3/` | Diverged fork of `agents-v3/src/loop/` — same module names, different code; nothing triggers it |
| V2 queue | `process-agent-generation-job-v2` + `request-avatar-picks-generation-v2` | Legacy; only the deprecated RN app calls it |
| V1 | `supabase/functions/generate-avatar-picks/` | Dead — only a test script calls it |

- Web entry: `src/services/agentPicksService.ts` → edge fn `trigger-v3-run` → Trigger.dev
- iOS entry: `WagerproofKit/Sources/WagerproofServices/AgentPicksService.swift`
- Run status is polled through the `trigger-run-status` edge proxy (uses the SECRET key).
  Do NOT fetch `api.trigger.dev` directly from a client — hand-rolled public tokens 401.
- `agents-v3` must run `runtime: "node-22"` in `trigger.config.ts` — supabase-js ≥2.108 throws
  at `createClient` on Node 21 and this took prod down once.
- Default model is DeepSeek `deepseek-v4-flash`. The `deepseek-reasoner`/`-chat` aliases are retired.
- **Known ambiguity**: auto-generation may be scheduled twice — SQL migration
  `20260706120000_auto_generation_all_v3.sql` routes auto runs to the edge V3 worker, while
  `agents-v3/trigger/dailyAutoGenV3.ts` says it replaces that path. The three migrations
  touching `v2-enqueue-auto-generation` all unschedule-then-reschedule it, so it is likely
  still active. Verify against prod `cron.job` before changing auto-generation.
- Migration history is out of sync with prod: `select_due_auto_avatars_v3_trigger` is called
  by `dailyAutoGenV3.ts` but exists in no migration file.

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
npm test             # vitest
cd agents-v3 && npm run dev   # Trigger.dev worker (CLI bin is `trigger`, not `trigger.dev`)
xcodegen generate    # after adding iOS files, from wagerproof-ios-native/
```

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
- `.claude/docs/11_edge_functions.md` — verified March 2026; 13 of ~46 functions are undocumented
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
