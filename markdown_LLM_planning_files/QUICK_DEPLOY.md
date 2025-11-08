# Quick Deploy: Live Score Ticker

## Current Status
✅ ESPN API has **5 live college football games** right now  
❌ Ticker not showing because backend isn't deployed yet

## Deploy Now (5 minutes)

### Step 1: Run Database Migration (2 min)

1. Open Supabase Dashboard: https://supabase.com/dashboard
2. Select your project
3. Click **SQL Editor** in left sidebar
4. Click **New Query**
5. Copy and paste this SQL:

```sql
-- Create live_scores table for caching ESPN live game data
CREATE TABLE IF NOT EXISTS live_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id text UNIQUE NOT NULL,
  league text NOT NULL,
  away_team text NOT NULL,
  away_abbr text NOT NULL,
  away_score integer NOT NULL,
  away_color text,
  home_team text NOT NULL,
  home_abbr text NOT NULL,
  home_score integer NOT NULL,
  home_color text,
  status text NOT NULL,
  period text,
  time_remaining text,
  is_live boolean DEFAULT true,
  last_updated timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_live_scores_is_live ON live_scores(is_live);
CREATE INDEX IF NOT EXISTS idx_live_scores_league ON live_scores(league);
CREATE INDEX IF NOT EXISTS idx_live_scores_game_id ON live_scores(game_id);

-- Enable Row Level Security
ALTER TABLE live_scores ENABLE ROW LEVEL SECURITY;

-- Create policy to allow public read access (for authenticated and anonymous users)
CREATE POLICY "Allow public read access to live scores"
  ON live_scores
  FOR SELECT
  TO public
  USING (true);

-- Create policy to allow service role to manage live scores
CREATE POLICY "Allow service role to manage live scores"
  ON live_scores
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
```

6. Click **Run** (or press Cmd+Enter)
7. You should see "Success. No rows returned"

### Step 2: Deploy Edge Function (3 min)

#### Option A: Via Supabase Dashboard (Easiest)

1. In Supabase Dashboard, click **Edge Functions** in left sidebar
2. Click **Deploy a new function**
3. Name: `fetch-live-scores`
4. Copy the entire contents of:
   `/Users/chrishabib/Documents/new-wagerproof/supabase/functions/fetch-live-scores/index.ts`
5. Paste into the editor
6. Click **Deploy function**

#### Option B: Install CLI & Deploy (Recommended)

```bash
# Install Supabase CLI
brew install supabase/tap/supabase

# Login to Supabase
supabase login

# Link your project
supabase link --project-ref YOUR_PROJECT_REF

# Deploy the edge function
supabase functions deploy fetch-live-scores
```

### Step 3: Test the Edge Function (1 min)

Once deployed, test it:

**Via Dashboard:**
1. Go to Edge Functions → fetch-live-scores
2. Click **Invoke function**
3. Leave request body empty
4. Click **Send**
5. You should see response with `"success": true` and `"liveGames": 5`

**Via Terminal:**
```bash
curl -X POST 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/fetch-live-scores' \
  -H "Authorization: Bearer YOUR_ANON_KEY"
```

### Step 4: Verify Data (30 sec)

Back in SQL Editor, run:

```sql
SELECT * FROM live_scores WHERE is_live = true LIMIT 10;
```

You should see 5 live games!

### Step 5: Refresh Your App

1. Open your WagerProof app in browser
2. Hard refresh: Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)
3. The ticker should appear at the top! 🎉

## Troubleshooting

### Still not showing?

**Open browser console (F12) and check for errors:**

```javascript
// Manually trigger a refresh
window.location.reload(true);
```

**Or manually test the service:**

```javascript
// In browser console
const { supabase } = await import('./src/integrations/supabase/client');
const { data } = await supabase.from('live_scores').select('*').eq('is_live', true);
console.log('Live games:', data);
```

### Table already exists error?

That's fine! It means the migration ran before. Just continue to Step 2.

### Edge function fails?

Check the logs in Dashboard → Edge Functions → fetch-live-scores → Logs

Common issues:
- CORS errors: Should be handled in the code
- Network timeout: Try invoking again
- Permission error: Check service role key is set

## What Happens Next?

Once deployed:
1. ✅ Ticker appears showing 5 live games
2. ✅ Auto-refreshes every 2 minutes
3. ✅ Disappears when no games are live
4. ✅ Works for all users instantly

## Need Help?

If you get stuck, share:
1. Screenshot of error
2. Browser console logs
3. Edge function logs from dashboard

