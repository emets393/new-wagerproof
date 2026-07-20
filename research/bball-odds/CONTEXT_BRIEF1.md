# Context Brief #1 — game classes + scheduling deep dive (NCAAB)

23,031 games. T-60 prices. BE 52.4%.

## A — game classes: market + model accuracy per segment

| segment | n | home cover% | fav cover% | market MAE | model MAE | model win% at edge≥3 |
|---|---|---|---|---|---|---|
| POWER vs POWER conf | 993 | 48.3% | 49.9% | 8.84 | 9.11 | 52.8% (n=305) |
| LOW vs LOW conf | 9,592 | 49.0% | 49.0% | 8.69 | 8.95 | 50.6% (n=2339) |
| POWER vs LOW (buy games) | 1,110 | 49.4% | 49.0% | 9.36 | 10.04 | 54.5% (n=530) |
| blue-blood games | 1,193 | 51.2% | 52.0% | 9.44 | 10.09 | 50.3% (n=523) |
| ranked conf games | 239 | 50.2% | 49.8% | 9.76 | 10.21 | 41.8% (n=79) |
| conference tournaments | 904 | 48.4% | 48.6% | 8.51 | 8.79 | 52.0% (n=298) |
| MTEs (Nov/Dec TRNMNT) | 861 | 52.8% | 48.8% | 9.22 | 10.66 | 54.1% (n=475) |
| NCAA tournament | 235 | 54.3% | 56.5% | 9.16 | 9.43 | 55.8% (n=86) |
| neutral courts (all) | 2,198 | 51.6% | 50.0% | 8.88 | 9.85 | 53.9% (n=1044) |

## B — scheduling deep dive

| signal | n | win% | ROI | per season |
|---|---|---|---|---|
| away LONG trip (≥1200mi from home) | 1,506 | 52.4% | +0.0% | 2022-23: 160/303 53% +1% · 2023-24: 201/347 58% +11% · 2024-25: 223/425 52% +0% · 2025-26: 205/431 48% -9% |
| away trip7 ≥2000mi (road warrior fatigue) | 754 | 52.4% | +0.0% | 2022-23: 82/174 47% -10% · 2023-24: 95/174 55% +4% · 2024-25: 111/212 52% -0% · 2025-26: 107/194 55% +5% |
| HOME after road blowout loss (≤-15 away) | 1,756 | 49.7% | -5.2% | 2022-23: 202/404 50% -5% · 2023-24: 216/451 48% -9% · 2024-25: 222/446 50% -5% · 2025-26: 232/455 51% -3% |
| HOME after road blowout loss → fade | 1,756 | 50.3% | -3.9% | 2022-23: 202/404 50% -5% · 2023-24: 235/451 52% -1% · 2024-25: 224/446 50% -4% · 2025-26: 223/455 49% -6% |
| team 3+ games in 7 days (home) | 619 | 49.4% | -5.6% | 2022-23: 102/210 49% -7% · 2023-24: 69/137 50% -4% · 2024-25: 67/138 49% -7% · 2025-26: 68/134 51% -3% |
| team 3+ games in 7 days (away) | 747 | 49.5% | -5.4% | 2022-23: 98/222 44% -16% · 2023-24: 80/163 49% -6% · 2024-25: 92/175 53% +0% · 2025-26: 100/187 53% +2% |


## Conclusions (2026-07-17)

**A — game classes:**
1. Market accuracy varies by class: SHARPEST in low-vs-low conference (8.69)
   and conference tournaments (8.51); softest in ranked-conf (9.76),
   blue-blood (9.44), buy games (9.36). Small-school markets are NOT soft on
   spreads — they're the sharpest segment. The soft spots are the PUBLIC ones.
2. **Model was context-blind**: no neutral/class flags → MAE 9.85 at neutral
   courts, 10.66 MTEs. Adding game-class flags → best overall config yet
   (val 9.10) and every weak segment tightens.
3. **The accidental-alignment discovery**: the uncorrected model's neutral-
   site home bias was capturing a REAL market bias — nominal home covers
   51.6% at neutral, 52.8% in MTEs, favs 56.5% in the NCAA tournament.
   Corrected model + explicit market-lean signals > biased model.
4. Ranked-conference games: model edges are an ANTI-signal (41.8%) — the
   sharpest, most-watched markets; suppress model picks there.

**B — scheduling: PRICED.** Long trips, 7-day trip miles, home-after-road-
blowout, 3-games-in-7-days: all ~49-52.4%, no durable edge. CBB scheduling
spots are absorbed by the market (rest was already known to be a non-factor).
OT-carryover + star-minutes-load rows pending the shots/OT extract.


## Addendum (2026-07-17, after shots/OT extract)

- **OT carryover: PRICED.** Team played OT last game → fade = 49.5-52.1%,
  OT + short rest ≈ 51%. n=1,200+ per side, no durable edge.
- **Star-archetype vs zone defense (ATS): PRICED.** Rim-heavy star vs elite
  rim defense, 3PT star vs elite 3PT defense — every cell 48.5-51.5% (n≈1,150
  each). Mild lean: BACK the star's team vs the "bad matchup" (51-51.5%) —
  the shutdown narrative is slightly over-bet, consistent with the style
  brief's TT-over finding, but sub-vig on spreads. Star shot profiles saved
  (star_profiles_ncaab.parquet, 39,634 team-games) for model/calibrator use.
