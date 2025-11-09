# Setting Up AI Cron Jobs in Supabase

## Overview
This guide explains how to set up automated cron jobs for the AI completion system using Supabase's built-in pg_cron extension.

## Prerequisites
- Supabase project URL
- Supabase service role key
- Access to Supabase SQL Editor

## Cron Jobs to Set Up

### 1. Morning Completion Check (8 AM Daily)
Checks for games missing AI completions and generates them.

### 2. Evening Completion Check (6 PM Daily)
Second daily check to catch any new games added during the day.

## Setup Instructions

### Step 1: Get Your Credentials
1. Go to your Supabase project settings
2. Copy your **Project URL** (e.g., `https://gnjrklxotmbvnxbnnqgq.supabase.co`)
3. Copy your **Service Role Key** (from API settings, keep this secret!)

### Step 2: Run SQL in Supabase SQL Editor

Go to: https://supabase.com/dashboard/project/gnjrklxotmbvnxbnnqgq/sql/new

**Replace `YOUR_PROJECT_URL` and `YOUR_SERVICE_ROLE_KEY` in the SQL below:**

```sql
-- =========================================
-- Enable pg_cron (usually already enabled)
-- =========================================
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- =========================================
-- Cron Job 1: Morning Check (8 AM)
-- =========================================
SELECT cron.schedule(
  'ai-completions-morning-check',
  '0 8 * * *', -- 8 AM daily
  $$
  SELECT net.http_post(
    url := 'YOUR_PROJECT_URL/functions/v1/check-missing-completions',
    headers := jsonb_build_object(
      'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY',
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  ) as request_id;
  $$
);

-- =========================================
-- Cron Job 2: Evening Check (6 PM)
-- =========================================
SELECT cron.schedule(
  'ai-completions-evening-check',
  '0 18 * * *', -- 6 PM daily
  $$
  SELECT net.http_post(
    url := 'YOUR_PROJECT_URL/functions/v1/check-missing-completions',
    headers := jsonb_build_object(
      'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY',
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  ) as request_id;
  $$
);

-- =========================================
-- Create Cron Logs Table
-- =========================================
CREATE TABLE IF NOT EXISTS ai_cron_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name TEXT NOT NULL,
  run_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL CHECK (status IN ('success', 'failed', 'started')),
  details JSONB,
  error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_ai_cron_logs_job_name ON ai_cron_logs(job_name);
CREATE INDEX IF NOT EXISTS idx_ai_cron_logs_run_at ON ai_cron_logs(run_at DESC);

ALTER TABLE ai_cron_logs ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE ai_cron_logs IS 'Tracks AI cron job execution history';
```

### Step 3: Verify Cron Jobs Are Active

```sql
-- List all cron jobs
SELECT * FROM cron.job;

-- Should show:
-- jobid | schedule    | command              | nodename  | nodeport | database | username | active | jobname
-- ------+-------------+----------------------+-----------+----------+----------+----------+--------+--------------------------------
-- ...   | 0 8 * * *   | SELECT net.http_post | localhost | ...      | postgres | ...      | t      | ai-completions-morning-check
-- ...   | 0 18 * * *  | SELECT net.http_post | localhost | ...      | postgres | ...      | t      | ai-completions-evening-check
```

### Step 4: Test a Cron Job Manually

To test without waiting for the scheduled time:

```sql
-- Manually trigger the function
SELECT net.http_post(
  url := 'YOUR_PROJECT_URL/functions/v1/check-missing-completions',
  headers := jsonb_build_object(
    'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY',
    'Content-Type', 'application/json'
  ),
  body := '{}'::jsonb
);
```

Then check the Edge Function logs:
https://supabase.com/dashboard/project/gnjrklxotmbvnxbnnqgq/functions/check-missing-completions

## Monitoring Cron Jobs

### View Cron Job History
```sql
SELECT * 
FROM cron.job_run_details 
ORDER BY start_time DESC 
LIMIT 20;
```

This shows:
- `start_time`: When the job ran
- `end_time`: When it finished
- `status`: `succeeded` or `failed`
- `return_message`: Any output or errors

### View Custom Logs (once implemented)
```sql
SELECT * 
FROM ai_cron_logs 
ORDER BY run_at DESC 
LIMIT 20;
```

## Managing Cron Jobs

### Pause a Cron Job
```sql
-- Unschedule (delete) a cron job
SELECT cron.unschedule('ai-completions-morning-check');
SELECT cron.unschedule('ai-completions-evening-check');
```

### Reschedule with Different Time
```sql
-- Delete old job
SELECT cron.unschedule('ai-completions-morning-check');

-- Create new job with different schedule (e.g., 9 AM instead of 8 AM)
SELECT cron.schedule(
  'ai-completions-morning-check',
  '0 9 * * *', -- 9 AM daily
  $$ ...same command as before... $$
);
```

## Cron Schedule Format

The schedule uses standard cron syntax: `minute hour day month dayofweek`

Examples:
- `0 8 * * *` - 8:00 AM every day
- `0 18 * * *` - 6:00 PM every day
- `0 */6 * * *` - Every 6 hours
- `*/30 * * * *` - Every 30 minutes
- `0 9 * * 1-5` - 9 AM on weekdays only

## Troubleshooting

### Cron Job Not Running
1. Check if pg_cron is enabled:
```sql
SELECT * FROM pg_extension WHERE extname = 'pg_cron';
```

2. Check if jobs are active:
```sql
SELECT * FROM cron.job WHERE active = true;
```

3. Check recent job runs for errors:
```sql
SELECT * FROM cron.job_run_details WHERE status = 'failed' ORDER BY start_time DESC LIMIT 5;
```

### Edge Function Errors
1. Check Edge Function logs in Supabase Dashboard
2. Test the function manually first:
```bash
curl -X POST 'YOUR_PROJECT_URL/functions/v1/check-missing-completions' \
  -H 'Authorization: Bearer YOUR_SERVICE_ROLE_KEY' \
  -H 'Content-Type: application/json' \
  -d '{}'
```

3. Make sure Edge Function is deployed:
```bash
npx supabase functions deploy check-missing-completions
```

### Rate Limiting
If you're generating too many completions at once:
- Adjust the delay in the Edge Function code
- Reduce the frequency of cron jobs
- Implement batching logic

## Best Practices

1. **Start with manual testing**: Always test the Edge Function manually before setting up automated cron jobs
2. **Monitor costs**: OpenAI API calls cost money - monitor your usage
3. **Keep service key secure**: Never commit your service role key to git
4. **Check logs regularly**: Review cron job history weekly
5. **Set up alerts**: Consider Supabase webhooks to notify you of failures

## Cost Estimation

### API Calls Per Day
- Morning check: ~10-50 games (depending on schedule)
- Evening check: ~5-20 new games
- Total: ~15-70 completions per day

### OpenAI Costs (GPT-4o-mini)
- Input: ~500 tokens per game = $0.00015 per completion
- Output: ~200 tokens = $0.00012 per completion
- **Total**: ~$0.00027 per completion
- **Daily**: ~$0.019 (70 games × $0.00027)
- **Monthly**: ~$0.57

With web search enabled, costs may be slightly higher but still minimal.

## Next Steps

After setting up cron jobs:
1. Monitor the first few automated runs
2. Check that completions are appearing in the database
3. Verify they're displaying correctly on the website
4. Set up page-level analysis schedules if desired (currently manual only)
5. Implement Discord integration for Value Finds notifications

