"""Brief #4 add-on: head-coach performance in stakes spots + permutation null on coach identity."""
import numpy as np, pandas as pd, sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from stats_helpers import wilson_ci
rng = np.random.default_rng(0)
DATA = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
g = pd.read_parquet(os.path.join(DATA, "games_enriched.parquet"))
S = pd.read_parquet(os.path.join(DATA, "b4_stakes.parquet"))
gg = g[(g.game_type == "REG") & g.home_score.notna() & g.spread_line.notna()].copy()
gg["result"] = gg.home_score - gg.away_score
rows = []
for r in gg.itertuples():
    for team, ishome, coach in ((r.home_team, 1, r.home_coach), (r.away_team, 0, r.away_coach)):
        cov = (r.result > r.spread_line) if ishome else (r.result < r.spread_line)
        push = (r.result == r.spread_line)
        rows.append(dict(season=r.season, week=r.week, team=team, coach=coach,
                         team_cover=(np.nan if push else float(cov))))
tgo = pd.DataFrame(rows)
st = S[["season", "week", "team", "leverage", "must_win", "win_and_in", "no_stakes"]]
d = tgo.merge(st, on=["season", "week", "team"], how="inner").dropna(subset=["team_cover", "coach"])
d["contention"] = (d.leverage.abs() >= 0.10) | (d.must_win) | (d.win_and_in)
print(f"coach-game rows: {len(d)} | contention: {int(d.contention.sum())} | coaches: {d.coach.nunique()}")


def coach_table(sub, label, minn=25):
    t = sub.groupby("coach")["team_cover"].agg(cpct="mean", n="size", w="sum")
    t = t[t.n >= minn].copy()
    K = 60.0
    t["shrunk"] = (t.w + 0.50 * K) / (t.n + K)
    t = t.sort_values("cpct", ascending=False)
    print("\n=== " + label + " : " + str(len(t)) + " coaches with n>=" + str(minn) + " ===")
    print("  group cover=%.1f%%  SD across coaches=%.1fpp" % (sub.team_cover.mean() * 100, t["cpct"].std() * 100))
    print("  %-20s %4s %6s %8s %12s" % ("coach", "n", "cov%", "shrunk%", "95%CI"))
    for c, r in pd.concat([t.head(6), t.tail(6)]).iterrows():
        lo, hi = wilson_ci(int(r.w), int(r.n))
        print("  %-20s %4d %6.1f %8.1f   [%.0f,%.0f]" % (c, int(r.n), r["cpct"] * 100, r["shrunk"] * 100, lo * 100, hi * 100))
    return t


con = d[d.contention]
t_con = coach_table(con, "CONTENTION (high-leverage/must-win) ATS cover")
coach_table(d[d.no_stakes], "NO-STAKES (clinched/eliminated) ATS cover")

print("\n" + "=" * 70)
print("PERMUTATION NULL — does COACH IDENTITY matter in contention spots?")
print("=" * 70)


def stat(df):
    t = df.groupby("coach")["team_cover"].agg(m="mean", s="size")
    t = t[t.s >= 25]
    return t.m.std(), int((t.m >= 0.58).sum()), int((t.m <= 0.42).sum()), len(t)


real = stat(con)
cov = con["team_cover"].values
nulls = [stat(con.assign(team_cover=rng.permutation(cov))) for _ in range(200)]
nsd = np.mean([x[0] for x in nulls]); nhi = np.mean([x[1] for x in nulls]); nlo = np.mean([x[2] for x in nulls])
p_sd = np.mean([x[0] >= real[0] for x in nulls])
print("  coaches tested (n>=25): %d" % real[3])
print("  SD of coach cover%%: REAL=%.1fpp vs NULL=%.1fpp  (p=%.2f)" % (real[0] * 100, nsd * 100, p_sd))
print("  # coaches >=58%%: REAL=%d vs NULL avg=%.1f" % (real[1], nhi))
print("  # coaches <=42%%: REAL=%d vs NULL avg=%.1f" % (real[2], nlo))
print("  -> REAL ~ NULL => coach identity adds nothing beyond chance.")

best = t_con.index[0]
sub = con[con.coach == best]
print("\n  per-season for top contention coach '%s' (stability check):" % best)
print("   " + "  ".join("%d:%d/%d" % (int(s), int(sub[sub.season == s].team_cover.sum()), len(sub[sub.season == s]))
                        for s in sorted(sub.season.unique())))
# Belichick specifically (most data, strongest reputation) per-season
for name in ["Bill Belichick", "Andy Reid", "Mike Tomlin"]:
    sb = con[con.coach == name]
    if len(sb) >= 25:
        lo, hi = wilson_ci(int(sb.team_cover.sum()), len(sb))
        nyr = sb.groupby("season").team_cover.agg(["sum", "size"])
        beat = int((nyr["sum"] / nyr["size"] >= 0.524).sum()); tot = len(nyr)
        print("  %s contention ATS: %d/%d=%.1f%% CI[%.0f,%.0f] | seasons beat vig %d/%d"
              % (name, int(sb.team_cover.sum()), len(sb), sb.team_cover.mean() * 100, lo * 100, hi * 100, beat, tot))
