"""
Travel / time-zone / body-clock deep dive (2018-2025).
Build true venue coords (incl. London/Mexico/Munich/Frankfurt/Sao Paulo + COVID/hurricane neutral),
per-team CUMULATIVE travel (season round-trip miles, last-4 load, net tz shift), and body-clock flags
(West team in an early East game; West team night game = circadian edge). Combine with rest. Test
ATS/OU/ML per-season + permutation null + orthogonality.
"""
import os, sys
import numpy as np, pandas as pd
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from stats_helpers import wilson_ci, bet_summary, fmt
rng = np.random.default_rng(0)
DATA = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
L = print
g = pd.read_parquet(os.path.join(DATA, "games_enriched.parquet"))
tm = pd.read_parquet(os.path.join(DATA, "team_mapping.parquet"))

# ---- team home coords + clock offset from ET (ET=0, Central=-1, Mountain=-2, Pacific=-3) ----
COORD = {}
OFF = {}
nv2 = {"LAR": "LA", "LAC": "LAC"}   # map our abbrev -> nflverse where needed
for r in tm.itertuples():
    ab = r._1  # 'Team Abbrev'
    if pd.notna(r.latitude):
        COORD[ab] = (r.latitude, r.longitude)
COORD["LA"] = COORD.get("LAR", (33.953, -118.339)); COORD["OAK"] = (37.7516, -122.2005)
COORD["LV"] = COORD.get("LV", (36.0906, -115.1839)); COORD["SD"] = (32.783, -117.119); COORD["STL"] = (38.6328, -90.1885)
PAC = {"SEA", "SF", "LA", "LAR", "LAC", "LV", "OAK", "SD"}; MTN = {"DEN", "ARI"}
CEN = {"KC", "DAL", "HOU", "NO", "MIN", "GB", "CHI", "TEN", "STL"}
for ab in list(COORD):
    OFF[ab] = -3 if ab in PAC else (-2 if ab in MTN else (-1 if ab in CEN else 0))

# ---- neutral / international venue coords + offset from ET ----
INTL = {"Wembley Stadium": (51.556, -0.2796, 5), "Tottenham Stadium": (51.6043, -0.0664, 5),
        "Azteca Stadium": (19.3029, -99.1505, -1), "Allianz Arena": (48.2188, 11.6247, 6),
        "Deutsche Bank Park": (50.0686, 8.6455, 6), "Arena Corinthians": (-23.5453, -46.4742, 2),
        "Santiago Bernabeu": (40.453, -3.6883, 6), "Croke Park": (53.3607, -6.2511, 5)}
STAD2TEAM = {"State Farm Stadium": "ARI", "SoFi Stadium": "LA", "Hard Rock Stadium": "MIA",
             "Raymond James Stadium": "TB", "Mercedes-Benz Stadium": "ATL", "Mercedes-Benz Superdome": "NO",
             "Lucas Oil Stadium": "IND", "Ford Field": "DET", "Allegiant Stadium": "LV", "Levi's Stadium": "SF",
             "TIAA Bank Stadium": "JAX", "FirstEnergy Stadium": "CLE", "Acrisure Stadium": "PIT",
             "MetLife Stadium": "NYG"}


def haversine(a, b):
    (la1, lo1), (la2, lo2) = a, b
    R = 3958.8
    p1, p2 = np.radians(la1), np.radians(la2)
    dl, dn = np.radians(la2 - la1), np.radians(lo2 - lo1)
    h = np.sin(dl / 2) ** 2 + np.cos(p1) * np.cos(p2) * np.sin(dn / 2) ** 2
    return 2 * R * np.arcsin(np.sqrt(h))


def venue(r):
    if r.location == "Home":
        return COORD.get(r.home_team, COORD.get("LA")), OFF.get(r.home_team, 0)
    s = r.stadium
    if s in INTL:
        la, lo, off = INTL[s]; return (la, lo), off
    if s in STAD2TEAM:
        t = STAD2TEAM[s]; return COORD.get(t, COORD["LA"]), OFF.get(t, 0)
    return COORD.get(r.home_team, COORD["LA"]), OFF.get(r.home_team, 0)


gg = g[(g.game_type == "REG") & (g.season >= 2018) & g.home_score.notna() & g.spread_line.notna()].copy()
gg = gg.sort_values(["season", "week"]).reset_index(drop=True)


