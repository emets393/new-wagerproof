#!/usr/bin/env python3
"""Style-interaction battery (owner mandate 2026-09-17): QB/RB style profiles ×
defense types -> GAME-LEVEL edges (totals/spreads vs close). Pre-registered:

A. VOLUME-SUPPRESSION (the Darnold read): QBs whose dropbacks historically drop
   vs two-high-heavy defenses, facing a two-high-heavy defense -> game UNDER.
   Mirror: QBs whose volume RISES vs two-high -> OVER. Placebo: same QBs vs
   non-two-high opponents -> no effect.
B. TIME-TO-THROW x PASS RUSH: slow-release QBs (top-quartile TTT) vs top-quartile
   pressure-over-expected defenses -> sacks/stalls -> UNDER. Mirror: quick-release
   QBs vs same defenses -> no effect.
C. CHECKDOWN x TACKLING: checkdown-heavy QBs vs whiff-prone (high MTF-allowed)
   defenses -> completions become YAC -> OVER. Mirror: vs elite tackling -> UNDER lean.
D. WHIFF-ON-WHIFF: elusive RB rooms (high MTF forced) vs whiff-prone defenses ->
   team covers/overs. Stability of defensive whiff rate reported first.

All features entering-game (strictly prior weeks, min 3 games). Grade vs nflverse
closing total/spread, 2022-2025. Per-season splits on anything |z|>=1.5.
"""
import numpy as np
import pandas as pd

AB_NV = {"ARZ": "ARI", "BLT": "BAL", "CLV": "CLE", "HST": "HOU"}
NICK = {"Cardinals":"ARZ","Falcons":"ATL","Ravens":"BLT","Bills":"BUF","Panthers":"CAR",
"Bears":"CHI","Bengals":"CIN","Browns":"CLV","Cowboys":"DAL","Broncos":"DEN","Lions":"DET",
"Packers":"GB","Texans":"HST","Colts":"IND","Jaguars":"JAX","Chiefs":"KC","Rams":"LA",
"Chargers":"LAC","Raiders":"LV","Dolphins":"MIA","Vikings":"MIN","Patriots":"NE",
"Saints":"NO","Giants":"NYG","Jets":"NYJ","Eagles":"PHI","Steelers":"PIT","Seahawks":"SEA",
"49ers":"SF","Buccaneers":"TB","Titans":"TEN","Commanders":"WAS"}


def num(s):
    return pd.to_numeric(s, errors="coerce")


def pre(df, keys, col, minp=3):
    return df.groupby(keys)[col].transform(lambda s: s.shift(1).expanding(min_periods=minp).mean())


# ---------- defense identities ----------
cov = pd.read_parquet("data/fpdata/team_defense_coverage-matrix.parquet")
cov["ab"] = cov.teamNickname.map(NICK).map(lambda a: AB_NV.get(a, a))
cov["twohigh"] = num(cov["opponentStatsCoverageSchemeTwoHighPassingDropbacksPercentage"])
th_prior = cov.groupby(["ab", "__season"]).twohigh.mean().reset_index()
th_prior["season"] = th_prior.__season + 1
th_prior["th_heavy"] = th_prior.groupby("season").twohigh.transform(lambda s: s >= s.quantile(0.67))

lm = pd.read_parquet("data/fpdata/lineMatchups__team.parquet")
lm["ab"] = lm.teamNickname.map(NICK).map(lambda a: AB_NV.get(a, a))
lm["rush_poe"] = num(lm["opponentStatsPassingPressuredOverExpected"])
lm = lm.sort_values(["ab", "__season", "__week"])
lm["pre_rush_poe"] = pre(lm, ["ab", "__season"], "rush_poe")

dr = pd.read_parquet("data/fpdata/team_defense_rushing-advanced.parquet")
dr["ab"] = dr.teamNickname.map(NICK).map(lambda a: AB_NV.get(a, a))
dr["whiff"] = num(dr["opponentStatsRushingMissedTacklesForcedPerAttempt"])
dr = dr.sort_values(["ab", "__season", "__week"])
dr["pre_whiff"] = pre(dr, ["ab", "__season"], "whiff")
# whiff stability
pairs = [(g[g.__week % 2 == 0].whiff.mean(), g[g.__week % 2 == 1].whiff.mean())
         for _, g in dr.dropna(subset=["whiff"]).groupby(["ab", "__season"]) if len(g) >= 10]
