# Page Reload Issue - Diagnosis & Solution

## Problem
Users are reporting occasional unprompted page reloads on sports pages (NFL, NBA, NCAAB, College Football).

## Investigation Results

### ✅ What I Checked

1. **Direct Reload Calls**: Searched for all `window.location.reload()` calls
   - Found only in:
     - `ChatKitErrorBoundary` - Manual button click only (not automatic)
     - `SandboxModeToggle` - Admin feature, requires explicit toggle
     - `Index.tsx` - Manual button click only

2. **Error Boundaries**: Checked for error boundaries that might auto-reload
   - `ChatKitErrorBoundary` - Only reloads on manual button click
   - No global error boundary existed (now added)

3. **React Query Refetch**: Checked for refetch intervals
   - Found refetch intervals but these only refetch data, not reload pages
   - `refetchOnWindowFocus: false` is set globally (good)

4. **Auth State Changes**: Checked Supabase auth listeners
   - No reload logic in auth state change handlers

5. **Hydration Logic**: Checked `main.tsx` hydration
   - Uses `hydrateRoot` if pre-rendered content exists
   - Could cause hydration mismatches if HTML doesn't match React

### 🔍 Most Likely Causes

1. **Hydration Mismatches** (Most Likely)
   - If pre-rendered HTML doesn't match client-side React, React throws errors
   - Unhandled hydration errors could trigger browser reloads
   - Sports pages might have dynamic content that differs between SSR and client

2. **Unhandled Promise Rejections**
   - Failed API calls or async operations without proper error handling
   - Could trigger browser's default error handling (reload)

3. **React Query Errors**
   - Failed queries without error boundaries
   - Could cause React errors that propagate up

## Solution Implemented

### 1. Added Global Error Logging (`src/main.tsx`)

Added comprehensive error handlers to catch and log:
- Unhandled JavaScript errors
- Unhandled promise rejections  
- Page unload events (to detect when reloads happen)

**This will help identify:**
- What errors occur before reloads
- Stack traces showing where errors originate
- Timestamps to correlate with user reports

### 2. Added Global Error Boundary (`src/components/GlobalErrorBoundary.tsx`)

Created a React error boundary that:
- ✅ Catches React rendering errors
- ✅ Shows fallback UI instead of crashing
- ✅ **Does NOT automatically reload** (prevents unprompted reloads)
- ✅ Logs errors for debugging
- ✅ Only reloads if user explicitly clicks "Reload Page" button

### 3. Wrapped App with Error Boundary (`src/App.tsx`)

Wrapped the entire app with `GlobalErrorBoundary` to catch all React errors.

## Next Steps for Debugging

### 1. Monitor Browser Console

When users report reloads, check the browser console for:
```
[Global Error Handler] Unhandled error: ...
[Global Error Handler] Unhandled promise rejection: ...
[Page Reload] Page is about to unload/reload at: ...
[GlobalErrorBoundary] Error caught: ...
```

### 2. Check for Hydration Mismatches

Look for React warnings like:
```
Warning: Text content did not match. Server: "..." Client: "..."
Warning: Hydration failed because the initial UI does not match...
```

### 3. Common Patterns to Look For

- **Date/Time rendering**: If sports pages show game times, ensure they're consistent between SSR and client
- **Random values**: Any random IDs or values that differ between renders
- **localStorage/sessionStorage**: Accessing storage during SSR can cause mismatches
- **API data**: If cached data differs from fresh API data

## Files Modified

1. ✅ `src/main.tsx` - Added global error handlers and improved hydration error handling
2. ✅ `src/components/GlobalErrorBoundary.tsx` - New error boundary component
3. ✅ `src/App.tsx` - Wrapped app with error boundary

## Testing

### To Test Error Logging:

1. Open browser console
2. Navigate to a sports page
3. If a reload occurs, check console for error logs
4. Look for stack traces showing where errors originated

### To Test Error Boundary:

1. The error boundary will catch React errors
2. Instead of reloading, it shows a fallback UI
3. Users can manually reload if needed
4. Errors are logged to console for debugging

## Expected Outcome

- **Immediate**: Error logging will help identify what's causing reloads
- **Long-term**: Error boundary prevents automatic reloads and shows helpful error messages
- **Debugging**: Console logs will show exact errors and stack traces

## Additional Recommendations

1. **Check Sports Page Components**: Review NFL, NBA, NCAAB, CollegeFootball components for:
   - Date/time rendering that might differ between SSR/client
   - Random values or IDs
   - localStorage/sessionStorage access during render

2. **Review API Error Handling**: Ensure all API calls have proper error handling
   - Check `fetchValueFinds()` functions
   - Check data fetching in `useEffect` hooks
   - Ensure errors don't propagate unhandled

3. **Consider Removing Pre-rendering for Sports Pages**: 
   - Sports pages are dynamic and don't need SEO
   - Pre-rendering might be causing hydration mismatches
   - Consider only pre-rendering static pages (landing, blog, etc.)

## Notes

- The error boundary **intentionally does NOT auto-reload** to prevent the issue users are experiencing
- All errors are logged to help diagnose the root cause
- Users can manually reload if needed via the error UI

