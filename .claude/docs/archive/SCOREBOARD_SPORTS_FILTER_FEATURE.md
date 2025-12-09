# Scoreboard Sports Filter Feature

## Summary
Added a sports filter feature to the ScoreBoard page that allows users to toggle on/off which sports they want to see. User preferences are persisted in localStorage for a seamless experience.

## Features

### 1. Custom Sports Filter Hook (`src/hooks/useSportsFilter.ts`)
A reusable React hook that manages sports filter preferences:

**Capabilities:**
- Toggle individual sports on/off
- Enable all sports at once
- Disable all sports at once
- Check if a specific sport is enabled
- Persist preferences in localStorage
- Get counts of enabled/total sports

**Default Behavior:**
- All sports are enabled by default
- Settings persist across page reloads and sessions

**Supported Sports:**
- NFL
- NCAAF (College Football)
- NBA
- NCAAB (College Basketball)
- NHL
- MLB
- MLS
- EPL (Premier League)

### 2. Sports Filter Button Component (`src/components/SportsFilterButton.tsx`)
A dropdown menu component with:

**UI Elements:**
- Filter icon button with badge showing active filter count
- Button style changes based on filter state:
  - Outline variant when all sports shown
  - Default/filled variant when filters are active
- Badge showing number of enabled sports

**Dropdown Menu:**
- Header showing enabled count (e.g., "5/8")
- Quick action buttons:
  - "All" - enables all sports
  - "None" - disables all sports
- Checkbox list for each sport with:
  - Sport emoji icon
  - Sport name
  - Visual checkbox (checked/unchecked)
- Interactive - click any item to toggle that sport

### 3. Updated ScoreBoard Page (`src/pages/ScoreBoard.tsx`)

**Integration:**
- Added filter button to page header (next to Diagnostics and Expand buttons)
- Filters games before displaying them
- Shows filter button even when no games are live

### 4. Updated Live Score Ticker (`src/components/LiveScoreTicker.tsx`)

**Integration:**
- Applies the same sports filter to the ticker
- Filters out games from disabled sports
- Ticker hides completely if all games are filtered out
- Debug logs show filtered count vs total count

**Visual Feedback:**
1. **Active Filter Alert** (appears when filters active):
   - Info alert showing "Showing X of Y sports"
   - Warns if filtered sports have no live games

2. **Empty State** (when all filtered games hidden):
   - Friendly message: "No Games Match Your Filter"
   - Helpful text suggesting to adjust filter
   - Encourages checking back later

3. **Filter Button Badge**:
   - Shows count of enabled sports when filtering
   - Button changes color to indicate active state

## User Experience Flow

### First Time User
1. Opens ScoreBoard page
2. Sees all available live games (all sports shown by default)
3. Clicks "Filter Sports" button
4. Can toggle sports on/off
5. Preferences automatically saved to browser

### Returning User
1. Opens ScoreBoard page
2. Previously selected sports filter is automatically applied
3. Only sees games from their preferred sports
4. Can adjust filter anytime

### Common Scenarios

**Scenario 1: Basketball Fan**
- User clicks Filter Sports
- Clicks "None" to disable all
- Enables only NBA and NCAAB
- Filter persists - user only sees basketball games on future visits
- The live ticker (shown at top of all pages) also only shows NBA/NCAAB games

**Scenario 2: Multi-Sport View**
- User wants to see all sports
- Clicks Filter Sports → "All"
- All sports shown

**Scenario 3: No Matching Games**
- User has filtered to only show NFL
- No NFL games are currently live
- Alert shows: "Showing 1 of 8 sports. All filtered sports have no live games."
- Empty state displayed with helpful message

## Technical Details

### Data Persistence
- **Storage**: localStorage
- **Key**: `wagerproof_sports_filter`
- **Format**: JSON object mapping sport keys to boolean values
- **Example**:
  ```json
  {
    "NFL": true,
    "NCAAF": true,
    "NBA": false,
    "NCAAB": false,
    "NHL": true,
    "MLB": true,
    "MLS": false,
    "EPL": false
  }
  ```

### Performance
- Filter applied in-memory (no database calls)
- Instant feedback when toggling sports
- Minimal re-renders using React hooks

### Responsive Design
- Mobile: Shows "Filter Sports" icon with badge
- Desktop: Shows full "Filter Sports" text with badge
- Dropdown menu adapts to screen size
- Touch-friendly for mobile devices

## Benefits

1. **Personalization**: Users see only the sports they care about
2. **Reduced Clutter**: Cleaner interface when many sports have live games
3. **Persistent**: Preferences saved across sessions
4. **Fast**: No loading time, instant filtering
5. **Intuitive**: Clear visual feedback on filter state
6. **Flexible**: Easy to enable/disable multiple sports at once
7. **Consistent**: Filter applies to both scoreboard page AND live ticker across all pages

## Scope of Filtering

### What Gets Filtered:
✅ **ScoreBoard Page** - Main scoreboard with all game cards
✅ **Live Score Ticker** - Horizontal scrolling ticker at top of pages
✅ **Consistent Everywhere** - Same filter applies site-wide

### What Doesn't Get Filtered:
- Individual sport pages (NFL, NBA, etc.) - these always show their specific sport
- Editor's picks
- Chat/social features
- Search results (may be added in future)

## Future Enhancements

Potential improvements:
- **Mobile App**: Add same filter to React Native mobile app
- Sync preferences across devices (requires user account/database)
- Remember different filter sets (presets)
- Show preview count in dropdown before applying
- Add "Favorites" quick filter
- Filter by conference (for college sports)
- Notification preferences per sport
- Apply filter to other areas (search, recommendations, etc.)

