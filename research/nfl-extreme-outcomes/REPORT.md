# What Predicts NFL Extreme Outcomes? — Deep Research Report

**Scope:** 2,226 games, 2018–2025 (regular season + playoffs). Target metrics computed per game:
`spread_diff = actual_margin + home_spread` (>0 = home beat the number), `spread_miss = |spread_diff|`,
`total_diff = actual_total − closing_total` (>0 = OVER), `total_miss = |total_diff|`. "Blow-up" =
`spread_miss ≥ 21`; big-over/under = `total_diff ≥ 21` / `≤ −21`.

**Bottom line.** The closing line is a near-perfect mirror of power ratings (corr 0.885) and the
market is, with two exceptions, efficient on extreme outcomes. **Spread-miss magnitude is irreducible
variance** — nothing predicts it (max feature corr 0.064; walk-forward model AUC 0.511). **The only
clean, repeatable, mechanism-backed edge is WIND → UNDER**, with a secondary, *decaying* primetime-under
lean. Everything else is descriptive, recent-only, or noise.

---

## 1. Data, joins, and validation (all passed)

| Source | Rows | Use | Validation |
|---|---|---|---|
| `v_nfl_pregame_features_full` | 2,226 | primary features + outcomes | flag reconstruction below |
| `nfl_training_data_epa` | 2,226 | overlap / extras | — |
| `nfl_historical_odds` | 323,008 | open/close line movement 2023–25 | close-consensus vs stored line |
| `nfl_betting_lines` (2025) | 3,581 → 281 games | sharp/public splits | mapped 100% |
| `nfl_team_mapping` | 33 | crosswalk | all 33 names map |
| nflverse `games.csv` | 7,548 | QB starters, coach, rest, roof, primetime | 100% join |

**Flag reconstruction from closing line + score:** `home_away_spread_cover` 100.0%, `home_away_ml`
100.0%, `ou_result` 99.95%, `favorite_covered` 99.82% — all far above the 99% bar → joins are correct.
`total_points == home+away` for all 2,226 rows. `spread_diff` mean = +0.014 (market unbiased on spread),
`total_diff` mean = +0.55 (the known slight over-bias — reproduced exactly).

**Guardrails applied:**
- **SB mislabel patched** (surgically, by `unique_id`): `LA ChargersNew England201821` (SB LIII, Rams=home)
  and `CincinnatiLA Chargers202122` (SB LVI, Rams=away) → "LA Chargers" → "LA Rams". Confirmed against
  nflverse (`2018_21_NE_LA`, `2021_22_LA_CIN`). The 2018 wk19 NE–LAC game is a *real* Chargers playoff
  game and was **not** touched.
- **Team join key** = `(season, home_ab, away_ab)` — unique per season in the NFL (0 duplicate keys in
  853 odds games), sidestepping all commence-time timezone issues.
- **Odds consensus** = median across books of each book's earliest (open) / latest-pre-kick (close) snap.
  Close-consensus reproduces the stored line: spread |diff| median 0.0 (96.8% within 1pt), total |diff|
  median 0.0 (96.5% within 1pt).
- **Clean backup-QB definition** (per brief): a backup started iff that game's nflverse starter ≠ the
  team-season modal starter. 658 games (29.6%) — vs the unreliable `qb_out_or_doubtful` flag (305).
- **Leak-safety:** only closing line + `_s2d`/`_last3`/pregame fields used; models walk forward
  (train prior seasons, test next).

---

## 2. Ranked findings (strongest → weakest)

### #1 — WIND ≥ high-teens (outdoor) → UNDER  ✅ VALIDATED
**Rule:** outdoor game, forecast sustained wind ≳ 17 mph → bet UNDER.

