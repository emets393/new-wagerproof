"""Would starter-out features improve the CFB model? (owner-directed 2026-08-28)

LABELS (leak-safe, from box data — the play-by-play ground truth of who actually
didn't play):
  qb_backup_start : week-W top passer != established starter (cumulative-attempts
                    leader thru W-1, min 60 att) — qb_analysis's validated definition
  star_rb_out     : workhorse RB (avg car >= 12 thru W-1, >= 3 games) absent in W
  star_wr_out     : target hog (avg tar >= 7 thru W-1, >= 3 games) absent in W

TESTS (weeks 5-15, 2021-2025, per-season shown per the grading framework):
  1. MODEL RESIDUAL (the decisive one): walk-forward margin + total predictions
     from team_ratings_asof (same info set as the production model, calibration fit
     on seasons < S only). If the model systematically OVERRATES teams missing a
     starter (mean residual < 0), the feature carries signal the model lacks.
  2. MARKET CHECK: the affected team ATS vs the close — is the market pricing it?

Residual sign conventions: margin residual = actual team margin - predicted
(negative = team did WORSE than the model thought). Total residual = actual game
total - predicted (negative = game went under the model's number).
"""
import numpy as np
import pandas as pd
from pathlib import Path
from scipy import stats

DATA = Path(__file__).resolve().parent / "data"
SEASONS = [2021, 2022, 2023, 2024, 2025]
MIN_EST_ATT = 60

# ---------------- labels ----------------
qs = pd.read_parquet(DATA / "cfbd" / "qb_starts.parquet")
pu = pd.read_parquet(DATA / "cfbd" / "player_usage.parquet")
pu = pu[pu.season_type == "regular"]

lab_rows = []
for season in SEASONS:
    q = qs[qs.season == season]
    u = pu[pu.season == season]
    weeks = sorted(q.week.unique())
    for w in [wk for wk in weeks if wk >= 4]:
        prior_q = q[q.week < w]
        cum = prior_q.groupby(["team", "qb"], as_index=False).att.sum()
        est = cum[cum.att >= MIN_EST_ATT].sort_values("att", ascending=False).drop_duplicates("team")
        est_map = dict(zip(est.team, est.qb))

        wk_q = q[q.week == w]
        started = dict(zip(wk_q.team, wk_q.qb))

        prior_u = u[u.week < w].groupby(["team", "player"], as_index=False).agg(
            g=("week", "nunique"), car=("car", "mean"), rec=("rec", "mean"))
        rbs = prior_u[(prior_u.g >= 3) & (prior_u.car >= 12)].sort_values("car", ascending=False).drop_duplicates("team")
        wrs = prior_u[(prior_u.g >= 3) & (prior_u.rec >= 4.5)].sort_values("rec", ascending=False).drop_duplicates("team")
        wk_u = u[u.week == w].groupby(["team", "player"]).size()

        for team in wk_q.team.unique():   # team played this week
            row = dict(season=season, week=w, team=team,
                       qb_backup_start=False, star_rb_out=False, star_wr_out=False)
            if team in est_map and started.get(team) is not None:
                row["qb_backup_start"] = started[team] != est_map[team]
            rb = rbs[rbs.team == team]
            if len(rb):
                row["star_rb_out"] = (team, rb.iloc[0].player) not in wk_u.index
            wr = wrs[wrs.team == team]
            if len(wr):
                row["star_wr_out"] = (team, wr.iloc[0].player) not in wk_u.index
            lab_rows.append(row)

labels = pd.DataFrame(lab_rows)
labels.to_parquet(DATA / "starter_out_labels.parquet")
print(f"labels: {len(labels)} team-weeks | qb_backup_start {int(labels.qb_backup_start.sum())} "
      f"| star_rb_out {int(labels.star_rb_out.sum())} | star_wr_out {int(labels.star_wr_out.sum())}")

# ---------------- walk-forward model predictions ----------------
rat = pd.read_parquet(DATA / "team_ratings_asof.parquet").set_index(["season", "asof_week", "team"])
mg = pd.read_parquet(DATA / "model_games.parquet")
g = mg[(mg.week >= 5) & (mg.week <= 15) & mg.homePoints.notna() & mg.season.isin(SEASONS)][
    ["season", "week", "homeTeam", "awayTeam", "homePoints", "awayPoints", "spread_close"]].copy()

def rv(s, w, t, col):
    try:
        return rat.loc[(s, w - 1, t), col]
    except KeyError:
        return np.nan

for side, tcol in [("h", "homeTeam"), ("a", "awayTeam")]:
    for col in ["adj_epa", "adj_epa_allowed"]:
        g[f"{side}_{col}"] = [rv(s, w, t, col) for s, w, t in zip(g.season, g.week, g[tcol])]
g = g.dropna(subset=["h_adj_epa", "a_adj_epa", "h_adj_epa_allowed", "a_adj_epa_allowed"])
g["amargin"] = g.homePoints - g.awayPoints
g["atotal"] = g.homePoints + g.awayPoints
g["net"] = (g.h_adj_epa - g.a_adj_epa_allowed) - (g.a_adj_epa - g.h_adj_epa_allowed)
g["off_sum"] = g.h_adj_epa + g.a_adj_epa - g.h_adj_epa_allowed - g.a_adj_epa_allowed

