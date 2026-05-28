"""
'True adjusted power rating' — first cut with available data.
(1) Build a PROCESS rating (net neutral EPA, leak-safe s2d) and a RESULTS rating (pts/drive margin).
(2) Calibrate rating -> points ('true net point value' of a rating unit) via walk-forward OLS.
(3) LEVEL test: does our EPA rating predict actual margin better than predictive_pr and the LINE (OOS)?
(4) DIVERGENCE test: bet our side when our rating spread disagrees with the market (ATS, per season).
(5) LUCK/REGRESSION test: fade teams whose RESULTS outran their EPA (overrated), back the unlucky.
"""
import os, sys, warnings
import numpy as np
import pandas as pd
warnings.filterwarnings("ignore")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from stats_helpers import wilson_ci, bet_summary, fmt
DATA = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
m = pd.read_parquet(os.path.join(DATA, "matchup.parquet"))   # has team-week off/def + line + outcomes
L = print
W = m[m["week"] >= 4].copy()

# ---- ratings from team-week components (leak-safe s2d) ----
# PROCESS = net neutral EPA (offense good + defense good), per team
for side in ["home", "away"]:
    W[f"{side}_proc"] = (W[f"{side}_off_pass_epa_neutral_s2d"] + W[f"{side}_off_rush_epa_neutral_s2d"]
                         - W[f"{side}_def_pass_epa_allowed_neutral_s2d"] - W[f"{side}_def_rush_epa_allowed_neutral_s2d"])
    # RESULTS = net pts/drive (offense ppd - defense ppd allowed)
    W[f"{side}_res"] = (W[f"{side}_off_pts_per_drive_s2d"] - W[f"{side}_def_pts_per_drive_allowed_s2d"])
W["proc_diff"] = W["home_proc"] - W["away_proc"]
W["res_diff"] = W["home_res"] - W["away_res"]
W["pr_diff"] = W["home_predictive_pr"] - W["away_predictive_pr"]
W["mkt_margin"] = -W["home_spread"]
W["ats_home"] = np.where(W["spread_diff"] > 0, 1.0, np.where(W["spread_diff"] < 0, 0.0, np.nan))


def ols_fit(d, xcols):
    X = np.column_stack([np.ones(len(d))] + [d[c].values for c in xcols])
    beta = np.linalg.lstsq(X, d["actual_margin"].values, rcond=None)[0]
    return beta

L("="*90); L("(2)+(3) CALIBRATION + LEVEL TEST (walk-forward): which rating predicts margin best?"); L("="*90)
L("  Out-of-sample corr & MAE vs actual margin, train seasons<Y, test Y (Y=2021..2025)")
res_level = {k: [] for k in ["proc", "res", "pr", "market", "proc+pr"]}
preds_all = []
for Y in range(2021, 2026):
    tr = W[(W["season"] < Y)].dropna(subset=["proc_diff", "res_diff", "pr_diff", "actual_margin"])
    te = W[(W["season"] == Y)].dropna(subset=["proc_diff", "res_diff", "pr_diff", "actual_margin", "mkt_margin"])
    if len(tr) < 300 or len(te) < 30:
        continue
    fits = {
        "proc": (ols_fit(tr, ["proc_diff"]), ["proc_diff"]),
        "res": (ols_fit(tr, ["res_diff"]), ["res_diff"]),
        "pr": (ols_fit(tr, ["pr_diff"]), ["pr_diff"]),
        "proc+pr": (ols_fit(tr, ["proc_diff", "pr_diff"]), ["proc_diff", "pr_diff"]),
    }
    row = {"Y": Y, "n": len(te)}
    te2 = te.copy()
    for name, (beta, xc) in fits.items():
        X = np.column_stack([np.ones(len(te))] + [te[c].values for c in xc])
        pred = X @ beta
        te2[f"pred_{name}"] = pred
        row[name + "_corr"] = np.corrcoef(pred, te["actual_margin"])[0, 1]
        row[name + "_mae"] = np.abs(pred - te["actual_margin"]).mean()
    row["market_corr"] = np.corrcoef(te["mkt_margin"], te["actual_margin"])[0, 1]
    row["market_mae"] = np.abs(te["mkt_margin"] - te["actual_margin"]).mean()
    res_level["proc"].append(row)
    preds_all.append(te2)
rl = pd.DataFrame(res_level["proc"])
L("\n   corr with actual margin (higher=better):")
L("   year   proc   res    pr   proc+pr  MARKET")
for _, r in rl.iterrows():
    L(f"   {int(r.Y)}  {r['proc_corr']:.3f} {r['res_corr']:.3f} {r['pr_corr']:.3f}  {r['proc+pr_corr']:.3f}   {r['market_corr']:.3f}")
