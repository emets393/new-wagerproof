"""
Find games where the POSTED line diverged most from our reverse-engineered reconstruction,
then show the OUTCOME + likely reason (backup QB / injury / wind). Leak-safe walk-forward:
each game is reconstructed by a model trained only on prior seasons.
"""
import os, sys, warnings
import numpy as np, pandas as pd
warnings.filterwarnings("ignore")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from stats_helpers import wilson_ci, bet_summary, fmt
from sklearn.ensemble import HistGradientBoostingRegressor
pd.set_option("display.width", 220)
DATA = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
m = pd.read_parquet(os.path.join(DATA, "matchup.parquet"))
L = print
m["pr_diff"] = m["home_predictive_pr"] - m["away_predictive_pr"]
m["rest_diff"] = m["home_rest"] - m["away_rest"]
m["mkt_margin"] = -m["home_spread"]

BAN_SUB = ["spread", "ou_vegas", "favorite", "_fav", "mkt_margin", "implied_", "resid_", "_miss", "actual_",
           "home_score", "away_score", "total_points", "total_diff", "over_win", "home_cover", "ats_", "_ml",
           "home_win", "underdog", "ou_result", "home_away", "_arch", "pair_", "exp_margin_ppd",
           "exp_home_ppd", "exp_away_ppd", "total_line"]
BAN_EXACT = {"season", "week", "home_team_id", "away_team_id", "game_time", "spread_diff", "total_diff",
             "spread_miss", "total_miss", "fav_margin", "fav_spread_diff", "upset_outright",
             "home_modal_qb", "away_modal_qb", "home_qb_status", "away_qb_status"}
feats = [c for c in m.columns if c not in BAN_EXACT and not any(b in c for b in BAN_SUB)
         and (pd.api.types.is_numeric_dtype(m[c]) or m[c].dtype == bool)]
for c in ["pr_diff", "rest_diff", "primetime", "wind_mph", "dome_closed", "any_backup_qb"]:
    if c in m.columns and c not in feats:
        feats.append(c)
feats = sorted(set(feats))
for f in feats:
    m[f] = pd.to_numeric(m[f], errors="coerce")
W = m[m["week"] >= 4].copy()


def wf_predict(target):
    out = []
    for Y in range(2021, 2026):
        tr = W[W.season < Y].dropna(subset=[target]); te = W[W.season == Y].dropna(subset=[target])
        if len(tr) < 400 or len(te) < 30:
            continue
        gb = HistGradientBoostingRegressor(max_depth=4, learning_rate=0.05, max_iter=500,
                                           l2_regularization=1.0, min_samples_leaf=30, random_state=0).fit(tr[feats], tr[target])
        t = te.copy(); t["pred"] = gb.predict(te[feats]); out.append(t)
    return pd.concat(out)


# ---------------- SPREAD outliers ----------------
S = wf_predict("mkt_margin")
S["our_margin"] = S["pred"]
S["disc"] = S["our_margin"] - S["mkt_margin"]            # >0: we like home more than the market
S["abs_disc"] = S["disc"].abs()
S["cover_side"] = np.where(S["spread_diff"] > 0, "HOME", np.where(S["spread_diff"] < 0, "AWAY", "PUSH"))
S["our_side"] = np.where(S["disc"] > 0, "HOME", "AWAY")
S["our_correct"] = np.where(S["cover_side"] == "PUSH", "push",
                            np.where(S["our_side"] == S["cover_side"], "OUR ✓", "mkt ✓"))


def qbflag(r):
    tags = []
    if r.get("home_backup_qb", 0) == 1: tags.append("HOME backup-QB")
    if r.get("away_backup_qb", 0) == 1: tags.append("AWAY backup-QB")
    if r.get("home_qb_out_or_doubtful", 0) == 1: tags.append("home QB out/dbt")
    if r.get("away_qb_out_or_doubtful", 0) == 1: tags.append("away QB out/dbt")
    if pd.notna(r.get("wind_mph")) and r.get("wind_mph", 0) >= 15: tags.append(f"wind {r['wind_mph']:.0f}")
    return ", ".join(tags) if tags else ""