g["pred_margin"], g["pred_total"] = np.nan, np.nan
for s in SEASONS:
    tr = g[g.season < s]
    if len(tr) < 300:
        tr = g[g.season != s]      # 2021 gets leave-one-out (no prior seasons in frame)
    te_m = g.season == s
    bm = np.polyfit(tr.net, tr.amargin, 1)
    bt = np.polyfit(tr.off_sum, tr.atotal, 1)
    g.loc[te_m, "pred_margin"] = bm[0] * g.loc[te_m, "net"] + bm[1]
    g.loc[te_m, "pred_total"] = bt[0] * g.loc[te_m, "off_sum"] + bt[1]
print(f"walk-forward preds: {len(g)} games | margin MAE {np.abs(g.pred_margin-g.amargin).mean():.2f} "
      f"| total MAE {np.abs(g.pred_total-g.atotal).mean():.2f}")

# ---------------- team-perspective panel + tests ----------------
rows = []
for r in g.itertuples():
    for team, opp, home in [(r.homeTeam, r.awayTeam, True), (r.awayTeam, r.homeTeam, False)]:
        rows.append(dict(season=r.season, week=r.week, team=team, home=home,
                         resid_margin=(r.amargin - r.pred_margin) * (1 if home else -1),
                         resid_total=r.atotal - r.pred_total,
                         team_margin=(r.amargin if home else -r.amargin),
                         team_spread=(r.spread_close if home else -r.spread_close)))
panel = pd.DataFrame(rows).merge(labels, on=["season", "week", "team"], how="left")
for c in ["qb_backup_start", "star_rb_out", "star_wr_out"]:
    panel[c] = panel[c].fillna(False)

def report(flag):
    on = panel[panel[flag]]
    off = panel[~panel[flag]]
    t_m, p_m = stats.ttest_ind(on.resid_margin, off.resid_margin, equal_var=False)
    print(f"\n=== {flag} (n={len(on)} team-games) ===")
    print(f"  margin residual: flagged {on.resid_margin.mean():+.2f} vs base {off.resid_margin.mean():+.2f}"
          f"  (t={t_m:+.2f}, p={p_m:.4f})")
    tot_on = on.drop_duplicates(subset=['season','week','team'])
    t_t, p_t = stats.ttest_ind(on.resid_total, off.resid_total, equal_var=False)
    print(f"  total  residual: flagged {on.resid_total.mean():+.2f} vs base {off.resid_total.mean():+.2f}"
          f"  (t={t_t:+.2f}, p={p_t:.4f})")
    ats = on.dropna(subset=["team_spread"])
    cov = (ats.team_margin + ats.team_spread > 0)
    push = (ats.team_margin + ats.team_spread == 0)
    n = int((~push).sum())
    print(f"  market: flagged team covers close {int(cov[~push].sum())}/{n} = {cov[~push].mean()*100:.1f}%")
    per = on.groupby("season").resid_margin.agg(["mean", "count"])
    print("  per-season margin residual: " +
          " | ".join(f"{s}: {m:+.1f} (n={int(c)})" for s, (m, c) in per.iterrows()))

for flag in ["qb_backup_start", "star_rb_out", "star_wr_out"]:
    report(flag)

both = panel[panel.qb_backup_start & (panel.star_rb_out | panel.star_wr_out)]
print(f"\nqb + skill-star both out: n={len(both)}, margin residual {both.resid_margin.mean():+.2f}")

# Injury-vs-benching discriminator: an INJURED starter stays out (backup starts
# next week too); a benched/rotated starter often returns. The live covers
# trigger fires on injuries, so the persistent subset is the deployable analog.
lab2 = labels.sort_values(["season", "team", "week"])
lab2["next_bs"] = lab2.groupby(["season", "team"]).qb_backup_start.shift(-1)
persist = lab2[lab2.qb_backup_start & (lab2.next_bs == True)][["season", "week", "team"]].assign(qb_persist=True)
oneweek = lab2[lab2.qb_backup_start & (lab2.next_bs == False)][["season", "week", "team"]].assign(qb_oneweek=True)
p2 = panel.merge(persist, on=["season", "week", "team"], how="left").merge(oneweek, on=["season", "week", "team"], how="left")
for c, name in [("qb_persist", "PERSISTENT backup (out next week too — injury-like)"),
                ("qb_oneweek", "ONE-WEEK backup (starter returns — benching/rest-like)")]:
    on = p2[p2[c] == True]
    ats = on.dropna(subset=["team_spread"])
    cov = (ats.team_margin + ats.team_spread > 0); push = (ats.team_margin + ats.team_spread == 0)
    per = on.groupby("season").resid_margin.mean()
    print(f"\n{name}: n={len(on)} | margin residual {on.resid_margin.mean():+.2f} | "
          f"covers close {cov[~push].mean()*100:.1f}% (n={int((~push).sum())})")
    print("  per-season: " + " | ".join(f"{s}: {m:+.1f}" for s, m in per.items()))
