# CFB Outliers Trends — build prompt (mirror the NFL data layer)

Build the CFB data for the Outliers **Trends** page, mirroring what was just built for NFL.
**Only TEAMS and COACHES** for CFB (we have no CFB referee or player-prop data — skip both).
Same betting markets and the same `splits`/`matchups` jsonb shapes so one app code path renders
both sports.

**Templates to mirror (same repo):**
- Team: `research/nfl-extreme-outcomes/dryrun_wk12_trends.py` (the `splits` + `matchups` it now produces)
- Coach: `research/nfl-extreme-outcomes/gen_nfl_coach_trends.py`

This SUPERSEDES the earlier `CFB_TEAM_TRENDS_SPLITS_PROMPT.md` (that one was team-only and predates coaches).

---

## 1. CFB TEAM trends — extend the existing `cfb_team_trends`

`cfb_team_trends` + `gen_cfb_team_trends.py` already produce overall season records + `last5_*` +
a `game_log` jsonb whose per-game entries already carry `is_home`, `spread` (team's line, sign =
fav/dog), and the result letters `su`/`ats`/`ou`/`tt`/`h1_ats`/`h1_ou`. So splits are pure aggregation.

Add two jsonb columns (migration):
```sql
ALTER TABLE public.cfb_team_trends ADD COLUMN IF NOT EXISTS splits jsonb;
ALTER TABLE public.cfb_team_trends ADD COLUMN IF NOT EXISTS matchups jsonb;
```
- **`splits`** = `{market: {dimension: {window: {h,l,p,n,pct}}}}`
  - markets (6): `spread, moneyline, total, team_total, h1_spread, h1_total`
    (map game_log fields: spread→`ats`, moneyline→`su`, total→`ou`, team_total→`tt`, h1_spread→`h1_ats`, h1_total→`h1_ou`; hit = cover/win/over)
  - dimensions (5): `overall, home, away, favorite, underdog`  (favorite = spread<0, underdog = spread>0)
  - windows: `"3","5","7"`; per market drop games missing that line, take the last N
  - leaf: `{h, l, p, n: h+l, pct: round(h/n, 3)}`  — **pct is 0–1** (NOT the existing CFB `pct()` ×100)
  - season-scoped (current season), same as NFL team trends.
- **`matchups`** = `{opp: {meetings, spread:{h,n,pct}, moneyline:{...}, total:{...}}}` — cross-season,
  last ~6 meetings vs each opponent. (Add `team_total`/`h1_*` only if you have that history cross-season; FG is fine.)
- Copy `_dim_ok` + `compute_splits` + `compute_matchups` from the NFL team builder.

CFB note: `cfb_team_trends` keys by **`team_name`** (full names) — keep it. Matchup opponents keyed by team_name.

---

## 2. CFB COACH trends — NEW table `cfb_coach_trends` (mirror `nfl_coach_trends`)

Head coaches only, **CAREER** data, windows **5/10/15**. Build per-coach career game logs from the
CFB data you already use (results + closing lines) with the **head coach per (team, season)** sourced
from CFBD (`/coaches`) joined to each team-game.

```sql
create table if not exists public.cfb_coach_trends (
  coach text not null, current_team text, career_games integer,
  first_season integer, last_season integer,
  through_season integer not null, through_week integer not null,
  splits jsonb, matchups jsonb, market_coverage jsonb, recent_game_log jsonb,
  updated_at timestamptz default now(),
  primary key (coach, through_season, through_week)
);
alter table public.cfb_coach_trends enable row level security;
create policy "public read cfb_coach_trends" on public.cfb_coach_trends for select using (true);
```
- **`splits`**: same shape, **6 markets**, **windows 5/10/15**, dimensions (9):
  `overall, home, away, favorite, underdog, division, non_division, primetime, regular`.
  - **CFB "division" = CONFERENCE game** (use CFBD's `conferenceGame` flag): conference game →
    `division` key, non-conference → `non_division`. **Keep the jsonb keys literally `division`/
    `non_division`** so the app shares one code path (the app will just label them "Conference"/
    "Non-conference" for CFB).
  - **primetime** = kickoff hour >= 19:00 ET (night game), same rule as NFL.
- **`matchups`**: coach's CAREER record vs each opponent team (keyed by team_name), per market.
- **`market_coverage`** = `{market: 'career'|'<year-range>'}` — set FG markets (spread/moneyline/total)
  to the deepest history your CFB lines go back to (e.g. CFBD lines ~2013+ → label "career" or the
  actual range), and team_total / h1_spread / h1_total to whatever limited range your event-odds cover
  (e.g. "2024-2025"). Flag honestly so the site can note limited history — exactly like NFL coaches.
- `current_team` = coach's most recent game's team (maps team→current HC; if multiple coaches share a
  current_team, pick the one with the greatest `last_season`).
- Copy the structure of `gen_nfl_coach_trends.py`; only the data source (CFBD instead of nflverse) and
  the conference-as-division mapping differ.

---

## 3. Wire + verify
- Add both steps to `run_cfb_week.sh` (team trends already runs there; add the coach builder).
- Validate like NFL: row counts; `splits` has the right markets × dimensions × windows with `pct` in
  0–1; windows cap to games available; matchups reciprocal where both teams have rows. Spot-check a
  current matchup's two teams + two coaches.
- Sanity-check the spread sign against your known-correct CFB grading (ATS hit rate ~50%, not inverted).

## 4. Out of scope (no data)
- **No CFB referee trends, no CFB player-prop trends.** Teams + coaches only.
