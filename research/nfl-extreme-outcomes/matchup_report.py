#!/usr/bin/env python3
"""SITUATIONAL MATCHUP REPORT (owner 2026-09-17) — narrative edges, not model picks.

Built on the 773 bucket columns recovered by fp_flatten_buckets.py. Every figure is shown
against a LEAGUE BASELINE so it can be read as an edge rather than a number.

Sections:
  1  Offensive red-zone identity      pass/run inside the 10 and 20 vs league
  2  Red-zone target distribution     which ALIGNMENT this offense throws to inside the 20
  3  Defensive red-zone coverage      separation this defense allows in the red zone
  4  Defense by alignment             separation allowed to slot / wide / inline
  5  Situational pass tendency        3rd down, leading, trailing, 1st half, 2nd half
  6  Player alignment splits          separation + targets per route by where he lines up
  7  Player route-type splits         which routes he wins on and gets fed on
  8  QB by throw depth                attempts / TDs / rating by depth bucket

Usage:  python3 matchup_report.py AWAY HOME [season] [week]
"""
import sys

import numpy as np
import pandas as pd

pd.options.mode.chained_assignment = None
FP = "data/fpdata/"
FLAT = FP + "flat/"
num = lambda s: pd.to_numeric(s, errors="coerce")
AB_NV = {"ARZ": "ARI", "BLT": "BAL", "CLV": "CLE", "HST": "HOU"}
NICK = {"Cardinals":"ARZ","Falcons":"ATL","Ravens":"BLT","Bills":"BUF","Panthers":"CAR","Bears":"CHI",
"Bengals":"CIN","Browns":"CLV","Cowboys":"DAL","Broncos":"DEN","Lions":"DET","Packers":"GB","Texans":"HST",
"Colts":"IND","Jaguars":"JAX","Chiefs":"KC","Rams":"LA","Chargers":"LAC","Raiders":"LV","Dolphins":"MIA",
"Vikings":"MIN","Patriots":"NE","Saints":"NO","Giants":"NYG","Jets":"NYJ","Eagles":"PHI","Steelers":"PIT",
"Seahawks":"SEA","49ers":"SF","Buccaneers":"TB","Titans":"TEN","Commanders":"WAS"}
AWAY, HOME = (sys.argv[1], sys.argv[2]) if len(sys.argv) > 2 else ("DET", "BUF")
SEASONS = [2025, 2026]          # prior season + current, weighted by volume
TEAMS = [AWAY, HOME]


def tk(df):
    if "teamAbbreviation" in df.columns and df.teamAbbreviation.notna().any():
        s = df.teamAbbreviation
    else:
        s = df.teamNickname.map(NICK)
    return s.map(lambda a: AB_NV.get(a, a))


def bar(v, lg, w=18, lo=None, hi=None):
    """Tiny text bar showing where v sits relative to league."""
    if pd.isna(v) or pd.isna(lg):
        return ""
    d = v - lg
    return f"{'+' if d >= 0 else ''}{d:.1f} vs lg"


print("=" * 104)
print(f"  SITUATIONAL MATCHUP REPORT — {AWAY} at {HOME}      (2025 + 2026 to date)")
print("=" * 104)

# ============================================================ 1. OFFENSIVE RED ZONE
rp = pd.read_parquet(FLAT + "team_run-pass-report.parquet")
rp["tm"] = tk(rp)
rp = rp[rp.__season.isin(SEASONS)]
SIT = ["Overall", "Inside20", "Inside10", "ThirdDown", "Leading", "Trailing", "FirstHalf", "SecondHalf", "Neutral"]
rows = []
for t, gg in rp.groupby("tm"):
    r = {"tm": t}
    for b in SIT:
        p, tot = f"{b}__teamStatsSnapsOffensePass", f"{b}__teamStatsSnapsOffenseTotal"
        if p in gg.columns:
            P, T = num(gg[p]).sum(), num(gg[tot]).sum()
            r[b] = 100 * P / T if T else np.nan
            r[b + "_n"] = T
    rows.append(r)
