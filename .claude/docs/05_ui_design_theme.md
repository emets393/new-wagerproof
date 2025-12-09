# UI, Design & Theming

> Last verified: December 2024

## Overview

WagerProof uses different UI frameworks for web and mobile, with a shared design language around "honeydew" green as the primary brand color.

---

## Technology Stack

| Feature | Web | Mobile |
|---------|-----|--------|
| **UI Framework** | shadcn/ui + Radix | React Native Paper (MD3) |
| **Styling** | Tailwind CSS 3.4.11 | StyleSheet (CSS-in-JS) |
| **Animation** | Framer Motion (`motion`) | Reanimated 4.1 + Moti |
| **Charts** | Recharts | Victory Native |
| **Theme Modes** | Light/Dark | Light/Dark/System |
| **Storage** | localStorage | AsyncStorage |

---

## Brand Colors

### Primary: Honeydew Green (VERIFIED)
```css
--primary: 142 76% 36%;  /* HSL - Green, NOT purple */
```

### Honeydew Scale (Tailwind)
```typescript
honeydew: {
  50: '#f0fdf4',
  100: '#dcfce7',
  200: '#bbf7d0',
  300: '#86efac',
  400: '#4ade80',
  500: '#22c55e',  // Primary
  600: '#16a34a',
  700: '#15803d',
  800: '#166534',
  900: '#14532d',
}
```

---

## Web Theming

### Theme Context (`src/contexts/ThemeContext.tsx`)
```typescript
type Theme = "light" | "dark";  // NO system mode

const toggleTheme = () => {
  const newTheme = theme === "light" ? "dark" : "light";
  setTheme(newTheme);
  localStorage.setItem("theme", newTheme);
};
```

### View Transitions (Circular Animation)
```typescript
// animated-theme-toggler.tsx
const transition = document.startViewTransition(() => {
  toggleTheme();
});
// Circular clip-path animation from click position
```

### Animation Components
- `Aurora` (`magicui/aurora.tsx`) - WebGL light beams
- `ShineBorder` (`magicui/shine-border.tsx`) - Rotating gradient border

---

## Mobile Theming

### Theme Context (`wagerproof-mobile/contexts/ThemeContext.tsx`)
```typescript
type ThemeMode = 'light' | 'dark' | 'system';

// Uses React Native useColorScheme for system detection
const systemColorScheme = useColorScheme();

// AsyncStorage persistence
await AsyncStorage.setItem(THEME_STORAGE_KEY, mode);
```

### Theme Constants (`constants/theme.ts`)
```typescript
export const darkTheme = {
  colors: {
    primary: honeydew[500],      // #22c55e
    background: '#111827',
    surface: '#1f2937',
  }
};

export const getBettingColors = (isDark: boolean) => ({
  awayMoneyline: isDark ? '#60A5FA' : '#2563EB',
  homeMoneyline: isDark ? '#4ADE80' : '#16A34A',
  spread: isDark ? '#FBBF24' : '#D97706',
  total: isDark ? '#A78BFA' : '#7C3AED',
});
```

---

## NFL Game Card Effects (Web)

### Light Beams (Hover Only)
```typescript
// NFLGameCard.tsx
{isHovered && (
  <Aurora colors={['#6db8e0', '#93c5fd', '#6db8e0']} />
)}
```

### ShineBorder (Always Visible)
```typescript
<ShineBorder
  borderRadius={12}
  borderWidth={1}
  duration={18}
  color={["#93c5fd", "#c4b5fd", "#93c5fd"]}
>
```

---

## Key Files

### Web
- `src/contexts/ThemeContext.tsx`
- `src/components/magicui/aurora.tsx`
- `src/components/magicui/shine-border.tsx`
- `tailwind.config.ts`

### Mobile
- `wagerproof-mobile/contexts/ThemeContext.tsx`
- `wagerproof-mobile/constants/theme.ts`

---

## Platform Differences

| Feature | Web | Mobile |
|---------|-----|--------|
| System theme | Not implemented | Full support |
| WebGL effects | Aurora, ShineBorder | Not available |
| Gradients | CSS | expo-linear-gradient |
| Blur effects | CSS backdrop-filter | AndroidBlurView component |
| Haptic feedback | N/A | Extensive use |
