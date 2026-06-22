"""
RIVALRY big-mismatch trends: rivalry games where the underdog is getting +14 to +21 (regular season).
FINDINGS: (1) UNDER 60.4% (n96) - rivalry mismatches grind out / dog can't score. (2) Dog ATS flips by location:
AWAY dog covers 63.5% (back it) vs HOME dog covers 31.2% (fade it / lay the road favorite).
Saves per-season splits to gauge consistency (small cells ~3-7/yr).
"""
import os
import numpy as np
import pandas as pd
import rivalry_spots as RIV

HERE = os.path.dirname(os.path.abspath(__file__))
gm = pd.read_parquet(os.path.join(HERE, "data", "model_games.parquet"))
rivset = {frozenset(p) for p in RIV.RIVALRIES}
g = gm.copy()
g["is_riv"] = [frozenset((h, a)) in rivset for h, a in zip(g.homeTeam, g.awayTeam)]
g = g[g.is_riv & g.spread_close.notna() & g.actual_margin.notna()].copy()
g = g[(g.spread_close.abs() >= 14) & (g.spread_close.abs() <= 21)]
SEAS = sorted(g.season.unique())
def roi(w, n): return (w * 0.909 - (n - w)) / n * 100 if n else 0.0
def per_wl(b, col):
    return " ".join(f"{s}:{int(b[col][b.season==s].sum())}-{(b.season==s).sum()-int(b[col][b.season==s].sum())}" for s in SEAS if (b.season==s).sum() >= 1)

a = g[(g.actual_margin + g.spread_close) != 0].copy()
a["home_cover"] = (a.actual_margin + a.spread_close) > 0
a["dog_is_home"] = a.spread_close > 0
a["dog_cover"] = np.where(a.dog_is_home, a.home_cover, ~a.home_cover)
dh, da = a[a.dog_is_home], a[~a.dog_is_home]
print("=== RIVALRY, underdog +14 to +21, ATS (dog cover) ===")
print(f"  ALL dogs : {100*a.dog_cover.mean():.1f}% ({a.dog_cover.sum()}-{len(a)-a.dog_cover.sum()}) n={len(a)} roi{roi(int(a.dog_cover.sum()),len(a)):+.1f}")
print(f"  HOME dog : {100*dh.dog_cover.mean():.1f}% ({dh.dog_cover.sum()}-{len(dh)-dh.dog_cover.sum()}) n={len(dh)} roi{roi(int(dh.dog_cover.sum()),len(dh)):+.1f}  -> FADE (lay road fav)")
print(f"    per-season: {per_wl(dh,'dog_cover')}")
print(f"  AWAY dog : {100*da.dog_cover.mean():.1f}% ({da.dog_cover.sum()}-{len(da)-da.dog_cover.sum()}) n={len(da)} roi{roi(int(da.dog_cover.sum()),len(da)):+.1f}  -> BACK the road dog")
print(f"    per-season: {per_wl(da,'dog_cover')}")

o = g[g.actual_total.notna() & g.total_close.notna()].copy()
o = o[o.actual_total != o.total_close]; o["over"] = o.actual_total > o.total_close
print("\n=== RIVALRY, underdog +14 to +21, OVER/UNDER ===")
print(f"  OVER {100*o.over.mean():.1f}% ({o.over.sum()}-{len(o)-o.over.sum()}) -> UNDER {100*(1-o.over).mean():.1f}% n={len(o)} roi(under){roi(int((~o.over).sum()),len(o)):+.1f}")
print(f"    per-season (over-under): {per_wl(o,'over')}")
