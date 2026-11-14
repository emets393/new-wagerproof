#!/usr/bin/env python3
"""RUSHING MATCHUP CROSS (owner 2026-09-17) — the run-game analogue of route_matchup.py.

Crosses a back's run-CONCEPT strengths against that front's concept weaknesses, plus the
trench layer (yards before contact = the line) separated from the back layer (yards after
contact, missed tackles forced = the runner).

  back edge on concept C   = his yards-per-attempt on C      - league
  front hole on concept C  = what THIS defense allows on C   - league
  STACKED                  = both

Separating before/after contact matters: a back with elite YAC behind a bad line reads
totally differently from a back riding a great line, and they fail in different matchups.

Usage: python3 rush_matchup.py AWAY HOME
"""
import sys

import numpy as np
import pandas as pd

pd.options.mode.chained_assignment = None
FP = "data/fpdata/"
num = lambda s: pd.to_numeric(s, errors="coerce")
AB_NV = {"ARZ": "ARI", "BLT": "BAL", "CLV": "CLE", "HST": "HOU"}
NICK = {"Cardinals":"ARI","Falcons":"ATL","Ravens":"BAL","Bills":"BUF","Panthers":"CAR","Bears":"CHI",
"Bengals":"CIN","Browns":"CLE","Cowboys":"DAL","Broncos":"DEN","Lions":"DET","Packers":"GB","Texans":"HOU",
"Colts":"IND","Jaguars":"JAX","Chiefs":"KC","Rams":"LA","Chargers":"LAC","Raiders":"LV","Dolphins":"MIA",
"Vikings":"MIN","Patriots":"NE","Saints":"NO","Giants":"NYG","Jets":"NYJ","Eagles":"PHI","Steelers":"PIT",
"Seahawks":"SEA","49ers":"SF","Buccaneers":"TB","Titans":"TEN","Commanders":"WAS"}
AWAY, HOME = (sys.argv[1], sys.argv[2]) if len(sys.argv) > 2 else ("DET", "BUF")
SEASONS = [2025, 2026]
MINA = 25      # min attempts for a cell

ru = pd.read_parquet(FP + "player_rushing-advanced.parquet")
ru = ru[ru.__season.isin(SEASONS)].copy()
ru["nm"] = ru.playerFirstName + " " + ru.playerLastName
ru["tm"] = ru.teamAbbreviation.map(lambda a: AB_NV.get(a, a))
ru["opp"] = ru.opponentAbbreviation.map(lambda a: AB_NV.get(a, a))
M = {"att": "playerStatsRushingAttemptsTotal", "yds": "playerStatsRushingYardsTotal",
     "zatt": "playerStatsRushingConceptZoneAttemptsTotal", "zyds": "playerStatsRushingConceptZoneYardsTotal",
     "matt": "playerStatsRushingConceptManAttemptsTotal", "myds": "playerStatsRushingConceptManYardsTotal",
     "ybc": "playerStatsRushingYardsBeforeContactPerAttempt",
     "yac": "playerStatsRushingYardsAfterContactPerAttempt",
     "mtf": "playerStatsRushingMissedTacklesForcedPerAttempt",
     "succ": "playerStatsRushingAttemptsSuccessPercentage",
     "stuff": "playerStatsRushingAttemptsStuffsPercentage",
     "expl": "playerStatsRushingRunsExplosivePercentage"}
for k, c in M.items():
    ru[k] = num(ru[c]) if c in ru.columns else np.nan

de = pd.read_parquet(FP + "team_defense_rushing-advanced.parquet")
de = de[de.__season.isin(SEASONS)].copy()
de["k"] = (de.teamAbbreviation if "teamAbbreviation" in de.columns and de.teamAbbreviation.notna().any()
           else de.teamNickname.map(NICK)).map(lambda a: AB_NV.get(a, a))
