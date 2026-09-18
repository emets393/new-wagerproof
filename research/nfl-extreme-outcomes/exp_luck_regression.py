#!/usr/bin/env python3
"""STUDY A — IN-SEASON REGRESSION / LUCK (owner, 2026-09-18).
A team that is established as good at X but did terribly at X last week (or two weeks running) should
bounce back; a team that ran hot should come back down. Two questions:
  (1) does the bounce happen?  next-game facet vs own norm, by how far the last 1-2 games sat from the norm
  (2) does the MARKET over-react to it?  line residual (margin + spread, total − line) by recent-deviation
      bucket, at the OPENER and the CLOSE; plus the plain bet: back the team coming off a cold week.
Facets (Fantasy Points team tables, per game): pass efficiency (passer rating, yards/att), rush success,
pressure allowed, pass defense (rating allowed), run defense; plus LUCK proxies: points scored vs a
yardage-based expectation (points over yards), turnover margin, and the score-vs-line miss itself.
Norm = entering K=4-seeded season-to-date EXCLUDING the recent window. Recent = last game / last 2.
Every readout per season 2022-25; bets vs opener 2023-25."""
import numpy as np, pandas as pd, warnings
warnings.filterwarnings("ignore")
FP = "data/fpdata/"; num = lambda s: pd.to_numeric(s, errors="coerce")
NICK = {"Cardinals":"ARI","Falcons":"ATL","Ravens":"BAL","Bills":"BUF","Panthers":"CAR","Bears":"CHI","Bengals":"CIN","Browns":"CLE","Cowboys":"DAL","Broncos":"DEN","Lions":"DET","Packers":"GB","Texans":"HOU","Colts":"IND","Jaguars":"JAX","Chiefs":"KC","Rams":"LAR","Chargers":"LAC","Raiders":"LV","Dolphins":"MIA","Vikings":"MIN","Patriots":"NE","Saints":"NO","Giants":"NYG","Jets":"NYJ","Eagles":"PHI","Steelers":"PIT","Seahawks":"SEA","49ers":"SF","Buccaneers":"TB","Titans":"TEN","Commanders":"WAS","Football Team":"WAS","Redskins":"WAS"}
def load(t):
    d = pd.read_parquet(FP + t + ".parquet"); d = d[d.__season >= 2021].rename(columns={"__season":"season","__week":"week"}); d["team"] = d.teamNickname.map(NICK); return d
