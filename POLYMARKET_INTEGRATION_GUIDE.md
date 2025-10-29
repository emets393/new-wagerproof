# Polymarket Widget Integration Guide

> **Comprehensive guide for integrating Polymarket betting data into WagerProof applications**

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [What We Built](#what-we-built)
4. [Key Learnings](#key-learnings)
5. [Quick Start](#quick-start)
6. [Related Documentation](#related-documentation)

---

## Overview

This guide documents the successful integration of Polymarket's public betting markets into WagerProof for **NFL** and **College Football**. The widget displays real-time betting line movements (Moneyline, Spread, Over/Under) with historical time series data.

### What is Polymarket?

Polymarket is a decentralized prediction market platform where users trade on the outcomes of real-world events, including sports games. The platform provides:
- Real-time implied probabilities (0-1 scale)
- Historical price movement data
- Multiple market types per game (ML, Spread, Total)
- High liquidity for major sports

### Why Integrate Polymarket?

1. **Public Sentiment Data**: Shows where the "smart money" is going
2. **Line Movement Tracking**: Historical price changes over time
3. **Multiple Market Types**: Not just moneyline - includes spreads and totals
4. **No Authentication Required**: Public APIs, easy to integrate
5. **Real-Time Updates**: Markets trade 24/7 with live price updates

---

## Architecture

### High-Level Flow

```
┌─────────────────┐
│   WagerProof    │
│   React App     │
└────────┬────────┘
         │
         │ 1. Request game data
         ▼
┌─────────────────────────┐
│  polymarketService.ts   │
│  - Team name mapping    │
│  - Market classification│
│  - Data transformation  │
└────────┬────────────────┘
         │
         │ 2. Invoke Edge Function
         ▼
┌─────────────────────────┐
│  Supabase Edge Function │
│  (CORS Proxy)           │
│  polymarket-proxy       │
└────────┬────────────────┘
         │
         │ 3. Fetch from Polymarket
         ▼
┌─────────────────────────┐
│   Polymarket APIs       │
│   - gamma-api (events)  │
│   - clob (price history)│
└─────────────────────────┘
```

### Component Structure

```
src/
├── components/
│   └── PolymarketWidget.tsx          # Main widget component
├── services/
│   └── polymarketService.ts          # API integration layer
├── types/
│   └── polymarket.ts                 # TypeScript interfaces
└── pages/
    ├── NFL.tsx                       # NFL game cards
    └── CollegeFootball.tsx           # CFB game cards

supabase/
└── functions/
    └── polymarket-proxy/
        └── index.ts                  # CORS proxy Edge Function
```

### Data Flow Sequence

```
1. USER VIEWS GAME CARD
   ↓
2. PolymarketWidget Component Mounts
   ↓
3. React Query Fetches: getAllMarketsData(awayTeam, homeTeam, league)
   ↓
4. Service Layer:
   a. Get Sport Tag ID (getSportsMetadata → getLeagueTagId)
   b. Fetch Events (getLeagueEvents via Edge Function)
   c. Find Matching Game (findMatchingEvent)
   d. Extract Market Types (extractAllMarketsFromEvent)
   e. Fetch Price History for Each Market (getPriceHistory)
   ↓
5. Transform Data:
   - Convert UNIX timestamps to JS Date
   - Transform 0-1 probability to percentage
   - Calculate away vs home odds
   ↓
6. Widget Renders:
   - Time series chart (Recharts)
   - Market type selector (ML/Spread/O/U)
   - Time range selector (1H/6H/1D/1W/1M/ALL)
   - Current odds display
```

---

## What We Built

### 1. Core Service (`polymarketService.ts`)

**Key Functions:**
- `getSportsMetadata()` - Fetch available sports and tag IDs
- `getLeagueTagId(league)` - Get tag ID for NFL/CFB
- `getLeagueEvents(league)` - Fetch all active games for a sport
- `findMatchingEvent()` - Match WagerProof game to Polymarket event
- `classifyMarket()` - Identify market type (ML/Spread/Total)
- `getAllMarketsData()` - Main entry point, fetches all market types
- `getPriceHistory()` - Fetch time series price data
- `transformPriceHistory()` - Convert to chart-ready format

**Team Name Mapping:**
- NFL: City → Mascot mapping (e.g., "Baltimore" → "Ravens")
- CFB: Direct school names (e.g., "Ohio State" → "Ohio State")

### 2. Widget Component (`PolymarketWidget.tsx`)

**Features:**
- Market type selection (Moneyline, Spread, Over/Under)
- Time range filtering (1H, 6H, 1D, 1W, 1M, ALL)
- Interactive Recharts line chart
- Current odds display with trend indicators
- Responsive design with team colors
- Click event handling (doesn't trigger parent card)
- Loading states and error handling

### 3. CORS Proxy (`polymarket-proxy/index.ts`)

**Endpoints Proxied:**
- `POST /invoke` with `action: 'sports'` → GET /sports
- `POST /invoke` with `action: 'events'` → GET /events
- `POST /invoke` with `action: 'price-history'` → GET /prices-history

**Why Needed:**
Polymarket's API blocks browser requests (CORS policy). The Edge Function runs server-side where CORS doesn't apply.

### 4. Type Definitions (`polymarket.ts`)

**Key Interfaces:**
- `PolymarketEventMarketClean` - Market from /events endpoint
- `PolymarketEventsResponse` - Full events response
- `PolymarketTimeSeriesData` - Chart data structure
- `PolymarketAllMarketsData` - All market types for a game
- `MarketType` - Union type for market classifications

---

## Key Learnings

### What Worked

✅ **Sport Identifier: Use `'cfb'` not `'ncaaf'`**
- Polymarket uses `'cfb'` for College Football
- Check `/sports` endpoint for correct identifiers

✅ **Use `/sports` → `/events` Flow**
- More reliable than searching `/markets` directly
- `/events` returns clean team names and market structure
- Tag-based filtering ensures sport-specific results

✅ **Edge Function for CORS**
- Polymarket blocks direct browser requests
- Supabase Edge Functions run server-side (no CORS)
- Acts as transparent proxy

✅ **Team Mascot Mapping for NFL**
- Polymarket uses full names: "Baltimore Ravens"
- WagerProof uses city names: "Baltimore"
- Mapping required: `{ 'Baltimore': 'Ravens' }`

✅ **School Names for CFB**
- CFB uses direct school names (no city)
- Mapping is 1:1: `{ 'Ohio State': 'Ohio State' }`

✅ **Market Classification by Patterns**
- Check question text for keywords
- "vs" or "vs." = moneyline
- "spread" = spread market
- "o/u" or "total" = total market
- Skip "1h" markets (first half only)

✅ **Aggressive Event Stopping for Clickability**
- Widget buttons were triggering parent card hover/click
- Solution: `stopPropagation()`, `preventDefault()`, `stopImmediatePropagation()`
- Plus CSS: `pointer-events: auto`, `isolation: isolate`, high `z-index`

### What Didn't Work

❌ **Direct API Calls from Browser**
- CORS blocks all requests
- Must use server-side proxy

❌ **Using `/markets` Search Endpoint**
- `_search` parameter doesn't effectively filter
- Returns generic markets mixed with sports
- Hard to match team names reliably

❌ **Assuming `'ncaaf'` for CFB**
- Polymarket uses `'cfb'` identifier
- Always check `/sports` endpoint first

❌ **Simple Event Handlers on Widget**
- Parent card animations intercepted clicks
- Needed multi-layered event stopping

---

## Quick Start

### Adding a New Sport (e.g., NBA)

**1. Find Sport Identifier**
```bash
# Call /sports endpoint
curl https://gamma-api.polymarket.com/sports
# Look for: { "sport": "nba", "tags": "1,100xxx", ... }
```

**2. Add Team Mappings**
```typescript
// src/services/polymarketService.ts
const NBA_TEAM_MAPPINGS: Record<string, string> = {
  'Golden State': 'Warriors',
  'Los Angeles Lakers': 'Lakers',
  'Los Angeles Clippers': 'Clippers',
  // ... add all 30 teams
};
```

**3. Update getTeamMascot()**
```typescript
function getTeamMascot(teamName: string, league: 'nfl' | 'cfb' | 'nba' = 'nfl'): string {
  if (league === 'nba') {
    return NBA_TEAM_MAPPINGS[teamName] || teamName;
  }
  // ... existing NFL/CFB logic
}
```

**4. Update League Type**
```typescript
// Everywhere 'nfl' | 'cfb' appears, add | 'nba'
async function getLeagueTagId(league: 'nfl' | 'cfb' | 'nba'): Promise<string | null> {
  const sports = await getSportsMetadata();
  const sportName = league === 'nfl' ? 'nfl' : league === 'cfb' ? 'cfb' : 'nba';
  // ...
}
```

**5. Add Widget to NBA Page**
```tsx
<PolymarketWidget
  awayTeam={prediction.away_team}
  homeTeam={prediction.home_team}
  gameDate={prediction.game_date}
  awayTeamColors={awayTeamColors}
  homeTeamColors={homeTeamColors}
  league="nba"
/>
```

### Integrating into a New App

**1. Copy Core Files**
```bash
# Required files
src/components/PolymarketWidget.tsx
src/services/polymarketService.ts
src/types/polymarket.ts
supabase/functions/polymarket-proxy/index.ts
```

**2. Deploy Edge Function**
```bash
supabase functions deploy polymarket-proxy
```

**3. Install Dependencies**
```bash
npm install recharts date-fns @tanstack/react-query
```

**4. Use Widget**
```tsx
import PolymarketWidget from '@/components/PolymarketWidget';

<PolymarketWidget
  awayTeam="Baltimore"
  homeTeam="Miami"
  league="nfl"
  awayTeamColors={{ primary: "#241773", secondary: "#000000" }}
  homeTeamColors={{ primary: "#008E97", secondary: "#FC4C02" }}
/>
```

---

## Related Documentation

- **[API Reference](./docs/polymarket-api-reference.md)** - Detailed API endpoints, payloads, and responses
- **[Implementation Steps](./docs/polymarket-implementation-steps.md)** - Step-by-step integration guide
- **[Code Patterns](./docs/polymarket-code-patterns.md)** - Reusable code patterns and algorithms
- **[Troubleshooting](./docs/polymarket-troubleshooting.md)** - Common issues and solutions

---

## Success Metrics

### NFL Integration
- ✅ Successfully fetches 14+ games per week
- ✅ Displays Moneyline, Spread, and Over/Under markets
- ✅ Historical data from market creation to present
- ✅ Widget fully clickable without triggering parent interactions
- ✅ Responsive design works on mobile and desktop

### CFB Integration  
- ✅ Successfully fetches 50+ games per week
- ✅ Correctly identifies CFB markets using `'cfb'` identifier
- ✅ Handles school name variations (e.g., "Jacksonville State")
- ✅ Same feature parity as NFL (ML/Spread/Total)
- ✅ Widget positioned above Model Predictions section

---

## Maintainers

For questions or updates to this integration:
1. Check [Troubleshooting Guide](./docs/polymarket-troubleshooting.md)
2. Review [API Reference](./docs/polymarket-api-reference.md) for endpoint changes
3. Test with [Code Patterns](./docs/polymarket-code-patterns.md) examples

**Last Updated**: January 2025
**Integration Version**: 1.0
**Supported Sports**: NFL, CFB

