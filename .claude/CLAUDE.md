# WagerProof - Claude Context File

## Project Overview

WagerProof is a professional-grade sports betting analytics and predictions platform that provides data-driven insights for sports bettors. The app delivers predictive models, betting line analysis, live scoring, and AI-powered analysis across multiple sports leagues.

## Core Value Proposition

- Data-driven sports betting predictions using machine learning models
- Model-generated probabilities for betting outcomes (spread, moneyline, totals)
- Line movement and public betting sentiment analysis
- Editor picks and community insights
- Multi-sport coverage: NFL, College Football (CFB), NBA, College Basketball (NCAAB), MLB

## Tech Stack

### Web Application
- **Framework**: React 18.3 + Vite
- **Styling**: Tailwind CSS, shadcn-ui components
- **Routing**: React Router DOM v6
- **State**: React Query (TanStack Query), React Context
- **UI**: Radix UI primitives, Recharts for visualization

### Mobile Application
- **Framework**: React Native + Expo
- **Navigation**: Expo Router (file-based)
- **UI**: React Native Paper (Material Design)
- **State**: React Query + custom contexts

### Backend & Services
- **Database**: Supabase (PostgreSQL)
- **Auth**: Supabase Authentication + Google Sign-In
- **Subscriptions**: RevenueCat
- **Payments**: Stripe
- **Analytics**: Mixpanel

## Project Structure

### Web App (`/src`)
```
src/
├── pages/              # Route pages (NFL.tsx, NBA.tsx, EditorsPicks.tsx)
├── components/         # React components
│   ├── ui/            # shadcn-ui primitives
│   └── GameCard variants, PolymarketWidget, etc.
├── services/          # API clients
├── contexts/          # React Context (Auth, Theme, RevenueCat)
├── hooks/             # Custom React hooks
├── integrations/      # Supabase clients
├── utils/             # Helper functions
└── types/             # TypeScript interfaces
```

### Mobile App (`/wagerproof-mobile`)
```
wagerproof-mobile/
├── app/
│   ├── (drawer)/          # Main drawer layout
│   │   ├── (tabs)/        # Tab navigation (Games, Agents, Outliers, Scoreboard)
│   │   └── _layout.tsx
│   ├── (auth)/            # Auth screens
│   └── (onboarding)/      # Onboarding flow
├── components/            # React Native components
│   └── agents/            # Agent-related components (upcoming)
├── services/              # Mobile services
├── hooks/                 # Custom React hooks
├── contexts/              # React Context
└── types/                 # TypeScript interfaces
```

## Key Features

### 1. Game Predictions
- Machine learning models generate win/spread/total probabilities
- Compare model odds vs Vegas lines to find value
- Weather data integration for outdoor games
- Routes: `/nfl`, `/cfb`, `/nba`, `/ncaab`

### 2. Live Scores (`/scoreboard`)
- Real-time game updates via ESPN/Sports API
- Live score tracking with prediction overlays

### 3. Editor's Picks (`/editors-picks`)
- Professional picks with detailed reasoning
- Win/loss tracking and performance history
- AI-identified "Value Finds" for high-value opportunities

### 4. WagerBot (`/wagerbot-chat`)
- AI-powered conversational betting assistant
- ChatKit integration for natural language queries
- References game data, odds, and predictions

### 5. Analytics Tools
- NFL Analytics Dashboard (`/nfl-analytics`)
- Teaser Sharpness Tool (`/nfl/teaser-sharpness`)
- Bet Slip Grader (`/bet-slip-grader`)

### 6. Community Features
- Community voting on picks
- User wins/losses tracking
- Feature request system

### 7. AI Agents (In Development)
- **Premium Feature**: Users create up to 5 AI-powered "Virtual Picks Experts"
- Personalized betting agents with 50+ tunable parameters
- On-demand pick generation based on agent personality
- Automated performance tracking (W-L-P, +/- units)
- Public leaderboard for shared agents
- **Documentation**: See `.claude/docs/agents/` for full specifications:
  - `00_OVERVIEW.md` - Feature overview and key decisions
  - `01_DATA_PAYLOADS.md` - 4-payload architecture for AI generation
  - `02_PERSONALITY_PARAMS.md` - All personality parameters and archetypes
  - `03_DATABASE_SCHEMA.md` - Database tables and RLS policies
  - `04_SCREENS.md` - Screen-by-screen specifications
  - `05_COMPONENTS.md` - Component list and props
  - `06_IMPLEMENTATION.md` - Implementation phases and file list
  - `10_GENERATION_V2_QUEUE.md` - V2 queue-based generation architecture (enqueue/dispatch/worker)

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
- **Value Finds**: AI-identified high-value betting opportunities

