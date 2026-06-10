"""
b91 — MAMMOTH PLAY detector: rare 3-unit plays where independent edges ALIGN.

USER SPEC: bets ~5 games/week. Wants the rare games where everything lines up —
model + confirmation layer + independent spot signals all pointing the same way.
Expect a handful per season, not per week.

PRE-REGISTERED DEFINITIONS (stated BEFORE looking at results; no threshold tuning below)
  SPREAD MAMMOTH = sides_model pick where ALL of:
    (a) classifier edge >= 0.06 (2x the locked CONF gate)
    (b) confluence == 1 (b70 regression layer agrees on direction)
    (c) >= 1 ACTIVE TIER-1 spread spot rule fires on the SAME game picking the SAME side
  TOTAL MAMMOTH = >= 2 independent ACTIVE total rules fire on the SAME game, SAME direction.

EVIDENCE TABLES (descriptive, not used to tune the definition):
  - dose-response: sides_model hit% by # aligned spot rules (0 / 1 / 2+) and by conf bucket
  - per-season honesty: 2023, 2024, 2025 separately (odds_consensus starts 2023)

Uses the production harness pipelines directly (generate+grade are idempotent).
"""
import os, sys, warnings
import numpy as np, pandas as pd
warnings.filterwarnings("ignore")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from stats_helpers import wilson_ci
import forecast_harness as fh
L = print

SPREAD_SPOTS = {"legacy_fade", "legacy_primetime", "spread_dog_cover_fade_away", "spread_dog_cover_fade_home",
                "fade_pr_in_tight_game", "dk_heavy_home_juice", "tight_soft_ml_fade_home", "top_vs_top_pt_home"}
TOTAL_SPOTS = {"receiver_over", "receiver_over_HC", "wind_under", "total_low_line_over",
               "total_high_line_under", "dk_giant_fav_over"}

m, BASE = fh.build()
YEARS = [2023, 2024, 2025]
leds = []
for y in YEARS:
    fh.generate(m, BASE, y)
    leds.append(fh.grade(m, y))
led = pd.concat(leds, ignore_index=True)
g = led.dropna(subset=["win"]).copy()
L(f"[ledger] graded picks 2023-2025: {len(g)}")

def summarize(tag, df):
    if len(df) == 0: L(f"  {tag:42s}: (none)"); return
    k = int(df.win.sum()); n = len(df); lo, hi = wilson_ci(k, n)
    roi = df.roi_u.sum() / n * 100; clv = df.clv_pts.mean()
    L(f"  {tag:42s}: {k}/{n}={k/n*100:.1f}% CI[{lo*100:.0f},{hi*100:.0f}] ROI={roi:+.1f}% CLV={clv:+.2f}")

# ---------- direction helpers ----------
sm = g[g.rule == "sides_model"].copy()
sp = g[(g.rule.isin(SPREAD_SPOTS)) & (g.market == "spread")].copy()
tt = g[(g.rule.isin(TOTAL_SPOTS)) & (g.market == "total")].copy()
tt["dir"] = np.where(tt.bet_home == -1, "OVER", "UNDER")

# aligned spot count per sides_model pick (same season/week/game, same bet_home side)
key = ["season", "week", "game"]
agree = sp.merge(sm[key + ["bet_home"]].rename(columns={"bet_home": "sm_side"}), on=key)
agree = agree[agree.bet_home == agree.sm_side]
n_agree = agree.groupby(key).size().rename("n_aligned").reset_index()
sm = sm.merge(n_agree, on=key, how="left"); sm["n_aligned"] = sm.n_aligned.fillna(0).astype(int)
sm["conf"] = sm.edge.abs()

L("\n" + "=" * 92)
L("DOSE-RESPONSE — sides_model hit% by # aligned TIER-1 spread spots (pooled 2023-25)")
L("=" * 92)
for k_, lab in [(0, "0 aligned"), (1, "1 aligned"), (2, "2+ aligned")]:
    sub = sm[sm.n_aligned >= 2] if k_ == 2 else sm[sm.n_aligned == k_]
    summarize(lab, sub)
