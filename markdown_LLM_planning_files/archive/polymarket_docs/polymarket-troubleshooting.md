# Polymarket Troubleshooting Guide

> **Common issues and solutions for Polymarket integration**

## Table of Contents

1. [Widget Not Displaying](#widget-not-displaying)
2. [No Data Showing](#no-data-showing)
3. [CORS Errors](#cors-errors)
4. [Widget Not Clickable](#widget-not-clickable)
5. [Wrong Data Displayed](#wrong-data-displayed)
6. [Performance Issues](#performance-issues)
7. [TypeScript Errors](#typescript-errors)
8. [Deployment Issues](#deployment-issues)

---

## Widget Not Displaying

### Symptom

Widget area is blank, nothing renders at all

### Possible Causes & Solutions

#### 1. React Query Provider Missing

**Error in console**:
```
No QueryClient set, use QueryClientProvider to set one
```

**Solution**:
```tsx
// src/App.tsx or main.tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      {/* Your app */}
    </QueryClientProvider>
  );
}
```

---

#### 2. Missing Dependencies

**Error in console**:
```
Module not found: Can't resolve 'recharts'
```

**Solution**:
```bash
npm install recharts date-fns @tanstack/react-query
```

---

#### 3. Import Path Wrong

**Error in console**:
```
Module not found: Can't resolve '@/components/PolymarketWidget'
```

**Solution**:
Check your TypeScript config has path aliases:
```json
// tsconfig.json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

Or use relative import:
```tsx
import PolymarketWidget from '../components/PolymarketWidget';
```

---

#### 4. Component Crashed on Render

**Check console for error stack trace**

Common causes:
- Missing props
- Undefined data access
- CSS conflicts

**Debug**:
```tsx
// Wrap in error boundary
<ErrorBoundary fallback={<div>Widget Error</div>}>
  <PolymarketWidget ... />
</ErrorBoundary>
```

---

## No Data Showing

### Symptom

Widget renders but shows "Polymarket betting data unavailable for this game"

### Diagnosis Steps

**1. Check Console Logs**

Look for these log sequences:

```typescript
// ✅ Good sequence
🔍 Fetching markets for: Baltimore vs Miami (nfl)
✅ NFL tag ID: 450
📊 Got 14 events
✅ Found: Baltimore Ravens vs. Miami Dolphins
📊 Found moneyline market: Ravens vs Dolphins
✅ moneyline: 58% - 42%
```

```typescript
// ❌ Bad sequence - no events
🔍 Fetching markets for: Baltimore vs Miami (nfl)
✅ NFL tag ID: 450
📊 Got 0 events
❌ No matching event found
```

```typescript
// ❌ Bad sequence - events but no match
🔍 Fetching markets for: Ohio State vs Michigan (cfb)
✅ CFB tag ID: 100351
📊 Got 50 events
❌ No matching event found
📋 Available events: ["Alabama vs Auburn", "Georgia vs Florida", ...]
```

---

### Possible Causes & Solutions

#### 1. Team Name Mismatch

**Problem**: Your app has "Ohio St" but Polymarket has "Ohio State"

**Solution**: Add mapping
```typescript
const CFB_TEAM_MAPPINGS: Record<string, string> = {
  'Ohio St': 'Ohio State',
  'Ohio State': 'Ohio State',
  'OSU': 'Ohio State',
  // Add all variations
};
```

**Debug**:
```typescript
console.log('Searching for:', awayTeam, homeTeam);
console.log('Mapped to:', getTeamMascot(awayTeam, league), getTeamMascot(homeTeam, league));
```

---

#### 2. Game Not on Polymarket

**Problem**: Not all games have markets on Polymarket

**Signs**:
- Console shows available events, none match
- Game is too far in future (not listed yet)
- Game is past (market settled and removed)
- Low-profile game (e.g., FCS vs FCS in CFB)

**Solution**: Handle gracefully
```tsx
{data === null && (
  <div className="text-sm text-muted-foreground text-center py-4">
    No betting markets available for this game yet
  </div>
)}
```

---

#### 3. Wrong League Parameter

**Problem**: Calling widget with wrong league

**Error Pattern**:
```
✅ CFB tag ID: 100351
📊 Got 0 events  // ← Wrong sport tag used
```

**Solution**: Verify league prop
```tsx
<PolymarketWidget
  league="cfb"  // ← Must match actual sport
  awayTeam={prediction.away_team}
  homeTeam={prediction.home_team}
/>
```

---

#### 4. Edge Function Not Deployed

**Error in console**:
```
Error invoking function: FunctionsHttpError: 404
```

**Solution**:
```bash
# Deploy the function
supabase functions deploy polymarket-proxy

# Verify it's deployed
supabase functions list

# Test it
curl -X POST https://your-project.supabase.co/functions/v1/polymarket-proxy \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -d '{"action":"sports"}'
```

---

#### 5. Invalid Sport Identifier

**Problem**: Using `'ncaaf'` instead of `'cfb'`

**Error**:
```
❌ NCAAF sport not found in Polymarket
```

**Solution**: Use correct identifier
```typescript
// ❌ Wrong
const sportName = 'ncaaf';

// ✅ Correct
const sportName = 'cfb';
```

**Reference**: See [API Reference - Available Sports](./polymarket-api-reference.md#available-sports)

---

## CORS Errors

### Symptom

Network tab shows failed requests with CORS error

```
Access to fetch at 'https://gamma-api.polymarket.com/events' from origin 
'https://www.wagerproof.bet' has been blocked by CORS policy
```

### Solution

**Use Edge Function Proxy**

Polymarket blocks direct browser requests. All calls must go through server-side proxy.

**Check your service is using the proxy**:

```typescript
// ❌ Wrong - direct call
const response = await fetch('https://gamma-api.polymarket.com/events?tag_id=450');

// ✅ Correct - via Edge Function
const { data, error } = await supabase.functions.invoke('polymarket-proxy', {
  body: { action: 'events', tagId: '450' }
});
```

**Verify Edge Function is running**:
```bash
# Check deployment
supabase functions list

# Check logs
supabase functions logs polymarket-proxy --tail
```

---

### Still Getting CORS?

**Check these**:

1. **Supabase client configured?**
```typescript
// Should have valid URL and key
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);
```

2. **Edge Function has CORS headers?**
```typescript
// polymarket-proxy/index.ts
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Include in all responses
return new Response(JSON.stringify(data), {
  headers: { ...corsHeaders, 'Content-Type': 'application/json' }
});
```

3. **Environment variables set?**
```bash
# Check .env.local
echo $VITE_SUPABASE_URL
echo $VITE_SUPABASE_ANON_KEY
```

---

## Widget Not Clickable

### Symptom

Clicking widget buttons doesn't work, or triggers parent card actions

### Diagnosis

**Test clickability**:
1. Open widget in browser
2. Click time range buttons (1H, 6H, etc.)
3. Click market type buttons (ML, Spread, O/U)
4. Observe:
   - Do buttons change state?
   - Does parent card react (hover/click animation)?
   - Check console for any errors

---

### Solutions

#### 1. Event Handlers Missing

**Add multi-layer event stopping**:

```tsx
// Wrapper div
<div 
  onClick={(e) => e.stopPropagation()}
  onPointerDown={(e) => e.stopPropagation()}
  onMouseDown={(e) => e.stopPropagation()}
  onTouchStart={(e) => e.stopPropagation()}
  className="pointer-events-auto relative z-[100]"
  style={{ isolation: 'isolate' }}
>
  <PolymarketWidget ... />
</div>

// Button handlers
<Button
  onClick={(e) => {
    e.stopPropagation();
    e.preventDefault();
    e.nativeEvent.stopImmediatePropagation();
    handleClick();
  }}
  onPointerDown={(e) => {
    e.stopPropagation();
    e.nativeEvent.stopImmediatePropagation();
  }}
  className="pointer-events-auto"
  style={{ pointerEvents: 'auto' }}
  type="button"
>
  Click Me
</Button>
```

---

#### 2. Parent Card Intercepting Clicks

**Problem**: Parent card has click handler that captures all events

**Solution**: Add isolation in parent component
```tsx
// In NFL.tsx or CollegeFootball.tsx
<div 
  className="pt-4"
  onPointerDown={(e) => e.stopPropagation()}
  onMouseDown={(e) => e.stopPropagation()}
  onTouchStart={(e) => e.stopPropagation()}
  onClick={(e) => e.stopPropagation()}
  style={{ pointerEvents: 'auto', isolation: 'isolate' }}
>
  <PolymarketWidget ... />
</div>
```

---

#### 3. CSS pointer-events Conflict

**Problem**: Parent has `pointer-events: none` blocking all clicks

**Solution**: Explicitly enable on widget
```tsx
<div 
  className="pointer-events-auto"
  style={{ pointerEvents: 'auto' }}
>
  <PolymarketWidget ... />
</div>
```

---

#### 4. Framer Motion Intercepting

**Problem**: Parent card uses Framer Motion `whileHover` or `whileTap`

**Solution**: Widget must have higher z-index and isolation
```tsx
<motion.div whileHover={{ scale: 1.02 }}>
  <Card>
    {/* Other content */}
    
    <div 
      className="relative z-[100]"
      style={{ isolation: 'isolate' }}
      onClick={(e) => e.stopPropagation()}
    >
      <PolymarketWidget ... />
    </div>
  </Card>
</motion.div>
```

---

## Wrong Data Displayed

### Symptom

Widget shows data but it's for wrong teams or wrong market type

### Diagnosis

**Check which token ID is being used**:
```typescript
console.log('Token ID:', marketData.yesTokenId);
console.log('Question:', marketData.question);
```

---

### Possible Causes

#### 1. Away/Home Swap

**Problem**: Chart shows inverse of reality (away team at 30% when should be 70%)

**Cause**: `isAwayTeamYes` parameter wrong in `transformPriceHistory()`

**Solution**: Verify Polymarket's "ordering"
```typescript
// Check event.ordering field
// If "away", YES token = away team
// If "home", YES token = home team

const isAwayTeamYes = event.ordering === 'away';
const chartData = transformPriceHistory(priceHistory, isAwayTeamYes);
```

---

#### 2. Wrong Market Extracted

**Problem**: Showing 1H moneyline instead of full game

**Cause**: Market classification logic included first-half markets

**Solution**: Filter out "1h" markets
```typescript
function classifyMarket(question: string, slug: string) {
  // Skip first half markets
  if (question.toLowerCase().includes('1h') || slug.includes('-1h-')) {
    return null;
  }
  // ... rest of logic
}
```

---

#### 3. Token IDs Swapped

**Problem**: YES and NO tokens backwards

**Cause**: Extraction logic got tokens in wrong order

**Solution**: Verify token order
```typescript
const yesToken = market.tokens.find(t => t.outcome.toLowerCase() === 'yes');
const noToken = market.tokens.find(t => t.outcome.toLowerCase() === 'no');

console.log('YES token:', yesToken?.token_id);
console.log('NO token:', noToken?.token_id);
```

---

## Performance Issues

### Symptom

Widget loads slowly or causes page lag

### Diagnosis

**Check Network tab**:
- How many API calls?
- How long does each take?
- Any failed/retrying requests?

**Check React DevTools**:
- How many re-renders?
- Is query refetching unnecessarily?

---

### Solutions

#### 1. Too Many API Calls

**Problem**: Fetching on every render

**Solution**: Use React Query properly
```typescript
const { data } = useQuery({
  queryKey: ['polymarket-all', league, awayTeam, homeTeam],
  queryFn: () => getAllMarketsData(awayTeam, homeTeam, league),
  staleTime: 5 * 60 * 1000,      // Don't refetch for 5 minutes
  cacheTime: 10 * 60 * 1000,     // Keep in cache for 10 minutes
  refetchOnWindowFocus: false,   // Don't refetch on tab focus
  retry: 1,                      // Only retry once on failure
});
```

---

#### 2. Large Price History

**Problem**: Fetching 10,000 data points crashes chart

**Solution**: Use fidelity parameter
```typescript
// Instead of all points
getPriceHistory(tokenId, 'max', 1)  // 1 minute intervals

// Use hourly for max
getPriceHistory(tokenId, 'max', 60)  // 60 minute intervals
```

---

#### 3. Blocking Main Thread

**Problem**: Chart rendering blocks UI

**Solution**: Use React.memo
```typescript
const PolymarketWidget = React.memo(({ awayTeam, homeTeam, league }) => {
  // Component code
}, (prevProps, nextProps) => {
  // Only re-render if these changed
  return prevProps.awayTeam === nextProps.awayTeam &&
         prevProps.homeTeam === nextProps.homeTeam &&
         prevProps.league === nextProps.league;
});
```

---

#### 4. No Caching

**Problem**: Fetching same data repeatedly

**Solution**: Implement database caching

See [POLYMARKET_CACHE_SETUP.md](../POLYMARKET_CACHE_SETUP.md) for full guide.

Quick version:
1. Cache data in Supabase table
2. Cron job updates hourly
3. Widget reads from cache first
4. Falls back to live API if cache miss

---

## TypeScript Errors

### Error: Property 'league' does not exist

```typescript
Type '{ awayTeam: string; homeTeam: string; }' is not assignable to type 'PolymarketWidgetProps'.
Property 'league' is missing
```

**Solution**: Add league prop or make it optional
```typescript
interface PolymarketWidgetProps {
  awayTeam: string;
  homeTeam: string;
  league?: 'nfl' | 'cfb' | 'nba';  // Optional
  // ... other props
}

// Or provide default
league = 'nfl'
```

---

### Error: Type 'string' is not assignable to type 'nfl' | 'cfb'

**Solution**: Type the variable correctly
```typescript
// ❌ Wrong
const myLeague = 'nfl';  // Type: string

// ✅ Correct
const myLeague: 'nfl' | 'cfb' = 'nfl';  // Type: 'nfl' | 'cfb'

// Or use as const
const myLeague = 'nfl' as const;
```

---

### Error: Cannot find module '@/types/polymarket'

**Solution**: Check tsconfig paths
```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  }
}
```

---

## Deployment Issues

### Issue: Works locally but not in production

**Checklist**:

1. **Environment variables set in production?**
   - Vercel: Project Settings → Environment Variables
   - Netlify: Site Settings → Environment Variables
   - Check both `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`

2. **Edge Function deployed to production?**
```bash
# Deploy to production
supabase functions deploy polymarket-proxy

# Not just local development
supabase functions serve polymarket-proxy
```

3. **Build errors ignored?**
   - Check build logs for TypeScript errors
   - Verify all dependencies installed
   - Run `npm run build` locally first

4. **CORS still an issue?**
   - Production domain must be allowed
   - Check Edge Function CORS headers include `'*'` or specific domain

---

### Issue: Edge Function timing out

**Error**: Function execution timed out after 30 seconds

**Solutions**:

1. **Reduce data fetched**:
```typescript
// Use shorter fidelity
getPriceHistory(tokenId, '1d', 60)  // Last day only

// Not entire history
getPriceHistory(tokenId, 'max', 60)
```

2. **Implement caching** (see POLYMARKET_CACHE_SETUP.md)

3. **Increase timeout** (if possible):
```typescript
// supabase/functions/polymarket-proxy/index.ts
serve(async (req) => {
  // ... handler
}, {
  timeoutMs: 60000  // 60 seconds
});
```

---

## Getting Help

### Before Asking for Help

**Gather this information**:

1. **Console logs** - Full output from widget load attempt
2. **Network tab** - Screenshot of failed requests
3. **Code snippet** - How you're calling the widget
4. **Environment** - Local dev? Production? Which browser?
5. **What you've tried** - List troubleshooting steps taken

### Debug Checklist

```bash
# 1. Check Edge Function
supabase functions list
supabase functions logs polymarket-proxy

# 2. Test API manually
curl https://gamma-api.polymarket.com/sports

# 3. Check environment
echo $VITE_SUPABASE_URL
echo $VITE_SUPABASE_ANON_KEY

# 4. Verify deps
npm list recharts @tanstack/react-query

# 5. Check build
npm run build
```

### Still Stuck?

**Review these docs**:
1. [API Reference](./polymarket-api-reference.md) - Verify endpoints
2. [Implementation Steps](./polymarket-implementation-steps.md) - Check setup
3. [Code Patterns](./polymarket-code-patterns.md) - Review patterns

**Common fixes that solve 90% of issues**:
1. Use Edge Function (not direct API calls)
2. Add team name mappings
3. Use correct sport identifier (`'cfb'` not `'ncaaf'`)
4. Add event stopping for clickability
5. Check console logs for team matching

---

## Prevention

### Best Practices to Avoid Issues

1. **Always use Edge Function** - Never call Polymarket APIs directly
2. **Log everything** - Use debug.log() liberally during development
3. **Test with real data** - Don't assume team names match
4. **Handle null gracefully** - Not all games have markets
5. **Check availability first** - Verify sport exists on Polymarket
6. **Version control Edge Function** - Track changes to proxy
7. **Monitor errors** - Set up error tracking (Sentry, etc.)
8. **Cache aggressively** - Reduce API load and improve speed

---

## Quick Fixes

| Problem | Quick Fix |
|---------|-----------|
| CORS error | Use Edge Function proxy |
| No data | Check team name mappings |
| Not clickable | Add event handlers |
| Slow loading | Reduce fidelity, add caching |
| Wrong teams | Verify away/home in logs |
| TypeScript error | Check league type union |
| Build fails | Run locally first, check deps |
| Widget blank | Check React Query provider |

---

**Last Updated**: January 2025  
**Version**: 1.0  
**Status**: Active

