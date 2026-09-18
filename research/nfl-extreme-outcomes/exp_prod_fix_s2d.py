#!/usr/bin/env python3
"""Does FIXING the production model's own season-to-date features beat ADDING Fantasy Points?
The production matchup nets (net_pass_epa_neutral_s2d, net_rush_epa_neutral_s2d, net_pts_per_drive_s2d,
net_ppd_s2d) are built from nfl_pregame_advanced_team_week, whose `_s2d` columns are cumulative since
2018 through 2025 and raw single-season in 2026 (nfl-team-week-cumulative-defect). Arms, same
HistGBM / walk-forward / opener grading as exp_prod_plus_fp.py, 5 seeds averaged:
  A  production BASE
  B  BASE + FP nets (9)
  D  BASE with the 4 broken nets REPLACED by true season-to-date nets (team_week_seasonal, K=4 seeded)
  D2 BASE + the true nets ADDED (broken ones kept)
  E  D + FP nets"""
import io, contextlib, importlib.util as iu, sys, warnings
import numpy as np, pandas as pd
warnings.filterwarnings("ignore")
from sklearn.ensemble import HistGradientBoostingClassifier
sys.argv = [sys.argv[0]]
spec = iu.spec_from_file_location("fh", "forecast_harness.py"); FH = iu.module_from_spec(spec)
with contextlib.redirect_stdout(io.StringIO()): spec.loader.exec_module(FH); m, BASE = FH.build()
spec2 = iu.spec_from_file_location("pr", "power_ratings.py"); M = iu.module_from_spec(spec2)
with contextlib.redirect_stdout(io.StringIO()): spec2.loader.exec_module(M)
ENT, UNITS, PAIRS = M.ENT.copy(), M.ALLU, M.PAIRS
AB = {"LA": "LAR", "JAX": "JAC", "WAS": "WSH", "LV": "LVR", "ARI": "ARZ", "BAL": "BLT", "CLE": "CLV", "HOU": "HST"}
ours = set(m.home_ab.unique()); AB = {k: v for k, v in AB.items() if v in ours and k not in ours}; ENT["__k"] = ENT.__k.replace(AB)
H = ENT.rename(columns={"__k": "home_ab", "__season": "season", "__week": "week", **{u: f"h_{u}" for u in UNITS}})
A = ENT.rename(columns={"__k": "away_ab", "__season": "season", "__week": "week", **{u: f"a_{u}" for u in UNITS}})
m = m.merge(H[["home_ab", "season", "week"] + [f"h_{u}" for u in UNITS]], on=["home_ab", "season", "week"], how="left")
m = m.merge(A[["away_ab", "season", "week"] + [f"a_{u}" for u in UNITS]], on=["away_ab", "season", "week"], how="left")
FPNET = []
for o, d in PAIRS:
    if f"h_{o}" in m.columns and f"a_{d}" in m.columns:
        m[f"fpnet_{o[2:]}"] = (m[f"h_{o}"] - m[f"a_{d}"]) - (m[f"a_{o}"] - m[f"h_{d}"]); FPNET.append(f"fpnet_{o[2:]}")
# true season-to-date nets from team_week_seasonal (nflverse abbreviations -> production style)
T = pd.read_parquet("data/team_week_seasonal.parquet"); T["team"] = T.team.replace(AB)
S = {"pass": ("off_pass_epa_neutral_s2d", "def_pass_epa_allowed_neutral_s2d"), "rush": ("off_rush_epa_neutral_s2d", "def_rush_epa_allowed_neutral_s2d"),
     "ppd": ("off_pts_per_drive_s2d", "def_pts_per_drive_allowed_s2d"), "proe": ("off_proe_s2d", None)}
th = T.rename(columns={"team": "home_ab", **{c: "h_" + c for c in T.columns if c.endswith("_s2d")}})
ta = T.rename(columns={"team": "away_ab", **{c: "a_" + c for c in T.columns if c.endswith("_s2d")}})
m = m.merge(th[["home_ab", "season", "week"] + [c for c in th.columns if c.startswith("h_")]], on=["home_ab", "season", "week"], how="left")
m = m.merge(ta[["away_ab", "season", "week"] + [c for c in ta.columns if c.startswith("a_")]], on=["away_ab", "season", "week"], how="left")
TRUE = []
for k, (o, d) in S.items():
    if d: m[f"true_net_{k}"] = (m[f"h_{o}"] + m[f"a_{d}"]) - (m[f"a_{o}"] + m[f"h_{d}"])
    else: m[f"true_net_{k}"] = m[f"h_{o}"] - m[f"a_{o}"]
    TRUE.append(f"true_net_{k}")
BROKEN = [c for c in ("net_pass_epa_neutral_s2d", "net_rush_epa_neutral_s2d", "net_pts_per_drive_s2d", "net_ppd_s2d") if c in BASE]
print(f"broken nets in BASE: {BROKEN} | true nets: {TRUE} | coverage 2023-25: {m[m.season>=2023][TRUE].notna().mean().mean():.0%}")
od = pd.read_parquet("data/odds_consensus.parquet")[["season", "home_ab", "away_ab", "open_spread", "close_spread"]]
m = m.merge(od, on=["season", "home_ab", "away_ab"], how="left")
D = [c for c in BASE if c not in BROKEN] + TRUE
ARMS = {"A production": BASE, "B +FP nets": BASE + FPNET, "D fixed s2d": D, "D2 +true nets": BASE + TRUE, "E fixed + FP": D + FPNET}
print("\n" + "=" * 118); print("SIDES — walk-forward 2023-25, 5 seeds averaged, bet at the OPENER"); print("=" * 118)
res = {}
for lab, feats in ARMS.items():
    rows = []
    for ssn in (2023, 2024, 2025):
        tr = m[(m.season < ssn) & (m.week >= 4)].dropna(subset=["home_cover"]); te = m[m.season == ssn].copy(); ps = []
        for seed in range(5):
            clf = HistGradientBoostingClassifier(max_depth=3, learning_rate=0.05, max_iter=300, l2_regularization=2.0, min_samples_leaf=40, random_state=seed).fit(tr[feats], tr.home_cover)
            ps.append(clf.predict_proba(te[feats])[:, 1])
        te["ph"] = np.mean(ps, axis=0); rows.append(te)
    R = pd.concat(rows).dropna(subset=["open_spread"]); res[lab] = R; out = f"  {lab:14s}"
    for conf in (0.03, 0.045, 0.06):
        d = R[(R.ph - 0.5).abs() >= conf]; d = d[(d.actual_margin + d.open_spread) != 0]
        won = np.where(d.ph > 0.5, d.actual_margin + d.open_spread > 0, d.actual_margin + d.open_spread < 0)
        out += f" | {conf:.3f}: {100*won.mean():5.1f}% n={len(d):3d} {100*(won.mean()*0.909-(1-won.mean())):+5.1f}%"
    d = R[(R.ph - 0.5).abs() >= 0.03]; d = d[(d.actual_margin + d.open_spread) != 0]
    won = np.where(d.ph > 0.5, d.actual_margin + d.open_spread > 0, d.actual_margin + d.open_spread < 0)
    ll = -np.mean(R.dropna(subset=["home_cover"]).apply(lambda r: np.log(r.ph if r.home_cover == 1 else 1 - r.ph), axis=1))
    print(out + "  by yr " + "/".join(f"{100*won[(d.season==s).values].mean():.0f}" for s in (2023, 2024, 2025)) + f"  logloss {ll:.4f}")
print("  (logloss on ALL games, lower = better-calibrated probabilities; a real feature improvement shows here before it shows in hit%)")