## Key Service Files

| File | Purpose |
|------|---------|
| `src/services/polymarketService.ts` | Polymarket API integration |
| `src/services/liveScoresService.ts` | Live game scores |
| `src/services/theOddsApi.ts` | Sportsbook odds and betslip links |
| `src/services/aiCompletionService.ts` | AI-generated analysis |
| `src/services/basketballDataService.ts` | NBA/NCAAB specific data |
| `src/integrations/supabase/client.ts` | Supabase database client |

## Authentication & Monetization

### Auth Flow
- Email/password via Supabase
- Google Sign-In (native on mobile)
- Onboarding guard before main app access

### Freemium Model
- **Free tier**: Limited predictions (`allowFreemium=true`)
- **Pro/Premium**: Full access via RevenueCat subscriptions
- Paywalls integrated throughout the app

## Deployment

- **Web**: Netlify (configured in `netlify.toml`)
- **Domain**: wagerproof.bet
- **Mobile**: Expo EAS builds for iOS/Android
- **Version**: 3.5.0

## Common Development Tasks

### Running the Web App
```bash
npm run dev
```

### Running the Mobile App
```bash
npx expo start
```

### Key Environment Variables
- Supabase URL and anon key
- The Odds API key
- RevenueCat API keys
- Mixpanel token

## Database Tables (Supabase)

Key tables include:
- `predictions` - Model-generated game predictions
- `editor_picks` - Published editor picks
- `user_profiles` - User account data
- `ai_completions` - Cached AI analysis
- `polymarket_events` - Cached Polymarket data

**Agent Tables (upcoming)**:
- `avatar_profiles` - Agent configuration and personality parameters
- `avatar_picks` - Picks generated by agents
- `avatar_performance_cache` - Cached W-L-P stats
- `user_avatar_follows` - Follow system for public agents

## Notes for Development

- Game details typically open in bottom sheets (mobile) or modals (web)
- Dark mode is fully supported via ThemeContext
- Most data fetching uses React Query with aggressive caching
- AI features require API keys and have admin controls
- The app supports both live and historical game data

## Inline Code Comments

Write inline comments that help future developers (and AI agents) understand **why** code exists, not what it does. The code itself shows what — comments explain the reasoning, constraints, and non-obvious decisions.

### When to comment

- **Architecture decisions**: Why this approach was chosen over alternatives. E.g. `// PagerView instead of FlatList — native paging runs on UI thread, zero JS bridge work`
- **Non-obvious constraints**: Business rules, platform quirks, or race conditions. E.g. `// Must cache locally FIRST — if DB write fails, user should never re-see onboarding`
- **Integration boundaries**: Where this code talks to external systems and what assumptions it makes. E.g. `// RevenueCat SDK caches offerings after first fetch — subsequent calls resolve from cache`
- **"Why not" explanations**: When you intentionally avoided the obvious approach. E.g. `// Don't await this — Supabase sync is background-only, never blocks the user`
- **Feature doc references**: When a block implements a documented feature, link to the doc. E.g. `// See .claude/docs/agents/06_IMPLEMENTATION.md for the full generation pipeline`

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

### Rule: After Multi-File Changes, Do a Doc Sweep

If a task touches 5+ files or changes architecture, do a quick scan of all .md files in affected directories to make sure nothing is stale. Mention what you checked in your commit message.

### Rule: Never Create Stub Docs

Don't create placeholder docs that say "TODO" or "Coming soon." Either write the doc properly or don't create the file. Empty docs create false confidence that something is documented.

### Rule: PR Description as Doc Check

Before finalizing any PR or set of changes, ask yourself: "If someone reads only the docs, will they understand the current state of this system?" If not, fix the docs.
