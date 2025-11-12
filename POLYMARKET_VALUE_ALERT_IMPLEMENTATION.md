# Polymarket Value Alert Implementation

## Overview
Implemented a visual "Value Alert!" system for the Polymarket widget that detects value opportunities:
- **Spread/Over-Under**: When >57% on either side, indicating Vegas hasn't adjusted the line properly (value exists on both sides)
- **Moneyline**: When ≥85% on one team, indicating very high consensus and confidence

## Implementation Details

### Location
`src/components/PolymarketWidget.tsx`

### Features Implemented

#### 1. Value Detection Logic
- Automatically detects when Polymarket odds exceed 57% on either side of:
  - **Spread Market**: Away team or Home team spread
  - **Total Market (O/U)**: Over or Under
- Tracks all value opportunities across all available markets
- Calculates which specific teams/sides have value for contextual tooltips

#### 2. Visual Indicators

##### Value Alert Badge
- Displays a prominent "Value Alert!" badge in the widget header
- Styling:
  - Gradient background (honeydew-500 to honeydew-600)
  - Pulsing animation for attention
  - White text with bold font
  - Only appears when value is detected
- **Interactive Tooltip**: Hover to see which markets have value and why

##### Market Button Highlighting
- **NEW**: Spread and O/U buttons glow when they contain value opportunities
- Features:
  - Pulsing border animation (2-second cycle)
  - Gradient background with honeydew accent
  - Bold text styling
  - Only highlights when NOT currently selected
  - Directs users to check specific markets with value

##### Odds Container Glow Effect
- Applied to the specific odds container(s) showing value
- Similar to the "Try it Now!" button glow from the landing page
- Features:
  - Animated box shadow that pulses (2-second cycle)
  - Honeydew green color (rgb(115, 182, 158))
  - Enhanced border (2px width, honeydew color)
  - Smooth transitions
  - Cursor changes to help cursor on hover
- **Interactive Tooltip**: Hover to see detailed explanation of the value

#### 3. Interactive Tooltips
Three types of tooltips provide context:

##### a) Value Alert Badge Tooltip
- Appears on hover of the "Value Alert!" badge
- Shows which markets have value (Spread, O/U, or both)
- Explains the 57% threshold significance

##### b) Odds Container Tooltip
- Only appears when container has value and user hovers
- Shows:
  - Exact percentage from Polymarket
  - Team/side name
  - Market type (Spread or Over/Under)
  - Explanation of price mismatch

##### c) Market Button Visual Cues
- Buttons for Spread and O/U pulse when they have value
- No tooltip needed - visual pulse directs user to click

#### 4. Real-time Updates
- Value alerts update dynamically as:
  - User switches between markets (ML/Spread/O/U)
  - Polymarket data refreshes
  - Odds change over time
- Tooltips update with accurate real-time data

### Technical Implementation

#### CSS Animations

##### Odds Container Glow
```css
@keyframes value-glow {
  0%, 100% {
    box-shadow: 0 0 10px rgba(115, 182, 158, 0.4), 
                0 0 20px rgba(115, 182, 158, 0.3), 
                0 0 30px rgba(115, 182, 158, 0.2);
  }
  50% {
    box-shadow: 0 0 20px rgba(115, 182, 158, 0.6), 
                0 0 30px rgba(115, 182, 158, 0.5), 
                0 0 40px rgba(115, 182, 158, 0.4);
  }
}
```

##### Button Pulse
```css
@keyframes button-pulse {
  0%, 100% {
    box-shadow: 0 0 0 0 rgba(115, 182, 158, 0.7);
  }
  50% {
    box-shadow: 0 0 0 4px rgba(115, 182, 158, 0);
  }
}

.button-value-highlight {
  animation: button-pulse 2s ease-in-out infinite;
  background: linear-gradient(135deg, rgba(115, 182, 158, 0.2) 0%, rgba(115, 182, 158, 0.1) 100%);
  border-color: rgb(115, 182, 158);
  font-weight: 600;
}
```

#### Value Detection Function
```typescript
const checkValueAlert = () => {
  const alerts: { market: MarketType; side: 'away' | 'home'; percentage: number; team: string }[] = [];
  
  // Check Spread
  if (allMarketsData.spread) {
    if (allMarketsData.spread.currentAwayOdds > 57) {
      alerts.push({ 
        market: 'spread', 
        side: 'away', 
        percentage: allMarketsData.spread.currentAwayOdds,
        team: awayTeam
      });
    }
    if (allMarketsData.spread.currentHomeOdds > 57) {
      alerts.push({ 
        market: 'spread', 
        side: 'home', 
        percentage: allMarketsData.spread.currentHomeOdds,
        team: homeTeam
      });
    }
  }
  
  // Check Total (O/U)
  if (allMarketsData.total) {
    if (allMarketsData.total.currentAwayOdds > 57) { // Over
      alerts.push({ 
        market: 'total', 
        side: 'away', 
        percentage: allMarketsData.total.currentAwayOdds,
        team: 'Over'
      });
    }
    if (allMarketsData.total.currentHomeOdds > 57) { // Under
      alerts.push({ 
        market: 'total', 
        side: 'home', 
        percentage: allMarketsData.total.currentHomeOdds,
        team: 'Under'
      });
    }
  }
  
  return alerts;
};

// Check which markets have value
const hasSpreadValue = valueAlerts.some(alert => alert.market === 'spread');
const hasTotalValue = valueAlerts.some(alert => alert.market === 'total');

// Get tooltip content
const getValueTooltip = (side: 'away' | 'home') => {
  const alert = valueAlerts.find(a => a.market === selectedMarket && a.side === side);
  if (!alert) return '';
  
  const marketName = selectedMarket === 'spread' ? 'Spread' : 'Over/Under';
  return `Value Alert: ${alert.team} shows ${alert.percentage}% on Polymarket ${marketName}. 
          This indicates a price mismatch with Vegas lines and potential betting value.`;
};
```

