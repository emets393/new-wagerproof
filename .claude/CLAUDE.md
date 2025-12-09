# WagerProof - Claude Context File

## Project Overview

WagerProof is a professional-grade sports betting analytics and predictions platform that provides data-driven insights for sports bettors. The app delivers predictive models, betting line analysis, live scoring, and AI-powered analysis across multiple sports leagues.

## Core Value Proposition

- Data-driven sports betting predictions using machine learning models
- Model-generated probabilities for betting outcomes (spread, moneyline, totals)
- Line movement and public betting sentiment analysis
- Editor picks and community insights
- Multi-sport coverage: NFL, College Football (CFB), NBA, College Basketball (NCAAB)

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

### Mobile App (`/app`)
```
app/
├── (drawer)/          # Main drawer layout
│   ├── (tabs)/       # Tab navigation (Feed, Picks, Scoreboard, Chat, Settings)
│   └── _layout.tsx
├── (auth)/            # Auth screens
├── (onboarding)/      # Onboarding flow
├── components/        # React Native components
├── services/          # Mobile services
└── contexts/          # React Context
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
- **Version**: 3.0.1

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

## Notes for Development

- Game details typically open in bottom sheets (mobile) or modals (web)
- Dark mode is fully supported via ThemeContext
- Most data fetching uses React Query with aggressive caching
- AI features require API keys and have admin controls
- The app supports both live and historical game data
