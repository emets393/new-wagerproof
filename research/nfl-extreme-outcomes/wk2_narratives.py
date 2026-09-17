#!/usr/bin/env python3
"""Per-game scheme narratives for the upcoming slate: how each team's passing
game has performed vs the specific coverage shells the opposing defense runs,
and how the run game profiles vs that front. Surfaces edges. History = 2024-25."""
import sys
import numpy as np
import pandas as pd

TS, TW = int(sys.argv[1]), int(sys.argv[2])
NICK = {"Cardinals":"ARZ","Falcons":"ATL","Ravens":"BLT","Bills":"BUF","Panthers":"CAR",
"Bears":"CHI","Bengals":"CIN","Browns":"CLV","Cowboys":"DAL","Broncos":"DEN","Lions":"DET",
"Packers":"GB","Texans":"HST","Colts":"IND","Jaguars":"JAX","Chiefs":"KC","Rams":"LA",
"Chargers":"LAC","Raiders":"LV","Dolphins":"MIA","Vikings":"MIN","Patriots":"NE","Saints":"NO",
"Giants":"NYG","Jets":"NYJ","Eagles":"PHI","Steelers":"PIT","Seahawks":"SEA","49ers":"SF",
"Buccaneers":"TB","Titans":"TEN","Commanders":"WAS"}
AB2FP = {"ARI":"ARZ","BAL":"BLT","CLE":"CLV","HOU":"HST"}   # nflverse -> FP
HIST = [2024, 2025]


def num(s):
    return pd.to_numeric(s, errors="coerce")


# QB passing efficiency by coverage shell (team offense, proxy for QB) — history
sc = pd.read_parquet("data/fpdata/split_recv_adv_x_coverage.parquet")
sc["yds"] = num(sc.playerStatsReceivingYardsTotal); sc["tgt"] = num(sc.playerStatsReceivingTargetsTotal)
SHELLS = ["Cover 1", "Cover 2", "Cover 3", "Cover 4", "Cover 6", "Cover 0"]
sc = sc[sc.playDefenseCoverageSchemeParent.isin(SHELLS) & sc.__season.isin(HIST)]
qb_shell = (sc.groupby(["teamAbbreviation", "playDefenseCoverageSchemeParent"])
            .apply(lambda d: d.yds.sum() / max(d.tgt.sum(), 1)).rename("ypt").reset_index())
qb_shell_all = sc.groupby("teamAbbreviation").apply(lambda d: d.yds.sum() / max(d.tgt.sum(), 1))

# defense coverage diet (what shells they run) — history, per FP team
cov = pd.read_parquet("data/fpdata/team_defense_coverage-matrix.parquet")
cov["ab"] = cov.teamNickname.map(NICK)
cov = cov[cov.__season.isin(HIST)]
covrate = {}
for ab, d in cov.groupby("ab"):
    tot = 0; rates = {}
    for k, c in (("Man", "opponentStatsCoverageSchemeManPassingDropbacksPercentage"),
                 ("Zone", "opponentStatsCoverageSchemeZonePassingDropbacksPercentage"),
                 ("TwoHigh", "opponentStatsCoverageSchemeTwoHighPassingDropbacksPercentage"),
                 ("SingleHigh", "opponentStatsCoverageSchemeSingleHighPassingDropbacksPercentage")):
        rates[k] = num(d[c]).mean()
    covrate[ab] = rates

# RB profile + defense front — history
rp = pd.read_parquet("data/fpdata/player_rushing-advanced.parquet")
rp = rp[(rp.playerPosition == "RB") & rp.__season.isin(HIST)]
rp["att"] = num(rp.playerStatsRushingAttemptsTotal); rp["ybc"] = num(rp.playerStatsRushingYardsBeforeContactPerAttempt)
rp["yac"] = num(rp.playerStatsRushingYardsAfterContactPerAttempt); rp["mtf"] = num(rp.playerStatsRushingMissedTacklesForcedPerAttempt)
dr = pd.read_parquet("data/fpdata/team_defense_rushing-advanced.parquet")
dr["ab"] = dr.teamNickname.map(NICK); dr = dr[dr.__season.isin(HIST)]
dfront = {}
for ab, d in dr.groupby("ab"):
    dfront[ab] = dict(ybc_allowed=num(d["opponentStatsRushingYardsBeforeContactPerAttempt"]).mean(),
                      stuff=num(d["opponentStatsRushingAttemptsStuffsPercentage"]).mean())
