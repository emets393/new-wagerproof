"""
ORTHOGONAL SIGNAL MINING — does any matchup/archetype feature predict the result BEYOND the close?
Part A: linear screen of all matchup features vs line-relative residuals (+ BH-FDR).
Part B: walk-forward GBM on residual targets + betting ROI per market, per season.
Part C: archetype-pairing mining (resid total/margin/team-points) with FDR + per-season.
Part D: the brief's specific hypothesized interactions, tested directly.
"""
import os, sys, warnings
import numpy as np
import pandas as pd
warnings.filterwarnings("ignore")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from stats_helpers import wilson_ci, bet_summary, fmt
from scipy import stats
from sklearn.ensemble import HistGradientBoostingRegressor, HistGradientBoostingClassifier
from sklearn.inspection import permutation_importance

DATA = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
m = pd.read_parquet(os.path.join(DATA, "matchup_arch.parquet"))
L = print
W = m[m["week"] >= 4].copy()   # leak-safe: require season-to-date signal


def bh_fdr(pvals, q=0.10):
    p = np.array(pvals); n = len(p)
    order = np.argsort(p); ranked = p[order]
    thresh = q * (np.arange(1, n + 1)) / n
    passed = ranked <= thresh
    kmax = np.where(passed)[0].max() + 1 if passed.any() else 0
    crit = ranked[kmax - 1] if kmax > 0 else 0.0
    return p <= crit, crit


# ---------- candidate matchup feature list ----------
NETS = [c for c in W.columns if c.startswith(("hnet_", "anet_", "sep_", "env_"))]
ENG = ["exp_home_ppd", "exp_away_ppd", "exp_total_ppd", "exp_margin_ppd", "pace_sum", "proe_sum",
       "proe_prod", "nohuddle_sum", "expl_pass_sum", "to_rate_sum", "mismatch_mag", "sep_mag",
       "hpass_x_adeppass", "hrush_x_adefrush"]
ENG += [c for c in W.columns if "_x_" in c and c not in ENG]
FEATS = [c for c in NETS + ENG if c in W.columns]

L("="*92); L("PART A — LINEAR ORTHOGONALITY SCREEN (matchup feature vs line residual) + BH-FDR")
L("="*92)
for tgt in ["resid_total", "resid_margin", "resid_home_pts", "resid_away_pts", "spread_miss"]:
    rows = []
    for f in FEATS:
        d = W[[f, tgt]].dropna()
        if len(d) < 300 or d[f].nunique() < 5:
            continue
        r, p = stats.pearsonr(d[f], d[tgt])
        rows.append((f, r, p, len(d)))
    res = pd.DataFrame(rows, columns=["feat", "r", "p", "n"]).assign(absr=lambda x: x.r.abs())
    res = res.sort_values("absr", ascending=False)
    sig, crit = bh_fdr(res["p"].values, q=0.10)
    res["fdr_pass"] = sig
    L(f"\n  target={tgt}: screened {len(res)} feats; max|r|={res.absr.max():.3f}; "
      f"BH-FDR(0.10) survivors={int(res.fdr_pass.sum())}")
    for _, r in res.head(5).iterrows():
        L(f"     {r.feat:22s} r={r.r:+.3f} p={r.p:.3f} n={int(r.n)} {'<-FDR' if r.fdr_pass else ''}")

# ---------- Part B: walk-forward models on residual targets ----------
L("\n"+"="*92); L("PART B — WALK-FORWARD: does matchup signal beat the close out-of-sample?")
L("="*92)
MODEL_FEATS = FEATS + ["ou_vegas_line", "abs_spread", "home_fav", "week",
                       "wind_mph", "is_outdoor", "primetime", "div_game"]
MODEL_FEATS = [f for f in MODEL_FEATS if f in W.columns]
for f in MODEL_FEATS:
    W[f] = pd.to_numeric(W[f], errors="coerce")


def wf_regress_bet(target, side_pos, side_neg, test_seasons, label):
    """Train GBM to predict residual target; bet positive side if pred>0 else negative side."""
    picks = []
    for S in test_seasons:
        tr = W[(W["season"] < S) & W[target].notna()]
        te = W[(W["season"] == S) & W[target].notna()]
        if len(tr) < 400 or len(te) < 30:
            continue
        reg = HistGradientBoostingRegressor(max_depth=3, learning_rate=0.05, max_iter=300,
                                            l2_regularization=1.0, min_samples_leaf=40, random_state=0)
        reg.fit(tr[MODEL_FEATS], tr[target])
        pred = reg.predict(te[MODEL_FEATS])
        t = te[[target, "season", side_pos]].copy(); t["pred"] = pred
        picks.append(t)
    if not picks:
        return
    pk = pd.concat(picks)
    L(f"\n  >> {label} (bet model's predicted side)")
    for c in [0.0, 1.0, 2.0]:
        over = pk[pk["pred"] >= c]; under = pk[pk["pred"] <= -c]
        out = pd.concat([over[side_pos], 1 - under[side_pos]]).dropna()
        wins = int((out == 1).sum()); n = int(out.isin([0, 1]).sum())
        L(f"     |pred|>={c:.0f}: " + fmt(bet_summary(wins, n, f"thr{c}", -110)))
    # per-season at thr=1.0
    L("     per-season (|pred|>=1):")
    for S in sorted(pk["season"].unique()):
        ss = pk[pk["season"] == S]
        over = ss[ss["pred"] >= 1]; under = ss[ss["pred"] <= -1]
        out = pd.concat([over[side_pos], 1 - under[side_pos]]).dropna()
        wins = int((out == 1).sum()); n = int(out.isin([0, 1]).sum())
        L("       " + fmt(bet_summary(wins, n, str(int(S)), -110)))


