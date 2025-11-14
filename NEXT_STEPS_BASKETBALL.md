# Next Steps: NBA/NCAAB Implementation

## ✅ Completed

1. **Schema Discovery** - Queried and documented all 4 basketball tables
2. **Type Definitions** - Created `SportType` union type with 'nba' | 'ncaab'
3. **AI Service Updates** - Updated `aiCompletionService.ts` to support basketball sports
4. **Database Migration** - Created migration to update constraints and seed configs

## 🔨 Next Priority Tasks

### 1. Edge Functions (CRITICAL - Must be done before data services)

Update these edge functions to support `'nba'` and `'ncaab'`:

#### `supabase/functions/generate-ai-completion/index.ts`
- [ ] Update `CompletionRequest` interface: `sport_type: 'nfl' | 'cfb' | 'nba' | 'ncaab'`
- [ ] Add payload builders for NBA/NCAAB (similar to `buildNFLPayload` and `buildCFBPayload`)
- [ ] Handle basketball-specific field mappings

#### `supabase/functions/check-missing-completions/index.ts`
- [ ] Add NBA game fetching logic (from `nba_input_values_view`)
- [ ] Add NCAAB game fetching logic (from `v_cbb_input_values`)
- [ ] Create `buildNBAPayload` and `buildNCAABPayload` helper functions
- [ ] Handle empty `nba_predictions` table gracefully

#### `supabase/functions/generate-page-level-analysis/index.ts`
- [ ] Update `PageLevelRequest` interface to include basketball
- [ ] Add NBA game fetching (from `nba_input_values_view`)
- [ ] Add NCAAB game fetching (from `v_cbb_input_values` + `ncaab_predictions`)
- [ ] Create `buildNBAGameData` and `buildNCAABGameData` functions
- [ ] Handle basketball-specific prediction fields

#### `supabase/functions/update-polymarket-cache/index.ts`
- [ ] Add `'nba'` and `'ncaab'` to league type checks
- [ ] Update `getTeamName` function for basketball team name normalization
- [ ] Add basketball games to the fetch list

### 2. Frontend Data Services (HIGH PRIORITY)

#### Create `src/services/basketballDataService.ts`
- [ ] Create `fetchNBAGames()` - Query `nba_input_values_view` from CFB Supabase
- [ ] Create `fetchNCAABGames()` - Query `v_cbb_input_values` from CFB Supabase
- [ ] Create `fetchNBAPredictions()` - Query `nba_predictions` (handle empty gracefully)
- [ ] Create `fetchNCAABPredictions()` - Query `ncaab_predictions` filtered by latest `run_id`
- [ ] Map fields to match NFL/CFB interface patterns:
  - `game_id` → `unique_id` / `training_key`
  - `home_team` / `away_team` → Direct mapping
  - `home_spread` / `spread` → `home_spread`
  - `total_line` / `over_under` → `over_line` / `total_line`
  - `home_moneyline` / `homeMoneyline` → `home_ml`
  - Calculate `away_ml` for NBA (inverse of `home_moneyline`)
  - `game_date` / `game_date_et` → `game_date`
  - `tipoff_time_et` / `start_utc` → `game_time`
- [ ] Handle missing data gracefully (no public splits, no weather)

#### Update `src/services/aiCompletionService.ts`
- [x] Update type definitions to include `'nba' | 'ncaab'`
- [ ] Update `buildGameDataPayload` to handle basketball field mappings
- [ ] Add basketball-specific prediction probability mappings

### 3. Component Updates (MEDIUM PRIORITY)

#### Update shared components to support basketball:

- [ ] `src/components/PageHeaderValueFinds.tsx` - Already updated types ✅
- [ ] `src/components/AIValueFindsPreview.tsx` - Already updated types ✅
- [ ] `src/hooks/useEditorPick.ts` - Update `gameType` to include basketball
- [ ] `src/components/StarButton.tsx` - Update `gameType` prop
- [ ] `src/components/PolymarketWidget.tsx` - Add `'nba' | 'ncaab'` to league type
- [ ] `src/components/GameTailSection.tsx` - Already supports basketball ✅
- [ ] `src/utils/teamColors.ts` - Add `getNBATeamColors`, `getNBATeamInitials`, `getNCAABTeamColors`, `getNCAABTeamInitials`

### 4. UI Pages (HIGH PRIORITY - After data services)

