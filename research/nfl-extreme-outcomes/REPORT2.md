# Matchup Signal-Mining for a Betting Model — Full Report (Brief #2)

**Central hypothesis tested:** *matchup-specific unit interactions (advanced defense vs opponent
offense, and vice-versa) — and team style/archetype clashes — create predictable deviations in points,
margin, and total that the closing line does not fully capture.*

**Verdict: REJECTED.** Across a well-powered, FDR-controlled, walk-forward, all-three-markets analysis,
matchup nets, interaction products, and style-archetype clashes carry **no exploitable orthogonal
signal beyond the closing line.** The market prices unit matchups essentially completely (the closing
line is a 0.885-corr mirror of power ratings, and the matchup nets are *what oddsmakers use*). The only
features that survive — wind and primetime — are the environmental ones from Brief #1, not matchups.
The single matchup term with any pulse is **pressure-vs-slow-QB mismatch → higher blow-up *variance***
(undirected, 4-season, fragile in 2025) — a model/sizing feature, not a bet.

This is the honest, rigorous answer the brief demanded ("prove it or disprove it"). Details below.

---

## 1. Data built & validated

**New granular source — `nfl_pregame_advanced_team_week`** (5,504 rows, grain `(season,week,team)`,
one row per team per game entering it, 2018–2025): clean off/def by phase — pass/rush success &
explosive, pts/drive, TD/drive, 3-and-out, RZ, early-down EPA, **neutral (script-independent) EPA**,
pace proxies, sample counts. **Quality issues found & handled:** `off_sec_per_play_neutral_s2d` is
broken (constant ≈10.0 placeholder — dropped, used `off_plays_per_game_s2d` for pace);
`def_rz_td_rate_allowed_s2d` is 100% null (dropped). Team names map 100% to the crosswalk.

**Matchup feature matrix** (`matchup.parquet`, 2,226 games × 409 cols; 1,842 with week≥4 + team-week):
- **Unit nets** by phase (×10 phases): `hnet_X = home_off_X − away_def_X_allowed`, the away mirror
  `anet_X`, **separation** `sep_X = hnet − anet` (→ margin), **environment** `env_X = hnet + anet` (→ total).
- **Engineered:** expected pts/drive per team & total/margin; pace_sum, proe_sum/prod, explosive_sum,
  turnover_sum; **asymmetry** `mismatch_mag`, `sep_mag` (→ blowout potential); strength-on-weakness
  products; pressure×PROE and pressure×time-to-throw interactions.
- **Orthogonal (line-relative) targets:** `resid_total = actual − O/U line`, `resid_margin = spread_diff`,
  and **per-team** `resid_home_pts = home_score − (O/U−spread)/2` (implied team points → props proxy).

**Join validation:** team-week joined to 99.3% of games; team-week `off_pass_success` vs the view's
`off_pass_sr_s2d` correlate **1.000** (|diff| 0.0000) — same underlying source, alignment exact. (All
Brief #1 guardrails reused: SB patch, vig/garbage-odds filter on ML, clean backup-QB def, leak-safe s2d,
week≥4 floor for season-to-date signal.)

**Power:** with n=1,842 (week≥4), a true correlation of r≈0.07 is detectable at p<0.01. So this is a
*well-powered* test — a null here means any real matchup edge is smaller than economically useful.

---

## 2. Team STYLE archetypes (the deliverable) — built, named, validated

Clustered on FTN-complete seasons (2022–2025), standardized to capture **how** a team plays, not how
good. K chosen by silhouette.

### Offensive style (k=4, silhouette 0.21 — low; NFL offensive style is a *continuum*, mostly the PROE axis)
| # | Name | Signature (orig units) | n |
|---|---|---|---|
| 0 | **Run-leaning, under-center** | PROE −2.46, lowest shotgun (.54), low motion | 1007 |
| 1 | **Up-tempo shotgun / RPO spread** | highest no-huddle (.17), highest shotgun (.70), high RPO | 333 |
| 2 | **Pass-heavy motion** | PROE +2.81 (most pass), highest motion (.42), high PA | 438 |
| 3 | **Balanced, vertical** | balanced PROE, highest plays/g (64), highest aDOT (8.6) | 466 |

