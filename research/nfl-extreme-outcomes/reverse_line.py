"""
REVERSE-ENGINEER THE LINE: predict the closing spread (mkt_margin = -home_spread) and the
closing total (ou_vegas_line) from ALL leak-safe pregame features, walk-forward.
- Ridge (standardized) -> signed point-contributions = 'what the book weights' / what's noise.
- HistGBM -> R^2 (how completely we reconstruct the line) + permutation importance.
- Discrepancy test: where our reconstruction diverges from the posted line, do OUTCOMES side
  with us (edge) or the market (we were just missing info)?  + what the residual is made of.
"""
import os, sys, warnings
import numpy as np
import pandas as pd
warnings.filterwarnings("ignore")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from stats_helpers import wilson_ci, bet_summary, fmt
from sklearn.linear_model import Ridge
from sklearn.preprocessing import StandardScaler
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.inspection import permutation_importance
from sklearn.metrics import r2_score

DATA = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
m = pd.read_parquet(os.path.join(DATA, "matchup.parquet"))
L = print
m["rest_diff"] = m["home_rest"] - m["away_rest"]
m["pr_diff"] = m["home_predictive_pr"] - m["away_predictive_pr"]
m["sos_diff"] = m["home_sos_pr"] - m["away_sos_pr"]
m["last5_diff"] = m["home_last5_pr"] - m["away_last5_pr"]
m["mkt_margin"] = -m["home_spread"]            # TARGET 1 (sign: + favors home)
# TARGET 2 = ou_vegas_line

# ---- leak-safe feature list: exclude anything derived from the line / score / outcome ----
BAN_SUB = ["spread", "ou_vegas", "favorite", "_fav", "mkt_margin", "implied_", "resid_", "_miss",
           "actual_", "home_score", "away_score", "total_points", "total_diff", "over_win",
           "home_cover", "ats_", "_ml", "home_win", "underdog", "ou_result", "home_away",
           "_arch", "pair_", "exp_margin_ppd", "exp_home_ppd", "exp_away_ppd"]  # exp_*_ppd ~ scoring, keep exp_total? drop margin/home/away to avoid target leak via spread
BAN_EXACT = {"season", "week", "home_team_id", "away_team_id", "game_time", "total_points",
             "home_score", "away_score", "spread_diff", "total_diff", "spread_miss", "total_miss",
             "fav_margin", "fav_spread_diff", "upset_outright", "home_modal_qb", "away_modal_qb",
             "home_qb_status", "away_qb_status"}
feats = []
for c in m.columns:
    if c in BAN_EXACT or any(b in c for b in BAN_SUB):
        continue
    if pd.api.types.is_numeric_dtype(m[c]) or m[c].dtype == bool:
        feats.append(c)
# also add engineered diffs / situational
for c in ["rest_diff", "pr_diff", "sos_diff", "last5_diff", "home_rest", "away_rest",
          "primetime", "kick_hour_et", "is_thu", "is_mon", "div_game", "dome_closed",
          "is_outdoor", "wind_mph", "temp_f", "precipitation_pct", "any_backup_qb",
          "home_backup_qb", "away_backup_qb", "ref_total_pts_avg"]:
    if c in m.columns and c not in feats:
        feats.append(c)
feats = sorted(set(feats))
for f in feats:
    m[f] = pd.to_numeric(m[f], errors="coerce")
W = m[m["week"] >= 4].copy()
L(f"[setup] candidate features: {len(feats)}; games (week>=4): {len(W)}")


