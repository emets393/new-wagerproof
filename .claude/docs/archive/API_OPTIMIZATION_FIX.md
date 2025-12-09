# API Usage Optimization Fix - Explained for Junior Data Analyst

## The Problem We Solved

Your API burned through 5,000 credits in 12 hours. Here's why and how we fixed it.

---

## Problem 1: The Infinite Loop 🔄

### What Was Happening

Imagine you have 5 published editor picks on the page. Each one has a `SportsbookButtons` component.

```
Pick 1 Component Loads
  ↓
No links in database → Calls API
  ↓
API returns data → Saves to database
  ↓
Calls onLinksUpdated() → Tells parent "I updated the database!"
  ↓
Parent component re-renders (fetchPicks runs)
  ↓
Parent creates NEW function reference for onUpdate prop
  ↓
SportsbookButtons sees "new" onLinksUpdated in dependencies
  ↓
useEffect triggers AGAIN
  ↓
Loops back to step 1 → Calls API AGAIN → Infinite loop! 💸
```

### Why This Happened

In React, when you pass a function as a prop:
```typescript
<SportsbookButtons onLinksUpdated={fetchPicks} />
```

Every time the parent re-renders, `fetchPicks` gets a new memory reference (even though it does the same thing). The `useEffect` dependency array sees this as a "change" and runs again.

### The Fix

**Before:**
```typescript
useEffect(() => {
  // ... fetch and save logic
  onLinksUpdated?.(); // ❌ Triggers parent re-render
}, [pickId, gameType, awayTeam, homeTeam, selectedBetType, existingLinks, onLinksUpdated]);
//                                                                          ^^^^^^^^^^^^^^^^
//                                                                          This causes infinite loop!
```

**After:**
```typescript
const hasSavedLinks = useRef(false);
const hasAttemptedFetch = useRef(false);

useEffect(() => {
  // Prevent duplicate fetches
  if (hasAttemptedFetch.current) {
    return; // ✅ Already tried fetching, don't do it again
  }
  hasAttemptedFetch.current = true;
  
  // ... fetch and save logic
  // ✅ Do NOT call onLinksUpdated() - it causes infinite loop
  
}, [pickId, gameType, awayTeam, homeTeam, selectedBetType, existingLinks]);
//                                                          ❌ REMOVED onLinksUpdated from deps
```

**Key Changes:**
1. **Removed `onLinksUpdated` from dependencies** - No more infinite loop trigger
2. **Added `hasAttemptedFetch` ref** - Prevents component from fetching twice
3. **Added `hasSavedLinks` ref** - Prevents duplicate database saves
4. **Removed the `onLinksUpdated()` call** - Links will be available on next page load

---

## Problem 2: Race Conditions 🏃‍♂️

### What Was Happening

When 5 NBA picks load at the same time:

```
Component 1: "I need NBA odds!" → API Call (Credit -1)
Component 2: "I need NBA odds!" → API Call (Credit -1)  ← Same data!
Component 3: "I need NBA odds!" → API Call (Credit -1)  ← Same data!
Component 4: "I need NBA odds!" → API Call (Credit -1)  ← Same data!
Component 5: "I need NBA odds!" → API Call (Credit -1)  ← Same data!

Result: 5 API calls for THE SAME DATA! 💸💸💸
```

The cache couldn't help because all 5 components started fetching **at the same time**, before any could finish and populate the cache.

### The Fix: Request Deduplication Lock

Think of it like a "ticket system" at a deli:

```typescript
// In theOddsApi.ts
const activeRequests = new Map<string, Promise<OddsApiResponse>>();

export async function fetchOdds(sportKey: string) {
  // Check cache first (layer 1 protection)
  const cached = getCachedOdds(sportKey);
  if (cached) return cached;
  
  // Check if someone else is ALREADY fetching (layer 2 protection)
  const existingRequest = activeRequests.get(sportKey);
  if (existingRequest) {
    console.log('⏳ Waiting for existing request...');
    return existingRequest; // ✅ Share the result!
  }
  
  // Create new request and store it
  const requestPromise = (async () => {
    try {
      const response = await fetch(...);
      const data = await response.json();
      setCachedOdds(sportKey, data); // Save to cache
      return data;
    } finally {
      activeRequests.delete(sportKey); // Clean up when done
    }
  })();
  
  activeRequests.set(sportKey, requestPromise); // Store for others to use
  return requestPromise;
}
```

