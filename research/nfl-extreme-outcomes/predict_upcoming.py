#!/usr/bin/env python3
"""Upcoming-week predictor — FP-only variant (no team_week EPA, which isn't
refreshed for 2026 yet). Builds composites+fits+situational+market, validates
its OWN backtest accuracy on 2023-25 (so quoted numbers are honest), then
predicts the target upcoming week. Usage: predict_upcoming.py SEASON WEEK
"""
import sys
import numpy as np
import pandas as pd

TARGET_SEASON = int(sys.argv[1]) if len(sys.argv) > 2 else 2026
TARGET_WEEK = int(sys.argv[2]) if len(sys.argv) > 2 else 2

# reuse v4 feature construction but extend game range to include target season,
# and DROP the team_week EPA family (unavailable for 2026).
src = open("exp_fp_v4_earlyseason.py").read().split('print(f"panel')[0]
src = src.replace("& (g.season >= 2021) & (g.season <= 2025)]",
                  f"& (g.season >= 2021) & (g.season <= {TARGET_SEASON})]")
# neutralize team_week merge/features: keep the merge but drop CORE from FEATS
src = src.replace(
    'FEATS = (["line", "total", "mkt_pts", "home", "week"] + CORE + ["T_" + c for c in CORE]',
    'FEATS = (["line", "total", "mkt_pts", "home", "week"]')
exec(src)

# situational block (referee + rest/primetime) from games_enriched
ge = pd.read_parquet("data/games_enriched.parquet")
res = pd.read_csv("https://github.com/nflverse/nflverse-data/releases/download/schedules/games.csv", low_memory=False)
res = res[(res.game_type == "REG") & res.result.notna()]; res["tot"] = res.home_score + res.away_score
rh = res[["season", "referee", "tot"]].dropna(subset=["referee"])
rrows = []
for ssn in range(2021, 2028):
    pri = rh[rh.season < ssn]; lg = pri.tot.mean()
    r = pri.groupby("referee").tot.agg(["mean", "count"])
    for ref, row in r.iterrows():
        rrows.append(dict(season=ssn, referee=ref, ref_pts_oe=(row["mean"] - lg) if row["count"] >= 20 else 0.0))
reftab = pd.DataFrame(rrows)
ge = ge.merge(reftab, on=["season", "referee"], how="left")
sit_rows = []
for _, r in ge.iterrows():
    for tm, rest, home in ((r.home_team, r.home_rest, 1), (r.away_team, r.away_rest, 0)):
        sit_rows.append(dict(game_id=r.game_id, team=tm,
                             ref_pts_oe=r.ref_pts_oe if pd.notna(r.ref_pts_oe) else 0.0,
                             s_rest=(r.home_rest - r.away_rest) if home else (r.away_rest - r.home_rest),
                             s_off_bye=int(rest >= 10), s_short_week=int(rest <= 4),
                             s_primetime=int(str(r.weekday) in ("Thursday", "Monday"))))
situ = pd.DataFrame(sit_rows)
p = p.merge(situ, on=["game_id", "team"], how="left")
SITU = ["ref_pts_oe", "s_rest", "s_off_bye", "s_short_week", "s_primetime"]
for c in SITU:
    p[c] = pd.to_numeric(p[c], errors="coerce").fillna(0)
FEATS = [c for c in FEATS if c in p.columns] + SITU
for c in FEATS:
    p[c] = pd.to_numeric(p[c], errors="coerce")
FEATS = [c for c in FEATS if not p[c].isna().all()]
p[FEATS] = p[FEATS].fillna(p[FEATS].mean())


def rf2(X, y, lam=50.0):
    Xb = np.hstack([X, np.ones((len(X), 1))]); A = Xb.T @ Xb + lam * np.eye(Xb.shape[1]); A[-1, -1] -= lam
    return np.linalg.solve(A, Xb.T @ y)


