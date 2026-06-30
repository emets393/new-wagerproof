"""Shared trend builders for the CFB Outliers page (mirror of the NFL data layer).

Two consumers:
  - gen_cfb_team_trends.py  -> season-scoped splits (its own game_log) + cross-season matchups
  - gen_cfb_coach_trends.py -> cross-season career logs (splits + matchups)

The cross-season per-team-game log is the single primitive both share. FG markets
(spread/moneyline/total) come from model_games.parquet (2016-2025, no 2020 — the model
frame, already in the grading-correct convention: spread_close negative = home favored).
team_total + 1H markets come from the event-odds archive (2023-2025 only), exactly like
gen_cfb_team_trends builds the current-season log.

The jsonb shapes match NFL byte-for-byte so one Swift code path renders both sports.
"""
import os
import pandas as pd

_DIR = os.path.dirname(__file__)

# Seasons the model frame covers (2020 absent — COVID). Used to locate per-year CFBD files.
SEASONS = [2016, 2017, 2018, 2019, 2021, 2022, 2023, 2024, 2025]
EVENT_ODDS_SEASONS = [2023, 2024, 2025]   # team_total + 1H odds archive only goes back this far

# market -> (game_log field, hit-letter, loss-letter). hit = cover / win / over.
MKT = {"spread": ("ats", "W", "L"), "moneyline": ("su", "W", "L"),
       "total": ("ou", "O", "U"), "team_total": ("tt", "O", "U"),
       "h1_spread": ("h1_ats", "W", "L"), "h1_total": ("h1_ou", "O", "U")}
FG_MKT = {k: MKT[k] for k in ("spread", "moneyline", "total")}   # cross-season-complete markets


def wl(margin):
    """Result letter from a signed margin: positive=W, negative=L, 0=P (cover/SU markets)."""
    return "W" if margin > 0 else ("L" if margin < 0 else "P")


def ou_l(margin):
    """Over/under letter from (points - line): positive=O, negative=U, 0=P."""
    return "O" if margin > 0 else ("U" if margin < 0 else "P")


def pct01(h, n):
    """Hit rate in 0-1 (NOT the legacy CFB pct() x100). None when no decided games."""
    return round(h / n, 3) if n else None


def _dim_ok(g, dim, sk):
    """Does game `g` belong to dimension `dim`? `sk` = the spread key in g (team's line, neg=fav)."""
    sp = g.get(sk)
    return {
        "overall": True,
        "home": g["is_home"], "away": not g["is_home"],
        "favorite": sp is not None and sp < 0,
        "underdog": sp is not None and sp > 0,
        "division": g.get("is_div", False), "non_division": not g.get("is_div", False),
        "primetime": g.get("is_primetime", False), "regular": not g.get("is_primetime", False),
    }[dim]


def compute_splits(gl, dims, windows, sk="spread", markets=MKT):
    """game_log (NEWEST-FIRST) -> {market: {dim: {window: {h,l,p,n,pct}}}}.
    Per market drop games missing that line, take the last `window` -> 'h of n'."""
    out = {}
    for mkt, (fld, hit, loss) in markets.items():
        out[mkt] = {}
        for dim in dims:
            games = [g for g in gl if _dim_ok(g, dim, sk) and g.get(fld) is not None]
            out[mkt][dim] = {}
            for w in windows:
                win = games[:w]
                h = sum(1 for g in win if g[fld] == hit)
                l = sum(1 for g in win if g[fld] == loss)
                p = sum(1 for g in win if g[fld] == "P")
                out[mkt][dim][str(w)] = {"h": h, "l": l, "p": p, "n": h + l, "pct": pct01(h, h + l)}
    return out


def compute_matchups(gl, markets=FG_MKT, cap=None):
    """gl NEWEST-FIRST -> {opp: {meetings, <market>:{h,n,pct}}}. cap = last N meetings (None=career)."""
    by_opp = {}
    for g in gl:
        by_opp.setdefault(g["opp"], []).append(g)
    out = {}
    for opp, games in by_opp.items():
        gms = games[:cap] if cap else games
        rec = {"meetings": len(gms)}
        for mkt, (fld, hit, loss) in markets.items():
            dec = [g for g in gms if g.get(fld) in (hit, loss)]
            h = sum(1 for g in dec if g[fld] == hit)
            rec[mkt] = {"h": h, "n": len(dec), "pct": pct01(h, len(dec))}
        out[opp] = rec
    return out


# ---- cross-season per-team-game log (the shared primitive) -------------------------------------
_ALIAS = {"Appalachian State Mountaineers": "App State", "Hawaii Rainbow Warriors": "Hawai'i",
          "UMass Minutemen": "Massachusetts", "San Jose State Spartans": "San José State",
          "Southern Miss Golden Eagles": "Southern Miss"}


def _name_resolver(names):
    """Odds-API full name ('Florida State Seminoles') -> our CFBD short name ('Florida State')."""
    def tdb(o):
        if o in _ALIAS:
            return _ALIAS[o]
        c = [x for x in names if str(o).startswith(str(x) + " ") or o == x]
        c.sort(key=len, reverse=True)
        return c[0] if c else None
    return tdb


