# NFL Polymarket Data Fetching - Complete Audit

## Overview
This document audits the complete data flow for fetching NFL games data from Polymarket, including all API endpoints, caching mechanisms, and data transformations.

## Architecture Summary

### Data Flow Diagram
```
Frontend Request (NFL Game)
    ↓
getAllMarketsData(awayTeam, homeTeam, 'nfl')
    ↓
Try Cache First → getAllMarketsDataFromCache()
    ↓ (if cache miss)
Fall Back to Live API → getAllMarketsDataLive()
    ↓
Step 1: getLeagueEvents('nfl')
    ↓
Step 2: getSportsMetadata() → Get NFL Tag ID
    ↓
Step 3: Polymarket API → Events for NFL Tag
    ↓
Step 4: findMatchingEvent() → Match Teams
    ↓
Step 5: extractAllMarketsFromEvent() → Get Market Types
    ↓
Step 6: getPriceHistory() → Fetch Price Data for Each Market
    ↓
Return: Moneyline, Spread, Total Markets Data
```

---

## Part 1: Main Entry Points

### 1.1 Primary Function: `getAllMarketsData()`
**Location**: `src/services/polymarketService.ts` (lines 1345-1361)

```typescript
export async function getAllMarketsData(
  awayTeam: string,
  homeTeam: string,
  league: 'nfl' | 'cfb' | 'ncaab' = 'nfl'
): Promise<PolymarketAllMarketsData | null>
```

**Purpose**: Main entry point for fetching all Polymarket market data (moneyline, spread, total)

**Strategy**:
1. **First**: Try cache via `getAllMarketsDataFromCache()`
2. **Fallback**: If cache miss, use live API via `getAllMarketsDataLive()`

**NFL-Specific Behavior**:
- Default league parameter is `'nfl'`
- Uses team mascot mapping for matching (e.g., "Baltimore" → "Ravens")

---

### 1.2 Cache Layer: `getAllMarketsDataFromCache()`
**Location**: `src/services/polymarketService.ts` (lines 1272-1340)

**Database Query**:
```typescript
const gameKey = `${league}_${awayTeam}_${homeTeam}`; // e.g., "nfl_Baltimore_Miami"

const { data, error } = await supabase
  .from('polymarket_markets')
  .select('*')
  .eq('game_key', gameKey)
  .eq('league', 'nfl');
```

**Cache Structure** (polymarket_markets table):
- `game_key`: Unique identifier (format: `nfl_AwayTeam_HomeTeam`)
- `league`: League identifier (`'nfl'`)
- `market_type`: Type of market (`'moneyline'`, `'spread'`, `'total'`)
- `price_history`: Array of price history points
- `current_away_odds`: Current odds for away team
- `current_home_odds`: Current odds for home team
- `token_id`: Polymarket token ID

**Returns**: Complete market data if cached, `null` if cache miss

---

### 1.3 Live API: `getAllMarketsDataLive()`
**Location**: `src/services/polymarketService.ts` (lines 1196-1267)

**Steps**:
1. **Get NFL Tag ID** (via `getLeagueTagId('nfl')`)
2. **Fetch All NFL Events** (via `getLeagueEvents('nfl')`)
3. **Find Matching Game** (via `findMatchingEvent()`)
4. **Extract Market Types** (via `extractAllMarketsFromEvent()`)
5. **Fetch Price History** (via `getPriceHistory()` for each market)

**NFL-Specific Logic**:
```typescript
// Convert team name to mascot for matching
const awayMascot = getTeamMascot(awayTeam, 'nfl'); // "Baltimore" → "Ravens"
const homeMascot = getTeamMascot(homeTeam, 'nfl'); // "Miami" → "Dolphins"
```

---

## Part 2: Core API Functions

### 2.1 Get Sports Metadata: `getSportsMetadata()`
**Location**: `src/services/polymarketService.ts` (lines 547-571)

**Purpose**: Fetch all sports and their tag IDs from Polymarket

**API Endpoint**:
```
GET https://gamma-api.polymarket.com/sports
```

**Proxy Route** (via Supabase Edge Function):
```typescript
const { data, error } = await supabase.functions.invoke('polymarket-proxy', {
  body: { action: 'sports' }
});
```

**Proxy Implementation** (`supabase/functions/polymarket-proxy/index.ts`, lines 157-184):
```typescript
if (action === 'sports') {
  const url = 'https://gamma-api.polymarket.com/sports';
  const response = await fetch(url, {
    headers: {
      'Accept': 'application/json',
      'User-Agent': 'WagerProof-PolymarketIntegration/1.0'
    }
  });
  // Returns: { sports: [...] }
}
```

