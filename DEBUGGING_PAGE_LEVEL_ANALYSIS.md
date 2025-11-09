# Debugging Page-Level Analysis 500 Error

## What Was Changed

I've enhanced the error reporting in the `generate-page-level-analysis` Edge Function to help diagnose the 500 error you're experiencing.

### Changes Made:

1. **Enhanced Error Logging in Edge Function**
   - Added detailed error stack traces
   - Added error type information
   - Added JSON serialization of error objects

2. **Improved Frontend Error Display**
   - Toast notifications now show the full error message
   - Error stack traces are included when available
   - Debug logs show the complete response

3. **Better Service Layer Error Handling**
   - Checks if Edge Function returns error in the response body
   - Formats error messages with type and stack information

## How to Debug the Issue

### Step 1: Try Again and Check the Error Message

1. Go to **Admin Panel → AI Settings → Page-Level Analysis**
2. Click **"Generate Now"** for NFL
3. Look at the toast notification - it should now show a detailed error message
4. Open your browser console (F12) and look for:
   - `Page analysis result:` - shows the full response
   - `Analysis failed:` - shows the specific error

### Step 2: Check Supabase Function Logs

1. Go to: https://supabase.com/dashboard/project/gnjrklxotmbvnxbnnqgq/functions
2. Click on `generate-page-level-analysis`
3. Click the **Logs** tab
4. Look for recent invocations
5. Expand the logs to see:
   - `Generating page-level analysis for nfl on [date]`
   - `Found X games for nfl on [date]`
   - Any error messages

### Step 3: Common Causes and Fixes

#### Cause 1: No Schedule Config Found
**Error**: `No schedule config found for nfl`

**Fix**: Verify the migration ran successfully:
```sql
SELECT * FROM ai_page_level_schedules WHERE sport_type = 'nfl';
```
If empty, re-run: `npx supabase db push`

#### Cause 2: No Games Found
**Error**: `No games found for the specified date`

**Solution**: The function filters by today's date. If there are no games today:
- Use the test payload tool instead (it doesn't filter by date)
- Or modify the date filter in the Edge Function temporarily

#### Cause 3: OpenAI API Key Missing
**Error**: `OPENAI_API_KEY not configured`

**Fix**: Add the API key to Supabase:
1. Go to: https://supabase.com/dashboard/project/gnjrklxotmbvnxbnnqgq/settings/functions
2. Add environment variable:
   - Key: `OPENAI_API_KEY`
   - Value: `sk-proj-...` (your key)

#### Cause 4: Invalid OpenAI Response
**Error**: `Invalid response structure from OpenAI`

**Check**: 
- Verify OpenAI API key is valid
- Check if you have credits remaining
- Look at the Edge Function logs for the OpenAI response structure

#### Cause 5: Database Insert Error
**Error**: May mention `ai_value_finds` or constraint violations

**Fix**: Check if there's already an analysis for today:
```sql
SELECT * FROM ai_value_finds 
WHERE sport_type = 'nfl' 
AND analysis_date = CURRENT_DATE;
```
If there is, delete it or change the date field.

#### Cause 6: CFB Supabase Client Issue
**Error**: Related to `cfbClient` or `CFB_SUPABASE_URL`

**Fix**: Verify environment variables are set:
- `CFB_SUPABASE_URL`
- `CFB_SUPABASE_ANON_KEY`

## Testing with the Payload Tester

The payload tester is safer for testing because it:
- Doesn't filter by date (gets latest 10 games)
- Shows you the exact data being sent
- Displays the full response
- Doesn't post to Discord

**To use**:
1. Go to **Admin Panel → AI Settings → Page-Level Analysis**
2. Click **"Test Payload"** button
3. Review the sample games
4. Click **"Generate Test Analysis"**
5. Check the response

## Quick Temporary Fix: Remove Date Filter

If the issue is date-related, you can temporarily modify the Edge Function:

**File**: `supabase/functions/generate-page-level-analysis/index.ts`

**Find** (line 63):
```typescript
.eq('game_date', targetDate);
```

**Replace with**:
```typescript
// .eq('game_date', targetDate); // Temporarily disabled
.limit(10); // Get latest 10 games
```

Then redeploy:
```bash
npx supabase functions deploy generate-page-level-analysis
```

## Next Steps

1. **Try the generation again** and note the specific error message
2. **Check the Supabase function logs** for detailed stack traces
3. **Try the Test Payload tool** to see if it works without date filtering
4. **Share the specific error message** so we can pinpoint the exact issue

## Environment Variables Checklist

Make sure these are set in Supabase Functions settings:

- [ ] `OPENAI_API_KEY` - Your OpenAI API key
- [ ] `SUPABASE_URL` - Auto-set by Supabase
- [ ] `SUPABASE_SERVICE_ROLE_KEY` - Auto-set by Supabase
- [ ] `CFB_SUPABASE_URL` - Your CFB database URL
- [ ] `CFB_SUPABASE_ANON_KEY` - Your CFB database anon key
- [ ] `DISCORD_WEBHOOK_URL` (Optional) - Discord webhook for posting Value Finds

To check/set these:
https://supabase.com/dashboard/project/gnjrklxotmbvnxbnnqgq/settings/functions

---

## Example of What to Look For in Logs

**Good logs**:
```
Generating page-level analysis for nfl on 2025-11-08
Found 12 games for nfl on 2025-11-08
Found 8 completions
Calling OpenAI Responses API for page-level analysis with web search...
OpenAI page-level analysis received
Analysis content extracted, length: 1543
Value finds analysis complete. Found 3 value opportunities
```

**Bad logs (what might be causing your error)**:
```
Generating page-level analysis for nfl on 2025-11-08
Found 0 games for nfl on 2025-11-08
Error in generate-page-level-analysis: Error: No games found for the specified date
```

Or:

```
Generating page-level analysis for nfl on 2025-11-08
Found 12 games for nfl on 2025-11-08
Error in generate-page-level-analysis: Error: OPENAI_API_KEY not configured
```

---

**After you try again, please share**:
1. The error message from the toast
2. The console log output
3. The Supabase function logs

This will help us identify the exact issue!

