# Polymarket API Reference

> **Complete API documentation for Polymarket sports betting integration**

## Table of Contents

1. [Base URLs](#base-urls)
2. [Available Sports](#available-sports)
3. [API Endpoints](#api-endpoints)
4. [Sample Payloads](#sample-payloads)
5. [Market Types](#market-types)
6. [Rate Limits](#rate-limits)
7. [Error Handling](#error-handling)

---

## Base URLs

| API | URL | Purpose |
|-----|-----|---------|
| Gamma API | `https://gamma-api.polymarket.com` | Sports metadata, events, markets |
| CLOB API | `https://clob.polymarket.com` | Order book, price history |

**Authentication**: None required (public APIs)

---

## Available Sports

Retrieved from `GET /sports`

| Sport | Identifier | Tag ID Example | Status |
|-------|------------|----------------|--------|
| NFL | `nfl` | `450` | ✅ Integrated |
| College Football | `cfb` | `100351` | ✅ Integrated |
| NBA | `nba` | `100xxx` | 🔄 Ready to integrate |
| NCAA Basketball | `ncaab` | `100xxx` | 🔄 Ready to integrate |
| MLB | `mlb` | `100xxx` | 🔄 Ready to integrate |
| NHL | `nhl` | `100xxx` | 🔄 Ready to integrate |
| Soccer (EPL) | `epl` | `100xxx` | 🔄 Ready to integrate |
| Soccer (La Liga) | `lal` | `100xxx` | 🔄 Ready to integrate |
| Soccer (Champions League) | `ucl` | `100xxx` | 🔄 Ready to integrate |
| MLS | `mls` | `100xxx` | 🔄 Ready to integrate |

**Note**: Use the `sport` field value, not the league name. For example, College Football is `'cfb'` NOT `'ncaaf'`.

---

## API Endpoints

### 1. Get Sports Metadata

**Purpose**: Fetch available sports and their tag IDs

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
  },
  {
    "sport": "cfb",
    "name": "College Football",
    "tags": "1,100351,100639",
    "series": "10210",
    "ordering": "away",
    "active": true
  }
]
```

**Key Fields**:
- `sport`: Identifier to use in code (e.g., `'nfl'`, `'cfb'`)
- `tags`: Comma-separated tag IDs (use first non-"1" tag)
- `series`: Series ID for the sport
- `ordering`: Which team is listed first ("away" or "home")

---

### 2. Get Events for a Sport

**Purpose**: Fetch all active games/events for a specific sport

```http
GET https://gamma-api.polymarket.com/events?tag_id={TAG_ID}&closed=false&limit=100&related_tags=true
```

**Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `tag_id` | string | ✅ | Sport tag ID from /sports endpoint |
| `closed` | boolean | ❌ | Filter for open/closed markets (default: false) |
| `limit` | integer | ❌ | Max events to return (default: 100) |
| `related_tags` | boolean | ❌ | Include related tag information |

**Response Structure**:
```json
{
  "sport": "cfb",
  "tagId": "100351",
  "seriesId": "10210",
  "ordering": "away",
  "markets": [
    {
      "eventSlug": "cfb-jaxst-mtnst-2025-10-29",
      "eventTitle": "Jacksonville State vs. Middle Tennessee",
      "awayTeam": "Jacksonville State",
      "homeTeam": "Middle Tennessee",
      "gameStartTime": "2025-10-27T22:04:11.657141Z",
      "marketSlug": "cfb-jaxst-mtnst-2025-10-29",
      "marketType": "other",
      "question": "Jacksonville State vs. Middle Tennessee",
      "yesTokenId": "40662485482563992683921760435608202412847422654707179701162757872693694986143",
      "noTokenId": "69388746893371660152146858582155725050508644267048067077636473110446403376700",
      "active": true,
      "closed": false
    }
  ]
}
```

**Key Fields**:
- `eventSlug`: Unique identifier for the game
- `eventTitle`: Human-readable game title
- `awayTeam` / `homeTeam`: Team names (already parsed!)
- `gameStartTime`: ISO 8601 timestamp
- `marketSlug`: Unique identifier for this specific market
- `marketType`: Polymarket's classification (often "other" for main markets)
- `question`: The market question text
- `yesTokenId` / `noTokenId`: Token IDs for trading and price history
- `active`: Is market accepting trades?
- `closed`: Has market been settled?

---

### 3. Get Price History

**Purpose**: Fetch historical price/probability data for a market

```http
GET https://clob.polymarket.com/prices-history?market={TOKEN_ID}&interval={INTERVAL}&fidelity={MINUTES}
```

**Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `market` | string | ✅ | Token ID (yesTokenId from events) |
| `interval` | string | ❌ | Time range: `1m`, `1h`, `6h`, `1d`, `1w`, `max` |
| `fidelity` | integer | ❌ | Resolution in minutes (e.g., 60 = 1 point per hour) |
| `startTs` | integer | ❌ | Unix timestamp start (mutually exclusive with interval) |
| `endTs` | integer | ❌ | Unix timestamp end (mutually exclusive with interval) |

**Response**:
```json
{
  "history": [
    {
      "t": 1697875200,
      "p": 0.6304
    },
    {
      "t": 1697875260,
      "p": 0.6289
    },
    {
      "t": 1697878800,
      "p": 0.6512
    }
  ]
}
```

**Key Fields**:
- `t`: Unix timestamp in **seconds** (not milliseconds!)
- `p`: Price in USDC per share (0.00 - 1.00)
  - For YES token: `p` = implied probability team wins
  - For NO token: `p` = implied probability team loses
  - YES + NO ≈ 1.00 (collateralized pairs)

**Converting Price to Percentage**:
```typescript
const probabilityPercentage = p * 100; // 0.6304 → 63.04%
```

**Converting to American Odds**:
```typescript
// Favorite (p >= 0.5)
const moneyline = -1 * (p / (1 - p)) * 100;
// Example: 0.63 → -170

// Underdog (p < 0.5)
const moneyline = ((1 - p) / p) * 100;
// Example: 0.37 → +170
```

---

## Sample Payloads

### Full NFL Event Response

```json
{
  "sport": "nfl",
  "tagId": "450",
  "seriesId": "10211",
  "ordering": "away",
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
    },
    {
      "eventSlug": "nfl-bal-mia-2025-01-29",
      "eventTitle": "Baltimore Ravens vs. Miami Dolphins",
      "awayTeam": "Baltimore Ravens",
      "homeTeam": "Miami Dolphins",
      "gameStartTime": "2025-01-29T18:00:00.000Z",
      "marketSlug": "nfl-bal-mia-2025-01-29-spread-7pt5",
      "marketType": "spread",
      "question": "Baltimore Ravens vs. Miami Dolphins: Spread -7.5",
      "yesTokenId": "11111...",
      "noTokenId": "22222...",
      "active": true,
      "closed": false
    },
    {
      "eventSlug": "nfl-bal-mia-2025-01-29",
      "eventTitle": "Baltimore Ravens vs. Miami Dolphins",
      "awayTeam": "Baltimore Ravens",
      "homeTeam": "Miami Dolphins",
      "gameStartTime": "2025-01-29T18:00:00.000Z",
      "marketSlug": "nfl-bal-mia-2025-01-29-total-47pt5",
      "marketType": "total",
      "question": "Baltimore Ravens vs. Miami Dolphins: O/U 47.5",
      "yesTokenId": "33333...",
      "noTokenId": "44444...",
      "active": true,
      "closed": false
    }
  ]
}
```

### Full CFB Event Response (Real Example)

```json
{
  "sport": "cfb",
  "tagId": "100351",
  "seriesId": "10210",
  "ordering": "away",
  "markets": [
    {
      "eventSlug": "cfb-jaxst-mtnst-2025-10-29",
      "eventTitle": "Jacksonville State vs. Middle Tennessee",
      "awayTeam": "Jacksonville State",
      "homeTeam": "Middle Tennessee",
      "gameStartTime": "2025-10-27T22:04:11.657141Z",
      "marketSlug": "cfb-jaxst-mtnst-2025-10-29",
      "marketType": "other",
      "question": "Jacksonville State vs. Middle Tennessee",
      "yesTokenId": "40662485482563992683921760435608202412847422654707179701162757872693694986143",
      "noTokenId": "69388746893371660152146858582155725050508644267048067077636473110446403376700",
      "active": true,
      "closed": false
    },
    {
      "eventSlug": "cfb-jaxst-mtnst-2025-10-29",
      "eventTitle": "Jacksonville State vs. Middle Tennessee",
      "awayTeam": "Jacksonville State",
      "homeTeam": "Middle Tennessee",
      "gameStartTime": "2025-10-27T22:04:11.657141Z",
      "marketSlug": "cfb-jaxst-mtnst-2025-10-29-1h-total-27pt5",
      "marketType": "1h_total",
      "question": "Jacksonville State vs. Middle Tennessee: 1H O/U 27.5",
      "yesTokenId": "30872633076827451272632157226040692329953803982211759839770357236488078374276",
      "noTokenId": "36310566033284904508261667790868846750741374840684054434840995854871278476786",
      "active": true,
      "closed": false
    },
    {
      "eventSlug": "cfb-jaxst-mtnst-2025-10-29",
      "eventTitle": "Jacksonville State vs. Middle Tennessee",
      "awayTeam": "Jacksonville State",
      "homeTeam": "Middle Tennessee",
      "gameStartTime": "2025-10-27T22:04:11.657141Z",
      "marketSlug": "cfb-jaxst-mtnst-2025-10-29-1h-moneyline",
      "marketType": "1h_moneyline",
      "question": "Jacksonville State vs. Middle Tennessee: 1H Moneyline",
      "yesTokenId": "15340221300779794309274752458298647493744123066940595521127004326501344255487",
      "noTokenId": "17028075203907759983642058217493235110872681838811590949031796366568266822088",
      "active": true,
      "closed": false
    }
  ]
}
```

**Notice**: The first market with `marketType: "other"` is the **main moneyline** market. It's the plain "Team A vs. Team B" question.

### Price History Response (Real Data)

```json
{
  "history": [
    {
      "t": 1735257600,
      "p": 0.5234
    },
    {
      "t": 1735261200,
      "p": 0.5289
    },
    {
      "t": 1735264800,
      "p": 0.5401
    },
    {
      "t": 1735268400,
      "p": 0.5523
    },
    {
      "t": 1735272000,
      "p": 0.5612
    }
  ]
}
```

**Timestamps Explained**:
- `1735257600` = December 27, 2024 00:00:00 UTC
- Increment by 3600 = hourly intervals (with `interval=1h`)
- Multiply by 1000 to convert to JavaScript milliseconds

---

## Market Types

### Polymarket's `marketType` Field

| Value | Meaning | Our Classification |
|-------|---------|-------------------|
| `"other"` | Main moneyline (plain "Team A vs. Team B") | `moneyline` |
| `"spread"` | Point spread market | `spread` |
| `"total"` | Over/Under market | `total` |
| `"1h_moneyline"` | First half moneyline | Skip (not full game) |
| `"1h_total"` | First half total | Skip (not full game) |
| `"1h_spread"` | First half spread | Skip (not full game) |

### Our Classification Logic

```typescript
function classifyMarket(question: string, slug: string, awayTeam?: string, homeTeam?: string): MarketType | null {
  const qLower = question.toLowerCase();
  const sLower = slug.toLowerCase();

  // Skip first half markets
  if (qLower.includes('1h') || sLower.includes('-1h-')) {
    return null;
  }

  // Explicit type in question
  if (qLower.includes('spread') || sLower.includes('-spread-')) {
    return 'spread';
  }
  if (qLower.includes('o/u') || qLower.includes('total') || sLower.includes('-total-')) {
    return 'total';
  }
  if (qLower.includes('moneyline') || sLower.includes('-moneyline')) {
    return 'moneyline';
  }

  // Fallback: plain "Team vs Team" = moneyline
  if (qLower.includes(' vs ') || qLower.includes(' vs. ')) {
    return 'moneyline';
  }

  return null;
}
```

---

## Rate Limits

**Polymarket Public APIs**: No official rate limits documented

**Observed Behavior**:
- ✅ Can fetch /sports once on app load
- ✅ Can fetch /events for each sport once per minute
- ✅ Can fetch /prices-history per token as needed
- ⚠️ Avoid hammering endpoints (use caching)

**Best Practices**:
1. Cache `/sports` response (changes rarely)
2. Cache `/events` response for 1-5 minutes
3. Fetch `/prices-history` on widget mount only
4. Use React Query's `staleTime` for automatic caching

**Our Implementation**:
```typescript
const { data } = useQuery({
  queryKey: ['polymarket-all', league, awayTeam, homeTeam],
  queryFn: () => getAllMarketsData(awayTeam, homeTeam, league),
  staleTime: 5 * 60 * 1000, // 5 minutes
  retry: 1,
});
```

---

## Error Handling

### Common Errors

#### 1. CORS Error

```
Access to fetch at 'https://gamma-api.polymarket.com/events' from origin 
'https://www.wagerproof.bet' has been blocked by CORS policy
```

**Solution**: Use Supabase Edge Function proxy
```typescript
// ❌ Direct call (will fail in browser)
fetch('https://gamma-api.polymarket.com/events?tag_id=450')

// ✅ Via Edge Function
supabase.functions.invoke('polymarket-proxy', {
  body: { action: 'events', tagId: '450' }
})
```

#### 2. No Markets Found

```typescript
// Console: "❌ No matching event found for this game"
```

**Causes**:
- Team name mismatch
- Game not on Polymarket yet
- Game already settled (closed: true)

**Debug**:
```typescript
console.log('Searching for:', awayTeam, homeTeam);
console.log('Available events:', events.map(e => e.title));
```

#### 3. Empty Price History

```typescript
// Response: { "history": [] }
```

**Causes**:
- Market just created (no trading yet)
- Invalid token ID
- Market settled and archived

**Handling**:
```typescript
if (!priceHistory || priceHistory.length === 0) {
  return <div>No historical data available</div>;
}
```

### Error Response Format

```json
{
  "error": "Invalid tag_id",
  "message": "Tag ID must be a valid integer",
  "statusCode": 400
}
```

---

## Testing Endpoints

### Quick Test Commands

```bash
# 1. Get sports list
curl https://gamma-api.polymarket.com/sports

# 2. Get NFL events
curl "https://gamma-api.polymarket.com/events?tag_id=450&closed=false&limit=10"

# 3. Get CFB events
curl "https://gamma-api.polymarket.com/events?tag_id=100351&closed=false&limit=10"

# 4. Get price history
curl "https://clob.polymarket.com/prices-history?market=40662485482563992683921760435608202412847422654707179701162757872693694986143&interval=1h&fidelity=60"
```

### Using Postman/Insomnia

**GET /sports**:
- URL: `https://gamma-api.polymarket.com/sports`
- Headers: None required
- Expected: 200 OK with array of sports

**GET /events**:
- URL: `https://gamma-api.polymarket.com/events`
- Query Params:
  - `tag_id`: `450` (for NFL)
  - `closed`: `false`
  - `limit`: `100`
- Expected: 200 OK with markets array

---

## API Changelog

### Known Changes

**October 2024**: `/sports` endpoint introduced
- Replaces manual tag discovery
- Returns structured sport metadata

**September 2024**: `/events` endpoint improved
- Now returns `awayTeam` and `homeTeam` fields
- Cleaner than parsing from `eventTitle`

**Ongoing**: Token IDs are 78-character hex strings
- Very long, use carefully in URLs
- Store as strings, not numbers

---

## Support

**Official Polymarket Docs**: https://docs.polymarket.com/  
**API Status**: No public status page  
**Community**: Discord, Twitter (@Polymarket)

For WagerProof-specific questions:
- See [Troubleshooting Guide](./polymarket-troubleshooting.md)
- Check [Implementation Steps](./polymarket-implementation-steps.md)

