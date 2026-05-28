"""
OL continuity (leak-safe, from snap counts 2013-2025) -> betting test.
Starting OL = top-5 offensive-snap O-linemen per team-game. ENTERING each game we use only PRIOR
weeks to characterize chronic instability: consecutive-same-5 streak, # distinct starters used,
# distinct combos. Then test whether a churned/unstable OL team covers less / goes under, etc.
Per-season + permutation null. (Caveat: this is chronic instability through prior weeks, not a
this-week new-starter flag, which would need the pregame inactive report.)
"""
import os, sys
import numpy as np, pandas as pd
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from stats_helpers import wilson_ci, bet_summary, fmt
rng = np.random.default_rng(0)
DATA = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
L = print
sc = pd.read_parquet(os.path.join(DATA, "snap_counts.parquet"))
g = pd.read_parquet(os.path.join(DATA, "games_enriched.parquet"))

OL = {"T", "G", "C", "OL", "OT", "OG", "LT", "RT", "LG", "RG"}
ol = sc[(sc.game_type == "REG") & (sc.position.isin(OL)) & sc.offense_snaps.notna()].copy()
# starting OL set per (season, week, team) = top-5 by offense_snaps
ol = ol.sort_values(["season", "week", "team", "offense_snaps"], ascending=[True, True, True, False])
start5 = ol.groupby(["season", "week", "team"]).head(5).groupby(["season", "week", "team"])["pfr_player_id"].apply(frozenset).reset_index(name="ol5")
start5 = start5.sort_values(["team", "season", "week"]).reset_index(drop=True)

# leak-safe ENTERING continuity features from prior games in the same season
rows = []
for (team, season), grp in start5.groupby(["team", "season"]):
    grp = grp.sort_values("week")
    history = []          # list of prior ol5 sets
    for _, r in grp.iterrows():
        if history:
            # consecutive-same-5 streak ending at the most recent prior game
            streak = 1
            for k in range(len(history) - 1, 0, -1):
                if history[k] == history[k - 1]:
                    streak += 1
                else:
                    break
            n_starters = len(set().union(*history))
            n_combos = len(set(history))
        else:
            streak, n_starters, n_combos = np.nan, np.nan, np.nan
        rows.append(dict(season=season, week=r.week, team=team, prior_games=len(history),
                         same5_streak=streak, n_starters_used=n_starters, n_combos=n_combos))
        history.append(r.ol5)
cont = pd.DataFrame(rows)
L(f"[build] OL continuity rows: {len(cont)} (2013-2025)")

# ---- team-game outcomes from games_enriched ----
gg = g[(g.game_type == "REG") & g.home_score.notna() & g.spread_line.notna() & (g.season >= 2013)].copy()
gg["result"] = gg.home_score - gg.away_score; gg["total_pts"] = gg.home_score + gg.away_score
orows = []
for r in gg.itertuples():
    for team, ishome in ((r.home_team, 1), (r.away_team, 0)):
        cov = (r.result > r.spread_line) if ishome else (r.result < r.spread_line)
        push = (r.result == r.spread_line)
        orows.append(dict(season=r.season, week=r.week, team=team, opp=(r.away_team if ishome else r.home_team),
                          team_cover=(np.nan if push else float(cov)), su_win=float((r.result > 0) == bool(ishome)),
                          over=(np.nan if r.total_pts == r.total_line else float(r.total_pts > r.total_line)),
                          spread_line=r.spread_line, is_home=ishome))
tgo = pd.DataFrame(orows)
d = tgo.merge(cont, on=["season", "week", "team"], how="inner")
oppc = cont.rename(columns={"team": "opp", "same5_streak": "opp_streak", "n_starters_used": "opp_starters"})[["season", "week", "opp", "opp_streak", "opp_starters"]]
d = d.merge(oppc, on=["season", "week", "opp"], how="left")
d = d[d.prior_games >= 3].copy()    # need history for continuity to mean something (≈ week 5+)
L(f"[merge] team-games with >=3 prior (continuity meaningful): {len(d)}\n")


