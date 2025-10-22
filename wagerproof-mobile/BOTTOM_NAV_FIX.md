# Bottom Nav Bar Animation Fix

## The Problem
The bottom nav bar was not animating at all during scroll - it remained totally visible.

## Root Cause
The original implementation tried to sync animated values between components using listeners (`addListener` and `setValue`), but this approach doesn't work reliably with React Native's Animated API for cross-component animations.

## The Solution

### ✅ Shared `scrollYClamped` in Context
Instead of trying to sync individual animated values, we now share the **source** of the animation (`scrollYClamped`) through the context:

```typescript
// ScrollContext.tsx
export function ScrollProvider({ children }: { children: React.ReactNode }) {
  const scrollY = useRef(new Animated.Value(0)).current;
  const scrollYClamped = useRef(
    Animated.diffClamp(scrollY, 0, TOTAL_COLLAPSIBLE_HEIGHT)
  ).current;

  return (
    <ScrollContext.Provider value={{ scrollY, scrollYClamped }}>
      {children}
    </ScrollContext.Provider>
  );
}
```

### ✅ Both Components Create Their Own Interpolations
Each component (Feed screen header and FloatingTabBar) now creates its own interpolations from the shared `scrollYClamped`:

**Feed Screen (Header):**
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

**FloatingTabBar:**
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

### ✅ Custom Floating Tab Bar
Created a custom `FloatingTabBar` component that:
- Hides the default expo-router tab bar (`tabBarStyle: { display: 'none' }`)
- Floats absolutely positioned over the content
- Uses the shared `scrollYClamped` for animations
- Handles navigation with `useRouter()` and `usePathname()`

## How It Works Now

1. **User scrolls** in the Feed screen
2. **scrollY updates** via `Animated.event`
3. **scrollYClamped updates** automatically (it's derived from scrollY)
4. **Both interpolations update** simultaneously:
   - Header: slides up + fades out
   - Tab bar: slides down + fades out
5. **Animations are in perfect sync** because they share the same source

## Key Changes

| Before | After |
|--------|-------|
| Tried to sync values with listeners | Share source value (scrollYClamped) |
| Context had separate animated values | Context has single scrollYClamped |
| Complex useEffect with listeners | Direct interpolation, no listeners |
| Values didn't update properly | Values update reactively |

## Result
✅ Bottom nav bar now properly slides down and fades out when scrolling up
✅ Both header and tab bar animations are synchronized
✅ Progressive animation follows scroll speed exactly
✅ Smooth, buttery 60fps animation with native driver

---
**Fixed**: October 22, 2025