O = pd.DataFrame(rows).set_index("tm")
lg = O[SIT].mean()
print("\n1 ── OFFENSIVE PASS RATE BY SITUATION  (% of snaps that are passes)")
print(f"   {'team':6s}" + "".join(f"{b:>12s}" for b in SIT))
print(f"   {'LEAGUE':6s}" + "".join(f"{lg[b]:11.1f}%" for b in SIT))
for t in TEAMS:
    if t in O.index:
        print(f"   {t:6s}" + "".join(f"{O.loc[t, b]:11.1f}%" for b in SIT))
for t in TEAMS:
    if t not in O.index:
        continue
    d20, d10 = O.loc[t, "Inside20"] - lg["Inside20"], O.loc[t, "Inside10"] - lg["Inside10"]
    tag = "PASS-HEAVY" if d10 > 4 else "RUN-HEAVY" if d10 < -4 else "neutral"
    print(f"   -> {t}: inside-20 {d20:+.1f} vs league, inside-10 {d10:+.1f}  [{tag} near the goal line]")

# ============================================================ 2. RED-ZONE TARGETS BY ALIGNMENT
al = pd.read_parquet(FP + "split_recv_adv_x_alignment.parquet")
al["tm"] = tk(al)
al = al[al.__season.isin(SEASONS)]
al["fam"] = al.playPlayerAlignmentFamily
al["rz"] = num(al.playerStatsInside20ReceivingTargetsTotal)
al["tg"] = num(al.playerStatsReceivingTargetsTotal)
piv = al.groupby(["tm", "fam"]).agg(rz=("rz", "sum"), tg=("tg", "sum")).reset_index()
tot = piv.groupby("tm").rz.sum().rename("tot")
piv = piv.merge(tot, on="tm")
piv["share"] = 100 * piv.rz / piv.tot.replace(0, np.nan)
lgsh = piv.groupby("fam").apply(lambda x: 100 * x.rz.sum() / piv.rz.sum())
fams = [f for f in lgsh.sort_values(ascending=False).index if pd.notna(f)]
print("\n2 ── RED-ZONE TARGET SHARE BY ALIGNMENT  (share of a team's inside-20 targets)")
print(f"   {'team':6s}" + "".join(f"{f[:10]:>12s}" for f in fams))
print(f"   {'LEAGUE':6s}" + "".join(f"{lgsh[f]:11.1f}%" for f in fams))
for t in TEAMS:
    s = piv[piv.tm == t].set_index("fam")
    if not len(s):
        continue
    print(f"   {t:6s}" + "".join(f"{s.share.get(f, np.nan):11.1f}%" for f in fams))
    best = [(f, s.share.get(f, np.nan) - lgsh[f]) for f in fams if pd.notna(s.share.get(f, np.nan))]
    best.sort(key=lambda x: -x[1])
    if best:
        print(f"   -> {t} leans to {best[0][0]} in the red zone ({best[0][1]:+.1f} vs league)"
              f"{'; away from ' + best[-1][0] + f' ({best[-1][1]:+.1f})' if len(best) > 1 else ''}")

# ============================================================ 3+4. DEFENSE: separation allowed
sc = pd.read_parquet(FLAT + "player_receiving-separation-by-coverage.parquet")
sa = pd.read_parquet(FLAT + "player_receiving-separation-by-alignment.parquet")
for d in (sc, sa):
    d["opp"] = d.opponentAbbreviation.map(lambda a: AB_NV.get(a, a))
sc = sc[sc.__season.isin(SEASONS)]
sa = sa[sa.__season.isin(SEASONS)]