| Cut | n | Under hit | 95% CI | ROI@−110 | Seasons ≥50% |
|---|---|---|---|---|---|
| outdoor wind ≥ 12 | 213 | 56.8% | [50.1, 63.3] | +8.5% | 6/8 |
| outdoor wind ≥ 15 | 95 | 55.8% | [45.8, 65.4] | +6.5% | 5/8 |
| **outdoor wind ≥ 17** | **52** | **61.5%** | **[48.0, 73.5]** | **+17.5%** | **7/8** |
| outdoor wind ≥ 18 | 38 | 68.4% | [52.5, 80.9] | +30.6% | 7/7 |
| outdoor wind ≥ 20 | 22 | 77.3% | [56.6, 89.9] | +47.5% | 5/5 |

**Dose-response (the proof it's real):** over% falls monotonically with wind — calm 0–5 mph: 48.9% over
(mean `total_diff` +0.94) → 10–15: 42.1% (−1.03) → **20+: 20.8% over, mean `total_diff` −6.27**.
Big-unders jump to 12.5% (vs 4.4% baseline) and big-overs vanish (0%) in a gale.

**Mechanism:** wind degrades the deep passing game and field goals/kicking — a direct physical
suppressor of scoring. This is *why* it's not arbitraged away: it's a tail condition, rare and
forecast-dependent.

**Robustness:** (a) monotonic across thresholds, not a single magic number; (b) **survives excluding
2025** — 2018–24 wind≥17 hits ~64.5% (n=31, 6/7 seasons), so it does not depend on the 2025-heavy
sample; (c) held up in 2024 (55.6%) and 2025 (57.1%), unlike weaker thresholds. **Caveat:** the two
wind sources (view vs nflverse) correlate 0.70 (|diff| median 2.1 mph), so the exact cutoff is fuzzy —
treat it as "high-teens and rising," not literally 17.0. 2025 had 21 wind≥17 games vs 2–9 in prior
years (possible data-coverage artifact) — weight recent samples cautiously.

**Verdict: VALIDATED.** The one edge I'd act on. Best expressed as "lean under as forecast wind climbs
through the high teens, strong conviction at 20+."

---

### #2 — PRIMETIME → UNDER  🟡 CANDIDATE (was strong, now decaying)
**Rule:** kickoff ≥ 19:00 ET (SNF/MNF/TNF) → bet UNDER.

| Season | n | Under hit | ROI |
|---|---|---|---|
| 2018 | 54 | 50.0% | −4.5% |
| 2019 | 51 | 64.7% | +23.5% |
| 2020 | 52 | 53.8% | +2.8% |
| 2021 | 59 | 54.2% | +3.5% |
| 2022 | 58 | 63.8% | +21.8% |
| 2023 | 61 | 63.9% | +22.1% |
| 2024 | 62 | 51.6% | −1.5% |
| 2025 | 63 | 52.4% | 0.0% |
| **ALL** | **460** | **56.7%** | **+8.3%** (CI [52.2, 61.2]) |

**Not a weather artifact:** holds **indoors** (dome/closed primetime: 56.0% under, 7/8 seasons, +6.9%)
where there is no weather; primetime wind is actually *lower* (6.4 vs 7.8 mph). **Mechanism:** primetime
totals are set ~1.2 pts *higher* than non-primetime (46.3 vs 45.1) yet score ~0.7 pts *lower* (45.4 vs
46.1) — consistent with public over-betting marquee games inflating the number.

**Robustness:** positive-or-even in **8/8 seasons** — BUT clearly **decaying**: strong 2019–2023, then
~breakeven in 2024 and 2025. The market appears to be correcting it. **Note:** this *contradicts the
brief's prior* that "primetime leans over" — the 2018–2025 data is unambiguously an under-lean.

**Verdict: CANDIDATE.** Real historically and mechanism-backed, but the recent fade means I would *not*
bet it blindly in 2026 — watch whether 2026 reverts to the under or continues the 2024–25 flattening.

---

### #3 — Home dogs +7.5 to +9.5 / fade big road favorites  🟡 CANDIDATE (recent-only)
- **+7.5–9.5 dogs ATS:** 2023–25 = 62.5% (n=80, +19.3%) — replicates the brief. **But over 8 seasons:
  55.1% (n=214, CI [48.4, 61.7] includes breakeven), and it LOST in 2019 (46.7%) and 2021 (41.4%).**
- Same phenomenon from the other side: **away favorites ≥7 covered only 44.5%** (n=182) → backing the
  home dog won 55.5%, and it won 2020–2025 but lost 2018–2019.

**Verdict: CANDIDATE.** Strong in the recent window the brief examined, not robust across the full
history. Recency could be signal (rule changes favoring offense/comebacks) or variance. Watch, don't
size up.

---

### #4 — Huge power-rating mismatch (|pr_diff| ≥ 12) → modestly higher blow-up rate  🟡 WATCH (variance only)
Spread blow-up rate rises with PR mismatch: 9.5% (close, 0–3) → 11.5% (7–12) → **15.6% (12+, n=141,
CI [10.5, 22.5])**. This is the *only* condition that lifts blow-up frequency above baseline (10.9%).
**It tells you variance is elevated, not which side wins** — direction in blow-ups is 53.5% chalk /
46.5% upset (≈coin flip). **Verdict: WATCH (descriptive variance).** Useful for risk/teaser sizing,
not for picking a side.

---

### #5 — Playoff home teams ATS (~59%)  🟡 CANDIDATE (small n, partly mechanical)
Home ATS in wk≥19: 59.3% (n=86, +13.2%, CI [48.7, 69.1]) — but only 86 games over 8 years, noisy
(lost 2018, 2022), and partly mechanical (home = higher seed = better team, plus rest). Likely
semi-priced. **Verdict: CANDIDATE, low priority.**

---

### #6 — 2025 sharp money / reverse-line-movement (spread)  🟡 WATCH (single season, unconfirmable)
On 2025 only (the sole season with splits): "Sharp Money on X" side covered 60.3% (n=58, +15.2%), and
backing the handle-minus-bets gap is monotonic (gap≥0.20 → 60.0%). Internally consistent and
plausible, but **one season, small n, CI includes breakeven, and one of dozens of cuts** → cannot be
validated. **Verdict: WATCH** — collect 2–3 more seasons of `nfl_betting_lines` splits before trusting.

---

### #7 — Secondary weather (descriptive)
- **Heavy precip (outdoor, ≥0.7):** 43.8% over, mean `total_diff` −1.38, big-unders 7.6% — same
  direction as wind but weaker; mostly subsumed by wind. Minor under-lean.
- **Indoor / closed-roof → OVER (descriptive, NOT a bet):** closed roof 52.3% over (mean +2.40, big-over
  9.9%); dome+closed combined +1.69. Real environmental lean, but betting the over in domes returns
  **−1.8% (51.4%, n=657)** — the market prices it. Use only as a "big-over is more *possible* indoors" note.

---

## 3. The honest nulls (rejected — variance the market already prices)

| Avenue | Result | Verdict |
|---|---|---|
| **Spread-miss magnitude** | max feature corr 0.064; walk-forward AUC **0.511** | ❌ irreducible variance |
| Backup QB (clean def) raising |miss| | 9.7 vs 9.8; blow-up 9.1% vs 11.7% (lower!) | ❌ no effect |
| Divisional / rest / Thursday / short-week on magnitude | all ≈11% blow-up | ❌ flat |
| **PR-vs-spread divergence** | backing PR side ATS = −2% to −6% ROI; when PR & market disagree on favorite, **market side wins SU 58.6%** | ❌ market efficient |
| **Spread ATS, walk-forward model** | AUC **0.495**; confident picks −2.7% to −5.2% | ❌ unbeatable |
| **Last-game effects** (blowout, cover, streak, bye) | off-cover 49.4% vs off-non-cover 50.5%; off-bye 48.2% | ❌ all null |
| **Look-ahead / trap spot** | "fav before strong opp" 53.8% but loses 3/8 seasons; trap favs cover *more*, not less | ❌ not robust |
| **Line-movement steam / follow-fade** (spread & total) | all ≈50%, negative ROI; "fade the total move" dead | ❌ null (confirms prior) |
| Did extreme misses MOVE more? | blow-ups |move| 1.66 vs 1.46 (spread), 1.77 vs 1.50 (total) | ❌ market **blindsided**, not sensing |
| **Referee** (`ref_total_pts_avg`) | corr with actual total **−0.014**; over-bet −10.7% | ❌ zero signal |
| Pace / scheme → over | top-quartile pace = 45.6% over (lower!) | ❌ priced in |
| Temperature, scoring-environment, total mean-reversion | flat / no clean monotonic | ❌ null |

---

## 4. 2026 WATCH LIST (actionable, edges vs descriptive)

**REAL EDGE — bet it:**
- 🟢 **High wind → UNDER.** Outdoor games with forecast sustained winds in the high teens or higher.
  Conviction scales with wind: lean at ~15–17 mph, strong at 20+. Flags big-UNDER risk specifically
  (big-overs disappear). The single most defensible signal in this study.

**REAL BUT FADING / NEEDS MONITORING — small stakes:**
- 🟡 **Primetime → UNDER.** Was a strong, weather-independent edge (8/8 seasons), but flattened to
  breakeven in 2024–25. Track early-2026 primetime results before committing; the market may have
  closed it.
- 🟡 **Home dogs +7.5 to +9.5 / fade road favorites ≥7.** Strong 2020–2025, lost 2018–2019/2021.
  Recency may be real (offense-friendly era) — watch the band, don't oversize.
- 🟡 **Heavy precipitation (outdoor) → slight UNDER lean.** Secondary to wind; stack with wind, don't
  bet alone.

**DESCRIPTIVE RISK FLAGS — for sizing/teasers/exposure, NOT a side:**
- ⚪ **Big-UNDER risk ↑:** outdoor + high wind, or heavy precip.
- ⚪ **Big-OVER risk ↑:** closed-roof / dome games (priced into the total — informational only).
- ⚪ **Spread BLOW-UP risk ↑ (variance, undirected):** huge power-rating mismatch (|pr_diff| ≥ 12,
  ~15.6% blow-up vs 10.9%) and playoffs (16.3%). You can anticipate *that* a blow-up is likelier, never
  *who* wins it — blow-ups are ≈50/50 chalk vs upset.

**COLLECT MORE DATA:**
- 🔵 **Sharp-money / RLM.** The 2025 splits looked promising (sharp side 60%) but it's one season.
  Keep ingesting `nfl_betting_lines` so 2026–27 can confirm or kill it.

**DO NOT CHASE (proven dead here):** fading line moves, key-number theories, referee totals, last-game
streaks, look-ahead traps, backing power ratings against the closing spread, QB-injury over/under
reactions, dome-overs as a bet, pace-driven overs.

---

## 5. Reproducibility

All code in `research/nfl-extreme-outcomes/`; raw pulls cached in `data/*.parquet`, console outputs in
`out/*.txt`.

| Script | Produces |
|---|---|
| `fetch.py` | pulls + caches all sources |
| `build.py` | `master.parquet` (metrics, SB patch, nflverse merge, backup-QB) + validation |
| `build_odds.py` | `odds_consensus.parquet`, `splits_2025.parquet` + join validation |
| `a_baseline.py` | baseline, market unbiasedness, linear-signal scan |
| `b_spread.py` | avenues A (magnitude), B (cover edges), C (PR divergence) |
| `c_totals.py` | avenue G (totals/wind/weather/pace) + H (referee) |
| `d_movement.py` | avenue D (line movement, splits, RLM) + I (situational) |
| `e_context.py` | avenue E (last-game), F (look-ahead), primetime/playoff per-season |
| `f_model.py` | avenue J (walk-forward GBM: blow-up, ATS, O/U, big-under + permutation importance) |
| `g_lockdown.py` | headline robustness (primetime indoors, best wind rule, multiple-comparison framing) |

Every betting cut reports n, hit rate, ROI, Wilson 95% CI, and a per-season table (`stats_helpers.py`).
