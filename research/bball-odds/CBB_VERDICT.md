# CBB — the verdict

> **This file is hand-written and no script overwrites it.** Every other `CBB_*.md` in this
> directory is regenerated wholesale by its script and will destroy anything you type into it.
> Put conclusions here; put tables there.
>
> Rewritten 2026-08-01 after the per-market rebuild. **The previous version of this file is
> superseded in five places** — the conference-only restriction, the full-game total, the
> first-half half-life, the "one model per market" premise, and the absence of any all-games
> product number. Do not quote the old numbers from memory.

## THE ONE-LINE ANSWER

**One team-points model, 164 features, 365-day half-life, no posted line on its input side.**
Every market is arithmetic on that one fit. It beats the closing line on the full-game spread
across all 17,196 graded games — the first college model in this repo that does — and the
advantage is *concentrated* in games where it disagrees with the book by 1.5 to 4 points.

---

## ⭐ 1. THE PRODUCT: a number on every game that beats the book

This is the headline, and it is not a bet — it is the thing shown to every user on every game.
No filtering, no selectivity, every game the market priced.

| market | games | model MAE | market MAE | model better by | paired t |
|---|---|---|---|---|---|
| **Full-game spread** | 17,196 | **8.951** | 8.983 | **+0.032** | **+3.14** |
| First-half spread | 17,003 | 7.327 | 7.337 | +0.010 | +1.14 |
| Team total | 32,692 | 7.964 | 7.963 | −0.001 | −0.08 |
| First-half total | 17,029 | 7.974 | 7.965 | −0.009 | −0.92 |
| Full-game total | 17,293 | 13.131 | 13.095 | −0.035 | −2.38 |
| Moneyline | 17,315 | — | — | corr **+0.2230** | — |
| First-half moneyline | 16,502 | — | — | corr +0.1659 | — |

**The comparison is PAIRED, per game.** The model and the book forecast the same game, so the
noise that dominates both — how the game actually went — cancels. An unpaired comparison of two
~9-point MAEs on 17k games could not resolve 0.03 either way.

**Full-game spread, per season (model MAE − market MAE, negative = model wins):**
−0.042 · −0.012 · −0.025 · −0.015. **Four seasons out of four.**

For scale: the previous college model (`NCAAB_MODEL_BRIEF2.md`) posted 9.11 against the market's
8.80 and lost by 0.31. This is a 0.34-point swing in MAE and a change of sign.

**Why this statistic settled things ROI could not.** A 2,368-bet ROI cell carries one sigma of
±2.0%; the MAE test runs on 17,196 unfiltered games with the game-level noise differenced out, so
it is roughly 20× more powerful. It is what decided the cut-vs-uncut question below, after the ROI
ladders had been ambiguous for two runs.

### The other markets, honestly

The full-game total is the one place the model is currently behind the book pooled (−0.035) — but
**read the season row, not the pool**: +1.532 · +0.072 · +0.037 · **−0.000**. The gap is almost
entirely 2022-23, a season with a thin feature history, and it has converged to parity and crossed
over in 2025-26. It is a market the model has caught up to, not one it fails at. Team total and
first-half total sit at parity (|t| < 1). The first-half spread is ahead but not significantly.

---

## ⭐ 2. THE BET: full-game spread, 1.5 to 4 points off the line, ALL games

**4,373 bets · 55.6% · base 50.3% · +6.1% ROI · z +3.62** at ≥1.5 across all games.
Tighter: **2,368 bets · 56.7% · +8.3% · z +2.96** at ≥2. Per season at ≥2: **+8.4 / +9.9 / +5.7%,
all three graded seasons positive.**

### The band table — the most valuable result in this file

Each game lands in **exactly one** band by |model − line|. **Nothing is filtered and no band is a
subset of another**, so unlike the ROI ladder these rows cannot inherit each other's selection.

