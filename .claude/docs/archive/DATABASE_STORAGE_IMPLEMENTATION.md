# Database Storage for Betslip Links

## Overview
Betslip links are now stored directly in the `editors_picks` table to eliminate unnecessary API calls.

## Database Changes

### Migration: `20250121000000_add_betslip_links_to_editors_picks.sql`
- Added `betslip_links` JSONB column to `editors_picks` table
- Stores links as: `{"draftkings": "url", "fanduel": "url", ...}`
- Added GIN index for fast queries

## How It Works

### 1. **Check Database First**
When a pick card loads:
- Checks if `betslip_links` exists in database
- If yes → Uses stored links immediately (no API call)
- If no → Calls API to fetch links

### 2. **Save After Fetching**
After fetching from API:
- Generates betslip links
- Saves to database: `UPDATE editors_picks SET betslip_links = {...} WHERE id = ?`
- Future loads use stored links

### 3. **API Usage**
- **First time**: 1 API call per pick (when published)
- **Subsequent loads**: 0 API calls (uses database)
- **Result**: Massive reduction in API usage

## Benefits

1. **Persistent Storage**: Links survive page refreshes
2. **Zero API Calls**: After initial fetch, no more API calls needed
3. **Fast Loading**: Instant display from database
4. **Cost Effective**: Minimal API quota usage

## Flow Diagram

```
Pick Published → Component Loads
    ↓
Check Database for betslip_links
    ↓
    ├─→ Links Found? → Display Links ✅ (0 API calls)
    │
    └─→ No Links? → Call API → Generate Links → Save to DB → Display Links
                                                      ↓
                                              Next Load: Uses DB ✅
```

## Implementation Details

### Component Changes
- `SportsbookButtons` now accepts `existingLinks` prop
- Checks database first before API call
- Saves links after fetching
- Triggers parent refresh after save

### Database Schema
```sql
betslip_links JSONB DEFAULT NULL
-- Format: {"draftkings": "https://...", "fanduel": "https://...", ...}
```

## Migration Required

Run the migration to add the column:
```sql
-- Already created in: supabase/migrations/20250121000000_add_betslip_links_to_editors_picks.sql
```

## Testing

1. **First Load**: Should see API call in console, then links saved
2. **Refresh Page**: Should see "Using stored betslip links" in console
3. **No API Calls**: Subsequent loads should have zero API calls

## Future Enhancements

- Refresh links button (manual refresh)
- Expire links after X days (re-fetch)
- Background job to refresh links periodically