def per_season(label, sub, outcome):
    rows = []
    for s in sorted(sub.season.dropna().unique()):
        oc = sub[sub.season == s][outcome].dropna()
        rows.append(bet_summary(int((oc == 1).sum()), int(oc.isin([0, 1]).sum()), str(int(s))))
    oc = sub[outcome].dropna()
    allr = bet_summary(int((oc == 1).sum()), int(oc.isin([0, 1]).sum()), "ALL")
    nyr = sum(1 for r in rows if r.get("n", 0) >= 8)
    beat = sum(1 for r in rows if r.get("n", 0) >= 8 and r.get("hit", 0) >= 0.524)
    L(f"  >> {label}  [{beat}/{nyr} seasons beat vig | {fmt(allr)}]")


L("="*84); L("OL CONTINUITY TESTS (leak-safe chronic instability, 2013-2025)"); L("="*84)
L(f"  distribution: same5_streak {d.same5_streak.describe()[['mean','50%','max']].round(1).to_dict()} | "
  f"n_starters_used median={d.n_starters_used.median():.0f} max={d.n_starters_used.max():.0f}")

L("\n[1] UNSTABLE OL team (many starters churned) — ATS & OU")
for thr in [8, 9, 10]:
    sub = d[d.n_starters_used >= thr]
    per_season(f"OL starters_used>={thr}: team ATS cover", sub, "team_cover")
per_season("OL starters_used>=9: team -> UNDER", d[d.n_starters_used >= 9].assign(u=1 - d[d.n_starters_used >= 9].over), "u")

L("\n[2] STABLE OL (same 5 for 4+ straight) — ATS & OU")
per_season("same5_streak>=4: team ATS cover", d[d.same5_streak >= 4], "team_cover")
per_season("same5_streak>=4: team -> OVER", d[d.same5_streak >= 4], "over")

L("\n[3] line just BROKEN (streak reset: prior two games differed) ATS")
per_season("same5_streak==1 (unstable recent) ATS", d[d.same5_streak == 1], "team_cover")

L("\n[4] MISMATCH: unstable OL team vs STABLE-OL opponent")
mm = d[(d.n_starters_used >= 9) & (d.opp_starters <= 6)]
per_season("unstable-OL vs stable-OL opp: ATS (fade unstable?)", mm.assign(f=1 - mm.team_cover), "f")

L("\n[5] continuous corr: does instability relate to cover / over (orthogonal to line)?")
for col in ["n_starters_used", "same5_streak"]:
    dd = d.dropna(subset=[col, "team_cover"])
    from scipy import stats as st
    r1 = st.pearsonr(dd[col], dd.team_cover)[0]
    dd2 = d.dropna(subset=[col, "over"])
    r2 = st.pearsonr(dd2[col], dd2.over)[0]
    L(f"  corr({col}, cover)={r1:+.3f}  corr({col}, over)={r2:+.3f}")

# ---- permutation null on the headline unstable-OL ATS cut ----
L("\n[null] permutation: unstable-OL (starters>=9) ATS cover vs shuffled")
sub = d[d.n_starters_used >= 9].dropna(subset=["team_cover"])
real = sub.team_cover.mean(); n = len(sub)
allcov = d.dropna(subset=["team_cover"]).team_cover.values
nulls = [rng.choice(allcov, n, replace=False).mean() for _ in range(2000)]
p = np.mean([abs(x - 0.5) >= abs(real - 0.5) for x in nulls])
L(f"  unstable-OL cover={real*100:.1f}% (n={n}) vs random-same-n |dev| p={p:.2f} "
  f"(null mean={np.mean(nulls)*100:.1f}%, p2.5/97.5=[{np.percentile(nulls,2.5)*100:.1f},{np.percentile(nulls,97.5)*100:.1f}])")