def _h1_scores(seasons):
    """{game_id: first-half points} for home & away from CFBD per-quarter line scores."""
    h1h, h1a = {}, {}
    for y in seasons:
        g = pd.read_parquet(os.path.join(_DIR, "data", "cfbd", f"games_{y}.parquet"))
        for r in g.itertuples():
            hs, as_ = r.homeLineScores, r.awayLineScores
            h1h[r.id] = sum(hs[:2]) if hs is not None and len(hs) >= 2 else None
            h1a[r.id] = sum(as_[:2]) if as_ is not None and len(as_) >= 2 else None
    return h1h, h1a


def _event_consensus(names):
    """Median consensus team-total + 1H spread/total lines per game (2023-2025 event-odds archive)."""
    frames = [pd.read_parquet(os.path.join(_DIR, "data", "event_odds", f"events_{y}.parquet"))
              for y in EVENT_ODDS_SEASONS]
    ev = pd.concat(frames, ignore_index=True)
    tdb = _name_resolver(names)
    tt = ev[(ev.market == "team_totals") & (ev.name == "Over")].copy()
    tt["team"] = tt.description.map(tdb)
    tt_cons = tt.dropna(subset=["team", "point"]).groupby(["game_id", "team"]).point.median().to_dict()
    hs = ev[ev.market == "spreads_h1"].copy()
    hs["nm"] = hs.name.map(tdb)
    hs = hs[hs.nm == hs.home]                       # home-perspective 1H spread
    h1s_cons = hs.groupby("game_id").point.median().to_dict()
    h1t_cons = ev[(ev.market == "totals_h1") & (ev.name == "Over")].groupby("game_id").point.median().to_dict()
    return tt_cons, h1s_cons, h1t_cons


def build_cross_season_logs(through_season, through_week):
    """{team_name: [game dicts]} NEWEST-FIRST, every completed game across all model seasons up to the
    point-in-time cutoff. Each dict mirrors the NFL coach builder's log fields so the splits/matchups
    helpers work unchanged. team_total / 1H letters are present only for 2023-2025 games (odds archive)."""
    mg = pd.read_parquet(os.path.join(_DIR, "data", "model_games.parquet"))
    mg = mg[(mg.season < through_season) | ((mg.season == through_season) & (mg.week <= through_week))]
    mg = mg[mg.homePoints.notna() & mg.awayPoints.notna()].copy()
    names = sorted(set(mg.homeTeam) | set(mg.awayTeam))
    h1h, h1a = _h1_scores(sorted(mg.season.unique()))
    tt_cons, h1s_cons, h1t_cons = _event_consensus(names)

    logs = {}
    for r in mg.sort_values(["season", "week"]).itertuples():
        gid = r.game_id
        prime = bool(r.kick_hour_et >= 19) if pd.notna(r.kick_hour_et) else False
        is_div = bool(r.conferenceGame)
        for is_home in (True, False):
            team = r.homeTeam if is_home else r.awayTeam
            opp = r.awayTeam if is_home else r.homeTeam
            pf = r.homePoints if is_home else r.awayPoints
            pa = r.awayPoints if is_home else r.homePoints
            marg = pf - pa
            tsp = r.spread_close if is_home else -r.spread_close       # team's spread, neg = favored
            ats = wl(marg + tsp) if pd.notna(tsp) else None
            ouv = (ou_l(r.actual_total - r.total_close)
                   if pd.notna(r.total_close) and pd.notna(r.actual_total) else None)
            ttl = tt_cons.get((gid, team))
            tt = ou_l(pf - ttl) if ttl is not None else None
            h1f = (h1h if is_home else h1a).get(gid)
            h1ag = (h1a if is_home else h1h).get(gid)
            h1sp, h1tot = h1s_cons.get(gid), h1t_cons.get(gid)
            h1_ats = h1_ou = None
            if h1f is not None and h1ag is not None:
                if h1sp is not None:
                    h1_ats = wl((h1f - h1ag) + (h1sp if is_home else -h1sp))
                if h1tot is not None:
                    h1_ou = ou_l((h1f + h1ag) - h1tot)
            logs.setdefault(team, []).append(dict(
                season=int(r.season), week=int(r.week), date=str(r.date),
                team=team, opp=opp, is_home=bool(is_home), is_div=is_div, is_primetime=prime,
                team_spread=round(float(tsp), 1) if pd.notna(tsp) else None,
                su=wl(marg), ats=ats, ou=ouv, tt=tt, h1_ats=h1_ats, h1_ou=h1_ou))
    for t in logs:
        logs[t].reverse()                                              # newest-first
    return logs


def head_coach_map():
    """{(school, season): head coach}. CFBD lists every coach who worked a (school, season); we take the
    one with the most decisions (wins+losses) as the season's head coach (handles mid-season changes)."""
    c = pd.read_parquet(os.path.join(_DIR, "data", "cfbd", "coaches.parquet"))
    c = c.assign(dec=c.wins.fillna(0) + c.losses.fillna(0))
    c = c.sort_values(["school", "season", "dec"], ascending=[True, True, False])
    primary = c.drop_duplicates(["school", "season"])
    return {(r.school, int(r.season)): r.coach for r in primary.itertuples()}