def khour(t):
    try:
        return int(str(t).split(":")[0]) + int(str(t).split(":")[1]) / 60.0
    except Exception:
        return 13.0


rows = []
for r in gg.itertuples():
    vc, voff = venue(r)
    kh_et = khour(r.gametime)
    intl = (r.location != "Home") and (r.stadium in INTL)
    for team, ishome in ((r.home_team, 1), (r.away_team, 0)):
        home = COORD.get(team, COORD["LA"]); hoff = OFF.get(team, 0)
        dist = haversine(home, vc)
        tz_delta = voff - hoff                      # + = traveled east (lose hours / body behind)
        local_kick = kh_et + voff                   # local kick hour at venue
        body_clock = local_kick - tz_delta          # hour it FEELS like to this team
        cov = (r.result > r.spread_line) if ishome else (r.result < r.spread_line) if hasattr(r, "result") else np.nan
        res = (r.home_score - r.away_score) if ishome else (r.away_score - r.home_score)
        cover = np.nan if (r.home_score - r.away_score) == r.spread_line * (1 if ishome else 1) and False else \
            ((res + (r.spread_line if ishome else -r.spread_line)) )  # placeholder; compute properly below
        rows.append(dict(season=r.season, week=r.week, gid=r.game_id, team=team, opp=(r.away_team if ishome else r.home_team),
                         is_home=ishome, dist=dist, tz_delta=tz_delta, voff=voff, hoff=hoff,
                         local_kick=local_kick, body_clock=body_clock, intl=int(intl),
                         result=(r.home_score - r.away_score), spread_line=r.spread_line,
                         total_pts=r.home_score + r.away_score, total_line=r.total_line))
t = pd.DataFrame(rows)
# proper ATS cover/over
t["team_cover"] = np.where(t.is_home == 1, np.where(t.result > t.spread_line, 1.0, np.where(t.result < t.spread_line, 0.0, np.nan)),
                           np.where(-t.result > -t.spread_line, np.nan, np.nan))
t["team_cover"] = np.where(t.is_home == 1,
                           np.where(t.result > t.spread_line, 1.0, np.where(t.result < t.spread_line, 0.0, np.nan)),
                           np.where(t.result < t.spread_line, 1.0, np.where(t.result > t.spread_line, 0.0, np.nan)))
t["over"] = np.where(t.total_pts > t.total_line, 1.0, np.where(t.total_pts < t.total_line, 0.0, np.nan))

# ---- cumulative travel (leak-safe: prior games only), per team-season ----
t = t.sort_values(["team", "season", "week"]).reset_index(drop=True)
t["roundtrip"] = 2 * t.dist
g2 = t.groupby(["team", "season"], group_keys=False)
t["cum_miles"] = g2["roundtrip"].apply(lambda s: s.shift(1).cumsum()).fillna(0)
t["miles_last4"] = g2["roundtrip"].apply(lambda s: s.shift(1).rolling(4, min_periods=1).sum()).fillna(0)
t["net_tz_last3"] = g2["tz_delta"].apply(lambda s: s.shift(1).rolling(3, min_periods=1).sum()).fillna(0)
# body-clock / circadian flags (this game)
t["west_team"] = (t.hoff <= -2).astype(int)            # Mtn/Pac home
t["traveled_east"] = (t.tz_delta >= 2).astype(int)
t["early_kick_body"] = (t.body_clock <= 10.5).astype(int)
t["west_east_early"] = ((t.west_team == 1) & (t.traveled_east == 1) & (t.early_kick_body == 1)).astype(int)
t["west_night_east"] = ((t.west_team == 1) & (t.traveled_east == 1) & (t.local_kick >= 19)).astype(int)
t["long_haul"] = (t.dist >= 2000).astype(int)
t["cross_country"] = (t.tz_delta.abs() >= 3).astype(int)
L(f"[build] team-game travel rows 2018-25: {len(t)} | intl team-games: {int(t.intl.sum())}")
L(f"  trip dist: mean={t.dist.mean():.0f}mi max={t.dist.max():.0f} | season cum_miles entering: median={t.cum_miles.median():.0f} max={t.cum_miles.max():.0f}")


