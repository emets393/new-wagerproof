# Polymarket Code Patterns

> **Reusable code patterns and algorithms for Polymarket integration**

## Table of Contents

1. [Team Name Normalization](#team-name-normalization)
2. [Market Classification](#market-classification)
3. [Event Matching](#event-matching)
4. [Price History Transformation](#price-history-transformation)
5. [Widget Event Handling](#widget-event-handling)
6. [Data Caching Patterns](#data-caching-patterns)
7. [Error Handling Patterns](#error-handling-patterns)

---

## Team Name Normalization

### Pattern: Mapping City/School Names to Polymarket Format

**Problem**: Your app uses "Baltimore" but Polymarket uses "Baltimore Ravens"

**Solution**: Create mapping dictionaries

```typescript
// Pattern for NFL (City → Mascot)
const NFL_TEAM_MASCOTS: Record<string, string> = {
  'Baltimore': 'Ravens',
  'Miami': 'Dolphins',
  'Kansas City': 'Chiefs',
  // ... all 32 teams
};

// Pattern for CFB (School → School)
const CFB_TEAM_MAPPINGS: Record<string, string> = {
  'Ohio State': 'Ohio State',
  'Michigan': 'Michigan',
  'Alabama': 'Alabama',
  // ... major schools
};

// Pattern for NBA (City → Mascot)
const NBA_TEAM_MAPPINGS: Record<string, string> = {
  'Golden State': 'Warriors',
  'LA Lakers': 'Lakers',
  'LA Clippers': 'Clippers',
  // ... all 30 teams
};

// Universal getter function
function getTeamMascot(
  teamName: string, 
  league: 'nfl' | 'cfb' | 'nba' = 'nfl'
): string {
  const mappings = {
    nfl: NFL_TEAM_MASCOTS,
    cfb: CFB_TEAM_MAPPINGS,
    nba: NBA_TEAM_MAPPINGS,
  };
  
  return mappings[league][teamName] || teamName;
}
```

**Usage**:
```typescript
const mascot = getTeamMascot('Baltimore', 'nfl');
// Returns: "Ravens"

const school = getTeamMascot('Ohio State', 'cfb');
// Returns: "Ohio State"
```

---

### Pattern: Handling Name Variations

**Problem**: Team might be called "LA Lakers" or "Los Angeles Lakers"

**Solution**: Add all variations to mapping

```typescript
const NBA_TEAM_MAPPINGS: Record<string, string> = {
  // All variations map to same value
  'LA Lakers': 'Lakers',
  'Los Angeles Lakers': 'Lakers',
  'L.A. Lakers': 'Lakers',
  'Los Angeles': 'Lakers',  // City only
  
  'LA Clippers': 'Clippers',
  'Los Angeles Clippers': 'Clippers',
  'L.A. Clippers': 'Clippers',
  
  // Same pattern for other teams
};
```

---

### Pattern: Parsing Team Names from Title

**Problem**: Extract "Team A" and "Team B" from "Team A vs. Team B"

**Solution**: Regex pattern with fallback

```typescript
function parseTeamsFromTitle(title: string): { awayTeam: string; homeTeam: string } | null {
  // Try multiple separators
  const patterns = [
    /^(.+?)\s+vs\.?\s+(.+)$/i,      // "Team A vs. Team B"
    /^(.+?)\s+@\s+(.+)$/i,          // "Team A @ Team B"
    /^(.+?)\s+at\s+(.+)$/i,         // "Team A at Team B"
  ];
  
  for (const pattern of patterns) {
    const match = title.match(pattern);
    if (match) {
      return {
        awayTeam: match[1].trim(),
        homeTeam: match[2].trim(),
      };
    }
  }
  
  return null;
}
```

**Usage**:
```typescript
const teams = parseTeamsFromTitle("Baltimore Ravens vs. Miami Dolphins");
// { awayTeam: "Baltimore Ravens", homeTeam: "Miami Dolphins" }
```

---

## Market Classification

### Pattern: Classify Market by Question Text

**Problem**: Determine if market is Moneyline, Spread, or Total

**Solution**: Keyword-based classification with fallbacks

```typescript
type MarketType = 'moneyline' | 'spread' | 'total' | '1h_moneyline' | '1h_spread' | '1h_total' | 'other';

function classifyMarket(
  question: string,
  slug: string,
  awayTeam?: string,
  homeTeam?: string
): MarketType | null {
  const qLower = question.toLowerCase();
  const sLower = slug.toLowerCase();

  // Skip first half markets (we want full game only)
  if (qLower.includes('1h') || sLower.includes('-1h-')) {
    return null;
  }

  // 1. Check for explicit keywords in question
  if (qLower.includes('spread') || sLower.includes('-spread-')) {
    return 'spread';
  }
  
  if (qLower.includes('o/u') || qLower.includes('total') || sLower.includes('-total-')) {
    return 'total';
  }
  
  if (qLower.includes('moneyline') || sLower.includes('-moneyline')) {
    return 'moneyline';
  }

  // 2. Check for "vs" pattern (usually moneyline)
  if (qLower.includes(' vs ') || qLower.includes(' vs. ')) {
    // Verify both teams are in question for safety
    if (awayTeam && homeTeam) {
      const hasAway = qLower.includes(awayTeam.toLowerCase());
      const hasHome = qLower.includes(homeTeam.toLowerCase());
      if (hasAway && hasHome) {
        return 'moneyline';
      }
    }
    // Even without team names, plain "vs" is likely moneyline
    return 'moneyline';
  }

  // 3. Default for main market (no type suffixes)
  if (!sLower.includes('-total-') && !sLower.includes('-spread-')) {
    return 'moneyline';
  }

  return null;
}
```

**Key Logic**:
1. **Explicit keywords win** - "spread" in question = spread market
2. **Slug patterns** - "-spread-7pt5" in slug = spread market
3. **"vs" fallback** - Plain "Team A vs Team B" = moneyline
4. **Filter out halves** - Skip "1H" markets
5. **Return null for unknown** - Don't guess, let caller handle

**Usage**:
```typescript
classifyMarket("Ravens vs Dolphins", "nfl-bal-mia-2025-01-29")
// Returns: "moneyline"

classifyMarket("Ravens vs Dolphins: Spread -7.5", "nfl-bal-mia-2025-01-29-spread-7pt5")
// Returns: "spread"

classifyMarket("Ravens vs Dolphins: O/U 47.5", "nfl-bal-mia-2025-01-29-total-47pt5")
// Returns: "total"

classifyMarket("Ravens vs Dolphins: 1H Moneyline", "nfl-bal-mia-2025-01-29-1h-moneyline")
// Returns: null (filtered out)
```

---

### Pattern: Extract All Market Types from Event

**Problem**: Given an event with 10+ markets, extract only ML/Spread/Total

**Solution**: Loop and classify, store first of each type

```typescript
function extractAllMarketsFromEvent(
  event: PolymarketEvent
): Partial<Record<MarketType, { yesTokenId: string; noTokenId: string; question: string }>> {
  const result: Partial<Record<MarketType, any>> = {};

  if (!event.markets || event.markets.length === 0) {
    return result;
  }

  // Parse teams from event title for better classification
  const teams = parseTeamsFromTitle(event.title);
  const awayTeam = teams?.awayTeam;
  const homeTeam = teams?.homeTeam;

  for (const market of event.markets) {
    // Skip inactive or closed markets
    if (!market.active || market.closed) continue;

    // Classify this market
    const marketType = classifyMarket(market.question, market.slug, awayTeam, homeTeam);
    if (!marketType) continue;

    // Skip if we already have this market type (take first one)
    if (result[marketType]) continue;

    // Extract token IDs
    const tokens = extractTokensFromMarket(market);
    if (!tokens) continue;

    // Store this market
    result[marketType] = {
      ...tokens,
      question: market.question,
    };

    debug.log(`📊 Found ${marketType} market:`, market.question);
  }

  return result;
}
```

**Result Structure**:
```typescript
{
  moneyline: {
    yesTokenId: "12345...",
    noTokenId: "67890...",
    question: "Ravens vs Dolphins"
  },
  spread: {
    yesTokenId: "11111...",
    noTokenId: "22222...",
    question: "Ravens vs Dolphins: Spread -7.5"
  },
  total: {
    yesTokenId: "33333...",
    noTokenId: "44444...",
    question: "Ravens vs Dolphins: O/U 47.5"
  }
}
```

---

## Event Matching

### Pattern: Fuzzy Match Your Game to Polymarket Event

**Problem**: You have "Baltimore vs Miami", Polymarket has "Baltimore Ravens vs. Miami Dolphins"

**Solution**: Flexible matching with multiple strategies

```typescript
function findMatchingEvent(
  events: PolymarketEvent[],
  awayTeam: string,
  homeTeam: string,
  league: 'nfl' | 'cfb' = 'nfl'
): PolymarketEvent | null {
  // Get team mascots/full names
  const awayMascot = getTeamMascot(awayTeam, league);
  const homeMascot = getTeamMascot(homeTeam, league);

  debug.log(`🔍 Looking for: ${awayMascot} vs ${homeMascot}`);

  // Strategy 1: Exact match with full names
  let match = events.find(event => {
    const title = event.title.toLowerCase();
    return title.includes(awayMascot.toLowerCase()) && 
           title.includes(homeMascot.toLowerCase());
  });

  if (match) {
    debug.log(`✅ Found (exact): ${match.title}`);
    return match;
  }

  // Strategy 2: Match with original city/school names
  match = events.find(event => {
    const title = event.title.toLowerCase();
    return title.includes(awayTeam.toLowerCase()) && 
           title.includes(homeTeam.toLowerCase());
  });

  if (match) {
    debug.log(`✅ Found (city): ${match.title}`);
    return match;
  }

  // Strategy 3: Partial match (mascot only, no city)
  match = events.find(event => {
    const title = event.title.toLowerCase();
    const awayMascotOnly = awayMascot.split(' ').pop()?.toLowerCase() || '';
    const homeMascotOnly = homeMascot.split(' ').pop()?.toLowerCase() || '';
    return title.includes(awayMascotOnly) && title.includes(homeMascotOnly);
  });

  if (match) {
    debug.log(`✅ Found (mascot): ${match.title}`);
    return match;
  }

  // No match found
  debug.log('❌ No match found');
  debug.log('📋 Available events:', events.slice(0, 5).map(e => e.title));
  
  return null;
}
```

**Matching Strategies** (in order):
1. **Exact**: Both full team names in title
2. **City**: Both city/school names in title
3. **Mascot**: Both mascots (last word) in title
4. **None**: Return null, log available events

**Usage**:
```typescript
const events = await getLeagueEvents('nfl');
const match = findMatchingEvent(events, 'Baltimore', 'Miami', 'nfl');

if (match) {
  console.log('Found:', match.title);
  // "Baltimore Ravens vs. Miami Dolphins"
}
```

---

## Price History Transformation

### Pattern: Convert API Response to Chart Data

**Problem**: API returns `{t: 1697875200, p: 0.6304}`, chart needs `{timestamp: Date, awayTeamOdds: 63.04, homeTeamOdds: 36.96}`

**Solution**: Transform function

```typescript
interface PriceHistoryPoint {
  t: number;  // Unix timestamp (seconds)
  p: number;  // Price 0.00-1.00
}

interface TimeSeriesPoint {
  timestamp: number;       // JS timestamp (milliseconds)
  awayTeamOdds: number;   // Percentage 0-100
  homeTeamOdds: number;   // Percentage 0-100
  awayTeamPrice: number;  // Original 0-1 price
  homeTeamPrice: number;  // Original 0-1 price
}

function transformPriceHistory(
  priceHistory: PriceHistoryPoint[],
  isAwayTeamYes: boolean = true
): TimeSeriesPoint[] {
  if (!priceHistory || priceHistory.length === 0) {
    return [];
  }

  return priceHistory.map((point) => {
    const probability = point.p;              // 0.00-1.00
    const timestampMs = point.t * 1000;       // Convert to milliseconds
    const oddsPercentage = Math.round(probability * 100);

    if (isAwayTeamYes) {
      // YES token represents away team winning
      return {
        timestamp: timestampMs,
        awayTeamOdds: oddsPercentage,
        homeTeamOdds: 100 - oddsPercentage,
        awayTeamPrice: probability,
        homeTeamPrice: 1 - probability,
      };
    } else {
      // YES token represents home team winning
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

**Key Transformations**:
1. **Time**: Seconds → Milliseconds (`* 1000`)
2. **Probability**: 0-1 → 0-100 percentage (`* 100`)
3. **Inverse**: Calculate opposite team (` 100 - p`)
4. **Rounding**: Use `Math.round()` for clean percentages

**Usage**:
```typescript
const history = [
  { t: 1697875200, p: 0.6304 },
  { t: 1697875260, p: 0.6289 },
];

const chartData = transformPriceHistory(history, true);
// [
//   { timestamp: 1697875200000, awayTeamOdds: 63, homeTeamOdds: 37, ... },
//   { timestamp: 1697875260000, awayTeamOdds: 63, homeTeamOdds: 37, ... }
// ]
```

---

### Pattern: Convert Probability to American Odds

**Problem**: Show -170 instead of 63.04%

**Solution**: American odds conversion

```typescript
function probabilityToAmericanOdds(probability: number): number {
  if (probability >= 0.5) {
    // Favorite (negative odds)
    return Math.round(-1 * ((probability / (1 - probability)) * 100));
  } else {
    // Underdog (positive odds)
    return Math.round(((1 - probability) / probability) * 100);
  }
}
```

**Examples**:
```typescript
probabilityToAmericanOdds(0.6304)  // -170  (favorite)
probabilityToAmericanOdds(0.3696)  // +171  (underdog)
probabilityToAmericanOdds(0.5000)  // -100  (even)
```

---

## Widget Event Handling

### Pattern: Prevent Parent Card Click Propagation

**Problem**: Clicking widget buttons triggers parent card hover/click animations

**Solution**: Multi-layer event stopping

```tsx
function PolymarketWidget({ awayTeam, homeTeam, league }) {
  // Button click handler with aggressive stopping
  const handleButtonClick = (e: React.MouseEvent, value: string) => {
    e.stopPropagation();
    e.preventDefault();
    e.nativeEvent.stopImmediatePropagation();
    
    // Your logic here
    setTimeRange(value);
  };

  return (
    // Layer 1: Container div stops all events
    <div 
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
      className="w-full pointer-events-auto relative z-[100]"
      style={{ isolation: 'isolate' }}
    >
      <Card>
        <CardContent>
          {/* Layer 2: Interactive elements have own handlers */}
          <Button
            onClick={(e) => handleButtonClick(e, '1H')}
            onPointerDown={(e) => {
              e.stopPropagation();
              e.nativeEvent.stopImmediatePropagation();
            }}
            onMouseDown={(e) => {
              e.stopPropagation();
              e.nativeEvent.stopImmediatePropagation();
            }}
            onTouchStart={(e) => {
              e.stopPropagation();
              e.nativeEvent.stopImmediatePropagation();
            }}
            className="relative z-[111] pointer-events-auto"
            style={{ pointerEvents: 'auto' }}
            type="button"
          >
            1H
          </Button>
          
          {/* Repeat for all interactive elements */}
        </CardContent>
      </Card>
    </div>
  );
}
```

**Key Techniques**:
1. **stopPropagation()** - Stops bubbling to parent
2. **preventDefault()** - Prevents default action
3. **stopImmediatePropagation()** - Stops other listeners on same element
4. **CSS pointer-events** - Ensures events can pass through
5. **High z-index** - Places widget above other elements
6. **isolation: isolate** - Creates stacking context

---

### Pattern: Wrapper Div in Parent Component

**Problem**: Parent card still reacting to widget area

**Solution**: Add wrapper with event stopping in parent

```tsx
// In NFL.tsx or CollegeFootball.tsx
<div 
  className="pt-4"
  onPointerDown={(e) => e.stopPropagation()}
  onMouseDown={(e) => e.stopPropagation()}
  onTouchStart={(e) => e.stopPropagation()}
  onClick={(e) => e.stopPropagation()}
  style={{ pointerEvents: 'auto', isolation: 'isolate' }}
>
  <PolymarketWidget
    awayTeam={prediction.away_team}
    homeTeam={prediction.home_team}
    league="nfl"
  />
</div>
```

---

## Data Caching Patterns

### Pattern: React Query with Stale Time

**Problem**: Fetching same data on every widget mount

**Solution**: Use React Query's caching

```typescript
const { data, isLoading, error } = useQuery({
  queryKey: ['polymarket-all', league, awayTeam, homeTeam],
  queryFn: () => getAllMarketsData(awayTeam, homeTeam, league),
  staleTime: 5 * 60 * 1000,  // 5 minutes
  cacheTime: 10 * 60 * 1000,  // 10 minutes
  retry: 1,
  refetchOnWindowFocus: false,
});
```

**Key Options**:
- `staleTime`: How long data is considered fresh
- `cacheTime`: How long to keep unused data in cache
- `retry`: Number of retries on failure
- `refetchOnWindowFocus`: Refetch when user returns to tab

---

### Pattern: Database Caching (Server-Side)

**Problem**: Too many API calls to Polymarket

**Solution**: Cache in Supabase, update hourly

```typescript
// Check cache first
export async function getAllMarketsDataFromCache(
  awayTeam: string,
  homeTeam: string
): Promise<PolymarketAllMarketsData | null> {
  const gameKey = `${awayTeam}_${homeTeam}`;
  
  const { data, error } = await supabase
    .from('polymarket_markets')
    .select('*')
    .eq('game_key', gameKey);

  if (error || !data || data.length === 0) {
    // Fall back to live API
    return getAllMarketsDataLive(awayTeam, homeTeam);
  }

  // Transform cached data
  return transformCachedData(data);
}
```

See [POLYMARKET_CACHE_SETUP.md](../POLYMARKET_CACHE_SETUP.md) for full implementation.

---

## Error Handling Patterns

### Pattern: Graceful Degradation

**Problem**: API fails, widget breaks entire page

**Solution**: Catch at multiple levels

```typescript
// Service level - return null on error
export async function getAllMarketsData(...): Promise<Data | null> {
  try {
    // ... fetch logic
    return data;
  } catch (error) {
    debug.error('❌ Error fetching markets:', error);
    return null;
  }
}

// Component level - show error state
function PolymarketWidget({ awayTeam, homeTeam }) {
  const { data, isLoading, error } = useQuery({
    queryKey: [...],
    queryFn: () => getAllMarketsData(awayTeam, homeTeam),
    retry: 1,  // Only retry once
  });

  if (isLoading) {
    return <Skeleton />;
  }

  if (error || !data) {
    return (
      <Card>
        <CardContent className="text-center py-8">
          <p className="text-muted-foreground">
            Polymarket betting data unavailable for this game
          </p>
        </CardContent>
      </Card>
    );
  }

  // Render success state
  return <ChartView data={data} />;
}
```

**Levels of Fallback**:
1. Service returns `null` instead of throwing
2. React Query retries once
3. Component shows error message
4. Page continues to work

---

### Pattern: Detailed Error Logging

**Problem**: Hard to debug what went wrong

**Solution**: Log at each step

```typescript
export async function getAllMarketsData(awayTeam, homeTeam, league) {
  try {
    debug.log(`🔍 Fetching markets for: ${awayTeam} vs ${homeTeam} (${league})`);
    
    const tagId = await getLeagueTagId(league);
    debug.log(`✅ Tag ID: ${tagId}`);
    
    const events = await getLeagueEvents(league);
    debug.log(`📊 Got ${events.length} events`);
    
    const match = findMatchingEvent(events, awayTeam, homeTeam);
    if (!match) {
      debug.log('❌ No matching event');
      debug.log('Available:', events.map(e => e.title));
      return null;
    }
    debug.log(`✅ Found: ${match.title}`);
    
    // Continue...
  } catch (error) {
    debug.error('❌ Fatal error:', error);
    return null;
  }
}
```

---

## Summary

### Most Important Patterns

1. **Team Mapping** - Always map your team names to Polymarket's format
2. **Market Classification** - Use keyword-based classification with fallbacks
3. **Event Matching** - Try multiple strategies, log results
4. **Event Stopping** - Multi-layer approach for clickability
5. **Graceful Errors** - Return null, show message, page keeps working

### Copy-Paste Patterns

The following can be copied directly:
- `getTeamMascot()` - Just add your sport's mappings
- `classifyMarket()` - Works as-is for any sport
- `transformPriceHistory()` - Universal transformation
- Event handler patterns - Copy the exact handlers

### Sport-Specific Patterns

Only thing that changes per sport:
- Team name mappings (NFL vs CFB vs NBA format)
- Sport identifier string (`'nfl'`, `'cfb'`, `'nba'`)
- League type union (`'nfl' | 'cfb'` → `'nfl' | 'cfb' | 'nba'`)

Everything else is reusable! 🎉