K = ["season","week","team"]
PT, PO, RT, RO = load("passingAdvanced__team"), load("passingAdvanced__opponent"), load("rushingAdvanced__team"), load("rushingAdvanced__opponent")
T = PT[K].copy(); T["att"] = num(PT.teamStatsPassingAttemptsTotal); T["rating"] = num(PT.teamStatsPassingPasserRating); T["ypa"] = num(PT.teamStatsPassingYardsPerAttempt); T["press"] = num(PT.teamStatsPassingPressuredPercentage); T["ints"] = num(PT.teamStatsPassingInterceptionsTotal); T["pyds"] = num(PT.teamStatsPassingYardsTotal)
T = T.merge(RT[K].assign(ratt=num(RT.teamStatsRushingAttemptsTotal), rsucc=num(RT.teamStatsRushingAttemptsSuccessPercentage), ryds=num(RT.teamStatsRushingYardsTotal), fum=num(RT.teamStatsRushingFumblesTotal)), on=K, how="left")
T = T.merge(PO[K].assign(datt=num(PO.opponentStatsPassingAttemptsTotal), d_rating=num(PO.opponentStatsPassingPasserRating), d_ints=num(PO.opponentStatsPassingInterceptionsTotal) if "opponentStatsPassingInterceptionsTotal" in PO.columns else np.nan), on=K, how="left")
T = T.merge(RO[K].assign(dratt=num(RO.opponentStatsRushingAttemptsTotal), d_rsucc=num(RO.opponentStatsRushingAttemptsSuccessPercentage)), on=K, how="left")
m = pd.read_parquet("data/matchup.parquet")[["season","week","home_ab","away_ab","home_score","away_score","home_spread","nv_total_line"]]
m["home_ab"] = m.home_ab.replace({"LA":"LAR"}); m["away_ab"] = m.away_ab.replace({"LA":"LAR"})
od = pd.read_parquet("data/odds_consensus.parquet")[["season","home_ab","away_ab","open_spread","open_total"]]; m = m.merge(od, on=["season","home_ab","away_ab"], how="left")
h = m.rename(columns={"home_ab":"team","away_ab":"opp","home_score":"pts","away_score":"opp_pts"}).assign(is_home=1, spread=lambda d: d.home_spread, ospread=lambda d: d.open_spread)
a = m.rename(columns={"away_ab":"team","home_ab":"opp","away_score":"pts","home_score":"opp_pts"}).assign(is_home=0, spread=lambda d: -d.home_spread, ospread=lambda d: -d.open_spread)
G = pd.concat([h, a])[["season","week","team","opp","pts","opp_pts","is_home","spread","ospread","nv_total_line","open_total"]]
F = T.merge(G, on=K, how="inner").sort_values(["team","season","week"]).reset_index(drop=True)
F["yds"] = F.pyds + F.ryds; F["margin"] = F.pts - F.opp_pts; F["resid"] = F.margin + F.spread; F["oresid"] = F.margin + F.ospread; F["tot_resid"] = (F.pts + F.opp_pts) - F.nv_total_line
F["to_margin"] = (F.d_ints.fillna(0)) - (F.ints.fillna(0) + F.fum.fillna(0))   # takeaways − giveaways (partial: fumbles lost not separated)
# points over yards: league fit pts ~ yds per season, luck = residual
F["pts_over_yds"] = np.nan
for s, x in F.groupby("season"):
    b = np.polyfit(x.yds.fillna(x.yds.median()), x.pts, 1); F.loc[x.index, "pts_over_yds"] = x.pts - np.polyval(b, x.yds.fillna(x.yds.median()))
FAC = {"rating": "att", "ypa": "att", "rsucc": "ratt", "press": "att", "d_rating": "datt", "d_rsucc": "dratt", "pts_over_yds": None, "to_margin": None, "resid": None, "margin": None}
g = F.groupby(["team","season"])
for f, w in FAC.items():
    # norm = season-to-date mean EXCLUDING the last 2 games, seeded with prior-season mean (K=4 games)
    prior = F.groupby(["team","season"])[f].mean(); p = pd.Series([prior.get((t, s - 1), np.nan) for t, s in zip(F.team, F.season)], index=F.index)
    cs = g[f].cumsum() - F[f]; cn = g.cumcount(); last1 = g[f].shift(1); last2 = g[f].shift(2)
    cs_ex = cs - last1.fillna(0) - last2.fillna(0); cn_ex = (cn - last1.notna().astype(int) - last2.notna().astype(int)).clip(lower=0)
    F["norm_" + f] = (cs_ex + 4 * p.fillna(0)) / (cn_ex + 4 * p.notna()); F.loc[(cn_ex == 0) & p.isna(), "norm_" + f] = np.nan
    sd = F[f].std(); F["dev1_" + f] = (last1 - F["norm_" + f]) / sd; F["dev2_" + f] = ((last1 + last2) / 2 - F["norm_" + f]) / sd
    F["next_" + f] = (F[f] - F["norm_" + f]) / sd            # this game vs norm (the bounce, in sd units)
F = F[(F.week >= 4) & F.pts.notna()].copy(); YRS = (2022, 2023, 2024, 2025)
def buck(v): return pd.cut(v, [-9, -1.0, -0.5, 0.5, 1.0, 9], labels=["very cold","cold","normal","hot","very hot"])
print("=" * 118); print("(1) DOES THE BOUNCE HAPPEN?  this game vs own norm (sd units) by how the LAST game sat vs the norm — pooled 2022-25"); print("=" * 118)
rows = []
for f in FAC:
    x = F.dropna(subset=["dev1_" + f, "next_" + f]); b = buck(x["dev1_" + f]); t = x.groupby(b)["next_" + f].mean()
    rows.append([f] + [f"{t.get(k, np.nan):+.2f}" for k in ["very cold","cold","normal","hot","very hot"]] + [f"{np.corrcoef(x['dev1_' + f], x['next_' + f])[0,1]:+.3f}"])