def cut(label, sub, outcome="team_cover"):
    rows = []
    for s in sorted(sub.season.dropna().unique()):
        oc = sub[sub.season == s][outcome].dropna()
        rows.append(bet_summary(int((oc == 1).sum()), int(oc.isin([0, 1]).sum()), str(int(s))))
    oc = sub[outcome].dropna(); allr = bet_summary(int((oc == 1).sum()), int(oc.isin([0, 1]).sum()), "ALL")
    nyr = sum(1 for r in rows if r.get("n", 0) >= 5); beat = sum(1 for r in rows if r.get("n", 0) >= 5 and r.get("hit", 0) >= 0.524)
    L(f"  >> {label:46s} [{beat}/{nyr} szn] {fmt(allr)}")


L("\n" + "=" * 86); L("TRAVEL / BODY-CLOCK TESTS (2018-2025, per-season)"); L("=" * 86)
L("\n[A] Body clock — West team traveling East:")
cut("West team, EARLY East game: team ATS", t[t.west_east_early == 1])
cut("West team, EARLY East game: FADE (bet opp)", t[t.west_east_early == 1].assign(f=1 - t[t.west_east_early == 1].team_cover), "f")
cut("West team, EARLY East game: UNDER", t[t.west_east_early == 1].assign(u=1 - t[t.west_east_early == 1].over), "u")
cut("West team, NIGHT East game (circadian+): ATS", t[t.west_night_east == 1])

L("\n[B] Raw trip distance / cross-country:")
cut("long-haul travel (>=2000mi) team ATS", t[t.long_haul == 1])
cut("cross-country (>=3 tz) team ATS", t[t.cross_country == 1])
cut("traveled east (tz>=2) team ATS", t[(t.is_home == 0) & (t.traveled_east == 1)])

L("\n[C] CUMULATIVE season travel burden:")
hi = t.cum_miles >= t.cum_miles.quantile(0.80)
cut("high season cum-miles team ATS", t[hi])
cut("high cum-miles, wk>=10 ATS", t[hi & (t.week >= 10)])
cut("heavy last-4 miles (top quint) ATS", t[t.miles_last4 >= t.miles_last4.quantile(0.80)])
cut("heavy last-4 miles -> UNDER", t[t.miles_last4 >= t.miles_last4.quantile(0.80)].assign(u=1 - t[t.miles_last4 >= t.miles_last4.quantile(0.80)].over), "u")

L("\n[D] INTERNATIONAL games:")
cut("international game team ATS", t[t.intl == 1])
cut("international game -> UNDER", t[t.intl == 1].assign(u=1 - t[t.intl == 1].over), "u")
cut("international game -> OVER", t[t.intl == 1], "over")

L("\n[E] TRAVEL x REST (need rest): short rest + long haul")
# rest from games_enriched
rest = pd.concat([g[["season", "week", "home_team", "home_rest"]].rename(columns={"home_team": "team", "home_rest": "rest"}),
                  g[["season", "week", "away_team", "away_rest"]].rename(columns={"away_team": "team", "away_rest": "rest"})])
t = t.merge(rest, on=["season", "week", "team"], how="left")
cut("short rest (<=4) + cross-country ATS", t[(t.rest <= 4) & (t.cross_country == 1)])
cut("long rest (>=10) + long-haul ATS", t[(t.rest >= 10) & (t.long_haul == 1)])

L("\n[F] continuous correlations (orthogonal-ish: cover/over already line-relative):")
from scipy import stats as st
for col in ["dist", "tz_delta", "cum_miles", "miles_last4", "body_clock"]:
    d1 = t.dropna(subset=[col, "team_cover"]); d2 = t.dropna(subset=[col, "over"])
    L(f"  corr({col:12s}, cover)={st.pearsonr(d1[col], d1.team_cover)[0]:+.3f}  corr(.,over)={st.pearsonr(d2[col], d2.over)[0]:+.3f}")

L("\n[null] West-team-early-East ATS vs chance:")
sub = t[t.west_east_early == 1].dropna(subset=["team_cover"]); real = sub.team_cover.mean(); n = len(sub)
allc = t.dropna(subset=["team_cover"]).team_cover.values
nulls = [rng.choice(allc, n, replace=False).mean() for _ in range(3000)]
L(f"  cover={real*100:.1f}% (n={n}) p(|dev|>=real)={np.mean([abs(x-.5)>=abs(real-.5) for x in nulls]):.2f} null95=[{np.percentile(nulls,2.5)*100:.0f},{np.percentile(nulls,97.5)*100:.0f}]")