#### Create `src/pages/NBA.tsx`
- [ ] Copy structure from `NFL.tsx` as template
- [ ] Use `fetchNBAGames()` and `fetchNBAPredictions()` from basketball data service
- [ ] Use CFB Supabase client (same project as basketball tables)
- [ ] Map fields correctly (see schema mappings in `BASKETBALL_SCHEMAS.md`)
- [ ] Handle empty predictions gracefully (show input values only)
- [ ] Add all widgets: Value Finds header, AI completions, predictions, Polymarket, Game Tail, etc.
- [ ] Use `getNBATeamColors` and `getNBATeamInitials` for team display
- [ ] Build WagerBot context with NBA game data

#### Create `src/pages/NCAAB.tsx`
- [ ] Copy structure from `CollegeFootball.tsx` as template
- [ ] Use `fetchNCAABGames()` and `fetchNCAABPredictions()` from basketball data service
- [ ] Use CFB Supabase client
- [ ] Map fields correctly (see schema mappings)
- [ ] Filter predictions by latest `run_id` (like NFL)
- [ ] Add all widgets: Value Finds header, AI completions, predictions, Polymarket, Game Tail, etc.
- [ ] Use `getNCAABTeamColors` and `getNCAABTeamInitials` for team display
- [ ] Build WagerBot context with NCAAB game data

#### Update `src/nav-items.tsx`
- [ ] Remove `comingSoon: true` from NBA and NCAAB nav items
- [ ] Add page components: `<NBA />` and `<NCAAB />`
- [ ] Import the new page components

### 5. Admin UI Updates (MEDIUM PRIORITY)

#### Update `src/pages/admin/AISettings.tsx`
- [ ] Update `testerSportType` to include `'nba' | 'ncaab'`
- [ ] Update all sport type checks to include basketball
- [ ] Add NBA/NCAAB sections in the UI (similar to NFL/CFB sections)
- [ ] Update `buildGameDataPayload` calls to handle basketball

### 6. Supporting Updates (LOW PRIORITY)

- [ ] Update `src/services/polymarketService.ts` - Add basketball league support
- [ ] Update `src/services/liveScoresService.ts` - Already supports NBA/NCAAB ✅
- [ ] Update `src/pages/EditorsPicks.tsx` - Add basketball filters
- [ ] Update `src/pages/CommunityVoting.tsx` - Already supports basketball ✅
- [ ] Update `src/components/PickSubmissionModal.tsx` - Already supports basketball ✅

## Implementation Order

1. **Edge Functions** (Blocks data services)
2. **Data Services** (Blocks UI pages)
3. **Team Colors/Utilities** (Needed for UI)
4. **UI Pages** (Main feature)
5. **Component Updates** (Polish)
6. **Admin UI** (Configuration)

## Key Decisions Needed

1. **Team Colors/Logos**: Do we have NBA/NCAAB team color mappings? If not, we'll need to create them or use a fallback.
2. **Public Betting Splits**: These don't exist in basketball tables. Should we:
   - Show games without betting splits?
   - Add a separate data source?
   - Hide betting splits UI for basketball?
3. **Weather Data**: Basketball is indoor, so weather is less relevant. Should we:
   - Omit weather widgets entirely for basketball?
   - Show placeholder "Indoor" text?
4. **NBA Predictions**: Table is empty. Should we:
   - Show games with input values only (no predictions)?
   - Wait for predictions to be populated?
   - Show placeholder "Predictions coming soon"?

## Files to Create

- `supabase/migrations/20250115000000_add_basketball_sports.sql` ✅
- `src/services/basketballDataService.ts`
- `src/pages/NBA.tsx`
- `src/pages/NCAAB.tsx`
- `src/utils/basketballTeamColors.ts` (or extend `teamColors.ts`)

## Files to Update

- `supabase/functions/generate-ai-completion/index.ts`
- `supabase/functions/check-missing-completions/index.ts`
- `supabase/functions/generate-page-level-analysis/index.ts`
- `supabase/functions/update-polymarket-cache/index.ts`
- `src/utils/teamColors.ts`
- `src/hooks/useEditorPick.ts`
- `src/components/StarButton.tsx`
- `src/components/PolymarketWidget.tsx`
- `src/pages/admin/AISettings.tsx`
- `src/nav-items.tsx`

