
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
