"""
MONEYLINE value. Convert margin model -> P(home win); compare to vig-removed market implied prob.
Bet ML where our prob > implied (value), focused on dogs/pickems. ROI uses actual ML payout.
Cross-check: does the spread model agree (ensemble)? Walk-forward, 2021-2025.
"""
import os
import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.linear_model import LogisticRegression

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "data", "cfbd")
gm = pd.read_parquet(os.path.join(HERE, "data", "model_games.parquet"))
TS = [2021, 2022, 2023, 2024, 2025]

# consensus ML per game (median), vig-removed implied prob
def amer_prob(ml):
    return np.where(ml < 0, -ml / (-ml + 100.0), 100.0 / (ml + 100.0))
def amer_prob1(x):
    return (-x / (-x + 100.0)) if x < 0 else (100.0 / (x + 100.0))
frames = []
for y in TS:
    l = pd.read_parquet(os.path.join(DATA, f"lines_{y}.parquet"))
    for c in ["homeMoneyline", "awayMoneyline", "spread"]:
        l[c] = pd.to_numeric(l[c], errors="coerce")
    l = l.dropna(subset=["homeMoneyline", "awayMoneyline"])
    # CLEAN: valid american odds (|ml|>=100, not placeholder), opposite signs (real 2-way market),
    # and per-row vig in a sane band (1.0-1.15)
    valid = (l.homeMoneyline.abs() >= 100) & (l.awayMoneyline.abs() >= 100) & \
            (l.homeMoneyline.abs() <= 2000) & (l.awayMoneyline.abs() <= 2000) & \
            ((l.homeMoneyline > 0) != (l.awayMoneyline > 0))
    l = l[valid].copy()
    l["rvig"] = l.homeMoneyline.apply(amer_prob1) + l.awayMoneyline.apply(amer_prob1)
    l = l[(l.rvig >= 1.0) & (l.rvig <= 1.15)]
    # orient: ML favorite (more negative) must match spread favorite; flip the rare disagreements
    bad = (l.spread.abs() >= 3) & ((l.homeMoneyline < l.awayMoneyline) != (l.spread < 0))
    l.loc[bad, ["homeMoneyline", "awayMoneyline"]] = l.loc[bad, ["awayMoneyline", "homeMoneyline"]].values
    agg = l.groupby("id").agg(hml=("homeMoneyline", "median"), aml=("awayMoneyline", "median")).reset_index()
    frames.append(agg)
ml = pd.concat(frames, ignore_index=True).rename(columns={"id": "game_id"})
gm = gm.merge(ml, on="game_id", how="left")

EXCLUDE = {"game_id", "season", "date", "homeTeam", "awayTeam", "homeConference", "awayConference",
           "homePoints", "awayPoints", "venueId", "actual_total", "actual_margin",
           "spread_close", "spread_open", "total_close", "total_open", "hml", "aml"}
num = gm.select_dtypes(include=[np.number, "Int64", "boolean"]); FEATS = [c for c in num.columns if c not in EXCLUDE]
gm[FEATS] = gm[FEATS].apply(pd.to_numeric, errors="coerce")

def payout(ml):  # profit per 1u stake on a win
    return ml / 100.0 if ml > 0 else 100.0 / -ml

parts = []
for S in TS:
    tr = gm[(gm.season < S) & gm.actual_margin.notna()]
    te = gm[(gm.season == S) & gm.hml.notna() & gm.aml.notna() & gm.actual_margin.notna()].copy()
    m = HistGradientBoostingRegressor(max_iter=300, learning_rate=0.05, max_depth=4, l2_regularization=1.0, random_state=0).fit(tr[FEATS], tr.actual_margin)
    tr_pred = m.predict(tr[FEATS]); te["pred"] = m.predict(te[FEATS])
    # PROPER calibration: logistic of actual home win on predicted margin (walk-forward)
    cal = LogisticRegression().fit(tr_pred.reshape(-1, 1), (tr.actual_margin > 0).astype(int))
    te["p_home"] = cal.predict_proba(te["pred"].values.reshape(-1, 1))[:, 1]
    parts.append(te)
A = pd.concat(parts)
A["home_win"] = A.actual_margin > 0
hp, ap = amer_prob(A.hml.values), amer_prob(A.aml.values)
vig = hp + ap
A["imp_home"] = hp / vig; A["imp_away"] = ap / vig
A["val_home"] = A.p_home - A.imp_home
A["val_away"] = (1 - A.p_home) - A.imp_away
A["sp_edge"] = A.pred + A.spread_open  # spread model: >0 home value

def roi_ml(bets, side):  # side 'home'/'away'
    if len(bets) == 0: return 0, 0
    wins = bets.home_win if side == "home" else ~bets.home_win
    mls = bets.hml if side == "home" else bets.aml
    profit = np.where(wins, mls.apply(payout), -1.0)
    return len(bets), 100 * profit.mean()

def show(name, mask, side, valcol):
    b = A[mask.fillna(False)]; n, r = roi_ml(b, side)
    if n < 25: print(f"  {name:<44} n={n} thin"); return
    wins = b.home_win if side == "home" else ~b.home_win
    per = "/".join(f"{100*(np.where(b['home_win'][b.season==s] if side=='home' else ~b['home_win'][b.season==s],1,0)).mean():.0f}" if (b.season==s).sum()>=8 else "--" for s in TS)
    print(f"  {name:<44} n={n:<4} win%={100*wins.mean():.1f} ROI={r:+.1f}%  [{per}]")

print(f"games w/ ML: {len(A)} | base home win rate {100*A.home_win.mean():.1f}%")
print("\n=== ML VALUE: bet when our prob > implied (value threshold) ===")
for thr in [0.03, 0.05, 0.08]:
    show(f"home ML value>={thr}", A.val_home >= thr, "home", "val_home")
    show(f"away ML value>={thr}", A.val_away >= thr, "away", "val_away")
print("\n=== DOGS only (ML>0) with value ===")
show("home DOG ML value>=.05", (A.val_home >= 0.05) & (A.hml > 0), "home", "val_home")
show("away DOG ML value>=.05", (A.val_away >= 0.05) & (A.aml > 0), "away", "val_away")
print("\n=== PICK'EMS (|spread|<=4) with value ===")
show("home pickem ML value>=.04", (A.val_home >= 0.04) & (A.spread_open.abs() <= 4), "home", "val_home")
show("away pickem ML value>=.04", (A.val_away >= 0.04) & (A.spread_open.abs() <= 4), "away", "val_away")
print("\n=== ENSEMBLE: ML value AND spread model agrees ===")
show("away ML value>=.05 & spread agrees (sp_edge<=-2)", (A.val_away >= 0.05) & (A.sp_edge <= -2), "away", "val_away")
show("home ML value>=.05 & spread agrees (sp_edge>=2)", (A.val_home >= 0.05) & (A.sp_edge >= 2), "home", "val_home")
show("away DOG ML val>=.05 & spread agrees", (A.val_away >= 0.05) & (A.aml > 0) & (A.sp_edge <= -2), "away", "val_away")
