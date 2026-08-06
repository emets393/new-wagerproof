# Hall of Fame Game Dossier (built 2026-08-06)

`hof_study.py` (+ cache `data/hof_games.parquet`). One game/year — a scouting dossier,
NOT a backtest. n=14 played games with closing lines (2008-2025) + the 2026 game.

## Sources
- **Lines 2022-2026**: The Odds API `americanfootball_nfl_preseason` (historical
  snapshots at T-45; live for the current game). History wall = 2022.
- **Lines 2008-2021**: web-archive recovery (VSIN HOF results chart — oracle-checked
  against final scores — + Action Network, DonBest archive, OddsShark, FanDuel,
  contemporaneous previews). Multi-source confirmed except 2013 + 2017/2018 totals
  (single-source). Hardcoded in `RECOVERED_LINES` with per-year source notes.
- **Results/starters**: ESPN seasontype=1 week=1, Canton venue filter (2008+;
  earlier years not served). 2016 (field paint) + 2020 (COVID) cancelled.
- **Dimensions**: nflverse games (prev-season records, new-HC flags), players_xwalk
  (rookie_season for QB rookie flags).

## Headline reads (n=14 with lines)
- **Favorites ~6-7-1 ATS, overs 7/14** — both coin flips. The 2022-25 "4 straight
  overs" is noise sitting on a balanced longer sample (avg line 33.2, avg actual 32.5).
- **Home team 10/14 SU (71%)** and roughly 8-5-1 ATS — the one lean in the sample.
  "Home" in Canton is nominal (assigned), which makes it stranger; n=14 caveat applies.
- **Previous-season records are irrelevant**: better prior team 8/14 SU. Starters sit;
  last year's roster quality doesn't take the field.
- **Rookie QBs do NOT start this game**: the starter proxy (first-listed passer) is a
  veteran #2/#3 in every observed year (Kyle Allen, Kellen Mond, Brett Rypien twice,
  RGIII...). The user-hypothesized "rookie QB started" cell is structurally ~empty;
  rookies appear in relief. Any rookie-QB angle must key on SNAPS, not starts.
- **New-HC team 3/4 SU** when exactly one side has a new coach (motivation story;
  n=4, anecdote tier).
- Spreads live in a tight band: 13 of 14 closed ≤3.5; largest ever = WAS -4.5 (2008).
  Totals band 30.5-37.0.

## Verdict
No bettable signal at n=14 — this is content/context material (graphics, article,
"most bet-on exhibition" narratives) and a seed for a broader PRESEASON study, where
n is ~65 games/season and the same collectors (preseason sport key) work unchanged.