D = {"att": "opponentStatsRushingAttemptsTotal", "yds": "opponentStatsRushingYardsTotal",
     "zatt": "opponentStatsRushingConceptZoneAttemptsTotal", "zyds": "opponentStatsRushingConceptZoneYardsTotal",
     "matt": "opponentStatsRushingConceptManAttemptsTotal", "myds": "opponentStatsRushingConceptManYardsTotal",
     "ybc": "opponentStatsRushingYardsBeforeContactPerAttempt",
     "yac": "opponentStatsRushingYardsAfterContactPerAttempt",
     "mtf": "opponentStatsRushingMissedTacklesForcedPerAttempt",
     "succ": "opponentStatsRushingAttemptsSuccessPercentage",
     "stuff": "opponentStatsRushingAttemptsStuffsPercentage",
     "expl": "opponentStatsRushingRunsExplosivePercentage"}
for k, c in D.items():
    de[k] = num(de[c]) if c in de.columns else np.nan


def rate(g, ycol, acol):
    A = g[acol].sum()
    return g[ycol].sum() / A if A else np.nan, A


def wavg(g, col, wt="att"):
    w = g[wt]
    m = g[col].notna() & w.notna()
    return (g.loc[m, col] * w[m]).sum() / w[m].sum() if w[m].sum() else np.nan


# league baselines
lg = {}
lg["zone"], _ = rate(ru, "zyds", "zatt")
lg["gap"], _ = rate(ru, "myds", "matt")
lg["ypa"], _ = rate(ru, "yds", "att")
for c in ("ybc", "yac", "mtf", "succ", "stuff", "expl"):
    lg[c] = wavg(ru, c)

print("=" * 108)
print(f"  RUSHING MATCHUP — {AWAY} at {HOME}      (2025 + 2026 to date)")
print("=" * 108)
print(f"\n  LEAGUE: zone {lg['zone']:.2f} yds/att | gap-man {lg['gap']:.2f} | overall {lg['ypa']:.2f}"
      f" | before contact {lg['ybc']:.2f} | after contact {lg['yac']:.2f} | missed tackles {lg['mtf']:.3f}"
      f" | success {100*lg['succ']:.1f}% | stuffed {100*lg['stuff']:.1f}%")

# ---------------- DEFENSIVE FRONTS ----------------
print("\n  RUN DEFENSE — allowed vs league (+ = the run game works against them)")
print(f"   {'front':8s} {'zone':>8s} {'gap-man':>9s} {'overall':>9s} {'bef.cont':>9s} {'aft.cont':>9s}"
      f" {'miss tkl':>9s} {'success':>9s} {'stuffed':>9s}")
DEFROW = {}
for t in (AWAY, HOME):
    g = de[de.k == t]
    if not len(g):
        continue
    z, za = rate(g, "zyds", "zatt"); m, ma = rate(g, "myds", "matt"); o, oa = rate(g, "yds", "att")
    r = dict(zone=z - lg["zone"], gap=m - lg["gap"], ypa=o - lg["ypa"],
             ybc=wavg(g, "ybc") - lg["ybc"], yac=wavg(g, "yac") - lg["yac"],
             mtf=wavg(g, "mtf") - lg["mtf"], succ=100 * (wavg(g, "succ") - lg["succ"]),
             stuff=100 * (wavg(g, "stuff") - lg["stuff"]))
    DEFROW[t] = r
    print(f"   {t:8s} {r['zone']:+8.2f} {r['gap']:+9.2f} {r['ypa']:+9.2f} {r['ybc']:+9.2f} {r['yac']:+9.2f}"
          f" {r['mtf']:+9.3f} {r['succ']:+8.1f}% {r['stuff']:+8.1f}%")
    print(f"   {'  (att)':8s} {za:8.0f} {ma:9.0f} {oa:9.0f}")
for t, r in DEFROW.items():
    worse = "ZONE" if r["zone"] > r["gap"] else "GAP/MAN"
    print(f"   -> {t}: more vulnerable to {worse} runs "
          f"(zone {r['zone']:+.2f} vs gap {r['gap']:+.2f}); "
          f"{'gives up push at the line' if r['ybc'] > 0 else 'holds the line'} ({r['ybc']:+.2f} before contact), "
          f"{'tackles poorly' if r['mtf'] > 0 else 'tackles well'} ({r['mtf']:+.3f} missed/att)")