print(pd.DataFrame(rows, columns=["facet","very cold","cold","normal","hot","very hot","r(last, next)"]).to_string(index=False))
print("  read: a positive number in the 'very cold' column = the team bounced ABOVE its norm the next game (over-correction); ~0 = plain regression to the norm; negative = the cold streak persisted")
print("\n" + "=" * 118); print("(2) DOES THE MARKET OVER-REACT?  margin residual vs the line (points) by recent-deviation bucket, per season"); print("=" * 118)
for f, lab in (("margin", "scoring margin (won/lost big)"), ("resid", "vs the spread (covered/failed big)"), ("pts_over_yds", "points vs yards (lucky/unlucky scoring)"), ("to_margin", "turnover margin"), ("rating", "pass efficiency"), ("rsucc", "rush success"), ("d_rating", "pass defense")):
    for win, dev in (("last 1", "dev1_"), ("last 2", "dev2_")):
        x = F.dropna(subset=[dev + f, "resid"]); b = buck(x[dev + f])
        line = f"  {lab:38s} {win:6s} vs CLOSE: " + " | ".join(f"{k[:8]:8s} {x[b == k].resid.mean():+5.2f} n={int((b == k).sum()):4d}" for k in ["very cold","cold","normal","hot","very hot"])
        xo = x.dropna(subset=["oresid"]); bo = buck(xo[dev + f]); line += f"   || vs OPEN very cold {xo[bo == 'very cold'].oresid.mean():+5.2f} n={int((bo == 'very cold').sum())}, very hot {xo[bo == 'very hot'].oresid.mean():+5.2f} n={int((bo == 'very hot').sum())}"
        print(line)
print("\n(2b) THE BET — back the team coming off a VERY COLD game (dev ≤ −1 sd), fade the VERY HOT one; win% vs the spread, per season")
for f, lab in (("margin", "cold by scoring margin"), ("resid", "cold vs the spread"), ("pts_over_yds", "unlucky: points far under yards"), ("to_margin", "unlucky turnovers"), ("rating", "cold pass efficiency"), ("rsucc", "cold rush success"), ("d_rating", "cold pass defense (torched)")):
    for side, sel in (("BACK very cold", lambda x: x["dev1_" + f] <= -1.0), ("FADE very hot", lambda x: x["dev1_" + f] >= 1.0)):
        per = []
        for yr in YRS:
            x = F[(F.season == yr)].dropna(subset=["dev1_" + f, "resid"]); z = x[sel(x)]; res = z.resid[z.resid != 0]; won = (res > 0) if side.startswith("BACK") else (res < 0); per.append(f"{yr} {100*won.mean() if len(won) else np.nan:4.1f}% n={len(won):3d}")
        xo = F.dropna(subset=["dev1_" + f, "oresid"]); z = xo[sel(xo)]; res = z.oresid[z.oresid != 0]; won = (res > 0) if side.startswith("BACK") else (res < 0)
        print(f"  {lab:34s} {side:15s} " + "  ".join(per) + f"  | vs OPEN pooled {100*won.mean():4.1f}% n={len(won)}")
print("\n(2c) TOTALS — game total residual when the OFFENSE was very cold / very hot last game (pass efficiency), per season")
for side, sel in (("offense very cold -> OVER", lambda x: x.dev1_rating <= -1.0), ("offense very hot -> UNDER", lambda x: x.dev1_rating >= 1.0)):
    per = []
    for yr in YRS:
        x = F[(F.season == yr)].dropna(subset=["dev1_rating", "tot_resid"]); z = x[sel(x)]; res = z.tot_resid[z.tot_resid != 0]; won = (res > 0) if "OVER" in side else (res < 0); per.append(f"{yr} {100*won.mean() if len(won) else np.nan:4.1f}% n={len(won):3d}")
    print(f"  {side:28s} " + "  ".join(per))
