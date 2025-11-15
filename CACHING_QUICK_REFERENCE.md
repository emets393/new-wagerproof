# Caching System Quick Reference

## ✅ Implementation Checklist

### Sports Pages (NFL, NBA, NCAAB, College Football)
- [x] Created `useSportsPageCache.ts` hook
- [x] Integrated into NFL.tsx
- [x] Integrated into NBA.tsx
- [x] Integrated into NCAAB.tsx
- [x] Integrated into CollegeFootball.tsx
- [x] Debounced cache writes (500ms)
- [x] Optimized scroll position tracking
- [x] Removed excessive logging
- [x] Added passive event listeners

### Today in Sports
- [x] Created `useTodayInSportsCache.ts` hook
- [x] Integrated into TodayInSports.tsx
- [x] Leverages React Query caching
- [x] Only caches UI state

### Global Optimizations
- [x] Optimized React Query configuration in App.tsx
- [x] Set 5-minute staleTime
- [x] Set 10-minute gcTime
- [x] Disabled refetchOnWindowFocus
- [x] Limited retries to 1

### Testing & Validation
- [x] No linting errors
- [x] Build passes successfully
- [x] No type errors

## 🎯 How to Use

### For Sports Pages (NFL, NBA, NCAAB, CFB)
```typescript
// Import the hook
import { useSportsPageCache } from '@/hooks/useSportsPageCache';

// Initialize (pass the sport type)
const { getCachedData, setCachedData, clearCache, restoreScrollPosition } = 
  useSportsPageCache<YourPredictionType>('nfl' | 'nba' | 'ncaab' | 'college-football');

// On mount: Check cache
useEffect(() => {
  const cached = getCachedData();
  if (cached && cached.predictions.length > 0) {
    // Restore data and UI state
    setPredictions(cached.predictions);
    setSearchQuery(cached.searchQuery);
    // ... restore other state
    
    // Restore scroll position
    if (cached.scrollPosition > 0) {
      restoreScrollPosition(cached.scrollPosition);
    }
  } else {
    // No cache, fetch fresh data
    fetchData();
  }
}, []);

// After fetching data: Save to cache
const fetchData = async () => {
  // ... fetch logic
  setCachedData({
    predictions: data,
    teamMappings: mappings,
    lastUpdated: Date.now(),
    searchQuery,
    sortKey,
    sortAscending,
    activeFilters,
  });
};

// On UI changes: Update cache (debounced)
useEffect(() => {
  if (predictions.length === 0) return;
  
  const timeoutId = setTimeout(() => {
    const cached = getCachedData();
    if (cached) {
      setCachedData({
        ...cached,
        searchQuery,
        sortKey,
        sortAscending,
        activeFilters,
      });
    }
  }, 500);
  
  return () => clearTimeout(timeoutId);
}, [searchQuery, sortKey, sortAscending, activeFilters, predictions.length]);

// On refresh button: Clear cache
<Button onClick={() => { clearCache(); fetchData(); }}>
  Refresh
</Button>
```

### For Today in Sports
```typescript
// Import the hook
import { useTodayInSportsCache } from '@/hooks/useTodayInSportsCache';

// Initialize
const { getCachedUIState, setCachedUIState, restoreScrollPosition } = useTodayInSportsCache();

// Initialize state from cache
const cachedState = getCachedUIState();
const [showAllValueAlerts, setShowAllValueAlerts] = useState(
  cachedState?.showAllValueAlerts ?? false
);
// ... other state

// Restore scroll position on mount
useEffect(() => {
  if (cachedState && cachedState.scrollPosition > 0) {
    restoreScrollPosition(cachedState.scrollPosition);
  }
}, []);

// Save UI state when it changes (debounced)
useEffect(() => {
  const timeoutId = setTimeout(() => {
    setCachedUIState({
      showAllValueAlerts,
      showAllFadeAlerts,
      todayGamesFilter,
      // ... other UI state
    });
  }, 500);
  
  return () => clearTimeout(timeoutId);
}, [showAllValueAlerts, showAllFadeAlerts, todayGamesFilter, /* ... */]);
```

## 🔧 Cache Management

### Clear Individual Cache
```typescript
// From within the component
const { clearCache } = useSportsPageCache('nfl');
clearCache(); // Clears NFL cache only
```

