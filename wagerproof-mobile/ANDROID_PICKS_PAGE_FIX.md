# Android Picks Page Crash Fix

## Issue
The picks page was crashing when opened on Android builds.

## Root Causes Identified

### 1. **Invalid Gradient Colors**
The `LinearGradient` component in `EditorPickCard` was receiving invalid hex color values, which causes crashes on Android. This happened when:
- Team colors were missing or undefined
- Hex color parsing failed
- Invalid color format was passed to the gradient

### 2. **Missing Error Boundaries**
There was no error boundary to catch and gracefully handle rendering errors, causing the entire app to crash instead of just showing an error message for the problematic pick.

### 3. **Image Loading Issues**
Team logos loaded from remote URLs could fail without proper error handling.

## Fixes Applied

### 1. Enhanced Gradient Color Validation (`components/EditorPickCard.tsx`)

**Before:**
```typescript
const hexToRgba = (hex: string, a: number) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
};
```

**After:**
```typescript
const hexToRgba = (hex: string, a: number) => {
  // Validate hex color format
  if (!hex || typeof hex !== 'string' || !hex.startsWith('#')) {
    return `rgba(128, 128, 128, ${a})`; // Fallback gray
  }
  
  try {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    
    // Check if parsing was successful
    if (isNaN(r) || isNaN(g) || isNaN(b)) {
      return `rgba(128, 128, 128, ${a})`; // Fallback gray
    }
    
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  } catch (error) {
    return `rgba(128, 128, 128, ${a})`; // Fallback gray
  }
};
```

Added try-catch around the entire `getGradientColors()` function to ensure it always returns valid gradient colors.

### 2. Added Error Boundary Component (`components/PickCardErrorBoundary.tsx`)

Created a new error boundary component specifically for EditorPickCard:
- Catches rendering errors in individual pick cards
- Displays a friendly error message instead of crashing
- Logs error details in development mode
- Prevents one bad pick from breaking the entire page

### 3. Enhanced Team Color Safety (`app/(drawer)/(tabs)/picks.tsx`)

Added validation in `renderPickCard`:
```typescript
const safeGameData = {
  ...gameData,
  away_team_colors: gameData.away_team_colors || { primary: '#6B7280', secondary: '#9CA3AF' },
  home_team_colors: gameData.home_team_colors || { primary: '#6B7280', secondary: '#9CA3AF' },
};
```

Wrapped EditorPickCard in error boundary:
```typescript
<PickCardErrorBoundary pickId={item.id}>
  <EditorPickCard pick={item} gameData={safeGameData} />
</PickCardErrorBoundary>
```

### 4. Improved Image URI Validation (`components/EditorPickCard.tsx`)

**Issue:** Android's `RCTImageView` crashes when receiving invalid image sources (empty strings, null, or invalid URLs).

**Fix:** Added validation function to check image URIs before rendering:
```typescript
// Validate image URI - Android requires valid non-empty URLs
const isValidImageUri = (uri: string | null | undefined): boolean => {
  if (!uri || typeof uri !== 'string') return false;
  const trimmed = uri.trim();
  if (trimmed === '') return false;
  // Basic URL validation - must start with http:// or https://
  return trimmed.startsWith('http://') || trimmed.startsWith('https://');
};

// Only render Image component if URI is valid
{isValidImageUri(gameData.away_logo) ? (
  <Image 
    source={{ uri: gameData.away_logo! }} 
    style={styles.teamLogo} 
    resizeMode="contain"
    onError={(e) => {
      if (__DEV__) {
        console.log('Failed to load away team logo:', gameData.away_logo, e.nativeEvent.error);
      }
    }}
  />
) : (
  // Show initials fallback
)}
```

This prevents the "error while loading a property source of a view managed by RCTImageView" error on Android.

### 5. AndroidBlurView Error Handling (`components/AndroidBlurView.tsx`)

Added try-catch in the `getFallbackColor()` function to prevent crashes if theme context fails.

## Testing Recommendations

1. **Test with various pick types:**
   - Picks with missing team data
   - Picks with archived game data
   - Picks for all sports (NFL, CFB, NBA, NCAAB)

2. **Test edge cases:**
   - Empty picks list
   - Picks with no logos
   - Picks with invalid color data

3. **Test on different Android versions:**
   - Android 9+
   - Different device manufacturers (Samsung, Google Pixel, etc.)

4. **Monitor console logs:**
   - Look for "Failed to load" messages for logos
   - Check for gradient color calculation errors

## Prevention for Future

1. **Always validate hex colors** before using them in gradients
2. **Use error boundaries** for complex components that render user data
3. **Add fallbacks** for all external resources (logos, colors, etc.)
4. **Test on Android** after making changes to visual components
5. **Log errors** in development mode to catch issues early

## Files Modified

- `wagerproof-mobile/components/EditorPickCard.tsx` - Enhanced gradient color validation
- `wagerproof-mobile/app/(drawer)/(tabs)/picks.tsx` - Added error boundary and safe game data
- `wagerproof-mobile/components/AndroidBlurView.tsx` - Added error handling
- `wagerproof-mobile/components/PickCardErrorBoundary.tsx` - New error boundary component

## Related Issues

This fix also addresses potential issues on iOS, though iOS is more forgiving with invalid color values than Android.