# ---------------- BACKS ----------------
# CURRENT roster only: a back belongs to the team on his MOST RECENT game row. Pooling 2025+2026
# by team put David Montgomery (Houston in 2026) on Detroit's line in a live post — owner caught it.
_last = ru.sort_values(["__season", "__week"]).groupby("nm").tail(1).set_index("nm").tm
BACKS = {}
for tm in (AWAY, HOME):
    _rb = set(ru[ru.playerPosition.isin(["RB", "FB"])].nm)     # backs only — Allen's scrambles are not a back
    cur = [n for n, t in _last.items() if t == tm and n in _rb]
    tot = ru[ru.nm.isin(cur)].groupby("nm").att.sum().sort_values(ascending=False)
    BACKS[tm] = tot[tot >= MINA].head(3).index.tolist()
print("\n  THE BACKS — profile vs league, then stacked against tonight's front")
print(f"   {'back':20s} {'tm':4s} {'att':>5s} {'zone':>8s} {'gap-man':>9s} {'bef.cont':>9s} {'aft.cont':>9s}"
      f" {'miss tkl':>9s} {'stuffed':>9s}")
PROF = {}
for tm, names in BACKS.items():
    for nm in names:
        g = ru[(ru.nm == nm) & (ru.tm == tm)]
        if not len(g) or g.att.sum() < MINA:
            continue
        z, za = rate(g, "zyds", "zatt"); m, ma = rate(g, "myds", "matt")
        r = dict(tm=tm, att=g.att.sum(), za=za, ma=ma,
                 zone=z - lg["zone"] if za >= MINA else np.nan,
                 gap=m - lg["gap"] if ma >= MINA else np.nan,
                 ybc=wavg(g, "ybc") - lg["ybc"], yac=wavg(g, "yac") - lg["yac"],
                 mtf=wavg(g, "mtf") - lg["mtf"], stuff=100 * (wavg(g, "stuff") - lg["stuff"]),
                 zmix=100 * za / (za + ma) if (za + ma) else np.nan)
        PROF[nm] = r
        f = lambda v, w=8, p=2: f"{v:+{w}.{p}f}" if pd.notna(v) else f"{'--':>{w}s}"
        print(f"   {nm[:20]:20s} {tm:4s} {r['att']:5.0f} {f(r['zone'])} {f(r['gap'], 9)} {f(r['ybc'], 9)}"
              f" {f(r['yac'], 9)} {f(r['mtf'], 9, 3)} {f(r['stuff'], 9, 1)}%")

print("\n  STACKED — back's concept edge + that front's concept hole")
for nm, r in PROF.items():
    opp = HOME if r["tm"] == AWAY else AWAY
    if opp not in DEFROW:
        continue
    d = DEFROW[opp]
    out = []
    for lab, pk, dk in (("zone", "zone", "zone"), ("gap/man", "gap", "gap")):
        if pd.notna(r[pk]):
            out.append((lab, r[pk] + d[dk], r[pk], d[dk]))
    out.sort(key=lambda x: -x[1])
    line = f"   {nm[:20]:20s} vs {opp}: " + " | ".join(
        f"{l} {tot:+.2f} (back {pe:+.2f} + front {de_:+.2f})" for l, tot, pe, de_ in out)
    print(line)
    # trench vs runner attribution
    tr = r["ybc"] + d["ybc"]
    rn = r["yac"] + d["yac"] + 3 * (r["mtf"] + d["mtf"])
    print(f"   {'':20s}    line-vs-front {tr:+.2f} before contact | runner-vs-tacklers {rn:+.2f} "
          f"({'runner-driven' if rn > tr else 'line-driven'} matchup)")
print("\n" + "=" * 108)
