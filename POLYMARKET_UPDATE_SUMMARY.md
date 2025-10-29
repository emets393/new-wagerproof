# Polymarket Integration Update Summary

## What Changed

I've updated the Polymarket integration to use the proper API flow you discovered from BuildShip:

### Previous Approach (Broken)
- Used `_search` parameter on `/markets` endpoint
- Returned irrelevant markets (Fed rate hikes, etc.)
- Poor team name matching

### New Approach (Working)
1. **Call `/sports`** → Get NFL metadata (tag_id: 450)
2. **Call `/events?tag_id=450`** → Get all current NFL games with structured data
3. **Match teams** → Use properly parsed event titles ("Ravens vs. Dolphins")
4. **Extract tokens** → Get `yesTokenId` and `noTokenId` from event markets
5. **Call `/prices-history`** → Get time series data for the token

## Files Modified

### 1. `/supabase/functions/polymarket-proxy/index.ts`
**Added two new actions:**
- `action: 'sports'` - Fetches sports metadata from `https://gamma-api.polymarket.com/sports`
- `action: 'events'` - Fetches NFL events from `https://gamma-api.polymarket.com/events?tag_id=450`

### 2. `/src/services/polymarketService.ts`
**Added new functions:**
- `getSportsMetadata()` - Gets all sports and their tag IDs
- `getNFLTagId()` - Extracts the NFL tag ID (450)
- `getNFLEvents()` - Gets all current NFL events
- `findMatchingEvent()` - Matches our games to Polymarket events
- `extractTokensFromEvent()` - Gets the yesTokenId/noTokenId for price history
- `parseTeamsFromTitle()` - Parses "Ravens vs. Dolphins" format

**Updated main function:**
- `getMarketTimeSeriesData()` - Now uses the new `/sports` → `/events` → `/prices-history` flow

## How to Deploy

Since you don't have Supabase CLI, deploy via the Dashboard:

### Step 1: Open Supabase Dashboard
1. Go to https://supabase.com/dashboard
2. Select your project
3. Navigate to **Edge Functions** in the left sidebar

### Step 2: Update the polymarket-proxy Function
1. Find the `polymarket-proxy` function
2. Click **Edit** or **Update**
3. Copy the entire contents of `/supabase/functions/polymarket-proxy/index.ts`
4. Paste into the editor
5. Click **Deploy** or **Save**

### Step 3: Test
Once deployed, test the Polymarket widget:
1. Visit your production site: https://www.wagerproof.bet
2. Navigate to the NFL page
3. Open browser console (F12)
4. You should see logs like:
   ```
   🔍 Fetching Polymarket data for: Baltimore (Ravens) vs Miami (Dolphins)
   📊 Got 14 NFL events, searching for match...
   ✅ Found event: Ravens vs. Dolphins
   🎯 Tokens extracted: {...}
   📈 Got 523 price points
   ✅ Success! Current odds: Ravens 63% - Dolphins 37%
   ```

## Expected Results

Based on your example data, you should see:
- **Ravens vs. Dolphins** - ✅ Match found
- **Bears vs. Bengals** - ✅ Match found  
- **Vikings vs. Lions** - ✅ Match found
- **Panthers vs. Packers** - ✅ Match found
- **Broncos vs. Texans** - ✅ Match found
- **Chiefs vs. Bills** - ✅ Match found
- **Cardinals vs. Cowboys** - ✅ Match found
- And all other current NFL games

## API Endpoints Used

```typescript
// 1. Get sports metadata
GET https://gamma-api.polymarket.com/sports
Response: [{ sport: "nfl", tags: "1,450,100639", series: "10187", ordering: "away" }, ...]

// 2. Get NFL events
GET https://gamma-api.polymarket.com/events?tag_id=450&closed=false&limit=100
Response: [{ 
  title: "Ravens vs. Dolphins",
  markets: [{
    question: "Ravens vs. Dolphins",
    tokens: [
      { outcome: "Yes", token_id: "19107411353903294968863666132831741761932499489076109955229662722336998211898" },
      { outcome: "No", token_id: "27887481627533078210436105816339582329208302668772658985491126599747137465542" }
    ]
  }]
}, ...]

// 3. Get price history for token
GET https://clob.polymarket.com/prices-history?market=<TOKEN_ID>&interval=max&fidelity=60
Response: { 
  history: [
    { t: 1730000000, p: 0.63 },  // 63% probability at this timestamp
    { t: 1730003600, p: 0.64 },  // 64% probability 1 hour later
    ...
  ]
}
```

## Troubleshooting

If widgets still show "Data Unavailable":

1. **Check Edge Function logs:**
   - Supabase Dashboard → Edge Functions → polymarket-proxy → Logs
   - Look for errors or 404s

2. **Check browser console:**
   - Should see: "📊 Got X NFL events"
   - If you see "❌ No NFL events available", the Edge Function isn't deployed correctly

3. **Verify the function code:**
   - Make sure you copied the ENTIRE contents of `index.ts`
   - Check that both `'sports'` and `'events'` actions are present

4. **Test the proxy directly:**
   - Use the test page at `/polymarket-test` (if you still have it)
   - Or add a test button that calls `getNFLEvents()` directly

## What This Fixes

✅ No more "Fed rate hike" or irrelevant markets  
✅ Proper team name matching using Polymarket's event structure  
✅ Reliable token ID extraction  
✅ All current NFL games should be found  
✅ CORS issues resolved via Edge Function proxy  

## Next Steps

After successful deployment:
1. Monitor the widgets on NFL page
2. Check if all games show Polymarket data
3. Verify the price charts display correctly
4. Test during live games to see real-time updates

