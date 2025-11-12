# NFL Lean Alert Feature Implementation

## Overview
Added a visual "LEAN ALERT" feature to NFL game cards that highlights model predictions with 80% or higher confidence using a glowing animated border effect.

## Implementation Details

### Changes Made

#### File: `src/pages/NFL.tsx`

**Imports Added:**
- `Zap` icon from `lucide-react` for the alert indicator
- `MovingBorderButton` component from `@/components/ui/moving-border` for the glowing border effect

**Feature Logic:**
For each model prediction pill (Spread, Moneyline, Over/Under):
1. Calculate the confidence percentage
2. Check if `confidencePct >= 80`
3. If true, wrap the pill with:
   - `MovingBorderButton` component with animated glowing border
   - "LEAN ALERT" text with Zap icon below the pill
4. If false, display the pill normally

### Visual Design

#### Glowing Border Colors
- **Spread Pills**: Green gradient (`#22c55e`)
- **Moneyline Pills**: Blue gradient (`#3b82f6`)
- **Over/Under Pills**: Purple gradient (`#a855f7`)

#### LEAN ALERT Indicator
- **Text**: "LEAN ALERT" in uppercase, bold, small font (10px)
- **Icon**: Zap icon (filled) matching the pill color
- **Position**: Centered below the pill with 1.5 gap
- **Colors**: Match the pill type (green for spread, blue for ML, purple for O/U)

### Component Structure

```tsx
<div className="flex flex-col items-center gap-1.5">
  <MovingBorderButton
    borderRadius="1.5rem"
    containerClassName="h-auto w-auto"
    className="bg-transparent p-0 border-0"
    borderClassName="bg-[radial-gradient(COLOR_40%,transparent_60%)]"
    duration={2000}
    as="div"
  >
    {pillContent}
  </MovingBorderButton>
  <div className="flex items-center gap-1 text-[10px] font-bold ...">
    <Zap className="h-3 w-3 fill-COLOR" />
    <span>LEAN ALERT</span>
  </div>
</div>
```

## User Experience

### When Triggered
- Only appears on NFL game cards
- Only for model predictions with 80%+ confidence
- Can appear on multiple pills per game if multiple predictions meet the threshold

### Visual Effect
- Animated glowing border continuously moves around the pill
- Creates a "premium pick" visual indicator
- Matches the "Try It Now" button style from the landing page
- Consistent with the design language established for high-value CTAs

## Technical Notes

### Border Animation
- Uses the same `MovingBorderButton` component as the landing page CTA
- Animation duration: 2000ms (2 seconds per cycle)
- Radial gradient creates a soft, glowing effect
- Border moves along the pill's perimeter continuously

### Performance
- Only renders for high-confidence predictions (relatively rare)
- Animation is GPU-accelerated via CSS/SVG
- No impact on page load or interaction performance

### Responsive Design
- Works on all screen sizes
- Gap spacing adjusts with the flex layout
- Text remains readable on mobile devices

## Testing Checklist

- [ ] Verify glowing border appears on pills with 80%+ confidence
- [ ] Check that border doesn't appear on pills below 80%
- [ ] Test on desktop and mobile viewports
- [ ] Verify dark mode colors are visible
- [ ] Ensure animation performance is smooth
- [ ] Check that LEAN ALERT text is properly aligned
- [ ] Verify Zap icon displays correctly
- [ ] Test with multiple high-confidence predictions on same game
- [ ] Confirm no layout shifts or overlapping elements

## Future Enhancements

Possible improvements for future iterations:
1. Add a pulse animation to the LEAN ALERT text
2. Include a tooltip explaining what LEAN ALERT means
3. Add analytics tracking for LEAN ALERT views/clicks
4. Consider adding a filter to show only games with LEAN ALERTS
5. Add user preferences to customize the threshold (e.g., 75%, 80%, 85%)

## Related Components

- `/src/components/ui/moving-border.tsx` - Glowing border animation component
- `/src/components/landing/Hero.tsx` - Original "Try It Now" button reference
- `/src/pages/NFL.tsx` - Main NFL predictions page with pills

## Color Reference

### Spread (Green)
- Border: `#22c55e` (green-500)
- Text: `text-green-600 dark:text-green-400`
- Icon fill: `fill-green-600 dark:fill-green-400`

### Moneyline (Blue)
- Border: `#3b82f6` (blue-500)
- Text: `text-blue-600 dark:text-blue-400`
- Icon fill: `fill-blue-600 dark:fill-blue-400`

### Over/Under (Purple)
- Border: `#a855f7` (purple-500)
- Text: `text-purple-600 dark:text-purple-400`
- Icon fill: `fill-purple-600 dark:fill-purple-400`

