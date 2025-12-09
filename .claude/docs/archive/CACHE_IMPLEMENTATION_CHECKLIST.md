# Polymarket Cache Implementation - Quick Execution Checklist

> **Step-by-step commands to implement caching for Polymarket data**

---

## Prerequisites

✅ You have Supabase CLI installed  
✅ You have the Edge Function code ready  
✅ You have database migration ready  

---

## Step 1: Apply Database Migration

### Option A: Using Supabase CLI (Recommended)

```bash
cd /Users/chrishabib/Documents/new-wagerproof

# Push migrations to Supabase
supabase db push
```

**Expected Output**:
```
Applying migration 20250129000000_create_polymarket_cache.sql
✓ Successfully applied migration
```

### Option B: Via Supabase Dashboard

If you don't have CLI:

1. Go to **[Supabase Dashboard](https://app.supabase.com)** → Your Project
2. Click **SQL Editor** (left sidebar)
3. Click **+ New Query**
4. Copy & paste the contents of:
   ```
   supabase/migrations/20250129000000_create_polymarket_cache.sql
   ```
5. Click **Run**

**Verify table was created**:
```sql
SELECT tablename FROM pg_tables WHERE tablename = 'polymarket_markets';
```

Should return: `polymarket_markets`

---

## Step 2: Deploy the Cron Job Edge Function

### Option A: Using Supabase CLI (Recommended)

```bash
# Navigate to project
cd /Users/chrishabib/Documents/new-wagerproof

# Deploy the function
supabase functions deploy update-polymarket-cache

# Verify deployment
supabase functions list
```

**Expected Output**:
```
update-polymarket-cache  │ deployed  │ 2025-01-29 12:34:56
```

### Option B: Via Supabase Dashboard

1. Go to **[Supabase Dashboard](https://app.supabase.com)** → Your Project
2. Click **Edge Functions** (left sidebar)
3. Click **+ Create a New Function**
4. **Name**: `update-polymarket-cache`
5. **Copy code** from:
   ```
   supabase/functions/update-polymarket-cache/index.ts
   ```
6. Click **Deploy**

---

## Step 3: Enable pg_cron Extension

Run this SQL in your Supabase project:

```sql
CREATE EXTENSION IF NOT EXISTS pg_cron;
```

**Verify**:
```sql
SELECT * FROM pg_extension WHERE extname = 'pg_cron';
```

Should return a row with `pg_cron`

---

## Step 4: Schedule the Cron Job

Get your Supabase credentials first:

```bash
# Find your project reference and anon key in Supabase Dashboard
# Go to Settings → API → Project URL and anon key
```

Run this SQL in your Supabase project:

```sql
SELECT cron.schedule(
  'update-polymarket-cache-hourly',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/update-polymarket-cache',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer YOUR_ANON_KEY'
    ),
    body := '{}'::jsonb
  );
  $$
);
```

**Replace**:
- `YOUR_PROJECT_REF` - Your project reference (e.g., `abc123def456`)
- `YOUR_ANON_KEY` - Your public anon key

**Verify cron job was created**:
```sql
SELECT * FROM cron.job WHERE jobname = 'update-polymarket-cache-hourly';
```

Should return one row

---

## Step 5: Initial Population (Manual Trigger)

Trigger the cache update immediately so data is ready:

### Option A: Via curl

```bash
curl -X POST https://YOUR_PROJECT_REF.supabase.co/functions/v1/update-polymarket-cache \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{}'
```

### Option B: Via Supabase Dashboard

1. Go to **Edge Functions** → `update-polymarket-cache`
2. Click **Invoke** (top right)
3. Click **Send**

**Expected Response**:
```json
{
  "success": true,
  "updated": 42,
  "games": 14,
  "errors": 0,
  "details": "Updated moneyline, spread, total for 14 games"
}
```

---

## Step 6: Verify Cache is Populated

Check what's in the cache table:

```sql
-- View all cached markets
SELECT 
  game_key,
  market_type,
  current_away_odds,
  current_home_odds,
  last_updated
FROM polymarket_markets
ORDER BY last_updated DESC
LIMIT 20;
```

**Expected**: Multiple rows with recent timestamps

---

## Step 7: Update Service Layer to Use Cache

**File**: `src/services/polymarketService.ts`

Find the `getAllMarketsData()` function (~line 858) and change it:

```typescript
// CHANGE FROM:
export async function getAllMarketsData(
  awayTeam: string,
  homeTeam: string,
  league: 'nfl' | 'cfb' = 'nfl'
): Promise<PolymarketAllMarketsData | null> {
  // For now, use live API directly (cache will come in Phase 2)
  return getAllMarketsDataLive(awayTeam, homeTeam, league);
}

// CHANGE TO:
export async function getAllMarketsData(
  awayTeam: string,
  homeTeam: string,
  league: 'nfl' | 'cfb' = 'nfl'
): Promise<PolymarketAllMarketsData | null> {
  // Use cache first, fall back to live API
  return getAllMarketsDataFromCache(awayTeam, homeTeam);
}
```

This enables the cache-first behavior (already implemented).

---

## Step 8: Test the Implementation

### Test 1: Check console logs

1. Navigate to an NFL game page
2. Open browser DevTools → Console
3. Look for these logs:

```
📦 Fetching cached Polymarket data for: Baltimore_Miami
✅ Found 3 cached markets
📊 moneyline: 58% - 42% (2min old)
📊 spread: 45% - 55% (2min old)
📊 total: 50% - 50% (2min old)
```

### Test 2: Check page load time

Before caching:
- Page load: 3-5 seconds
- Network tab: ~100 requests

After caching:
- Page load: ~500ms
- Network tab: ~14 requests (just DB queries)

### Test 3: Check cache staleness

Cache auto-refreshes every hour. To test:
1. Wait for cron job to run (at next hour)
2. Check `last_updated` timestamp in cache
3. Should be recent

---

## Step 9: Monitoring

### Check cache status daily

```sql
-- How old is the cache data?
SELECT 
  game_key,
  market_type,
  EXTRACT(EPOCH FROM (NOW() - last_updated))/60 AS age_minutes
FROM polymarket_markets
ORDER BY last_updated DESC;
```

### Check cron job runs

```sql
-- Did the cron job run successfully?
SELECT 
  jobid,
  database,
  command,
  nodename,
  nodeid,
  start_time,
  status
FROM cron.job_run_details
ORDER BY start_time DESC
LIMIT 10;
```

### View Edge Function logs

Go to **[Supabase Dashboard](https://app.supabase.com)** → **Edge Functions** → `update-polymarket-cache` → **Logs** tab

---

## Quick Reference Table

| Step | Command | Time |
|------|---------|------|
| 1. DB Migration | `supabase db push` | 1 min |
| 2. Deploy Function | `supabase functions deploy update-polymarket-cache` | 1 min |
| 3. Enable pg_cron | Run SQL in dashboard | 1 min |
| 4. Schedule Cron | Run SQL with your credentials | 2 min |
| 5. Initial Trigger | `curl` command or click Invoke | 2 min |
| 6. Verify Cache | Run SQL SELECT | 1 min |
| 7. Update Service | Change one line in polymarketService.ts | 1 min |
| 8. Test | Navigate to page, check console | 5 min |
| **TOTAL** | | **~15 min** |

---

## Success Indicators

✅ Migration applied (table exists)  
✅ Edge Function deployed (shows in list)  
✅ pg_cron enabled (extension exists)  
✅ Cron job scheduled (shows in cron.job)  
✅ Initial trigger succeeded (success: true)  
✅ Cache populated (SELECT returns rows)  
✅ Console logs show "Fetching cached Polymarket data"  
✅ Page loads fast (check Network tab)  

---

**Status**: Ready to execute ✅  
**Expected Time**: 15 minutes  
**Difficulty**: Medium (mostly copy-paste)
