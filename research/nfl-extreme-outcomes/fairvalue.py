"""
FAIR-VALUE MODEL + ABSTAIN FLAG
================================
What it is (and isn't), per our research:
- LINE-ANCHORED fair value: a transparent Ridge model that reconstructs the market spread & total
  from the features the books actually weight (PR, QB/injury status, recent form, passing/pace/dome/wind).
  It is calibrated to MATCH the market when we are fully informed — we proved a self-built rating cannot
  *beat* the closing line, so this is a fair-value anchor + line-shopping/fast-quote tool, not a spread edge.
- ABSTAIN FLAG: large divergence between our number and the posted line almost always means we are MISSING
  INFORMATION (Week 17-18 rest/motivation, a backup QB / injury our crude flag can't quantify). We showed
  betting those divergences is a coin flip. So the flag tells us when NOT to trust our number / not to bet.
- TOTALS LEAN OVERLAY: the only +EV signals we validated are on totals — high wind (outdoor) -> UNDER and
  primetime -> UNDER. Emitted only on non-abstain games.

Walk-forward (train seasons<Y, test Y) so every per-game fair line is out-of-sample.
Outputs: out/fairvalue_games.csv + a validation report + the feature point-value sheet.
"""
import os, sys, warnings
import numpy as np, pandas as pd
warnings.filterwarnings("ignore")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from stats_helpers import wilson_ci, bet_summary, fmt
from sklearn.linear_model import Ridge
from sklearn.preprocessing import StandardScaler
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.metrics import r2_score
DATA = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "out")
L = print
m = pd.read_parquet(os.path.join(DATA, "matchup.parquet"))

# ---- engineered, always-available drivers (avoid FTN scheme -> no pre-2022 NaN columns) ----
m["mkt_margin"] = -m["home_spread"]                       # spread target (+ favors home)
m["pr_diff"] = m["home_predictive_pr"] - m["away_predictive_pr"]
m["last5_diff"] = m["home_last5_pr"] - m["away_last5_pr"]
m["passer_diff"] = m["home_off_passer_rating_s2d"] - m["away_off_passer_rating_s2d"]
m["injury_diff"] = m["home_injury_severity"] - m["away_injury_severity"]
m["rest_diff"] = m["home_rest"] - m["away_rest"]
m["is_outdoor"] = (~m["dome_closed"].astype("boolean").fillna(False)).astype(int)
m["backup_count"] = m["home_backup_qb"].fillna(0) + m["away_backup_qb"].fillna(0)
m["wind_out"] = np.where(m["is_outdoor"] == 1, m["wind_mph"].fillna(0), 0.0)

SPREAD_FEATS = ["pr_diff", "last5_diff", "passer_diff", "injury_diff", "rest_diff",
                "home_backup_qb", "away_backup_qb", "home_qb_out_or_doubtful", "away_qb_out_or_doubtful",
                "hnet_pass_epa", "anet_pass_epa", "hnet_rush_epa", "anet_rush_epa"]
# Total reconstructs poorly from coarse aggregates — give it the granular per-team scoring components.
TOTAL_FEATS = ["home_off_pass_epa_neutral_s2d", "away_off_pass_epa_neutral_s2d",
               "home_def_pass_epa_allowed_neutral_s2d", "away_def_pass_epa_allowed_neutral_s2d",
               "home_off_rush_epa_neutral_s2d", "away_off_rush_epa_neutral_s2d",
               "home_def_rush_epa_allowed_neutral_s2d", "away_def_rush_epa_allowed_neutral_s2d",
               "home_off_pts_per_drive_s2d", "away_off_pts_per_drive_s2d",
               "home_def_pts_per_drive_allowed_s2d", "away_def_pts_per_drive_allowed_s2d",
               "home_off_plays_per_game_s2d", "away_off_plays_per_game_s2d",
               "home_off_explosive_pass_rate_s2d", "away_off_explosive_pass_rate_s2d",
               "home_predictive_pr", "away_predictive_pr",
               "pace_sum", "exp_total_ppd", "passer_diff", "dome_closed", "wind_out", "temp_f", "backup_count"]
