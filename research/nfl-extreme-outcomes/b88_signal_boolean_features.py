"""
b88 — MODEL IMPROVEMENT 1: spot-signal fire-flags as features in the sides model.

IDEA (user): our TIER-1 spot rules are independent edges. Instead of (only) layering them
on top of the model, feed each rule's fire-state INTO the classifier as a signed feature
(+1 = rule points home-cover, -1 = away-cover, 0 = silent) and let the model learn weights.

WALK-FORWARD INTEGRITY
  - train: seasons < Y, week >= 4 (identical to locked b14 folds)
  - all flag ingredients are as-of pregame (s2d/last-N use shift(1); pr/tiers from harness build())
  - flags computed from CLOSE spread (matchup.parquet) so they exist 2018+; market-microstructure
    flags (soft-ml, dk-juice, legacy) only exist 2023+/where DB has rows -> NaN, HistGBM handles natively
  - NOTE h_tier/a_tier use within-season PR percentile (same def as locked b66 spots). The percentile
    denominator includes future games' ratings (not outcomes). Mild; consistent with locked product.

VARIANTS (same folds, same eval)
  V0 = locked BASE (control, must reproduce locked behavior)
  V1 = BASE + 4 signed spot flags available 2018+ (fade_pr, trap, top_top_pt, pt_fav)
  V2 = V1 + net_sig (sum of signed flags)
  V3 = V2 + market flags (legacy follow/fade signed, soft_ml, dk_juice) NaN-padded

EVAL per target season 2019-2025 + pooled:
  - AUC / logloss on all target games
  - picks at CONF=0.03 (locked): n, hit% vs CLOSE  (apples-to-apples across variants)
  - hit% at conf >= 0.06 and >= 0.10 buckets (mammoth-relevant)
"""
import os, sys, warnings
import numpy as np, pandas as pd
warnings.filterwarnings("ignore")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.metrics import roc_auc_score, log_loss
from stats_helpers import wilson_ci
from forecast_harness import build, CONF, FADE_HI, FADE_LO, load_dk_open, build_spread_lookup
DATA = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data"); L = print

m, BASE = build()
L(f"[build] {m.shape}, BASE={len(BASE)} features")

# ---------------- signed spot flags (2018+, close-spread based) ----------------
sp = m.home_spread  # close spread (home perspective, + = home dog)
m["sig_fade_pr"] = np.where((sp.abs() <= 1.5) & (m.pr_diff.abs() >= 3), np.where(m.pr_diff < 0, 1, -1), 0)
hmm, amm = m.h_margin_miss_s2d, m.a_margin_miss_s2d
trap_away = (hmm >= 3) & (amm <= -3) & (sp > 0)
trap_home = (amm >= 3) & (hmm <= -3) & (sp < 0)
m["sig_trap"] = np.where(trap_home, 1, np.where(trap_away, -1, 0))
pt = m.primetime_i.fillna(0).astype(int) == 1
tight = sp.abs() <= 3
m["sig_top_top_pt"] = np.where(pt & tight & (m.h_tier == "top") & (m.a_tier == "top"), 1, 0)
m["sig_pt_fav"] = np.where(pt & tight & (sp != 0), np.where(sp < 0, 1, -1), 0)
FLAGS_CORE = ["sig_fade_pr", "sig_trap", "sig_top_top_pt", "sig_pt_fav"]

# ---------------- market flags (2023+ / where data exists, NaN elsewhere) ----------------
# legacy model: follow in primetime, fade at extremes (harness rules LPT/LF)
leg = m.get("leg_sp")
m["sig_legacy"] = np.nan
has_leg = leg.notna()
m.loc[has_leg & pt, "sig_legacy"] = np.where(leg[has_leg & pt] >= 0.5, 1, -1)
npt = has_leg & ~pt
m.loc[npt, "sig_legacy"] = np.where(leg[npt] <= FADE_LO, 1, np.where(leg[npt] >= FADE_HI, -1, 0))

od = pd.read_parquet(os.path.join(DATA, "odds_consensus.parquet"))
m = m.merge(od[["season", "home_ab", "away_ab", "open_spread", "open_ml_home", "open_ml_away"]],
            on=["season", "home_ab", "away_ab"], how="left")
def _ml_p(ml):
    ml = pd.to_numeric(ml, errors="coerce")
    return np.where(ml < 0, -ml / (-ml + 100), 100 / (ml + 100))
sp_lookup = build_spread_lookup()
ml_h_i = pd.Series(_ml_p(m.open_ml_home), index=m.index); ml_a_i = pd.Series(_ml_p(m.open_ml_away), index=m.index)
ml_h_nv = ml_h_i / (ml_h_i + ml_a_i)
sp_imp_h = (m.open_spread.abs() / 0.5).round().mul(0.5).map(sp_lookup).fillna(0.5)
sp_imp_h = pd.Series(np.where(m.open_spread > 0, 1 - sp_imp_h, np.where(m.open_spread == 0, 0.5, sp_imp_h)), index=m.index)
div_h = ml_h_nv - sp_imp_h
m["sig_soft_ml"] = np.where(m.open_spread.isna() | ml_h_nv.isna(), np.nan,
                            np.where((m.open_spread.abs() <= 3) & (div_h <= -0.04), -1, 0))

