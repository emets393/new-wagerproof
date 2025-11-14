# How We Get Polymarket Data for NFL - Complete Flow

## Overview

The system fetches NFL Polymarket data through a multi-step process that involves:
1. **Cache Check** - First checks Supabase database cache
2. **Live API Fetch** - Falls back to Polymarket APIs if cache miss
3. **Data Transformation** - Converts raw API data into usable format
4. **UI Display** - Renders the data in PolymarketWidget component

---

## Step-by-Step Flow

### 1. Entry Point: `getAllMarketsData()`

**Location:** `src/services/polymarketService.ts:920`

```typescript
export async function getAllMarketsData(
  awayTeam: string,
  homeTeam: string,
  league: 'nfl' | 'cfb' | 'ncaab' = 'nfl'
): Promise<PolymarketAllMarketsData | null>
```

**Called from:**
- `PolymarketWidget` component (line 141)
- `AIPayloadViewer` component
- `AISettings` page

**Flow:**
```
getAllMarketsData()
  ├─> getAllMarketsDataFromCache() [First attempt]
  │     └─> Checks Supabase table: polymarket_markets
  │         └─> Query: game_key = "nfl_{awayTeam}_{homeTeam}"
  │
  └─> getAllMarketsDataLive() [Fallback if cache miss]
        └─> Full API flow (see below)
```

---

### 2. Cache Check: `getAllMarketsDataFromCache()`

**Location:** `src/services/polymarketService.ts:847`

**What it does:**
- Queries `polymarket_markets` table in Supabase
- Looks for cached data using `game_key` format: `"nfl_{awayTeam}_{homeTeam}"`
- Returns cached price history and current odds if found

**Database Query:**
```typescript
const { data } = await supabase
  .from('polymarket_markets')
  .select('*')
  .eq('game_key', `nfl_${awayTeam}_${homeTeam}`)
  .eq('league', 'nfl');
```

**If cache hit:** Returns immediately with cached data ✅
**If cache miss:** Proceeds to live API fetch ⬇️

---

### 3. Live API Flow: `getAllMarketsDataLive()`

**Location:** `src/services/polymarketService.ts:771`

#### Step 3.1: Get NFL Tag ID

**Function:** `getLeagueTagId('nfl')` → `getSportsMetadata()`

**API Call:**
```
GET https://gamma-api.polymarket.com/sports
```

**Via Proxy:**
```typescript
supabase.functions.invoke('polymarket-proxy', {
  body: { action: 'sports' }
})
```

**Response Example:**
```json
[
  {
    "sport": "nfl",
    "tags": "1,450,100639",
    ...
  }
]
```

**Extraction:**
- Finds sport where `sport === 'nfl'`
- Extracts tag ID: `450` (first non-"1" tag)
- Returns: `"450"`

---

#### Step 3.2: Fetch NFL Events

**Function:** `getLeagueEvents('nfl')`

**API Call:**
```
GET https://gamma-api.polymarket.com/events?tag_id=450&closed=false&limit=100&related_tags=true
```

**Via Proxy:**
```typescript
supabase.functions.invoke('polymarket-proxy', {
  body: { 
    action: 'events',
    tagId: '450'
  }
})
```

**Response Structure:**
```json
[
  {
    "slug": "nfl-ravens-dolphins-2025-11-13",
    "title": "Ravens vs. Dolphins",
    "markets": [
      {
        "slug": "nfl-ravens-dolphins-2025-11-13-moneyline",
        "question": "Ravens vs. Dolphins",
        "active": true,
        "closed": false,
        "clobTokenIds": ["token1", "token2"]
      },
      {
        "slug": "nfl-ravens-dolphins-2025-11-13-spread",
        "question": "Ravens -3.5 spread",
        "active": true,
        "closed": false,
        "clobTokenIds": ["token3", "token4"]
      },
      {
        "slug": "nfl-ravens-dolphins-2025-11-13-total",
        "question": "Total over/under 45.5",
        "active": true,
        "closed": false,
        "clobTokenIds": ["token5", "token6"]
      }
    ]
  }
]
```

**Returns:** Array of all active NFL events

---

#### Step 3.3: Match Event to Game

**Function:** `findMatchingEvent(events, awayTeam, homeTeam, 'nfl')`

**Process:**
1. Converts team names to mascots using `getTeamMascot()`
   - Example: `"Baltimore"` → `"Ravens"`
   - Example: `"Miami"` → `"Dolphins"`

2. Parses event titles:
   - `"Ravens vs. Dolphins"` → `{ awayTeam: "Ravens", homeTeam: "Dolphins" }`
   - `"Chiefs @ Bills"` → `{ awayTeam: "Chiefs", homeTeam: "Bills" }`

3. Fuzzy matching:
   - Cleans team names (lowercase, remove special chars)
   - Checks if event teams match game teams (either direction)
   - Handles reversed order (home team listed first)