| band | games | model MAE | market MAE | model better by | paired t | win% | ROI |
|---|---|---|---|---|---|---|---|
| 0–0.5 | 5,327 | 9.076 | 9.080 | +0.004 | +1.06 | 50.9 | −2.8 |
| 0.5–1 | 4,414 | 8.932 | 8.944 | +0.012 | +1.05 | 51.3 | −2.1 |
| 1–1.5 | 3,082 | 8.833 | 8.862 | +0.029 | +1.30 | 52.9 | +1.1 |
| **1.5–2** | 2,005 | 8.845 | 8.907 | **+0.062** | +1.62 | 54.2 | **+3.6** |
| **2–3** | 1,775 | 8.893 | 9.030 | **+0.137** | **+2.46** | 56.2 | **+7.4** |
| **3–4** | 468 | 9.064 | 9.258 | **+0.194** | +1.30 | 59.2 | **+13.1** |
| ⚠ 4+ | **125** | 9.359 | 8.760 | **−0.599** | −1.60 | 54.4 | +3.9 |

**The advantage rises monotonically through 3–4 and then reverses.** This is the mechanical
justification for the bet rule: the ROI ladder alone could always have been selection, but MAE on
disjoint bands cannot be. And the honest failure mode is ruled out — `market MAE` is flat across
the middle (9.08 → 8.94 → 8.86 → 8.91 → 9.03), so the model is getting *better* on those games,
the book is not getting worse.

**The 4+ ceiling — a flag, not yet a law.** 125 games, model 0.6 points WORSE than the line,
t −1.60. It does not move the pooled ROI much (capping at 4 takes +6.1% to +6.2%), so this is not
an urgent money decision. But it is the only band where the sign flips, and the mechanism is
plausible: a 4-point college disagreement usually means the model is missing something the book
knows (a late scratch, a travel note) rather than seeing something it doesn't. **Treat >4 as
"model uncertain, do not size up" and re-measure it after a season of live data.**

### The conference-only restriction is RETIRED

The old verdict bet conference games only and called non-conference dead. **That was an artefact of
the shared feature set.** On the spread's own 164-feature model, non-conference at ≥2 grades
**1,010 bets, +5.9%, z +2.28** — a live slice, not a dead one.

| slice at ≥2 | bets | win% | base% | ROI | z |
|---|---|---|---|---|---|
| **all games** | **2,368** | **56.7** | **50.3** | **+8.3** | **+2.80** |
| conference | 1,358 | 57.7 | 50.3 | +10.1 | +2.33 |
| non-conference | 1,010 | 55.4 | 50.4 | +5.9 | +2.28 |

Conference still pays more *per bet*. It does not pay more *in total*: 1,358 × 10.1% = 137 units
against all-games 2,368 × 8.3% = 197 units. And the restriction is selection — picking conference
off a two-slice menu clears its own nulls by z +3.37 at ≥1.5, +2.67 at ≥2, **+1.32 at ≥2.5**, and
at ≥3 the menu winner *flips* to non-conference. A filter whose winner changes with the rung is
not a filter. **Bet all games; the band does the selecting.**

### Bands for the other markets — where the same logic does NOT apply

- **Full-game total: the band gradient runs BACKWARDS** (+0.006 → +0.009 → +0.013 → −0.040 →
  −0.013 → −0.205 → −0.333), ROI negative in 6 of 7 bands. Do not build a points-off-the-line bet
  rule on the total. Its recent-season gains are a **season** effect, not a **band** effect —
  different thing, do not conflate them.
- **Team total: flat.** No gradient in either direction.
- **First-half spread: a narrow window at 1.5–3** (+0.063 and +0.057; ROI +4.6 / +5.4), then it
  reverses at 3–4. Real but thin, and see the Rule-B warning below.

---

## ⭐ 3. THE ARCHITECTURE: one model, not seven — and that was the surprise

The whole per-market exercise was run to find out whether college wants a different feature set
per market, the way the NBA does. **The answer is no.** Three stages of family ablation, half-life
sweeps and null-graded confirmation produced exactly ONE durable feature-set result: the full-game
spread's 164-feature cut. Everything else was the half-life, or inside noise.

**This is the opposite of the NBA**, which needed three feature sets and three half-lives inside
one sport. Do not port that expectation here.

**The structural reason, raised by the owner and verified in `cbb_panel.py`:** the team total IS
the model's raw output (`d = fg + (impl − line)`), the full-game total is the sum of the two rows
and the spread is their difference. Give `fg_total` and `fg_spread` different feature sets and you
get two different predicted point totals for the same team, and `tt` becomes undefined. The panel
layout forces one model.

