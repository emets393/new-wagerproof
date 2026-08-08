"""CORE O/D as early-week blend priors (test 2). Same walk-forward harness as
cfb_roster_early_test: train wk1-3 seasons < S, eval wk1-3 of S in 2022-2025.
MARGIN: does S-1 CORE (overall + off/def split) add to BASE+ROSTER?
TOTAL:  does the O/D split beat overall-strength priors at predicting totals?"""
import numpy as np
import pandas as pd
from pathlib import Path
from sklearn.linear_model import Ridge

HERE = Path(__file__).resolve().parent
DATA = HERE / "data"

gm = pd.read_parquet(DATA / "model_games.parquet")
gm = gm[gm.homePoints.notna()].copy()
gm["actual_margin"] = gm.homePoints - gm.awayPoints
gm["actual_total"] = gm.homePoints + gm.awayPoints
gm["line_margin"] = -gm.spread_close
fav = gm.spread_close < 0
assert 0.40 < ((gm.actual_margin + gm.spread_close) > 0)[fav].mean() < 0.60

pri = pd.read_parquet(DATA / "priors.parquet")
rs = pd.read_parquet(DATA / "roster_scores.parquet")
rs = rs.merge(pri[["season", "team", "prior_sp", "prior_fpi", "recruit_3yr"]],
              on=["season", "team"], how="left")
core = pd.read_parquet(DATA / "cfbd" / "core_ratings.parquet")[
    ["year", "team", "overall", "offense", "defense"]]
core["season"] = core.year + 1          # S-1 final -> season-S prior
rs = rs.merge(core.rename(columns={"overall": "core_ovr", "offense": "core_off",
                                   "defense": "core_def"})[
    ["season", "team", "core_ovr", "core_off", "core_def"]],
    on=["season", "team"], how="left")

h = rs.add_prefix("h_").rename(columns={"h_season": "season", "h_team": "homeTeam"})
a = rs.add_prefix("a_").rename(columns={"a_season": "season", "a_team": "awayTeam"})
gm = gm.merge(h, on=["season", "homeTeam"], how="left").merge(a, on=["season", "awayTeam"], how="left")
FEATS = ["ret_prod", "in_prod", "net_prod", "ret_share", "talent_stock", "qb1_prior",
         "qb1_rating", "qb1_transfer", "prior_sp", "prior_fpi", "recruit_3yr",
         "core_ovr", "core_off", "core_def"]
for c in FEATS:
    gm[f"d_{c}"] = gm[f"h_{c}"] - gm[f"a_{c}"]
    gm[f"s_{c}"] = gm[f"h_{c}"] + gm[f"a_{c}"]
gm["neutralSite"] = gm.neutralSite.fillna(False).astype(int)

BASE = ["d_prior_sp", "d_prior_fpi", "d_recruit_3yr", "neutralSite"]
ROSTER = ["d_ret_prod", "d_in_prod", "d_net_prod", "d_ret_share", "d_talent_stock",
          "d_qb1_prior", "d_qb1_rating", "d_qb1_transfer", "neutralSite"]
CORE_M = ["d_core_ovr", "d_core_off", "d_core_def"]
CFGS = {"BASE": BASE, "BASE+ROSTER": sorted(set(BASE + ROSTER)),
        "BASE+CORE": sorted(set(BASE + CORE_M)),
        "BASE+ROSTER+CORE": sorted(set(BASE + ROSTER + CORE_M)),
        "CORE-ONLY": CORE_M + ["neutralSite"]}
EVAL = [2022, 2023, 2024, 2025]

def run(target, line_col, cfgs):
    print(f"\n--- target: {target} (vs market {line_col}) ---")
    print(f"{'config':18s} {'n':>5} {'MAE':>7} {'mktMAE':>7} {'λ':>7}")
    for name, feats in cfgs.items():
        preds = pd.Series(np.nan, index=gm.index)
        for S in EVAL:
            tr = gm[(gm.week <= 3) & (gm.season < S) & gm[target].notna()].copy()
            te = gm[(gm.week <= 3) & (gm.season == S)].copy()
            mu = tr[feats].mean()
            mdl = Ridge(alpha=10.0).fit(tr[feats].fillna(mu), tr[target])
            preds.loc[te.index] = mdl.predict(te[feats].fillna(mu))
        ev = gm[(gm.week <= 3) & gm.season.isin(EVAL) & preds.notna() & gm[line_col].notna()].copy()
        ev["pred"] = preds.loc[ev.index]
        mae = (ev.pred - ev[target]).abs().mean()
        mkt = (ev[line_col] - ev[target]).abs().mean()
        # λ: does our residual off the market carry info about the actual residual?
        x = ev.pred - ev[line_col]; y = ev[target] - ev[line_col]
        lam = np.polyfit(x, y, 1)[0] if x.std() > 0 else np.nan
        print(f"{name:18s} {len(ev):5d} {mae:7.2f} {mkt:7.2f} {lam:+7.2f}")

run("actual_margin", "line_margin", CFGS)
T_BASE = ["s_prior_sp", "s_prior_fpi", "s_recruit_3yr", "d_prior_sp"]
T_CORE = ["s_core_off", "s_core_def", "d_core_ovr"]
run("actual_total", "total_close",
    {"T-BASE (overall)": T_BASE, "T-BASE+CORE O/D": sorted(set(T_BASE + T_CORE)),
     "T-CORE-ONLY O/D": T_CORE})
