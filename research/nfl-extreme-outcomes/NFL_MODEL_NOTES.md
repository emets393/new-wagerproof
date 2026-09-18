
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
