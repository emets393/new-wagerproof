#!/usr/bin/env python3
"""The one cell that cleared in tenure_study.py runs AGAINST the owner's theory: small-school teams whose rotation is BOTH the
youngest quintile (Jr/Sr minutes share) and the least cohesive quintile (3rd+-year-at-school share) cover early. Stress it:
2-D dose grid, overlap with the new-coach family, KenPom quintile / spread / venue splits, drop-one season, opener, power."""
import numpy as np, pandas as pd
rng = np.random.default_rng(3)
D = pd.read_parquet("tenure_games.parquet")
C = pd.read_parquet("../ncaab-continuity/tenure_games.parquet") if False else None
def rec(s): return int((s.win_ats > 0).sum()), int((s.win_ats < 0).sum())
def shuffle_p(mask, x, n=2000):
    obs = x.loc[mask, "win_ats"].sum(); codes = pd.factorize(x.season_end.astype(str) + "_" + x.mon.astype(str))[0]; vals = x.win_ats.values; m = mask.values
    order = np.argsort(codes, kind="stable"); groups = np.split(order, np.flatnonzero(np.diff(codes[order])) + 1); sims = np.empty(n)
    for i in range(n):
        perm = np.empty_like(vals)
        for idx in groups: perm[idx] = vals[rng.permutation(idx)]
        sims[i] = perm[m].sum()
    return float((np.abs(sims) >= abs(obs)).mean())
def line(mask, label, x=None, shuffle=False):
    x = D if x is None else x; s = x[mask]
    if len(s) < 30: print(f"   {label:<64} n={len(s)} thin"); return
    w, l = rec(s); roi = 100 * (w * 100 / 110 - l) / (w + l); z = (w - l) / np.sqrt(w + l)
    per = " ".join(f"{str(y)[2:]}:{rec(g)[0]}-{rec(g)[1]}" for y, g in s.groupby("season_end"))
    ow = int((s.win_open > 0).sum()); ol = int((s.win_open < 0).sum())
    ex = f" | shuffle p {shuffle_p(mask, x):.3f}" if shuffle else ""
    print(f"   {label:<64} BACK {w}-{l} ({100*w/(w+l):.1f}%, ROI {roi:+.1f}%, z {z:+.1f}) spr {s.spread.mean():+.1f} SU {100*(s.win>0).mean():.0f}% | {per} | opener {ow}-{ol} ({100*ow/max(1,ow+ol):.1f}%){ex}")
nd = D.novdec; e10 = D.early10; e5 = D.early5; sm = D.small
yt = D.q_upper_share; yc = D.q_core_share
print("=== 1. 2-D dose grid, small schools, Nov-Dec, BACK %: rows = tenure quintile (1 young .. 5 old), cols = cohesion quintile (1 all-new .. 5 together) ===")
g = D[nd & sm].groupby(["q_upper_share", "q_core_share"]).apply(lambda s: f"{100*rec(s)[0]/max(1,sum(rec(s))):.1f}% ({sum(rec(s))})").unstack()
print(g.to_string())
print("\n=== 2. the cell and its neighbours, Nov-Dec, small schools ===")
Y = (yt == 1) & (yc == 1) & sm
line(nd & Y, "young(Q1) AND new(Q1), small school", shuffle=True)
line(nd & (yt == 1) & (yc <= 2) & sm, "young Q1, cohesion Q1-2", shuffle=True)
line(nd & (yt <= 2) & (yc == 1) & sm, "tenure Q1-2, new Q1", shuffle=True)
line(nd & (yt <= 2) & (yc <= 2) & sm, "tenure Q1-2 AND cohesion Q1-2 (wider)", shuffle=True)
line(nd & (yt == 1) & sm, "young Q1 alone, small school")
line(nd & (yc == 1) & sm, "new Q1 alone, small school")
line(nd & (yt == 1) & (yc == 1) & ~sm, "young AND new, POWER conference")
line(nd & (yt == 1) & (yc == 1), "young AND new, all D1", shuffle=True)
print("\n=== 3. absolute thresholds instead of quintiles (so the rule is statable), Nov-Dec, small schools ===")
for ut in [0.10, 0.15, 0.20]:
    for ct in [0.0, 0.05]:
        m = nd & sm & (D.upper_share <= ut) & (D.core_share <= ct)
        line(m, f"Jr/Sr share <= {ut:.0%} and 3rd+-year share <= {ct:.0%}", shuffle=True)
