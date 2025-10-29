# Feed Sport Pills and Navigation Fix

## Issues Fixed ✅

### 1. Sport Pills Not Visible
**Problem**: Sport pill selectors under the search bar were not clearly visible

**Solution**:
- Added `pillsWrapper` container with `surfaceVariant` background color
- Added "Sport:" label above the pills for clarity
- Enhanced styling with proper padding and elevation
- Pills now clearly show: NFL, CFB, NBA (Coming Soon), NCAAB (Coming Soon)

**Changes**:
```typescript
// Added wrapper with background
<View style={[styles.pillsWrapper, { backgroundColor: theme.colors.surfaceVariant }]}>
  <Text style={[styles.pillsLabel, { color: theme.colors.onSurfaceVariant }]}>Sport:</Text>
  <ScrollView horizontal>
    {/* Pills here */}
  </ScrollView>
</View>
```

### 2. CFB Still Accessible from Navigation
**Problem**: CFB tab was still accessible from bottom navigation bar

**Solution**:
- Deleted `app/(tabs)/cfb.tsx` file completely
- All CFB games now ONLY accessible through Feed's sport pill selector
- Consistent with architecture: Feed → Select Sport → View Games

**Impact**:
- Bottom nav bar now shows only 4 tabs: Feed, Chat, Picks, Settings
- All sports (NFL, CFB, NBA, NCAAB) accessed through Feed screen
- No redundant navigation paths

## Feed Screen Structure

```
┌─────────────────────────────────────┐
│ Header: "Feed" + Live Score Ticker  │
├─────────────────────────────────────┤
│ Search Bar (🔍 Search teams...)     │
├─────────────────────────────────────┤
│ Sport Pills Section                 │
│ SPORT:                              │
│ [NFL] [CFB] [NBA▼] [NCAAB▼]        │
├─────────────────────────────────────┤
│ Sort Options                        │
│ [Time] [Spread] [O/U]               │
├─────────────────────────────────────┤
│                                     │
│ Game Cards List                     │
│ (NFL or CFB based on selection)     │
│                                     │
└─────────────────────────────────────┘
```

## User Flow

1. **User opens app** → Lands on Feed (default: NFL)
2. **Select Sport** → Tap CFB pill to see College Football
3. **Search** → Type team name to filter
4. **Sort** → Choose Time, Spread, or O/U
5. **View Details** → Scroll through game cards

## File Changes

### Modified:
- `app/(tabs)/index.tsx`:
  - Added `pillsWrapper` style with background
  - Added `pillsLabel` for "Sport:" text
  - Enhanced `pillsContent` styling

### Deleted:
- `app/(tabs)/cfb.tsx` - No longer needed, CFB accessed through Feed

### Unchanged:
- `app/(tabs)/_layout.tsx` - Already configured with 4 tabs only

## Testing Checklist

- [x] Feed screen shows sport pills prominently
- [x] "Sport:" label visible above pills
- [x] Pills have clear selection state
- [x] NFL pill selected by default
- [x] Tapping CFB pill loads CFB games
- [x] NBA/NCAAB pills show "Coming Soon" and are disabled
- [x] CFB tab NOT in bottom navigation
- [x] Only 4 tabs visible: Feed, Chat, Picks, Settings

## Visual Changes

**Before**:
- Sport pills possibly hidden or not prominent
- CFB accessible from tab bar
- 5 tabs in navigation

**After**:
- Sport pills clearly visible with label and background
- CFB only accessible through Feed → CFB pill
- 4 tabs in navigation (Feed, Chat, Picks, Settings)
- All sports centralized in Feed screen

## Benefits

1. **Simplified Navigation**: One place for all sports
2. **Consistent UX**: All sports accessed the same way
3. **Cleaner Tab Bar**: 4 primary functions instead of 5+
4. **Scalable**: Easy to add new sports (MLB, NHL, etc.)
5. **Better Discovery**: Users see all available sports in one place

