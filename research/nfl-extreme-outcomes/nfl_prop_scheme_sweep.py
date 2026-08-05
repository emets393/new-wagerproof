"""Task #98 (RESEARCH ONLY): fold the SCHEME feature family into the 3 markets it helps
(pass_yds / receptions / reception_yds) and re-run BOTH bet frameworks vs matched no-scheme
baselines: (a) point-model edge sweep (NOLINE config — where the v3 edges live), (b) quantile
bands q35/q65 (the v4 framework that holds the receiving OVER cells). Guardrails: win% vs need
(price-implied), per-season, sigma, matched thresholds via quantiles on each config's own edges.
"""
import json
import numpy as np
import pandas as pd
from pathlib import Path
from sklearn.ensemble import HistGradientBoostingRegressor
from attempts_model import OFF, DEF, amer_profit

DATA = Path(__file__).resolve().parent / "data"
DECN = 1.909
p = pd.read_parquet(DATA / "nfl_prop_v3_panel.parquet")
pv = pd.read_parquet(DATA / "nfl_player_vs_scheme.parquet")
ds = pd.read_parquet(DATA / "nfl_def_scheme.parquet")
p = p.merge(pv, on=["season", "week", "player_id"], how="left")
p = p.merge(ds.rename(columns={"team": "opp"}), on=["season", "week", "opp"], how="left")
chosen = json.loads((DATA / "nfl_prop_chosen_v3.json").read_text())
G = {"OFF": OFF, "DEF": DEF, "POS": ["opp_pos_allow_s2d", "opp_pos_allow_l5", "opp_pos_allow_l3", "opp_pos_vol_s2d"],
     "TM": [c for c in p.columns if c.startswith("tm_")], "MAD": ["own_madden_ovr"],
     "USAGE": [f"{b}_{w}" for b in ("tgt_share", "carry_share", "att_share") for w in ("s2d", "l5", "l3")],
     "SNAP": ["snap_pct_s2d", "snap_pct_l5", "snap_pct_l3"]}
SCHEME = ["ypt_man", "ypt_zone", "ypt_onehigh", "ypt_twohigh", "epat_man", "epat_zone",
          "ypt_man_minus_zone", "ypt_one_minus_two",
          "man_rate_l8", "two_high_rate_l8", "pressure_rate_l8", "blitzers_l8",
          "heavy_box_rate_l8", "light_box_rate_l8"]
CORE = ["l3", "l5", "szn", "team_spread", "total", "is_home"]
HP = dict(max_depth=4, learning_rate=0.05, max_iter=400, min_samples_leaf=40, l2_regularization=1.0,
          random_state=0)
MKTS = ["player_pass_yds", "player_receptions", "player_reception_yds"]


def wf_point(m, feats):
    m = m.copy(); m["t"] = m.season * 100 + m.week
    pr = pd.Series(np.nan, index=m.index)
    for t in sorted(m[m.season.isin([2024, 2025])].t.unique()):
        tr, te = m[m.t < t], m[m.t == t]
        if len(tr) < 500 or len(te) == 0:
            continue
        pr.loc[te.index] = HistGradientBoostingRegressor(**HP).fit(tr[feats], tr.actual).predict(te[feats])
    m["pred"] = pr
    return m[m.pred.notna() & m.close_line.notna()]


def wf_quant(m, feats, q):
    m = m.copy(); m["t"] = m.season * 100 + m.week
    pr = pd.Series(np.nan, index=m.index)
    for t in sorted(m[m.season.isin([2024, 2025])].t.unique()):
        tr, te = m[m.t < t], m[m.t == t]
        if len(tr) < 500 or len(te) == 0:
            continue
        mdl = HistGradientBoostingRegressor(loss="quantile", quantile=q, **HP).fit(tr[feats], tr.actual)
        pr.loc[te.index] = mdl.predict(te[feats])
    return pr


def cell(d, is_over):
    d = d[d.actual != d.close_line]
    if len(d) < 30:
        return f"n={len(d)} thin"
    win = (d.actual > d.close_line).values if is_over else (d.actual < d.close_line).values
    px = (d.over_px if is_over else d.under_px).values
    n = len(d); wr = win.mean() * 100
    roi = np.nanmean(np.where(win, amer_profit(px), -1.0)) * 100
    need = np.nanmean(1 / (1 + amer_profit(px))) * 100
    sg = 100 * np.sqrt(win.mean() * (1 - win.mean())) * DECN / np.sqrt(n)
    by = "/".join(f"{(((d[d.season==y].actual>d[d.season==y].close_line) if is_over else (d[d.season==y].actual<d[d.season==y].close_line)).mean()*100):.0f}"
                  for y in (2024, 2025) if len(d[d.season == y]) >= 10)
    return f"n={n:4d} win={wr:5.1f} need={need:4.1f} ROI={roi:+6.1f} sig={sg:4.1f} yr[{by}]"


for mkt in MKTS:
    m0 = p[p.market == mkt].dropna(subset=["actual", "team_spread"])
    base = CORE + [c for g in chosen[mkt] for c in G[g]]
    with_s = base + SCHEME
    print("=" * 100)
    print(f"{mkt} — POINT edge sweep (NOLINE): baseline chosen-set vs +SCHEME")
    print("=" * 100)
    for name, feats in [("base", base), ("+SCHEME", with_s)]:
        e = wf_point(m0, feats).copy()
        e["edge"] = e.pred - e.close_line
        for qq in (0.65, 0.8):
            thr = e.edge.abs().quantile(qq)
            print(f"  {name:8} p{int(qq*100)} OVER : {cell(e[e.edge >= thr], True)}")
            print(f"  {name:8} p{int(qq*100)} UNDER: {cell(e[e.edge <= -thr], False)}")
    print(f"\n{mkt} — QUANTILE BANDS (q35/q65, +3% margin): baseline vs +SCHEME")
    for name, feats in [("base", base), ("+SCHEME", with_s)]:
        mq = m0.copy()
        mq["q35"] = wf_quant(m0, feats, 0.35)
        mq["q65"] = wf_quant(m0, feats, 0.65)
        e = mq[mq.q35.notna() & mq.close_line.notna()]
        print(f"  {name:8} OVER  (q35>line*1.03): {cell(e[e.q35 > e.close_line * 1.03], True)}")
        print(f"  {name:8} UNDER (q65<line*0.97): {cell(e[e.q65 < e.close_line * 0.97], False)}")
    print()
