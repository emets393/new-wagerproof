# NBA / NCAAB Historical Odds Backfill

Raw historical betting-line acquisition from The Odds API for basketball,
mirroring the NFL backfill in `research/nfl-extreme-outcomes/`. Acquired
July 2026 (~2.30M credits spent, 2,543,659 remaining, zero failures).
Raw gzipped JSON parsed to tidy parquet in `data/parquet/` (see below);
Supabase warehousing is a separate later step.

## What was pulled

| Dataset | Seasons | Mechanism | Cost |
|---|---|---|---|
| Full-game h2h/spreads/totals **line movement** | 2022-23 → 2025-26, both sports | Bulk snapshot grid: hourly 09:00–16:00 ET + half-hourly 17:00–23:30 ET (22/day, 30 credits each, whole slate + games 1-3 days out per snapshot) | ~1.07M |
| 1H (h2h/spreads/totals) + team_totals **T-60 close** | 2023-24 → 2025-26, both sports | Per-event call at commence−60min (40 credits/event) | ~700k |
| NBA player props, 10 markets, **T-60 close** | 2023-24 → 2025-26 | Per-event (100 credits/event, ~1,330 events/season) | ~400k |

Key constraints (probe-verified 2026-07-15):
- Featured full-game markets exist back to 2020; **1H/team-totals/props only from 2023-05-03** — the 2022-23 season is impossible for those markets.
- Historical snapshots have 5-minute granularity; per-event requests return the nearest snapshot at-or-before the requested time.
- Empty/404/422 responses cost 0 credits; every response (including unavailable markers) is cached so reruns never re-spend.
- Closing line = T-60 per owner policy (see memory: closing-line-definition).

## Layout

```
grid_backfill.py    # bulk movement snapshots -> data/grid/{sport}/{season}/{date}_{HHMM}.json.gz
event_backfill.py   # per-event T-60 closes   -> data/{h1tt|props}/{sport}/{season}/{event_id}.json.gz
                    # events-day index cache  -> data/events/{sport}/{YYYY-MM-DD}.json.gz
run_all.sh          # full acquisition, value-first order, resumable
backfill.log        # run log
parse.py            # raw JSON -> data/parquet/ tidy tables (grid/h1tt/props)
build_openclose.py  # grid parquet -> per-game x book opener/T-60-close/movement tables
fetch_results.py    # FG + 1H final scores: NBA via ESPN scoreboard (no key),
                    # NCAAB via CBBD (CFBD_API_KEY) -> results_{sport}.parquet
join_results.py     # odds events <-> results spine -> games_{sport}.parquet
fetch_stats.py      # modeling stats: KenPom + CBBD boxscores + balldontlie
name_maps.py        # team-name crosswalks (KenPom -> CBBD verified 367/367)
movement_study.py   # Brief: FG movement signals (MOVEMENT_BRIEF1.md)
kenpom_edge_study.py# Brief: KenPom fanmatch vs market (KENPOM_BRIEF1.md)
h1tt_study.py       # Brief: 1H/TT relationship signals (H1TT_BBALL_BRIEF1.md)
build_ncaab_features.py  # leak-safe game-level feature table (90 cols)
ncaab_totals_model.py    # walk-forward FG totals model (NCAAB_MODEL_BRIEF1.md)
ncaab_h1tt_model.py      # walk-forward 1H + TT models (NCAAB_H1TT_MODEL_BRIEF1.md)
build_player_flags.py    # role/absence flags per team-game (player_flags_*.parquet)
availability_study.py    # absences vs market (AVAILABILITY_BRIEF1.md) <- REAL EDGE
regression_study.py      # recent form / 3P luck / streaks (REGRESSION_BRIEF1.md)
h2h_study.py             # matchup history vs close (H2H_BRIEF1.md)
```

## Research findings so far (2026-07-16, briefs in repo)

**START AT [BBALL_SIGNALS.md](BBALL_SIGNALS.md)** — the locked signal vault
(validated ladders S1-S4, tracking list, dead list, exact definitions).


All no-model signal families (movement follow/fade, KenPom edges, 1H/TT
relationships), v1 models (s2d boxscore + KenPom features; FG/1H/TT targets),
regression-to-the-mean, and NCAAB H2H all FAIL to beat the T-60 close.
Books shade prices, not lines; recent form is pre-regressed into lines.