L("\nBY CONF BUCKET (sides_model):")
for lo_, hi_, lab in [(0.03, 0.06, "conf 0.03-0.06"), (0.06, 0.10, "conf 0.06-0.10"), (0.10, 1.0, "conf 0.10+")]:
    summarize(lab, sm[(sm.conf >= lo_) & (sm.conf < hi_)])
L("\nCONF x ALIGNMENT GRID:")
for lo_, hi_, lab in [(0.03, 0.06, "0.03-0.06"), (0.06, 1.0, "0.06+")]:
    for k_ in [0, 1]:
        sub = sm[(sm.conf >= lo_) & (sm.conf < hi_) & ((sm.n_aligned >= 1) if k_ else (sm.n_aligned == 0))]
        summarize(f"conf {lab} & {'>=1' if k_ else '0'} aligned", sub)
L("\nCONFLUENCE INTERACTION:")
sm["confluence"] = sm.confluence.fillna(0).astype(int)
for cf in [0, 1]:
    for k_ in [0, 1]:
        sub = sm[(sm.confluence == cf) & ((sm.n_aligned >= 1) if k_ else (sm.n_aligned == 0))]
        summarize(f"confluence={cf} & {'>=1' if k_ else '0'} aligned", sub)

# ---------- PRE-REGISTERED SPREAD MAMMOTH ----------
L("\n" + "=" * 92)
L("SPREAD MAMMOTH (pre-registered: conf>=0.06 & confluence=1 & >=1 aligned spot)")
L("=" * 92)
mam = sm[(sm.conf >= 0.06) & (sm.confluence == 1) & (sm.n_aligned >= 1)]
summarize("SPREAD MAMMOTH pooled", mam)
for y in YEARS: summarize(f"  {y}", mam[mam.season == y])
L(f"  frequency: {len(mam)} plays over {len(YEARS)} seasons = {len(mam)/(len(YEARS)*18):.2f}/week")
if len(mam): L("\n  plays:"); [L(f"    {r.season} W{r.week:>2} {r.game:12s} {r.side:12s} conf={r.conf:.3f} aligned={r.n_aligned} win={r.win:.0f}") for _, r in mam.sort_values(["season", "week"]).iterrows()]

# relaxed tiers for context (descriptive)
L("\nRELAXED TIERS (context only):")
summarize("conf>=0.06 & confluence=1 (no spot req)", sm[(sm.conf >= 0.06) & (sm.confluence == 1)])
summarize("confluence=1 & >=1 aligned (no conf req)", sm[(sm.confluence == 1) & (sm.n_aligned >= 1)])
summarize("conf>=0.06 & >=1 aligned (no confl req)", sm[(sm.conf >= 0.06) & (sm.n_aligned >= 1)])

# ---------- PRE-REGISTERED TOTAL MAMMOTH ----------
L("\n" + "=" * 92)
L("TOTAL MAMMOTH (pre-registered: >=2 independent total rules, same game, same direction)")
L("=" * 92)
cnt = tt.groupby(key + ["dir"]).agg(n_rules=("rule", "nunique"), win=("win", "first"),
                                    roi_u=("roi_u", "first"), clv_pts=("clv_pts", "mean"),
                                    rules=("rule", lambda s: "+".join(sorted(set(s))))).reset_index()
tm = cnt[cnt.n_rules >= 2]
summarize("TOTAL MAMMOTH pooled", tm)
for y in YEARS: summarize(f"  {y}", tm[tm.season == y])
L(f"  frequency: {len(tm)} plays = {len(tm)/(len(YEARS)*18):.2f}/week")
if len(tm): L("\n  plays:"); [L(f"    {r.season} W{r.week:>2} {r.game:12s} {r['dir']:5s} rules={r.rules} win={r.win:.0f}") for _, r in tm.sort_values(["season", "week"]).iterrows()]
L("\nsingle-rule totals baseline (context):")
summarize("exactly 1 total rule", cnt[cnt.n_rules == 1])

# conflicting totals signals (OVER + UNDER same game) — how often, what wins?
both = cnt.groupby(key).dir.nunique()
L(f"\nconflicting-direction total games: {(both > 1).sum()}")
L("\n[done] b91")
