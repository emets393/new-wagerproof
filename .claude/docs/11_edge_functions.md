# Supabase Edge Functions

> Last verified: January 2025

## Overview

WagerProof uses Supabase Edge Functions (Deno runtime) for server-side operations that require:
- CORS bypass (Polymarket, ESPN APIs)
- Secrets management (API keys)
- Database access with service role
- Scheduled tasks (cron jobs)

**Location**: `supabase/functions/`

---

## Function Inventory

### API Proxies
| Function | Purpose | Called From |
|----------|---------|-------------|
| `polymarket-proxy` | CORS proxy for Polymarket APIs | `polymarketService.ts` |
| `fetch-live-scores` | ESPN scoreboard API → `live_scores` table | `liveScoresService.ts` |

### AI Completions
| Function | Purpose | Trigger |
|----------|---------|---------|
| `generate-ai-completion` | OpenAI Responses API for game analysis | On-demand |
| `generate-page-level-analysis` | Aggregate page-level AI insights | On-demand |
| `generate-today-in-sports-completion` | Daily sports summary | Cron |
| `check-missing-completions` | Find games without AI analysis | Cron |

### Value Finds
| Function | Purpose | Trigger |
|----------|---------|---------|
| `update-value-finds-cron` | Identify high-value betting opportunities | Cron |
| `run-scheduled-value-finds` | Scheduled value find updates | Cron |

### Revenue/Entitlements
| Function | Purpose | Called From |
|----------|---------|-------------|
| `sync-revenuecat-user` | Sync RevenueCat subscription status | Webhook |
| `grant-entitlement` | Grant Pro access programmatically | Admin |
| `create-portal-session` | Create Stripe customer portal session | Settings page |

### Notifications
| Function | Purpose | Trigger |
|----------|---------|---------|
| `send-discord-notification` | Send alerts to Discord channel | Various |

### Analytics/Patterns
| Function | Purpose | Called From |
|----------|---------|-------------|
| `calculate-pattern-roi` | Calculate ROI for betting patterns | Pattern pages |
| `check-saved-patterns` | Evaluate saved pattern performance | Cron |
| `filter-training-data` | Filter historical data for patterns | Pattern pages |
| `filter-nfl-training-data` | NFL-specific training data filter | Pattern pages |
| `games-today-filtered` | Get today's games with filters | Various |
| `get-game-analysis-data` | Fetch detailed game analysis | Game modals |
| `run_custom_model` | Execute custom prediction models | Analytics |

### Caching
| Function | Purpose | Trigger |
|----------|---------|---------|
| `update-polymarket-cache` | Refresh Polymarket data cache | Cron |

---

## Key Functions Detail

### `polymarket-proxy`

**Purpose**: CORS bypass for Polymarket Gamma and CLOB APIs.

**Actions**:
| Action | Params | Upstream API |
|--------|--------|--------------|
| `sports` | - | `gamma-api.polymarket.com/sports` |
| `events` | `tagId` | `gamma-api.polymarket.com/events` |
| `price-history` | `tokenId`, `interval`, `fidelity` | `clob.polymarket.com/prices-history` |
| `search` | `query` | Multiple Gamma endpoints |
| `teams` | `league` | `gamma-api.polymarket.com/teams` |

**Usage**:
```typescript
const { data } = await supabase.functions.invoke('polymarket-proxy', {
  body: {
    action: 'events',
    tagId: '450'  // NFL
  }
});
```

**Full documentation**: See `09_polymarket_integration.md`

---

### `fetch-live-scores`

**Purpose**: Fetch live scores from ESPN and upsert to `live_scores` table.

**ESPN Endpoints**:
```typescript
const sportEndpoints = [
  { league: 'NFL', url: 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard' },
  { league: 'NCAAF', url: 'https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard' },
  { league: 'NBA', url: 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard' },
  { league: 'NCAAB', url: 'https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard' },
  { league: 'NHL', url: 'https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/scoreboard' },
  { league: 'MLB', url: 'https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard' },
  { league: 'MLS', url: 'https://site.api.espn.com/apis/site/v2/sports/soccer/usa.1/scoreboard' },
  { league: 'EPL', url: 'https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/scoreboard' },
];
```

**Flow**:
1. Fetch all league scoreboards in parallel
2. Parse games to `ParsedGame` format
3. Upsert to `live_scores` table
4. Mark inactive games as `is_live: false`
5. Delete stale games (>6 hours old)

**Response**:
```json
{
  "success": true,
  "totalGames": 45,
  "liveGames": 12,
  "timestamp": "2025-01-15T20:30:00.000Z"
}
```

---

### `generate-ai-completion`

**Purpose**: Generate AI analysis for games using OpenAI Responses API.

