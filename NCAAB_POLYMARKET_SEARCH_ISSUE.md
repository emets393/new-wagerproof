# NCAAB Polymarket Search Issue

## Problem
The Pittsburgh @ West Virginia game is visible on Polymarket's website but not found via the `/events` API endpoint.

## What We Tested

1. **Tag ID 100149** (primary NCAAB tag): 0 events
2. **Tag ID 100639** (secondary tag): 100 events, but 0 NCAAB-related
3. **All events** (no tag filter): 500 events, 0 matches
4. **Markets endpoint**: 200 markets, 0 matches
5. **Team name variations**: Tried "Pitt", "Pittsburgh", "Panthers", "WVU", "West Virginia", "Mountaineers" - no matches

## Current Implementation

### How CFB/NCAAB Works (Same as NFL)
1. Get tag ID from `/sports` endpoint
2. Fetch events with `GET /events?tag_id={tagId}`
3. Match team names using `findMatchingEvent()`
4. Extract markets from matched event

### Team Name Matching
- For CFB/NCAAB: Uses `CFB_TEAM_MAPPINGS` which is mostly pass-through
- "Pittsburgh" → "Pittsburgh" (no transformation)
- "West Virginia" → "West Virginia" (no transformation)
- Matching uses fuzzy string matching on event titles

## Possible Reasons

1. **Different API**: Polymarket's website might use:
   - GraphQL endpoint (not REST)
   - Internal API not exposed publicly
   - Different endpoint for live games

2. **Different Tag Structure**: Live games might use:
   - Different tag IDs
   - Tags not exposed via `/sports` endpoint
   - Event-level tags vs market-level tags

3. **Market vs Event**: The game might be listed as:
   - Markets only (not under events)
   - Under a different event structure
   - Using a different naming convention

4. **Status Filtering**: Live games might:
   - Have different `closed`/`active` status
   - Require different query parameters
   - Be in a separate endpoint

## Next Steps to Debug

1. **Check Polymarket Website Directly**:
   - Open browser DevTools on Polymarket's site
   - Find the network request that loads the Pittsburgh/West Virginia game
   - Check what endpoint/API it uses
   - Check what parameters/tags it sends

2. **Try Markets Endpoint with Search**:
   - Use `/markets` endpoint with search parameters
   - Try `_search` parameter (deprecated but might work)
   - Check if markets have different tag structure

3. **Check for Live Games Endpoint**:
   - Look for `/live` or `/active` endpoints
   - Check if there's a different endpoint for in-progress games

4. **Verify Tag IDs**:
   - Check if the game has tags we're not checking
   - Verify tag IDs from `/sports` are correct
   - Check if live games use different tags

## Recommendation

Since the game is visible on Polymarket's website but not in the API:
1. **Check browser DevTools** to see what API call Polymarket's site makes
2. **Compare with CFB** - if CFB games work, see what's different
3. **Consider using markets endpoint** instead of events endpoint
4. **Check if there's a GraphQL endpoint** that Polymarket uses internally

## Current Status

- ✅ API flow is working correctly
- ✅ Tag IDs are retrieved successfully  
- ✅ Matching logic is ready
- ❌ Live NCAAB games not found in `/events` endpoint
- ⚠️  Need to investigate Polymarket's website API calls