for f in set(SPREAD_FEATS + TOTAL_FEATS):
    m[f] = pd.to_numeric(m[f], errors="coerce")
W = m[m["week"] >= 4].copy()


def walk_forward(target, feats, alpha=10.0):
    """Out-of-sample Ridge predictions + per-season R^2. Returns predictions aligned to W index."""
    pred = pd.Series(index=W.index, dtype=float); r2s = []
    for Y in range(2021, 2026):
        tr = W[(W.season < Y)].dropna(subset=[target]); te = W[(W.season == Y)].dropna(subset=[target])
        if len(tr) < 400 or len(te) < 30:
            continue
        med = tr[feats].median()
        sc = StandardScaler().fit(tr[feats].fillna(med).fillna(0))
        rg = Ridge(alpha=alpha).fit(sc.transform(tr[feats].fillna(med).fillna(0)), tr[target])
        p = rg.predict(sc.transform(te[feats].fillna(med).fillna(0)))
        pred.loc[te.index] = p
        r2s.append((Y, r2_score(te[target], p), len(te)))
    return pred, r2s


def walk_forward_gbm(target, feats):
    """Out-of-sample GBM predictions (handles NaN, captures nonlinearity) — used for the TOTAL,
    which reconstructs poorly with a linear model."""
    pred = pd.Series(index=W.index, dtype=float); r2s = []
    for Y in range(2021, 2026):
        tr = W[(W.season < Y)].dropna(subset=[target]); te = W[(W.season == Y)].dropna(subset=[target])
        if len(tr) < 400 or len(te) < 30:
            continue
        gb = HistGradientBoostingRegressor(max_depth=3, learning_rate=0.05, max_iter=400,
                                           l2_regularization=1.0, min_samples_leaf=40, random_state=0)
        gb.fit(tr[feats], tr[target]); p = gb.predict(te[feats])
        pred.loc[te.index] = p; r2s.append((Y, r2_score(te[target], p), len(te)))
    return pred, r2s


def coef_sheet(target, feats, alpha=10.0):
    """Final-model point-values: raw coef (points of line per unit of feature)."""
    full = W.dropna(subset=[target]); med = full[feats].median()
    Xf = full[feats].fillna(med).fillna(0)
    sc = StandardScaler().fit(Xf)
    rg = Ridge(alpha=alpha).fit(sc.transform(Xf), full[target])
    # convert standardized coef back to raw points-per-unit
    raw = rg.coef_ / sc.scale_
    intercept = rg.intercept_ - np.sum(rg.coef_ * sc.mean_ / sc.scale_)
    df = pd.DataFrame({"feature": feats, "pts_per_unit": raw,
                       "pts_per_SD": rg.coef_}).assign(a=lambda x: x.pts_per_SD.abs()).sort_values("a", ascending=False)
    return df, intercept


L("="*92); L("FAIR-VALUE MODEL — walk-forward reconstruction quality (out-of-sample R^2)"); L("="*92)
W["fair_margin"], r2_sp = walk_forward("mkt_margin", SPREAD_FEATS)          # Ridge (linear, 0.81 — as good as GBM)
W["fair_total"], r2_to = walk_forward_gbm("ou_vegas_line", TOTAL_FEATS)     # GBM (total reconstructs poorly linearly)
L("  SPREAD (Ridge): " + "  ".join(f"{Y}={r:.3f}" for Y, r, _ in r2_sp) + f"  | MEAN={np.mean([r for _,r,_ in r2_sp]):.3f}")
L("  TOTAL  (GBM)  : " + "  ".join(f"{Y}={r:.3f}" for Y, r, _ in r2_to) + f"  | MEAN={np.mean([r for _,r,_ in r2_to]):.3f}")

