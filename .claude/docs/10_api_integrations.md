# External API Integrations

> Last verified: January 2025

## Overview

WagerProof integrates with several external APIs for odds, scores, and data enrichment:

| API | Purpose | Service File |
|-----|---------|--------------|
| The Odds API | Sportsbook odds, betslip links | `src/services/theOddsApi.ts` |
| ESPN API | Live scores (via Edge Function) | `supabase/functions/fetch-live-scores/` |
| Weather API | Game weather conditions | Stored in predictions database |

---

## The Odds API

### Overview
Real-time betting odds from US sportsbooks with direct betslip links.

**Base URL**: `https://api.the-odds-api.com/v4`
**Auth**: API key via `VITE_THE_ODDS_API_KEY` environment variable

### Key Functions (`theOddsApi.ts`)

```typescript
// Fetch odds for a sport
fetchOdds(sportKey: string, bookmakers?: string[], useCache?: boolean): Promise<OddsApiResponse>

// Find matching event for a game
findMatchingEvent(awayTeam: string, homeTeam: string, events: OddsApiEvent[]): OddsApiEvent | null

// Get betslip link for a specific bet
findBetOdds(event: OddsApiEvent, sportsbookKey: string, betType: string, teamName?: string, line?: number)
```

### Sport Keys

```typescript
// src/utils/sportsbookConfig.ts
const SPORT_KEY_MAP = {
  'nfl': 'americanfootball_nfl',
  'cfb': 'americanfootball_ncaaf',
  'nba': 'basketball_nba',
  'ncaab': 'basketball_ncaab',
};
```

### Supported Sportsbooks

**Top 5 (Primary buttons)**:
- DraftKings (`draftkings`)
- FanDuel (`fanduel`)
- BetMGM (`betmgm`)
- BetRivers (`betrivers`)
- ESPN BET (`espnbet`)

**Additional (Dropdown)**:
- BetOnline.ag, BetUS, Bovada, LowVig.ag, MyBookie.ag, Bally Bet, betPARX, Fliff, Hard Rock Bet

### API Request Parameters

```typescript
const params = {
  regions: 'us',
  markets: 'h2h,spreads,totals',  // Moneyline, spread, totals
  bookmakers: 'draftkings,fanduel,...',
  apiKey: API_KEY,
  includeLinks: 'true',  // Include betslip deep links
};
```

### Response Structure

```typescript
interface OddsApiEvent {
  id: string;
  sport_key: string;
  sport_title: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers?: Bookmaker[];
}

interface Bookmaker {
  key: string;
  title: string;
  link?: string;  // Event page link
  markets: Market[];
}

interface Market {
  key: string;  // 'h2h', 'spreads', 'totals'
  outcomes: Outcome[];
}

interface Outcome {
  name: string;
  price: number;    // American odds (-110, +150)
  point?: number;   // Spread/total line
  link?: string;    // Betslip deep link
}
```

### Caching

```typescript
// src/services/oddsCache.ts
getCachedOdds(sportKey: string): OddsApiEvent[] | null
setCachedOdds(sportKey: string, events: OddsApiEvent[]): void
getCacheAge(sportKey: string): number  // seconds
```

### Request Deduplication

The service prevents duplicate API calls when multiple components request the same sport simultaneously:

```typescript
const activeRequests = new Map<string, Promise<OddsApiResponse>>();

// If request already in progress, return existing promise
const existingRequest = activeRequests.get(requestKey);
if (existingRequest) return existingRequest;
```

### Rate Limiting

- Headers: `x-requests-remaining`, `x-requests-used`
- Handle `OUT_OF_USAGE_CREDITS` error (401)
- Default: fetch top 5 bookmakers only to conserve quota

---

## ESPN/Live Scores API

### Overview
Live game scores fetched via Edge Function, stored in `live_scores` table.

**Service**: `src/services/liveScoresService.ts`
**Edge Function**: `supabase/functions/fetch-live-scores/`

### Supported Leagues

| League | Code | Game ID Format |
|--------|------|----------------|
| NFL | `NFL` | `NFL-{espn_id}` |
| College Football | `NCAAF` | `NCAAF-{espn_id}` |
| NBA | `NBA` | `NBA-{espn_id}` |
| College Basketball | `NCAAB` | `NCAAB-{espn_id}` |
| NHL | `NHL` | `NHL-{espn_id}` |
| MLB | `MLB` | `MLB-{espn_id}` |
| MLS | `MLS` | `MLS-{espn_id}` |
| EPL | `EPL` | `EPL-{espn_id}` |

### Key Functions

```typescript
// Fetch live scores with predictions enrichment
getLiveScores(): Promise<LiveGame[]>

// Trigger Edge Function to refresh scores
refreshLiveScores(): Promise<{ success: boolean; liveGames: number }>

// Check if data is stale (>2 minutes old)
checkIfRefreshNeeded(): Promise<boolean>
```