**Example Match:**
```
Game: awayTeam="Baltimore", homeTeam="Miami"
  ↓
Mascots: awayMascot="Ravens", homeMascot="Dolphins"
  ↓
Event: "Ravens vs. Dolphins"
  ↓
✅ MATCH FOUND
```

---

#### Step 3.4: Extract Market Types

**Function:** `extractAllMarketsFromEvent(event)`

**Process:**
1. Iterates through `event.markets[]`
2. Classifies each market using `classifyMarket()`:
   - **Moneyline:** Contains "vs" or "moneyline", no spread/total keywords
   - **Spread:** Contains "spread" keyword
   - **Total:** Contains "o/u", "total", or "over/under"
3. Extracts token IDs from each market:
   - From `clobTokenIds` array: `[yesTokenId, noTokenId]`
   - Or from `tokens` array: `[{outcome: "yes", token_id: "..."}, ...]`

**Result:**
```typescript
{
  moneyline: {
    yesTokenId: "token1",
    noTokenId: "token2",
    question: "Ravens vs. Dolphins"
  },
  spread: {
    yesTokenId: "token3",
    noTokenId: "token4",
    question: "Ravens -3.5 spread"
  },
  total: {
    yesTokenId: "token5",
    noTokenId: "token6",
    question: "Total over/under 45.5"
  }
}
```

---

#### Step 3.5: Fetch Price History for Each Market

**Function:** `getPriceHistory(tokenId, 'max', 60)`

**API Call:**
```
GET https://clob.polymarket.com/prices-history?market={yesTokenId}&interval=max&fidelity=60
```

**Via Proxy:**
```typescript
supabase.functions.invoke('polymarket-proxy', {
  body: {
    action: 'price-history',
    tokenId: yesTokenId,
    interval: 'max',
    fidelity: 60
  }
})
```

**Response:**
```json
{
  "history": [
    {
      "t": 1699804800,  // Unix timestamp (seconds)
      "p": 0.65         // Price/probability (0.00-1.00)
    },
    {
      "t": 1699808400,
      "p": 0.67
    },
    ...
  ]
}
```

**Returns:** Array of price points over time

---

#### Step 3.6: Transform Price History

**Function:** `transformPriceHistory(priceHistory, isAwayTeam)`

**Process:**
1. Converts each price point:
   - `t` (seconds) → `timestamp` (milliseconds)
   - `p` (0.00-1.00) → `oddsPercentage` (0-100)
   - Calculates both team odds: `awayTeamOdds` and `homeTeamOdds`

2. **For Moneyline:**
   - YES token = Away team wins
   - NO token = Home team wins
   - `isAwayTeam = true` (always)

3. **For Spread/Total:**
   - YES token = Covers/goes over
   - NO token = Doesn't cover/goes under

**Output Format:**
```typescript
[
  {
    timestamp: 1699804800000,
    awayTeamOdds: 65,
    homeTeamOdds: 35,
    awayTeamPrice: 0.65,
    homeTeamPrice: 0.35
  },
  ...
]
```

---

#### Step 3.7: Build Final Result

**Function:** `getAllMarketsDataLive()` assembles final object

**Structure:**
```typescript
{
  awayTeam: "Baltimore",
  homeTeam: "Miami",
  moneyline: {
    awayTeam,
    homeTeam,
    data: TimeSeriesPoint[],      // Price history
    currentAwayOdds: 65,           // Latest odds %
    currentHomeOdds: 35,
    volume: 0,
    marketId: "token1",
    marketType: "moneyline"
  },
  spread: { ... },
  total: { ... }
}
```

---

### 4. UI Display: PolymarketWidget

**Location:** `src/components/PolymarketWidget.tsx`

**React Query Hook:**
```typescript
const { data: allMarketsData, isLoading, error } = useQuery({
  queryKey: ['polymarket-all', league, awayTeam, homeTeam],
  queryFn: () => getAllMarketsData(awayTeam, homeTeam, league),
  staleTime: 5 * 60 * 1000, // 5 minutes cache
  retry: 1,
});
```

**What it does:**
1. Calls `getAllMarketsData()` when component mounts
2. Caches result for 5 minutes (React Query)
3. Displays:
   - Current odds for selected market type
   - Time series chart showing odds movement
   - Market type selector (Moneyline/Spread/Total)
   - Time range selector (1H/6H/1D/1W/1M/ALL)

---

## Proxy Function: `polymarket-proxy`

**Location:** `supabase/functions/polymarket-proxy/index.ts`

**Why it exists:**
- Polymarket APIs don't allow CORS from browser
- Edge Function acts as server-side proxy
- Avoids CORS issues