### Clear All Caches (Browser Console)
```javascript
// Clear all sports page caches
sessionStorage.removeItem('wagerproof_nfl_cache');
sessionStorage.removeItem('wagerproof_nba_cache');
sessionStorage.removeItem('wagerproof_ncaab_cache');
sessionStorage.removeItem('wagerproof_college-football_cache');
sessionStorage.removeItem('wagerproof_today_in_sports_ui_state');

// Or clear all sessionStorage
sessionStorage.clear();
```

### Inspect Cache (Browser Console)
```javascript
// View specific cache
JSON.parse(sessionStorage.getItem('wagerproof_nfl_cache'));

// View all Wagerproof caches
Object.keys(sessionStorage)
  .filter(key => key.startsWith('wagerproof_'))
  .forEach(key => {
    const data = JSON.parse(sessionStorage.getItem(key));
    console.log(key, {
      size: JSON.stringify(data).length,
      age: Date.now() - data.timestamp,
      items: data.predictions?.length || 'N/A'
    });
  });
```

## 🐛 Debugging

### Common Issues

#### Cache Not Working
1. Check if sessionStorage is available: `typeof sessionStorage !== 'undefined'`
2. Check if quota is exceeded: Try clearing other site data
3. Check browser console for errors

#### Data is Stale
1. Check timestamp: `JSON.parse(sessionStorage.getItem('wagerproof_nfl_cache')).timestamp`
2. Verify TTL (5 minutes = 300,000 ms)
3. Manually clear cache and re-fetch

#### Scroll Position Not Restoring
1. Check if scroll position was saved: `cached.scrollPosition`
2. Ensure DOM is fully rendered before restoring
3. Try increasing the requestAnimationFrame delay

### Debug Mode
```typescript
// Temporarily enable verbose logging in useSportsPageCache.ts
// Change this:
const getCachedData = useCallback((): CachedData<T> | null => {
  try {
    const cached = sessionStorage.getItem(cacheKey);
    if (!cached) return null;
    // ...
  }
});

// To this:
const getCachedData = useCallback((): CachedData<T> | null => {
  try {
    const cached = sessionStorage.getItem(cacheKey);
    console.log('[Cache Debug]', sportType, 'raw cache:', cached);
    if (!cached) return null;
    // ...
  }
});
```

## 📊 Performance Monitoring

### Metrics to Track
```typescript
// Add to component
const [cacheHits, setCacheHits] = useState(0);
const [cacheMisses, setCacheMisses] = useState(0);

useEffect(() => {
  const cached = getCachedData();
  if (cached) {
    setCacheHits(prev => prev + 1);
    console.log('Cache hit!');
  } else {
    setCacheMisses(prev => prev + 1);
    console.log('Cache miss!');
  }
}, []);

// Display in admin panel
<div>Cache Hits: {cacheHits} | Misses: {cacheMisses}</div>
```

## 🚀 Best Practices

### DO ✅
- Cache frequently accessed data
- Use debouncing for UI state updates
- Clear cache on manual refresh
- Keep cache TTL reasonable (5-10 minutes)
- Use sessionStorage for temporary data
- Gracefully handle cache failures

### DON'T ❌
- Cache real-time data (live scores)
- Cache sensitive user data
- Set TTL too high (> 15 minutes)
- Write to cache on every state change
- Block rendering waiting for cache
- Store large files in cache

## 📝 Adding Cache to New Pages

1. **Import the hook**
   ```typescript
   import { useSportsPageCache } from '@/hooks/useSportsPageCache';
   ```

2. **Add sport type** to `SportType` union in `useSportsPageCache.ts`
   ```typescript
   export type SportType = 'nfl' | 'nba' | 'ncaab' | 'college-football' | 'your-new-sport';
   ```

3. **Initialize in component**
   ```typescript
   const { getCachedData, setCachedData, clearCache, restoreScrollPosition } = 
     useSportsPageCache<YourPredictionType>('your-new-sport');
   ```

4. **Follow the usage pattern** from existing sports pages

## 🔗 Related Files
- `src/hooks/useSportsPageCache.ts` - Main cache hook for sports pages
- `src/hooks/useTodayInSportsCache.ts` - UI state cache for Today in Sports
- `src/App.tsx` - React Query configuration
- `CACHING_OPTIMIZATION_SUMMARY.md` - Detailed documentation