def walk_forward_line(target, label):
    L("\n" + "="*92); L(f"REVERSE-ENGINEER: {label}  (target={target})"); L("="*92)
    gbm_r2, lin_r2, base_r2 = [], [], []
    preds = []
    for Y in range(2021, 2026):
        tr = W[(W["season"] < Y)].dropna(subset=[target])
        te = W[(W["season"] == Y)].dropna(subset=[target])
        if len(tr) < 400 or len(te) < 30:
            continue
        Xtr, Xte = tr[feats], te[feats]
        gb = HistGradientBoostingRegressor(max_depth=4, learning_rate=0.05, max_iter=500,
                                           l2_regularization=1.0, min_samples_leaf=30, random_state=0)
        gb.fit(Xtr, tr[target]); pg = gb.predict(Xte)
        # ridge on imputed+scaled
        med = Xtr.median()
        sc = StandardScaler().fit(Xtr.fillna(med).fillna(0))
        rg = Ridge(alpha=10.0).fit(sc.transform(Xtr.fillna(med).fillna(0)), tr[target])
        pl = rg.predict(sc.transform(Xte.fillna(med).fillna(0)))
        # baseline: pr_diff only
        b = np.polyfit(tr["pr_diff"], tr[target], 1)
        pb = np.polyval(b, te["pr_diff"])
        gbm_r2.append(r2_score(te[target], pg)); lin_r2.append(r2_score(te[target], pl)); base_r2.append(r2_score(te[target], pb))
        t = te[[target, "season", "pr_diff"]].copy(); t["gb_pred"] = pg
        preds.append(t)
        L(f"  {Y}: R^2  pr_diff-only={base_r2[-1]:.3f}  ridge-all={lin_r2[-1]:.3f}  GBM-all={gbm_r2[-1]:.3f}  (n={len(te)})")
    L(f"  MEAN R^2: pr_diff-only={np.mean(base_r2):.3f}  ridge-all={np.mean(lin_r2):.3f}  GBM-all={np.mean(gbm_r2):.3f}")

    # ---- interpretable point-contributions (Ridge on full sample, standardized) ----
    full = W.dropna(subset=[target])
    med = full[feats].median()
    sc = StandardScaler().fit(full[feats].fillna(med).fillna(0))
    rg = Ridge(alpha=10.0).fit(sc.transform(full[feats].fillna(med).fillna(0)), full[target])
    coef = pd.DataFrame({"feat": feats, "pts_per_SD": rg.coef_}).assign(absc=lambda x: x.pts_per_SD.abs()).sort_values("absc", ascending=False)
    L(f"\n  TOP DRIVERS of {label} (Ridge, points of line per 1 SD of feature):")
    for _, r in coef.head(15).iterrows():
        L(f"     {r.feat:36s} {r.pts_per_SD:+6.3f} pts/SD")
    L(f"  NOISE (smallest |contribution|, market ~ignores):")
    for _, r in coef.tail(8).iterrows():
        L(f"     {r.feat:36s} {r.pts_per_SD:+6.3f} pts/SD")

    # ---- GBM permutation importance (test 2025) ----
    tr = W[(W["season"] <= 2024)].dropna(subset=[target]); te = W[(W["season"] == 2025)].dropna(subset=[target])
    gb = HistGradientBoostingRegressor(max_depth=4, learning_rate=0.05, max_iter=500, l2_regularization=1.0,
                                       min_samples_leaf=30, random_state=0).fit(tr[feats], tr[target])
    pi = permutation_importance(gb, te[feats], te[target], n_repeats=10, random_state=0, scoring="r2")
    imp = pd.DataFrame({"feat": feats, "imp": pi.importances_mean}).sort_values("imp", ascending=False)
    L(f"\n  GBM permutation importance (Δ R^2, test 2025) — TOP 12:")
    for _, r in imp.head(12).iterrows():
        L(f"     {r.feat:36s} {r.imp:+.4f}")
    return pd.concat(preds) if preds else pd.DataFrame()


P_sp = walk_forward_line("mkt_margin", "CLOSING SPREAD (home margin)")
P_to = walk_forward_line("ou_vegas_line", "CLOSING TOTAL")

# ---- DISCREPANCY -> OUTCOME edge test (spread) ----
L("\n"+"="*92); L("DISCREPANCY TEST — where our reconstructed line != posted line, who's right?"); L("="*92)
mm = m[["unique_id", "season", "spread_diff", "total_diff", "any_backup_qb", "wind_mph", "mkt_margin"]]
P = P_sp.merge(m[["season"]].reset_index().rename(columns={"index": "idx"}), left_index=True, right_on="idx", how="left")
P = P_sp.join(m[["spread_diff", "any_backup_qb", "wind_mph"]])
P["our_edge"] = P["gb_pred"] - P["mkt_margin"]   # >0: we think home better than the posted line
P["ats_home"] = np.where(P["spread_diff"] > 0, 1.0, np.where(P["spread_diff"] < 0, 0.0, np.nan))
L("  bet our side when reconstructed spread diverges from posted spread:")
for thr in [1.0, 2.0, 3.0]:
    hs = P["our_edge"] >= thr; aw = P["our_edge"] <= -thr
    won = pd.concat([P.loc[hs, "ats_home"], 1 - P.loc[aw, "ats_home"]]).dropna()
    k = int((won == 1).sum()); n = int(won.isin([0, 1]).sum())
    L("   |our-posted|>=%.0f: %s" % (thr, fmt(bet_summary(k, n, f"thr{thr}"))))
# is the residual explained by info we 'underweight' (backup QB)? compare our_edge for backup vs not
bk = P[P["any_backup_qb"] == 1]["our_edge"]; nb = P[P["any_backup_qb"] == 0]["our_edge"]
L(f"\n  residual diagnostic: mean our_edge | backup-QB game = {bk.mean():+.2f} vs no-backup = {nb.mean():+.2f}")
L("   (if our model over-rates teams that actually have a backup in -> market shades away from them -> residual)")

# total discrepancy
P2 = P_to.join(m[["total_diff"]])
P2["our_edge_t"] = P2["gb_pred"] - P2["ou_vegas_line"]
P2["over_win"] = np.where(P2["total_diff"] > 0, 1.0, np.where(P2["total_diff"] < 0, 0.0, np.nan))
L("\n  TOTALS: bet our side when reconstructed total diverges from posted total:")
for thr in [1.0, 2.0, 3.0]:
    ov = P2["our_edge_t"] >= thr; un = P2["our_edge_t"] <= -thr
    won = pd.concat([P2.loc[ov, "over_win"], 1 - P2.loc[un, "over_win"]]).dropna()
    k = int((won == 1).sum()); n = int(won.isin([0, 1]).sum())
    L("   |our-posted total|>=%.0f: %s" % (thr, fmt(bet_summary(k, n, f"thr{thr}"))))
