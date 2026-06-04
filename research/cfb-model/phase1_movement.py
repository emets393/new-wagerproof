"""
PHASE 1 — line movement empirics + CLV on our edges. 2021-2025, clean closes (close_hrs<12).
A. CLV baseline: distribution of |close-open| spread & total.
B. Steam: does the side the line moved TOWARD cover the CLOSING line? (movement signal -> grade at close)
C. CLV on our model edges: do lines move toward our premium-tier picks (open->close)?
"""
import os
import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingRegressor

HERE = os.path.dirname(os.path.abspath(__file__))
fr = pd.read_parquet(os.path.join(HERE, "data", "odds_game_frame.parquet"))
fr = fr[(fr.close_hrs < 12) & fr.open_spread.notna() & fr.close_spread.notna()].copy()
TS = [2021, 2022, 2023, 2024, 2025]; P5 = {"SEC", "Big Ten", "Big 12", "ACC", "Pac-12"}
def roi(h, n): return (h * 0.909 - (n - h)) / n * 100 if n else 0.0

print(f"clean games: {len(fr)}")
print("\n=== A. CLV BASELINE (line movement magnitude) ===")
print(f"  |spread_move| mean {fr.spread_move.abs().mean():.2f} median {fr.spread_move.abs().median():.2f} | moved>=1: {100*(fr.spread_move.abs()>=1).mean():.0f}% | >=3: {100*(fr.spread_move.abs()>=3).mean():.0f}%")
print(f"  |total_move|  mean {fr.total_move.abs().mean():.2f} median {fr.total_move.abs().median():.2f} | moved>=1: {100*(fr.total_move.abs()>=1).mean():.0f}% | >=3: {100*(fr.total_move.abs()>=3).mean():.0f}%")

print("\n=== B. STEAM: does the side the line moved toward cover the CLOSE? (grade @ close) ===")
# spread_move<0 = line moved toward home (home spread more negative). bet that side, grade @ close.
fr["home_cover_close"] = (fr.actual_margin + fr.close_spread) > 0
for lo, hi in [(0.5, 1), (1, 2), (2, 3), (3, 99)]:
    m = (fr.spread_move.abs() >= lo) & (fr.spread_move.abs() < hi)
    b = fr[m]; b = b[(b.actual_margin + b.close_spread) != 0]
    # moved toward home (spread_move<0) -> bet home; else away
    win = np.where(b.spread_move < 0, b.home_cover_close, ~b.home_cover_close)
    n = len(b); h = int(win.sum())
    print(f"  spread moved {lo}-{hi}pt toward a side: n={n} that-side covers close {100*h/n if n else 0:.1f}% (efficient~50%)")
# totals steam
fr["over_close"] = fr.actual_total > fr.close_total
for lo, hi in [(1, 2), (2, 3), (3, 99)]:
    m = (fr.total_move.abs() >= lo) & (fr.total_move.abs() < hi)
    b = fr[m]; b = b[b.actual_total != b.close_total]
    win = np.where(b.total_move > 0, b.over_close, ~b.over_close)  # moved up -> bet over
    n = len(b); h = int(win.sum())
    print(f"  total moved {lo}-{hi}pt: that-direction hits close {100*h/n if n else 0:.1f}%")

print("\n=== C. CLV on our model edges (open->close move in our direction) ===")
gm = pd.read_parquet(os.path.join(HERE, "data", "model_games.parquet"))
EXCLUDE = {"game_id", "season", "date", "homeTeam", "awayTeam", "homeConference", "awayConference",
           "homePoints", "awayPoints", "venueId", "actual_total", "actual_margin",
           "spread_close", "spread_open", "total_close", "total_open"}
num = gm.select_dtypes(include=[np.number, "Int64", "boolean"]); FEATS = [c for c in num.columns if c not in EXCLUDE]
gm[FEATS] = gm[FEATS].apply(pd.to_numeric, errors="coerce")
P = []
for S in TS:
    tr = gm[(gm.season < S) & gm.actual_margin.notna()]
    te = gm[(gm.season == S) & gm.spread_open.notna() & gm.actual_margin.notna()].copy()
    te["pred"] = HistGradientBoostingRegressor(max_iter=300, learning_rate=0.05, max_depth=4, l2_regularization=1.0, random_state=0).fit(tr[FEATS], tr.actual_margin).predict(te[FEATS])
    P.append(te)
A = pd.concat(P)[["season", "homeTeam", "awayTeam", "pred", "spread_open"]].rename(columns={"homeTeam": "home", "awayTeam": "away"})
m = fr.merge(A, on=["season", "home", "away"], how="inner")
m["model_edge"] = m.pred + m.open_spread   # use OPEN spread (we bet at open)
m["p5"] = m.homeConference.isin(P5) & m.awayConference.isin(P5)
# CLV: if we bet home (edge>0), favorable move = close_spread MORE negative than open (line moved to home)
#      our_clv = (open_spread - close_spread) if betting home (line dropping toward home is +CLV for home side)
m["our_clv"] = np.where(m.model_edge > 0, m.open_spread - m.close_spread, m.close_spread - m.open_spread)
for nm, b in [("all picks (|edge|>=4)", m[m.model_edge.abs() >= 4]),
              ("PREMIUM |edge|>=8 P5", m[(m.model_edge.abs() >= 8) & m.p5]),
              ("|edge|>=8 P5 betting FAVORITE", m[(m.model_edge.abs() >= 8) & m.p5 & (np.where(m.model_edge>0, m.open_spread<0, m.open_spread>0))])]:
    print(f"  {nm}: n={len(b)} avg CLV {b.our_clv.mean():+.2f} pts | % line moved our way {100*(b.our_clv>0).mean():.0f}%")
