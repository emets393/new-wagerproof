#!/usr/bin/env python3
"""The fair test of the Walters method: his number against the OPENER, and does the line come
to us? (owner, 2026-10-06)

WHY. Grading against the CLOSE asks "can we beat the market's final, fully-informed number",
which is a question Walters never had to answer — he bet early numbers and the market moved to
him. An originator is measured two ways:
  1. the record against the line he actually got (the OPENER / best early number)
  2. CLV -- whether the closing line MOVES TOWARD his side. CLV is the honest proof of
     origination, because it does not depend on the games landing.

Same walk-forward 90/10 rating as walters_rating.py; nothing here sees a result before
predicting it. Odds history is 2023-2026 (research/nfl-extreme-outcomes/data/odds_hist.parquet,
17 books, snapshot feed), so this is ~1,000 games, not 5,700 -- stated, not buried.
"""
import io, sys, warnings
import numpy as np, pandas as pd, requests
warnings.filterwarnings("ignore")
sys.path.insert(0, "/Users/chrishabib/Documents/new-wagerproof/research")
from point_value import edge_pct, _counts

NV = {"Arizona":"ARI","Atlanta":"ATL","Baltimore":"BAL","Buffalo":"BUF","Carolina":"CAR",
      "Chicago":"CHI","Cincinnati":"CIN","Cleveland":"CLE","Dallas":"DAL","Denver":"DEN",
      "Detroit":"DET","Green Bay":"GB","Houston":"HOU","Indianapolis":"IND","Jacksonville":"JAX",
      "Kansas City":"KC","LA Chargers":"LAC","LA Rams":"LA","Las Vegas":"LV","Miami":"MIA",
      "Minnesota":"MIN","NY Giants":"NYG","NY Jets":"NYJ","New England":"NE","New Orleans":"NO",
      "Philadelphia":"PHI","Pittsburgh":"PIT","San Francisco":"SF","Seattle":"SEA",
      "Tampa Bay":"TB","Tennessee":"TEN","Washington":"WAS"}

# ---- 1. the rating, walk-forward over the full 2004+ log so 2023 starts warm ---------------
g = pd.read_csv(io.StringIO(requests.get(
    "https://github.com/nflverse/nfldata/raw/master/data/games.csv", timeout=120).text))
g = g[(g.season >= 2004) & g.result.notna()].copy().sort_values(["season","week","gameday"])
VALS = _counts(g.result.tolist())
HFA, CARRY, ALPHA = 2.0, 0.75, 0.10
rate, seen, season, pred_rows = {}, {}, None, []
for r in g.itertuples():
    if r.season != season:
        rate = {k: v*CARRY for k, v in rate.items()}; season = r.season
    rh, ra = rate.get(r.home_team, 0.0), rate.get(r.away_team, 0.0)
    if seen.get(r.home_team,0) >= 8 and seen.get(r.away_team,0) >= 8:
        pred_rows.append(dict(season=r.season, week=r.week, gameday=r.gameday,
                              home=r.home_team, away=r.away_team,
                              pred=rh-ra+HFA, act=float(r.result)))
    rate[r.home_team] = (1-ALPHA)*rh + ALPHA*(float(r.result) + ra - HFA)
    rate[r.away_team] = (1-ALPHA)*ra + ALPHA*(-float(r.result) + rh + HFA)
    seen[r.home_team] = seen.get(r.home_team,0)+1; seen[r.away_team] = seen.get(r.away_team,0)+1
P = pd.DataFrame(pred_rows)

# ---- 2. opener and close from the snapshot feed --------------------------------------------
o = pd.read_parquet("nfl-extreme-outcomes/data/odds_hist.parquet",
                    columns=["season","home_team","away_team","snap_ts","commence_time",
                             "book","spread_home"]).dropna(subset=["spread_home"])
