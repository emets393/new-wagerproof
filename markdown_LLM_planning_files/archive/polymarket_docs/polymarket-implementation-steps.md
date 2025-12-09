# Polymarket Implementation Steps

> **Step-by-step guide for integrating Polymarket widgets into WagerProof applications**

## Table of Contents

1. [Adding a New Sport](#adding-a-new-sport)
2. [Integrating into a New App](#integrating-into-a-new-app)
3. [Customizing the Widget](#customizing-the-widget)
4. [Testing Your Integration](#testing-your-integration)
5. [Deployment Checklist](#deployment-checklist)

---

## Adding a New Sport

**Example**: Adding NBA to existing WagerProof app

### Step 1: Discover Sport Metadata

**Find the sport identifier and tag ID:**

```bash
curl https://gamma-api.polymarket.com/sports | jq '.[] | select(.sport == "nba")'
```

**Expected Output**:
```json
{
  "sport": "nba",
  "name": "NBA",
  "tags": "1,100456,100639",
  "series": "10215",
  "ordering": "away",
  "active": true
}
```

**Key Information**:
- Sport identifier: `"nba"` (use this in code)
- Tag ID: `100456` (first non-"1" tag)
- Ordering: `"away"` (away team is YES token)

---

### Step 2: Add Team Mappings

**File**: `src/services/polymarketService.ts`

**Add team name mapping constant:**

```typescript
// After NFL_TEAM_MASCOTS and CFB_TEAM_MAPPINGS

// NBA teams - map city names to full team names
const NBA_TEAM_MAPPINGS: Record<string, string> = {
  'Atlanta': 'Hawks',
  'Boston': 'Celtics',
  'Brooklyn': 'Nets',
  'Charlotte': 'Hornets',
  'Chicago': 'Bulls',
  'Cleveland': 'Cavaliers',
  'Dallas': 'Mavericks',
  'Denver': 'Nuggets',
  'Detroit': 'Pistons',
  'Golden State': 'Warriors',
  'Houston': 'Rockets',
  'Indiana': 'Pacers',
  'LA Clippers': 'Clippers',
  'LA Lakers': 'Lakers',
  'Memphis': 'Grizzlies',
  'Miami': 'Heat',
  'Milwaukee': 'Bucks',
  'Minnesota': 'Timberwolves',
  'New Orleans': 'Pelicans',
  'New York': 'Knicks',
  'Oklahoma City': 'Thunder',
  'Orlando': 'Magic',
  'Philadelphia': '76ers',
  'Phoenix': 'Suns',
  'Portland': 'Trail Blazers',
  'Sacramento': 'Kings',
  'San Antonio': 'Spurs',
  'Toronto': 'Raptors',
  'Utah': 'Jazz',
  'Washington': 'Wizards',
};
```

**Update `getTeamMascot()` function:**

```typescript
function getTeamMascot(teamName: string, league: 'nfl' | 'cfb' | 'nba' = 'nfl'): string {
  if (league === 'cfb') {
    return CFB_TEAM_MAPPINGS[teamName] || teamName;
  }
  if (league === 'nba') {
    return NBA_TEAM_MAPPINGS[teamName] || teamName;
  }
  return NFL_TEAM_MASCOTS[teamName] || teamName;
}
```

---

### Step 3: Update Type Definitions

**File**: All files with league type unions

**Find and replace**:
```typescript
// Before
'nfl' | 'cfb'

// After
'nfl' | 'cfb' | 'nba'
```

**Files to update**:
- `src/services/polymarketService.ts`
  - `getTeamMascot()`
  - `getLeagueTagId()`
  - `getLeagueEvents()`
  - `getAllMarketsDataLive()`
  - `getAllMarketsData()`
- `src/components/PolymarketWidget.tsx`
  - `PolymarketWidgetProps` interface

**Example**:
```typescript
// src/services/polymarketService.ts
async function getLeagueTagId(league: 'nfl' | 'cfb' | 'nba'): Promise<string | null> {
  const sports = await getSportsMetadata();
  const sportName = league === 'nfl' ? 'nfl' : 
                    league === 'cfb' ? 'cfb' : 
                    'nba';
  const sport = sports.find((s) => s.sport?.toLowerCase() === sportName);
  // ... rest of function
}
```

---

### Step 4: Integrate Widget into NBA Page

**File**: `src/pages/NBA.tsx` (or wherever your NBA games display)

**Add import**:
```typescript
import PolymarketWidget from '@/components/PolymarketWidget';
```

**Add widget to game card**:
```tsx
{/* Polymarket Widget */}
<div 
  className="pt-4"
  onPointerDown={(e) => e.stopPropagation()}
  onMouseDown={(e) => e.stopPropagation()}
  onTouchStart={(e) => e.stopPropagation()}
  onClick={(e) => e.stopPropagation()}
  style={{ pointerEvents: 'auto', isolation: 'isolate' }}
>
  <PolymarketWidget
    awayTeam={prediction.away_team}
    homeTeam={prediction.home_team}
    gameDate={prediction.game_date}
    awayTeamColors={awayTeamColors}
    homeTeamColors={homeTeamColors}
    league="nba"
  />
</div>
```

**Position in card**: Place above "Model Predictions" section or wherever makes sense for your layout.

---

### Step 5: Test the Integration

**1. Start dev server**:
```bash
npm run dev
```

**2. Navigate to NBA page**

**3. Check console for logs**:
```
✅ NBA tag ID: 100456
📊 Fetching NBA events with tag: 100456
🔍 Fetching all Polymarket markets for: Lakers vs Warriors
✅ Found event: Los Angeles Lakers vs. Golden State Warriors
📊 Found moneyline market: Lakers vs Warriors
✅ moneyline: 58% - 42%
```

**4. Verify widget displays**:
- Chart renders with data
- Market type selector works (ML/Spread/O/U)
- Time range selector works
- Widget is clickable (buttons work)
- Parent card doesn't react to widget clicks

---

### Step 6: Handle Edge Cases

**A. Team Name Variations**

If Polymarket uses different names:

```typescript
// Example: "LA Lakers" vs "Los Angeles Lakers"
const NBA_TEAM_MAPPINGS: Record<string, string> = {
  'LA Lakers': 'Lakers',
  'Los Angeles Lakers': 'Lakers',  // Add both variations
  'Los Angeles': 'Lakers',
  // ...
};
```

**B. No Data Available**

Widget shows "Polymarket betting data unavailable for this game" if:
- Game not on Polymarket yet
- Game already settled
- Team names don't match

**C. Market Type Missing**

If spread or total missing:
- Button will be disabled
- Widget shows only available markets
- No error thrown

---

## Integrating into a New App

**Example**: Adding Polymarket widget to a mobile app or separate dashboard

### Step 1: Copy Required Files

**Core Files**:
```bash
# Component
src/components/PolymarketWidget.tsx

# Service layer
src/services/polymarketService.ts

# Types
src/types/polymarket.ts

# Utilities (if not already in app)
src/utils/debug.ts

# Edge Function
supabase/functions/polymarket-proxy/index.ts
```

**Dependency Check**:
```json
{
  "dependencies": {
    "recharts": "^2.x",
    "date-fns": "^2.x",
    "@tanstack/react-query": "^5.x",
    "@supabase/supabase-js": "^2.x"
  }
}
```

---

### Step 2: Set Up Supabase Project

**A. Create Supabase Project** (if not exists)
- Go to https://supabase.com
- Create new project
- Note your project URL and anon key

**B. Configure Environment Variables**

```bash
# .env.local
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

**C. Initialize Supabase Client**

```typescript
// src/integrations/supabase/client.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

---

### Step 3: Deploy Edge Function

**A. Install Supabase CLI**:
```bash
npm install -g supabase
```

**B. Link to your project**:
```bash
supabase link --project-ref your-project-ref
```

**C. Deploy the proxy function**:
```bash
supabase functions deploy polymarket-proxy
```

**D. Verify deployment**:
```bash
supabase functions list
```

Expected output:
```
polymarket-proxy  │ deployed  │ 2025-01-29 12:34:56
```

---

### Step 4: Configure React Query

**Wrap your app with QueryClientProvider**:

```tsx
// src/App.tsx or main.tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      {/* Your app */}
    </QueryClientProvider>
  );
}
```

---

### Step 5: Use the Widget

**Basic Usage**:

```tsx
import PolymarketWidget from '@/components/PolymarketWidget';

function GameCard({ game }) {
  return (
    <div>
      <h2>{game.away_team} @ {game.home_team}</h2>
      
      <PolymarketWidget
        awayTeam={game.away_team}
        homeTeam={game.home_team}
        gameDate={game.game_date}
        league="nfl"
        awayTeamColors={{ primary: "#241773", secondary: "#000000" }}
        homeTeamColors={{ primary: "#008E97", secondary: "#FC4C02" }}
      />
    </div>
  );
}
```

**With Dynamic Colors** (if you have a color mapping):

```tsx
import { getTeamColors } from '@/utils/teamColors';

function GameCard({ game }) {
  const awayColors = getTeamColors(game.away_team);
  const homeColors = getTeamColors(game.home_team);
  
  return (
    <PolymarketWidget
      awayTeam={game.away_team}
      homeTeam={game.home_team}
      league="nfl"
      awayTeamColors={awayColors}
      homeTeamColors={homeColors}
    />
  );
}
```

---

### Step 6: Test in New Environment

**Checklist**:
- [ ] Edge Function is deployed and accessible
- [ ] Supabase client is configured with correct credentials
- [ ] React Query provider wraps the app
- [ ] Widget renders without errors
- [ ] API calls go through Edge Function (check Network tab)
- [ ] Chart displays with data
- [ ] Interactive elements work (buttons, time ranges)

---

## Customizing the Widget

### Styling

**Override component styles**:

```tsx
<PolymarketWidget
  awayTeam="Lakers"
  homeTeam="Warriors"
  league="nba"
  className="my-custom-widget" // Add custom class
/>
```

```css
/* Your CSS */
.my-custom-widget {
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
}

.my-custom-widget .recharts-line {
  stroke-width: 3px;
}
```

---

### Changing Colors

**Default team colors**:

```typescript
// If no colors provided, widget uses neutral colors
awayTeamColors: { primary: "#6B7280", secondary: "#9CA3AF" }
homeTeamColors: { primary: "#6B7280", secondary: "#9CA3AF" }
```

**Custom color palette**:

```tsx
<PolymarketWidget
  awayTeam="Team A"
  homeTeam="Team B"
  league="nfl"
  awayTeamColors={{ primary: "#FF0000", secondary: "#CC0000" }}
  homeTeamColors={{ primary: "#0000FF", secondary: "#0000CC" }}
/>
```

---

### Adding Custom Header

**Edit `PolymarketWidget.tsx`**:

```tsx
// Around line 160
<CardHeader>
  <CardTitle className="text-lg font-semibold text-center">
    Your Custom Title Here
  </CardTitle>
</CardHeader>
```

---

### Disabling Market Types

**To show only moneyline** (no spread/total):

Edit `PolymarketWidget.tsx`:

```tsx
// Around line 180 - remove spread and O/U buttons
<Button
  variant={selectedMarket === 'moneyline' ? 'default' : 'outline'}
  size="sm"
  onClick={(e) => {
    handleButtonClick(e, '1M');
    setSelectedMarket('moneyline');
  }}
  disabled={!allMarketsData.moneyline}
  className="h-8 px-3 text-xs"
>
  Moneyline
</Button>
// Remove spread and total buttons
```

---

## Testing Your Integration

### Manual Testing Checklist

**Visual Tests**:
- [ ] Widget loads without errors
- [ ] Chart displays correctly
- [ ] Team colors apply to lines
- [ ] Current odds show accurate numbers
- [ ] All buttons are visible and styled

**Functional Tests**:
- [ ] Market type selector changes data
- [ ] Time range selector filters data correctly
- [ ] Hover tooltip shows on chart
- [ ] Clicking widget doesn't trigger parent card
- [ ] Loading state shows while fetching
- [ ] Error state shows if no data

**Data Tests**:
- [ ] Moneyline data fetches successfully
- [ ] Spread data fetches (if available)
- [ ] Total data fetches (if available)
- [ ] Historical data covers expected timeframe
- [ ] Current odds match latest point in chart

---

### Automated Testing

**Test Service Functions**:

```typescript
// __tests__/polymarketService.test.ts
import { getSportsMetadata, getLeagueTagId } from '@/services/polymarketService';

describe('Polymarket Service', () => {
  it('fetches sports metadata', async () => {
    const sports = await getSportsMetadata();
    expect(sports).toBeInstanceOf(Array);
    expect(sports.length).toBeGreaterThan(0);
  });

  it('gets NFL tag ID', async () => {
    const tagId = await getLeagueTagId('nfl');
    expect(tagId).toBeTruthy();
    expect(typeof tagId).toBe('string');
  });
});
```

**Test Widget Rendering**:

```typescript
// __tests__/PolymarketWidget.test.tsx
import { render, screen } from '@testing-library/react';
import PolymarketWidget from '@/components/PolymarketWidget';

describe('PolymarketWidget', () => {
  it('renders without crashing', () => {
    render(
      <PolymarketWidget
        awayTeam="Baltimore"
        homeTeam="Miami"
        league="nfl"
      />
    );
    expect(screen.getByText(/Public Betting Lines/i)).toBeInTheDocument();
  });
});
```

---

## Deployment Checklist

### Pre-Deployment

- [ ] All TypeScript errors resolved
- [ ] Linter warnings addressed
- [ ] Edge Function deployed to production
- [ ] Environment variables set in production
- [ ] Team mappings complete for all teams
- [ ] Manual testing completed
- [ ] Widget positioning finalized

### Production Deployment

**1. Build the app**:
```bash
npm run build
```

**2. Test production build locally**:
```bash
npm run preview
```

**3. Check bundle size**:
```bash
npx vite-bundle-visualizer
```

Widget should add ~50KB (Recharts is the largest dependency).

**4. Deploy to hosting**:
```bash
# Vercel
vercel --prod

# Netlify
netlify deploy --prod

# Or your preferred hosting
```

**5. Verify in production**:
- Visit production URL
- Open DevTools → Network tab
- Check that Edge Function calls succeed
- Verify widget displays data

---

### Post-Deployment

**Monitor**:
- [ ] Check error logs for API failures
- [ ] Monitor Edge Function usage
- [ ] Track widget load times
- [ ] Watch for CORS issues (shouldn't happen with proxy)

**Optimize if needed**:
- [ ] Add database caching (see POLYMARKET_CACHE_SETUP.md)
- [ ] Implement CDN for static assets
- [ ] Enable service worker for offline support

---

## Rollback Plan

If something goes wrong in production:

**1. Revert deployment**:
```bash
# Vercel
vercel rollback

# Netlify  
netlify rollback
```

**2. Hide widget temporarily**:
```tsx
// Quick fix: Add feature flag
{import.meta.env.VITE_ENABLE_POLYMARKET === 'true' && (
  <PolymarketWidget ... />
)}
```

**3. Fix issue in development**

**4. Re-deploy when ready**

---

## Common Integration Issues

### Issue: Widget Not Displaying

**Check**:
1. Is Edge Function deployed? (`supabase functions list`)
2. Are environment variables set?
3. Is React Query provider wrapping the app?
4. Check browser console for errors

### Issue: No Data Showing

**Check**:
1. Do team names match Polymarket's format?
2. Is the game on Polymarket? (not all games are listed)
3. Check Network tab - is API call succeeding?
4. Look for console logs with team matching info

### Issue: Widget Not Clickable

**Check**:
1. Are event handlers on wrapper div present?
2. Is parent card intercepting clicks?
3. Try adding `pointer-events: auto` and higher `z-index`

---

## Next Steps

After successful integration:

1. **Add Caching** - See [POLYMARKET_CACHE_SETUP.md](../POLYMARKET_CACHE_SETUP.md) for database caching
2. **Monitor Performance** - Track API response times
3. **Add More Sports** - Repeat this process for NBA, MLB, etc.
4. **Customize Further** - Adjust styling to match your brand

---

## Support

**Questions?**
- Review [Troubleshooting Guide](./polymarket-troubleshooting.md)
- Check [API Reference](./polymarket-api-reference.md)
- See [Code Patterns](./polymarket-code-patterns.md)

**Found a bug?**
- Document the issue with console logs
- Check if Edge Function is working
- Verify team name mappings