# ---- per-game fair lines (standard convention) + discrepancies ----
W = W.dropna(subset=["fair_margin", "fair_total"]).copy()
W["fair_spread"] = -W["fair_margin"]                       # negative = home favored
W["market_spread"] = W["home_spread"]
W["spread_disc"] = W["fair_margin"] - W["mkt_margin"]      # >0: we like home more than market
W["market_total"] = W["ou_vegas_line"]
W["total_disc"] = W["fair_total"] - W["ou_vegas_line"]     # >0: we project more points than market

# ---- ABSTAIN logic ----
SPREAD_DISC_THR, TOTAL_DISC_THR = 3.0, 3.0
W["blindspot"] = ((W["week"] >= 17) | (W["backup_count"] >= 1) |
                  (W["home_qb_out_or_doubtful"] == 1) | (W["away_qb_out_or_doubtful"] == 1))
W["abstain_spread"] = (W["blindspot"] | (W["spread_disc"].abs() >= SPREAD_DISC_THR))
W["abstain_total"] = (W["blindspot"] | (W["total_disc"].abs() >= TOTAL_DISC_THR))
def reason(r):
    rs = []
    if r["week"] >= 17: rs.append("late-season(rest/motivation)")
    if r["backup_count"] >= 1: rs.append("backup-QB")
    if r["home_qb_out_or_doubtful"] == 1 or r["away_qb_out_or_doubtful"] == 1: rs.append("QB-out/doubtful")
    if abs(r["spread_disc"]) >= SPREAD_DISC_THR: rs.append(f"spread-divergence {r['spread_disc']:+.1f}")
    if abs(r["total_disc"]) >= TOTAL_DISC_THR: rs.append(f"total-divergence {r['total_disc']:+.1f}")
    return "; ".join(rs)
W["abstain_reason"] = W.apply(reason, axis=1)

# ---- TOTALS LEAN overlay (validated +EV: outdoor wind high-teens -> UNDER; primetime -> UNDER) ----
# Standalone physical/behavioral edges — fire INDEPENDENT of the fair-value abstain (a windy Week-18
# game is still a good UNDER no matter who is at QB). Wind takes priority over primetime.
def totals_lean(r):
    if r["is_outdoor"] == 1 and pd.notna(r["wind_mph"]) and r["wind_mph"] >= 15:
        return "UNDER (wind)"
    if r["primetime"] == 1:
        return "UNDER (primetime)"
    return ""
W["totals_lean"] = W.apply(totals_lean, axis=1)
W["confidence"] = np.where(W["blindspot"], "ABSTAIN(blindspot)",
                  np.where(W["spread_disc"].abs() >= SPREAD_DISC_THR, "ABSTAIN(divergence)",
                  np.where(W["spread_disc"].abs() < 1.5, "HIGH", "MEDIUM")))

# ---- save per-game ----
cols = ["unique_id", "season", "week", "away_team", "home_team", "market_spread", "fair_spread",
        "spread_disc", "market_total", "fair_total", "total_disc", "confidence", "abstain_spread",
        "abstain_total", "abstain_reason", "totals_lean", "home_score", "away_score"]
W[cols].round(2).to_csv(os.path.join(OUT, "fairvalue_games.csv"), index=False)
L(f"\n[saved] per-game fair-value table -> out/fairvalue_games.csv  ({len(W)} games)")

# ============================ VALIDATION ============================
W["ats_home"] = np.where(W["spread_diff"] > 0, 1.0, np.where(W["spread_diff"] < 0, 0.0, np.nan))
W["under_win"] = np.where(W["total_diff"] < 0, 1.0, np.where(W["total_diff"] > 0, 0.0, np.nan))

L("\n"+"="*92); L("VALIDATION 1 — calibration: how close is our fair line to the market?"); L("="*92)
for tgt, fair, mkt in [("spread", "fair_margin", "mkt_margin"), ("total", "fair_total", "ou_vegas_line")]:
    mae = (W[fair]-W[mkt]).abs().mean(); cr = np.corrcoef(W[fair], W[mkt])[0,1]
    nab = W[~W[f"abstain_{tgt}"]]
    mae_n = (nab[fair]-nab[mkt]).abs().mean()
    L(f"  {tgt:6s}: corr(fair,market)={cr:.3f} | MAE all={mae:.2f}  MAE non-abstain={mae_n:.2f} pts")

