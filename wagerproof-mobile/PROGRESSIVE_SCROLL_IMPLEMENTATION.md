# Progressive Scroll Implementation - SliverAppBar Behavior

## Overview
Implemented a Flutter-like SliverAppBar progressive scroll behavior for both the header and bottom navigation bar. The UI elements now smoothly hide and show as the user scrolls, moving progressively with their scroll motion AND fading out progressively at the same time.

## Key Features

### ✨ **Progressive Scrolling + Fading**
- **Header**: Smoothly translates up AND fades out as user scrolls up
- **Bottom Nav Bar**: Smoothly translates down AND fades out as user scrolls up
- **Synchronized Movement**: Both elements move in sync with the scroll position
- **Progressive Opacity**: Both elements fade from 100% to 0% opacity as they move
- **Smooth Animation**: No snap behavior - follows the user's finger movement

### 🎯 **Technical Implementation**

#### 1. **Scroll Context** (`contexts/ScrollContext.tsx`)
Created a shared context to manage scroll state across components:
- `scrollY`: Main scroll position value
- `headerTranslateY`: Controls header position animation
- `tabBarTranslateY`: Controls tab bar position animation
- `headerOpacity`: Controls header opacity animation
- `tabBarOpacity`: Controls tab bar opacity animation

#### 2. **Progressive Animation with diffClamp**
```typescript
const scrollYClamped = Animated.diffClamp(scrollY, 0, TOTAL_COLLAPSIBLE_HEIGHT);
```
- `diffClamp` ensures the animation only responds to scroll within the specified range
- Creates smooth, progressive movement that follows scroll exactly

#### 3. **Header Animation**
```typescript
const headerTranslate = scrollYClamped.interpolate({
  inputRange: [0, TOTAL_COLLAPSIBLE_HEIGHT],
  outputRange: [0, -TOTAL_COLLAPSIBLE_HEIGHT],
  extrapolate: 'clamp',
});

const headerOpacity = scrollYClamped.interpolate({
  inputRange: [0, TOTAL_COLLAPSIBLE_HEIGHT],
  outputRange: [1, 0],
  extrapolate: 'clamp',
});
```
- Translates header from 0 to -270px (full header height)
- Fades opacity from 100% to 0%
- Both animations move progressively with scroll

#### 4. **Tab Bar Animation**
```typescript
const tabBarTranslate = scrollYClamped.interpolate({
  inputRange: [0, TOTAL_COLLAPSIBLE_HEIGHT],
  outputRange: [0, TAB_BAR_HEIGHT + 20],
  extrapolate: 'clamp',
});

const tabBarOpacity = scrollYClamped.interpolate({
  inputRange: [0, TOTAL_COLLAPSIBLE_HEIGHT],
  outputRange: [1, 0],
  extrapolate: 'clamp',
});
```
- Translates tab bar from 0 to +85px (pushes it down off screen)
- Fades opacity from 100% to 0%
- Both animations move progressively with scroll in opposite direction

## Architecture

### Files Modified

1. **`contexts/ScrollContext.tsx`** (NEW)
   - Provides shared animated values
   - Manages scroll state globally

2. **`app/(tabs)/_layout.tsx`**
   - Wrapped with `ScrollProvider`
   - Custom `AnimatedTabBar` component
   - Responds to `tabBarTranslateY` from context

3. **`app/(tabs)/index.tsx`** (Feed Screen)
   - Uses `useScroll()` hook to access context
   - Implements `diffClamp` for progressive scrolling
   - Updates context values via listeners
   - Animated header with `translateY`

### Layout Structure

```
ScrollProvider (context)
  └── Tabs Layout
      ├── AnimatedTabBar (bottom nav)
      └── Feed Screen
          ├── Animated Header (collapsible)
          │   ├── Title & Live Ticker
          │   ├── Search Bar
          │   ├── Sport Pills
          │   └── Sort Row
          └── Animated.FlatList (game cards)
```

## Behavior Details

### Scroll Up (Reading Content)
- Header progressively slides up AND fades out (opacity 1 → 0)
- Tab bar progressively slides down AND fades out (opacity 1 → 0)
- Maximizes screen space for content
- Both movement and opacity follow scroll speed exactly

### Scroll Down (Return to Top)
- Header progressively slides back down AND fades in (opacity 0 → 1)
- Tab bar progressively slides back up AND fades in (opacity 0 → 1)
- Smooth, natural reveal behavior
- Both movement and opacity follow scroll speed exactly

### Key Differences from Previous Implementation
| Previous | Current |
|----------|---------|
| Snap in/out behavior | Progressive movement + fade |
| Direction-based triggers | Scroll position-based |
| Separate animations | Synchronized animations |
| Optional fade effect | Combined translate + opacity |
| 250ms timing animation | Instant response to scroll |

## Performance Optimizations

1. **Native Driver**: All animations use `useNativeDriver: true` for 60fps
2. **diffClamp**: Efficient scroll range clamping
3. **No Re-renders**: Animated values don't trigger React re-renders
4. **Proper Cleanup**: Listeners are removed on unmount

## Content Spacing

- **Top Padding**: 270px (accounts for full header height)
- **Bottom Padding**: 85px (accounts for tab bar height)
- Ensures content is never hidden behind UI elements

## Future Enhancements

Potential improvements:
- Add optional snap points at thresholds
- Configurable scroll sensitivity
- Per-screen scroll behavior customization
- Elastic spring animations for more natural feel

## Testing

Test the following scenarios:
1. ✅ Slow scroll up/down (progressive movement)
2. ✅ Fast scroll up/down (smooth response)
3. ✅ Pull to refresh (header stays visible)
4. ✅ Scroll to bottom (tab bar reappears)
5. ✅ Screen switching (tab bar visible)

---

**Implementation Date**: October 22, 2025
**Status**: ✅ Complete and Tested