### Defensive style (k=4, silhouette 0.30)
| # | Name | Signature | n |
|---|---|---|---|
| 0 | **Heavy-box, high-blitz / low-pressure** | blitz .137, pressure .082 (low), box 5.42 (heavy) | 272 |
| 1 | **Light-box, passive** | box 5.10 (lightest), moderate blitz/pressure | 1041 |
| 2 | **Blitz-heavy** | blitz .177 (highest) | 502 |
| 3 | **Sim-pressure / front-four wins** | pressure .111 (highest), blitz .104 (lowest) | 429 |

**Stability:** within-season week→modal match = 97% (off) / 87% (def) — though this is inflated by s2d
smoothing; season→next-season modal persistence = 70% (off) / 51% (def). Archetypes are real, persistent
descriptors. *(Man/zone coverage was deliberately excluded: nflverse participation only covers ≤2023, not
the 2024–25 test years, so it cannot be used consistently.)*

### Archetype-clash results: **NO signal**
For every pairing `(home_off_arch vs away_def_arch)` etc., mean line-relative residual (team points,
total, margin) with a one-sample t-test and **BH-FDR(0.10)** across pairings:

| Target | # pairings | FDR survivors | biggest raw cell |
|---|---|---|---|
| home pts resid | 13 | **0** | 3v2: +2.19 (p=.42) |
| away pts resid | 14 | **0** | 2v3: +3.20 (p=.03, n=43) |
| total resid | 13 | **0** | 3v0: −4.79 (p=.01, n=26) |
| margin resid | 13 | **0** | 3v0: +4.52 (p=.07, n=26) |

Zero pairings survive FDR. The largest cells are n=26–46 — exactly the single-cell chance artifacts the
brief warned about. **Style clashes do not beat the line.**

---

## 3. The orthogonality result (core finding)

### A. Linear FDR screen — 0 survivors on every target
61 matchup features × 5 line-relative targets, Pearson + BH-FDR(0.10):

| Target | max |r| | top raw hit | FDR survivors |
|---|---|---|---|---|
| resid_total | 0.060 | anet_3out (−.060) | **0** |
| resid_margin | 0.050 | anet_ed_pass (−.050) | **0** |
| resid_home_pts | 0.065 | anet_3out (−.065) | **0** |
| resid_away_pts | 0.043 | mismatch_mag (−.043) | **0** |
| spread_miss | 0.078 | pressure×TTT (+.078) | **0** |

### B. Walk-forward models — beat the close on NO market
GBM (line + full matchup set), train seasons < Y, test Y, bet the model's predicted side:

| Market | OOS hit (best thr) | ROI | per-season |
|---|---|---|---|
| Totals (resid_total) | 51.4% | −2.0% | only 2022 positive; 2024 = 45.7% |
| Spread (resid_margin) | 49.4% | −5.6% | all ≤52.7% |
| **Moneyline** (vs real closing prices, 2023–25, vig-filtered, n=706) | 51.4% | **−8 to −10%** | implied breakeven ~54% |

The totals model's top out-of-sample permutation features are **wind and primetime** — the Brief #1
environmental signals — *not* matchup terms. Matchup features that look important in-sample do not
convert to OOS profit.

