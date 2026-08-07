"""Talent-anchor battery for the CFB early-week (wk1-3) DISPLAY blend.

Motivated by 2026 wk1: OSU@Tulsa pred -0.8 vs market OSU -12.5 — the priors rate OSU on
LAST year's team (prior_sp -15.1 < Tulsa -10.0) with returning production NaN and no
portal information; the blend cannot see a portal rebuild. Also ridge compression
(Indiana -22 vs market -40.5).

Battery (walk-forward, train seasons < S, eval wk1-3 of S in 2022-2025 so portal exists):
  BASE      sp_diff + fpi_diff + rec_diff + neutralSite   (current production blend)
  +PORTAL   portal net incoming-minus-outgoing rating sum, h-a diff
  +TALENT   CFBD talent composite (current-year, preseason roster) h-a diff
  +RET      returning-production percentPPA h-a diff (mean-imputed when missing)
  +COACH    new-HC-from-FBS carryover: blend team prior_sp w/ the coach's old team's
            prior_sp (scheme-transfer mechanism: teams play like the new coach's old team)
  ALL       everything
  ALL+CAL   + linear scale calibration (fix ridge compression: margin ~ a + b*pred on train)

Metrics: MAE vs actual margin | corr w/ the market line | pred std vs market std |
the DISAGREEMENT test — on the top-decile |pred - market| games, who is closer to the
actual result, us or the market? (If the market wins those, the display gap is our error.)
"""
import numpy as np
import pandas as pd
from pathlib import Path
from sklearn.linear_model import Ridge

DATA = Path(__file__).resolve().parent / "data"
L = print

gm = pd.read_parquet(DATA / "model_games.parquet")
gm = gm[gm.homePoints.notna() & gm.spread_close.notna()].copy()
gm["actual_margin"] = gm.homePoints - gm.awayPoints
gm["line_margin"] = -gm.spread_close                      # market-implied home margin
fav_cover = ((gm.actual_margin + gm.spread_close) > 0) & (gm.spread_close < 0)
base_rate = fav_cover[gm.spread_close < 0].mean()
assert 0.40 < base_rate < 0.60, f"sign check failed: home-fav cover {base_rate:.2f}"

pri = pd.read_parquet(DATA / "priors.parquet")

# ---- portal net rating per (season, team) ----
pt = pd.read_parquet(DATA / "cfbd" / "portal.parquet")
pt["val"] = pt.rating.fillna(pt.stars.map({1: .70, 2: .76, 3: .83, 4: .90, 5: .97}))
inc = pt.dropna(subset=["destination"]).groupby(["season", "destination"]).val.sum().rename("p_in")
out = pt.dropna(subset=["origin"]).groupby(["season", "origin"]).val.sum().rename("p_out")
portal = pd.concat([inc, out], axis=1).fillna(0).reset_index().rename(
    columns={"level_1": "team", "destination": "team"})
portal["portal_net"] = portal.p_in - portal.p_out

# ---- talent composite ----
tal = pd.read_parquet(DATA / "cfbd" / "talent.parquet").rename(columns={"year": "season"})

# ---- coach carryover: new HC's old team's prior_sp ----
cs = pd.read_parquet(DATA / "cfbd" / "coach_seasons.parquet")
sp_by = pri.set_index(["season", "team"]).prior_sp
carry = {}
for yr in sorted(cs.year.unique())[1:]:
    cur = cs[cs.year == yr].set_index("school").coach
    prv = cs[cs.year == yr - 1].set_index("school").coach
    prv_school_of = {c: s for s, c in prv.items()}
    for school, coach in cur.items():
        if prv.get(school) != coach and coach in prv_school_of.values():
            old = prv_school_of.get(coach)
            if old and old != school and (yr, old) in sp_by.index:
                carry[(yr, school)] = sp_by.loc[(yr, old)]

pri = pri.merge(portal[["season", "team", "portal_net"]], on=["season", "team"], how="left")
pri = pri.merge(tal, on=["season", "team"], how="left")
pri["coach_sp"] = [carry.get((s, t), np.nan) for s, t in zip(pri.season, pri.team)]
# effective sp: blend 60/40 toward the incoming coach's old team when a new FBS HC arrives
pri["eff_sp"] = np.where(pri.coach_sp.notna(), 0.6 * pri.prior_sp + 0.4 * pri.coach_sp, pri.prior_sp)

