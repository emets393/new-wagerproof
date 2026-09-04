# 24 — Line-Movement Archive (NFL + CFB)

Prompt/spec for closing the gaps that stop the Line Movement widget from showing real movement
across every betting market. Warehouse project: `jpxnjuwglavsjbgbasnl`.

---

## PROMPT FOR CLAUDE — copy from here down

We need every betting-line pull archived so the app can chart line movement for **every market**,
not just the current number. Most of the archive already exists — the job is to close the gaps and
stop the places where history is being destroyed.

### What already works (verified by direct query — do not rebuild these)

The web consensus chart reads the derived, game-keyed `nfl_line_movement` and
`cfb_line_movement` views. The tables below are raw per-book capture inputs and are
not valid drop-in consensus chart sources.

| Sport | Markets | Table | Timestamp col | Writer | Cadence |
|---|---|---|---|---|---|
| NFL | FG spread/total/ML + 1H + team totals | `nfl_historical_odds` | `snap_ts` | `research/nfl-extreme-outcomes/live_odds.py` | `nfl-live-odds-hourly` cron |
| CFB | FG spread/total/ML | `ncaaf_odds_history` | `snapshot` | `research/cfb-model/live_odds_cfb.py` | `cfb-live-odds-hourly` cron |
| CFB | 1H + team totals | `ncaaf_event_odds` | `snap_ts` | `research/cfb-model/live_odds_cfb_1h.py` | same CFB cron |

These are append-only, one row per book per snapshot, and `live_odds.py` already requests the full
market set (`spreads,totals,h2h,spreads_h1,totals_h1,h2h_h1,team_totals`). Crons are defined in
`render.yaml`.

Current data state as of 2026-07-29:
- `nfl_historical_odds` season 2026: 1196 rows, only **2 distinct `snap_ts`** (07-26, 07-29). `tt_*`
  and `h1_*` are 100% null.
- `ncaaf_odds_history` season 2026: 1322 rows, latest snapshot 07-29.
- `ncaaf_event_odds`: **0 rows, ever.**

### Gap 1 — the crons don't run in the offseason

`render.yaml`:
- `nfl-live-odds-hourly` → `schedule: "0 * * 9-12,1-2 *"` (Sep–Feb only)
- `cfb-live-odds-hourly` → `schedule: "0 * * 8-12,1 *"` (Aug–Jan only)

July is month 7, so neither runs right now. The only 2026 snapshots exist because someone ran them
by hand. Week 1 lines are already posted and moving, and we're capturing none of it.

Change the schedules to run year-round, and move the cost control into the scripts' existing cadence
gate instead of the cron month filter. Suggested: keep hourly in-season; in the offseason
(no game within ~10 days) drop to once or twice a day. `live_odds.py` already has `SET_HOURS =
(8, 14, 20)` and an idle cost-guard that makes zero paid calls when nothing qualifies — extend that
logic rather than adding a new mechanism. Confirm the Odds-API quota math before/after.

### Gap 2 — `nfl_lines_from_odds.py` destroys history

`research/nfl-extreme-outcomes/nfl_lines_from_odds.py` line ~117:

```python
requests.delete(f"{SUPA}/nfl_betting_lines?season_year=eq.{SEASON}", headers=HDR, timeout=60)
for i in range(0, len(out), 5):
    resp = requests.post(f"{SUPA}/nfl_betting_lines", ...)
```

Every run wipes the whole season and reinserts one consensus row per game, so `nfl_betting_lines`
can never hold more than a single snapshot. It also stamps a fresh `as_of_ts` on data that may not
have changed.

`nfl_betting_lines` is a derived slate-input table (it feeds `nfl_input_values_view` and fires the
`apply_betting_line_to_schedules` AFTER-INSERT trigger), so it's arguably fine for it to hold only
"current." Decide explicitly and document it:

- **Option A (preferred):** keep it current-only, but replace delete-then-insert with an upsert
  keyed on `training_key` so the trigger doesn't re-fire ~32 table updates per row per run, and so
  concurrent readers never see an empty table mid-run.
- **Option B:** make it append-only too (unique on `training_key, as_of_ts`, skip the insert when
  every market is unchanged from the latest row).

Either way the app's movement chart should read `nfl_line_movement` by slate `game_id`, not this
table or a client-side median of `nfl_historical_odds`. Note that in the DB the historical
(Jan 2026) rows carry real hourly per-book series plus VSiN bets/handle splits, so whatever you
choose must not delete those older seasons.

### Gap 3 — CFB 1H and team totals have never been captured