### The shipping configuration

| | features | half-life | cuts |
|---|---|---|---|
| **Full game** | **164** | **365d** | `form_l5`, `heat`, `season_s2d` |
| **First half** | **220** | **365d** | `adv`, `season_s2d`, `star` (total) / `context`, `schedule` (spread) |

The 164-feature cut beats the 236-feature uncut model on **every full-game market**: spread
+0.032 vs +0.023, total −0.035 vs −0.051, team total −0.001 vs −0.007, moneyline corr +0.2230 vs
+0.2166. It wins on the product statistic, which is the one with the power.

**The first-half improvement was the HALF-LIFE, not the features.** `h1_total`: 236 feats @240d =
+3.4%, 236 feats @**365d = +5.1%**, cut @240d = +4.4%, cut @365d = +5.3%. `h1_spread`: +4.7 / +5.0
/ +5.0 / +4.8 — all four cells identical, nothing the features did moved it. The old verdict
shipped 240d for the first half; **that is now 365d, same as the full game.**

### THE AGGREGATE GATE — a rule amendment, and why

The pre-registered family cut was applied to all seven markets and made the **moneyline worse**
(cut: +2.5% at ≥5, z +1.07; uncut: **+4.5%, z +2.34**). That was not bad luck. It was the rule
reading the half of the ablation table that `feature-pruning-drop-one-vs-solo` rule 9 says is
unreadable: every `fg_ml` drop-one delta (−2.59 to +2.15) sat inside that cell's one sigma of
±2.29. The rule confidently cut 133 features off pure noise.

**AMENDED RULE, applied uniformly:** a market is cut only if its **mean** drop-one delta is
positive; only then does the family rule decide *which* families go.

| market | mean drop-one Δ | over-parameterised? |
|---|---|---|
| `h1_spread` | **+0.64** | yes — cut |
| `h1_total` | **+0.46** | yes — cut |
| `fg_ml` | −0.11 | no |
| `fg_spread` | −0.64 | no by the gate — **but cut anyway, and the product statistic says the cut was right** |
| `fg_total` | −0.65 | no |
| `h1_ml` | −0.68 | no |
| `tt` | −0.71 | no |

**Note the honest tension in row four.** The gate says leave the spread alone; the MAE result says
the 164-feature cut is better on every market. The gate is a *default*, overridable by the
higher-powered statistic — which is exactly what happened here. Both are recorded because a doc
that hid the disagreement would be lying.

**And `CBB_PRUNE.md`'s dilution reading does not generalise.** "Mean +0.73, 13 of 17 improve" was
ONE grading cell of ONE shared model. Re-measured per market, five of seven markets have a
*negative* mean delta — they are not over-parameterised at all.

### Bet-count matching — a mistake made and corrected mid-run

I reported tt / fg_total / fg_spread improvements from the cut without noting that the cut places
20–40% fewer bets at the same points rung. Fewer features = less volatile predictions = fewer
games clearing a fixed cut. **Comparing configs at a fixed rung compares two STRATEGIES, not two
feature sets** — rule 4 of `feature-pruning-drop-one-vs-solo`, violated by its own author. At
matched counts the tt and fg_total "improvements" vanish. Only the spread's survives, and only the
unfiltered MAE test settles it.

---

## 4. TWO CUTS THAT WERE STRUCTURAL FACTS

**CUT 1 — `impl`, the market anchor, was a FEATURE. A live breach of the originator rule.** The
full-game-implied team total (posted total and spread, rotated) sat in the feature list while
`cbb_panel.py`'s own docstring flatly denied any line reached the input side. `assert_originator()`
missed it because it only ran on the WIDE candidate list; `impl` is constructed inside
`build_panel`. **The check now runs on the panel's own `fcols` too — do that everywhere.** Removing
it was free. `impl` stays as a *column* (it anchors the target and the grading), never a *feature*.

**CUT 2 — one of two identical copies of the style percentiles.** `cbb_blocks.py` re-attached
`sty_pct_*` when the sides table already carried the identical `pct_*`. Verified: **32 of 32
own/opp pairs identical, max absolute difference exactly 0.00e+00.** Two copies draw twice the
shrinkage budget of one, silently upweighting style against everything else.

