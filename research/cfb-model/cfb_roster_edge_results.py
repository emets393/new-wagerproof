"""Edge-bucket results for the BASE+ROSTER early-week blend (wk1-3, walk-forward 2022-25).

For SPREAD and TOTAL: bucket every eval game by |model edge vs the closing line|, grade the
model's side at the close (-110), show win% / ROI / per-season — plus the two lead subsets
(G5-vs-G5, transfer-QB) at each bucket. Oracle check on both graders.
"""
import numpy as np
import pandas as pd
from pathlib import Path
from sklearn.linear_model import Ridge

HERE = Path(__file__).resolve().parent
DATA = HERE / "data"
DEC = 1.909  # -110
EVAL = [2022, 2023, 2024, 2025]

gm = pd.read_parquet(DATA / "model_games.parquet")
gm = gm[gm.homePoints.notna() & gm.spread_close.notna() & gm.total_close.notna()].copy()
gm["actual_margin"] = gm.homePoints - gm.awayPoints
gm["actual_total"] = gm.homePoints + gm.awayPoints
gm["line_margin"] = -gm.spread_close
fav = gm.spread_close < 0
assert 0.40 < ((gm.actual_margin + gm.spread_close) > 0)[fav].mean() < 0.60, "sign check"

pri = pd.read_parquet(DATA / "priors.parquet")
rs = pd.read_parquet(DATA / "roster_scores.parquet")
rs = rs.merge(pri[["season", "team", "prior_sp", "prior_fpi", "recruit_3yr",
                   "prior_sp_off", "prior_sp_def"]], on=["season", "team"], how="left")
h = rs.add_prefix("h_").rename(columns={"h_season": "season", "h_team": "homeTeam"})
a = rs.add_prefix("a_").rename(columns={"a_season": "season", "a_team": "awayTeam"})
gm = gm.merge(h, on=["season", "homeTeam"], how="left").merge(a, on=["season", "awayTeam"], how="left")
for c in ("ret_prod", "in_prod", "net_prod", "ret_share", "talent_stock",
          "qb1_prior", "qb1_rating", "qb1_transfer", "prior_sp", "prior_fpi", "recruit_3yr"):
    gm[f"d_{c}"] = gm[f"h_{c}"] - gm[f"a_{c}"]
gm["off_sum"] = gm.h_prior_sp_off + gm.a_prior_sp_off
gm["def_sum"] = gm.h_prior_sp_def + gm.a_prior_sp_def
gm["s_talent"] = gm.h_talent_stock + gm.a_talent_stock
gm["s_qb"] = gm.h_qb1_prior + gm.a_qb1_prior
gm["neutralSite"] = gm.neutralSite.fillna(False).astype(int)

MF = ["d_prior_sp", "d_prior_fpi", "d_recruit_3yr", "neutralSite", "d_ret_prod", "d_in_prod",
      "d_net_prod", "d_ret_share", "d_talent_stock", "d_qb1_prior", "d_qb1_rating", "d_qb1_transfer"]
TF = ["off_sum", "def_sum", "d_prior_sp", "neutralSite", "s_talent", "s_qb",
      "d_ret_share", "d_qb1_transfer"]


def wf(feats, target):
    preds = pd.Series(np.nan, index=gm.index)
    for S in EVAL:
        tr = gm[(gm.week <= 3) & (gm.season < S) & gm[target].notna()].copy()
        te = gm[(gm.week <= 3) & (gm.season == S)].copy()
        mu = tr[feats].mean()
        mdl = Ridge(alpha=10.0).fit(tr[feats].fillna(mu), tr[target])
        preds.loc[te.index] = mdl.predict(te[feats].fillna(mu))
    return preds


gm["pm"] = wf(MF, "actual_margin")
gm["pt"] = wf(TF, "actual_total")
ev = gm[(gm.week <= 3) & gm.season.isin(EVAL) & gm.pm.notna()].copy()

P5 = {"SEC", "Big Ten", "Big 12", "ACC", "Pac-12"}
ev["g5g5"] = ~ev.homeConference.isin(P5) & ~ev.awayConference.isin(P5)
ev["tqb"] = (ev.h_qb1_transfer == 1) | (ev.a_qb1_transfer == 1)

BUCKETS = [(0, 3), (3, 6), (6, 9), (9, 99)]


def table(df, pred, mkt, actual, label):
    d = df[df[pred].notna() & df[mkt].notna() & (df[actual] != df[mkt])].copy()
    d["edge"] = d[pred] - d[mkt]
    win = np.where(d.edge > 0, d[actual] > d[mkt], d[actual] < d[mkt])
    # oracle: betting with the realized result must win 100%
    ora = np.where(d[actual] > d[mkt], d[actual] > d[mkt], d[actual] < d[mkt])
    assert ora.mean() > 0.999, "oracle failed"
    d["win"] = win
    print(f"\n=== {label} (n={len(d)}, graded at the close, -110) ===")
    print(f"{'edge':>6} {'n':>5} {'win%':>6} {'ROI':>7}  per-season(win%)         {'G5G5':>12} {'tQB':>12}")
    for lo, hi in BUCKETS:
        b = d[(d.edge.abs() >= lo) & (d.edge.abs() < hi)]
        if len(b) < 20:
            print(f"{lo}-{hi:>2}  {len(b):5d}  thin"); continue
        w = b.win.mean()
        by = b.groupby("season").win.mean()
        seas = " ".join(f"{s%100}:{v*100:.0f}" for s, v in by.items())
        def sub(mask):
            s = b[mask]
            return f"{s.win.mean()*100:4.0f}% n={len(s):3d}" if len(s) >= 15 else "   thin"
        print(f"{lo}-{hi:>2}  {len(b):5d} {w*100:5.1f}% {(w*DEC-1)*100:+6.1f}%  {seas:24s} {sub(b.g5g5):>12} {sub(b.tqb):>12}")


table(ev, "pm", "line_margin", "actual_margin", "SPREAD — BASE+ROSTER blend")
table(ev, "pt", "total_close", "actual_total", "TOTAL — BASE+ROSTER blend")