`ncaaf_event_odds` is empty. `live_odds_cfb_1h.py` requests
`MARKETS = "team_totals,spreads_h1,totals_h1,h2h_h1"` and writes to that table, and it is wired into
the `cfb-live-odds-hourly` cron's start command, so it has presumably never had a successful run.
Investigate: run it with `--force` in slate first, confirm the parse, check for a schema mismatch
or a silently swallowed error, then do a real `--write` and verify rows land.

### Gap 4 — the true opener is overwritten

`nfl_slate_feed.fg_spread_open` / `fg_total_open` and the `cfb_slate_feed` equivalents currently
equal their `_close` counterparts for **100%** of 2026 games. The slate builders recompute both from
the same current pull each run, so the real opening number is lost.

Set `fg_*_open` **once**, on first sighting of a game, from the earliest archived snapshot
(`MIN(snap_ts)` / `MIN(snapshot)` for that game in the odds archive), and only ever update the
`_close` side on later runs. Backfill the existing 2026 rows from the archive where a genuinely
earlier snapshot exists. Relevant builders: `research/nfl-extreme-outcomes/nfl_slate_games.py`
(writes `fg_spread_open=r.open_spread, fg_spread_close=...`) and
`research/cfb-model/gen_cfb_slate_feed.py`.

### Gap 5 — archive hygiene

The archive is the product now, so treat it that way:
- Confirm indexes supporting the app's read pattern: NFL `(season, home_team, away_team, snap_ts)`;
  CFB `(season, home_team, away_team, snapshot)`. `ncaaf_odds_history` is already at 1.3M rows.
- Add a dedupe guard so a snapshot identical to the previous one for a given game+book is skipped,
  or make the app collapse consecutive identical values. Hourly capture of a line that hasn't moved
  is the common case in the offseason and will dominate the table otherwise.
- Decide a retention policy for per-book granularity on completed seasons (e.g. keep every snapshot
  for the current season, thin older seasons to open/close plus daily).

### Gap 6 — `cfb_line_movement` times out on a cold cache (highest user impact)

Measured 2026-07-29: the query the widget actually issues,

```sql
select snap_ts, n_books, fg_spread_home, fg_total
from cfb_line_movement
where game_id = 401856662 and season = 2026
order by snap_ts;
```

fails roughly half the time with `57014 canceling statement due to statement timeout`. Eight
consecutive runs gave four timeouts at ~3.2s each, then four successes at **under 10ms**. It is
purely cold-cache: the view aggregates the 1.3M-row `ncaaf_odds_history` and there is no index
supporting the `game_id` lookup, so the first read scans, and every read after that is served from
cache. `nfl_line_movement` is fine — `nfl_historical_odds` is far smaller.

User-visible symptom: the game detail page renders the market with no chart, because the app
correctly refuses to invent a series it could not load. The web client now retries up to five times
with backoff, which recovers the chart but can cost ~10s on a cold view. That is a band-aid.

Fix server-side, in preference order:

1. Index the archive for the view's join/filter path, e.g.
   `create index concurrently on ncaaf_odds_history (season, game_id, snapshot);`
   plus whatever column the view uses to map the Odds-API event id onto the ESPN `game_id`.
2. If the view's remap makes an index insufficient, materialize it:
   `create materialized view cfb_line_movement_mv as select * from cfb_line_movement;`
   with `create unique index on cfb_line_movement_mv (game_id, snap_ts);` and a refresh
   (`refresh materialized view concurrently`) on the same schedule as the odds cron.
3. Verify with `explain (analyze, buffers)` that a single-game lookup is an index scan, not a
   sequential scan over the archive.

Target: p99 under 200ms for a single-game lookup, so the client retry never has to fire.

### Acceptance criteria

1. Both odds crons run year-round with a defensible offseason cadence, and quota impact is stated.
2. A given NFL and CFB game accumulates multiple distinct `snap_ts` / `snapshot` values across a day.
3. `ncaaf_event_odds` has rows, and CFB 1H/TT are queryable per snapshot.
4. `nfl_betting_lines` is never empty mid-run, and older seasons' hourly history is intact.
5. `fg_*_open` reflects the earliest archived line, not the current one, for both sports.
6. A single-game `cfb_line_movement` lookup returns in well under a second on a cold cache, with
   no `57014` timeouts across 20 consecutive cold reads.
7. Write down the final source-of-truth mapping (sport × market → table + timestamp column) and
   update `.claude/docs/agents/23_NFL_CFB_2026_DATA_MAP.md`, whose current "Exception (keep)" note
   still points the Line-Movement widget at `nfl_betting_lines`.

Do not modify the deprecated `wagerproof-mobile/` app. The web Line Movement widget reads
`nfl_line_movement` / `cfb_line_movement`; raw archives remain available for per-book ML work.
