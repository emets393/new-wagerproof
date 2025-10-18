# Live Score Ticker Setup Guide

## Overview

The Live Score Ticker is a scalable, real-time scoreboard that displays live NFL and NCAA Football games across the top of your website. It uses a backend caching strategy to ensure optimal performance and avoid rate limits.

## Architecture

```
ESPN API → Supabase Edge Function → Database Cache → Frontend Display
   ↑              (every 2 min)         ↓                    ↓
   └──────────────────────────────────────────────────────────┘
   (1 API call per 2 minutes regardless of user count)
```

### Key Features

- ✅ **Infinitely Scalable**: 1 ESPN API call per 2 minutes, no matter how many users
- ✅ **Real-time Updates**: Scores update every 2 minutes automatically
- ✅ **Conditional Display**: Only appears when games are actually live
- ✅ **Beautiful UI**: Follows WagerProof design language with animations
- ✅ **Team Colors**: Uses official team colors from ESPN data
- ✅ **Responsive**: Hidden on small mobile, scrolls smoothly on larger screens

## Deployment Steps

### 1. Run Database Migration

The migration creates the `live_scores` table with proper indexes and RLS policies.

```bash
# Navigate to your Supabase project
cd /Users/chrishabib/Documents/new-wagerproof

# Run the migration via Supabase CLI
supabase db push

# Or manually apply the migration file:
# supabase/migrations/20251018000000_create_live_scores_table.sql
```

**What it creates:**
- `live_scores` table with game data
- Indexes for efficient querying
- Row Level Security policies (public read, service role write)

### 2. Deploy Edge Function

Deploy the `fetch-live-scores` edge function to Supabase.

```bash
# Deploy the edge function
supabase functions deploy fetch-live-scores

# Verify deployment
supabase functions list
```

**What it does:**
- Fetches scores from ESPN's public API (NFL and NCAA Football)
- Parses game data (teams, scores, status, colors)
- Upserts into `live_scores` table
- Marks completed games as inactive
- Cleans up old data (>6 hours)

### 3. Test the Edge Function

Test that the function works correctly:

```bash
# Invoke the function manually
supabase functions invoke fetch-live-scores

# Or via curl
curl -X POST 'https://your-project.supabase.co/functions/v1/fetch-live-scores' \
  -H "Authorization: Bearer YOUR_ANON_KEY"
```

**Expected response:**
```json
{
  "success": true,
  "totalGames": 15,
  "liveGames": 3,
  "timestamp": "2025-10-18T20:15:00.000Z"
}
```

### 4. Verify Frontend Integration

The ticker is already integrated into your app layouts:

- ✅ **Authenticated pages**: Appears above MinimalHeader
- ✅ **Public pages**: Appears at the top of landing page
- ✅ **Automatic refresh**: Triggers on app load if data is stale
- ✅ **Conditional display**: Only shows when live games exist

### 5. Optional: Setup Automated Refresh (Advanced)

For fully automated updates without relying on frontend triggers, you can set up a cron job.

#### Option A: Supabase Cron Extension (Recommended)

```sql
-- Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule the function to run every 2 minutes during game hours
-- (Adjust times based on typical game schedules)
SELECT cron.schedule(
  'refresh-live-scores',
  '*/2 * * * *',  -- Every 2 minutes
  $$
  SELECT net.http_post(
    url := 'https://your-project.supabase.co/functions/v1/fetch-live-scores',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY'
    )
  );
  $$
);
```

#### Option B: External Cron Service

Use a service like Cron-job.org or GitHub Actions to call the edge function every 2 minutes:

```yaml
# .github/workflows/refresh-scores.yml
name: Refresh Live Scores
on:
  schedule:
    - cron: '*/2 * * * *'  # Every 2 minutes
  workflow_dispatch:

jobs:
  refresh:
    runs-on: ubuntu-latest
    steps:
      - name: Call Edge Function
        run: |
          curl -X POST 'https://your-project.supabase.co/functions/v1/fetch-live-scores' \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_ANON_KEY }}"
```

## How It Works

### Data Flow

1. **Initial Load**: When a user visits the site, `useLiveScores` hook checks if cached data is recent
2. **Trigger Refresh**: If data is >2 minutes old, it calls the edge function
3. **Fetch & Cache**: Edge function fetches from ESPN and caches in database
4. **Display**: Frontend reads from cache and displays live games
5. **Auto-Update**: Hook refetches from cache every 2 minutes while games are live

### Frontend Components

| Component | Purpose |
|-----------|---------|
| `LiveScoreTicker.tsx` | Main ticker container with Marquee |
| `LiveScoreCard.tsx` | Individual game card with animations |
| `useLiveScores.ts` | React Query hook for data fetching |
| `liveScoresService.ts` | Supabase query functions |

