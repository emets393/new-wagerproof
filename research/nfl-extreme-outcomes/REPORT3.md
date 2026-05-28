# Brief #3 — Exhaustive NFL Betting-Trend Discovery (ATS / O-U / ML)

**Headline.** I re-validated the prior trends on full data (per-season) and ran an exhaustive scan of
**1,547 single + 2-way + 3-way conditions** across ATS, O/U, and ML, with the guarding principle
(per-season consistency, mechanism, robustness) **plus a permutation-null false-positive control**. The
FP control is decisive and must frame everything:

> **ATS: the scan found 104 "passing" trends (singles+2-way) vs a shuffled-outcome NULL of ~120.
> Real ≤ null → ZERO enrichment. Every ATS situational/combo "trend" is indistinguishable from noise.**
> **O/U: real 32 vs null 21 → modest real enrichment**, concentrated entirely in the
> weather / primetime / structure spots already known.

So: **there are no new repeatable ATS trends** — the spread market is efficient and the per-season-
consistency bar, applied to ~600+ correlated combos, is cleared ~120× by pure chance. The real (thin,
decaying) edges live in **totals**. Below, re-validated (Part 1) and new (Part 3) findings are ranked,
each with mechanism, n, hit/ROI, 95% CI, and a per-season table.

Methods note: leak-safe (pregame/closing only), team-name crosswalk validated (cover/ML reproduce),
ML prices vig-sane (nflverse). Guarding principle = ≥2 seasons (n≥5) beat 52.4%, same direction, ≥67%
of seasons right-side, pooled ≥53.4%. FP control = 4× within-season label shuffles through the same scan.

---

## PART 1 — RE-VALIDATION (full data, per-season)

### ✅ VALIDATED

**V1. Wind ≥17 mph (outdoor) → UNDER**  — n=52, **61.5%**, +17.5% ROI, CI[48,74]
Per season: 2020 80% · 2021 80% · 2022 33%(n3) · 2023 80% · 2024 56% · 2025 57% → every meaningful-n
season positive; held in 2024–25. Monotonic dose-response (calm→gale), physical mechanism (wind kills
deep passing & kicking). The single most durable edge in the entire project. *(Also the top O/U scan hit
and above the null.)*

**V2. Pre-bye HOME team → ATS cover** — n=150, **60.0%**, +14.5% ROI, CI[52,68]
Per season: 48 / 63 / 50 / 62 / 73 / 53 / 68 / 71% → 6/8 beat vig, worst 48%. Mechanism: teams play
hard into the bye (prep edge, want to enter rest on a high); market underprices it. *Pre-specified
hypothesis with a mechanism* — survives as a genuine ATS candidate even though the broad ATS scan is
noise (it's confirmatory, not data-dredged; the scan's `pre_bye & fav & outdoor` 62.9% corroborates).

**V3. +7.5 to +10.5 dog → cover ATS** — n=306, **54.2%**, +3.6% ROI, CI[49,60]
Per season: 55/55/59/41/56/55/54/62% → 7/8 beat vig (only 2021 lost). The +10.5 upper edge is *more*
robust than the original +7.5–9.5 (which was 5/8). Mechanism: public over-loves big favorites; the
key-number range 7.5–10.5 is the inflated zone.

### 🟡 CANDIDATE / WATCH
- **Monday → UNDER** 58.1% (7/8) and **early-season (wk≤4) division/primetime → UNDER** ~59% (6/8) — see Part 3.
- **Confident totals-model top-30%** 55.6% pooled but **decaying** (2021–23 ≈ 60%, 2024 = 42%, 2025 = 52%).
- **Fade post-bye favorite** 55.2% (4/8 — too mixed).
- **Upset-bounce** (back a top-5 PR team the week after it lost SU to a bottom-10 team): 63.2% pooled but
  **n≈5/season** — mechanism is good (good teams regress upward, market overreacts to the upset) but
  samples are tiny; WATCH only.

### ❌ REJECTED / CONTRADICTED on full data
- **Big-favorite totals (wk10+) → UNDER:** spread≥7 wk10+ = **46.3% (−11.6%)**, 1/8 seasons. The claimed
  ~64% does not replicate — these games lean slightly OVER. **Contradicted.**
- **Favorite-longshot ML:** all buckets negative ROI on vig-sane prices — moderate fav (−141..−200)
  −3.6%, heavy (−201..−250) −3.0%, very heavy −2.2%. The "moderate fav +EV" only held 2023–24 (a regime,
  not a trend; 2018–21 were −11% to −19%). **Efficient — rejected.**

---

