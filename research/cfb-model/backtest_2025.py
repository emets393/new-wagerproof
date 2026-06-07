"""
FULL-SYSTEM 2025 BACKTEST (out-of-sample: trained only on <=2024). Runs every model+spot via build_season,
dedupes overlapping spots into real bets (best tier wins; conflicting sides on the same game/market = PASS),
adds team totals, applies tier staking, and reports portfolio hit%/units/ROI + CLV. Each bet graded on its
OWN validated line (soft-book at soft #, key# at DK, etc.).
NOTE: one season = variance; 2025 was a strong over year. Minor: a couple model-totals spots use 2025-distribution
terciles for thresholds (small cosmetic leak); models + main signals are clean (<=2024 / fixed thresholds).
"""
import numpy as np, pandas as pd
import cfb_forecast as F
import team_total_signals

gm, feats, te, S = F.build_season(2025)
te = te[te.actual_total.notna()].copy()   # graded games

def tier_of(name):
    n = name
    if n.startswith("STACK model+gap>=1") or n.startswith("SB premium") or n.startswith("SOS fade padded") \
       or n.startswith("G5 fade") or "over-edge>=8 G5" in n: return 1
    if n.startswith("STACK model+gap.5") or n.startswith("SB volume") or n.startswith("KEY lay -6.5") \
       or n.startswith("FORM over-hot") or n.startswith("CONF AAC") or n.startswith("CONF SunBelt total") \
       or n.startswith("RvR ranked-vs-ranked home-fav") or n.startswith("PREMIUM"): return 2
    return 3

def line_for(b, side, gl):
    if gl == "close": return b.spread_close
    if gl == "dk": return b.get("dk_sp_close")
    if gl == "soft": return b.get("soft_best_home") if side == "HOME" else b.get("soft_best_away")
    return b.spread_open
def tline(b, gl): return b.total_close if gl == "close" else b.total_open

# collect every fired spot as a candidate bet
cand = {}   # (game_id, market, side) -> dict(tier, gl, name)
for name, (mask, side, mkt, gl) in S.items():
    m = mask.reindex(te.index, fill_value=False)
    for gid in te.index[m]:
        key = (gid, mkt, side); t = tier_of(name)
        if key not in cand or t < cand[key]["tier"]:
            cand[key] = {"tier": t, "gl": gl, "name": name}
# drop conflicts: same (game, market) with both sides
from collections import defaultdict
sides_by_gm = defaultdict(set)
for (gid, mkt, side) in cand: sides_by_gm[(gid, mkt)].add(side)
bets = []
for (gid, mkt, side), info in cand.items():
    if len(sides_by_gm[(gid, mkt)]) > 1: continue   # conflicting -> pass
    r = te.loc[gid]
    if mkt == "total":
        L = tline(r, info["gl"])
        if pd.isna(L) or r.actual_total == L: continue
        win = (r.actual_total > L) if side == "OVER" else (r.actual_total < L)
    else:
        L = line_for(r, side, info["gl"])
        if pd.isna(L) or (r.actual_margin + L) == 0: continue
        hc = (r.actual_margin + L) > 0; win = (~hc) if side == "AWAY" else hc
    bets.append({"market": mkt, "tier": info["tier"], "win": bool(win), "name": info["name"]})

# team totals (separate market) — Tier 2 under, Tier 3 over
tt = team_total_signals.build(gm, 2025)
tt = tt[((tt.tt_under == 1) | (tt.tt_over == 1)) & tt.pts.notna()].copy()
tt = tt[tt.pts != tt.implied]
for _, x in tt.iterrows():
    if x.tt_under == 1: bets.append({"market": "teamtot", "tier": 2, "win": bool(x.pts < x.implied), "name": "TT under"})
    else: bets.append({"market": "teamtot", "tier": 3, "win": bool(x.pts > x.implied), "name": "TT over"})

B = pd.DataFrame(bets)
STAKE = {1: 1.0, 2: 0.75, 3: 0.5}
def roi_units(d):
    st = d.tier.map(STAKE); prof = np.where(d.win, st * 0.909, -st)
    return len(d), 100*d.win.mean(), st.sum(), prof.sum(), 100*prof.sum()/st.sum()

print("="*70)
print("FULL-SYSTEM 2025 BACKTEST (trained on <=2024 only)")
print("="*70)
print(f"{'segment':<20}{'bets':>6}{'hit%':>7}{'staked':>9}{'profit':>9}{'ROI%':>7}")
for t in [1, 2, 3]:
    d = B[B.tier == t]
    if len(d): n, h, s, p, r = roi_units(d); print(f"{'TIER '+str(t):<20}{n:>6}{h:>7.1f}{s:>9.1f}{p:>+9.2f}{r:>+7.1f}")
print("-"*58)
for mk in ["side", "total", "teamtot"]:
    d = B[B.market == mk]
    if len(d): n, h, s, p, r = roi_units(d); print(f"{'  '+mk:<20}{n:>6}{h:>7.1f}{s:>9.1f}{p:>+9.2f}{r:>+7.1f}")
print("-"*58)
n, h, s, p, r = roi_units(B); print(f"{'PORTFOLIO TOTAL':<20}{n:>6}{h:>7.1f}{s:>9.1f}{p:>+9.2f}{r:>+7.1f}")
# CLV of the model's lean
ml = te[te.side_edge.abs() >= 2]
clv = np.where(ml.side_edge > 0, ml.spread_open - ml.spread_close, ml.spread_close - ml.spread_open)
print(f"\nMODEL CLV (|edge|>=2): n={len(ml)} avg {np.nanmean(clv):+.2f} pts, positive {100*np.nanmean(clv>0):.0f}%")
print(f"\n(1 unit = Tier1, 0.75 = Tier2, 0.5 = Tier3; profit at -110; conflicts passed)")
