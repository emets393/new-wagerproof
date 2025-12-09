# WagerProof Codebase Overview

> Last verified: December 2024

## Project Structure

WagerProof consists of two main applications:

### Web Application (`/src`)
- **Framework**: React 18.3.1 + Vite 5.4.1 + TypeScript 5.5.3
- **UI**: shadcn/ui (56+ components) + Tailwind CSS 3.4.11
- **State**: React Query (TanStack) + React Context
- **Backend**: Supabase (PostgreSQL + Auth)
- **Payments**: RevenueCat + Stripe
- **Deployment**: Netlify

### Mobile Application (`/wagerproof-mobile`)
- **Framework**: React Native 0.81.5 + Expo 54.0.26 + TypeScript 5.9.2
- **UI**: React Native Paper (Material Design 3)
- **Navigation**: Expo Router (file-based) + React Navigation (drawer)
- **State**: React Query + React Context
- **Backend**: Supabase (dual clients - main + CFB)
- **Payments**: RevenueCat (native IAP)

---

## Directory Structure

### Web (`/src`)
```
src/
├── components/          # 85+ React components
│   ├── ui/             # 56+ shadcn UI primitives
│   ├── admin/          # Admin dashboard components
│   ├── onboarding/     # Onboarding flow
│   ├── landing/        # Landing page + SEO
│   └── magicui/        # Animation components (Aurora, ShineBorder)
├── pages/              # 38 page components + 7 admin pages
├── services/           # 8 API integrations
├── contexts/           # 5 React Context providers
├── hooks/              # 19 custom hooks
├── types/              # TypeScript definitions
├── utils/              # 18 utility functions
├── integrations/       # Supabase clients
└── lib/                # Library configs (Mixpanel, Stripe)
```

### Mobile (`/wagerproof-mobile`)
```
wagerproof-mobile/
├── app/                # Expo Router screens
│   ├── (auth)/        # Login, signup, forgot password
│   ├── (onboarding)/  # 16-step onboarding
│   ├── (drawer)/      # Main app with side menu
│   │   └── (tabs)/   # Bottom tabs (Feed, Picks, Outliers, Scores)
│   └── (modals)/      # Modal screens
├── components/         # 45 React Native components
├── contexts/           # 13 Context providers
├── services/           # 8 API services
├── hooks/              # 2 custom hooks
├── utils/              # 9 utility functions
├── types/              # Sport-specific types
└── constants/          # Theme and config
```

---

## Key Feature Areas

### 1. Sports Predictions (NFL, CFB, NBA, NCAAB)
- **Web**: Separate pages per sport with game cards, modals, filters
- **Mobile**: Unified Feed screen with sport tabs, bottom sheets for details
- **Data Sources**:
  - NFL: `v_input_values_with_epa`, `nfl_predictions_epa`
  - CFB: `cfb_live_weekly_inputs`, `cfb_api_predictions`
  - NBA: `nba_input_values_view`, `nba_predictions`
  - NCAAB: `v_cbb_input_values`, `ncaab_predictions`

### 2. Live Scores
- **Web**: `LiveScoreTicker` (marquee) + `LiveScoreCard`
- **Mobile**: Full `Scoreboard` tab with 8 leagues (NFL, CFB, NBA, NCAAB, NHL, MLB, MLS, EPL)
- **Data**: `live_scores` table, enriched with predictions

### 3. WagerBot AI Chat
- **Web**: ChatKit SDK (`@openai/chatkit-react`)
- **Mobile**: Custom implementation with XMLHttpRequest streaming
- **API**: OpenAI Responses API (stateless, NOT Assistants API)
- **Endpoint**: `https://xna68l.buildship.run/wager-bot-mobile-900a291b0aae`

### 4. Editor's Picks
- **Both platforms**: `EditorPickCard` component
- **Data**: `editors_picks` table with `betslip_links` JSONB
- **Integration**: Sportsbook deep links via The Odds API