W["over_win"] = pd.to_numeric(W["over_win"], errors="coerce")
W["home_cover"] = pd.to_numeric(W["home_cover"], errors="coerce")
wf_regress_bet("resid_total", "over_win", None, range(2021, 2026), "TOTALS: matchup model vs O/U line")
wf_regress_bet("resid_margin", "home_cover", None, range(2021, 2026), "SPREAD: matchup model vs ATS line")

# permutation importance for the totals residual model (train<=2024, test 2025)
L("\n  -- permutation importance, resid_total model (train<=2024 test 2025) --")
tr = W[(W["season"] <= 2024) & W["resid_total"].notna()]
te = W[(W["season"] == 2025) & W["resid_total"].notna()]
reg = HistGradientBoostingRegressor(max_depth=3, learning_rate=0.05, max_iter=300,
                                    l2_regularization=1.0, min_samples_leaf=40, random_state=0).fit(
    tr[MODEL_FEATS], tr["resid_total"])
pi = permutation_importance(reg, te[MODEL_FEATS], te["resid_total"], n_repeats=15, random_state=0,
                            scoring="neg_mean_absolute_error")
imp = pd.DataFrame({"f": MODEL_FEATS, "imp": pi.importances_mean}).sort_values("imp", ascending=False)
for _, r in imp.head(12).iterrows():
    L(f"     {r.f:22s} {r.imp:+.4f}")

# ---------- Part C: archetype-pairing mining ----------
L("\n"+"="*92); L("PART C — ARCHETYPE PAIRING MINING (vs line residual) + FDR + per-season")
L("="*92)
A = m[(m["season"] >= 2022) & (m["week"] >= 4)].copy()
A["over_win"] = pd.to_numeric(A["over_win"], errors="coerce")


def pairing_table(pair_col, resid_col, name, min_n=25):
    rows = []
    base_mean = A[resid_col].mean()
    for pv, sub in A.groupby(pair_col):
        if sub[pair_col].isna().all() or len(sub) < min_n or "<NA>" in str(pv):
            continue
        x = sub[resid_col].dropna()
        if len(x) < min_n:
            continue
        t, p = stats.ttest_1samp(x, base_mean)
        rows.append((pv, len(x), x.mean(), p))
    r = pd.DataFrame(rows, columns=["pair", "n", "mean_resid", "p"])
    if len(r) == 0:
        L(f"  {name}: no pairings with n>={min_n}"); return
    sig, crit = bh_fdr(r["p"].values, q=0.10)
    r["fdr"] = sig
    r = r.reindex(r["mean_resid"].abs().sort_values(ascending=False).index)
    L(f"\n  {name} (base mean resid={base_mean:+.2f}); BH-FDR survivors={int(r.fdr.sum())}/{len(r)}")
    for _, row in r.head(6).iterrows():
        L(f"     pair {row.pair:>5s} n={int(row.n):4d} mean_resid={row.mean_resid:+5.2f} p={row.p:.3f} {'<-FDR' if row.fdr else ''}")

pairing_table("pair_hoff_adef", "resid_home_pts", "HOME off-arch vs AWAY def-arch -> home pts resid")
pairing_table("pair_aoff_hdef", "resid_away_pts", "AWAY off-arch vs HOME def-arch -> away pts resid")
pairing_table("pair_hoff_adef", "resid_total", "HOME off vs AWAY def -> total resid")
pairing_table("pair_hoff_adef", "resid_margin", "HOME off vs AWAY def -> margin resid")

# ---------- Part D: hypothesized interactions, direct test (orthogonal) ----------
L("\n"+"="*92); L("PART D — HYPOTHESIZED INTERACTIONS (direct, vs line residual)"); L("="*92)
tests = [
    ("pace_sum high -> over?", "pace_sum", "resid_total", "high"),
    ("proe_sum high (two pass-happy) -> over?", "proe_sum", "resid_total", "high"),
    ("expl_pass_sum high -> over?", "expl_pass_sum", "resid_total", "high"),
    ("to_rate_sum high -> under?", "to_rate_sum", "resid_total", "low"),
    ("home expl_pass vs away leaky deep D -> home pts?", "hpass_x_adeppass", "resid_home_pts", "high"),
    ("mismatch_mag high -> blowout (|margin miss|)?", "mismatch_mag", "spread_miss", "high"),
    ("exp_total_ppd high -> over?", "exp_total_ppd", "resid_total", "high"),
]
for lab, feat, tgt, direction in tests:
    d = W[[feat, tgt]].dropna()
    if len(d) < 200:
        L(f"  {lab}: n<200 skip"); continue
    q = d[feat].quantile([.2, .8])
    hi = d[d[feat] >= q.iloc[1]][tgt]; lo = d[d[feat] <= q.iloc[0]][tgt]
    t, p = stats.ttest_ind(hi, lo, equal_var=False)
    L(f"  {lab:48s} top-quintile mean={hi.mean():+5.2f} vs bot={lo.mean():+5.2f} "
      f"diff={hi.mean()-lo.mean():+5.2f} p={p:.3f} (n_hi={len(hi)})")
