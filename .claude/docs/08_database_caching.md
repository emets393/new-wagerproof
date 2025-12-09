# Database & Caching

> Last verified: December 2024

## Supabase Architecture

### Primary Instance (`gnjrklxotmbvnxbnnqgq`)
- User authentication
- Profiles & settings
- Chat threads/messages
- Editor's picks
- Community features

### Secondary Instance (`jpxnjuwglavsjbgbasnl`)
- NFL/CFB/NBA/NCAAB predictions
- Betting lines
- Live scores
- Weather data
- Polymarket cache

---

## Client Setup

### Web (Single Client)
```typescript
// src/integrations/supabase/client.ts
export const supabase = createClient<Database>(
  "https://gnjrklxotmbvnxbnnqgq.supabase.co",
  SUPABASE_KEY
);
```

### Mobile (Dual Clients)
```typescript
// wagerproof-mobile/services/supabase.ts

// Main client (auth, chat, profiles)
export const supabase = createClient(MAIN_URL, MAIN_KEY, {
  auth: {
    storage: AsyncStorage,  // NOT sessionStorage
    persistSession: true,
  },
});

// CFB client (predictions, games)
export const collegeFootballSupabase = createClient(CFB_URL, CFB_KEY, {
  auth: { persistSession: false }
});
```

---

## Web Caching

### React Query Configuration (`App.tsx`)
```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,      // 5 minutes
      gcTime: 10 * 60 * 1000,        // 10 minutes
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});
```

### Sports Page Cache (`useSportsPageCache.ts`)
```typescript
// Features:
// - sessionStorage persistence
// - 5-minute TTL
// - Scroll position tracking
// - Debounced writes (500ms)
// - Smart scroll saving (>10px, 2+ sec intervals)
```

---

## Mobile Caching

### In-Memory Per-Sport Cache
```typescript
// Feed screen
const [cachedData, setCachedData] = useState<{
  [sport: string]: {
    data: Game[];
    timestamp: number;
  }
}>({});

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
```

**Note**: Mobile does NOT use sessionStorage equivalent. Caching is in-memory only.

---

## Polymarket Cache

> **Full documentation**: See `09_polymarket_integration.md` for complete Polymarket API reference, widget usage, and troubleshooting.

### Tables
```sql
-- Market data per game
CREATE TABLE polymarket_markets (
  id SERIAL PRIMARY KEY,
  game_key TEXT,           -- e.g., "Baltimore_Miami"
  league TEXT,             -- 'nfl', 'cfb', 'nba', 'ncaab'
  market_type TEXT,        -- 'moneyline', 'spread', 'total'
  yes_token_id TEXT,       -- Polymarket token ID
  no_token_id TEXT,
  price_history JSONB,     -- Array of {t: timestamp, p: price}
  cached_at TIMESTAMPTZ
);

-- Event lists per league (1h TTL recommended)
CREATE TABLE polymarket_events (
  id SERIAL PRIMARY KEY,
  league TEXT UNIQUE,      -- 'nfl', 'cfb', etc.
  events JSONB,            -- Full event list from Gamma API
  cached_at TIMESTAMPTZ
);
```

### Edge Functions
- **`polymarket-proxy`** - CORS proxy for browser requests (see `11_edge_functions.md`)
- **`update-polymarket-cache`** - Cron job to refresh cache hourly

### Cache Flow
```
1. Widget requests data → polymarketService.ts
2. Service checks polymarket_markets table
3. If cache miss or stale (>1h): calls polymarket-proxy Edge Function
4. Edge Function fetches from Polymarket APIs, updates cache
5. Returns data to widget
```

---

## Betslip Links Storage

### Migration
```sql
ALTER TABLE editors_picks
ADD COLUMN betslip_links JSONB DEFAULT NULL;

CREATE INDEX idx_editors_picks_betslip_links
ON editors_picks USING GIN (betslip_links);
```

### Usage (`SportsbookButtons.tsx`)
```typescript
// Check database first
if (existingLinks && Object.keys(existingLinks).length > 0) {
  return existingLinks;
}

// Fetch from Odds API
const links = await fetchFromOddsAPI();

// Save to database (once only)
await supabase
  .from('editors_picks')
  .update({ betslip_links: links })
  .eq('id', pickId);
```

---

## Edge Functions (25+)

### Documented
- `polymarket-proxy` - CORS proxy
- `update-polymarket-cache` - Cache updater

### Undocumented (Production Critical)
- `generate-ai-completion`
- `generate-page-level-analysis`
- `generate-today-in-sports-completion`
- `update-value-finds-cron`
- `fetch-live-scores`
- `sync-revenuecat-user`
- `grant-entitlement`
- `send-discord-notification`
- And many more...

---

## Key Migrations

### AI System
- `20251108000002_create_ai_completion_tables.sql`
- `20251108000005_setup_cron_jobs.sql`

### Revenue
- `20251107000001_add_revenuecat_columns.sql`
- `20251107000002_add_sale_mode.sql`

### Features
- `20250210100000_create_game_tails.sql`
- `20250210000000_create_community_picks.sql`
- `20251118000000_share_wins_feature.sql`

---

## Web vs Mobile Differences

| Feature | Web | Mobile |
|---------|-----|--------|
| Clients | 1 | 2 (main + CFB) |
| Storage | sessionStorage | AsyncStorage |
| Caching | sessionStorage + React Query | In-memory only |
| OAuth | Standard | detectSessionInUrl |

---

## Key Files

**Web**: `src/integrations/supabase/client.ts`, `src/hooks/useSportsPageCache.ts`
**Mobile**: `wagerproof-mobile/services/supabase.ts`
**Functions**: `supabase/functions/*/index.ts`
**Migrations**: `supabase/migrations/*.sql`
