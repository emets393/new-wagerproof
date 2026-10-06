#!/usr/bin/env python3
"""Walters' rating WITH the injury differential and the S-factors. (owner, 2026-10-06)

The bare 90/10 rating already showed the originator signature (CLV +0.53 against a +0.12
placebo, t=5.77 -- walters_vs_opener.py). The book treats two more things as part of the
number. Both are built here and each is scored SEPARATELY, so a piece that does not earn its
place can be dropped rather than carried.

  INJURY DIFFERENTIAL -- used twice, and the second use is the easy one to miss:
    * in the prediction: a team missing starters is weaker this week
    * inside TGPL: a team that played to a given score WHILE missing starters performed BETTER
      than the score says, and a rating blind to that permanently under-rates it
  S-FACTORS -- situational adjustments, each worth 0.20 points, added to the game line.

⛔ USAGE-WEIGHT THE INJURIES OR THE TERM IS NOISE. First build charged a flat 6.5 points for
any QB listed Out -- 144 of 318 such rows are BACKUPS, and the term arrived with a 3.07-point
standard deviation and made MAE worse. QB cost is now 6.5 * that QB's share of team pass
attempts, so a third-stringer costs nothing. (u_qb absent means the man has never thrown, so
zero is the true value here, not a papered-over gap -- unlike the fillna(0) trap in the
window-rot memo.)

⛔ EVERY VALUE IS PRE-REGISTERED, NOT FITTED. Position values follow football convention and
the book's ordering; S-factor signs are the book's stated direction; every S-factor is 0.20,
the book's figure. Nothing was swept against the result. The only fitted quantity is HFA,
fitted on MAE, which came out 2.0 -- the book's number.

Injury+usage data is 2018-2025, so injury variants score on that window; the rating warms from
2004. The opener/CLV test needs the odds snapshot feed, which starts 2023.
"""
import io, sys, warnings
import numpy as np, pandas as pd, requests
warnings.filterwarnings("ignore")
sys.path.insert(0, "/Users/chrishabib/Documents/new-wagerproof/research")
from point_value import edge_pct, _counts

HFA, CARRY, ALPHA, S_UNIT = 2.0, 0.75, 0.10, 0.20
NE = "nfl-extreme-outcomes"
# full-time-starter usage levels, used to scale a skill injury by how much the man actually played
FULL_ROUTE, FULL_RUSH = 0.70, 0.45
POSV = {"QB": 6.5, "RB": 1.0, "WR": 1.2, "TE": 0.6, "T": 0.8, "G": 0.6, "C": 0.7, "OL": 0.7,
        "DE": 0.9, "DT": 0.8, "NT": 0.7, "LB": 0.6, "OLB": 0.7, "ILB": 0.5, "MLB": 0.5,
        "CB": 1.0, "DB": 0.8, "S": 0.6, "SS": 0.6, "FS": 0.6, "K": 0.4, "P": 0.2,
        "FB": 0.3, "LS": 0.1}
CAP = {"QB": 1, "RB": 2, "WR": 3, "TE": 1, "K": 1, "P": 1, "C": 1, "FB": 1, "LS": 1}
STATUSW = {"Out": 1.0, "Doubtful": 0.75}
TZ = {t: 0 for t in "ATL BAL BUF CAR CIN CLE DET IND JAX MIA NE NYG NYJ PHI PIT TB WAS".split()}
TZ.update({t: 1 for t in "CHI DAL GB HOU KC MIN NO TEN".split()})
TZ.update({t: 2 for t in "DEN ARI".split()})
TZ.update({t: 3 for t in "LA LAC LV SEA SF OAK STL SD".split()})
NVMAP = {"Arizona":"ARI","Atlanta":"ATL","Baltimore":"BAL","Buffalo":"BUF","Carolina":"CAR",
    "Chicago":"CHI","Cincinnati":"CIN","Cleveland":"CLE","Dallas":"DAL","Denver":"DEN",
    "Detroit":"DET","Green Bay":"GB","Houston":"HOU","Indianapolis":"IND","Jacksonville":"JAX",
    "Kansas City":"KC","LA Chargers":"LAC","LA Rams":"LA","Las Vegas":"LV","Miami":"MIA",
    "Minnesota":"MIN","NY Giants":"NYG","NY Jets":"NYJ","New England":"NE","New Orleans":"NO",
    "Philadelphia":"PHI","Pittsburgh":"PIT","San Francisco":"SF","Seattle":"SEA",
    "Tampa Bay":"TB","Tennessee":"TEN","Washington":"WAS"}

g = pd.read_csv(io.StringIO(requests.get(
    "https://github.com/nflverse/nfldata/raw/master/data/games.csv", timeout=120).text))
g = g[(g.season >= 2004) & g.result.notna()].copy()
g["gameday_dt"] = pd.to_datetime(g.gameday, errors="coerce")
g = g.sort_values(["season", "week", "gameday_dt", "gametime"]).reset_index(drop=True)
VALS = _counts(g.result.tolist())
own_roof = (g.groupby("home_team").roof
            .agg(lambda s: s.mode().iat[0] if len(s.mode()) else "outdoors").to_dict())