### User Experience

#### When Value is Present:
1. User opens a game card with Polymarket data
2. If any Spread or O/U market shows >57% odds:
   - **"Value Alert!" badge** appears in the header (pulsing animation)
   - **Market buttons** for Spread and/or O/U show pulsing highlights
   - User immediately knows which markets to investigate
3. User interactions:
   - **Hover over badge**: Tooltip explains which markets have value
   - **Click highlighted button**: Switches to market with value
   - **View glowing odds**: Specific team/side container glows
   - **Hover over glowing container**: Tooltip shows detailed value explanation

#### Example Scenarios:

**Scenario 1: Spread Value Discovery**
- Game: Team A vs Team B
- Polymarket Spread: Team A 62% / Team B 38%
- **User Flow:**
  1. Sees "Value Alert!" badge with pulse animation
  2. Notices "Spread" button is highlighted and pulsing
  3. Hovers over badge: "Value opportunities detected in Spread!"
  4. Clicks "Spread" button
  5. Team A's odds container glows with honeydew border
  6. Hovers over glowing container: "Value Alert: Team A shows 62% on Polymarket Spread. This indicates a price mismatch with Vegas lines..."

**Scenario 2: Over/Under Value Discovery**
- Game: Team C vs Team D
- Polymarket O/U: Over 59% / Under 41%
- **User Flow:**
  1. Sees "Value Alert!" badge
  2. "O/U" button is pulsing with green accent
  3. Clicks "O/U" button
  4. "Over" container glows
  5. Hovers for details: Shows exact 59% and explanation

**Scenario 3: Multiple Value Opportunities**
- Game: Team E vs Team F
- Polymarket Spread: Team E 58% / Team F 42%
- Polymarket O/U: Over 60% / Under 40%
- **User Flow:**
  1. "Value Alert!" badge displayed
  2. **BOTH** "Spread" and "O/U" buttons pulsing
  3. Hover badge: "Value opportunities detected in Spread and Over/Under!"
  4. Clicks "Spread": Team E container glows
  5. Clicks "O/U": Over container glows
  6. User can explore both value opportunities with tooltips explaining each

### Color Scheme
- Uses the brand's honeydew green color (#73b69e)
- Maintains consistency with the "Try it Now!" button aesthetic
- Works well in both light and dark modes

### Performance Considerations
- CSS animations are hardware-accelerated
- Styles injected once into document head (not per-component instance)
- Value calculations only run when data changes
- Minimal performance impact

## Benefits

1. **Immediate Attention**: Multi-layered visual system ensures users never miss value
   - Badge alert in header
   - Button highlighting directs to specific markets
   - Odds container glow shows exact value location

2. **Clear Navigation**: Progressive disclosure guides users
   - Badge tells them value exists
   - Buttons show which markets to check
   - Glowing containers reveal specific bets

3. **Educational**: Comprehensive tooltip system teaches users
   - Badge explains the 57% threshold
   - Container tooltips show exact percentages
   - Contextual information about price mismatches

4. **Professional**: Polished, branded visual effects
   - Matches "Try it Now!" button aesthetic
   - Honeydew green maintains brand consistency
   - Smooth animations feel premium

5. **Actionable**: Zero friction from discovery to decision
   - No manual calculation needed
   - One-click navigation to value markets
   - Real-time data updates

6. **Accessible**: Multiple interaction methods
   - Visual cues for quick scanning
   - Hover tooltips for detailed info
   - Works without tooltips (visual-only)

7. **Non-intrusive**: Highlights only appear when relevant
   - No alerts when no value present
   - Button highlights only when not selected
   - Tooltips only on hover (not blocking)

## Future Enhancements (Optional)

- ✅ ~~Add tooltip explaining what the value alert means~~ **COMPLETED**
- ✅ ~~Highlight market buttons to direct users~~ **COMPLETED**
- Allow users to customize the threshold (default: 57%)
- Add value history tracking
- Track historical accuracy of value alerts
- Integration with user's betting history to track value play success rate
- Mobile-optimized touch interactions for tooltips
- Push notifications for high-value opportunities (>65%)
- Value alert history/archive per game
- Compare value alerts across multiple games simultaneously

