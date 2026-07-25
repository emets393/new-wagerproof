# WagerProof

Sports betting analytics platform delivering data-driven predictions, AI-powered analysis, and real-time scoring across NFL, CFB, NBA, NCAAB, and MLB.

## Tech Stack

| Layer | Web | Mobile |
|-------|-----|--------|
| **Framework** | React 18 + Vite | React Native + Expo 54 |
| **Styling** | Tailwind CSS, shadcn/ui | React Native Paper, Moti |
| **Routing** | React Router DOM v6 | Expo Router (file-based) |
| **State** | React Query, Context | React Query, Context |
| **Charts** | Recharts | Victory Native |

**Backend**: Supabase (PostgreSQL) with 47 Edge Functions (Deno)
**Auth**: Supabase Auth + Google Sign-In + Apple Sign-In
**Payments**: RevenueCat (mobile), Stripe (web)
**Analytics**: Mixpanel
**Deployment**: Netlify (web), EAS Build (mobile)

## Project Structure

```
├── src/                          # Web app (React + Vite) — SHIPPING
│   ├── pages/                    # Route pages (Agents, Scoreboard, admin, support)
│   ├── features/                 # Split-view modules (games, analysis, mlbTools, ...)
│   ├── components/               # React components + shadcn/ui + ios/ primitives
│   ├── services/                 # API clients
│   ├── contexts/                 # Auth, Theme, RevenueCat
│   ├── hooks/                    # Custom hooks
│   └── integrations/supabase/    # Supabase clients (main + college-football)
├── wagerproof-ios-native/        # iOS app (SwiftUI) — SHIPPING via Xcode Cloud
│   ├── Wagerproof/Features/      # Feature screens
│   ├── WagerproofKit/            # SPM package: Models, Services, Stores, Design
│   └── project.yml               # XcodeGen source of truth (pbxproj is generated)
├── wagerproof-android-native/    # Android app (Kotlin/Compose) — SHIPPING via GH Actions
├── wagerproof-mobile/            # React Native + Expo — DEPRECATED, phasing out
│   ├── app/                      # Expo Router screens
│   ├── components/               # RN components
│   ├── services/                 # Mobile API clients
│   └── targets/WagerProofWidget/ # iOS Home Screen widget
├── agents-v3/                    # Trigger.dev worker — canonical agent pick generation
├── wagerproof-mcp/               # Public read-only MCP connector (Cloudflare Worker)
├── wagerproof-tool-core/         # Shared tool logic consumed by wagerproof-mcp
├── research/                     # Model research + grading pipelines (Render crons)
├── supabase/
│   ├── functions/                # 47 Edge Functions (Deno)
│   └── migrations/               # 182 SQL migrations
├── docs/                         # Feature docs (agent prompts, MLB, blog)
├── docs/polymarket-implementation-docs/ # Polymarket integration guides
└── .claude/docs/                 # Architecture & feature documentation
```

## Quick Start

### Web App

```bash
cp .env.example .env        # Fill in API keys
npm install
npm run dev                  # http://localhost:5173
```

### Mobile App

```bash
cd wagerproof-mobile
npm install
npx expo start               # Expo dev server
```

See [wagerproof-mobile/README.md](wagerproof-mobile/README.md) for full mobile setup.

### Edge Functions

```bash
supabase start                            # Local Supabase
supabase functions serve                  # Serve all functions locally
supabase functions deploy <function-name> # Deploy single function
```

## Environment Variables

See [`.env.example`](.env.example) for required variables. Key groups:

- **Supabase**: Database URLs and keys (main + CFB instance)
- **RevenueCat**: Subscription management keys
- **Stripe**: Payment processing
- **The Odds API**: Real-time sportsbook odds
- **Ghost CMS**: Blog content

## Dual-Supabase Architecture

WagerProof uses **two Supabase instances**:

| Instance | Purpose | Tables |
|----------|---------|--------|
| **Main** (`gnjrklxotmbvnxbnnqgq`) | Auth, user data, AI completions, agent system, Polymarket cache | `user_profiles`, `avatar_profiles`, `avatar_picks`, `polymarket_markets`, `ai_completions` |
| **CFB** (`jpxnjuwglavsjbgbasnl`) | All sports predictions data | `nfl_predictions_epa`, `cfb_api_predictions`, `nba_predictions`, `ncaab_predictions` |

Edge functions that query game data need `CFB_SUPABASE_URL` and `CFB_SUPABASE_ANON_KEY` secrets configured.

## Database Migrations

Migrations live in `supabase/migrations/` (182 files). Naming convention: `YYYYMMDDHHMMSS_description.sql`.

```bash
# Create a new migration
supabase migration new <description>

# Apply migrations locally
supabase db reset

# Push migrations to remote
supabase db push
```

Key migration groups:
- `20260205*` — Agent/avatar system tables
- `20260303*` — V2 generation queue and cron jobs
- `20260305*` — Push notifications, performance RPCs
- `20260308*` — Hardening: indexes, grading, reconciliation
- `20260325-26*` — MLB support

## Cron Jobs

Scheduled tasks run via `pg_cron` in Supabase, calling Edge Functions on a schedule:

| Job | Schedule | Function |
|-----|----------|----------|
| Polymarket cache update | Multiple windows (US daytime) | `update-polymarket-cache` |
| Agent picks generation | Daily | `auto-generate-avatar-picks` |
| Agent picks grading | Multiple windows | `grade-avatar-picks` |
| Performance reconciliation | Daily 3 AM ET | `backfill-avatar-performance` |
| Value finds | Scheduled | `run-scheduled-value-finds` |
| Today in Sports | Daily | `generate-today-in-sports-completion` |

Cron definitions are in migration files prefixed with `setup_*_cron`.

## Key Scripts

```bash
# Web
npm run dev              # Start dev server
npm run build            # Production build (includes blog, sitemap, support)
npm test                 # Run Vitest tests
npm run lint             # ESLint

# Testing
npm run test:avatar-game-data-payloads  # Test agent data payloads
npm run test:avatar-pick-audit-flow     # Test agent pick audit
```

## Documentation

See [DOCS.md](DOCS.md) for a complete index of all documentation.

Model backtest findings and the bet-type ledger (which markets we have a confirmed edge on)
live in [docs/MODEL_RESEARCH_FINDINGS.md](docs/MODEL_RESEARCH_FINDINGS.md).