### 5. Payments/Subscriptions
- **Web**: RevenueCat Web + Stripe checkout
- **Mobile**: RevenueCat native IAP (App Store/Google Play)
- **Products**: monthly, yearly, lifetime
- **Entitlement**: "WagerProof Pro"

### 6. Polymarket Integration
- **Both platforms**: Prediction market odds display
- **Cache**: `polymarket_markets` + `polymarket_events` tables
- **Leagues**: NFL, CFB, NBA, NCAAB

---

## Technology Comparison

| Feature | Web | Mobile |
|---------|-----|--------|
| Framework | React 18 + Vite | React Native + Expo |
| Routing | React Router 6 | Expo Router |
| UI Library | shadcn/ui + Tailwind | React Native Paper |
| Animation | Framer Motion | Reanimated 4.1 |
| Charts | Recharts | Victory Native |
| Storage | localStorage | AsyncStorage |
| Auth | Supabase + Google OAuth | Supabase + Google Sign-In (native) |
| Payments | RevenueCat Web | RevenueCat Native |
| Streaming | ChatKit SDK | XMLHttpRequest |

---

## Database Architecture

### Primary Supabase (`gnjrklxotmbvnxbnnqgq`)
- User authentication
- Profiles and settings
- Chat threads and messages
- Editor's picks
- Community picks
- Announcements

### Secondary Supabase (`jpxnjuwglavsjbgbasnl`)
- NFL/CFB/NBA/NCAAB predictions
- Betting lines
- Live scores
- Weather data
- Polymarket cache

### Key Tables
- `profiles` - User data, subscription status, onboarding
- `chat_threads` / `chat_messages` - WagerBot conversations
- `editors_picks` - Curated picks with betslip links
- `live_scores` - Real-time game data
- `polymarket_markets` - Cached prediction market data

---

## External Integrations

| Service | Purpose | Web | Mobile |
|---------|---------|-----|--------|
| Supabase | Auth + Database | ✅ | ✅ |
| RevenueCat | Subscriptions | ✅ | ✅ |
| OpenAI | AI Chat (Responses API) | ✅ | ✅ |
| Polymarket | Prediction markets | ✅ | ✅ |
| The Odds API | Sportsbook odds | ✅ | ✅ |
| ESPN API | Live scores | ✅ | ✅ |
| Ghost CMS | Blog content | ✅ | ❌ |
| Mixpanel | Analytics | ✅ | ❌ |
| Stripe | Web payments | ✅ | ❌ |

---

## Environment Variables

### Web (Vite)
```
VITE_REVENUECAT_WEB_PUBLIC_API_KEY
VITE_REVENUECAT_WEB_SANDBOX_API_KEY
VITE_GHOST_URL
VITE_GHOST_CONTENT_KEY
```
Note: Some keys are currently hardcoded in source

### Mobile (Expo)
- Uses platform-specific RevenueCat keys
- iOS: `test_WwRgjLydsPjgngueRMOVfVgWZzg`
- Android: `goog_cilRlGISDEjNmpNebMglZPXnPLb`

---

## Build & Deploy

### Web
```bash
npm run dev          # Development server (port 8080)
npm run build        # Production build + blog + prerender
npm run preview      # Preview production build
```

### Mobile
```bash
npx expo start       # Development server
eas build --platform ios     # iOS build
eas build --platform android # Android build
```

---

## Quick Links to Detailed Docs

- [BuildShip & API Integration](./01_buildship_api.md)
- [WagerBot Chat System](./02_chat_wagerbot.md)
- [Payments & RevenueCat](./03_payments_billing.md)
- [Sports & Predictions](./04_sports_predictions.md)
- [UI, Design & Theming](./05_ui_design_theme.md)
- [Auth, SEO & Deployment](./06_auth_seo_deploy.md)
- [Mobile-Specific Features](./07_mobile_features.md)
- [Database & Caching](./08_database_caching.md)
