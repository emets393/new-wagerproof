# MLB Outliers Trends — build prompt (mirror the NFL/CFB data layer, MLB-flavored)

Build the MLB **team** data for the Outliers Trends page, same `splits`/`matchups` jsonb shapes as
NFL/CFB so one app code path renders all sports. **TEAMS ONLY** for MLB — no managers, no player props
(can add later). **Current season only** (MLB has ~162 games, so a single season is plenty of sample).

**Template to mirror (same data warehouse, NFL repo):**
`research/nfl-extreme-outcomes/nfl_slate_trends.py` — copy its `splits`/`matchups` mechanics
(`_dim_ok`, `compute_splits`, `compute_matchups`); only the markets, dimensions, and data source change.

---

## 1. Markets (MLB equivalents — include the F5 ones you have data for)
Map each to your results/odds data; **hit** = win / cover / over:
- `moneyline` — team won the game
- `run_line` — team covered the run line (±1.5; favorite covers by winning ≥2, dog covers by losing ≤1 or winning)
- `total` — game total runs went OVER
- `team_total` — the team's runs went OVER its team total
- `f5_moneyline` — team led after 5 innings (First-5; ties → push)
- `f5_run_line` — team covered the F5 run line (±0.5) *(include if you have it)*
- `f5_total` — First-5 total runs went OVER

(F5 = first five innings, the baseball analog of football's "1H". Derive from inning-by-inning scores.)

## 2. Dimensions (all CURRENT SEASON)
`splits` = `{market: {dimension: {window: {h,l,p,n,pct}}}}`, **windows 5/10/15**, **pct 0–1**
(`round(h/n,3)`); per market drop games missing that line then take the last N. Dimensions:
- `overall`
- `home`, `away`
- `favorite`, `underdog` — by **moneyline sign** (favorite = team moneyline < 0; skip if pick'em)
- `division`, `non_division` — opponent in the **same MLB division** (see map below)
- `day`, `night` — by first pitch: **night = first pitch >= 6:00pm local** (or use a day/night field if your
  data has one), else day
- `series_game_1`, `series_game_2`, `series_game_3`, `series_game_4` — which game of the current series
  (see §3)

Plus **`matchups`** jsonb = `{opp: {meetings, moneyline:{h,n,pct}, run_line:{...}, total:{...}, ...}}` —
the team's record vs each opponent **this season** (the "opponent specific" dimension).

## 3. Series-game-number derivation
A **series** = consecutive games between the same two teams (typically same venue, consecutive days).
For each team, order its games by date; start a new series whenever the opponent changes from the
previous game; number the games within each run 1,2,3,4. The `series_game_N` dimension = the team's
record in the Nth game of its series (e.g. "game 1 of a series" = all series openers). 4-game series are
less common, so `series_game_4` will have a smaller sample (windows cap to what's available — fine).

## 4. MLB division map (division game = same division)
AL East: BAL BOS NYY TBR TOR · AL Central: CWS CLE DET KC MIN · AL West: HOU LAA ATH SEA TEX
NL East: ATL MIA NYM PHI WSH · NL Central: CHC CIN MIL PIT STL · NL West: ARI COL LAD SDP SFG
(Map to your own canonical team keys; the point is same-division → `division`, else `non_division`.)

## 5. Table `mlb_team_trends` (create or extend)
```sql
create table if not exists public.mlb_team_trends (
  team text not null, team_name text, season integer not null,
  through_date date, games integer,
  splits jsonb, matchups jsonb, recent_game_log jsonb,
  updated_at timestamptz default now(),
  primary key (team, season)
);
alter table public.mlb_team_trends enable row level security;
create policy "public read mlb_team_trends" on public.mlb_team_trends for select using (true);
```
Recompute **daily** (delete-then-insert for the current season); `through_date` = the as-of date (only
games already completed before the slate). Key by your canonical team identifier (abbr or name — keep
consistent with how the MLB slate identifies teams so the app can join).

## 6. App / slate dependency (so dimension-filtering works)
The Outliers page shows only the dimension side matching the **upcoming** game. Make sure the MLB slate
the app reads exposes, per upcoming game: home/away, the **moneyline** (for favorite/underdog), the
**opponent** (for the matchup + division), **day/night**, and the **series game number** of that upcoming
game (which game of the current series it is). If the series number isn't already on the slate, add it
(same consecutive-opponent logic) so the app can pick `series_game_N`.

## 7. Verify (mirror NFL/CFB)
- Row counts (30 teams); `splits` has the right markets × dimensions × windows, `pct` in 0–1, windows
  cap to games available; matchups reciprocal where both teams have rows.
- Sanity-check the run_line/moneyline sign against your known-correct MLB grading (favorites win ~55-60%
  SU; ATS/run-line ~.500 — not inverted).
- Wire the builder into the MLB daily runner.

## 8. Out of scope
- No MLB managers, no MLB player props (teams only for now).
