# 2026 Forward-Test Harness

`forecast_harness.py` freezes the locked NFL assets (see `LOCKED_MODELS.md`) and produces a weekly
**pick ledger with CLV tracking** so 2026 live results can confirm (or kill) the held-out findings.
This is the consolidation step — no more feature mining; we forward-test what's frozen.

## What it bets

| Rule | Trigger | Bet | Notes |
|---|---|---|---|
| `sides_model` | walk-forward HistGBM, \|P(home covers)−.5\| ≥ .03 | confident side @ **opener** | b14 "base" features; Madden-independent |
| `receiver_over` | a WR/TE Out/Doubtful w/ prior NGS air-share ≥35% | OVER @ opener | standard tier |
| `receiver_over_HC` | same **AND** that player's Madden OVR ≥80 | OVER @ opener | high-conviction (needs Madden) |
| `wind_under` | forecast wind ≥15 mph | UNDER @ opener | best CLV of the set |
| `legacy_fade` | legacy EPA spread prob ≥.80 / ≤.20, **non-primetime** | bet the OPPOSITE side @ opener | model is anti-calibrated at extremes (dose-response to 65%+) |
| `legacy_primetime` | **primetime** game w/ a legacy spread pick | FOLLOW the legacy side @ opener | legacy's primetime specialty (61.8% 2025) |

**Legacy dependency:** the two `legacy_*` rules pull `nfl_predictions_epa` (project `jpxnjuwglavsjbgbasnl`) FRESH each run
via `load_legacy()` and join by `unique_id` (earliest snapshot = pregame). If the legacy model isn't producing
predictions (table empty) the rules simply don't fire — harness still runs. Decision tree per game: **primetime →
follow; non-primetime extreme (≥.80/≤.20) → fade; otherwise no legacy bet** (legacy has no edge in non-PT non-extreme spots).
Both are **single-season (2025) signals** — the whole point of logging them is 2026 out-of-sample confirmation.

## Run modes

```bash
python3 forecast_harness.py --dry-run 2025          # validate on the held-out year (does all 3 steps)
python3 forecast_harness.py --season 2026 --week 3  # weekly: log this week's picks at the opener
python3 forecast_harness.py --grade 2026            # after games finish: fill result + close + CLV
python3 forecast_harness.py --report 2026           # running scoreboard (hit%/ROI/CLV by rule, w/ CIs)
```

Picks are appended to `out/forecast_ledger_<season>.csv` (idempotent by `pick_id` — re-running a week
won't duplicate). Columns: `pick_id, week, game, rule, market, side, open_num, close_num, edge, win,
clv_pts, roi_u`.

## Weekly 2026 workflow

1. **Refresh the data layer** (the cached `data/*.parquet` are a snapshot — repull from Supabase before each week):
   `matchup.parquet` (games + predictions + weather + lines), `odds_consensus.parquet` (must include the
   **opener** for the week's games), `injuries_raw.parquet`, `ngs_receiving.parquet`, `player_stats_def.parquet`,
   `tg.parquet`. Openers should be captured **early in the week** before lines move.
2. `--season 2026 --week N` early in the week → logs picks at the opener.
3. After the slate finishes: `--grade 2026` then `--report 2026`.

## Madden gap (important)

Madden 2026 launch ratings don't exist until ~Aug 2026. Until `data/madden_ratings.parquet` contains
season 2026, the harness runs fine — `receiver_over_HC` simply won't fire and those plays log as standard
`receiver_over`. The sides model never needs Madden. Add 2026 launch ratings (parser: `b16_madden_parse.py`)
when available to re-enable the high-conviction tier.

## Interpreting CLV (the durable proof)

CLV = points the line moved **in our favor** between open and close.
- `sides_model` & `wind_under`: positive CLV is the goal — bet the opener fast (wind got **+2.16** in the 2025 dry-run).
- `receiver_over`: expect **negative** CLV — the total *over-drops* after the injury news, so this play can also
  be taken at the **close** for a better number. (It still won 73–78% in 2025 even bet at the opener.)
Sustained positive CLV + a hit rate over breakeven is the signal that an edge is real, not variance.

## 2025 dry-run (validation baseline)

Train 2018–2024, generate for 2025 (true single-season held-out), graded vs opener:

| rule | 2025 | ROI | CLV |
|---|---|---|---|
| sides_model | 52.1% (n=242) | −0.6% | −0.11 |
| receiver_over | 77.8% (n=18) | +48.5% | +0.03 |
| receiver_over_HC | 73.1% (n=26) | +39.5% | −0.56 |
| wind_under | 62.1% (n=29) | +18.5% | +2.16 |
| legacy_fade | 65.2% (n=23) | +24.5% | +0.80 |
| legacy_primetime | 59.6% (n=57) | +13.9% | −0.03 |
| **ALL** | **57.2% (n=395)** | **+9.2%** | +0.10 |

Reproduces the held-out picture: **totals spots are the moneymaker; the full-slate sides model is marginal**
(2025 was its soft year, as flagged). 2026 live results go in the same ledger to confirm.
