"""
SIDES (ATS) spot mining vs the OPENING spread, 2021-2025, per-season + FP control.
home_cover = (actual_margin + spread_open) > 0. spread_open<0 = home favored.
Two spot types:
  (a) market-structure (clean home/away bet, e.g., fade home favorites)
  (b) team-state (bet the team in the spot: off bye, bounce-back, etc.)
Also overlay the model's away-edge.
"""
import os
import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingRegressor

HERE = os.path.dirname(os.path.abspath(__file__))
gm = pd.read_parquet(os.path.join(HERE, "data", "model_games.parquet"))
EXCLUDE = {"game_id", "season", "date", "homeTeam", "awayTeam", "homeConference", "awayConference",
           "homePoints", "awayPoints", "venueId", "actual_total", "actual_margin",
           "spread_close", "spread_open", "total_close", "total_open"}
num = gm.select_dtypes(include=[np.number, "Int64", "boolean"]); FEATS = [c for c in num.columns if c not in EXCLUDE]
gm[FEATS] = gm[FEATS].apply(pd.to_numeric, errors="coerce")
TS = [2021, 2022, 2023, 2024, 2025]
def roi(h, n): return (h * 0.909 - (n - h)) / n * 100 if n else 0.0

# model away-edge (walk-forward)
P = []
for S in TS:
    tr = gm[(gm.season < S) & gm.actual_margin.notna()]
    te = gm[(gm.season == S) & gm.spread_open.notna() & gm.actual_margin.notna()].copy()
    te["pred"] = HistGradientBoostingRegressor(max_iter=300, learning_rate=0.05, max_depth=4,
        l2_regularization=1.0, random_state=0).fit(tr[FEATS], tr.actual_margin).predict(te[FEATS])
    P.append(te)
A = pd.concat(P)
A["model_edge"] = A["pred"] + A["spread_open"]
A = A[(A.actual_margin + A.spread_open) != 0].copy()
A["home_cover"] = (A.actual_margin + A.spread_open) > 0
base_home = 100 * A["home_cover"].mean()
print(f"n={len(A)} | home cover base {base_home:.1f}%")
def cn(x): return pd.to_numeric(A[x], errors="coerce")

# bet side: 'home' -> hit=home_cover ; 'away' -> hit=~home_cover
def evalspot(name, mask, side):
    m = mask.fillna(False); b = A[m]; n = len(b)
    if n < 30:
        print(f"  {name:<38} n={n} (thin)"); return None
    hit = b["home_cover"] if side == "home" else ~b["home_cover"]
    h = int(hit.sum())
    per = "/".join(f"{100*(b['home_cover'][b.season==s] if side=='home' else ~b['home_cover'][b.season==s]).mean():.0f}" if (b.season==s).sum()>=10 else "--" for s in TS)
    print(f"  {name:<38} n={n:<4} ATS={100*h/n:4.1f}% roi={roi(h,n):+5.1f}  [{per}]")
    return (name, n, abs(100*h/n - 50))

print("\n=== MARKET-STRUCTURE SPOTS ===")
res = []
sp = cn("spread_open")
res.append(evalspot("fade home favorite -1 to -7 (bet away)", (sp < 0) & (sp >= -7), "away"))
res.append(evalspot("fade home favorite -7 to -14 (away)", (sp < -7) & (sp >= -14), "away"))
res.append(evalspot("fade home favorite -14 to -21 (away)", (sp < -14) & (sp >= -21), "away"))
res.append(evalspot("fade BIG home favorite <=-21 (away)", sp <= -21, "away"))
res.append(evalspot("back away favorite (bet away)", sp > 0, "away"))
res.append(evalspot("back home dog (bet home)", sp > 0, "home"))
res.append(evalspot("back BIG home dog >=+10 (home)", sp >= 10, "home"))

print("\n=== TEAM-STATE SPOTS (bet the team in the spot) ===")
def team_state(name, col, bet_in_spot=True):
    h = cn(f"home_{col}") == 1; a = cn(f"away_{col}") == 1
    # bet the team in spot (or fade if bet_in_spot=False)
    bet_home = (h & ~a) if bet_in_spot else (a & ~h)
    bet_away = (a & ~h) if bet_in_spot else (h & ~a)
    b = A[bet_home | bet_away]; n = len(b)
    if n < 30:
        print(f"  {name:<38} n={n} (thin)"); return None
    hit = np.where(bet_home[b.index], b["home_cover"], ~b["home_cover"])
    h_ = int(hit.sum())
    per = "/".join(f"{100*np.where(bet_home[A.season==s][b.index.intersection(A[A.season==s].index)] if False else (bet_home.reindex(b[b.season==s].index)), b['home_cover'][b.season==s], ~b['home_cover'][b.season==s]).mean():.0f}" if (b.season==s).sum()>=10 else "--" for s in TS)
    print(f"  {name:<38} n={n:<4} ATS={100*h_/n:4.1f}% roi={roi(h_,n):+5.1f}  [{per}]")
    return (name, n, abs(100*h_/n - 50))

res.append(team_state("off bye (back)", "off_bye", True))
res.append(team_state("off blowout loss (bounce-back)", "last_blowout_loss", True))
res.append(team_state("off blowout win (fade)", "last_blowout_win", False))
res.append(team_state("short week (fade)", "short_week", False))
res.append(team_state("ranked (fade)", "self_rank_is", False))

print("\n=== MODEL away-edge x market spots ===")
evalspot("model away edge<=-4 (bet away)", A.model_edge <= -4, "away")
evalspot("model away edge<=-3 & away favorite", (A.model_edge <= -3) & (sp > 0), "away")
evalspot("model away edge<=-3 & fade home fav", (A.model_edge <= -3) & (sp < 0), "away")

res = [r for r in res if r]
rng = np.random.default_rng(11); hc = A["home_cover"].values
real = sum(1 for _, n, d in res if n >= 40 and d >= 3)
null = [sum(1 for nm, n, d in res if n >= 40 and
       abs(100*pd.Series(rng.permutation(hc), index=A.index).iloc[:n].mean()-50) >= 3) for _ in range(200)]
print(f"\n(FP rough: {real} spots with |ATS-50|>=3pp & n>=40)")