L(f"   MEAN  {rl['proc_corr'].mean():.3f} {rl['res_corr'].mean():.3f} {rl['pr_corr'].mean():.3f}  "
  f"{rl['proc+pr_corr'].mean():.3f}   {rl['market_corr'].mean():.3f}")
L("\n   MAE (lower=better):")
L(f"   MEAN  proc={rl['proc_mae'].mean():.2f} res={rl['res_mae'].mean():.2f} pr={rl['pr_mae'].mean():.2f} "
  f"proc+pr={rl['proc+pr_mae'].mean():.2f}  MARKET={rl['market_mae'].mean():.2f}")
P = pd.concat(preds_all)

L("\n"+"="*90); L("(4) DIVERGENCE TEST — bet our rating's side when it disagrees with the market"); L("="*90)
# use the proc+pr blended prediction as 'our line'
P["our_edge"] = P["pred_proc+pr"] - P["mkt_margin"]
for thr in [1.0, 2.0, 3.0, 4.0]:
    hs = P["our_edge"] >= thr; as_ = P["our_edge"] <= -thr
    won = pd.concat([P.loc[hs, "ats_home"], 1 - P.loc[as_, "ats_home"]]).dropna()
    k = int((won == 1).sum()); n = int(won.isin([0, 1]).sum())
    L("  our line disagrees >=%.0f pts: %s" % (thr, fmt(bet_summary(k, n, f"thr{thr}"))))
L("  per-season (disagree>=3):")
for Y in sorted(P["season"].unique()):
    pp = P[P["season"] == Y]; hs = pp["our_edge"] >= 3; as_ = pp["our_edge"] <= -3
    won = pd.concat([pp.loc[hs, "ats_home"], 1 - pp.loc[as_, "ats_home"]]).dropna()
    k = int((won == 1).sum()); n = int(won.isin([0, 1]).sum())
    L("    " + fmt(bet_summary(k, n, str(int(Y)))))

L("\n"+"="*90); L("(5) LUCK / REGRESSION TEST — fade teams whose RESULTS outran their EPA"); L("="*90)
# luck = results rating - process rating (z within season). Positive = lucky/overrated.
for side in ["home", "away"]:
    W[f"{side}_luck"] = W[f"{side}_res"] - 0  # placeholder; standardize jointly below
# standardize proc & res to comparable scale within season, then luck = z(res) - z(proc)
def zwithin(col):
    return W.groupby("season")[col].transform(lambda s: (s - s.mean()) / s.std())
W["home_luck"] = zwithin("home_res") - zwithin("home_proc")
W["away_luck"] = zwithin("away_res") - zwithin("away_proc")
W["luck_diff"] = W["home_luck"] - W["away_luck"]   # >0 home is the luckier (more overrated) team
# fade the luckier team: bet AGAINST whichever team is luckier
for thr in [0.5, 1.0, 1.5]:
    fade_home = W["luck_diff"] >= thr   # home luckier -> bet away
    fade_away = W["luck_diff"] <= -thr  # away luckier -> bet home
    won = pd.concat([1 - W.loc[fade_home, "ats_home"], W.loc[fade_away, "ats_home"]]).dropna()
    k = int((won == 1).sum()); n = int(won.isin([0, 1]).sum())
    L("  fade luckier team (|luck_diff|>=%.1f): %s" % (thr, fmt(bet_summary(k, n, f"thr{thr}"))))
L("  per-season (fade luckier, |luck_diff|>=1.0):")
for Y in sorted(W["season"].dropna().unique()):
    ww = W[W["season"] == Y]; fh = ww["luck_diff"] >= 1.0; fa = ww["luck_diff"] <= -1.0
    won = pd.concat([1 - ww.loc[fh, "ats_home"], ww.loc[fa, "ats_home"]]).dropna()
    k = int((won == 1).sum()); n = int(won.isin([0, 1]).sum())
    L("    " + fmt(bet_summary(k, n, str(int(Y)))))
# does luck predict the residual margin (orthogonal to line)?
d = W.dropna(subset=["luck_diff", "spread_diff"])
L(f"\n  corr(luck_diff, spread_diff[margin-line]) = {np.corrcoef(d['luck_diff'], d['spread_diff'])[0,1]:+.3f} "
  f"(negative => lucky teams underperform the line next = exploitable)")