dk_all = []
for y in sorted(m.season.unique()):
    d = load_dk_open(int(y))
    if len(d): dk_all.append(d)
dk = pd.concat(dk_all, ignore_index=True) if dk_all else pd.DataFrame(columns=["season", "home_ab", "away_ab", "dk_juice"])
m = m.merge(dk[["season", "home_ab", "away_ab", "dk_juice"]], on=["season", "home_ab", "away_ab"], how="left") \
    if "dk_juice" in dk.columns else m.assign(dk_juice=np.nan)
m["sig_dk_juice"] = np.where(m.dk_juice.isna(), np.nan, np.where(m.dk_juice <= -120, 1, 0))
FLAGS_MKT = ["sig_legacy", "sig_soft_ml", "sig_dk_juice"]

m["net_sig"] = m[FLAGS_CORE].sum(axis=1) + m[FLAGS_MKT].fillna(0).sum(axis=1)

for f in FLAGS_CORE + FLAGS_MKT:
    fired = (pd.to_numeric(m[f], errors="coerce").fillna(0) != 0).sum()
    L(f"  flag {f:16s}: fires {fired} ({fired/len(m)*100:.1f}%)")

VARIANTS = {
    "V0_locked_base": BASE,
    "V1_core_flags":  BASE + FLAGS_CORE,
    "V2_plus_netsig": BASE + FLAGS_CORE + ["net_sig"],
    "V3_plus_market": BASE + FLAGS_CORE + ["net_sig"] + FLAGS_MKT,
}

def run_fold(feats, target):
    tr = m[(m.season < target) & (m.week >= 4)].dropna(subset=["home_cover"])
    te = m[m.season == target].dropna(subset=["home_cover"]).copy()
    if len(tr) < 300 or len(te) == 0: return None
    X_tr = tr[feats].apply(pd.to_numeric, errors="coerce")
    X_te = te[feats].apply(pd.to_numeric, errors="coerce")
    clf = HistGradientBoostingClassifier(max_depth=3, learning_rate=0.05, max_iter=300,
                                         l2_regularization=2.0, min_samples_leaf=40, random_state=0)
    clf.fit(X_tr, tr.home_cover)
    te["ph"] = clf.predict_proba(X_te)[:, 1]
    return te

def eval_te(te):
    """hit% vs CLOSE at conf buckets + AUC/logloss; pushes excluded from hit%."""
    y = te.home_cover.values; p = te.ph.values
    auc = roc_auc_score(y, p) if len(set(y)) > 1 else np.nan
    ll = log_loss(y, p, labels=[0, 1])
    out = dict(auc=auc, logloss=ll, n_games=len(te))
    push = (te.actual_margin + te.home_spread) == 0
    for tag, cut in [("c03", 0.03), ("c06", 0.06), ("c10", 0.10)]:
        pick = (np.abs(p - 0.5) >= cut) & (~push.values)
        sub_y = y[pick]; sub_p = p[pick]
        wins = int(((sub_p >= 0.5) == (sub_y == 1)).sum())
        out[f"{tag}_n"] = int(pick.sum()); out[f"{tag}_hit"] = wins / pick.sum() * 100 if pick.sum() else np.nan
        out[f"{tag}_w"] = wins
    return out

YEARS = list(range(2019, 2026))
results = {}
for vname, feats in VARIANTS.items():
    rows = []; pooled = []
    for y in YEARS:
        te = run_fold(feats, y)
        if te is None: continue
        e = eval_te(te); e["season"] = y; rows.append(e); pooled.append(te)
    results[vname] = (pd.DataFrame(rows), pd.concat(pooled, ignore_index=True))

L("\n" + "=" * 100)
L("PER-SEASON: picks at locked CONF=0.03 — hit% vs CLOSE (apples-to-apples across variants)")
L("=" * 100)
hdr = f"{'season':7s}" + "".join(f"{v:>24s}" for v in VARIANTS)
L(hdr)
for i, y in enumerate(YEARS):
    line = f"{y:<7d}"
    for v in VARIANTS:
        df = results[v][0]; r = df[df.season == y]
        line += f"{'--':>24s}" if len(r) == 0 else f"{r.iloc[0].c03_w:>5.0f}/{r.iloc[0].c03_n:<4.0f}={r.iloc[0].c03_hit:5.1f}%        "
    L(line)

L("\nPOOLED 2019-2025 (and 2025 holdout) per variant:")
for v in VARIANTS:
    df, te_all = results[v]
    for tag in ["c03", "c06", "c10"]:
        w = df[f"{tag}_w"].sum(); n = df[f"{tag}_n"].sum()
        if n == 0: continue
        lo, hi = wilson_ci(int(w), int(n))
        h25 = df[df.season == 2025]
        h25s = f"  2025: {h25.iloc[0][f'{tag}_w']:.0f}/{h25.iloc[0][f'{tag}_n']:.0f}={h25.iloc[0][f'{tag}_hit']:.1f}%" if len(h25) and h25.iloc[0][f"{tag}_n"] > 0 else ""
        L(f"  {v:18s} {tag}: {w:4.0f}/{n:4.0f}={w/n*100:5.2f}% CI[{lo*100:.1f},{hi*100:.1f}]{h25s}")
    L(f"  {v:18s} mean AUC={df.auc.mean():.4f}  mean logloss={df.logloss.mean():.4f}")
L("\n[done] b88")