### Now With The Fix:

```
Component 1: "I need NBA odds!" → API Call (Credit -1) → Stores promise in activeRequests
Component 2: "I need NBA odds!" → Sees active request → Waits for Component 1's result ✅
Component 3: "I need NBA odds!" → Sees active request → Waits for Component 1's result ✅
Component 4: "I need NBA odds!" → Sees active request → Waits for Component 1's result ✅
Component 5: "I need NBA odds!" → Sees active request → Waits for Component 1's result ✅

Result: 1 API call, 5 components get the same data! 🎉
```

---

## The Three-Layer Defense System

We now have **3 layers of protection** against duplicate API calls:

### Layer 1: Cache (5-minute storage)
```typescript
// Check cache first
const cached = getCachedOdds(sportKey);
if (cached) return cached; // ✅ 0 API calls
```

### Layer 2: Request Deduplication (active requests)
```typescript
// Check if already fetching
const existingRequest = activeRequests.get(sportKey);
if (existingRequest) return existingRequest; // ✅ Share the in-flight request
```

### Layer 3: Database Storage (permanent)
```typescript
// Check database first (in component)
if (existingLinks && Object.keys(existingLinks).length > 0) {
  return; // ✅ Use stored links, no API call
}
```

---

## Expected Results

### Before Fix:
```
5 picks load → Each calls API independently
5 picks × multiple re-renders × no deduplication = 💸💸💸
Estimated: 50-100 API calls per page load
```

### After Fix:
```
5 NBA picks load
  → Component 1: API call (1 credit)
  → Components 2-5: Wait for Component 1's result (0 credits)
  → Saves links to database
  → Next page load: Uses database (0 credits)

Estimated: 1 API call per sport per page load (first time only)
            0 API calls on subsequent loads
```

### API Usage Reduction:
- **First load**: 1 call per sport (instead of 5+ per sport)
- **Subsequent loads**: 0 calls (uses database)
- **Reduction**: ~95-99% fewer API calls 🎉

---

## Testing Checklist

To verify the fix works:

1. **Open browser console** (F12)
2. **Navigate to Editor's Picks page**
3. **Look for these logs:**
   - `📡 Fetching betslip links from API for pick XXX` - Should see ONCE per sport
   - `⏳ Waiting for existing API request...` - Means deduplication is working
   - `💾 Saved betslip links to database` - Means links are being stored
   - `✅ Using stored betslip links` - Means database retrieval works

4. **Refresh the page** - Should see:
   - `✅ Using stored betslip links` for all picks (no API calls!)

5. **Check API usage** at https://the-odds-api.com
   - Should see dramatic reduction in calls per hour

---

## Summary for Management

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| API Calls (First Load) | 50-100 | 4-5 | ~95% reduction |
| API Calls (Subsequent) | 50-100 | 0 | 100% reduction |
| Credits per Day | 5,000 | 50-100 | ~98% reduction |
| Monthly Cost Impact | High | Minimal | Sustainable |

---

## Technical Implementation Summary

### Files Modified:
1. `src/components/SportsbookButtons.tsx`
   - Added `useRef` flags to prevent duplicate fetches/saves
   - Removed `onLinksUpdated` from `useEffect` dependencies
   - Removed callback that triggered infinite loop

2. `src/services/theOddsApi.ts`
   - Added `activeRequests` Map for request deduplication
   - Wrapped fetch in promise that stores itself for other components
   - Added cleanup in `finally` block

### Key Concepts:
- **useRef**: Stores values that persist across re-renders but don't trigger re-renders
- **Dependency Array**: Controls when useEffect runs (removed problematic dependency)
- **Promise Deduplication**: Multiple consumers wait for single API call result
- **Three-Layer Defense**: Cache → Deduplication → Database

---

## Future Monitoring

Monitor these metrics:
1. **API usage dashboard** - Should stabilize at <100 calls/day
2. **Browser console** - Should see mostly cache/database hits
3. **User experience** - Should see instant load times (no loading spinners after first load)

If you see API usage spike again, check for:
- New components calling `fetchOdds` without using cache
- `useEffect` dependency arrays with function references
- Missing early returns in effects

