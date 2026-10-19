# NBA signal lifecycle — back-test, live season record, rollover

> Backend shipped 2026-10-19 (cfb_automation `scripts/cfb/nba_signal_grader.py`, `sql/nba_signal_lifecycle.sql`,
> chained into the `nba-hoopr-nightly` Render cron). Owner standard: every signal is born with its back-tested
> record and ROI, the current season's record is kept automatically, and the season folds into the back-test
> after the Finals. This doc is what the apps read. Same pattern is the target for the other sports.

## Where the records live

Both defs tables on the **CFB Supabase project** carry the same columns:

| table | rows |
|---|---|
| `nba_signal_defs` | team signals: situational (11), model (`nba_originator_spread` / `_total` / `_h1_spread`), confluence (`nba_model_signal_confluence`, `nba_signal_stack`) |
| `nba_prop_defs` | prop rules: `nba_cold_line_raised_under`, `_big_under`, `nba_player_ref_over`, `nba_player_ref_under` |

| column | meaning |
|---|---|
| `record_text` | the rendered back-test, wins first from the bet's side ("364-234 (60.9%) at the best price, 2023-24 to 2025-26 …"). Unchanged contract. |
| `backtest_wins` / `backtest_losses` / `backtest_pushes` | the back-test as numbers |
| `backtest_roi` | percent, at the price the research graded at (−110 when the brief quoted none) |
| `backtest_seasons` | text, e.g. "2020-21 to 2025-26"; the rollover appends ", 2026-27 live" |
| `backtest_through` | hoopR END-year of the last season in the back-test (2026 = 2025-26) |
| `season_label` | the season the `season_*` counters cover, "2026-27" |
| `season_wins` / `season_losses` / `season_pushes` / `season_roi` | this season, graded live |
| `season_record_text` | rendered: "4-1 (80.0%) in 2026-27, +52.7% ROI" or "no graded bets yet in 2026-27" |
| `season_updated_at` | when the grader last wrote |

**Render both strings on every signal surface**: the back-test is the evidence, the season line is the live
scoreboard. Never add them together in the UI; the rollover does that once a year.

## How a flag is graded

`nba_slate_flags` rows gain `result` (`win` | `loss` | `push` | `void`), `actual_value` (final home-minus-away
margin for spreads, final total for totals; first-half values for `h1_*` markets) and `graded_at`. The grader
scores each flag at the line it was written with (`bet_line`, `bet_team` / `bet_direction`), full-game scores
from `nba_schedule`, first-half scores from the hoopR schedule linescores, price `grade_price` (−110 default).

Prop flags are graded through the board: `nba_props_slate.py` writes `actual_value` / `result` on each
`nba_slate_props` row after the game; the grader treats every key in that row's `flags` as one ticket on the
def's `bet_direction` at the board's best price for that side.

Timing: the grader runs after the hoopR pull at 5:30am ET, so yesterday's flags are graded and the season
counters updated before the 9:20am model run. A game with no final yet is skipped and picked up the next morning.

## Adding a signal (the standard)

1. Put the def in the writer's `DEFS` with `**backtest(wins, losses, "seasons", through, roi=…)` from
   `nba_model.common` — the back-test must come from a brief, graded at the close (or the T-60 price for props),
   with the record from the bet's side.
2. Write flags with the fields the grader needs: `market`, `bet_team` or `bet_direction`, `bet_line`
   (team) or a `flags` key on the board row (props).
3. Nothing else. The grader picks the key up the next morning; the season columns start at 0-0.

## End of season

`python3 scripts/cfb/nba_signal_grader.py --rollover` (June/July): folds `season_*` into `backtest_*` (ROI combined
by ticket count), sets `backtest_through`, appends the season to `backtest_seasons`, zeroes the counters under the
next `season_label`. Idempotent per def. `record_text` is NOT rewritten by the rollover; the writer's `DEFS` is the
source for that string and should be updated by hand to quote the new combined record.

## Reading pattern

```sql
select signal_key, display_name, record_text, season_record_text, backtest_roi, season_roi
  from nba_signal_defs order by signal_key;
select signal_key, record_text, season_record_text from nba_prop_defs;
```