print(f"defensive whiff (MTF allowed/att) split-half r = "
      f"{np.corrcoef([a for a,_ in pairs],[b for _,b in pairs])[0,1]:+.3f} (n={len(pairs)})")

# ---------- QB style profiles ----------
qb = pd.read_parquet("data/fpdata/player_passing-advanced.parquet")
qb["db"] = num(qb["playerStatsPassingDropbacksTotal"])
qb["ttt"] = num(qb["playerStatsPassingAverageTimeToThrow"])
qb["chk"] = num(qb["playerStatsPassingTargetedReadCheckdownPercentage"])
qb = qb[qb.db >= 15].copy()
qb["ab"] = qb.teamAbbreviation.map(lambda a: AB_NV.get(a, a))
qb["opp"] = qb.opponentAbbreviation.map(lambda a: AB_NV.get(a, a))
qb = qb.merge(th_prior[["ab", "season", "th_heavy"]].rename(columns={"ab": "opp"}),
              left_on=["opp", "__season"], right_on=["opp", "season"], how="left")
qb = qb.sort_values(["playerPlayerId", "__season", "__week"])


def qb_th_delta(gr):
    out = []
    for i in range(len(gr)):
        prior = gr.iloc[:i]
        a = prior[prior.th_heavy == True].db
        b = prior[prior.th_heavy == False].db
        out.append(a.mean() - b.mean() if len(a) >= 2 and len(b) >= 3 else np.nan)
    return pd.Series(out, index=gr.index)


qb["th_delta"] = qb.groupby("playerPlayerId", group_keys=False).apply(qb_th_delta)
qb["pre_ttt"] = pre(qb, ["playerPlayerId", "__season"], "ttt")
qb["pre_chk"] = pre(qb, ["playerPlayerId", "__season"], "chk")
qbf = (qb.groupby(["ab", "__season", "__week"])
       .agg(th_delta=("th_delta", "first"), pre_ttt=("pre_ttt", "first"),
            pre_chk=("pre_chk", "first"), opp_th=("th_heavy", "first")).reset_index())

# ---------- RB room elusiveness ----------
rp = pd.read_parquet("data/fpdata/player_rushing-advanced.parquet")
rp["mtf"] = num(rp["playerStatsRushingMissedTacklesForcedPerAttempt"])
rp["att"] = num(rp["playerStatsRushingAttemptsTotal"])
rp = rp[rp.playerPosition == "RB"]
rb = (rp.groupby(["teamAbbreviation", "__season", "__week"])
      .apply(lambda g: np.average(g.mtf.dropna(), weights=g.att[g.mtf.notna()].clip(lower=1))
             if g.mtf.notna().any() else np.nan)
      .rename("rb_mtf").reset_index())
rb["ab"] = rb.teamAbbreviation.map(lambda a: AB_NV.get(a, a))
rb = rb.sort_values(["ab", "__season", "__week"])
rb["pre_rb_mtf"] = pre(rb, ["ab", "__season"], "rb_mtf")

# ---------- game rows + joins ----------
g = pd.read_csv("https://github.com/nflverse/nflverse-data/releases/download/schedules/games.csv",
                low_memory=False)
g = g[(g.game_type == "REG") & g.result.notna() & g.total_line.notna() & g.spread_line.notna()
      & (g.season >= 2022) & (g.season <= 2025)]
rows = []
for _, r in g.iterrows():
    for team, opp, home in ((r.home_team, r.away_team, 1), (r.away_team, r.home_team, 0)):
        margin = r.result if home else -r.result
        line = -r.spread_line if home else r.spread_line
        rows.append(dict(season=r.season, week=r.week, game_id=r.game_id, team=team, opp=opp,
                         act_total=r.home_score + r.away_score, total=r.total_line,
                         cov=np.nan if margin + line == 0 else float(margin + line > 0)))
