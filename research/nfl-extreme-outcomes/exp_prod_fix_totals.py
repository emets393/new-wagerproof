#!/usr/bin/env python3
"""TOTALS: does fixing the season-to-date inputs help b15 / b55 the way it helped sides?
b15 sums cumulative-since-2018 `_s2d` columns (off_ppd_sum, pass_epa_sum, ...). Arms:
  A  b15 as locked (strict-open)          D2 b15 + TRUE season-to-date sums (pbp, K=4)
  and the same for b55 via an augmented matchup frame (true cols injected as home_/away_ pairs,
  forced into the top-N feature list). Graded vs the OPEN total: b15 alone at |edge|>=2 and the
  production HC rule (b15 & b55 agree, 3<=min edge<=7). Walk-forward 2023-25 (+2022 with rebuilt
  openers where possible), `--train` forced so no frozen pkl is loaded, scratch DATA dir so
  production pkls are untouched."""
import io, contextlib, importlib.util as iu, os, sys, shutil, warnings, glob
import numpy as np, pandas as pd
warnings.filterwarnings("ignore")
from sklearn.ensemble import HistGradientBoostingRegressor
ROOT = os.getcwd(); DATA = os.path.join(ROOT, "data"); SCR = os.path.join(ROOT, "data", "_scratch_totals"); os.makedirs(SCR, exist_ok=True)
for f in os.listdir(DATA):
    p = os.path.join(DATA, f)
    if os.path.isfile(p) and not f.startswith("totals_b") and not os.path.exists(os.path.join(SCR, f)): os.symlink(p, os.path.join(SCR, f))
sys.argv = [sys.argv[0], "--train"]
spec = iu.spec_from_file_location("ct", "consensus_totals.py"); CT = iu.module_from_spec(spec)
with contextlib.redirect_stdout(io.StringIO()): spec.loader.exec_module(CT)
CT.DATA = SCR
AB = {"LA": "LAR", "JAX": "JAC", "WAS": "WSH", "LV": "LVR", "ARI": "ARZ", "BAL": "BLT", "CLE": "CLV", "HOU": "HST"}
m0 = pd.read_parquet(os.path.join(DATA, "matchup.parquet")); ours = set(m0.home_ab.unique()); AB = {k: v for k, v in AB.items() if v in ours and k not in ours}
T = pd.read_parquet(os.path.join(DATA, "team_week_seasonal.parquet")); T["team"] = T.team.replace(AB)
TC = {"off_pass_epa_neutral_s2d": "true_off_pass", "off_rush_epa_neutral_s2d": "true_off_rush", "off_pts_per_drive_s2d": "true_off_ppd", "off_proe_s2d": "true_off_proe",
      "def_pass_epa_allowed_neutral_s2d": "true_def_pass", "def_rush_epa_allowed_neutral_s2d": "true_def_rush", "def_pts_per_drive_allowed_s2d": "true_def_ppd"}
def augment(m):
    for side in ("home", "away"):
        t = T.rename(columns={"team": f"{side}_ab", **{k: f"{side}_{v}" for k, v in TC.items()}})
        m = m.merge(t[[f"{side}_ab", "season", "week"] + [f"{side}_{v}" for v in TC.values()]], on=[f"{side}_ab", "season", "week"], how="left")
    for v in ("pass", "rush", "ppd", "proe"): m[f"true_off_{v}_sum"] = m[f"home_true_off_{v}"] + m[f"away_true_off_{v}"]
    for v in ("pass", "rush", "ppd"): m[f"true_def_{v}_sum"] = m[f"home_true_def_{v}"] + m[f"away_true_def_{v}"]
    return m
MA = augment(m0); MA.to_parquet(os.path.join(SCR, "matchup_aug.parquet"), index=False)
TRUE_SUM = [f"true_off_{v}_sum" for v in ("pass", "rush", "ppd", "proe")] + [f"true_def_{v}_sum" for v in ("pass", "rush", "ppd")]
print(f"true sums coverage 2023-25: {MA[MA.season>=2023][TRUE_SUM].notna().mean().mean():.0%}")