h = pri.add_prefix("h_").rename(columns={"h_season": "season", "h_team": "homeTeam"})
a = pri.add_prefix("a_").rename(columns={"a_season": "season", "a_team": "awayTeam"})
gm = gm.merge(h, on=["season", "homeTeam"], how="left").merge(a, on=["season", "awayTeam"], how="left")
gm["sp_diff"] = gm.h_prior_sp - gm.a_prior_sp
gm["fpi_diff"] = gm.h_prior_fpi - gm.a_prior_fpi
gm["rec_diff"] = gm.h_recruit_3yr - gm.a_recruit_3yr
gm["portal_diff"] = gm.h_portal_net.fillna(0) - gm.a_portal_net.fillna(0)
gm["talent_diff"] = gm.h_talent - gm.a_talent
gm["ret_diff"] = gm.h_ret_ppa - gm.a_ret_ppa
gm["eff_sp_diff"] = gm.h_eff_sp - gm.a_eff_sp
gm["neutralSite"] = gm.neutralSite.fillna(False).astype(int)

CFGS = {
    "BASE":    ["sp_diff", "fpi_diff", "rec_diff", "neutralSite"],
    "+PORTAL": ["sp_diff", "fpi_diff", "rec_diff", "neutralSite", "portal_diff"],
    "+TALENT": ["sp_diff", "fpi_diff", "rec_diff", "neutralSite", "talent_diff"],
    "+RET":    ["sp_diff", "fpi_diff", "rec_diff", "neutralSite", "ret_diff"],
    "+COACH":  ["eff_sp_diff", "fpi_diff", "rec_diff", "neutralSite"],
    "ALL":     ["eff_sp_diff", "fpi_diff", "rec_diff", "neutralSite", "portal_diff", "talent_diff", "ret_diff"],
}

EVAL = [2022, 2023, 2024, 2025]


def run(feats, calibrate=False):
    preds = pd.Series(np.nan, index=gm.index)
    for S in EVAL:
        tr = gm[(gm.week <= 3) & (gm.season < S) & gm.actual_margin.notna()].copy()
        te = gm[(gm.week <= 3) & (gm.season == S)].copy()
        for c in feats:
            mu = tr[c].mean()
            tr[c] = tr[c].fillna(mu); te[c] = te[c].fillna(mu)
        mdl = Ridge(alpha=10.0).fit(tr[feats], tr.actual_margin)
        p_tr = mdl.predict(tr[feats])
        p_te = mdl.predict(te[feats])
        if calibrate:
            b = np.polyfit(p_tr, tr.actual_margin, 1)
            p_te = b[0] * p_te + b[1]
        preds.loc[te.index] = p_te
    ev = gm[(gm.week <= 3) & gm.season.isin(EVAL) & preds.notna() & gm.line_margin.notna()].copy()
    ev["pred"] = preds.loc[ev.index]
    mae = (ev.pred - ev.actual_margin).abs().mean()
    corr = np.corrcoef(ev.pred, ev.line_margin)[0, 1]
    # disagreement decile: who wins the games where we differ most from the market?
    ev["gap"] = (ev.pred - ev.line_margin).abs()
    top = ev[ev.gap >= ev.gap.quantile(0.90)]
    us = (top.pred - top.actual_margin).abs().mean()
    mkt = (top.line_margin - top.actual_margin).abs().mean()
    return dict(n=len(ev), mae=mae, corr=corr, pstd=ev.pred.std(), mstd=ev.line_margin.std(),
                dis_n=len(top), dis_us=us, dis_mkt=mkt, mean_gap=ev.gap.mean())


L(f"[setup] eval wk1-3 {EVAL} | home-fav cover sanity {base_rate:.3f}")
L(f"{'config':9s} {'n':>5} {'MAE':>6} {'corr_mkt':>8} {'pred_sd':>8} {'mkt_sd':>7} {'avg|gap|':>8} "
  f"{'top10%gap: us':>13} {'mkt':>6}")
for name, feats in CFGS.items():
    r = run(feats)
    L(f"{name:9s} {r['n']:5d} {r['mae']:6.2f} {r['corr']:8.3f} {r['pstd']:8.2f} {r['mstd']:7.2f} "
      f"{r['mean_gap']:8.2f} {r['dis_us']:13.2f} {r['dis_mkt']:6.2f}")
r = run(CFGS["ALL"], calibrate=True)
L(f"{'ALL+CAL':9s} {r['n']:5d} {r['mae']:6.2f} {r['corr']:8.3f} {r['pstd']:8.2f} {r['mstd']:7.2f} "
  f"{r['mean_gap']:8.2f} {r['dis_us']:13.2f} {r['dis_mkt']:6.2f}")
