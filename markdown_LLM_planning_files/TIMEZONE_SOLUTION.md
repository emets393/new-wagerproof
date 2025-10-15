# Timezone Solution for WagerProof

## Problem
The application was experiencing timezone-related issues where games would disappear around 8 PM each day. This happened because:

1. **Frontend**: Used Eastern Time (ET) for date calculations
2. **Some Supabase functions**: Used UTC dates (`toISOString().split('T')[0]`)
3. **Other Supabase functions**: Used local timezone dates (`toLocaleDateString('en-CA')`)

When the date changed in UTC (around 8 PM ET), functions using UTC would look for "tomorrow's" games while the frontend was still looking for "today's" games.

## Solution
Standardized all date handling to use **Eastern Time (ET)** consistently across the entire application.

### Frontend Date Utilities (`src/utils/dateUtils.ts`)

```typescript
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

// Get today's date in Eastern Time
export function getTodayInET(): string {
  const now = new Date();
  const easternTime = toZonedTime(now, 'America/New_York');
  return format(easternTime, 'yyyy-MM-dd');
}

// Additional utility functions for date calculations
export function getDateInET(date: Date): string
export function isTodayInET(dateString: string): boolean
export function getYesterdayInET(): string
export function getTomorrowInET(): string
export function formatDateForDisplay(date: Date): string
export function getCurrentHourInET(): number
```

### Supabase Functions Date Utilities (`supabase/functions/shared/dateUtils.ts`)

```typescript
import { format } from "https://esm.sh/date-fns@3.6.0";
import { toZonedTime } from "https://esm.sh/date-fns-tz@3.0.0";

// Same functions as frontend but with Deno-compatible imports
export function getTodayInET(): string
export function getDateInET(date: Date): string
// ... other utility functions
```

### Implementation Pattern

**For Frontend Components:**
```typescript
import { getTodayInET, getDateDebugInfo } from "@/utils/dateUtils";

const today = getTodayInET();
const debugInfo = getDateDebugInfo();
console.log('Fetching games for ET date:', today);
```

**For Supabase Functions:**
```typescript
// Get today's date in Eastern Time (ET) for consistent date handling
const now = new Date();
const easternTime = new Date(now.toLocaleString("en-US", {timeZone: "America/New_York"}));
const today = easternTime.toISOString().split('T')[0];
console.log('Fetching games for ET date:', today);
console.log('Current UTC time:', now.toISOString());
console.log('Current ET time:', easternTime.toISOString());
```

## Updated Files

### Frontend
- `src/utils/dateUtils.ts` - Enhanced with additional utility functions
- `src/pages/Index.tsx` - Updated to use ET consistently
- `new-wagerproof/src/pages/Index.tsx` - Updated to use ET consistently

### Supabase Functions
- `supabase/functions/games-today-filtered/index.ts` - Updated date handling
- `supabase/functions/run_custom_model/index.ts` - Updated date handling
- `supabase/functions/check-saved-patterns/index.ts` - Updated date handling
- `supabase/functions/filter-training-data/index.ts` - Updated date handling
- `supabase/functions/shared/dateUtils.ts` - New shared utility file

## Benefits

1. **Consistent Date Handling**: All components now use Eastern Time
2. **No More 8 PM Issues**: Games won't disappear when UTC date changes
3. **Better Debugging**: Added comprehensive logging for date operations
4. **Maintainable**: Centralized date utilities prevent future inconsistencies

## Best Practices

1. **Always use Eastern Time** for date calculations in this application
2. **Use the utility functions** from `dateUtils.ts` instead of manual date calculations
3. **Add debug logging** when working with dates to help troubleshoot issues
4. **Test around 8 PM** to ensure the fix works correctly

## Testing

To verify the fix works:

1. Check the application around 8 PM ET
2. Verify games don't disappear when UTC date changes
3. Check console logs for date debug information
4. Ensure all pages (Today's Games, Custom Models, Saved Patterns) show consistent data

## Future Maintenance

When adding new date-related functionality:

1. Import utilities from `src/utils/dateUtils.ts` (frontend) or use the ET pattern (Supabase functions)
2. Add debug logging for date operations
3. Test around timezone boundaries (8 PM ET)
4. Document any date-related changes in this file 