# validation backtest (2023-25) so quoted accuracy is this variant's own
val = p[(p.season >= 2021) & (p.season <= 2025)].dropna(subset=["pts", "line", "total"]).copy()
vp = []
for ssn in (2023, 2024, 2025):
    tr, te = val[val.season < ssn], val[val.season == ssn].copy()
    X = tr[FEATS].values.astype(float); m, s = X.mean(0), X.std(0); s[s == 0] = 1
    w = rf2((X - m) / s, tr.pts.values.astype(float))
    te["pred"] = np.hstack([(te[FEATS].values.astype(float) - m) / s, np.ones((len(te), 1))]) @ w
    vp.append(te)
vp = pd.concat(vp)
own = vp.set_index(["game_id", "team"]).pred
vp["pm"] = vp.pred - own.reindex(pd.MultiIndex.from_arrays([vp.game_id, vp.opp])).values
vp["pt"] = vp.pred + own.reindex(pd.MultiIndex.from_arrays([vp.game_id, vp.opp])).values
vg = vp.drop_duplicates("game_id"); vg = vg.assign(act_total=lambda d: d.pt * 0)
gmv = g.set_index("game_id")
vg["act_total"] = gmv.reindex(vg.game_id).home_score.values + gmv.reindex(vg.game_id).away_score.values
vg["e_sp"] = vg.pm - (-vg.line); vg["e_tot"] = vg.pt - vg.total
print(f"FP-ONLY VARIANT backtest (2023-25, {len(FEATS)} feats, no EPA core):")
for lab, ecol, gr in (("SP", "e_sp", lambda d, pk: np.where(pk, (d.margin + d.line) > 0, (d.margin + d.line) < 0)),
                      ("TOT", "e_tot", lambda d, pk: np.where(pk, d.act_total > d.total, d.act_total < d.total))):
    for thr in (2, 3):
        m2 = vg[ecol].abs() >= thr; pk = vg[ecol] >= thr
        ok = m2 & ((vg.margin + vg.line != 0) if lab == "SP" else (vg.act_total != vg.total))
        w2 = gr(vg, pk)
        print(f"  {lab}{thr}: {100*w2[ok].mean():.1f}% (n={ok.sum()})", end="  ")
    print()

# TRAIN on 2021-2025, PREDICT target week
tr = p[(p.season <= 2025)].dropna(subset=["pts", "line", "total"])
te = p[(p.season == TARGET_SEASON) & (p.week == TARGET_WEEK)].copy()
X = tr[FEATS].values.astype(float); m, s = X.mean(0), X.std(0); s[s == 0] = 1
w = rf2((X - m) / s, tr.pts.values.astype(float))
te["pred"] = np.hstack([(te[FEATS].values.astype(float) - m) / s, np.ones((len(te), 1))]) @ w
te.to_parquet("data/fpdata/_upcoming_pred.parquet")
own = te.set_index(["game_id", "team"]).pred
te["pm"] = te.pred - own.reindex(pd.MultiIndex.from_arrays([te.game_id, te.opp])).values
te["pt"] = te.pred + own.reindex(pd.MultiIndex.from_arrays([te.game_id, te.opp])).values
gg = te.drop_duplicates("game_id").copy()
gm = g.set_index("game_id")
gg["home_ab"] = gm.reindex(gg.game_id).home_team.values; gg["away_ab"] = gm.reindex(gg.game_id).away_team.values
gg["hl"] = np.where(gg.team == gg.home_ab, gg.line, -gg.line)
gg["hpm"] = np.where(gg.team == gg.home_ab, gg.pm, -gg.pm)
gg["sp_edge_home"] = gg.hpm - (-gg.hl); gg["tot_edge"] = gg.pt - gg.total
gg[["game_id", "home_ab", "away_ab", "hl", "total", "hpm", "pt", "sp_edge_home", "tot_edge"]] \
    .to_parquet("data/fpdata/_upcoming_games.parquet")
print(f"\npredicted {len(gg)} games for {TARGET_SEASON} wk{TARGET_WEEK} -> data/fpdata/_upcoming_games.parquet")