o["home"] = o.home_team.map(NV); o["away"] = o.away_team.map(NV)
o = o.dropna(subset=["home","away"])
o["date"] = pd.to_datetime(o.commence_time, utc=True, errors="coerce").dt.date
o["snap"] = pd.to_datetime(o.snap_ts, utc=True, errors="coerce")
o = o.dropna(subset=["date","snap"])
key = ["season","home","away","date"]
first = o.groupby(key).snap.transform("min"); last = o.groupby(key).snap.transform("max")
# consensus across books at the first and last snapshot window (2h tolerance either end)
op = o[o.snap <= first + pd.Timedelta("2h")].groupby(key).spread_home.median().rename("open_bk")
cl = o[o.snap >= last - pd.Timedelta("2h")].groupby(key).spread_home.median().rename("close_bk")
# best early number available on EITHER side, which is what an originator actually bets
bh = o[o.snap <= first + pd.Timedelta("2h")].groupby(key).spread_home.max().rename("best_home_bk")
ba = o[o.snap <= first + pd.Timedelta("2h")].groupby(key).spread_home.min().rename("best_away_bk")
L = pd.concat([op, cl, bh, ba], axis=1).reset_index()
# book spread -> implied home margin (book -6.5 on the home side = home by 6.5)
for c, n in (("open_bk","mkt_open"), ("close_bk","mkt_close"),
             ("best_home_bk","mkt_best_home"), ("best_away_bk","mkt_best_away")):
    L[n] = -L[c]

P["date"] = pd.to_datetime(P.gameday, errors="coerce").dt.date
d = P.merge(L, on=["season","home","away"], how="inner", suffixes=("","_l"))
d = d[(pd.to_datetime(d.date_l) - pd.to_datetime(d.date)).abs() <= pd.Timedelta("1D")]
print(f"{len(d)} games matched to opener+close, seasons {sorted(d.season.unique())}")

d["side_home"] = d.pred > d.mkt_open
# an originator takes the BEST early number on his side, not the consensus
d["line_taken"] = np.where(d.side_home, d.mkt_best_home, d.mkt_best_away)
d["pts"] = (d.pred - d.mkt_open).abs()
d["pct"] = [edge_pct(p, m, VALS) for p, m in zip(d.pred, d.mkt_open)]
d["cover_open"] = np.where(d.side_home, d.act - d.line_taken, d.line_taken - d.act)
d = d[d.cover_open.abs() > 1e-9].copy()
d["won"] = d.cover_open > 0
# CLV: did the close move TOWARD our side? positive = the market came to us
d["clv"] = np.where(d.side_home, d.mkt_close - d.mkt_open, d.mkt_open - d.mkt_close)

def rec(s):
    if not len(s): return f"{'—':>35}"
    w = int(s.won.sum()); l = len(s)-w
    return (f"{len(s):>6}{f'{w}-{l}':>12}{w/len(s)*100:>8.1f}%{(w*0.909-l)/len(s)*100:>+9.1f}%"
            f"{s.clv.mean():>+8.2f}")

print(f"\n=== the Walters number vs the OPENER (best early price on our side)")
print(f"{'gate':<24}{'n':>6}{'W-L':>12}{'hit':>8}{'ROI':>9}{'CLV':>8}")
print(f"{'every game':<24}{rec(d)}")
for f_ in (3, 4, 5, 5.5, 6, 7, 8, 10):
    print(f"{f'mass >= {f_}%':<24}{rec(d[d.pct >= f_])}")
print(f"\nCLV is in POINTS of line movement toward our side. Positive and >= ~0.3 is the "
      f"signature of an originator;\n~0 means the market never agreed with us.")
print(f"share of bets where the line moved toward us: {100*(d.clv>0).mean():.1f}%  "
      f"(a coin flip is 50% before accounting for no-movers)")
print(f"\n=== by season, his 5.5% floor")
s = d[d.pct >= 5.5]
for y in sorted(d.season.unique()):
    x = s[s.season == y]; w = int(x.won.sum()); l = len(x)-w
    print(f"   {int(y)}  {len(x):>4} bets  {w}-{l}  "
          + (f"{w/len(x)*100:5.1f}%   CLV {x.clv.mean():+.2f}" if len(x) else ""))
d.to_csv("nfl-extreme-outcomes/out/walters_vs_opener.csv", index=False)
print("\n-> nfl-extreme-outcomes/out/walters_vs_opener.csv")