# ---- usage-weighted injury cost per team-week ------------------------------------------------
inj = pd.read_parquet(f"{NE}/data/fpdata/_injury_usage_named.parquet")
inj = inj[inj.report_status.isin(STATUSW)].copy()
base_v = inj.position.map(POSV).fillna(0.5)
mult = pd.Series(1.0, index=inj.index)
isqb = inj.position.eq("QB")
mult[isqb] = inj.loc[isqb, "u_qb"].fillna(0.0).clip(0, 1)            # backups cost nothing
isrec = inj.position.isin(["WR", "TE"])
mult[isrec] = (inj.loc[isrec, "u_route"] / FULL_ROUTE).fillna(0.35).clip(0, 1.2)
isrb = inj.position.eq("RB")
mult[isrb] = (inj.loc[isrb, "u_rush"] / FULL_RUSH).fillna(0.35).clip(0, 1.2)
inj["val"] = base_v * mult * inj.report_status.map(STATUSW)
inj = inj.sort_values("val", ascending=False)
inj["rk"] = inj.groupby(["season", "week", "team", "position"]).cumcount()
inj = inj[inj.rk < inj.position.map(CAP).fillna(4)]
COST = inj.groupby(["season", "week", "team"]).val.sum().to_dict()
ic = pd.Series(list(COST.values()))
print(f"injury cost per team-week: mean {ic.mean():.2f}  p90 {ic.quantile(.9):.2f}  "
      f"max {ic.max():.2f}   (QB mult now usage-weighted)")


def s_factors(r, away_road_streak):
    """Pre-registered situational adjustments, in points ADDED TO THE HOME MARGIN."""
    s, names = 0.0, []
    if r.weekday == "Monday":
        s += S_UNIT; names.append("mnf_road")
    rd = (r.home_rest or 7) - (r.away_rest or 7)
    if abs(rd) >= 3:
        s += S_UNIT * np.sign(rd); names.append("rest_diff")
    if (r.home_rest or 7) >= 13:
        s += S_UNIT; names.append("home_off_bye")
    if (r.away_rest or 7) >= 13:
        s -= S_UNIT; names.append("away_off_bye")
    zones = TZ.get(r.away_team, 0) - TZ.get(r.home_team, 0)
    try:
        early = int(str(r.gametime).split(":")[0]) < 14
    except Exception:
        early = False
    if zones >= 2 and early:
        s += S_UNIT; names.append("west_to_east_early")
    if abs(zones) >= 2:
        s += S_UNIT * np.sign(zones); names.append("timezones")
    if away_road_streak >= 2:
        s += S_UNIT; names.append("away_3rd_road")
    if (own_roof.get(r.away_team) in ("dome", "closed") and r.roof == "outdoors"
            and pd.notna(r.temp) and r.temp < 40):
        s += S_UNIT; names.append("dome_team_cold")
    return s, names


def walk(use_tgpl_injury):
    """One walk-forward pass. Returns {(season,week,home,away): base_rating_margin}."""
    rate, seen, season, out = {}, {}, None, {}
    for r in g.itertuples():
        if r.season != season:
            rate = {k: v * CARRY for k, v in rate.items()}; season = r.season
        h, a = r.home_team, r.away_team
        rh, ra = rate.get(h, 0.0), rate.get(a, 0.0)
        if seen.get(h, 0) >= 8 and seen.get(a, 0) >= 8:
            out[(r.season, r.week, h, a)] = rh - ra + HFA
        bh = COST.get((r.season, r.week, h), 0.0) if use_tgpl_injury else 0.0
        ba = COST.get((r.season, r.week, a), 0.0) if use_tgpl_injury else 0.0
        rate[h] = (1 - ALPHA) * rh + ALPHA * (float(r.result) + ra - HFA + bh)
        rate[a] = (1 - ALPHA) * ra + ALPHA * (-float(r.result) + rh + HFA + ba)
        seen[h] = seen.get(h, 0) + 1; seen[a] = seen.get(a, 0) + 1
    return out


plain, tgpl = walk(False), walk(True)
rows, streak, season = [], {}, None
for r in g.itertuples():
    if r.season != season:
        streak = {}; season = r.season
    k = (r.season, r.week, r.home_team, r.away_team)
    ch = COST.get((r.season, r.week, r.home_team), np.nan)
    ca = COST.get((r.season, r.week, r.away_team), np.nan)
    sf, snames = s_factors(r, streak.get(r.away_team, 0))
    streak[r.away_team] = streak.get(r.away_team, 0) + 1; streak[r.home_team] = 0
    if k not in plain:
        continue
    iadj = (ca - ch) if (ch == ch and ca == ca) else np.nan
    rows.append(dict(season=r.season, week=r.week, gameday=r.gameday,
                     home=r.home_team, away=r.away_team, act=float(r.result),
                     mkt_close=float(r.spread_line) if pd.notna(r.spread_line) else np.nan,
                     V0=plain[k], V1=plain[k] + (iadj if iadj == iadj else 0.0),
                     V2=tgpl[k] + (iadj if iadj == iadj else 0.0),
                     V3=tgpl[k] + (iadj if iadj == iadj else 0.0) + sf,
                     iadj=iadj, sf=sf, sfn="|".join(snames)))