### LiveGame Interface

```typescript
interface LiveGame {
  game_id: string;
  league: string;
  home_team: string;
  away_team: string;
  home_abbr: string;
  away_abbr: string;
  home_score: number;
  away_score: number;
  status: string;      // 'in_progress', 'scheduled', 'final'
  period: string;      // 'Q1', 'Halftime', 'Final'
  clock: string;       // '12:34'
  is_live: boolean;
  last_updated: string;
  predictions?: GamePredictions;  // Added by enrichment
}
```

### Prediction Enrichment

Live scores are enriched with WagerProof predictions to show real-time performance:

```typescript
// liveScoresService.ts
async function enrichGamesWithPredictions(games: LiveGame[]): Promise<LiveGame[]> {
  const [nflPredictions, cfbPredictions, nbaPredictions, ncaabPredictions] = await Promise.all([
    fetchNFLPredictions(),
    fetchCFBPredictions(),
    fetchNBAPredictions(),
    fetchNCAABPredictions()
  ]);

  return games.map(game => {
    // Match game to prediction, calculate if hitting
    const predictions = calculatePredictionStatus(game, matchedPrediction);
    return { ...game, predictions };
  });
}
```

### Prediction Matching

Games are matched to predictions by:
1. **Game ID** (preferred for NBA/NCAAB) - ESPN ID matches database game_id
2. **Team names** (fallback) - Fuzzy matching with `gamesMatch()` utility

---

## Weather Data

### Overview
Weather data is stored in predictions database tables, not fetched directly from an external API at runtime.

### Usage

Weather appears in game cards and AI analysis prompts:

```typescript
// Example from NFL predictions table
{
  weather_temp: 45,
  weather_condition: "Cloudy",
  weather_wind: 12,
  is_dome: false
}
```

### Display Components

```typescript
// src/utils/weatherIcons.tsx
getWeatherIcon(condition: string): ReactNode

// Used in GameCard components
<WeatherBadge temp={45} condition="Cloudy" wind={12} />
```

### AI Integration

Weather is included in AI completion prompts for contextual analysis:

```typescript
// aiCompletionService.ts
const prompt = `
  Game: ${awayTeam} @ ${homeTeam}
  Weather: ${weatherTemp}°F, ${weatherCondition}, Wind: ${windSpeed}mph
  ...
`;
```

---

## Team Name Matching

### Utilities (`src/utils/teamMatching.ts`)

```typescript
// Match games between different data sources
gamesMatch(
  game1: { home_team: string; away_team: string },
  game2: { home_team: string; away_team: string }
): boolean

// Used by:
// - liveScoresService (ESPN -> predictions)
// - theOddsApi (our data -> Odds API)
// - polymarketService (our data -> Polymarket)
```

### Common Matching Issues

| Issue | Example | Solution |
|-------|---------|----------|
| City vs Mascot | "Baltimore" vs "Ravens" | NFL_TEAM_MASCOTS mapping |
| Abbreviations | "LA Lakers" vs "Los Angeles Lakers" | Multiple variations in mapping |
| School variations | "Ohio St" vs "Ohio State" | CFB_TEAM_MAPPINGS |

---

## Environment Variables

```bash
# .env.local or Netlify environment variables

# The Odds API
VITE_THE_ODDS_API_KEY=your_api_key

# Supabase (for Edge Functions)
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key
```

---

## Error Handling

### The Odds API

```typescript
// Quota exceeded
if (errorJson.error_code === 'OUT_OF_USAGE_CREDITS') {
  errorMessage = 'API quota exceeded. Please upgrade or wait for reset.';
}

// No API key configured
if (!API_KEY) {
  console.warn('VITE_THE_ODDS_API_KEY not set. Odds features disabled.');
  return { events: [], rateLimitRemaining: undefined };
}
```

### Live Scores

```typescript
// Edge Function errors
const { data, error } = await supabase.functions.invoke('fetch-live-scores');
if (error) {
  debug.error('Error refreshing live scores:', error);
  return { success: false, liveGames: 0 };
}

// Stale data handling
const needsRefresh = await checkIfRefreshNeeded();
if (needsRefresh) {
  await refreshLiveScores();
}
```

---

## Related Files

| File | Purpose |
|------|---------|
| `src/services/theOddsApi.ts` | The Odds API integration |
| `src/services/oddsCache.ts` | Odds caching layer |
| `src/services/liveScoresService.ts` | Live scores + prediction enrichment |
| `src/utils/sportsbookConfig.ts` | Sportsbook definitions |
| `src/utils/teamMatching.ts` | Team name matching utilities |
| `src/utils/weatherIcons.tsx` | Weather display components |
| `supabase/functions/fetch-live-scores/` | ESPN data fetching |