# ---- b15 re-implemented (identical feature block + optional true sums) ----
def b15(target, extra=()):
    m = MA.copy(); m["actual_total"] = m.home_score + m.away_score
    m["wind_mph"] = pd.to_numeric(m.wind_mph, errors="coerce").fillna(pd.to_numeric(m.wind_speed, errors="coerce"))
    m["temp_f"] = pd.to_numeric(m.temp_f, errors="coerce").fillna(pd.to_numeric(m.temperature, errors="coerce"))
    m["dome"] = (m.dome_closed.fillna(0).astype(float) > 0).astype(int) if "dome_closed" in m else 0
    m["wind_under"] = (m.wind_mph >= 15).astype(int); m["cold"] = (m.temp_f <= 32).astype(int); m["primetime_i"] = m.primetime.fillna(0).astype(int)
    s = lambda c: pd.to_numeric(m[c], errors="coerce") if c in m.columns else np.nan
    m["off_ppd_sum"] = s("home_off_ppd_s2d") + s("away_off_ppd_s2d"); m["def_ppd_sum"] = s("home_def_ppd_allowed_s2d") + s("away_def_ppd_allowed_s2d")
    m["pace_sum"] = s("home_off_pace_s2d") + s("away_off_pace_s2d"); m["pass_epa_sum"] = s("home_off_pass_epa_neutral_s2d") + s("away_off_pass_epa_neutral_s2d")
    m["rush_epa_sum"] = s("home_off_rush_epa_neutral_s2d") + s("away_off_rush_epa_neutral_s2d")
    m["def_pass_allowed_sum"] = s("home_def_pass_epa_allowed_neutral_s2d") + s("away_def_pass_epa_allowed_neutral_s2d")
    m["def_rush_allowed_sum"] = s("home_def_rush_epa_allowed_neutral_s2d") + s("away_def_rush_epa_allowed_neutral_s2d")
    m["expl_pass_sum"] = s("home_off_explosive_pass_rate_s2d") + s("away_off_explosive_pass_rate_s2d"); m["td_per_drive_sum"] = s("home_off_td_per_drive_s2d") + s("away_off_td_per_drive_s2d")
    m["last_pts_sum"] = s("home_last_points") + s("away_last_points") + s("home_last_allowed_points") + s("away_last_allowed_points")
    m["no_huddle_sum"] = s("home_off_no_huddle_rate_s2d") + s("away_off_no_huddle_rate_s2d")
    B15 = ["off_ppd_sum", "def_ppd_sum", "pace_sum", "pass_epa_sum", "rush_epa_sum", "def_pass_allowed_sum", "def_rush_allowed_sum", "expl_pass_sum", "td_per_drive_sum", "last_pts_sum", "no_huddle_sum",
           "wind_mph", "temp_f", "dome", "wind_under", "cold", "primetime_i"] + list(extra)          # strict-open: no injury feats
    B15 = [c for c in B15 if c in m.columns and pd.to_numeric(m[c], errors="coerce").notna().mean() > 0.5]
    for c in B15: m[c] = pd.to_numeric(m[c], errors="coerce")
    W = m[m.week >= 4].copy(); trn = W[W.season < target].dropna(subset=["actual_total"] + B15); te = W[W.season == target]
    ps = [HistGradientBoostingRegressor(**{**CT.B15_PARAMS, "random_state": sd}).fit(trn[B15], trn.actual_total).predict(te[B15]) for sd in range(3)]
    return te.assign(pt=np.mean(ps, axis=0))[["season", "week", "home_ab", "away_ab", "pt"]]

