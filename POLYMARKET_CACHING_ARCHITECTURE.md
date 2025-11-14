# Polymarket Caching Architecture

## Overview

Yes, **Polymarket data IS cached in Supabase** instead of making direct client API calls. Here's how it works:

## Caching Strategy

### ✅ What IS Cached (in Supabase `polymarket_markets` table):

1. **Market Price History** - Full price history for each market type (moneyline, spread, total)
2. **Current Odds** - Latest odds for away/home teams
3. **Token IDs** - Polymarket token identifiers
4. **Market Metadata** - Question text, market type, etc.

**Storage**: `polymarket_markets` table in Supabase
**Key**: `game_key` (format: `{league}_{away_team}_{home_team}`) + `market_type`

### ❌ What is NOT Cached:

1. **List of Games/Events** - `getLeagueEvents()` always makes API calls
   - This is intentional - games list changes frequently
   - API calls go through Supabase Edge Function proxy (avoids CORS)

## How It Works

### 1. Background Cache Update (Supabase Edge Function)

**Function**: `update-polymarket-cache`
**Schedule**: Runs via cron job (frequency depends on your setup)

**Process**:
1. Fetches games from your database (NFL, CFB, NCAAB, NBA)
2. Fetches Polymarket events using correct tag IDs:
   - NFL: From `/sports` metadata
   - CFB: From `/sports` metadata  
   - CBB: Tag ID `102114` (hardcoded)
   - NBA: Tag ID `745` (hardcoded)
3. Filters events to only games (vs/@ pattern)
4. Matches database games to Polymarket events
5. Fetches price history for each market type
6. Stores in `polymarket_markets` table

### 2. Client-Side Usage

**Function**: `getAllMarketsData(awayTeam, homeTeam, league)`

**Flow**:
```
1. Check Supabase cache first
   ↓ (if found)
   ✅ Return cached data
   
   ↓ (if not found)
2. Fallback to live API call
   ↓
   ✅ Return live data (but doesn't cache it)
```

**Note**: The cache is populated by the background cron job, not by client requests.

### 3. API Proxy (Supabase Edge Function)

**Function**: `polymarket-proxy`
**Purpose**: Avoids CORS issues, proxies API calls

**Used by**:
- `getLeagueEvents()` - Always uses proxy (no caching)
- `getAllMarketsDataLive()` - Uses proxy for live fallback

## Current Implementation

### ✅ Cached Data Flow:
```
Cron Job → update-polymarket-cache → Polymarket API → Supabase Cache
                                                              ↓
Client → getAllMarketsData() → Supabase Cache (polymarket_markets table)
```

### ⚠️ Non-Cached Data Flow:
```
Client → getLeagueEvents() → Supabase Proxy → Polymarket API
```

## Why This Architecture?

1. **Price History**: Expensive to fetch, doesn't change frequently → Cache it
2. **Game List**: Changes frequently, lightweight → Don't cache
3. **CORS**: Client can't call Polymarket directly → Use Supabase proxy
4. **Rate Limiting**: Background job respects rate limits better

## Cache Update Frequency

The `update-polymarket-cache` function should run:
- **During season**: Every 15-30 minutes
- **Off-season**: Less frequently (hourly/daily)

## Tag IDs Used

- **NFL**: From `/sports` metadata (dynamic)
- **CFB**: From `/sports` metadata (dynamic)
- **CBB**: `102114` (hardcoded - correct tag for games)
- **NBA**: `745` (hardcoded - correct tag for games)

## Filtering

Both cache function and client code filter events to only include games:
- Pattern: `"Team A vs. Team B"` or `"Team A @ Team B"`
- Excludes: Props, futures, specials, etc.

## Summary

✅ **Market data (price history, odds)**: Cached in Supabase  
✅ **API calls**: Go through Supabase Edge Function proxy  
❌ **Game list**: Not cached (always fresh from API)  
✅ **Background updates**: Cron job populates cache  

This architecture ensures:
- Fast client responses (cached data)
- No CORS issues (proxy)
- Up-to-date game lists (always fresh)
- Efficient API usage (background caching)