def def_allowed(df, buckets, label, stat="playerStatsReceivingSeparationScorePercentage",
                nstat="playerStatsReceivingSeparationRoutesTotal"):
    out = []
    for t, gg in df.groupby("opp"):
        r = {"opp": t}
        for b in buckets:
            c, n = f"{b}__{stat}", f"{b}__{nstat}"
            if c in gg.columns:
                w, N = (num(gg[c]) * num(gg[n])).sum(), num(gg[n]).sum()
                r[b] = 100 * w / N if N else np.nan
                r[b + "_n"] = N
        out.append(r)
    R = pd.DataFrame(out).set_index("opp")
    lgv = {b: 100 * (num(df[f"{b}__{stat}"]) * num(df[f"{b}__{nstat}"])).sum() / num(df[f"{b}__{nstat}"]).sum()
           for b in buckets if f"{b}__{stat}" in df.columns}
    print(f"\n{label}")
    bl = [b for b in buckets if b in R.columns]
    print(f"   {'defense':8s}" + "".join(f"{b[:11]:>13s}" for b in bl))
    print(f"   {'LEAGUE':8s}" + "".join(f"{lgv[b]:12.2f}%" for b in bl))
    for t in TEAMS:
        if t in R.index:
            print(f"   {t:8s}" + "".join(f"{R.loc[t, b]:12.2f}%" for b in bl)
                  + "   (routes: " + "/".join(f"{R.loc[t, b+'_n']:.0f}" for b in bl) + ")")
    for t in TEAMS:
        if t not in R.index:
            continue
        diffs = [(b, R.loc[t, b] - lgv[b]) for b in bl if pd.notna(R.loc[t, b])]
        diffs.sort(key=lambda x: -x[1])
        if diffs:
            print(f"   -> {t} allows MOST separation on {diffs[0][0]} ({diffs[0][1]:+.2f} vs lg), "
                  f"LEAST on {diffs[-1][0]} ({diffs[-1][1]:+.2f})")
    return R


def_allowed(sc, ["RedZone", "Man", "Zone", "Cover2", "Cover3", "Cover4"],
            "3 ── SEPARATION ALLOWED BY THE DEFENSE, BY SITUATION/COVERAGE  (higher = receivers get open)")
def_allowed(sa, ["Slot", "Wide", "Inline", "Backfield"],
            "4 ── SEPARATION ALLOWED BY THE DEFENSE, BY RECEIVER ALIGNMENT")

# ============================================================ 6/7. PLAYER SPLITS
def player_block(names, title, path, buckets, minr=15):
    d = pd.read_parquet(FLAT + path)
    d = d[d.__season.isin(SEASONS)]
    d["nm"] = d.playerFirstName + " " + d.playerLastName
    print(f"\n{title}")
    bl = [b for b in buckets if f"{b}__playerStatsReceivingSeparationScorePercentage" in d.columns]
    # league baselines
    lgv, lgt = {}, {}
    for b in bl:
        c, n = f"{b}__playerStatsReceivingSeparationScorePercentage", f"{b}__playerStatsReceivingSeparationRoutesTotal"
        tp = f"{b}__playerStatsReceivingTargetsPerRoute"
        N = num(d[n]).sum()
        lgv[b] = 100 * (num(d[c]) * num(d[n])).sum() / N if N else np.nan
        lgt[b] = (num(d[tp]) * num(d[n])).sum() / N if N else np.nan
    print(f"   {'':22s}" + "".join(f"{b.replace('Route','').replace('Breaks','')[:9]:>11s}" for b in bl))
    print(f"   {'LEAGUE sep%':22s}" + "".join(f"{lgv[b]:10.1f}%" for b in bl))
    print(f"   {'LEAGUE tgt/route':22s}" + "".join(f"{lgt[b]:10.3f} " for b in bl))
    for nm in names:
        g = d[d.nm == nm]
        if not len(g):
            continue
        sep, tpr, rr = [], [], []
        for b in bl:
            c, n = f"{b}__playerStatsReceivingSeparationScorePercentage", f"{b}__playerStatsReceivingSeparationRoutesTotal"
            tp = f"{b}__playerStatsReceivingTargetsPerRoute"
            N = num(g[n]).sum()
            sep.append(100 * (num(g[c]) * num(g[n])).sum() / N if N >= minr else np.nan)
            tpr.append((num(g[tp]) * num(g[n])).sum() / N if N >= minr else np.nan)
            rr.append(N)
        print(f"   {nm[:22]:22s}" + "".join(f"{v:10.1f}%" if pd.notna(v) else f"{'--':>11s}" for v in sep))
        print(f"   {'  tgt/route':22s}" + "".join(f"{v:10.3f} " if pd.notna(v) else f"{'--':>11s}" for v in tpr))
        print(f"   {'  routes':22s}" + "".join(f"{v:10.0f} " for v in rr))


