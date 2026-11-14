#!/usr/bin/env python3
"""Layer-4 sides study: scheme-conditional offense efficiency -> ATS.

Construct: a team's per-game offensive EPA/play (nflverse pbp) split by whether
the opponent was two-high-heavy or man-heavy (FP coverage matrix, prior-season
identity). th_delta = (EPA vs two-high-heavy opps) - (EPA vs others), computed
STRICTLY from prior games (expanding, within season, min 2 games each bucket).
Test: when a team with a strong/weak th_delta faces a two-high-heavy defense,
does it cover? Grade vs nflverse closing spread, 2022-2025.
"""
import glob
import numpy as np
import pandas as pd

NICK = {"Cardinals":"ARZ","Falcons":"ATL","Ravens":"BLT","Bills":"BUF","Panthers":"CAR",
"Bears":"CHI","Bengals":"CIN","Browns":"CLV","Cowboys":"DAL","Broncos":"DEN","Lions":"DET",
"Packers":"GB","Texans":"HST","Colts":"IND","Jaguars":"JAX","Chiefs":"KC","Rams":"LA",
"Chargers":"LAC","Raiders":"LV","Dolphins":"MIA","Vikings":"MIN","Patriots":"NE",
"Saints":"NO","Giants":"NYG","Jets":"NYJ","Eagles":"PHI","Steelers":"PIT","Seahawks":"SEA",
"49ers":"SF","Buccaneers":"TB","Titans":"TEN","Commanders":"WAS"}
AB_NV = {"ARZ":"ARI","BLT":"BAL","CLV":"CLE","HST":"HOU"}

# per-game offensive EPA from slim pbp
frames = []
for f in glob.glob("data/pbp_cache/pbpslim_20*.parquet"):
    d = pd.read_parquet(f, columns=["game_id","season","week","season_type","posteam","epa","play_type"])
    frames.append(d[(d.season_type=="REG") & d.posteam.notna() & d.epa.notna()])
pbp = pd.concat(frames)
og = (pbp[pbp.play_type.isin(["pass","run"])]
      .groupby(["season","week","posteam"]).epa.mean().reset_index()
      .rename(columns={"posteam":"team","epa":"off_epa"}))

# opponent scheme identity from FP coverage matrix (PRIOR season, stable trait)
cov = pd.read_parquet("data/fpdata/team_defense_coverage-matrix.parquet")
cov["ab"] = cov.teamNickname.map(NICK).map(lambda a: AB_NV.get(a, a))
cov["twohigh"] = pd.to_numeric(cov["opponentStatsCoverageSchemeTwoHighPassingDropbacksPercentage"], errors="coerce")
ident = cov.groupby(["ab","__season"]).twohigh.mean().reset_index()
ident["season"] = ident.__season + 1          # prior-season identity for next season
ident["th_heavy"] = ident.groupby("season").twohigh.transform(lambda s: s >= s.quantile(0.67))
ident = ident[["ab","season","th_heavy"]].rename(columns={"ab":"opp"})

g = pd.read_csv("https://github.com/nflverse/nflverse-data/releases/download/schedules/games.csv", low_memory=False)
g = g[(g.game_type=="REG") & g.result.notna() & g.spread_line.notna() & (g.season>=2022) & (g.season<=2025)]
rows = []
for _, r in g.iterrows():
    for team, opp, home in ((r.home_team, r.away_team, True), (r.away_team, r.home_team, False)):
        margin = r.result if home else -r.result
        line = -r.spread_line if home else r.spread_line
        rows.append(dict(season=r.season, week=r.week, team=team, opp=opp,
                         cov=np.nan if margin+line==0 else float(margin+line>0)))
p = pd.DataFrame(rows).merge(og, on=["season","week","team"], how="left")
p = p.merge(ident, on=["opp","season"], how="left")

# entering-game th_delta per team-season (strictly prior weeks)
p = p.sort_values(["team","season","week"]).reset_index(drop=True)
def th_delta(gr):
    out = []
    for i in range(len(gr)):
        prior = gr.iloc[:i]
        a = prior[prior.th_heavy==True].off_epa
        b = prior[prior.th_heavy==False].off_epa
        out.append(a.mean()-b.mean() if len(a)>=2 and len(b)>=2 else np.nan)
    return pd.Series(out, index=gr.index)
p["th_delta"] = p.groupby(["team","season"], group_keys=False).apply(th_delta)

t = p[(p.th_heavy==True) & p.th_delta.notna()].copy()
q = t.th_delta.rank(pct=True)
def cell(name, m):
    c = t[m]["cov"].dropna()
    if len(c) < 25: print(f"{name:58s} n={len(c)}"); return
    z = (c.mean()-.5)*2*np.sqrt(len(c))
    print(f"{name:58s} {int(c.sum()):4d}-{int(len(c)-c.sum()):4d} ({100*c.mean():.1f}%)  z={z:+.2f}")
print(f"games where team faces TWO-HIGH-HEAVY defense w/ th_delta known: {len(t)}")
cell("offense PROVEN vs two-high (top-25% th_delta) -> ATS", q>=0.75)
cell("offense WEAK vs two-high (bot-25% th_delta) -> fade->cover", q<=0.25)
cell("middle 50%", (q>0.25)&(q<0.75))
for lo,hi in ((2022,2023),(2024,2025)):
    tt = t[(t.season>=lo)&(t.season<=hi)]
    qq = tt.th_delta.rank(pct=True)
    c = tt[qq>=0.75]["cov"].dropna()
    print(f"  {lo}-{hi} top-quartile: {int(c.sum())}-{int(len(c)-c.sum())} ({100*c.mean():.0f}%)" if len(c) else "")
