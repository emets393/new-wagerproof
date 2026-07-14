# Cursor task: finish + ship the CFB Historical Analysis filter overhaul

You are finishing an in-progress overhaul of the **CFB Historical Analysis** feature (web `/cfb-analytics` +
the native iOS app). Most of the implementation is already done and verified — your job is to (1) codify the
database changes as committed, reproducible migrations, (2) verify web + iOS build, and (3) commit + push and
make sure the **production** CFB database matches. **Do not redo the feature from scratch** — the code below is
already written. A second thread may also be touching the iOS Swift files; re-read before editing and don't
clobber unrelated changes.

## Two databases (do not confuse them)
- **CFB warehouse** = Supabase project `jpxnjuwglavsjbgbasnl`, reached from the app via the
  `collegeFootballSupabase` client. This is where `cfb_analysis_base` + the `cfb_analysis` / `cfb_analysis_upcoming`
  RPCs live. **The live `/cfb-analytics` page reads from here — this is production for this feature.**
- **Main project** = `gnjrklxotmbvnxbnnqgq` (`supabase` client) — only holds `cfb_analysis_saved_filters`. No
  changes needed there.
- DDL on the warehouse must go through the Supabase **Management API** or MCP (`apply_migration`) — the service
  key is PostgREST-only and cannot run DDL. Never print the service key or any key from `.env.local`.

---

## What was already implemented (context — already in the working tree / already live)

### A. Database (ALREADY APPLIED to `jpxnjuwglavsjbgbasnl`)
CFBD historical weather (2016–2025) was loaded from `research/cfb-model/data/cfbd/weather_*.parquet` (these files
already exist) into `cfb_analysis_base`:
- Backfilled `temperature`, `wind_speed`, `precipitation` for **all seasons** (they were previously only
  populated for 2025 from a visualcrossing feed — temp/wind filters were silently one-season).
- Added column **`weather_condition text`** (`clear` | `cloudy` | `rain` | `snow`, else NULL) derived from CFBD
  `weatherCondition`.
- Added column **`dome boolean`** from CFBD `gameIndoors`.
- `has_weather` recomputed = `temperature IS NOT NULL`.
- The `cfb_analysis` RPC gained two filter clauses: `weather` (string) and `dome` (bool).

⚠️ Because this was applied ad-hoc (and the old `cab_builder` loader scripts are gone from disk/git), **there is
no committed migration or loader for it yet. Creating those is the main DB task below.**

### B. Web (already edited, typechecks clean — LOCAL, not committed)
- `src/pages/CFBAnalytics.tsx`
- `src/features/analysis/normalizeSavedFilterSnapshot.ts` (added `weather` + `dome` to `CfbWebFilterSnapshot` +
  both normalizer return objects)

Filters are now grouped: **Bet line** (adapts to the market) → **Situation** (seasons, game type, weeks, ranked
matchup, side, primetime, conference game, neutral site) → **Game conditions** (weather, venue/dome, temp, wind)
→ **Conference** → **Last game**. Adaptive-controls fix: on game-total markets (`fg_total`/`h1_total`) the Side,
ML-odds and Favorite/Underdog controls are hidden (they returned 0 games / did nothing); ML-odds shows only on
ML markets; spread only on spread markets.

### C. iOS native app (already edited, full app target compiles — LOCAL, not committed)
`wagerproof-ios-native/`:
- `WagerproofKit/Sources/WagerproofModels/HistoricalAnalysis.swift` — snapshot gained `weather`, `lastAts`,
  `lastTotal`, `lastRole`, `lastOt`, `lastBlowout` (+ CodingKeys, init defaults, decoder).
- `WagerproofKit/Sources/WagerproofModels/HistoricalAnalysisFilterBuilder.swift` — CFB spread cap 28→50,
  emits `weather`/`dome`/last-game keys, hides Side/ML on game totals.
- `Wagerproof/Features/Analytics/HistoricalAnalysisFiltersView.swift` — Weather + Venue in Conditions,
  Primetime/Conference-game/Neutral-site moved into Situation, new **Last game** sheet, Side/ML pills gated.
- `Wagerproof/Features/Analytics/HistoricalAnalysisCopy.swift` — weather/dome/last-game active chips.

---

## Your tasks

### 1. Codify the DB migration (repo record + reproducibility)
Create `research/cfb-model/cab_builder/weather_dome_migration.sql` containing the **idempotent** DDL:

```sql
-- CFB analysis: weather condition + dome, backfilled from CFBD /games/weather (2016-2025)
ALTER TABLE cfb_analysis_base ADD COLUMN IF NOT EXISTS weather_condition text;
ALTER TABLE cfb_analysis_base ADD COLUMN IF NOT EXISTS dome boolean;
```