od = pd.read_parquet(os.path.join(DATA, "odds_consensus.parquet"))[["season", "home_ab", "away_ab", "open_total", "close_total"]]
res = {}
for lab, extra in (("A b15 locked", ()), ("D2 b15 + true sums", TRUE_SUM)):
    R = pd.concat([b15(y, extra) for y in (2023, 2024, 2025)]).merge(od, on=["season", "home_ab", "away_ab"], how="left")
    R = R.merge(m0[["season", "week", "home_ab", "away_ab", "home_score", "away_score"]], on=["season", "week", "home_ab", "away_ab"]); R["act"] = R.home_score + R.away_score
    R["e"] = R.pt - R.open_total; res[lab] = R
    out = f"  {lab:20s}"
    for lo, hi, tag in ((2, 99, ">=2"), (3, 7, "3-7 HC")):
        d = R[(R.e.abs() >= lo) & (R.e.abs() <= hi) & (R.act != R.open_total)]; w = np.where(d.e > 0, d.act > d.open_total, d.act < d.open_total)
        out += f" | {tag:6s} {100*w.mean():5.1f}% n={len(d):3d} ROI {100*(w.mean()*0.909-(1-w.mean())):+5.1f}%  by yr " + "/".join(f"{100*w[(d.season==s).values].mean():.0f}" for s in (2023, 2024, 2025))
    rmse = np.sqrt(((R.pt - R.act) ** 2).mean()); print(out + f" | RMSE {rmse:.2f} (market {np.sqrt(((R.open_total - R.act) ** 2).mean()):.2f})")
print("\n" + "=" * 100); print("b15 alone above.  Now b55 with the true columns injected (forced into its feature list) + the production HC ensemble rule"); print("=" * 100)
imp = pd.read_csv(os.path.join(DATA, "b54_feature_importance.csv"))
def run_b55(inject):
    src = MA if inject else m0; src.to_parquet(os.path.join(SCR, "matchup.parquet"), index=False)
    im = imp.copy()
    if inject: im = pd.concat([pd.DataFrame({"feature": [f"off_{v}" for v in TC.values()] + [f"def_{v}" for v in TC.values()], "imp": im.imp.max() * 2}), im], ignore_index=True)
    im.to_csv(os.path.join(SCR, "b54_feature_importance.csv"), index=False)
    out = []
    for y in (2023, 2024, 2025):
        for f in glob.glob(os.path.join(SCR, f"totals_b55_{y}.pkl")): os.remove(f)
        with contextlib.redirect_stdout(io.StringIO()): out.append(CT.build_b55(y, strict_open=True))
    return pd.concat(out)
os.remove(os.path.join(SCR, "matchup.parquet")) if os.path.islink(os.path.join(SCR, "matchup.parquet")) else None
os.remove(os.path.join(SCR, "b54_feature_importance.csv")) if os.path.islink(os.path.join(SCR, "b54_feature_importance.csv")) else None
B55 = {"A": run_b55(False), "D2": run_b55(True)}
for lab in ("A", "D2"):
    R = B55[lab].merge(od, on=["season", "home_ab", "away_ab"], how="left").merge(m0[["season", "week", "home_ab", "away_ab", "home_score", "away_score"]], on=["season", "week", "home_ab", "away_ab"])
    R["act"] = R.home_score + R.away_score; R["e"] = R.pt_b55 - R.open_total
    d = R[(R.e.abs() >= 2) & (R.act != R.open_total)]; w = np.where(d.e > 0, d.act > d.open_total, d.act < d.open_total)
    print(f"  b55 {lab:3s} alone |edge|>=2: {100*w.mean():5.1f}% n={len(d)} ROI {100*(w.mean()*0.909-(1-w.mean())):+5.1f}%  RMSE {np.sqrt(((R.pt_b55-R.act)**2).mean()):.2f}")
    b15r = res["A b15 locked" if lab == "A" else "D2 b15 + true sums"][["season", "week", "home_ab", "away_ab", "pt"]]
    E = R.merge(b15r, on=["season", "week", "home_ab", "away_ab"]); E["e15"] = E.pt - E.open_total
    agree = (np.sign(E.e15) == np.sign(E.e)) & (E.e15 != 0); E["mn"] = np.minimum(E.e15.abs(), E.e.abs())
    d = E[agree & (E.mn >= 3) & (E.mn <= 7) & (E.act != E.open_total)]; w = np.where(d.e > 0, d.act > d.open_total, d.act < d.open_total)
    print(f"  ENSEMBLE {lab:3s} (HC rule: agree, 3<=min edge<=7): {100*w.mean():5.1f}% n={len(d)} ROI {100*(w.mean()*0.909-(1-w.mean())):+5.1f}%  by yr " + "/".join(f"{100*w[(d.season==s).values].mean():.0f}" for s in (2023, 2024, 2025)))