d = pd.DataFrame(rows)
ev = d[d.iadj.notna() & d.mkt_close.notna()]
print(f"\n=== MAE vs the actual margin — {len(ev)} games {int(ev.season.min())}-"
      f"{int(ev.season.max())} (injury+usage era)")
bm = (ev.mkt_close - ev.act).abs().mean()
print(f"{'variant':<42}{'MAE':>8}{'vs close':>10}")
print(f"{'closing line':<42}{bm:>8.3f}{0:>+10.3f}")
for nm, c in (("V0  bare 90/10 rating", "V0"), ("V1  + injuries in the PREDICTION", "V1"),
              ("V2  + injuries in TGPL as well", "V2"), ("V3  + S-factors", "V3")):
    m = (ev[c] - ev.act).abs().mean()
    print(f"{nm:<42}{m:>8.3f}{m-bm:>+10.3f}")
print(f"\ninjury adjustment now: mean {ev.iadj.mean():+.2f}  sd {ev.iadj.std():.2f}  "
      f"p5 {ev.iadj.quantile(.05):+.2f}  p95 {ev.iadj.quantile(.95):+.2f}  (was sd 3.07)")
print(f"S-factor total: mean {ev.sf.mean():+.2f}  sd {ev.sf.std():.2f}")

# ---- the decisive test: opener + CLV, per variant --------------------------------------------
o = pd.read_parquet(f"{NE}/data/odds_hist.parquet",
                    columns=["season","home_team","away_team","snap_ts","commence_time","spread_home"]
                    ).dropna(subset=["spread_home"])
o["home"] = o.home_team.map(NVMAP); o["away"] = o.away_team.map(NVMAP)
o = o.dropna(subset=["home","away"])
o["snap"] = pd.to_datetime(o.snap_ts, utc=True, errors="coerce")
o["date"] = pd.to_datetime(o.commence_time, utc=True, errors="coerce").dt.date
o = o.dropna(subset=["snap","date"])
K = ["season","home","away","date"]
f0, l0 = o.groupby(K).snap.transform("min"), o.groupby(K).snap.transform("max")
E, L_ = o[o.snap <= f0 + pd.Timedelta("2h")], o[o.snap >= l0 - pd.Timedelta("2h")]
L = pd.concat([E.groupby(K).spread_home.median().rename("ob"),
               L_.groupby(K).spread_home.median().rename("cb"),
               E.groupby(K).spread_home.max().rename("bh"),
               E.groupby(K).spread_home.min().rename("ba")], axis=1).reset_index()
for a_, b_ in (("ob","mkt_open"),("cb","mkt_cl"),("bh","best_home"),("ba","best_away")):
    L[b_] = -L[a_]
d["date"] = pd.to_datetime(d.gameday, errors="coerce").dt.date
m = d.merge(L, on=["season","home","away"], how="inner", suffixes=("","_l"))
m = m[(pd.to_datetime(m.date_l) - pd.to_datetime(m.date)).abs() <= pd.Timedelta("1D")]
print(f"\n=== OPENER + CLV — {len(m)} games, seasons {sorted(m.season.unique())}")
print(f"{'variant':<34}{'gate':<12}{'n':>5}{'W-L':>11}{'hit':>7}{'ROI':>8}{'CLV':>8}")
mv = m.mkt_cl - m.mkt_open
for nm, c in (("V0 bare rating","V0"), ("V1 +inj (prediction)","V1"),
              ("V2 +inj (both)","V2"), ("V3 +inj +S-factors","V3")):
    sh = m[c] > m.mkt_open
    line = np.where(sh, m.best_home, m.best_away)
    cov = np.where(sh, m.act - line, line - m.act)
    clv = np.where(sh, mv, -mv)
    pct = np.array([edge_pct(p, k_, VALS) for p, k_ in zip(m[c], m.mkt_open)])
    keep = np.abs(cov) > 1e-9
    for gate, lbl in ((0, "all"), (8, "mass>=8%"), (12, "mass>=12%")):
        s = keep & (pct >= gate)
        w = int((cov[s] > 0).sum()); l = int(s.sum()) - w
        if not s.sum(): continue
        print(f"{nm:<34}{lbl:<12}{int(s.sum()):>5}{f'{w}-{l}':>11}"
              f"{w/s.sum()*100:>6.1f}%{(w*0.909-l)/s.sum()*100:>+7.1f}%{clv[s].mean():>+8.2f}")
d.to_csv(f"{NE}/out/walters_full.csv", index=False)
print(f"\n-> {NE}/out/walters_full.csv")
