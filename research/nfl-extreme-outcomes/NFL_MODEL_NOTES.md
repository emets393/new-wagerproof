
## ⛔ The wk4-2026 flat-board incident (owner question, 2026-10-02) — ROOT CAUSE + FIX

**Symptom:** Buffalo and Seattle were both 7-point home favourites and the model predicted
~1-point pick'ems, against two teams (NE 1-2, LAC 0-3 and 0-3 ATS) the market had priced down.
Across the whole wk4 board the model sat at MAE 5.09 pts vs the market with correlation 0.37.

**It was not the model.** The frozen `sides_models_2026.pkl` was fine. It was being fed a
different quantity than it was fit on.

`nfl_pregame_advanced_team_week` and `nfl_pregame_ftn_team_week` supply the 21 `net_*_s2d`
matchup features in `forecast_harness.build()` BASE. Their writers' `build_snapshot()` /
`aggregate_team_week()` keep plays strictly before (season, week) **across whatever seasons are
loaded** — so the stat is "cumulative over the loaded history", NOT within-season. The backfill
that wrote 2018-2025 loaded every season in one call, so the stored history is
cumulative-since-2018. The three weekly upserts passed `load_pbp([season])` and silently wrote a
this-season-only number under the same column names.

Signature: `off_drives_seen` runs 12.5 → 1,527 continuously 2018→2025, then **resets to 11.1 in
2026**. The derived nets came out **2.4-7.2x wider** than their training distribution, with
**5.4 of 21 per game outside the training 1st-99th percentile**. A tree fed an out-of-scale value
doesn't see a strong team, it falls into whichever leaf a handful of extreme franchise-averages
carved out — which is why BUF sitting 87th-percentile in early-down rush net SUBTRACTED 3.8 pts
from its own margin.

**Fixed upstream** (cfb_automation `9f9ef70`), not by retraining:

| | before | after |
|---|---|---|
| nets outside training 1-99 pct, per game | 5.4 of 21 | **0 of 21** |
| NE @ BUF (market BUF -7) | BUF by 0.8 | **BUF by 4.5** |
| LAC @ SEA (market SEA -7) | SEA by 1.3 | **SEA by 5.5** |
| MAE vs market, wk4 board | 5.09 pts | **3.37 pts** |
| correlation with market | 0.372 | **0.714** |

It still disagrees where it has a view — MIN -13.6 into a -10.5, BAL faded from -11.5 to -6.4 —
which is the point of an originator. 2026 wks 2-4 were re-upserted through the fixed path and the
board regenerated. **Published wk2-3 pick cards were deliberately NOT rewritten**: that record was
earned on the broken inputs and backdating it would launder the result.

Do NOT "fix" this class of bug by dropping the features. Walk-forward 2023-25 graded at the opener:
dropping the 21 nets costs **55.3% → 52.8%** on the classifier and **57.7% → 52.7%** on
confluence. They carry real signal — they were just being served a different statistic.

**The general law:** a feed whose aggregation window is implied by *what the caller loads* will
drift the moment two callers load different windows. Backfill and weekly writer must load the same
window, and `off_drives_seen`-style counters are the canary — check one before trusting a feed.

## Dose response of the production sides models (owner question, 2026-09-18) — `dose_response.py`
Walk-forward 2021-25 (openers 2023+), exact harness recipe (train < season, weeks 4+).
**Classifier (the bet signal) is a HUMP, not a slope.** Confidence vs opener: .03-.06 → 50.0% (fires in
production, loses −4.5%), .06-.10 → 59.5%, .10-.15 → 57.9%, .15+ → 55.6%. Vs close the .15+ bucket is
50.4% (42% in 2021, 48% in 2023): the model's most confident games are its worst.
**Regression (confirmation layer) INVERTS at the extreme:** |gap| ≥7 vs close = 38.9% pooled, losing in
all five seasons; vs opener 50%. Confluence helped 2024-25 (62/68%) and hurt 2023 (45.8% vs 54.3% without).
Weeks 1-3: classifier .06-.10 = 43.5%; regression ranking inverted. Rules: raise the display floor from
.03 to .06, do not badge by confidence above .10, never surface a regression gap ≥7 as a lean, suppress
weeks 1-3.
**WIRED 2026-09-18:** `nfl_slate_games_build.py` — `PLAY_CONF = 0.06` (was `CONF = 0.03`) gates the
header pick and the spread card's tier; `REG_CAP = 7.0` makes a regression gap ≥7 display-only. The
card tier is now the classifier's confidence (`med`, `high` with an aligned spot, `mammoth`), not the
regression magnitude, which never ranked outcomes. `refresh_nfl_slate_lines.py` keeps a NEUTRAL header
NEUTRAL (it used to re-derive a pick from the regression alone on every line refresh, which is why every
game showed one) and applies the cap.

## Predict-the-close (owner ask, 2026-09-18) — `exp_predict_close.py`, `exp_predict_close_clean.py`
Target = close − open (home spread), walk-forward, graded on (a) share of games the line moved toward
our side, (b) CLV points, (c) win vs the OPENER at -110.
⚠ **LEAK FOUND in the harness BASE:** `home_fav`, `abs_spread`, `home_dog_7_10`, `away_dog_7_10` are
computed from `m.home_spread` = the nflverse CLOSING line in history (the serve week gets whatever line
the schedule pull carries). A move model with them reads the close (r=.70, "our way" 94-99%). With them
rebuilt from the OPENER: r=.14/.27 (2024/25).
  clean, |pred move|≥1.0: n=112, line our way 73%, CLV +0.94 pts, win vs open 51.4% (47.4 / 56.0)
  clean, |pred move|≥1.5: n=37,  our way 70%, CLV +0.82, win vs open 55.6%
The production regression's edge alone: leaky r=.29/.42, our-way 72-88% → clean r=.07/.15, our-way 47/79%.
Sides classifier vs opener at conf≥.06, leaky 57.4% → clean 56.2% (pooled n≈530): the WIN record barely
moves; the CLV story was inflated. TODO: replace the four features with open-derived ones in
`forecast_harness.build()` BASE and re-freeze `sides_models_2026.pkl` (train/serve consistency).
**FIXED 2026-09-18:** the four line-derived features are out of `forecast_harness.build()` BASE (54
features; the NFL sides model is now an ORIGINATOR like CFB's). `data/sides_models_2026.pkl` re-frozen
(previous copy: `sides_models_2026.pkl.pre_originator_2026-09-18.bak`). Sides record vs opener at
conf≥.06 unchanged within noise (56.2% pooled 2023-25); the CLV/predict-the-move claims are the clean ones.
Clean-model dose response (re-run 2026-09-18 after the fix, vs opener): .03-.06 → 54.2%, .06-.10 → 56.8%,
.10-.15 → 58.2%, .15+ → 54.7% (pooled 2023-25). Same hump; the .06 floor and the no-ranking-above-.10 rule stand.