## 5. WHAT THE PRUNE SAID ABOUT THE DATA

**Load-bearing families — removal HURTS:** `lineup` (−1.41), `schedule` (−0.88), `availability`
(−0.72), `roster` (−0.19). Two of those answer standing questions:

- **The injury/availability data IS used and earns its place** — 12 columns, one of only four
  families that hurt when removed, +2.26% solo.
- **`lineup` is the single most load-bearing family**, independently replicating
  `ncaab-model-lab`'s "largest single-group gain in the entire lab" on a different target, row
  layout and fitting method.

## 6. COLLEGE INVERTS THE NBA ON MEMORY

Both models improve **monotonically from a 45-day half-life out to a full year**, at all three
selectivities — the opposite of the NBA, where pooled was the worst setting in every market. ~360
teams × ~31 games starves a short window faster than regime drift spoils a long one. Inheriting
the NBA's 180d would have cost ~3 points of ROI. `model-regime-drift-law` survives; **its answer
is sport-specific. Sweep it, never inherit it.**

## 7. VALIDATION

All seven markets pass the realised-result oracle at 100.0%. `assert_originator` passes on both
the wide list and the panel's own `fcols`. Mirror check passes on the panel melt. 264 player-block
columns attached with a leak screen, 0 flagged. Nulls are 20 game-level shuffles; slices chosen
off a menu are graded against nulls allowed the best of the same menu.

## 8. STILL OPEN

1. **Re-run `cbb_tt_gate.py`** on the shipping 164-feature model. The derived-market gating law was
   tested against the old shared fits, and `tt` being the raw model output is exactly the case that
   law addresses.
2. **Re-test Rule B.** The first-half and full-game spreads took the same side 100.0% of the time
   on the old *shared* model, which is why the gated 1H spread was retracted as a second bet. They
   now run on **different** feature sets (164 vs 220), so the agreement rate must be re-measured
   before anyone sizes them separately. Until then: same position, different price.
3. **The h1_spread side asymmetry** (AWAY +6.8 vs HOME −0.4) has not had the 2×2 + nulls treatment.
4. **Re-measure KenPom.** It read −7.26% solo while `impl` was still anchoring the target, so
   KenPom's team-strength LEVEL sat inside the anchor. With `impl` gone this must be re-run.
5. **The 4+ band ceiling** needs a season of live data — 125 games and t −1.60 is a flag, not a
   finding.

## WHERE THE FILES ARE

| file | what it holds | regenerated? |
|---|---|---|
| `CBB_VERDICT.md` | this — the conclusion | **no, hand-written** |
| `CBB_PRODUCT.md` | MAE vs the market on every game, cut and uncut | yes, `--stage product` |
| `CBB_BANDS.md` | the disjoint-band concentration table | yes, `--stage bands` |
| `CBB_MARKET_ABLATE.md` | per-market drop-one + solo family ablation | yes, `--stage ablate` |
| `CBB_MARKET_GATE.md` | CUT vs GATED, per market, with season tiebreaks | yes, `--stage gate` |
| `CBB_MARKET_DECOMP.md` | 1H features-vs-half-life 2×2; conference on cut vs uncut | yes, `--stage decomp` |
| `CBB_MARKET_CONFIRM.md` | the conference restriction against selection-paid nulls | yes, `--stage confirm` |
| `CBB_PANEL_ALL.md` | all seven markets, ladders + season/phase/side splits | yes, `cbb_panel.py` |
| `CBB_PRUNE.md` | the ORIGINAL shared-model ablation — **superseded, see §3** | yes, `cbb_prune.py` |
| `CBB_HL_SWEEP.md` | half-life sweep — **pre-cut, not re-run** | yes, `cbb_hl_sweep.py` |
| `cbb_market_models.py` | every stage above | — |
| `cbb_panel.py` | the panel, the two fits, `markets()`, the oracle | — |
| `cbb_blocks.py` | player/lineup/style/availability block attachment | — |

**Nothing here is wired to production. This is research only.** There is no CBB pipeline in
`cfb_automation`, no slate table, and no live odds capture.