**Actions Supported:**
1. `action: 'sports'` → Fetches `/sports` endpoint
2. `action: 'events'` → Fetches `/events?tag_id=...` endpoint
3. `action: 'price-history'` → Fetches `/prices-history?market=...` endpoint
4. `action: 'search'` → Searches markets (deprecated)

---

## Data Flow Diagram

```
┌─────────────────┐
│ PolymarketWidget│
│   (Component)   │
└────────┬────────┘
         │
         ▼
┌─────────────────────┐
│ getAllMarketsData() │
└────────┬────────────┘
         │
         ├─► Cache Check ──► Supabase DB ──► ✅ Return Cached Data
         │
         └─► Live API Flow:
             │
             ├─► 1. getSportsMetadata()
             │      └─► Proxy: /sports ──► Get NFL tag ID (450)
             │
             ├─► 2. getLeagueEvents('nfl')
             │      └─► Proxy: /events?tag_id=450 ──► Get all NFL events
             │
             ├─► 3. findMatchingEvent()
             │      └─► Match team names ──► Find specific game event
             │
             ├─► 4. extractAllMarketsFromEvent()
             │      └─► Classify markets ──► Extract token IDs
             │
             ├─► 5. getPriceHistory() [for each market]
             │      └─► Proxy: /prices-history ──► Get price history
             │
             └─► 6. transformPriceHistory()
                    └─► Convert to time series ──► Return final data
```

---

## Key Functions Reference

| Function | Purpose | Location |
|----------|---------|----------|
| `getAllMarketsData()` | Main entry point, checks cache first | `polymarketService.ts:920` |
| `getAllMarketsDataFromCache()` | Checks Supabase cache | `polymarketService.ts:847` |
| `getAllMarketsDataLive()` | Fetches from Polymarket APIs | `polymarketService.ts:771` |
| `getSportsMetadata()` | Gets all sports and tag IDs | `polymarketService.ts:142` |
| `getLeagueTagId()` | Extracts NFL tag ID (450) | `polymarketService.ts:171` |
| `getLeagueEvents()` | Fetches all NFL events | `polymarketService.ts:195` |
| `findMatchingEvent()` | Matches game to Polymarket event | `polymarketService.ts:359` |
| `extractAllMarketsFromEvent()` | Extracts moneyline/spread/total markets | `polymarketService.ts:502` |
| `classifyMarket()` | Classifies market type | `polymarketService.ts:415` |
| `getPriceHistory()` | Fetches price history for token | `polymarketService.ts:289` |
| `transformPriceHistory()` | Converts to time series format | `polymarketService.ts:697` |
| `getTeamMascot()` | Converts city name to mascot | `polymarketService.ts:132` |
| `parseTeamsFromTitle()` | Parses "Team A vs. Team B" | `polymarketService.ts:342` |

---

## API Endpoints Used

1. **Gamma API** (via proxy):
   - `GET /sports` - Get sports metadata
   - `GET /events?tag_id=450` - Get NFL events

2. **CLOB API** (via proxy):
   - `GET /prices-history?market={tokenId}&interval=max&fidelity=60` - Get price history

---

## Caching Strategy

1. **React Query Cache:** 5 minutes (client-side)
2. **Supabase Database Cache:** Updated by cron job (`update-polymarket-cache`)
3. **Cache Key Format:** `"nfl_{awayTeam}_{homeTeam}"`

---

## Error Handling

- If cache miss → Falls back to live API
- If live API fails → Returns `null`
- If no matching event → Returns `null`
- If no price history → Skips that market type
- Widget shows loading/skeleton states during fetch
- Widget shows error message if fetch fails

---

## Example: Complete Flow for "Baltimore @ Miami"

```
1. Widget calls: getAllMarketsData("Baltimore", "Miami", "nfl")

2. Cache check: Query polymarket_markets WHERE game_key = "nfl_Baltimore_Miami"
   → Cache miss ❌

3. Live API flow:
   a. Get sports → Find NFL tag ID: 450
   b. Get events with tag 450 → Find "Ravens vs. Dolphins" event
   c. Match "Baltimore" (Ravens) + "Miami" (Dolphins) → ✅ Match found
   d. Extract markets:
      - Moneyline: tokens ["t1", "t2"]
      - Spread: tokens ["t3", "t4"]
      - Total: tokens ["t5", "t6"]
   e. Fetch price history for each token
   f. Transform to time series format

4. Return result with all 3 market types + price history

5. Widget displays:
   - Current odds: Ravens 65% / Dolphins 35%
   - Chart showing odds movement over time
   - Market type selector
```

---

## Notes

- **Team Name Matching:** Uses mascot mapping (e.g., "Baltimore" → "Ravens")
- **Market Classification:** Uses keywords in question/slug to identify market type
- **Token IDs:** Extracted from `clobTokenIds` array (first = YES, second = NO)
- **Price History:** Always fetched for YES token, then transformed for both teams
- **Caching:** Database cache is updated by background cron job, not on-demand