### Backend Components

| Component | Purpose |
|-----------|---------|
| `fetch-live-scores` Edge Function | Fetches and caches ESPN data |
| `live_scores` Table | Stores cached game data |
| Database Indexes | Optimizes queries by `is_live` status |

## Customization

### Adjust Update Frequency

Change the refetch interval in `src/hooks/useLiveScores.ts`:

```typescript
refetchInterval: (query) => {
  const hasLiveGames = query.state.data && query.state.data.length > 0;
  return hasLiveGames ? 2 * 60 * 1000 : false; // Change from 2 minutes
}
```

### Add More Sports

To add NBA, MLB, or other sports:

1. Update `fetch-live-scores/index.ts` to fetch additional ESPN endpoints:
   - NBA: `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard`
   - MLB: `https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard`

2. Parse the data with the same structure

3. Add league values to the type: `league: 'NFL' | 'NCAAF' | 'NBA' | 'MLB'`

### Customize Appearance

The ticker follows your design language. Customize in `LiveScoreCard.tsx`:

- Card size: Adjust `min-w-[280px] h-[110px]`
- Colors: Modify honeydew green accent colors
- Animation: Change hover scale or add effects
- Layout: Rearrange team/score display

### Change Scroll Speed

Adjust marquee duration in `LiveScoreTicker.tsx`:

```typescript
<Marquee
  pauseOnHover
  className="[--duration:60s]" // Change from 60s
  repeat={3}
>
```

## Monitoring

### Check Live Games

Query the database to see current live games:

```sql
SELECT 
  league,
  away_abbr,
  away_score,
  home_abbr,
  home_score,
  status,
  period,
  time_remaining,
  last_updated
FROM live_scores
WHERE is_live = true
ORDER BY league, away_abbr;
```

### View Update History

Check when data was last refreshed:

```sql
SELECT 
  MAX(last_updated) as last_refresh,
  COUNT(*) as total_games,
  COUNT(*) FILTER (WHERE is_live = true) as live_games
FROM live_scores;
```

### Edge Function Logs

View logs in Supabase Dashboard:
1. Go to Edge Functions
2. Select `fetch-live-scores`
3. View Logs tab

## Troubleshooting

### Ticker Not Showing

**Problem**: Ticker doesn't appear even though games should be live

**Solutions**:
1. Check if games are actually live: Visit ESPN.com to verify
2. Manually trigger refresh: Open browser console and run `window.location.reload()`
3. Check database: Run query above to see if `is_live = true` for any games
4. Test edge function: Call it manually to see if it fetches data

### Stale Data

**Problem**: Scores aren't updating

**Solutions**:
1. Check last_updated timestamp in database
2. Verify edge function is running successfully
3. Check browser console for errors
4. Ensure React Query isn't disabled (check devtools)

### Edge Function Errors

**Problem**: Edge function fails or returns errors

**Solutions**:
1. Check ESPN API status: Try accessing endpoints directly
2. View edge function logs in Supabase dashboard
3. Verify environment variables (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
4. Check RLS policies allow service role to write

### No Team Colors

**Problem**: Team colors not displaying

**Solutions**:
1. ESPN API may not provide colors for all teams
2. Check `away_color` and `home_color` in database
3. Fallback: Cards will use default gradient if colors missing

## Performance

### Expected Load

- **API Calls**: 1 call to ESPN per 2 minutes (30 calls/hour)
- **Database Writes**: ~15-30 upserts per refresh (depending on games)
- **Database Reads**: 1 read per user every 2 minutes (while ticker visible)
- **Bundle Size**: ~5KB added (components + hook + service)

### Scalability

| Users | ESPN API Calls | Database Reads |
|-------|----------------|----------------|
| 10 | 30/hour | 300/hour |
| 1,000 | 30/hour | 30,000/hour |
| 100,000 | 30/hour | 3M/hour |

Database reads scale linearly with users, but all reads are from cache (fast). ESPN API calls remain constant.

## Future Enhancements

Potential improvements for v2:

- [ ] Add more sports (NBA, MLB, NCAAB)
- [ ] Click game card to see detailed stats
- [ ] Push notifications for score changes
- [ ] Betting odds integration
- [ ] Game highlights/key plays
- [ ] Favorites: Only show selected teams
- [ ] Mobile-optimized vertical ticker
- [ ] Historical scoreboard (yesterday's games)

## Support

For issues or questions:
1. Check Supabase Edge Function logs
2. Verify database migration ran successfully
3. Test ESPN API endpoints directly
4. Review browser console for frontend errors

## License

Part of WagerProof platform. Internal use only.