**Request**:
```typescript
interface CompletionRequest {
  game_id: string;
  sport_type: 'nfl' | 'cfb' | 'nba' | 'ncaab';
  widget_type: string;
  game_data_payload: any;
  custom_system_prompt?: string;
}
```

**Flow**:
1. Check if completion already exists in `ai_completions` table
2. If exists, return cached version
3. Fetch system prompt from `ai_completion_configs` table
4. Call OpenAI Responses API with web search enabled
5. Store completion in database
6. Return generated text

**Configuration Table**: `ai_completion_configs`
- `widget_type`: Type of analysis (e.g., "game_analysis", "betting_insights")
- `sport_type`: Sport (nfl, cfb, nba, ncaab)
- `system_prompt`: The prompt template
- `enabled`: Boolean to enable/disable

---

### `sync-revenuecat-user`

**Purpose**: Sync user subscription status from RevenueCat webhooks.

**Triggers**: RevenueCat webhook events (purchase, renewal, cancellation)

**Updates**:
- `profiles.is_subscribed`
- `profiles.subscription_type`
- `profiles.subscription_expires_at`

---

## Deployment

### Deploy Single Function
```bash
supabase functions deploy polymarket-proxy
```

### Deploy All Functions
```bash
supabase functions deploy
```

### List Deployed Functions
```bash
supabase functions list
```

### View Logs
```bash
# Tail logs in real-time
supabase functions logs polymarket-proxy --tail

# Last 100 lines
supabase functions logs fetch-live-scores
```

---

## Environment Variables

Edge Functions access secrets via `Deno.env.get()`:

```typescript
// Required for most functions
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

// For AI functions
const openaiKey = Deno.env.get('OPENAI_API_KEY');

// For RevenueCat
const revenuecatKey = Deno.env.get('REVENUECAT_API_KEY');
```

### Setting Secrets

```bash
# Set a secret
supabase secrets set OPENAI_API_KEY=sk-xxx

# List secrets
supabase secrets list
```

---

## CORS Headers

All functions should include CORS headers for browser access:

```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Handle preflight
if (req.method === 'OPTIONS') {
  return new Response('ok', { headers: corsHeaders });
}

// Include in all responses
return new Response(JSON.stringify(data), {
  headers: { ...corsHeaders, 'Content-Type': 'application/json' }
});
```

---

## Invoking from Client

```typescript
// Basic invocation
const { data, error } = await supabase.functions.invoke('function-name', {
  body: { param1: 'value1' }
});

// With timeout
const { data, error } = await supabase.functions.invoke('function-name', {
  body: { param1: 'value1' },
  options: { timeout: 30000 }  // 30 seconds
});
```

---

## Cron Jobs

Some functions run on schedules defined in `supabase/migrations/*_setup_cron_jobs.sql`:

```sql
-- Example: Run value finds update every hour
SELECT cron.schedule(
  'update-value-finds',
  '0 * * * *',  -- Every hour
  $$
    SELECT net.http_post(
      url := 'https://xxx.supabase.co/functions/v1/update-value-finds-cron',
      headers := '{"Authorization": "Bearer xxx"}'::jsonb
    );
  $$
);
```

---

## Shared Utilities

**Location**: `supabase/functions/shared/`

```typescript
// supabase/functions/shared/dateUtils.ts
export function getToday(): string;
export function formatGameDate(date: Date): string;
```

Import in functions:
```typescript
import { getToday } from '../shared/dateUtils.ts';
```

---

## Troubleshooting

### Function Returns 404
- Verify function is deployed: `supabase functions list`
- Check function name spelling in invoke call

### CORS Errors
- Ensure function handles `OPTIONS` preflight
- Verify `Access-Control-Allow-Origin` header is set

### Timeout Errors
- Default timeout is 60 seconds
- For long operations, use background jobs or break into smaller tasks

### "Invalid JWT" Errors
- Client must pass auth header: `Authorization: Bearer <access_token>`
- For public functions, verify anonymous access is allowed

### Logs Not Appearing
- Use `console.log()` in function code
- Check with: `supabase functions logs function-name --tail`

---

## File Structure

```
supabase/
├── functions/
│   ├── polymarket-proxy/
│   │   └── index.ts
│   ├── fetch-live-scores/
│   │   └── index.ts
│   ├── generate-ai-completion/
│   │   └── index.ts
│   ├── shared/
│   │   └── dateUtils.ts
│   └── ... (other functions)
├── migrations/
│   └── *_setup_cron_jobs.sql
└── config.toml
```

---

## Related Documentation

- `09_polymarket_integration.md` - Polymarket proxy details
- `10_api_integrations.md` - External API reference
- `08_database_caching.md` - Caching architecture
