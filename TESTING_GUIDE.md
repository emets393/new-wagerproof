# Testing Guide - Sportsbook API Optimization

## How to Verify the Fix Works

### 1. Open Browser Developer Console
- Press **F12** (Windows/Linux) or **Cmd+Option+I** (Mac)
- Go to the **Console** tab

### 2. Navigate to Editor's Picks Page
- Clear console (trash icon)
- Go to the Editor's Picks page

### 3. What You Should See (First Load)

#### Expected Console Logs:
```
📡 Fetching betslip links from API for pick abc123...
⏳ Waiting for existing API request for basketball_nba... (preventing duplicate call)
⏳ Waiting for existing API request for basketball_nba... (preventing duplicate call)
💾 Cached odds for basketball_nba (15 events)
💾 Saved betslip links to database for pick abc123
```

**What this means:**
- ✅ Only ONE API call made (first pick)
- ✅ Other picks waited for the result (deduplication working)
- ✅ Results cached for 5 minutes
- ✅ Links saved to database for permanent storage

### 4. Refresh the Page

#### Expected Console Logs:
```
✅ Using stored betslip links for pick abc123
✅ Using stored betslip links for pick def456
✅ Using stored betslip links for pick ghi789
```

**What this means:**
- ✅ NO API calls made
- ✅ All picks loaded from database
- ✅ Instant display (no loading spinners)

### 5. Check API Usage

Visit https://the-odds-api.com/account/usage

**Before Fix:**
- Usage graph shows spikes of 50-100 calls per page load
- Credits depleting rapidly (5,000 in 12 hours)

**After Fix:**
- Steady, low usage (1-4 calls per page load, first time only)
- Flat line on subsequent loads (0 calls)
- Credits usage: <100 per day

## Red Flags (What NOT to See)

### ❌ Bad: Multiple API Calls for Same Sport
```
📡 Fetching odds from API for basketball_nba...
📡 Fetching odds from API for basketball_nba...  ← Duplicate!
📡 Fetching odds from API for basketball_nba...  ← Duplicate!
```
**If you see this:** Request deduplication is not working

### ❌ Bad: Infinite API Calls
```
📡 Fetching betslip links from API for pick abc123...
💾 Saved betslip links to database for pick abc123
📡 Fetching betslip links from API for pick abc123...  ← Again!
💾 Saved betslip links to database for pick abc123
📡 Fetching betslip links from API for pick abc123...  ← Again!
```
**If you see this:** Infinite loop is still happening

### ❌ Bad: API Calls on Every Refresh
```
// After first load, refresh page
📡 Fetching betslip links from API for pick abc123...  ← Should use DB!
```
**If you see this:** Database storage is not working

## Performance Metrics

### Expected Behavior:

| Action | API Calls | Source |
|--------|-----------|--------|
| First page load (5 picks) | 1-4 | API (one per sport) |
| Refresh page | 0 | Database |
| Navigate away & back (within 5 min) | 0 | Cache |
| Navigate away & back (after 5 min) | 0 | Database |
| New pick published | 1 | API (only for new pick) |

### API Call Timeline:

```
Day 1 (Initial Setup):
Hour 1: 10 calls (first loads, different sports)
Hour 2: 0 calls (all from database)
Hour 3: 0 calls (all from database)
...
Total: ~10 calls for entire day

Day 2+:
Total: ~5 calls per day (only new picks or cache refreshes)
```

## Manual Test Checklist

- [ ] Open Editor's Picks page
- [ ] Console shows only 1 API call per sport
- [ ] Console shows "Waiting for existing request" for duplicate picks
- [ ] Console shows "Saved betslip links to database"
- [ ] Refresh page
- [ ] Console shows "Using stored betslip links" (no API calls)
- [ ] Sportsbook buttons appear instantly (no loading)
- [ ] Click a sportsbook button - opens correct link
- [ ] Check API dashboard - usage is minimal (<100/day)

## Troubleshooting

### Issue: Still seeing high API usage

**Check:**
1. Are there multiple environments calling the API? (dev, staging, prod)
2. Are there other components calling `fetchOdds` directly?
3. Is the cache duration too short?

**Solution:**
- Review all `fetchOdds` calls in codebase
- Increase cache duration if needed (currently 5 minutes)

### Issue: Betslip links not saving to database

**Check:**
1. Has the migration been run?
2. Check database for `betslip_links` column

**Solution:**
```sql
-- Check if column exists
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'editors_picks' 
  AND column_name = 'betslip_links';

-- If not exists, run migration
ALTER TABLE editors_picks 
ADD COLUMN IF NOT EXISTS betslip_links JSONB DEFAULT NULL;
```

### Issue: "Waiting for existing request" appears but still multiple API calls

**Check:**
- Browser console for error messages
- Network tab for actual HTTP requests

**Solution:**
- Verify `activeRequests` Map is not being cleared prematurely
- Check for errors in `finally` block

## Success Criteria

✅ **API usage reduced by 95-99%**
✅ **First load: 1 call per sport (instead of 5+ per sport)**
✅ **Subsequent loads: 0 calls (instead of 5+ per sport)**
✅ **No infinite loops (constant API calls)**
✅ **Links persist across page refreshes**
✅ **User experience: Instant loading after first visit**

## Monitoring

### Daily Check (First Week):
- API usage graph at https://the-odds-api.com/account/usage
- Should see steady, low usage (~50-100 calls/day)

### Weekly Check (Ongoing):
- Monthly API credits usage
- Should stay well within plan limits

### Alert Thresholds:
- **Warning:** >500 calls/day (investigate patterns)
- **Critical:** >2,000 calls/day (revert or fix immediately)

---

**Current Status:** ✅ Fix implemented and tested
**Expected Impact:** 95-99% reduction in API calls
**Risk Level:** Low (backwards compatible, database-backed)

