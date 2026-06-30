# CFB Team-Trends Splits + Matchups — build prompt (mirror of the NFL work)

Paste this into the CFB thread. It mirrors what was just built for NFL
(commit `309c1b9` on `preview/dry-run-agents-ios`, file
`research/nfl-extreme-outcomes/dryrun_wk12_trends.py`). Goal: extend
`cfb_team_trends` so the filterable Outliers trend page has pre-aggregated
situational splits + head-to-head matchup records (app reads, never computes).

## What already exists (do NOT rebuild)
- `cfb_team_trends` table + builder `research/cfb-model/gen_cfb_team_trends.py`
  already produce per-team season-to-date records for all 6 markets
  (SU/ML, ATS, O/U, team total, 1H ATS, 1H O/U) + `last5_*` arrays + a
  `game_log` jsonb.
- **The `game_log` already carries everything the splits need per game:**
  `is_home` (bool), `spread` (team's line — sign gives favorite/underdog),
  and the 6 result letters `su`/`ats`/`ou`/`tt`/`h1_ats`/`h1_ou`
  (`W/L/P` or `O/U/P`). So this is an aggregation add, not new grading.

## What to add (matches the NFL spec)
1. **`splits` jsonb** — 6 markets × 5 dimensions × 3 windows, current season:
   - markets → game_log field, hit-letter, loss-letter:
     `spread`→(`ats`,W,L), `moneyline`→(`su`,W,L), `total`→(`ou`,O,U),
     `team_total`→(`tt`,O,U), `h1_spread`→(`h1_ats`,W,L), `h1_total`→(`h1_ou`,O,U)
   - dimensions: `overall` (all), `home` (`is_home`), `away` (not home),
     `favorite` (`spread < 0`), `underdog` (`spread > 0`)
   - windows: `3`, `5`, `7`
   - leaf shape: `{"h": hits, "l": losses, "p": pushes, "n": h+l, "pct": round(h/n,3)}`
   - **Per market, drop games missing that line, then take the last N** (so it reads
     "covered X of last N [market] games"). game_log is newest-first already.
   - **⚠️ Scale gotcha:** the existing CFB `pct()` returns 0–100 (`round(100*w/n,1)`).
     For the `splits`/`matchups` jsonb use **0–1** (`round(h/n, 3)`) to match the NFL
     splits jsonb so the app renders both sports identically. Do NOT reuse the ×100 helper here.

2. **`matchups` jsonb** — head-to-head vs each opponent.
   - **CFB has no `cfb_matchup_history` table** (NFL had one). Two options:
     - **Preferred if a cross-season CFB results source is readily available**
       (check `data/model_games.parquet` / a multi-season `cfb_games` for prior
       seasons): build per-opponent last-6-meetings records for `spread`/`moneyline`/`total`,
       keyed by **opponent `team_name`** (CFB keys by full name, not abbr).
       Shape per opponent: `{"meetings": k, "spread": {h,n,pct}, "moneyline": {h,n,pct}, "total": {h,n,pct}}`.
     - **If no cross-season H2H data is on hand, set `matchups = None` for v1**
       and note it — CFB H2H is sparse (teams rarely replay), so this is acceptable.
       Do NOT invent data.

## Exact builder changes (`gen_cfb_team_trends.py`)
- Add the `MKT` / `DIMS` / `WINDOWS` constants and a `compute_splits(game_log)`
  function — copy the logic from `dryrun_wk12_trends.py` (`_dim_ok` + `compute_splits`).
  Pass the **newest-first** game_log (the same list stored as `game_log` = `log[::-1]`).
- Add `"splits": compute_splits(log[::-1])` (and `"matchups": ...` or `None`) to each
  row dict before the DataFrame is built.
- Keep all existing columns untouched.

## DB migration (apply to project `jpxnjuwglavsjbgbasnl`)
```sql
ALTER TABLE public.cfb_team_trends ADD COLUMN IF NOT EXISTS splits jsonb;
ALTER TABLE public.cfb_team_trends ADD COLUMN IF NOT EXISTS matchups jsonb;
```

## Verify (mirror the NFL validation)
- Run the builder; confirm `splits` has 6 markets × 5 dims × 3 windows, leaves are
  `{h,l,p,n,pct}` with `pct` in 0–1, and windows cap to available games.
- Load, then query e.g.
  `select team_name, splits->'spread'->'home'->'5', splits->'team_total'->'overall'->'3' from cfb_team_trends limit 3;`
- Confirm `gen_cfb_team_trends.py` is invoked by `run_cfb_week.sh` (it already builds
  trends — the change is internal, no new cron step needed).

## Notes
- Season-scoped for splits (current season only); matchups cross-season (the exception).
- CFB table keys by `team_name` (full name); NFL keys by `team_abbr`. Keep CFB as-is.
- Commit message style: `feat(cfb): team-trends splits (home/away, fav/dog, 3/5/7) + H2H matchups`.
