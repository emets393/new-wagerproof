"""
Proper scale-up of the case study: measure DIRECTIONAL RESPONSIVENESS (do teams change style IN RESPONSE to
the opponent), not variance. Two questions, kept separate:
 Q1 AGGREGATE: across all team-games, do teams run more vs SOFT run-Ds and slow down vs FAST offenses?
    (within-team deviations vs opponent traits -> is adaptation a REAL population effect?)
 Q2 PER-TEAM TRAIT: is a team's responsiveness a stable, classifiable trait (split-half reliability)?
"""
import glob
import numpy as np
import pandas as pd
from scipy.stats import pearsonr

box = pd.concat([pd.read_parquet(f) for f in glob.glob("data/cfbd/teamgame_box_*.parquet")], ignore_index=True)
gm = pd.read_parquet("data/model_games.parquet")
FBS = set(gm.homeTeam) | set(gm.awayTeam)
box = box[box.team.isin(FBS)].copy()
box["run_rate"] = box.rush_att / (box.rush_att + box.pass_att)
box["sec_play"] = box.poss_secs / box.plays
box = box[box.run_rate.notna() & box.sec_play.notna() & (box.plays >= 30)]

# opponent traits per team-game: opp run-D (adj_rushing_epa_allowed, HIGH=soft) + opp pace norm (drives) + opp explosiveness
opp_rows = []
for _, r in gm.iterrows():
    opp_rows.append({"season": r.season, "game_id": r.game_id, "team": r.homeTeam,
                     "opp_runD_soft": r.away_adj_rushing_epa_allowed, "opp_expl": r.away_adj_explosiveness, "opp_pace_off": r.away_pace_off_plays})
    opp_rows.append({"season": r.season, "game_id": r.game_id, "team": r.awayTeam,
                     "opp_runD_soft": r.home_adj_rushing_epa_allowed, "opp_expl": r.home_adj_explosiveness, "opp_pace_off": r.home_pace_off_plays})
opp = pd.DataFrame(opp_rows)
d = box.merge(opp, on=["season", "game_id", "team"], how="inner").dropna(subset=["opp_runD_soft", "opp_expl"])
# within-team deviations (remove team-season mean -> isolate game-to-game ADAPTATION)
for c in ["run_rate", "sec_play"]:
    d[f"{c}_dev"] = d[c] - d.groupby(["season", "team"])[c].transform("mean")
for c in ["opp_runD_soft", "opp_expl"]:
    d[f"{c}_z"] = d.groupby("season")[c].transform(lambda x: (x - x.mean()) / x.std())

print("=== Q1. AGGREGATE adaptation (within-team deviation vs opponent trait), all team-games ===")
print("(theory: vs SOFT run-D -> run MORE; vs EXPLOSIVE opp -> slow down (higher sec/play))\n")
def corr(x, y):
    m = x.notna() & y.notna(); r, p = pearsonr(x[m], y[m]); return r, p, m.sum()
r, p, n = corr(d.run_rate_dev, d.opp_runD_soft_z)
print(f"  run-rate_dev vs opp soft-run-D : r={r:+.3f} (p={p:.1e}, n={n})  -> {'teams DO run more vs soft run-D (adapt)' if r>0 and p<0.01 else 'no'}")
r, p, n = corr(d.sec_play_dev, d.opp_expl_z)
print(f"  sec/play_dev vs opp explosiveness: r={r:+.3f} (p={p:.1e}, n={n})  -> {'teams DO slow down vs explosive (adapt)' if r>0 and p<0.01 else 'no clear pace adaptation'}")
r, p, n = corr(d.sec_play_dev, d.opp_pace_off.pipe(lambda s:(s-s.mean())/s.std()))
print(f"  sec/play_dev vs opp pace        : r={r:+.3f} (p={p:.1e}, n={n})")

# how big is the effect? compare run_rate when opp run-D soft (top tercile) vs stout (bottom)
soft = d[d.opp_runD_soft_z >= d.opp_runD_soft_z.quantile(.66)]; stout = d[d.opp_runD_soft_z <= d.opp_runD_soft_z.quantile(.33)]
print(f"\n  effect size: run-rate vs SOFT run-D {100*soft.run_rate.mean():.1f}% vs STOUT run-D {100*stout.run_rate.mean():.1f}% (gap {100*(soft.run_rate.mean()-stout.run_rate.mean()):+.1f} pts)")

print("\n=== Q2. PER-TEAM responsiveness a stable TRAIT? (each team's run-resp slope, split-half) ===")
rows = []
for (s, t), g in d.groupby(["season", "team"]):
    if len(g) < 10: continue
    g = g.sort_values("game_id")
    def slope(sub):
        m = sub.run_rate.notna() & sub.opp_runD_soft_z.notna()
        if m.sum() < 4 or sub.opp_runD_soft_z[m].std() == 0: return np.nan
        return np.polyfit(sub.opp_runD_soft_z[m], sub.run_rate[m], 1)[0]
    odd = g.iloc[1::2]; even = g.iloc[0::2]
    rows.append({"season": s, "team": t, "resp_odd": slope(odd), "resp_even": slope(even), "resp_full": slope(g)})
R = pd.DataFrame(rows).dropna()
print(f"  per-team run-responsiveness split-half reliability (odd vs even): r={R.resp_odd.corr(R.resp_even):.2f} (n={len(R)})")
print(f"  -> {'STABLE trait, classifiable' if R.resp_odd.corr(R.resp_even)>0.4 else 'NOT a reliable per-team trait (too few games)'}")