**Response Format**:
```typescript
interface PolymarketSport {
  sport: string;        // e.g., "nfl"
  tags: string;         // e.g., "1,450,100639" (comma-separated tag IDs)
  series: string;       // Series ID
  ordering: string;     // Display ordering
}
```

---

### 2.2 Get League Tag ID: `getLeagueTagId()`
**Location**: `src/services/polymarketService.ts` (lines 576-596)

**Purpose**: Extract the NFL tag ID from sports metadata

**NFL-Specific Logic**:
```typescript
async function getLeagueTagId(league: 'nfl' | 'cfb' | 'ncaab'): Promise<string | null> {
  const sports = await getSportsMetadata();
  
  // Polymarket uses 'nfl' for NFL (same as our identifier)
  const sportName = league === 'nfl' ? 'nfl' : league === 'cfb' ? 'cfb' : 'cbb';
  
  const sport = sports.find((s) => s.sport?.toLowerCase() === 'nfl');
  
  // tags is comma-separated like "1,450,100639"
  const tagCandidates = sport.tags.split(',').map(t => t.trim()).filter(Boolean);
  
  // Prefer the first tag that's not "1" (generic umbrella tag)
  const primaryTagId = tagCandidates.find(t => t !== '1') || tagCandidates[0];
  
  return primaryTagId; // e.g., "450"
}
```

**Tag Selection Strategy**:
- Parse comma-separated tag IDs
- Skip tag "1" (generic sports umbrella tag)
- Use first specific tag (typically the primary NFL tag)

---

### 2.3 Get League Events: `getLeagueEvents()`
**Location**: `src/services/polymarketService.ts` (lines 601-636)

**Purpose**: Fetch all NFL events/games from Polymarket

**API Endpoint**:
```
GET https://gamma-api.polymarket.com/events?tag_id={tagId}&closed=false&limit=100&related_tags=true
```

**Parameters**:
- `tag_id`: NFL tag ID (from `getLeagueTagId()`)
- `closed`: `false` (only active/open markets)
- `limit`: `100` (max events per request)
- `related_tags`: `true` (include related tag information)

**Proxy Route**:
```typescript
const { data, error } = await supabase.functions.invoke('polymarket-proxy', {
  body: { 
    action: 'events', 
    tagId: nflTagId  // e.g., "450"
  }
});
```

