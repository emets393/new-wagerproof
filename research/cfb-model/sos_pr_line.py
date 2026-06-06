"""
Is the padded road team's POWER RATING baked into the line? Build a PR-implied margin from net_rating_diff
(walk-forward calibration: actual_margin ~ net_rating_diff; intercept = HFA in points). Compare to the market
margin (-spread_close). Within the padded-road-team spots (away good rating + weak SOS), ask:
  - does the market favor the road team MORE or LESS than the power rating implies?
  - when market TRUSTS the padding (line >= PR-implied for the road team) vs DISCOUNTS it, what are the results?
resid = mkt_margin - PR_margin (home persp). resid<0 = market MORE on road team than PR (over-trusts padding).
Grade ATS @ close, per-season + 2025 holdout.
"""
import numpy as np
import pandas as pd

gm = pd.read_parquet("data/model_games.parquet")
g = gm[gm.spread_close.notna() & gm.actual_margin.notna() & gm.net_rating_diff.notna()].copy()
def roi(w, n): return (w * 0.909 - (n - w)) / n * 100 if n else 0.0
TS = [2021, 2022, 2023, 2024, 2025]

# as-of SOS (overall) per team
rows = []
for _, r in g.iterrows():
    rows.append({"season": r.season, "week": r.week, "game_id": r.game_id, "team": r.homeTeam, "opp_net": r.away_net_rating})
    rows.append({"season": r.season, "week": r.week, "game_id": r.game_id, "team": r.awayTeam, "opp_net": r.home_net_rating})
L = pd.DataFrame(rows).sort_values(["team", "season", "week"]); gbb = L.groupby(["team", "season"], group_keys=False)
L["sos"] = gbb["opp_net"].apply(lambda s: s.shift().expanding().mean()); L["np"] = gbb.cumcount()
asof = L[["season", "game_id", "team", "sos", "np"]]
G = g.merge(asof.rename(columns={"team": "homeTeam", "sos": "h_sos", "np": "h_np"}), on=["season", "game_id", "homeTeam"]) \
     .merge(asof.rename(columns={"team": "awayTeam", "sos": "a_sos", "np": "a_np"}), on=["season", "game_id", "awayTeam"])
G = G[(G.h_np >= 4) & (G.a_np >= 4)].copy()
G["hc"] = (G.actual_margin + G.spread_close) > 0
G = G[(G.actual_margin + G.spread_close) != 0]

# walk-forward PR calibration: actual_margin ~ net_rating_diff (intercept=HFA pts)
G["pr_margin"] = np.nan
for S in TS:
    pri = G[G.season < S]
    if len(pri) < 200: continue
    b1, b0 = np.polyfit(pri.net_rating_diff, pri.actual_margin, 1)
    G.loc[G.season == S, "pr_margin"] = b0 + b1 * G.loc[G.season == S, "net_rating_diff"]
G = G[G.pr_margin.notna()].copy()
G["mkt_margin"] = -G.spread_close
G["resid"] = G.mkt_margin - G.pr_margin     # >0 market higher on HOME than PR; <0 market higher on ROAD team than PR
b1f, b0f = np.polyfit(G.net_rating_diff, G.actual_margin, 1)
print(f"PR calibration: ~{b1f:.1f} pts per net_rating unit, HFA(intercept)={b0f:.2f} pts\n")

# padded road team spot
amed = G.away_net_rating.median(); sosq = G.a_sos.quantile(0.4)
P = G[(G.away_net_rating > amed) & (G.a_sos < sosq)].copy()
print(f"PADDED ROAD TEAM spots: n={len(P)} | base home-cover {100*P.hc.mean():.1f}%")
print(f"  avg market road spread {(-P.mkt_margin).mean():+.1f} (road fav by {P.mkt_margin.mean():.1f})")
print(f"  avg PR-implied road margin {P.pr_margin.mean():+.1f} | mean resid (mkt-PR) {P.resid.mean():+.2f}")
print(f"  => market favors the road team {'MORE' if P.resid.mean()<0 else 'LESS'} than power rating implies by {abs(P.resid.mean()):.1f} pts on avg\n")

def per(b, w): return "/".join(f"{100*w[b.season==s].mean():.0f}" if (b.season==s).sum()>=6 else "--" for s in TS)
def show(lab, b):
    if len(b) < 25: print(f"  {lab:<42} n={len(b)} (thin)"); return
    w = b.hc; pool = b[b.season <= 2024]; hold = b[b.season == 2025]
    print(f"  {lab:<42} bet HOME {100*w.mean():4.1f}% n={len(b):<4} | pool {100*pool.hc.mean():.0f}% | 2025 {100*hold.hc.mean():.0f}%(n{len(hold)}) roi{roi(int(w.sum()),len(b)):+.1f} [{per(b,w)}]")
print("=== within padded-road spots: split by market-vs-PR residual ===")
show("market TRUSTS padding (resid<=-1: mkt more on road)", P[P.resid <= -1])
show("market NEUTRAL (-1<resid<1)", P[(P.resid > -1) & (P.resid < 1)])
show("market DISCOUNTS padding (resid>=+1: mkt off road)", P[P.resid >= 1])
show("STRONG trust (resid<=-3)", P[P.resid <= -3])
print("\n=== for reference: ALL games by resid (does market-vs-PR predict generally?) ===")
for lab, m in [("resid<=-3 (mkt over-trusts home... bet away)", G.resid<=-3), ("resid>=+3 (mkt over-trusts road... bet home)", G.resid>=3)]:
    b = G[m]; w = b.hc if "bet home" in lab.lower() else ~b.hc
    bet = "home" if "bet home" in lab.lower() else "away"
    print(f"  {lab:<46} bet {bet} {100*w.mean():.1f}% n={len(b)} [{per(b,w)}]")
