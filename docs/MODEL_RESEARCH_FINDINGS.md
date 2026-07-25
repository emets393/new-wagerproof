# Model Research Findings — Bet-Type Ledger

Grading results from the research pipeline that decide which bet types WagerProof models
actually have an edge on. Relocated here from `README.md` on 2026-07-25, where they had been
pasted under the "Documentation" heading.

These are backtest findings, not live product behavior. Source scripts live under `research/`.

## Bet-type ledger (current)

| Status | Bet types |
|---|---|
| **WIRED** (edge confirmed) | spread, game O/U, team totals, 1H O/U |
| **DEAD** (no edge) | moneyline, 1H spread, 1H moneyline |

`MAMMOTH` is a conviction tier, not a bet type.

## Team totals vs posted lines — edge confirmed on bettable numbers

Source: `grade_tt_posted.py`. 4,418 team-games with both a model number and a posted closing
team total (2023-25, avg 4.3 books). Posted lines track the contrived consensus closely
(corr .996), so the edge had to be re-tested against real bettable numbers — it survived.

| Side | Contrived ref | Posted consensus | **Posted best-line shop** |
|---|---|---|---|
| UNDER (anchored ≤ line-3) | 56.3% | 55.6% | **58.4%, n=681, +11.6% ROI** (59/58/58 per season) |
| OVER (unanchored ≥ line+6) | 54.1% | 53.1% | **55.7%, n=467, +6.3% ROI** (56/53/59 per season) |

**Line-shopping is the win.** Shopping the 4-5 posting books adds ~+2.7pp *and* produces more
triggers, because the best available line creates additional qualifying edges.

The posted-vs-contrived gap on its own is thin (n=29-43); the under-side is suggestive at
58.6% but not standalone-tradeable.

**Product implication:** bet UNDER at the highest posted book / OVER at the lowest, when the
model edge gates hit. Roughly 225 unders + 155 overs per season at 56-58%.

## 1H moneyline — dead

Model 1H margin vs no-vig `h2h_h1` close. Straight-up win rate lands at 50.6-52.9% with **no
dose-response** — 52.6% → 52.9% → 50.6% as the modeled edge *rises*, which is the signature of
no real signal. The attractive-looking ROI is a big-dog variance artifact, the same trap that
full-game moneyline shows.

**Verdict: 1H ML is dead** — a derived, well-calibrated market like full-game ML.
