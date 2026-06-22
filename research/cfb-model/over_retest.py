"""
Re-test the OVER side with pace/weather/havoc/PPO features.
Walk-forward, grade vs OPEN, 2021-2025. Tests: (1) directional asymmetry now,
(2) standalone over-spots, (3) model-OVER conditioned on scoring environment.
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
num = gm.select_dtypes(include=[np.number, "Int64", "boolean"])
FEATS = [c for c in num.columns if c not in EXCLUDE]
gm[FEATS] = gm[FEATS].apply(pd.to_numeric, errors="coerce")
TS = [2021, 2022, 2023, 2024, 2025]
def roi(h, n): return (h * 0.909 - (n - h)) / n * 100 if n else 0.0

parts = []
for S in TS:
    tr = gm[(gm["season"] < S) & gm["actual_total"].notna()]
    te = gm[(gm["season"] == S) & gm["total_open"].notna() & gm["actual_total"].notna()].copy()
    te["pred"] = HistGradientBoostingRegressor(max_iter=300, learning_rate=0.05, max_depth=4,
        l2_regularization=1.0, random_state=0).fit(tr[FEATS], tr["actual_total"]).predict(te[FEATS])
    parts.append(te)
A = pd.concat(parts)
A["edge"] = A["pred"] - A["total_open"]
A = A[A["actual_total"] != A["total_open"]].copy()
A["over_won"] = A["actual_total"] > A["total_open"]

print("1) DIRECTIONAL ASYMMETRY now (with pace/wx/ppo):")
print(f"{'thr':>4} | {'OVER hit%/roi':>20} | {'UNDER hit%/roi':>20}")
for thr in [3, 5, 7, 10]:
    o = A[A["edge"] >= thr]; u = A[A["edge"] <= -thr]
    oh = int(o["over_won"].sum()); uh = int((~u["over_won"]).sum())
    print(f"{thr:>4} | {len(o):>4} {100*oh/len(o):>5.1f}% {roi(oh,len(o)):>+6.1f}% | "
          f"{len(u):>4} {100*uh/len(u):>5.1f}% {roi(uh,len(u)):>+6.1f}%")

# helper
c = lambda x: pd.to_numeric(A[x], errors="coerce") if x in A.columns else pd.Series(np.nan, index=A.index)
ep_hi = c("expected_plays").quantile(0.75); ppo_hi = c("sum_off_ppo").quantile(0.75)
dr_hi = c("sum_drives").quantile(0.75)

OVER_CONDS = {
    "indoors(dome)": c("wx_indoors") == 1,
    "calm+warm(wind<7 & temp>=60)": (c("wx_wind") < 7) & (c("wx_temp") >= 60),
    "fast pace (exp_plays top25%)": c("expected_plays") >= ep_hi,
    "high PPO (top25%)": c("sum_off_ppo") >= ppo_hi,
    "many drives (top25%)": c("sum_drives") >= dr_hi,
    "low_total_env(open<=45)": A["total_open"] <= 45,
    "low_total + fast pace": (A["total_open"] <= 48) & (c("expected_plays") >= ep_hi),
}
print("\n2) STANDALONE OVER-SPOTS (bet OVER vs open):")
print(f"{'cond':>32}{'n':>6}{'over%':>7}{'roi%':>8}  per-season over%")
def perseason(mask):
    return "/".join(f"{100*A['over_won'][mask&(A.season==s)].mean():.0f}" if (mask&(A.season==s)).sum()>=10 else "--" for s in TS)
for name, mask in OVER_CONDS.items():
    m = mask.fillna(False); n = int(m.sum()); oh = int(A["over_won"][m].sum())
    print(f"{name:>32}{n:>6}{100*oh/n if n else 0:>7.1f}{roi(oh,n):>8.1f}  [{perseason(m)}]")

print("\n3) MODEL-OVER (edge>=3) CONDITIONED on scoring environment:")
print(f"{'cond':>40}{'n':>6}{'over%':>7}{'roi%':>8}  per-season")
mo = A["edge"] >= 3
MO = {
    "model OVER edge>=3 (all)": mo,
    "  + indoors": mo & (c("wx_indoors") == 1),
    "  + fast pace (top25%)": mo & (c("expected_plays") >= ep_hi),
    "  + high PPO (top25%)": mo & (c("sum_off_ppo") >= ppo_hi),
    "  + calm+warm": mo & (c("wx_wind") < 7) & (c("wx_temp") >= 60),
    "  + low_total_env(open<=48)": mo & (A["total_open"] <= 48),
    "model OVER edge>=5 + fast pace": (A["edge"] >= 5) & (c("expected_plays") >= ep_hi),
}
for name, m in MO.items():
    m = m.fillna(False); n = int(m.sum()); oh = int(A["over_won"][m].sum())
    print(f"{name:>40}{n:>6}{100*oh/n if n else 0:>7.1f}{roi(oh,n):>8.1f}  [{perseason(m)}]")