**Proxy Implementation** (`supabase/functions/polymarket-proxy/index.ts`, lines 186-228):
```typescript
if (action === 'events') {
  const params = new URLSearchParams({
    tag_id: tagId,          // NFL tag ID
    closed: 'false',        // Only open markets
    limit: '100',           // Max results
    related_tags: 'true',   // Include related tags
  });

  const url = `https://gamma-api.polymarket.com/events?${params.toString()}`;
  const response = await fetch(url, {
    headers: {
      'Accept': 'application/json',
      'User-Agent': 'WagerProof-PolymarketIntegration/1.0'
    }
  });
  
  const data = await response.json();
  const events = Array.isArray(data) ? data : (data.events || data.data || []);
  
  return { events }; // Array of PolymarketEvent objects
}
```

**Response Format**:
```typescript
interface PolymarketEvent {
  slug: string;              // e.g., "ravens-vs-dolphins"
  title: string;             // e.g., "Ravens vs. Dolphins"
  markets: PolymarketEventMarket[];  // Array of markets
  game_start_time?: string;  // ISO timestamp
  gameStartTime?: string;    // Alternative field name
}
```

---

## Part 3: Game Matching & Market Extraction

### 3.1 Team Name Mapping: `getTeamMascot()`
**Location**: `src/services/polymarketService.ts` (lines 537-542)

**Purpose**: Convert city/state name to team mascot for Polymarket matching

**NFL Team Mascots Dictionary** (lines 63-98):
```typescript
const NFL_TEAM_MASCOTS: Record<string, string> = {
  'Arizona': 'Cardinals',
  'Atlanta': 'Falcons',
  'Baltimore': 'Ravens',
  'Buffalo': 'Bills',
  'Carolina': 'Panthers',
  'Chicago': 'Bears',
  'Cincinnati': 'Bengals',
  'Cleveland': 'Browns',
  'Dallas': 'Cowboys',
  'Denver': 'Broncos',
  'Detroit': 'Lions',
  'Green Bay': 'Packers',
  'Houston': 'Texans',
  'Indianapolis': 'Colts',
  'Jacksonville': 'Jaguars',
  'Kansas City': 'Chiefs',
  'Las Vegas': 'Raiders',
  'Los Angeles Chargers': 'Chargers',
  'Los Angeles Rams': 'Rams',
  'LA Chargers': 'Chargers',
  'LA Rams': 'Rams',
  'Miami': 'Dolphins',
  'Minnesota': 'Vikings',
  'New England': 'Patriots',
  'New Orleans': 'Saints',
  'NY Giants': 'Giants',
  'NY Jets': 'Jets',
  'Philadelphia': 'Eagles',
  'Pittsburgh': 'Steelers',
  'San Francisco': '49ers',
  'Seattle': 'Seahawks',
  'Tampa Bay': 'Buccaneers',
  'Tennessee': 'Titans',
  'Washington': 'Commanders',
};
```

**Function**:
```typescript
function getTeamMascot(teamName: string, league: 'nfl' | 'cfb' | 'ncaab' = 'nfl'): string {
  if (league === 'nfl') {
    return NFL_TEAM_MASCOTS[teamName] || teamName;
  }
  // CFB/NCAAB use different mappings
}
```

**Example**:
- Input: `"Baltimore"` → Output: `"Ravens"`
- Input: `"Miami"` → Output: `"Dolphins"`

---

### 3.2 Parse Event Title: `parseTeamsFromTitle()`
**Location**: `src/services/polymarketService.ts` (lines 748-760)

**Purpose**: Extract team names from Polymarket event title

**Supported Formats**:
- `"Team A vs. Team B"` (with period)
- `"Team A @ Team B"` (@ symbol)

**Implementation**:
```typescript
function parseTeamsFromTitle(title: string): { awayTeam: string; homeTeam: string } | null {
  if (!title) return null;

  if (title.includes(' vs. ')) {
    const [away, home] = title.split(' vs. ').map(s => s.trim());
    if (away && home) return { awayTeam: away, homeTeam: home };
  } else if (title.includes(' @ ')) {
    const [away, home] = title.split(' @ ').map(s => s.trim());
    if (away && home) return { awayTeam: away, homeTeam: home };
  }

  return null;
}
```

**Examples**:
- `"Ravens vs. Dolphins"` → `{ awayTeam: "Ravens", homeTeam: "Dolphins" }`
- `"Chiefs @ Bills"` → `{ awayTeam: "Chiefs", homeTeam: "Bills" }`

---

### 3.3 Find Matching Event: `findMatchingEvent()`
**Location**: `src/services/polymarketService.ts` (lines 765-834)

**Purpose**: Find the NFL event that matches our game's teams

**Matching Algorithm**:
```typescript
async function findMatchingEvent(
  events: PolymarketEvent[],
  awayTeam: string,
  homeTeam: string,
  league: 'nfl' = 'nfl'
): Promise<PolymarketEvent | null> {
  
  // Step 1: Convert our team names to Polymarket format
  const awayPolymarketName = getTeamMascot(awayTeam, 'nfl'); // "Baltimore" → "Ravens"
  const homePolymarketName = getTeamMascot(homeTeam, 'nfl'); // "Miami" → "Dolphins"
  
  // Step 2: Clean names for fuzzy matching
  const cleanTeamName = (name: string) =>
    name.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
  
  // Step 3: Loop through all NFL events
  for (const event of events) {
    const parsedTeams = parseTeamsFromTitle(event.title);
    
    if (!parsedTeams) continue;
    
    // Clean event team names
    const eventAway = cleanTeamName(parsedTeams.awayTeam);
    const eventHome = cleanTeamName(parsedTeams.homeTeam);
    const awayClean = cleanTeamName(awayPolymarketName);
    const homeClean = cleanTeamName(homePolymarketName);
    
    // Step 4: Check forward match (Away vs Home)
    const awayMatch = eventAway.includes(awayClean) || 
                      eventAway.includes(cleanTeamName(awayTeam)) ||
                      awayClean.includes(eventAway.split(' ')[0]) ||
                      eventAway.includes(awayClean.split(' ')[0]);
                      
    const homeMatch = eventHome.includes(homeClean) ||
                      eventHome.includes(cleanTeamName(homeTeam)) ||
                      homeClean.includes(eventHome.split(' ')[0]) ||
                      eventHome.includes(homeClean.split(' ')[0]);
    
    // Step 5: Check reverse match (Home vs Away - sometimes Polymarket lists home first)
    const awayMatchReversed = eventHome.includes(awayClean) || ...;
    const homeMatchReversed = eventAway.includes(homeClean) || ...;
    
    // Step 6: Return if either direction matches
    if ((awayMatch && homeMatch) || (awayMatchReversed && homeMatchReversed)) {
      return event; // Found match!
    }
  }
  
  return null; // No match found
}
```

**Matching Strategy**:
1. Uses fuzzy matching (partial string matching)
2. Checks both directions (Away vs Home and Home vs Away)
3. Supports multiple formats (full name, partial name, first word)
4. Case-insensitive and removes special characters

**Example**:
- Looking for: `"Baltimore"` vs `"Miami"`
- Converted to: `"Ravens"` vs `"Dolphins"`
- Matches Polymarket event: `"Ravens vs. Dolphins"`

---

### 3.4 Market Classification: `classifyMarket()`
**Location**: `src/services/polymarketService.ts` (lines 840-885)

**Purpose**: Determine market type (moneyline, spread, total) from question/slug

**Market Types**:
```typescript
type MarketType = 'moneyline' | 'spread' | 'total';
```

**Classification Logic**:
```typescript
function classifyMarket(
  question: string, 
  slug: string, 
  awayTeam?: string, 
  homeTeam?: string
): MarketType | null {
  const qLower = question.toLowerCase();
  const sLower = slug.toLowerCase();

  // Skip 1st half markets
  if (qLower.includes('1h') || sLower.includes('-1h-')) {
    return null;
  }

  // Check for spread
  if (qLower.includes('spread') || sLower.includes('-spread-')) {
    return 'spread';
  }

  // Check for total/over-under
  if (qLower.includes('o/u') || qLower.includes('total') || sLower.includes('-total-')) {
    return 'total';
  }

  // Check for explicit moneyline
  if (qLower.includes('moneyline') || sLower.includes('-moneyline')) {
    return 'moneyline';
  }

  // Default: Plain "Team A vs. Team B" = moneyline
  if (qLower.includes(' vs ') || qLower.includes(' vs. ')) {
    return 'moneyline';
  }

  return null;
}
```

**Market Type Indicators**:
- **Spread**: Question/slug contains "spread"
- **Total**: Question/slug contains "o/u", "total"
- **Moneyline**: Question contains "vs" or "moneyline" OR no specific indicator

**Examples**:
- `"Will Ravens beat Dolphins?"` → `moneyline`
- `"Ravens vs. Dolphins spread"` → `spread`
- `"Total points Ravens vs. Dolphins"` → `total`

---

### 3.5 Extract All Markets: `extractAllMarketsFromEvent()`
**Location**: `src/services/polymarketService.ts` (lines 927-962)

**Purpose**: Extract moneyline, spread, and total markets from an event

**Implementation**:
```typescript
function extractAllMarketsFromEvent(
  event: PolymarketEvent
): Partial<Record<MarketType, { yesTokenId: string; noTokenId: string; question: string }>> {
  const result: Partial<Record<MarketType, { ... }>> = {};

  if (!event.markets || event.markets.length === 0) {
    return result;
  }

  // Extract team names for better classification
  const teams = parseTeamsFromTitle(event.title);
  const awayTeam = teams?.awayTeam;
  const homeTeam = teams?.homeTeam;

  // Loop through all markets in the event
  for (const market of event.markets) {
    // Skip inactive/closed markets
    if (!market.active || market.closed) continue;

    // Classify market type
    const marketType = classifyMarket(market.question, market.slug, awayTeam, homeTeam);
    if (!marketType) continue;

    // Skip if we already have this market type
    if (result[marketType]) continue;

    // Extract token IDs
    const tokens = extractTokensFromMarket(market);
    if (!tokens) continue;

    result[marketType] = {
      ...tokens,
      question: market.question,
    };
  }

  return result;
}
```

**Returns**:
```typescript
{
  moneyline: {
    yesTokenId: "0x...",
    noTokenId: "0x...",
    question: "Will Ravens beat Dolphins?"
  },
  spread: {
    yesTokenId: "0x...",
    noTokenId: "0x...",
    question: "Ravens vs. Dolphins spread"
  },
  total: {
    yesTokenId: "0x...",
    noTokenId: "0x...",
    question: "Total points Ravens vs. Dolphins"
  }
}
```

---

### 3.6 Extract Token IDs: `extractTokensFromMarket()`
**Location**: `src/services/polymarketService.ts` (lines 890-922)

**Purpose**: Extract YES and NO token IDs from a market

**Token ID Sources** (in priority order):
1. **`market.tokens` array** (preferred)
2. **`market.clobTokenIds` array** (fallback)

**Implementation**:
```typescript
function extractTokensFromMarket(
  market: PolymarketEventMarket
): { yesTokenId: string; noTokenId: string } | null {
  let yesTokenId: string | null = null;
  let noTokenId: string | null = null;

  // Source 1: tokens array
  if (market.tokens && Array.isArray(market.tokens)) {
    const yesToken = market.tokens.find(t => (t.outcome || '').toLowerCase() === 'yes');
    const noToken = market.tokens.find(t => (t.outcome || '').toLowerCase() === 'no');
    
    yesTokenId = yesToken?.token_id || null;
    noTokenId = noToken?.token_id || null;
  }
  
  // Source 2: clobTokenIds (fallback)
  else if (market.clobTokenIds) {
    if (typeof market.clobTokenIds === 'string') {
      // Parse JSON string
      const arr = JSON.parse(market.clobTokenIds);
      if (Array.isArray(arr) && arr.length >= 2) {
        yesTokenId = arr[0];
        noTokenId = arr[1];
      }
    } else if (Array.isArray(market.clobTokenIds) && market.clobTokenIds.length >= 2) {
      yesTokenId = market.clobTokenIds[0];
      noTokenId = market.clobTokenIds[1];
    }
  }

  if (!yesTokenId) return null;
  
  return { yesTokenId, noTokenId: noTokenId || '' };
}
```

**Token ID Format**:
- Long hexadecimal string (e.g., `"0x1234567890abcdef..."`)
- YES token represents first outcome (typically away team)
- NO token represents second outcome (typically home team)

---

## Part 4: Price History

### 4.1 Get Price History: `getPriceHistory()`
**Location**: `src/services/polymarketService.ts` (lines 695-742)

**Purpose**: Fetch historical price data for a token

**API Endpoint**:
```
GET https://clob.polymarket.com/prices-history?market={tokenId}&interval={interval}&fidelity={fidelity}
```

**Parameters**:
- `tokenId`: Token ID (from market extraction)
- `interval`: Time interval (`'max'` for all history, or time range)
- `fidelity`: Data granularity in seconds (default: `60`)

**Proxy Route**:
```typescript
const { data, error } = await supabase.functions.invoke('polymarket-proxy', {
  body: {
    action: 'price-history',
    tokenId: tokenId,
    interval: interval,    // 'max'
    fidelity: fidelity,    // 60
  }
});
```

**Proxy Implementation** (`supabase/functions/polymarket-proxy/index.ts`, lines 120-155):
```typescript
if (action === 'price-history') {
  const params = new URLSearchParams({
    market: tokenId,
    interval: interval || 'max',
    fidelity: String(fidelity || 60),
  });

  const url = `https://clob.polymarket.com/prices-history?${params.toString()}`;
  const response = await fetch(url);
  
  const data = await response.json();
  return data; // { history: [...] }
}
```

**Response Format**:
```typescript
interface PriceHistoryResponse {
  history: PriceHistoryPoint[];
}