lg_ybc = np.mean([v["ybc_allowed"] for v in dfront.values()])
lg_stuff = np.mean([v["stuff"] for v in dfront.values()])

g = pd.read_csv("https://github.com/nflverse/nflverse-data/releases/download/schedules/games.csv", low_memory=False)
sl = g[(g.season == TS) & (g.week == TW)]
pred = pd.read_parquet("data/fpdata/_slate_pred.parquet").set_index("game_id")

print(f"# NFL Week {TW} ({TS}) — Scheme Narratives & Edges  (history: {HIST[0]}-{HIST[-1]})\n")
for _, r in sl.iterrows():
    ha, aa = r.home_team, r.away_team
    hfp, afp = AB2FP.get(ha, ha), AB2FP.get(aa, aa)
    print(f"## {aa} @ {ha}")
    pr = pred.loc[r.game_id] if r.game_id in pred.index else None
    if pr is not None:
        print(f"_Model: {ha} {pr.hpm:+.1f}, total {pr.pt:.1f} | edge sp {pr.sp_edge:+.1f}, tot {pr.tot_edge:+.1f}_\n")
    edges = []
    for off_ab, def_ab, off_fp, def_fp, label in ((aa, ha, afp, hfp, aa), (ha, aa, hfp, afp, ha)):
        cr = covrate.get(def_fp, {})
        if not cr:
            continue
        top = sorted(cr.items(), key=lambda x: -(x[1] or 0))[:2]
        diet = ", ".join(f"{k} {100*v:.0f}%" for k, v in top if pd.notna(v))
        # QB efficiency vs those shells — translate Man->Cover1/0, Zone->Cover2/3, etc (approx via shell ypt)
        qsa = qb_shell_all.get(off_fp, np.nan)
        shell_map = {"TwoHigh": ["Cover 2", "Cover 4", "Cover 6"], "SingleHigh": ["Cover 1", "Cover 3"],
                     "Man": ["Cover 1", "Cover 0"], "Zone": ["Cover 2", "Cover 3", "Cover 4"]}
        note = []
        for sch, _ in top:
            shells = shell_map.get(sch, [])
            v = qb_shell[(qb_shell.teamAbbreviation == off_fp) & qb_shell.playDefenseCoverageSchemeParent.isin(shells)]
            if len(v) and pd.notna(qsa):
                ypt = v.ypt.mean()
                delta = ypt - qsa
                tag = "STRONG" if delta > 0.5 else "weak" if delta < -0.5 else "avg"
                note.append(f"vs {sch}-type: {ypt:.1f} yd/tgt ({tag}, base {qsa:.1f})")
                if abs(delta) > 0.7:
                    edges.append(f"{label} pass game {'thrives' if delta>0 else 'struggles'} vs {sch} ({ypt:.1f} vs {qsa:.1f} base) — {def_ab} runs it {100*dict(top).get(sch,0):.0f}%")
        print(f"- **{label} offense** vs **{def_ab}** ({diet}): " + ("; ".join(note) if note else "no strong shell split"))
        # RB vs front
        rbs = rp[rp.teamAbbreviation == off_fp].groupby(["playerFirstName", "playerLastName"]).agg(
            att=("att", "sum"), ybc=("ybc", "mean"), mtf=("mtf", "mean")).sort_values("att", ascending=False).head(1)
        fr = dfront.get(def_fp, {})
        if len(rbs) and fr:
            (fn, ln), rb = list(rbs.iterrows())[0]
            soft = fr["ybc_allowed"] > lg_ybc + 0.2
            print(f"  RB {fn} {ln}: {rb.ybc:.2f} YBC/att, {rb.mtf:.2f} MTF/att  vs {def_ab} front "
                  f"({fr['ybc_allowed']:.2f} YBC allowed {'[SOFT]' if soft else '[stout]' if fr['ybc_allowed']<lg_ybc-0.2 else ''}, "
                  f"{100*fr['stuff']:.0f}% stuff)")
            if rb.mtf > 0.20 and soft:
                edges.append(f"{label} RB {ln} ({rb.mtf:.2f} MTF) vs SOFT {def_ab} front ({fr['ybc_allowed']:.2f} YBC allowed) — run-game edge")
    if edges:
        print("\n  ⚡ EDGES: " + " | ".join(edges))
    print()