**THE ONE REAL EDGE (AVAILABILITY_BRIEF1.md): NCAAB fade-team-ATS when its
top-rebounding regular is freshly out — 57.8% / +10.4% ROI, n=751, positive
all 4 seasons, dose-response (>=2 regulars out: 67%/+28%).** NBA prices
absences fully. Production needs a pregame injury/lineup feed (covers.com).

NBA tracking candidates: H2H ATS anti-persistence (back dominated home team,
+5.9%), H2H totals tendency persistence (+1.4%), big-out game OVER (+4.3%),
small-dog ML steam pockets. Full details in the eight *_BRIEF1.md files.

## Modeling stats (`data/parquet/`, acquired 2026-07-16)

| Table | Source | Contents |
|---|---|---|
| `kenpom_archive_daily` | KenPom `archive?d=` | 213k rows: DAILY dated (leak-safe) AdjEM/AdjOE/AdjDE/Tempo + ranks, every team, 4 seasons |
| `kenpom_fanmatch` | KenPom `fanmatch?d=` | 23k rows: KenPom's own historical game predictions (score preds, win prob) |
| `kenpom_{four_factors,height,pointdist,misc_stats,teams,conf_ratings}` | KenPom per-season | season-end reference (leaky in-season — prefer archive for features) |
| `cbbd_team_box` / `cbbd_player_box` | CBBD `/games/teams` `/games/players` | 52k team-games / 620k player-games; joins results via `gameId`==`cbbd_id` (100%) |
| `bdl_games` / `bdl_player_box` / `bdl_player_advanced` | balldontlie | 5.3k games (quarter scores), 182k player boxscores, 139k advanced (pace/ratings/eFG) |

KenPom API: `https://kenpom.com/api.php?endpoint=X` (`Authorization: Bearer $KENPOM_API_KEY`);
endpoints: ratings, archive (d= or preseason=true&y=), four-factors, pointdist,
height, misc-stats, fanmatch (d=), conf-ratings, teams, conferences.
balldontlie: 600 req/min tier, `BALLDONTLIE_API_KEY`, BDL `date` = ET date and
BDL `season` = start year. CBBD stats endpoints need the same month/week
chunking as games (season-level responses silently truncate).

Both scripts: `--dry-run` (planned calls + credit ceiling), `--test` (single
call with live cost printout). Hard abort if `x-requests-remaining` drops
below 2.3M (protects MLB's in-month usage). API key read from repo-root
`.env.local` (`ODDS_API_KEY`).

## Parsed tables (`data/parquet/`, gitignored)

Built by `parse.py all` then `build_openclose.py`:

| Table | Grain | Rows |
|---|---|---|
| `grid_{sport}_{season}` | snapshot × game × book, FG ml/spread/total | ~7.2M total |
| `h1tt_{sport}_{season}` | game × book, 1H ml/spread/total + home/away team totals (T-60 close) | ~159k |
| `props_nba_{season}` | game × book × market × player (T-60 close; Over/Under paired per line) | ~3.1M |
| `openclose_{sport}_{season}` | game × book: per-market opener + T-60 close + `spread_move`/`total_move` + cross-book consensus medians | ~355k (28k games) |

Results spine: `games_{sport}.parquet` — one row per odds event_id with FG +
1H scores (NBA 99.7% matched via ESPN, NCAAB 99.4% via CBBD; matching =
normalized names + nearest same-matchup tip within 36h, neutral-site flips
handled). `ncaab_team_mapping.parquet` is an export of the Supabase table;
note the table's Southern Indiana row wrongly carries `southern-jaguars` —
worked around via `NCAAB_OVERRIDES` in join_results.py. Base rates verified:
home covers ~50%, overs ~50.6%, 1H < FG in 100% of games.

Conventions: American odds; spread points from the HOME team's perspective;
opener = book's first grid sighting per market; close = last snapshot ≤ T-60
(closing-line policy — see memory: closing-line-definition). In-play grid rows
(`commence_time <= timestamp`) are dropped. Grid covers games up to ~3 days
ahead of each snapshot, so early-week openers for weekend NCAAB games are
captured. Sanity-checked: NBA ~1,340 and NCAAB ~5,800 games/season, median 10
books/game, 99.9% close coverage, movement distributions centered on zero.