Then capture the **current live** `cfb_analysis` function definition from `jpxnjuwglavsjbgbasnl`
(`SELECT pg_get_functiondef('public.cfb_analysis(text,jsonb)'::regprocedure);`) into
`research/cfb-model/cab_builder/cfb_analysis_rpc.sql` as a `CREATE OR REPLACE FUNCTION …`. The WHERE clause must
include these two lines (already present in the live version — verify, don't duplicate):

```sql
AND (p_filters->>'weather' IS NULL OR b.weather_condition = (p_filters->>'weather'))
AND (p_filters->>'dome' IS NULL OR b.dome = (p_filters->>'dome')::boolean)
```

### 2. Write the reproducible loader
Create `research/cfb-model/cab_builder/load_cfb_weather_dome.py` — reads the CFBD weather parquets, buckets the
condition text, and backfills the base table. It reuses `dry_common` (PostgREST insert helper; never prints the
key). Logic (this exact bucketing was used to build the live data):

```python
import pandas as pd, glob
import dry_common as C  # research/cfb-model/dry_common.py — C.insert / C.wipe

df = pd.concat([pd.read_parquet(f) for f in glob.glob('data/cfbd/weather_*.parquet')], ignore_index=True)

def bucket(c):
    if not isinstance(c, str): return None
    s = c.lower()
    if s in ('none', ''): return None
    if 'snow' in s or 'sleet' in s: return 'snow'
    if 'rain' in s or 'shower' in s or 'thunder' in s or s == 'storm': return 'rain'
    if 'clear' in s or 'fair' in s: return 'clear'
    if 'cloud' in s or 'overcast' in s or 'fog' in s: return 'cloudy'
    return None

df['weather_condition'] = df['weatherCondition'].map(bucket)
df = df.sort_values('id').drop_duplicates('id', keep='first')
frame = (df[['id', 'temperature', 'windSpeed', 'precipitation', 'weather_condition', 'gameIndoors']]
         .rename(columns={'id': 'game_id', 'windSpeed': 'wind_speed', 'gameIndoors': 'dome'}))
frame['game_id'] = frame['game_id'].astype('int64')

# 1) create staging (via Management API / apply_migration):
#    CREATE TABLE IF NOT EXISTS cfb_wx_backfill (game_id bigint PRIMARY KEY, temperature numeric,
#      wind_speed numeric, precipitation numeric, weather_condition text, dome boolean);
# 2) C.wipe('cfb_wx_backfill','game_id=gte.0'); C.insert('cfb_wx_backfill', frame)
# 3) apply the UPDATE below, then DROP TABLE cfb_wx_backfill.
```

Backfill UPDATE (join is `cfb_analysis_base.game_id = <CFBD game id>`):

```sql
UPDATE cfb_analysis_base b SET
  temperature       = w.temperature,
  wind_speed        = w.wind_speed,
  precipitation     = w.precipitation,
  weather_condition = w.weather_condition,
  dome              = w.dome,
  has_weather       = (w.temperature IS NOT NULL)
FROM cfb_wx_backfill w
WHERE w.game_id = b.game_id;
```

Add a short `research/cfb-model/cab_builder/README` note documenting these three files + that the historical
warehouse is additive (any future rebuild of `cfb_analysis_base` must preserve `weather_condition`, `dome`,
`team_ml`, `team_rank`, and the `last_*` columns).

### 3. Apply to the production CFB database
The DDL + backfill + RPC are **already live on `jpxnjuwglavsjbgbasnl`**. So:
- **If `jpxnjuwglavsjbgbasnl` is your production CFB DB** (it is what the live site reads) → nothing to re-run;
  just commit the migration/loader files for the record and run the verification probe (step 5) to confirm.
- **If you maintain a separate production CFB warehouse** → apply `weather_dome_migration.sql` +
  `cfb_analysis_rpc.sql` + run `load_cfb_weather_dome.py` against it. The DDL is idempotent (`IF NOT EXISTS`);
  the loader is a delete-then-insert on staging + UPDATE, safe to re-run.

### 4. Build/verify the app code
- Web: `npm run build` (or `npx tsc --noEmit`) — must be clean for `CFBAnalytics.tsx` and
  `normalizeSavedFilterSnapshot.ts`.
- iOS: `cd wagerproof-ios-native && xcodebuild build -project Wagerproof.xcodeproj -scheme Wagerproof
  -destination 'id=CCFCB3E2-2FC8-47B7-A392-FA72404C1D1A' -configuration Debug CODE_SIGNING_ALLOWED=NO -quiet`
  (any installed iPhone-16-class simulator id works — `xcrun simctl list devices available`). Must exit 0.

### 5. Verification probe (run against the CFB warehouse)
Every filter must move the numbers; game totals must not break. Spot-check:

```sql
select 'baseline'  k,(cfb_analysis('fg_total','{}')->'overall'->>'n') n,(cfb_analysis('fg_total','{}')->'overall'->>'hit_pct') hit
union all select 'rain',   (cfb_analysis('fg_total','{"weather":"rain"}')->'overall'->>'n'),(cfb_analysis('fg_total','{"weather":"rain"}')->'overall'->>'hit_pct')
union all select 'snow',   (cfb_analysis('fg_total','{"weather":"snow"}')->'overall'->>'n'),(cfb_analysis('fg_total','{"weather":"snow"}')->'overall'->>'hit_pct')
union all select 'dome',   (cfb_analysis('fg_total','{"dome":true}')->'overall'->>'n'),(cfb_analysis('fg_total','{"dome":true}')->'overall'->>'hit_pct');
```
Expected order-of-magnitude: baseline ≈ 6,949 (49.0% over); rain ≈ 499 (≈48% over); snow ≈ 24 (≈46%);
dome ≈ 283 (≈42%). If snow/rain don't move, the `weather` clause or the backfill didn't apply.

### 6. Commit + push
- Branch off `main` (don't commit straight to `main`). Suggested branch: `cfb-analytics-weather-regroup`.
- One commit for the DB migration/loader files, one for web, one for iOS (or a single clean commit — your call),
  with a clear message summarizing: weather/dome filters + all-season temp/wind backfill, adaptive controls,
  and the 5-group regroup.
- Open a PR to `main`. In the description, note that the warehouse DB changes are already live on
  `jpxnjuwglavsjbgbasnl` and the migration files are the codified record.

## Housekeeping
- Delete the now-stale `research/cfb-model/CFB_NFL_ANALYSIS_APP_PROMPT.md` — it wrongly targeted the React-Native
  `wagerproof-mobile` app; the real app is `wagerproof-ios-native` (SwiftUI), which already has this feature.
- The condition text is complete for 2022+, partial 2018–2021, sparse 2016–2017 (a CFBD source limitation, not a
  bug). Temp/wind are complete for all seasons. Keep the UI note that says so.