interface PriceHistoryPoint {
  t: number; // Unix timestamp in seconds
  p: number; // Price (0.00-1.00)
}
```

**Example**:
```json
{
  "history": [
    { "t": 1699999200, "p": 0.52 },
    { "t": 1699999260, "p": 0.53 },
    { "t": 1699999320, "p": 0.51 }
  ]
}
```

---

### 4.2 Transform Price History: `transformPriceHistory()`
**Location**: `src/services/polymarketService.ts` (lines 1122-1153)

**Purpose**: Convert Polymarket price history to our time series format

**Implementation**:
```typescript
function transformPriceHistory(
  priceHistory: PriceHistoryPoint[],
  isAwayTeam: boolean
): TimeSeriesPoint[] {
  if (!priceHistory || priceHistory.length === 0) return [];

  return priceHistory.map((point) => {
    const probability = point.p;              // 0.00-1.00
    const timestampMs = point.t * 1000;       // Convert to milliseconds
    const oddsPercentage = Math.round(probability * 100);
    
    if (isAwayTeam) {
      return {
        timestamp: timestampMs,
        awayTeamOdds: oddsPercentage,
        homeTeamOdds: 100 - oddsPercentage,
        awayTeamPrice: probability,
        homeTeamPrice: 1 - probability,
      };
    } else {
      return {
        timestamp: timestampMs,
        awayTeamOdds: 100 - oddsPercentage,
        homeTeamOdds: oddsPercentage,
        awayTeamPrice: 1 - probability,
        homeTeamPrice: probability,
      };
    }
  });
}
```

**Transformation**:
- Convert timestamp from seconds to milliseconds
- Convert probability (0-1) to percentage (0-100)
- Calculate complementary odds for other team
- Preserve raw prices for calculations

**Input Example**:
```json
{ "t": 1699999200, "p": 0.52 }
```

**Output Example**:
```json
{
  "timestamp": 1699999200000,
  "awayTeamOdds": 52,
  "homeTeamOdds": 48,
  "awayTeamPrice": 0.52,
  "homeTeamPrice": 0.48
}
```

---

## Part 5: Return Format

### 5.1 Final Data Structure
```typescript
interface PolymarketAllMarketsData {
  awayTeam: string;
  homeTeam: string;
  moneyline?: PolymarketTimeSeriesData;
  spread?: PolymarketTimeSeriesData;
  total?: PolymarketTimeSeriesData;
}

