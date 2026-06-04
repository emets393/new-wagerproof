"""
Does the MODEL agree or disagree with our LINE signals, and what's the ATS accuracy of each combination?
WALK-FORWARD: model trained on season<S only, predicts S (no 2025->2025 leak). Reported for full OOS
(2021-25, every pred cold) AND the 2025 holdout slice.

Grade-line = CONSENSUS CLOSE (strict, consistent across signals). home_cover@close = (margin + spread_close)>0.
Model lean: home if (pred + spread_close) > 0.  Line signals (each -> a side):
  SOFT-BOOK GAP (line discrepancy): sharp_cons_close - soft_cons_close ; <0 -> sharp leans HOME.
  LATE REVERSAL: sp_early & sp_late opposite, both>=1 ; follow LATE (sp_late<0 -> HOME).
  FULL MOVE: spread_close - spread_open ; <0 -> line moved toward HOME.
Bonus: soft-book combo also graded @ soft number (its real executable line).
"""
import os, glob
import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingRegressor

HERE = os.path.dirname(os.path.abspath(__file__))
gm = pd.read_parquet(os.path.join(HERE, "data", "model_games.parquet"))
EXCLUDE = {"game_id", "season", "date", "homeTeam", "awayTeam", "homeConference", "awayConference",
           "homePoints", "awayPoints", "venueId", "actual_total", "actual_margin",
           "spread_close", "spread_open", "total_close", "total_open"}
num = gm.select_dtypes(include=[np.number, "Int64", "boolean"])
FEATS = [c for c in num.columns if c not in EXCLUDE]
gm[FEATS] = gm[FEATS].apply(pd.to_numeric, errors="coerce")
TS = [2021, 2022, 2023, 2024, 2025]
def roi(h, n): return (h * 0.909 - (n - h)) / n * 100 if n else 0.0

# ---- walk-forward predictions ----
parts = []
for S in TS:
    tr = gm[(gm.season < S) & gm.actual_margin.notna()]
    te = gm[(gm.season == S) & gm.spread_close.notna() & gm.spread_open.notna() & gm.actual_margin.notna()].copy()
    m = HistGradientBoostingRegressor(max_iter=300, learning_rate=0.05, max_depth=4,
                                      l2_regularization=1.0, random_state=0).fit(tr[FEATS], tr["actual_margin"])
    te["pred"] = m.predict(te[FEATS]); parts.append(te)
A = pd.concat(parts)
A = A[(A.actual_margin + A.spread_close) != 0].copy()         # drop close pushes
A["m_lean_home"] = (A.pred + A.spread_close) > 0              # model lean @ close
A["m_edge"] = (A.pred + A.spread_close)
A["home_cover"] = (A.actual_margin + A.spread_close) > 0
A["full_move"] = A.spread_close - A.spread_open              # <0 -> toward home

# ---- soft-book gap (line discrepancy) @ close ----
cfbd = sorted(set(gm.homeTeam) | set(gm.awayTeam))
ALIAS = {"Appalachian State Mountaineers": "App State", "Hawaii Rainbow Warriors": "Hawai'i",
         "UMass Minutemen": "Massachusetts", "San Jose State Spartans": "San José State",
         "Southern Miss Golden Eagles": "Southern Miss"}
def to_cfbd(o):
    if o in ALIAS: return ALIAS[o]
    c = [x for x in cfbd if o.startswith(x + " ") or o == x]; c.sort(key=len, reverse=True)
    return c[0] if c else None
SHARP = ["williamhill_us", "twinspires", "draftkings"]; SOFT = ["bovada", "mybookieag"]
oparts = []
for f in glob.glob(os.path.join(HERE, "data", "odds_history", "odds_*.parquet")):
    yr = int(os.path.basename(f).split("_")[1].split(".")[0]); d = pd.read_parquet(f); d["season"] = yr; oparts.append(d)
