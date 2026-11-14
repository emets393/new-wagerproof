#!/usr/bin/env python3
"""Prior-season BLEND test (owner hypothesis 2026-09-17): seed each team's
entering-game composite with LAST season's final value (coaches/rosters persist),
shrinking the prior out as current-season games accumulate. Does it (a) enable
weeks 1-3, (b) rescue the weak early-season spread performance?

Compares STANDALONE (current: expanding-within-season) vs BLEND (prior-season
seed + current update) on the v2 composite-differential spread model, evaluated
across ALL weeks including 1-3.
"""
import numpy as np
import pandas as pd

AB_NV = {"ARZ": "ARI", "BLT": "BAL", "CLV": "CLE", "HST": "HOU"}
comp = pd.read_parquet("data/fpdata/composites_v2.parquet")   # has per-team-week _game realized values
comp["ab_nv"] = comp.ab.map(lambda a: AB_NV.get(a, a))
CN = [c for c in comp.columns if c.startswith("c_") and not c.endswith("_game")]
comp = comp.sort_values(["ab_nv", "__season", "__week"])

# prior-season full mean per composite
prior = comp.groupby(["ab_nv", "__season"])[[c + "_game" for c in CN]].mean().reset_index()
prior["nxt"] = prior.__season + 1
prior = prior.rename(columns={c + "_game": c + "_prior" for c in CN})

PRIOR_K = 5   # pseudo-games of prior-season weight (decays as real games accrue)
for mode in ("standalone", "blend"):
    c = comp.copy().merge(prior[["ab_nv", "nxt"] + [x + "_prior" for x in CN]],
                          left_on=["ab_nv", "__season"], right_on=["ab_nv", "nxt"], how="left")
    for name in CN:
        grp = c.groupby(["ab_nv", "__season"])[name + "_game"]
        csum = grp.transform(lambda x: x.shift(1).expanding().sum())
        cnt = grp.transform(lambda x: x.shift(1).expanding().count()).fillna(0)
        if mode == "standalone":
            c[name] = (csum.fillna(0)) / (cnt + 6)
        else:  # blend: prior-season mean seeds it, washes out as games accrue
            pr = c[name + "_prior"]
            c[name] = (pr.fillna(0) * PRIOR_K + csum.fillna(0)) / (PRIOR_K + cnt)
            c.loc[pr.isna(), name] = csum.fillna(0)[pr.isna()] / (cnt[pr.isna()] + 6)
    globals()[f"comp_{mode}"] = c[["ab_nv", "__season", "__week"] + CN]

g = pd.read_csv("https://github.com/nflverse/nflverse-data/releases/download/schedules/games.csv",
                low_memory=False)
g = g[(g.game_type == "REG") & g.result.notna() & g.spread_line.notna() & g.total_line.notna()
      & (g.season >= 2021) & (g.season <= 2025)]
rows = []
for _, r in g.iterrows():
    for team, opp, home in ((r.home_team, r.away_team, 1), (r.away_team, r.home_team, 0)):
        rows.append(dict(season=r.season, week=r.week, game_id=r.game_id, team=team, opp=opp,
                         home=home, pts=r.home_score if home else r.away_score,
                         margin=r.result if home else -r.result,
                         line=-r.spread_line if home else r.spread_line, total=r.total_line,
                         act_total=r.home_score + r.away_score))
base = pd.DataFrame(rows)
base["mkt_pts"] = base.total / 2 - base.line / 2
DIFFS = {"d_trench_pass": ("c_passpro", "O_c_passrush"), "d_trench_run": ("c_runblock", "O_c_runfront"),
         "d_playmaking": ("c_recv_playmaking", "O_c_tackling"), "d_power": ("c_rb_power", "O_c_tackling"),
         "d_precision_cov": ("c_qb_precision", "O_c_cov_disruption"),
         "d_deep_fit": ("c_qb_aggression", "O_c_deep_denial"), "d_rz": ("c_rz_usage", "O_c_rz_defense")}


def ridge_fit(X, y, lam=50.0):
    Xb = np.hstack([X, np.ones((len(X), 1))]); A = Xb.T @ Xb + lam * np.eye(Xb.shape[1]); A[-1, -1] -= lam
    return np.linalg.solve(A, Xb.T @ y)


def run(compdf, min_week):
    p = base.merge(compdf, left_on=["team", "season", "week"],
                   right_on=["ab_nv", "__season", "__week"], how="left")
    p = p.merge(compdf.add_prefix("O_"), left_on=["opp", "season", "week"],
                right_on=["O_ab_nv", "O___season", "O___week"], how="left")
    for d, (a, b) in DIFFS.items():
        p[d] = p[a] - p[b]
    F = ["line", "total", "mkt_pts", "home", "week"] + list(DIFFS) + ["c_qb_hold", "c_qb_aggression"]
    p = p[p.week >= min_week].dropna(subset=["pts", "line"]).copy()
    for cc in F:
        p[cc] = pd.to_numeric(p[cc], errors="coerce")
    F = [cc for cc in F if not p[cc].isna().all()]
    p[F] = p[F].fillna(p[F].mean())
    preds = []
    for season in (2023, 2024, 2025):
        tr, te = p[p.season < season], p[p.season == season].copy()
        X = tr[F].values.astype(float); m, s = X.mean(0), X.std(0); s[s == 0] = 1
        w = ridge_fit((X - m) / s, tr.pts.values.astype(float))
        te["pred"] = np.hstack([(te[F].values.astype(float) - m) / s, np.ones((len(te), 1))]) @ w
        preds.append(te)
    pr = pd.concat(preds)
    own = pr.set_index(["game_id", "team"]).pred
    pr["opp_pred"] = own.reindex(pd.MultiIndex.from_arrays([pr.game_id, pr.opp])).values
    pr["pm"] = pr.pred - pr.opp_pred
    gg = pr.drop_duplicates("game_id").copy()
    gg["sp_edge"] = gg.pm - (-gg.line)
    return gg


def report(gg, tag):
    print(f"\n{tag}:")
    for lo, hi, lab in ((1, 3, "wk1-3 (NEW)"), (4, 6, "wk4-6"), (7, 18, "wk7-18"), (1, 18, "ALL")):
        d = gg[(gg.week >= lo) & (gg.week <= hi) & (gg.sp_edge.abs() >= 2) & ((gg.margin + gg.line) != 0)]
        pick = d.sp_edge >= 2
        w = np.where(pick, (d.margin + d.line) > 0, (d.margin + d.line) < 0)
        print(f"  {lab:14s}: {w.sum()}-{len(d)-w.sum()} ({100*w.mean():.0f}%)  n={len(d)}" if len(d) else f"  {lab}: n=0")


report(run(comp_standalone, 4), "STANDALONE (current model, wk4+)")
report(run(comp_blend, 1), "BLEND prior-season seed (wk1+)")
