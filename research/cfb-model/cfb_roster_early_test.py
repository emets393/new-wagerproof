"""Historical early-week test of PLAYER-LEVEL roster reconstruction (task #102).

Does rebuilding each team from individual players (returning production, imported transfer
production, talent stock, projected QB1) gauge wk1-3 games better than prior-year team
ratings — and does it carry anything the closing line doesn't?

Walk-forward: train seasons < S (wk1-3 completed games), eval wk1-3 of S in 2022-2025
(portal era). Metrics per config: MAE vs actual margin | corr w/ line | λ (residual-on-line
slope: info beyond the market) | disagreement decile (who wins our biggest deviations).
Subsets on the best config: G5-vs-G5 (softer lines), high-turnover teams, transfer-QB teams.
"""
import numpy as np
import pandas as pd
from pathlib import Path
from sklearn.linear_model import Ridge

HERE = Path(__file__).resolve().parent
DATA = HERE / "data"

gm = pd.read_parquet(DATA / "model_games.parquet")
gm = gm[gm.homePoints.notna() & gm.spread_close.notna()].copy()
gm["actual_margin"] = gm.homePoints - gm.awayPoints
gm["line_margin"] = -gm.spread_close
fav = gm.spread_close < 0
assert 0.40 < ((gm.actual_margin + gm.spread_close) > 0)[fav].mean() < 0.60, "sign check"

pri = pd.read_parquet(DATA / "priors.parquet")
rs = pd.read_parquet(DATA / "roster_scores.parquet")
rs = rs.merge(pri[["season", "team", "prior_sp", "prior_fpi", "recruit_3yr"]],
              on=["season", "team"], how="left")

h = rs.add_prefix("h_").rename(columns={"h_season": "season", "h_team": "homeTeam"})
a = rs.add_prefix("a_").rename(columns={"a_season": "season", "a_team": "awayTeam"})
gm = gm.merge(h, on=["season", "homeTeam"], how="left").merge(a, on=["season", "awayTeam"], how="left")
for c in ("ret_prod", "in_prod", "net_prod", "ret_share", "talent_stock",
          "qb1_prior", "qb1_rating", "qb1_transfer", "prior_sp", "prior_fpi", "recruit_3yr"):
    gm[f"d_{c}"] = gm[f"h_{c}"] - gm[f"a_{c}"]
gm["neutralSite"] = gm.neutralSite.fillna(False).astype(int)

BASE = ["d_prior_sp", "d_prior_fpi", "d_recruit_3yr", "neutralSite"]
ROSTER = ["d_ret_prod", "d_in_prod", "d_net_prod", "d_ret_share", "d_talent_stock",
          "d_qb1_prior", "d_qb1_rating", "d_qb1_transfer", "neutralSite"]
CFGS = {"BASE": BASE, "ROSTER-ONLY": ROSTER, "BASE+ROSTER": sorted(set(BASE + ROSTER))}
EVAL = [2022, 2023, 2024, 2025]


def run(feats, sub=None):
    preds = pd.Series(np.nan, index=gm.index)
    for S in EVAL:
        tr = gm[(gm.week <= 3) & (gm.season < S) & gm.actual_margin.notna()].copy()
        te = gm[(gm.week <= 3) & (gm.season == S)].copy()
        mu = tr[feats].mean()
        mdl = Ridge(alpha=10.0).fit(tr[feats].fillna(mu), tr.actual_margin)
        preds.loc[te.index] = mdl.predict(te[feats].fillna(mu))
    ev = gm[(gm.week <= 3) & gm.season.isin(EVAL) & preds.notna() & gm.line_margin.notna()].copy()
    ev["pred"] = preds.loc[ev.index]
    if sub is not None:
        ev = ev[sub.loc[ev.index]]
    if len(ev) < 60:
        return None
    x, y = ev.pred - ev.line_margin, ev.actual_margin - ev.line_margin
    lam = np.polyfit(x, y, 1)[0]
    se = np.sqrt(np.sum((y - lam * x) ** 2) / (len(x) - 1)) / np.sqrt(np.sum((x - x.mean()) ** 2))
    ev["gap"] = x.abs()
    top = ev[ev.gap >= ev.gap.quantile(0.90)]
    return dict(n=len(ev), mae=(ev.pred - ev.actual_margin).abs().mean(),
                mae_line=(ev.line_margin - ev.actual_margin).abs().mean(),
                corr=np.corrcoef(ev.pred, ev.line_margin)[0, 1], lam=lam, se=se,
                dis_us=(top.pred - top.actual_margin).abs().mean(),
                dis_mkt=(top.line_margin - top.actual_margin).abs().mean())


print(f"{'config':12s} {'n':>5} {'MAE':>6} {'lineMAE':>7} {'corr':>6} {'λ':>7} {'SE':>5} {'dis: us':>8} {'mkt':>6}")
for name, feats in CFGS.items():
    r = run(feats)
    print(f"{name:12s} {r['n']:5d} {r['mae']:6.2f} {r['mae_line']:7.2f} {r['corr']:6.3f} "
          f"{r['lam']:+7.3f} {r['se']:5.3f} {r['dis_us']:8.2f} {r['dis_mkt']:6.2f}")

# ---- subsets on BASE+ROSTER ----
P5 = {"SEC", "Big Ten", "Big 12", "ACC", "Pac-12"}
subs = {
    "G5 vs G5":      ~gm.homeConference.isin(P5) & ~gm.awayConference.isin(P5),
    "high-turnover": (gm[["h_ret_share", "a_ret_share"]].min(axis=1) < 0.35),
    "transfer-QB":   (gm.h_qb1_transfer == 1) | (gm.a_qb1_transfer == 1),
    "P5 vs P5":      gm.homeConference.isin(P5) & gm.awayConference.isin(P5),
}
print("\nsubsets (BASE+ROSTER):")
for name, m in subs.items():
    r = run(CFGS["BASE+ROSTER"], sub=m.fillna(False))
    if r:
        print(f"  {name:14s} n={r['n']:4d} MAE {r['mae']:6.2f} vs line {r['mae_line']:6.2f} | "
              f"λ {r['lam']:+.3f} (SE {r['se']:.3f})")
    else:
        print(f"  {name:14s} too thin")
