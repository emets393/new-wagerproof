# Animated Gradient Backgrounds for Onboarding

## Overview

The onboarding flow now features beautiful Instagram-style animated gradient backgrounds using **React Native Skia** and **Reanimated**. Each step has its own unique color scheme that smoothly transitions and animates.

## Features

✨ **Smooth Animations**: 60fps performance using Skia's hardware acceleration
🎨 **Dynamic Colors**: Each onboarding step uses a different color scheme
🌊 **Fluid Motion**: Three gradient "blobs" that move and morph continuously
💫 **Color Transitions**: Smooth color interpolation between gradient states
🔍 **Blur Effect**: Instagram-style blur for a modern, polished look

## How It Works

### Three Animated Blobs

The effect uses three overlapping radial gradients that:
1. **Move independently** with different speeds and paths
2. **Cycle through colors** from the step's color scheme
3. **Blend together** using a blur filter
4. **Transition smoothly** when you move between steps

### Color Schemes

Five predefined color schemes are available:

#### 1. **Primary** (Green-focused)
- Green → Blue → Purple
- Used for: Welcome, Goal selection, Testimonials, Final step

#### 2. **Energetic** (Vibrant)
- Green → Amber → Pink
- Used for: Sports selection, Features, Value proposition, Early access

#### 3. **Cool** (Blue/Purple tones)
- Cyan → Blue → Purple
- Used for: Age confirmation, Competitor comparison, Methodology

#### 4. **Warm** (Red/Orange tones)
- Amber → Red → Pink
- Used for: Email opt-in, Acquisition source

#### 5. **Calm** (Soothing)
- Indigo → Purple → Cyan
- Used for: Bettor type, Methodology, Data transparency

## Configuration

### Customizing Step Gradients

Edit `/components/onboarding/onboardingGradients.ts`:

```typescript
export const stepGradients = {
  1: gradientColorSchemes.primary,
  2: gradientColorSchemes.energetic,
  // ... customize for each step
};
```

### Creating New Color Schemes

In `/components/onboarding/AnimatedGradientBackground.tsx`:

```typescript
export const gradientColorSchemes = {
  myCustomScheme: {
    colors: [
      ['#color1', '#color2', '#color3'], // State 1
      ['#color4', '#color5', '#color6'], // State 2
      ['#color7', '#color8', '#color9'], // State 3
    ],
  },
};
```

Each color array represents:
- `[0]`: Center color (most prominent)
- `[1]`: Middle color
- `[2]`: Outer color (fades out)

### Adjusting Animation Speed

In `/app/(onboarding)/index.tsx`:

```typescript
<AnimatedGradientBackground 
  colorScheme={currentGradient}
  duration={8000} // Change this (milliseconds)
/>
```

- **Faster**: `duration={4000}` (4 seconds)
- **Slower**: `duration={12000}` (12 seconds)
- **Default**: `8000` (8 seconds)

### Adjusting Overlay Darkness

In `/app/(onboarding)/index.tsx`, modify the `darkOverlay` style:

```typescript
darkOverlay: {
  ...StyleSheet.absoluteFillObject,
  backgroundColor: 'rgba(0, 0, 0, 0.4)', // Change opacity (0.0 - 1.0)
},
```

- **Lighter**: `0.2` - More gradient visible, less text contrast
- **Darker**: `0.6` - Less gradient visible, better text readability
- **Default**: `0.4` - Balanced

### Adjusting Blur Intensity

In `/components/onboarding/AnimatedGradientBackground.tsx`:

```typescript
<Blur blur={80} /> // Change this value
```

- **Less blur**: `40-60` - Sharper gradient edges
- **More blur**: `100-120` - More diffused, softer
- **Default**: `80` - Instagram-like effect

## Performance Tips

1. **Hardware Acceleration**: Skia uses native hardware acceleration for smooth 60fps
2. **Native Driver**: All animations use `useNativeDriver: true`
3. **Optimized Rendering**: Only re-renders when colors change between steps
4. **Efficient Blur**: Blur is applied once to the entire group, not per-blob

## Dependencies

```json
{
  "@shopify/react-native-skia": "latest",
  "react-native-reanimated": "~4.1.1"
}
```

## Troubleshooting

### Gradients not appearing?
1. Clear cache: `npm run reset-cache`
2. Rebuild: `npx expo run:ios` or `npx expo run:android`

### Animations choppy?
- Make sure Reanimated babel plugin is in `babel.config.js`
- It must be the **last** plugin in the array

### Colors not transitioning?
- Check that `useDerivedValue` is properly updating
- Ensure color strings are valid hex codes

## Example: Adding a New Step

1. **Add color scheme** (if new scheme needed):
```typescript
// In AnimatedGradientBackground.tsx
sunset: {
  colors: [
    ['#ff6b6b', '#ee5a6f', '#c44569'],
    ['#f7b731', '#f79f1f', '#ee5a6f'],
    ['#5f27cd', '#341f97', '#2e1e6c'],
  ],
}
```

2. **Map to step**:
```typescript
// In onboardingGradients.ts
17: gradientColorSchemes.sunset,
```

3. **Done!** The step automatically uses the new gradient

## Advanced: Cross-Step Transitions

For smooth gradient transitions **between steps**, you could:
1. Animate the entire gradient color scheme change
2. Use a crossfade between two canvases
3. Implement color interpolation between step schemes

This would require modifying the `AnimatedGradientBackground` component to accept a `previousColorScheme` prop and animate between them.

## Credits

Inspired by Instagram's onboarding animations and modern mobile design patterns.