interface PolymarketTimeSeriesData {
  awayTeam: string;
  homeTeam: string;
  data: TimeSeriesPoint[];        // Array of price points over time
  currentAwayOdds: number;        // Latest odds for away team (0-100)
  currentHomeOdds: number;        // Latest odds for home team (0-100)
  volume: number;                 // Trading volume (0 if not available)
  marketId: string;               // Token ID
  marketType: MarketType;         // 'moneyline' | 'spread' | 'total'
}

interface TimeSeriesPoint {
  timestamp: number;              // Unix timestamp in milliseconds
  awayTeamOdds: number;          // Away team odds (0-100)
  homeTeamOdds: number;          // Home team odds (0-100)
  awayTeamPrice: number;         // Away team price (0-1)
  homeTeamPrice: number;         // Home team price (0-1)
}
```

### 5.2 Example Response for NFL Game
```json
{
  "awayTeam": "Baltimore",
  "homeTeam": "Miami",
  "moneyline": {
    "awayTeam": "Baltimore",
    "homeTeam": "Miami",
    "currentAwayOdds": 52,
    "currentHomeOdds": 48,
    "marketId": "0x1234...",
    "marketType": "moneyline",
    "volume": 0,
    "data": [
      {
        "timestamp": 1699999200000,
        "awayTeamOdds": 50,
        "homeTeamOdds": 50,
        "awayTeamPrice": 0.50,
        "homeTeamPrice": 0.50
      },
      {
        "timestamp": 1699999260000,
        "awayTeamOdds": 52,
        "homeTeamOdds": 48,
        "awayTeamPrice": 0.52,
        "homeTeamPrice": 0.48
      }
    ]
  },
  "spread": {
    "awayTeam": "Baltimore",
    "homeTeam": "Miami",
    "currentAwayOdds": 55,
    "currentHomeOdds": 45,
    "marketId": "0x5678...",
    "marketType": "spread",
    "volume": 0,
    "data": [...]
  },
  "total": {
    "awayTeam": "Baltimore",
    "homeTeam": "Miami",
    "currentAwayOdds": 48,
    "currentHomeOdds": 52,
    "marketId": "0x9abc...",
    "marketType": "total",
    "volume": 0,
    "data": [...]
  }
}
```

---

## Part 6: Edge Cases & Error Handling

### 6.1 No NFL Tag Found
**Issue**: Polymarket API doesn't return NFL sport metadata

**Handling**:
```typescript
const tagId = await getLeagueTagId('nfl');
if (!tagId) {
  debug.error('❌ Could not get NFL tag ID');
  return null;
}
```

**Resolution**: Returns `null`, frontend should handle gracefully

---

### 6.2 No Matching Event
**Issue**: NFL game not found in Polymarket events

**Handling**:
```typescript
const event = await findMatchingEvent(events, awayTeam, homeTeam, 'nfl');
if (!event) {
  debug.log('❌ No matching event found for this game');
  return null;
}
```

**Possible Reasons**:
- Game not available on Polymarket
- Team name mismatch (not in mascot dictionary)
- Event title format doesn't match expectations

**Resolution**: Returns `null`, frontend should show "Not Available"

---

### 6.3 No Markets in Event
**Issue**: Event exists but has no active markets

**Handling**:
```typescript
const allMarkets = extractAllMarketsFromEvent(event);
if (Object.keys(allMarkets).length === 0) {
  debug.log('⚠️ No active markets found in event');
  return { awayTeam, homeTeam }; // Empty result
}
```

**Possible Reasons**:
- All markets are closed
- Markets are inactive
- No moneyline/spread/total markets available

---

### 6.4 No Price History
**Issue**: Token ID exists but no price history available

**Handling**:
```typescript
const priceHistory = await getPriceHistory(marketData.yesTokenId, 'max', 60);
if (!priceHistory || priceHistory.length === 0) {
  debug.log(`⚠️ No price history for ${marketType}`);
  continue; // Skip this market type
}
```

**Possible Reasons**:
- New market with no trading history
- API error
- Token ID invalid

---

## Part 7: Performance Optimizations

### 7.1 Caching Strategy

**Cache Duration**: 24 hours for team data
```typescript
const TEAMS_CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours
```

**Cache Layers**:
1. **In-Memory Cache**: Polymarket teams (CBB/CFB only)
2. **Database Cache**: Complete market data (polymarket_markets table)

**Cache Keys**:
```typescript
// In-memory team cache
const cacheKey = league; // 'cbb' or 'cfb'