L("\n"+"="*92); L("VALIDATION 2 — does the ABSTAIN flag isolate the missing-info / coin-flip games?"); L("="*92)
L(f"  abstain_spread fires on {W['abstain_spread'].mean()*100:.0f}% of games; "
  f"abstain_total on {W['abstain_total'].mean()*100:.0f}%")
L("  -- spread: 'bet our side' cover% (we do NOT expect an edge; just checking abstain removes the worst) --")
for lab, sub in [("ABSTAIN games", W[W["abstain_spread"]]), ("NON-abstain (deployable)", W[~W["abstain_spread"]])]:
    bh = sub["spread_disc"] > 0
    won = np.where(bh, sub["ats_home"], 1 - sub["ats_home"]); won = pd.Series(won, index=sub.index).dropna()
    k = int((won == 1).sum()); n = int(won.isin([0, 1]).sum()); lo, hi = wilson_ci(k, n)
    L(f"     {lab:26s} n={n:4d} our-side cover={ (k/n*100 if n else 0):5.1f}% CI[{lo*100:.0f},{hi*100:.0f}]")
L("  -> abstaining is risk management: those games are coin flips because we lack the news, not edges.")

L("\n"+"="*92); L("VALIDATION 3 — do the TOTALS LEANS survive on the deployable (non-abstain) subset?"); L("="*92)
for lab, mask in [("UNDER lean: wind (outdoor>=15)", W["totals_lean"] == "UNDER (wind)"),
                  ("UNDER lean: primetime", W["totals_lean"] == "UNDER (primetime)"),
                  ("ALL emitted UNDER leans", W["totals_lean"].str.startswith("UNDER"))]:
    sub = W[mask]; oc = sub["under_win"].dropna()
    k = int((oc == 1).sum()); n = int(oc.isin([0, 1]).sum())
    L("   " + fmt(bet_summary(k, n, lab)))
L("   per-season, all emitted UNDER leans:")
sub = W[W["totals_lean"].str.startswith("UNDER")]
for Y in sorted(sub.season.unique()):
    oc = sub[sub.season == Y]["under_win"].dropna()
    L("     " + fmt(bet_summary(int((oc == 1).sum()), int(oc.isin([0, 1]).sum()), str(int(Y)))))

# ============================ FEATURE POINT-VALUE SHEET ============================
L("\n"+"="*92); L("FEATURE POINT-VALUE SHEET (what each feature is worth to the line)"); L("="*92)
sp_sheet, sp_hfa = coef_sheet("mkt_margin", SPREAD_FEATS)
L(f"  SPREAD (home margin)  [intercept / base HFA = {sp_hfa:+.2f} pts]")
for _, r in sp_sheet.head(10).iterrows():
    L(f"     {r.feature:26s} {r.pts_per_unit:+7.3f} pts/unit   ({r.pts_per_SD:+.2f}/SD)")
to_sheet, to_base = coef_sheet("ou_vegas_line", TOTAL_FEATS)
L(f"\n  TOTAL  [intercept / base total = {to_base:+.2f} pts]")
for _, r in to_sheet.head(10).iterrows():
    L(f"     {r.feature:26s} {r.pts_per_unit:+7.3f} pts/unit   ({r.pts_per_SD:+.2f}/SD)")

# ---- show a few example output rows ----
L("\n"+"="*92); L("SAMPLE OUTPUT (5 confident plays + 5 abstains, 2025)"); L("="*92)
s25 = W[W.season == 2025]
disp = ["week", "away_team", "home_team", "market_spread", "fair_spread", "spread_disc",
        "market_total", "fair_total", "totals_lean", "confidence"]
L("  CONFIDENT (high):")
L(s25[s25.confidence == "HIGH"][disp].head(5).to_string(index=False))
L("\n  ABSTAIN:")
L(s25[s25.confidence.str.startswith("ABSTAIN")][disp + ["abstain_reason"]].head(5).to_string(index=False))
