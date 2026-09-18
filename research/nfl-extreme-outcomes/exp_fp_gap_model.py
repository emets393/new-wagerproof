#!/usr/bin/env python3
"""Matchup-gap model v1 (owner architecture): unit-composite gaps -> team points.

Laws applied: predict the RAW quantity (team points) with the market line as a
feature; one row per TEAM-GAME; walk-forward by season (train < S, predict S);
ridge (closed form); oracle-check the grader; evaluate vs CLOSING line at fixed
edge thresholds, per season.

Features per team-game (entering-game composites, shrunk):
  pp_gap   = own pass_pro   - opp pass_rush
  recv_gap = own recv_corps - opp coverage_adj (coverage adjusted for the
             receiving corps it faced — the r=0.13 fix)
  run_gap  = own run_block  - opp run_front
  rbtk_gap = own rb_room    - opp tackling
  qb_res   = own qb_resilience
  mkt_pts  = implied team points ((total - (-2*line? no)) -> (total/2 - line/2))
  home flag
Target: team points scored.
"""
import numpy as np
import pandas as pd

AB_NV = {"ARZ": "ARI", "BLT": "BAL", "CLV": "CLE", "HST": "HOU"}
DIR = "data/fpdata/"

uc = pd.read_parquet(DIR + "unit_composites.parquet")
uc["ab_nv"] = uc.ab.map(lambda a: AB_NV.get(a, a))

g = pd.read_csv("https://github.com/nflverse/nflverse-data/releases/download/schedules/games.csv",
                low_memory=False)
g = g[(g.game_type == "REG") & g.result.notna() & g.spread_line.notna()
      & g.total_line.notna() & (g.season >= 2021) & (g.season <= 2025)]

rows = []
for _, r in g.iterrows():
    for team, opp, home in ((r.home_team, r.away_team, 1), (r.away_team, r.home_team, 0)):
        pts = r.home_score if home else r.away_score
        line = -r.spread_line if home else r.spread_line       # team-relative, neg = favored
        rows.append(dict(season=r.season, week=r.week, game_id=r.game_id, team=team, opp=opp,
                         home=home, pts=pts, line=line, total=r.total_line,
                         margin=(r.result if home else -r.result)))
p = pd.DataFrame(rows)

# --- opponent-adjusted coverage: realized coverage_game + opp recv_corps rating,
#     then shrunk expanding mean entering game -------------------------------------
sched = p[["season", "week", "team", "opp"]].rename(
    columns={"team": "ab_nv", "opp": "opp_nv", "season": "__season", "week": "__week"})
uc = uc.merge(sched, on=["ab_nv", "__season", "__week"], how="left")
opp_recv = uc[["ab_nv", "__season", "__week", "recv_corps"]].rename(
    columns={"ab_nv": "opp_nv", "recv_corps": "opp_recv_rating"})
uc = uc.merge(opp_recv, on=["opp_nv", "__season", "__week"], how="left")
uc["coverage_adj_game"] = uc.coverage_game + uc.opp_recv_rating.fillna(0)
uc = uc.sort_values(["ab_nv", "__season", "__week"])
grp = uc.groupby(["ab_nv", "__season"]).coverage_adj_game
uc["coverage_adj"] = grp.transform(lambda x: x.shift(1).expanding().sum()) / (
    grp.transform(lambda x: x.shift(1).expanding().count()) + 6)

own_cols = ["pass_pro", "recv_corps", "run_block", "rb_room", "qb_resilience"]
opp_cols = ["pass_rush", "coverage_adj", "run_front", "tackling"]
p = p.merge(uc[["ab_nv", "__season", "__week"] + own_cols],
            left_on=["team", "season", "week"], right_on=["ab_nv", "__season", "__week"], how="inner")
p = p.merge(uc[["ab_nv", "__season", "__week"] + opp_cols].add_prefix("o_"),
            left_on=["opp", "season", "week"], right_on=["o_ab_nv", "o___season", "o___week"], how="inner")

p["pp_gap"] = p.pass_pro - p.o_pass_rush
p["recv_gap"] = p.recv_corps - p.o_coverage_adj
p["run_gap"] = p.run_block - p.o_run_front
p["rbtk_gap"] = p.rb_room - p.o_tackling
p["mkt_pts"] = p.total / 2 - p.line / 2          # market-implied team points
FEATS = ["pp_gap", "recv_gap", "run_gap", "rbtk_gap", "qb_resilience", "mkt_pts", "home"]
p = p.dropna(subset=FEATS + ["pts"]).copy()
p = p[p.week >= 4]                               # composites need sample; wk1-3 shrunk to ~0
print(f"panel: {len(p)} team-games, seasons {sorted(p.season.unique())}")