BUF_P = ["Dalton Kincaid", "DJ Moore", "Khalil Shakir", "Keon Coleman", "Dawson Knox", "James Cook"]
DET_P = ["Amon-Ra St. Brown", "Jameson Williams", "Sam LaPorta", "Jahmyr Gibbs", "Isaac TeSlaa"]
# roster guard: keep a name only if his MOST RECENT game row is with that team (Montgomery incident)
_ra = pd.read_parquet(FP + "player_receiving-advanced.parquet")
_ra["nm"] = _ra.playerFirstName + " " + _ra.playerLastName
_last = _ra.sort_values(["__season", "__week"]).groupby("nm").tail(1).set_index("nm").teamAbbreviation.map(lambda a: AB_NV.get(a, a))
BUF_P = [p for p in BUF_P if _last.get(p) == "BUF"]
DET_P = [p for p in DET_P if _last.get(p) == "DET"]
ALLP = (DET_P if AWAY == "DET" else BUF_P) + (BUF_P if HOME == "BUF" else DET_P)
player_block(ALLP, "6 ── PLAYER SEPARATION BY ALIGNMENT  (where he lines up)",
             "player_receiving-separation-by-alignment.parquet", ["Slot", "Wide", "Inline", "Backfield"])
player_block(ALLP, "7 ── PLAYER SEPARATION BY ROUTE TYPE  (which routes he wins on / gets fed on)",
             "player_receiving-separation-by-routes.parquet",
             ["RouteSlant", "RouteOut", "RouteInDig", "RouteCrossers", "RouteGo", "RoutePost",
              "RouteCorner", "RouteFlat", "RouteScreens", "RouteHitch"])
player_block(ALLP, "7b ── PLAYER SEPARATION BY BREAK TYPE",
             "player_receiving-separation-by-breaks.parquet",
             ["BreaksVertical", "BreaksHorizontal", "BreaksShallowUnderneath", "BreaksStatic"])

# ============================================================ 8. QB BY THROW DEPTH
pd_ = pd.read_parquet(FLAT + "player_passing-depth.parquet")
pd_ = pd_[pd_.__season.isin(SEASONS)]
pd_["nm"] = pd_.playerFirstName + " " + pd_.playerLastName
DB = ["Under0", "0To9", "10To19", "Over20"]
print("\n8 ── QUARTERBACK BY THROW DEPTH")
lgr = {}
for b in DB:
    a, t = f"{b}__playerStatsPassingAttemptsTotal", f"{b}__playerStatsPassingTouchdownsTotal"
    rr = f"{b}__playerStatsPassingPasserRating"
    if a in pd_.columns:
        A = num(pd_[a]).sum()
        lgr[b] = (A, 100 * num(pd_[t]).sum() / A if A else np.nan,
                  (num(pd_[rr]) * num(pd_[a])).sum() / A if A else np.nan)
print(f"   {'':20s}" + "".join(f"{b:>22s}" for b in DB))
print(f"   {'LEAGUE td%/rating':20s}" + "".join(f"{lgr[b][1]:12.1f}% {lgr[b][2]:8.1f}" for b in DB))
for nm in ("Josh Allen", "Jared Goff"):
    g = pd_[pd_.nm == nm]
    if not len(g):
        continue
    line, share = "", []
    for b in DB:
        a, t = f"{b}__playerStatsPassingAttemptsTotal", f"{b}__playerStatsPassingTouchdownsTotal"
        rr = f"{b}__playerStatsPassingPasserRating"
        A = num(g[a]).sum()
        td = 100 * num(g[t]).sum() / A if A else np.nan
        rt = (num(g[rr]) * num(g[a])).sum() / A if A else np.nan
        line += f"{td:12.1f}% {rt:8.1f}"
        share.append(A)
    print(f"   {nm[:20]:20s}" + line)
    tot = sum(share)
    print(f"   {'  attempt mix':20s}" + "".join(f"{100*s/tot:12.1f}% {'':8s}" for s in share))
print("\n" + "=" * 104)