## PART 2 — previously-failed trends: re-confirmed dead / not re-chased
primetime *spread* (~50%), rush-matchup ATS, broad fade-home-favorites, fade-the-total-move, 3/7 key-number
cover, 41.5/42 unders, QB-injury O/U over-reaction, matchup/archetype model signal (Brief #2 rejected
across all markets), independent-projection-vs-close. Nothing in the new scan resurrected any of these.

---

## PART 3 — EXHAUSTIVE NEW SCAN (1,547 combos) — what the FP control allows us to keep

**ATS: nothing.** 104 real passers ≤ 120 null passers → no enrichment. The best-looking artifacts
(`road_fav & letdown` 57% 8/8 seasons; `fav & letdown` 57% 7/8; the `cover_streak` fades) are **rejected
as noise** — they are exactly the kind of impressive-but-spurious patterns an exhaustive correlated search
manufactures, and the null produces them just as often. The spread market shows no repeatable situational
trend.

**O/U: real enrichment (32 vs 21 null).** Keeping only mechanism-backed survivors consistent across seasons:

**N1. High total (≥49) + big-favorite game → UNDER** — n=130, **60.0%**, CI[51,68], **7/7 seasons right**
Per season: 64/62/53/67/75/71/53% (seasons with n≥5). Mechanism: a big favorite in a high-total game
tends to control clock and game script once ahead → fewer possessions → under. New, consistent, plausible.

**N2. Late-season (wk≥15) big-favorite game → OVER** — n=198, **57.1%**, CI[50,64], **8/8 right, 7/8 beat vig**
Per season: 55/56/57/51/52/72/56/63%. New — and it **resolves the rejected P1.2**: late big-favorite
games lean *OVER*, not under (likely strong offenses + late garbage-time scoring vs a mismatched dog).

**N3. Monday → UNDER** — n=155, **58.1%**, CI[50,66], 7/8 beat vig (2024 the lone miss at 41%).
Subset of primetime; the standalone-Monday slate has run under historically (slower, defensive spots).

**N4. Early-season (wk≤4) division game → UNDER** — n=151, **58.9%**, CI[51,66], 6/8.
Mechanism: early division games are familiar, sloppy, conservative → under. Pairs with primetime-wk≤4 (59%).

**N5. Primetime → UNDER** (re-stated) — n=460, **56.7%**, 8/8 right direction, but **decaying** to ~52% in
2024–25. Above the null; the most-sampled totals trend, fading.

*All N-trends are totals, modest, and several are decaying — treat as candidates to paper-trade, not locks.*

---

## FALSE-POSITIVE ACCOUNTING (the core discipline)
- Screened **1,547** conditions/combos (ATS 1,414 incl. 3-way; O/U 133).
- Permutation null (4× within-season shuffle, singles+2-way): **ATS real 104 vs null 120** (no signal);
  **O/U real 32 vs null 21** (real signal ≈ 11 excess, ~35% enrichment).
- Conclusion: do **not** trust any single ATS scan hit, however pretty its per-season table. Trust only
  (a) pre-specified hypotheses with a mechanism that independently re-validate (wind, pre-bye, dog band),
  and (b) O/U spots that are mechanism-backed *and* survive above the null.

---

## 2026 TREND WATCHLIST (by market, by confidence)

**TOTALS — bet (small), the only real edges:**
1. 🟢 **Wind ≥17 mph outdoor → UNDER** — most durable; conviction rises with wind (20+ ≈ 77%).
2. 🟢 **High total (≥49) + big favorite (≥7) → UNDER** — 7/7 seasons; clean mechanism.
3. 🟡 **Late-season (wk≥15) big-favorite game → OVER** — 8/8 right; note it's the opposite of the old myth.
4. 🟡 **Monday / early-season division & primetime → UNDER** — consistent but smaller/decaying.
5. ⚪ **Primetime → UNDER** — historically strong, now ~breakeven; watch whether it revives.

**ATS — track only, do not bet as trends:**
6. 🟡 **Pre-bye HOME team** (60%, pre-specified + mechanism) and **+7.5–10.5 dogs** (54%, 7/8) — the only
   ATS spots with a mechanism that re-validated; everything the scan produced is noise.

**ML:** no edge — market efficient across all favorite/dog buckets on vig-sane prices.

**Do not chase:** any ATS "situational/combo trend" from a search (proven noise here), big-fav-under,
favorite-longshot ML, and the Part-2 list.

---

## Reproducibility
`b3_engineer.py` (team-game feature library → tg.parquet), `b3_revalidate.py` (Part 1 per-season),
`b3_scan.py` (1,547-combo scan + guarding principle), `b3_null.py` (permutation FP control). Outputs in
`out/b3_*.txt`. Builds on Briefs #1–2 validated data + crosswalk + guardrails.