// Database market cache
const gameKey = `${league}_${awayTeam}_${homeTeam}`; // 'nfl_Baltimore_Miami'
```

---

### 7.2 API Request Optimization

**Batch Requests**: Fetch all NFL events once, then filter locally
```typescript
// Good: Single API call for all NFL events
const events = await getLeagueEvents('nfl');
const event = findMatchingEvent(events, awayTeam, homeTeam);

// Bad: Individual API calls per game (not used)
// const event = await searchForSpecificGame(awayTeam, homeTeam);
```

**Parallel Price Fetches**: Fetch price history for all market types in parallel
```typescript
const priceHistoryPromises = Object.entries(allMarkets).map(async ([type, data]) => {
  const history = await getPriceHistory(data.yesTokenId);
  return { type, history };
});

const results = await Promise.all(priceHistoryPromises);
```

---

### 7.3 Proxy Benefits

**Why Use Proxy**:
1. **CORS Bypass**: Polymarket API doesn't allow direct browser calls
2. **Rate Limiting**: Centralized control over API usage
3. **Error Handling**: Consistent error responses
4. **Headers Management**: User-Agent, Accept headers

**Proxy Endpoint**: `supabase/functions/polymarket-proxy/index.ts`

**Usage**:
```typescript
const USE_PROXY = true; // Always true in production
```

---

## Part 8: NFL-Specific Considerations

### 8.1 Team Name Variations

**Challenges**:
- Our database: `"Baltimore"` (city name)
- Polymarket: `"Ravens"` (mascot name) OR `"Baltimore Ravens"` (full name)

**Solution**: Mascot mapping dictionary
```typescript
const NFL_TEAM_MASCOTS: Record<string, string> = {
  'Baltimore': 'Ravens',
  'Miami': 'Dolphins',
  // ... all 32 teams
};
```

**Special Cases**:
- LA teams: Both `"LA Rams"` and `"Los Angeles Rams"` supported
- NY teams: Both `"NY Giants"` and `"NY Jets"` differentiated

---

### 8.2 Market Type Preferences

**NFL Market Hierarchy** (in order of importance):
1. **Moneyline**: Primary betting market (who wins)
2. **Spread**: Point differential market
3. **Total**: Over/under points market

**UI Display**: All three market types shown when available

---

### 8.3 Timing Considerations

**Game States**:
- **Pre-game**: Full market data available
- **Live**: Markets remain open (odds update in real-time)
- **Post-game**: Markets closed (no longer fetched)

**API Filter**: `closed=false` ensures only active markets are returned

---

## Part 9: Data Flow Sequence Diagram

```
User Views NFL Game Page
    ↓