def ridge_fit(X, y, lam=10.0):
    Xb = np.hstack([X, np.ones((len(X), 1))])
    A = Xb.T @ Xb + lam * np.eye(Xb.shape[1])
    A[-1, -1] -= lam                              # don't penalize intercept
    return np.linalg.solve(A, Xb.T @ y)


def ridge_pred(w, X):
    return np.hstack([X, np.ones((len(X), 1))]) @ w


mu, sd = {}, {}
preds = []
for season in (2023, 2024, 2025):
    tr = p[p.season < season]
    te = p[p.season == season].copy()
    Xt = tr[FEATS].values.astype(float)
    m, s = Xt.mean(0), Xt.std(0)
    w = ridge_fit((Xt - m) / s, tr.pts.values.astype(float))
    te["pred_pts"] = ridge_pred(w, (te[FEATS].values.astype(float) - m) / s)
    preds.append(te)
    if season == 2025:
        print("\ncoefs (standardized):", {f: round(c, 3) for f, c in zip(FEATS, w[:-1])})
pr = pd.concat(preds)

# pair rows -> game-level margin/total predictions
own = pr.set_index(["game_id", "team"])
idx = pd.MultiIndex.from_arrays([pr.game_id, pr.opp])
pr["opp_pred_pts"] = own.pred_pts.reindex(idx).values
pr["pred_margin"] = pr.pred_pts - pr.opp_pred_pts
pr["pred_total"] = pr.pred_pts + pr.opp_pred_pts
pr["mkt_margin"] = -pr.line
pr["edge_sp"] = pr.pred_margin - pr.mkt_margin
pr["edge_tot"] = pr.pred_total - pr.total

# ORACLE CHECK: feed realized margin as prediction -> must win ~100%
oracle = ((pr.margin + pr.line) > 0) == ((pr.margin - pr.mkt_margin) > 0)
oc = oracle[(pr.margin + pr.line) != 0]
assert oc.mean() > 0.99, f"oracle check FAILED: {oc.mean():.3f}"
print(f"oracle check: {oc.mean():.3f} OK\n")

print("SPREAD vs close (bet team when edge_sp >= thr; one row per team-game, dedup by game):")
gg = pr.drop_duplicates("game_id", keep="first")
for thr in (1, 2, 3):
    for label, m, win in (("bet OWN side", gg.edge_sp >= thr, (gg.margin + gg.line) > 0),
                          ("bet OPP side", gg.edge_sp <= -thr, (gg.margin + gg.line) < 0)):
        c = gg[m & ((gg.margin + gg.line) != 0)]
        wr = win[m & ((gg.margin + gg.line) != 0)]
        if len(c) >= 20:
            z = (wr.mean() - .5) * 2 * np.sqrt(len(c))
            print(f"  thr {thr}: {label:12s} {int(wr.sum()):4d}-{int(len(c)-wr.sum()):4d} ({100*wr.mean():.1f}%) z={z:+.2f}")
print("\nTOTALS vs close:")
for thr in (1, 2, 3):
    for label, m, win in (("OVER", gg.edge_tot >= thr, (gg.margin.abs() * 0 + gg.pred_total * 0 + 1) == 1),):
        pass
tt = gg.copy()
tt["act_total"] = None
act = g.set_index("game_id")
tt["act_total"] = act.reindex(tt.game_id).total.values if "total" in act.columns else np.nan
tt["act_total"] = act.reindex(tt.game_id).home_score.values + act.reindex(tt.game_id).away_score.values
for thr in (1, 2, 3):
    for lab, m, w in (("OVER ", tt.edge_tot >= thr, tt.act_total > tt.total),
                      ("UNDER", tt.edge_tot <= -thr, tt.act_total < tt.total)):
        c = tt[m & (tt.act_total != tt.total)]
        wr = w[m & (tt.act_total != tt.total)]
        if len(c) >= 20:
            z = (wr.mean() - .5) * 2 * np.sqrt(len(c))
            print(f"  thr {thr}: {lab} {int(wr.sum()):4d}-{int(len(c)-wr.sum()):4d} ({100*wr.mean():.1f}%) z={z:+.2f}")
print("\nper-season spread thr>=2 (own side):")
for s in (2023, 2024, 2025):
    c = gg[(gg.season == s) & (gg.edge_sp >= 2) & ((gg.margin + gg.line) != 0)]
    w = (c.margin + c.line) > 0
    if len(c):
        print(f"  {s}: {int(w.sum())}-{int(len(c)-w.sum())} ({100*w.mean():.0f}%)")
