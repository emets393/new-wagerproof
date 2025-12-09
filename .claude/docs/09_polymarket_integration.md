# Polymarket Integration

> Last verified: January 2025

## Overview

WagerProof integrates Polymarket betting markets to display real-time prediction market odds alongside model predictions. The integration includes:
- **Service Layer**: `src/services/polymarketService.ts`
- **Widget Component**: `src/components/PolymarketWidget.tsx`
- **CORS Proxy**: Supabase Edge Function `polymarket-proxy`
- **Database Caching**: `polymarket_events` table (see `08_database_caching.md`)

### Supported Sports
| Sport | Identifier | Tag ID | Status |
|-------|------------|--------|--------|
| NFL | `nfl` | `450` | Integrated |
| College Football | `cfb` | `100351` | Integrated |
| NBA | `nba` | TBD | Ready to integrate |
| NCAAB | `ncaab` | TBD | Ready to integrate |

---

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────────┐
│ PolymarketWidget│────▶│ polymarketService│────▶│ Supabase Edge Func  │
│   (React)       │     │    (TypeScript)  │     │ (polymarket-proxy)  │
└─────────────────┘     └──────────────────┘     └──────────┬──────────┘
                                                            │
                        ┌──────────────────┐                │
                        │ Polymarket APIs  │◀───────────────┘
                        │ (Gamma + CLOB)   │
                        └──────────────────┘
```

**Why Edge Function?** Browser requests to Polymarket APIs are blocked by CORS. The Edge Function acts as a server-side proxy.

---

## API Reference

### Base URLs
| API | URL | Purpose |
|-----|-----|---------|
| Gamma API | `https://gamma-api.polymarket.com` | Sports metadata, events, markets |
| CLOB API | `https://clob.polymarket.com` | Order book, price history |

**Authentication**: None required (public APIs)

### Endpoints

#### 1. Get Sports Metadata
```http
GET https://gamma-api.polymarket.com/sports
```

**Response**:
```json
[
  {
    "sport": "nfl",
    "name": "NFL",
    "tags": "1,450,100639",
    "series": "10211",
    "ordering": "away",
    "active": true
  }
]
```

#### 2. Get Events for a Sport
```http
GET https://gamma-api.polymarket.com/events?tag_id={TAG_ID}&closed=false&limit=100
```

**Response Structure**:
```json
{
  "sport": "nfl",
  "tagId": "450",
  "markets": [
    {
      "eventSlug": "nfl-bal-mia-2025-01-29",
      "eventTitle": "Baltimore Ravens vs. Miami Dolphins",
      "awayTeam": "Baltimore Ravens",
      "homeTeam": "Miami Dolphins",
      "gameStartTime": "2025-01-29T18:00:00.000Z",
      "marketSlug": "nfl-bal-mia-2025-01-29",
      "marketType": "other",
      "question": "Baltimore Ravens vs. Miami Dolphins",
      "yesTokenId": "12345...",
      "noTokenId": "67890...",
      "active": true,
      "closed": false
    }
  ]
}
```

#### 3. Get Price History
```http
GET https://clob.polymarket.com/prices-history?market={TOKEN_ID}&interval={INTERVAL}&fidelity={MINUTES}
```

**Parameters**:
- `market`: Token ID (yesTokenId from events)
- `interval`: `1m`, `1h`, `6h`, `1d`, `1w`, `max`
- `fidelity`: Resolution in minutes (e.g., 60 = hourly)

**Response**:
```json
{
  "history": [
    { "t": 1697875200, "p": 0.6304 },
    { "t": 1697878800, "p": 0.6512 }
  ]
}
```

**Note**: `t` is Unix timestamp in **seconds** (multiply by 1000 for JS). `p` is probability 0.00-1.00.

---

## Service Layer

### Key Functions (`polymarketService.ts`)

```typescript
// Get all market data for a game
getAllMarketsData(awayTeam: string, homeTeam: string, league: 'nfl' | 'cfb'): Promise<PolymarketAllMarketsData | null>

// Get league-specific events
getLeagueEvents(league: 'nfl' | 'cfb'): Promise<PolymarketEvent[]>

// Get price history for a token
getPriceHistory(tokenId: string, interval: string, fidelity: number): Promise<PriceHistoryPoint[]>
```

### Team Name Mappings

The service maps app team names to Polymarket's format:

```typescript
// NFL: City → Mascot
const NFL_TEAM_MASCOTS: Record<string, string> = {
  'Baltimore': 'Ravens',
  'Miami': 'Dolphins',
  'Kansas City': 'Chiefs',
  // ... all 32 teams
};

// CFB: School name (usually unchanged)
const CFB_TEAM_MAPPINGS: Record<string, string> = {
  'Ohio State': 'Ohio State',
  'Michigan': 'Michigan',
  // ... major schools
};
```

### Market Classification

Markets are classified by question text and slug:

```typescript
function classifyMarket(question: string, slug: string): MarketType | null {
  const qLower = question.toLowerCase();

  // Skip first-half markets
  if (qLower.includes('1h') || slug.includes('-1h-')) return null;

  // Classify by keywords
  if (qLower.includes('spread')) return 'spread';
  if (qLower.includes('o/u') || qLower.includes('total')) return 'total';
  if (qLower.includes(' vs ')) return 'moneyline';

  return null;
}
```

---

## Widget Component

### Usage

```tsx
import PolymarketWidget from '@/components/PolymarketWidget';

<PolymarketWidget
  awayTeam={prediction.away_team}
  homeTeam={prediction.home_team}
  gameDate={prediction.game_date}
  awayTeamColors={{ primary: "#241773", secondary: "#000000" }}
  homeTeamColors={{ primary: "#008E97", secondary: "#FC4C02" }}
  league="nfl"
/>
```

### Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `awayTeam` | string | Yes | Away team name (will be mapped) |
| `homeTeam` | string | Yes | Home team name (will be mapped) |
| `league` | `'nfl' \| 'cfb'` | Yes | Sport identifier |
| `gameDate` | string | No | Game date for display |
| `awayTeamColors` | `{primary, secondary}` | No | Chart line colors |
| `homeTeamColors` | `{primary, secondary}` | No | Chart line colors |

### Event Handling (Click Propagation)

The widget uses aggressive event stopping to prevent parent card interactions:

```tsx
<div
  onClick={(e) => e.stopPropagation()}
  onPointerDown={(e) => e.stopPropagation()}
  onMouseDown={(e) => e.stopPropagation()}
  onTouchStart={(e) => e.stopPropagation()}
  className="pointer-events-auto relative z-[100]"
  style={{ isolation: 'isolate' }}
>
  <PolymarketWidget ... />
</div>
```

---

## Edge Function Proxy

### Location
`supabase/functions/polymarket-proxy/index.ts`

### Actions

```typescript
// Invoke via Supabase client
const { data, error } = await supabase.functions.invoke('polymarket-proxy', {
  body: {
    action: 'events',  // 'sports' | 'events' | 'prices-history'
    tagId: '450',      // For events
    tokenId: '...',    // For prices-history
    interval: '1h',    // For prices-history
    fidelity: 60       // For prices-history
  }
});
```

### Deployment

```bash
# Deploy the function
supabase functions deploy polymarket-proxy

# Verify deployment
supabase functions list

# Check logs
supabase functions logs polymarket-proxy --tail
```

---

## Adding a New Sport

### Step 1: Discover Sport Metadata
```bash
curl https://gamma-api.polymarket.com/sports | jq '.[] | select(.sport == "nba")'
```

### Step 2: Add Team Mappings
```typescript
// In polymarketService.ts
const NBA_TEAM_MAPPINGS: Record<string, string> = {
  'Golden State': 'Warriors',
  'LA Lakers': 'Lakers',
  // ... all 30 teams
};
```

### Step 3: Update Type Unions
```typescript
// Update all occurrences of:
'nfl' | 'cfb'
// To:
'nfl' | 'cfb' | 'nba'
```

### Step 4: Integrate Widget
```tsx
// In NBA.tsx
<PolymarketWidget
  awayTeam={prediction.away_team}
  homeTeam={prediction.home_team}
  league="nba"
/>
```

---

## Troubleshooting

### CORS Errors
**Symptom**: `Access to fetch blocked by CORS policy`

**Solution**: Ensure all API calls go through the Edge Function proxy, not direct to Polymarket.

```typescript
// Wrong - direct call
fetch('https://gamma-api.polymarket.com/events?tag_id=450')

// Correct - via proxy
supabase.functions.invoke('polymarket-proxy', {
  body: { action: 'events', tagId: '450' }
})
```

### No Data Showing
**Symptom**: "Polymarket betting data unavailable for this game"

**Diagnosis**:
1. Check console logs for team matching:
   ```
   🔍 Looking for: Ravens vs Dolphins
   ❌ No matching event found
   📋 Available events: [...]
   ```
2. Verify team name mappings exist
3. Confirm game is on Polymarket (not all games are listed)

### Widget Not Clickable
**Symptom**: Clicking buttons triggers parent card actions

**Solution**: Wrap widget with event-stopping div (see Event Handling section above).

### Wrong Data Displayed
**Symptom**: Chart shows inverse odds or wrong market

**Check**:
1. Verify `isAwayTeamYes` based on Polymarket's `ordering` field
2. Ensure market classification returns correct type
3. Confirm token IDs (YES vs NO) are in correct order

### Edge Function Timeout
**Symptom**: Function execution timed out

**Solutions**:
1. Reduce data fetched (use shorter intervals)
2. Implement database caching (see `08_database_caching.md`)
3. Use appropriate `fidelity` parameter (60 for hourly)

---

## Caching Strategy

### React Query (Client-Side)
```typescript
const { data } = useQuery({
  queryKey: ['polymarket-all', league, awayTeam, homeTeam],
  queryFn: () => getAllMarketsData(awayTeam, homeTeam, league),
  staleTime: 5 * 60 * 1000,  // 5 minutes
  cacheTime: 10 * 60 * 1000, // 10 minutes
  retry: 1,
});
```

### Database Caching (Server-Side)
See `08_database_caching.md` for `polymarket_events` table schema and cron job setup.

---

## Quick Reference

### Converting Probability to American Odds
```typescript
function probabilityToAmericanOdds(p: number): number {
  if (p >= 0.5) {
    return Math.round(-1 * (p / (1 - p)) * 100);  // Favorite: -170
  } else {
    return Math.round((1 - p) / p * 100);         // Underdog: +170
  }
}
```

### Test API Manually
```bash
# Get sports
curl https://gamma-api.polymarket.com/sports

# Get NFL events
curl "https://gamma-api.polymarket.com/events?tag_id=450&closed=false&limit=10"

# Get price history
curl "https://clob.polymarket.com/prices-history?market=TOKEN_ID&interval=1h&fidelity=60"
```

---

## Related Files

| File | Purpose |
|------|---------|
| `src/services/polymarketService.ts` | API integration, team mappings |
| `src/components/PolymarketWidget.tsx` | Chart widget component |
| `src/types/polymarket.ts` | TypeScript interfaces |
| `supabase/functions/polymarket-proxy/` | CORS proxy Edge Function |