Component calls getAllMarketsData("Baltimore", "Miami", "nfl")
    ↓
[Cache Check]
    ↓
Query polymarket_markets table
    WHERE game_key = 'nfl_Baltimore_Miami'
    AND league = 'nfl'
    ↓
[Cache Hit] → Return cached data
    |
[Cache Miss] → Continue to Live API
    ↓
[Live API Flow]
    ↓
Step 1: getLeagueTagId('nfl')
    ↓
    getSportsMetadata()
        ↓
        Proxy: polymarket-proxy/sports
            ↓
            GET https://gamma-api.polymarket.com/sports
            ↓
            Returns: [{ sport: "nfl", tags: "1,450,100639", ... }]
        ↓
    Extract NFL tag: "450"
    ↓
Step 2: getLeagueEvents('nfl')
    ↓
    Proxy: polymarket-proxy/events
        ↓
        GET https://gamma-api.polymarket.com/events?tag_id=450&closed=false&limit=100
        ↓
        Returns: [
            { slug: "ravens-vs-dolphins", title: "Ravens vs. Dolphins", markets: [...] },
            { slug: "chiefs-vs-bills", title: "Chiefs vs. Bills", markets: [...] },
            ...
        ]
    ↓
Step 3: findMatchingEvent(events, "Baltimore", "Miami", "nfl")
    ↓
    Convert teams: "Baltimore" → "Ravens", "Miami" → "Dolphins"
    ↓
    Loop through events, find match
        ↓
        Parse title: "Ravens vs. Dolphins" → { awayTeam: "Ravens", homeTeam: "Dolphins" }
        ↓
        Fuzzy match: "Ravens" includes "Ravens" AND "Dolphins" includes "Dolphins"
        ↓
        Match found!
    ↓