def show_games(df, title):
    L("\n" + "=" * 118); L(title); L("=" * 118)
    L(f"  {'season/wk':10s} {'matchup (away @ home)':34s} {'posted':>7s} {'ours':>7s} {'disc':>6s} "
      f"{'result':>9s} {'→':>4s} {'why line moved off our model':30s}")
    for _, r in df.iterrows():
        posted = -r["mkt_margin"]   # back to home_spread convention for readability
        ours = -r["our_margin"]
        matchup = f"{r['away_team']} @ {r['home_team']}"
        res = f"{int(r['home_score'])}-{int(r['away_score'])}"
        L(f"  {int(r['season'])} wk{int(r['week']):<2d}  {matchup:34s} {posted:>+7.1f} {ours:>+7.1f} "
          f"{r['disc']:>+6.1f} {res:>9s} {r['our_correct']:>6s}  {qbflag(r):30s}")


# attach raw context cols
for c in ["home_backup_qb", "away_backup_qb", "home_qb_out_or_doubtful", "away_qb_out_or_doubtful",
          "home_score", "away_score", "home_team", "away_team"]:
    if c not in S.columns:
        S[c] = m.loc[S.index, c]

top = S.sort_values("abs_disc", ascending=False).head(25)
show_games(top, "TOP 25 SPREAD OUTLIERS — posted line vs our reverse-engineered line (home_spread shown)")

L("\n  -- summary: how often was OUR side right among the biggest spread discrepancies? --")
for q, lab in [(0.90, "top 10% |disc|"), (0.95, "top 5% |disc|")]:
    thr = S["abs_disc"].quantile(q); sub = S[S["abs_disc"] >= thr]
    won = (sub["our_correct"] == "OUR ✓").sum(); n = (sub["our_correct"] != "push").sum()
    lo, hi = wilson_ci(int(won), int(n))
    bk = (sub[["home_backup_qb", "away_backup_qb"]].max(axis=1) == 1).mean()
    L(f"   {lab:14s} (|disc|>={thr:.1f}, n={int(n)}): OUR side covered {won}/{int(n)} = {won/n*100:.1f}% "
      f"CI[{lo*100:.0f},{hi*100:.0f}] | {bk*100:.0f}% had a backup QB")

# ---------------- TOTAL outliers ----------------
T = wf_predict("ou_vegas_line")
T["our_total"] = T["pred"]; T["disc"] = T["our_total"] - T["ou_vegas_line"]; T["abs_disc"] = T["disc"].abs()
T["ou_side"] = np.where(T["disc"] > 0, "OVER", "UNDER")
T["ou_res"] = np.where(T["total_diff"] > 0, "OVER", np.where(T["total_diff"] < 0, "UNDER", "PUSH"))
T["our_correct"] = np.where(T["ou_res"] == "PUSH", "push", np.where(T["ou_side"] == T["ou_res"], "OUR ✓", "mkt ✓"))
for c in ["home_score", "away_score", "home_team", "away_team", "wind_mph"]:
    if c not in T.columns:
        T[c] = m.loc[T.index, c]
L("\n" + "=" * 118); L("TOP 18 TOTAL OUTLIERS — posted O/U vs our reconstruction"); L("=" * 118)
L(f"  {'season/wk':10s} {'matchup':34s} {'posted':>7s} {'ours':>7s} {'disc':>6s} {'actual':>7s} {'→':>7s}  context")
for _, r in T.sort_values("abs_disc", ascending=False).head(18).iterrows():
    actual = r["home_score"] + r["away_score"]
    ctx = f"wind {r['wind_mph']:.0f}" if pd.notna(r["wind_mph"]) and r["wind_mph"] >= 15 else ("dome" if r.get("dome_closed", 0) == 1 else "")
    L(f"  {int(r['season'])} wk{int(r['week']):<2d}  {r['away_team']+' @ '+r['home_team']:34s} "
      f"{r['ou_vegas_line']:>7.1f} {r['our_total']:>7.1f} {r['disc']:>+6.1f} {actual:>7.0f} {r['our_correct']:>7s}  {ctx}")
thr = T["abs_disc"].quantile(0.90); sub = T[T["abs_disc"] >= thr]
won = (sub["our_correct"] == "OUR ✓").sum(); n = (sub["our_correct"] != "push").sum()
L(f"\n  total top 10% |disc| (>= {thr:.1f}, n={int(n)}): OUR side hit {won}/{int(n)} = {won/n*100:.1f}%")