od = pd.concat(oparts, ignore_index=True)
od["home_c"] = od.home_team.map(to_cfbd); od["away_c"] = od.away_team.map(to_cfbd)
od = od.dropna(subset=["home_c", "away_c", "hrs_to_kick", "spread_home"]); od = od[(od.hrs_to_kick >= 0) & (od.hrs_to_kick < 12)]
ci = od.groupby(["season", "game_id", "book"]).hrs_to_kick.idxmin()
clz = od.loc[ci]
def blend(books, **agg):
    sub = clz[clz.book.isin(books)]
    return sub.groupby(["season", "home_c", "away_c"]).agg(**agg)
sh = blend(SHARP, sharp=("spread_home", "median"), ns=("book", "nunique"))
sf = blend(SOFT, soft=("spread_home", "median"), nf=("book", "nunique"),
           soft_bh=("spread_home", "max"), soft_ba=("spread_home", "min"))
gapf = sh.join(sf, how="inner").reset_index()
gapf = gapf[(gapf.ns >= 2) & (gapf.nf >= 1)]
gapf["gap"] = gapf.sharp - gapf.soft
A = A.merge(gapf, left_on=["season", "homeTeam", "awayTeam"], right_on=["season", "home_c", "away_c"], how="left")

# ---- movement windows for reversal ----
mw = pd.read_parquet(os.path.join(HERE, "data", "movement_windows.parquet"))
mw["sp_early"] = mw.sp_h24 - mw.sp_open; mw["sp_late"] = mw.sp_close - mw.sp_h24
A = A.merge(mw[["season", "home", "away", "sp_early", "sp_late"]],
            left_on=["season", "homeTeam", "awayTeam"], right_on=["season", "home", "away"], how="left")

def bucket(df, sig_home, label, edge_thr=2.0):
    d = df[df.m_edge.abs() >= edge_thr].copy()
    d = d[sig_home.reindex(d.index).notna()]
    sh = sig_home.reindex(d.index).astype(bool)
    agree = sh == d.m_lean_home
    # AGREE: bet the shared side. DISAGREE: report model side & signal side.
    out = []
    for name, sub in [("AGREE", d[agree]), ("DISAGREE", d[~agree])]:
        n = len(sub)
        if n == 0: out.append((name, 0, 0, 0)); continue
        # model-side win
        mwin = np.where(sub.m_lean_home, sub.home_cover, ~sub.home_cover)
        out.append((name, n, 100*mwin.mean(), roi(int(mwin.sum()), n)))
    return d, out

print("="*78)
print("MODEL x LINE-SIGNAL agreement (walk-forward, grade @ consensus CLOSE, model |edge|>=2)")
print("="*78)
base = A[A.m_edge.abs() >= 2]
bwin = np.where(base.m_lean_home, base.home_cover, ~base.home_cover)
print(f"MODEL ALONE @close, |edge|>=2: n={len(base)} hit={100*bwin.mean():.1f}% roi={roi(int(bwin.sum()),len(base)):+.1f}\n")

SIG = {
    "SOFT-BOOK GAP>=0.5": (A.gap < 0).where(A.gap.abs() >= 0.5),
    "SOFT-BOOK GAP>=1.0": (A.gap < 0).where(A.gap.abs() >= 1.0),
    "FULL LINE MOVE>=1":  (A.full_move < 0).where(A.full_move.abs() >= 1.0),
    "LATE REVERSAL":      (A.sp_late < 0).where((np.sign(A.sp_early) != np.sign(A.sp_late)) & (A.sp_early.abs() >= 1) & (A.sp_late.abs() >= 1)),
}
for label, sigh in SIG.items():
    _, out = bucket(A, sigh, label)
    print(f"--- {label} (model bet, graded @ close) ---")
    for name, n, hit, r in out:
        print(f"    model {name:<9} n={n:<4} model-side hit={hit:4.1f}% roi={r:+.1f}")
    # 2025 slice
    d25 = A[(A.season == 2025) & (A.m_edge.abs() >= 2) & sigh.reindex(A.index).notna()]
    sh25 = sigh.reindex(d25.index).astype(bool); ag = sh25 == d25.m_lean_home
    for name, sub in [("AGREE", d25[ag]), ("DISAGREE", d25[~ag])]:
        if len(sub):
            w = np.where(sub.m_lean_home, sub.home_cover, ~sub.home_cover)
            print(f"      2025 {name:<9} n={len(sub):<3} hit={100*w.mean():4.1f}%")
    print()