p = pd.DataFrame(rows)
p["over"] = np.where(p.act_total == p.total, np.nan, (p.act_total > p.total).astype(float))
p = p.merge(qbf, left_on=["team", "season", "week"], right_on=["ab", "__season", "__week"], how="left")
p = p.merge(lm[["ab", "__season", "__week", "pre_rush_poe"]].rename(columns={"ab": "opp_ab"}),
            left_on=["opp", "season", "week"], right_on=["opp_ab", "__season", "__week"],
            how="left", suffixes=("", "_lm"))
p = p.merge(dr[["ab", "__season", "__week", "pre_whiff"]].rename(columns={"ab": "opp_ab2"}),
            left_on=["opp", "season", "week"], right_on=["opp_ab2", "__season", "__week"],
            how="left", suffixes=("", "_dr"))
p = p.merge(rb[["ab", "__season", "__week", "pre_rb_mtf"]].rename(columns={"ab": "own_ab"}),
            left_on=["team", "season", "week"], right_on=["own_ab", "__season", "__week"],
            how="left", suffixes=("", "_rb"))
gg = p.drop_duplicates("game_id", keep="first")   # game-level cells use one perspective row


def cell(name, d, m, target="over", min_n=30, era=False):
    c = d[m][target].dropna()
    if len(c) < min_n:
        print(f"  {name:60s} n={len(c)}")
        return
    z = (c.mean() - .5) * 2 * np.sqrt(len(c))
    print(f"  {name:60s} {int(c.sum()):4d}-{int(len(c)-c.sum()):4d} ({100*c.mean():.1f}%)  z={z:+.2f}")
    if era or abs(z) >= 1.5:
        for s in (2022, 2023, 2024, 2025):
            cc = d[m & (d.season == s)][target].dropna()
            if len(cc):
                print(f"{'':62s}{s}: {int(cc.sum())}-{int(len(cc)-cc.sum())} ({100*cc.mean():.0f}%)")


print("\n== A. VOLUME-SUPPRESSION (Darnold read) — game totals ==")
thd = p.th_delta  # team-perspective rows: use p not gg (QB belongs to team side)
qA = thd.rank(pct=True)
cell("suppressed QB (bot-25% th_delta) @ two-high-heavy opp -> UNDER",
     p, (qA <= 0.25) & (p.opp_th == True), target="over")
print("   (read UNDER = 100 - over%)")
cell("boosted QB (top-25% th_delta) @ two-high-heavy opp -> OVER",
     p, (qA >= 0.75) & (p.opp_th == True), target="over")
cell("PLACEBO suppressed QB @ NON-two-high opp", p, (qA <= 0.25) & (p.opp_th == False), target="over")

print("\n== B. TIME-TO-THROW x PASS RUSH — game totals ==")
qT = p.pre_ttt.rank(pct=True)
qR = p.pre_rush_poe.rank(pct=True)
cell("slow-release QB (top-25% TTT) vs top-25% pressure-OE D", p, (qT >= 0.75) & (qR >= 0.75), target="over")
cell("MIRROR quick-release QB vs top-25% pressure-OE D", p, (qT <= 0.25) & (qR >= 0.75), target="over")
cell("slow-release QB vs bottom-25% pressure-OE D (placebo)", p, (qT >= 0.75) & (qR <= 0.25), target="over")

print("\n== C. CHECKDOWN x TACKLING — game totals ==")
qC = p.pre_chk.rank(pct=True)
qW = p.pre_whiff.rank(pct=True)
cell("checkdown QB (top-25%) vs whiff-prone D (top-25% MTF-allowed)", p, (qC >= 0.75) & (qW >= 0.75), target="over")
cell("checkdown QB vs elite-tackling D (bot-25%)", p, (qC >= 0.75) & (qW <= 0.25), target="over")

print("\n== D. WHIFF-ON-WHIFF — team ATS ==")
qE = p.pre_rb_mtf.rank(pct=True)
cell("elusive RB room (top-25% MTF) vs whiff-prone D -> team ATS", p, (qE >= 0.75) & (qW >= 0.75), target="cov")
cell("elusive RB room vs elite-tackling D (mirror)", p, (qE >= 0.75) & (qW <= 0.25), target="cov")
cell("plodding RB room (bot-25%) vs whiff-prone D (placebo)", p, (qE <= 0.25) & (qW >= 0.75), target="cov")