Step 4: extractAllMarketsFromEvent(event)
    ↓
    Loop through event.markets
        ↓
        Market 1: { question: "Will Ravens beat Dolphins?", slug: "ravens-vs-dolphins" }
            ↓
            classifyMarket() → "moneyline"
            ↓
            extractTokensFromMarket() → { yesTokenId: "0x1234...", noTokenId: "0x5678..." }
        ↓
        Market 2: { question: "Ravens vs. Dolphins spread", slug: "ravens-vs-dolphins-spread" }
            ↓
            classifyMarket() → "spread"
            ↓
            extractTokensFromMarket() → { yesTokenId: "0xabcd...", noTokenId: "0xef01..." }
        ↓
        Market 3: { question: "Total points Ravens vs. Dolphins", slug: "ravens-vs-dolphins-total" }
            ↓
            classifyMarket() → "total"
            ↓
            extractTokensFromMarket() → { yesTokenId: "0x2345...", noTokenId: "0x6789..." }
    ↓
    Returns: { moneyline: {...}, spread: {...}, total: {...} }
    ↓
Step 5: For each market type, getPriceHistory(tokenId)
    ↓
    [Moneyline]
        ↓
        Proxy: polymarket-proxy/price-history
            ↓
            GET https://clob.polymarket.com/prices-history?market=0x1234...&interval=max&fidelity=60
            ↓
            Returns: { history: [{ t: 1699999200, p: 0.52 }, { t: 1699999260, p: 0.53 }, ...] }
        ↓
        transformPriceHistory() → [
            { timestamp: 1699999200000, awayTeamOdds: 52, homeTeamOdds: 48, ... },
            { timestamp: 1699999260000, awayTeamOdds: 53, homeTeamOdds: 47, ... }
        ]
    ↓
    [Spread] (repeat price history fetch)
    ↓
    [Total] (repeat price history fetch)
    ↓
Step 6: Assemble final result
    ↓
    {
        awayTeam: "Baltimore",
        homeTeam: "Miami",
        moneyline: { data: [...], currentAwayOdds: 52, currentHomeOdds: 48, ... },
        spread: { data: [...], currentAwayOdds: 55, currentHomeOdds: 45, ... },
        total: { data: [...], currentAwayOdds: 48, currentHomeOdds: 52, ... }
    }
    ↓
Return to component
    ↓
Component renders Polymarket widget with charts and odds
```

---

## Part 10: Key Insights

### 10.1 What Makes NFL Data Fetching Unique

1. **Tag-Based Filtering**: Uses NFL-specific tag ID to filter events
2. **Mascot Mapping**: Converts city names to team mascots for matching
3. **Multi-Market Support**: Fetches moneyline, spread, and total in single flow
4. **Fuzzy Matching**: Robust team name matching with multiple fallbacks

---

### 10.2 Reliability Features

1. **Cache-First Strategy**: Reduces API calls and improves speed
2. **Graceful Degradation**: Returns partial data if some markets unavailable
3. **Extensive Logging**: Debug logs for every step of the process
4. **Error Boundaries**: Each step has error handling and null returns

---

### 10.3 API Dependencies

**External APIs**:
1. **Polymarket Gamma API**: 
   - `/sports` - Sports metadata
   - `/events` - Event listings
   
2. **Polymarket CLOB API**:
   - `/prices-history` - Price history data

**Internal APIs**:
1. **Supabase Edge Function**: `polymarket-proxy`
2. **Supabase Database**: `polymarket_markets` table (cache)

---

## Part 11: Potential Issues & Recommendations

### 11.1 Current Limitations

1. **No Direct NFL Tag**: Relies on parsing sports metadata
2. **Manual Mascot Mapping**: Requires updating for new teams/name changes
3. **No Volume Data**: Trading volume not available from events API
4. **Single Page Limit**: Events endpoint limited to 100 per request

### 11.2 Recommendations

1. **Cache Warm-Up**: Pre-fetch NFL events on page load
2. **Tag ID Storage**: Cache NFL tag ID in database
3. **Team Mapping Service**: Create admin UI for managing team mappings
4. **Pagination Support**: Handle >100 NFL events (if needed)
5. **Webhook Integration**: Listen for Polymarket updates (real-time odds)

---

## Summary

The NFL Polymarket data fetching system is well-architected with:
- ✅ Clear separation of concerns (cache vs. live API)
- ✅ Robust team matching with fuzzy logic
- ✅ Multi-market support (moneyline, spread, total)
- ✅ Comprehensive error handling
- ✅ Performance optimizations (caching, batch requests)

The flow specifically filters for NFL games by:
1. Fetching NFL tag ID from sports metadata
2. Using tag ID to fetch only NFL events
3. Matching teams using mascot dictionary
4. Extracting all market types from matched event
5. Transforming price data into consistent format

This ensures that **only NFL games** are fetched and displayed with accurate market data.