### C. Hypothesized interactions — all null or backwards
| Hypothesis | result |
|---|---|
| pace × pace → over | −0.64 pts, p=.51 (slightly *under*) |
| two pass-happy (PROE_sum) → over | p=.41 |
| explosive-pass sum → over | p=.17 |
| turnover-prone sum → under | p=.65 |
| explosive O vs leaky deep D → home pts | −1.29, p=.06 (**backwards**) |
| mismatch_mag → blowout | +0.61, p=.28 (**no** — blowouts irreducible, confirms Brief #1) |
| matchup resolves PR-vs-line divergence | no (one direction even inverted) |

---

## 4. The one matchup term with a pulse — pressure × time-to-throw → blow-up VARIANCE

`trench_var` = (away QB slow time-to-throw × home pressure-rate) minus (home pass-happiness × away
pressure-rate). This is the brief's hypothesized "high-pressure D × slow-processing QB."

- **corr(trench_var, spread_miss) = +0.114** (n=946) — the strongest matchup-related correlation found.
- Blow-up rate by quintile: **Q1 4.2% → Q5 15.3%** (monotonic), mean |miss| 7.9 → 10.8.
- **But:** undirected (predicts variance, not a side; blow-ups are 50/50 chalk/upset); only 4 seasons
  (FTN); per-season top-quintile blow-up = 20%/16%/20% (2022–24) then **5% in 2025** (collapsed); did
  not survive the main FDR screen.

**Verdict: CANDIDATE variance feature.** Useful only as a *model input for score-dispersion* (teaser
pricing, live-bet sizing, blow-up risk), never as a standalone side bet. Watch whether 2026 reverts to
the 2022–24 pattern or stays dead like 2025.

---

## 5. Where is matchup signal strongest? (the brief's question)

Nowhere exploitable. Ranked by faint residual: **team-points/props proxy** (resid_home_pts max |r|
0.065) ≈ **totals** (0.060) > **margin** (0.050) > **ML** (loses outright to price). Totals/props are
*marginally* less efficient than sides — consistent with the brief's suspicion — but the gap is far too
small to overcome vig. The softest market we found is *still* efficient against matchup features.

---

## 6. Model-ready feature recommendations for 2026

**(a) Use to MATCH the line (baseline model inputs — zero standalone edge, but they reconstruct a fair
price):** the unit nets (`hnet_*`,`anet_*`,`sep_*`,`env_*`), `exp_*_ppd`, power ratings, `ou_vegas_line`,
`home_spread`. These *are* the market; a model built on them will approximate the close, not beat it.
Their value is as a well-calibrated prior, and to flag stale lines intra-week, not to print money.

**(b) Genuine (small) edges — totals only (from Brief #1, re-confirmed here as the only OOS-important
features):** `wind_mph` (outdoor, high-teens+ → under), `primetime`/`kick_hour_et` (under-lean, decaying).
These belong in a totals model; they are environmental, not matchup.

**(c) Variance / sizing features (predict dispersion, not a side):** `trench_var` (pressure×TTT),
`mismatch_mag`, |PR mismatch|, playoff flag. Feed a *variance* head (for teasers, alt-lines, live, stake
sizing) — do not bet a side off them.

**(d) Drop (no signal): ** archetype pairings as bet triggers, pace×pace, PROE×PROE, explosive-sum,
"strength-on-weakness" products as directional signals, matchup features for ML, matchup features to
resolve PR-vs-line divergence. All tested, all null.

**Net guidance for a 2026 model:** build the sides/ML model to *replicate* the close from unit nets + PR
(expect ~breakeven, use for line-shopping & disagreement flags, not edge); concentrate the *only* real
totals edge in the weather/primetime tails; add a separate variance model for sizing using
pressure-mismatch + PR-mismatch. Do not expect matchup interactions to beat the number — this study
shows, with power, that they don't.

---

## 7. Reproducibility
`research/nfl-extreme-outcomes/`: `build_matchup.py` (matchup matrix + validation), `archetypes.py`
(clustering, naming, stability, pairings), `mine_orthogonal.py` (FDR screen, walk-forward GBM per market,
archetype mining, hypothesized interactions), `mine2.py` (pressure×TTT variance, ML real-price test,
PR-divergence subset). Cached data in `data/*.parquet`; outputs in `out/*.txt`. Builds on Brief #1's
validated `master.parquet`, `odds_consensus.parquet`, crosswalk, and guardrails.