print("\n=== 4. is this the new-coach / rebuilt family in disguise? (coach_yr from the panel; ret_share = any prior season here) ===")
nc = D.coach_yr == 1
line(nd & Y & nc, "young AND new, small, NEW head coach")
line(nd & Y & ~nc & D.coach_yr.notna(), "young AND new, small, SAME head coach", shuffle=True)
line(nd & Y & (D.ret_share <= 0.30), "young AND new, small, kept <=30% of minutes (rebuilt)")
line(nd & Y & (D.ret_share > 0.30), "young AND new, small, kept >30% (NOT rebuilt)")
line(nd & sm & nc & (D.ret_share <= 0.30) & (D.spread > 0), "REFERENCE: new coach + rebuilt + dog (continuity-study signal), small")
line(nd & sm & nc & (D.ret_share <= 0.30) & (D.spread > 0) & ~Y, "  ... of which NOT young-and-new")
line(nd & Y & ~(nc & (D.ret_share <= 0.30)), "young AND new, small, EXCLUDING new-coach+rebuilt teams", shuffle=True)
print("\n=== 5. splits of the cell, Nov-Dec, small schools ===")
for q in ["Q1 worst", "Q2", "Q3", "Q4", "Q5 best"]: line(nd & Y & (D.kp_q == q), f"KenPom preseason {q}")
line(nd & Y & (D.spread > 0), "underdog"); line(nd & Y & (D.spread >= 7), "dog of 7+"); line(nd & Y & (D.spread >= 12.5), "dog of 12.5+"); line(nd & Y & (D.spread < 0), "favorite")
line(nd & Y & (D.is_home == 1), "home"); line(nd & Y & (D.is_home == 0) & (D.neutral != 1), "away"); line(nd & Y & (D.neutral == 1), "neutral")
line(nd & Y & (D.o_csize == "power"), "vs power opponent"); line(nd & Y & (D.o_csize != "power"), "vs non-power opponent")
line(nd & Y & (D.csize == "low-major"), "low-major"); line(nd & Y & (D.csize == "mid-major"), "mid-major")
line(nd & Y & (D.gn <= 5), "games 1-5"); line(nd & Y & (D.gn > 5) & (D.gn <= 10), "games 6-10"); line(nd & Y & (D.gn > 10), "games 11+ (still Nov-Dec)")
line(D.janfeb & Y, "PLACEBO Jan-Feb"); line((D.mon == 3) & Y, "PLACEBO March")
line(nd & Y & (D.fresh_share >= 0.5), "freshmen play 50%+ of minutes"); line(nd & Y & (D.fresh_share < 0.5), "freshmen < 50%")
print("\n=== 6. drop-one season, Nov-Dec cell ===")
for y in sorted(D.season_end.unique()): line(nd & Y & (D.season_end != y), f"without {y}")
print("\n=== 7. how many teams / games a season ===")
print(D[nd & Y].groupby("season_end").agg(teams=("teamId", "nunique"), games=("teamId", "size")).to_string())
print("\n=== 8. same cell, TOTALS (over = win_tot>0) and 1H spread, Nov-Dec ===")
s = D[nd & Y]; o = int((s.tot_resid > 0).sum()); u = int((s.tot_resid < 0).sum()); print(f"   totals: over {o}-{u} ({100*o/(o+u):.1f}%)")
s1 = s[s.h1_ats_pts.notna()]; w1 = int((s1.h1_ats_pts > 0).sum()); l1 = int((s1.h1_ats_pts < 0).sum()); print(f"   1H spread: back {w1}-{l1} ({100*w1/max(1,w1+l1):.1f}%)")
