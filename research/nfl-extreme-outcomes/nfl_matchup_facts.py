#!/usr/bin/env python3
"""FEATURED MATCHUPS for the NFL regression report (owner spec 2026-09-18).
For every unplayed game this week: cross the Fantasy Points / charting matchup facts (passing-game
shift by coverage look, trenches, QB vs this coverage mix, run game by box, receiver wins, QB
familiarity with this defense's style) with our internal data (model pick + confidence, active
signals, weather, assigned referee trend, Out/Doubtful injuries). Score each game by how many
INDEPENDENT things are telling, keep the top MAX_GAMES, and write one deterministic fact sheet per
game to nfl_matchup_facts. gen_nfl_regression_report.py turns those rows into 'matchups' storylines
and the narrative LLM writes the prose from the facts only. NO PICKS in the body — it says what the
model shows and where the matchup data agrees or disagrees with it.
Usage: nfl_matchup_facts.py [season week]   (env NFL_SEASON/NFL_WEEK also honored)
Data: data/fpdata/*, data/pbp_cache/{pbp_,_pbp}<season>.parquet (refresh_pbp_current.py),
      data/ftn_charting_<season>.parquet (downloaded from nflverse if missing), participation if present."""
import glob, json, os, sys, datetime as dt, numpy as np, pandas as pd, requests, warnings
warnings.filterwarnings("ignore")
HERE = os.path.dirname(os.path.abspath(__file__)); os.chdir(HERE)
sys.path.insert(0, os.path.dirname(HERE)); import football_report_lib as lib
FP = "data/fpdata/"; num = lambda s: pd.to_numeric(s, errors="coerce"); MAX_GAMES = 4
NICK = {"Cardinals":"ARI","Falcons":"ATL","Ravens":"BAL","Bills":"BUF","Panthers":"CAR","Bears":"CHI","Bengals":"CIN","Browns":"CLE","Cowboys":"DAL","Broncos":"DEN","Lions":"DET","Packers":"GB","Texans":"HOU","Colts":"IND","Jaguars":"JAX","Chiefs":"KC","Rams":"LA","Chargers":"LAC","Raiders":"LV","Dolphins":"MIA","Vikings":"MIN","Patriots":"NE","Saints":"NO","Giants":"NYG","Jets":"NYJ","Eagles":"PHI","Steelers":"PIT","Seahawks":"SEA","49ers":"SF","Buccaneers":"TB","Titans":"TEN","Commanders":"WAS"}
AB = {"ARZ":"ARI","BLT":"BAL","CLV":"CLE","HST":"HOU","LAR":"LA"}
def tk(d):
    s = d.teamAbbreviation if "teamAbbreviation" in d.columns and d.teamAbbreviation.notna().any() else d.teamNickname.map(NICK); return s.map(lambda a: AB.get(a, a))
def load(t, flat=False, seasons=None):
    d = pd.read_parquet(FP + ("flat/" if flat else "") + t + ".parquet"); d = d[d.__season.isin(seasons)] if seasons else d; d = d.copy(); d["team"] = tk(d)
    if "opponentAbbreviation" in d.columns: d["opp"] = d.opponentAbbreviation.map(lambda a: AB.get(a, a))
    if "playerFirstName" in d.columns: d["nm"] = d.playerFirstName.astype(str) + " " + d.playerLastName.astype(str)
    return d
def wavg(df, val, wt):
    v, w = num(df[val]), num(df[wt]); ok = v.notna() & w.notna() & (w > 0); return float((v[ok] * w[ok]).sum() / w[ok].sum()) if w[ok].sum() > 0 else np.nan
env = lib.load_env(); H = lib.hdr(env)
def fetch(table, params):
    j = requests.get(f"{lib.SUPA}/{table}?{params}", headers=H, timeout=60).json(); return j if isinstance(j, list) else []
if len(sys.argv) >= 3: SEASON, WEEK = int(sys.argv[1]), int(sys.argv[2])
elif os.environ.get("NFL_SEASON"): SEASON, WEEK = int(os.environ["NFL_SEASON"]), int(os.environ["NFL_WEEK"])
else:
    a = fetch("nfl_slate_games", "select=season,week&order=season.desc,week.desc&limit=1"); SEASON, WEEK = a[0]["season"], a[0]["week"]
SEASONS = [SEASON - 1, SEASON]
# ---------------------------------------------------------------- per-play frame (prior season + this season)
def ensure_ftn(season):
    p = f"data/ftn_charting_{season}.parquet"
    if not os.path.exists(p):
        try:
            r = requests.get(f"https://github.com/nflverse/nflverse-data/releases/download/ftn_charting/ftn_charting_{season}.parquet", timeout=120); r.raise_for_status(); open(p, "wb").write(r.content)
        except Exception as e: print(f"[ftn] {season} unavailable ({e})")
    return p if os.path.exists(p) else None
COLS = ["game_id","play_id","season","week","posteam","defteam","qb_dropback","qb_scramble","rush","pass","epa","passer_player_name","rusher_player_name"]
pbp_files = [f for s in SEASONS for f in (f"data/pbp_cache/pbp_{s}.parquet", f"data/pbp_cache/_pbp{s}.parquet") if os.path.exists(f)]
pbp = pd.concat([pd.read_parquet(f, columns=COLS) for f in pbp_files], ignore_index=True).drop_duplicates(["game_id","play_id"]); pbp = pbp[pbp.season.isin(SEASONS) & pbp.posteam.notna()]
pp = []
for s in SEASONS:
    f = f"data/pbp_participation_{s}.parquet"
    if not os.path.exists(f):   # nflverse publishes participation with a lag (2026 absent) — fetch what exists, skip the rest
        try:
            r = requests.get(f"https://github.com/nflverse/nflverse-data/releases/download/pbp_participation/pbp_participation_{s}.parquet", timeout=120)
            if r.status_code == 200 and len(r.content) > 10000: open(f, "wb").write(r.content)
        except Exception as e: print(f"[participation] {s} unavailable ({e})")
    if os.path.exists(f):
        try: pp.append(pd.read_parquet(f, columns=["nflverse_game_id","play_id","defenders_in_box","number_of_pass_rushers","was_pressure","defense_man_zone_type","defense_coverage_type"]))
        except Exception: pass
par = pd.concat(pp, ignore_index=True).rename(columns={"nflverse_game_id":"game_id"}).drop_duplicates(["game_id","play_id"]) if pp else pd.DataFrame(columns=["game_id","play_id","defenders_in_box","number_of_pass_rushers","was_pressure","defense_man_zone_type","defense_coverage_type"])
ft = [pd.read_parquet(p) for p in (ensure_ftn(s) for s in SEASONS) if p]
ftn = pd.concat(ft, ignore_index=True) if ft else pd.DataFrame(columns=["game_id","play_id","n_blitzers","n_pass_rushers","n_defense_box","is_play_action"])
for a, b in (("nflverse_game_id","game_id"),("nflverse_play_id","play_id")):
    if a in ftn.columns: ftn[b] = ftn[b].fillna(ftn[a]) if b in ftn.columns else ftn[a]; ftn = ftn.drop(columns=a)
ftn["play_id"] = num(ftn.play_id); ftn = ftn[["game_id","play_id","n_blitzers","n_pass_rushers","n_defense_box","is_play_action"]].drop_duplicates(["game_id","play_id"])
d = pbp.merge(par, on=["game_id","play_id"], how="left").merge(ftn, on=["game_id","play_id"], how="left")
d["box"] = num(d.n_defense_box).fillna(num(d.defenders_in_box)); d["cov"] = d.defense_coverage_type
d["mz"] = d.defense_man_zone_type.map({"MAN_COVERAGE":"man","ZONE_COVERAGE":"zone"})
d["shell"] = np.where(d["cov"].isin(["COVER_2","COVER_4","COVER_6","2_MAN"]), "two-high", np.where(d["cov"].isin(["COVER_0","COVER_1","COVER_3"]), "single-high", None))
d["blitz_l"] = np.where(d.n_blitzers.isna(), None, np.where(num(d.n_blitzers) >= 1, "blitzed", "not blitzed"))
d["rush_l"] = pd.cut(num(d.n_pass_rushers), [0,3,4,99], labels=["<=3 rushers","4 rushers","5+ rushers"]).astype(object)
d["pa_l"] = np.where(d.is_play_action.isna(), None, np.where(d.is_play_action == True, "play action", "no play action"))
db = d[d.qb_dropback == 1].copy(); db["box_l"] = pd.cut(db.box, [0,6,7,99], labels=["<=6 box","7 box","8+ box"]).astype(object)
ru = d[(d.rush == 1) & (d.qb_scramble != 1)].copy(); ru["box_l"] = pd.cut(ru.box, [0,5,6,7,99], labels=["<=5 box","6 box","7 box","8+ box"]).astype(object)
DIMS = [("cov", ["COVER_0","COVER_1","COVER_3","COVER_2","2_MAN","COVER_4","COVER_6"]), ("mz", ["man","zone"]), ("shell", ["single-high","two-high"]), ("blitz_l", ["blitzed","not blitzed"]), ("rush_l", ["<=3 rushers","4 rushers","5+ rushers"]), ("box_l", ["<=6 box","7 box","8+ box"]), ("pa_l", ["play action","no play action"])]
LG_PRESS = float(db.was_pressure.mean()) if "was_pressure" in db.columns and db.was_pressure.notna().any() else np.nan
# ---------------------------------------------------------------- matchup computations (cross_dossier logic, returning data)
def passing_shift(O, D):
    o, dd = db[db.posteam == O], db[db.defteam == D]
    if len(o) < 100 or len(dd) < 100: return None
    ob, dbase = o.epa.mean(), dd.epa.mean(); tot, wsum, cells = 0.0, 0.0, []
    for key, levels in DIMS:
        dshare = dd[key].value_counts(normalize=True)
        for lv in levels:
            a, b = o[o[key] == lv], dd[dd[key] == lv]
            if len(a) < 20 or len(b) < 20: continue
            st = (a.epa.mean() - ob) + (b.epa.mean() - dbase); w = float(dshare.get(lv, 0))
            if key in ("cov","mz","shell","blitz_l","rush_l","box_l"): tot += st * w; wsum += w
            cells.append((str(lv), st, w, float(a.epa.mean() - ob), float(b.epa.mean() - dbase)))
    shift = tot / (wsum / 6 if wsum else 1); cells.sort(key=lambda c: -abs(c[1] * c[2]))
    return dict(shift=round(shift, 3), o_base=round(ob, 3), d_base=round(dbase, 3), top=[dict(look=c[0], stacked=round(c[1], 3), d_share=round(c[2], 2), o_vs_own=round(c[3], 3), d_vs_own=round(c[4], 3)) for c in cells[:3]])
def run_game(O, D):
    o, dd = ru[ru.posteam == O], ru[ru.defteam == D]
    if len(o) < 60 or len(dd) < 60: return None
    ob, dbase = o.epa.mean(), dd.epa.mean(); dshare = dd.box_l.value_counts(normalize=True); rows, tot = [], 0.0
    for lv in ["<=5 box","6 box","7 box","8+ box"]:
        a, b = o[o.box_l == lv], dd[dd.box_l == lv]
        if len(a) < 20 or len(b) < 20: continue
        st = (a.epa.mean() - ob) + (b.epa.mean() - dbase); w = float(dshare.get(lv, 0)); tot += st * w; rows.append(dict(box=lv, d_share=round(w, 2), stacked=round(st, 3)))
    return dict(shift=round(tot, 3), o_base=round(ob, 3), d_base=round(dbase, 3), cells=rows)
def trenches(O, D):
    o, dd = db[db.posteam == O], db[db.defteam == D]
    if "was_pressure" not in db.columns or o.was_pressure.notna().sum() < 100 or dd.was_pressure.notna().sum() < 100: return None
    return dict(o_allowed=round(float(o.was_pressure.mean()), 3), o_allowed_5plus=round(float(o[o.rush_l == "5+ rushers"].was_pressure.mean()), 3) if (o.rush_l == "5+ rushers").sum() >= 20 else None,
                d_generated=round(float(dd.was_pressure.mean()), 3), d_5plus_rate=round(float((dd.rush_l == "5+ rushers").mean()), 3), d_blitz_rate=round(float((dd.blitz_l == "blitzed").mean()), 3) if dd.blitz_l.notna().any() else None, league=round(LG_PRESS, 3))
QP = load("passingAdvanced__player", seasons=SEASONS); QP["db"] = num(QP.playerStatsPassingDropbacksTotal)
QCM = load("qbCoverageMatchup__player", seasons=SEASONS); QCM = QCM[num(QCM.playerStatsPassingDropbacksTotal) >= 15]
CVO = load("coverageMatrix__opponent", seasons=SEASONS)
def qb_vs_mix(O, D):
    q = QP[(QP.team == O) & (QP.db >= 10)].sort_values(["__season","__week"])
    if not len(q): return None
    starter = q.iloc[-1].nm; Qc = QCM[QCM.nm == starter]; dd = CVO[CVO.team == D]
    if not len(Qc) or not len(dd): return None
    base = num(Qc.playerStatsFantasyPointsPpr).sum() / max(num(Qc.playerStatsPassingDropbacksTotal).sum(), 1); exp_, wsum, rows = 0.0, 0.0, []
    for s in ("Man","Cover2","Cover3","Cover4","Cover6"):
        f, dcol = f"playerStatsCoverageScheme{s}FantasyPointsPprTotal", f"playerStatsCoverageScheme{s}PassingDropbacksTotal"
        n = num(Qc[dcol]).sum(); v = num(Qc[f]).sum() / max(n, 1); lg = num(QCM[f]).sum() / max(num(QCM[dcol]).sum(), 1)
        sh = wavg(dd, f"opponentStatsCoverageScheme{s}PassingDropbacksPercentage", "opponentStatsPassingDropbacksTotal")
        if np.isnan(sh): continue
        exp_ += v * sh; wsum += sh; rows.append(dict(coverage=s, qb=round(v, 3), league=round(lg, 3), n=int(n), d_share=round(sh, 2)))
    if not wsum: return None
    e = exp_ / wsum; return dict(qb=starter, base=round(base, 3), expected=round(e, 3), pct=round(100 * (e / base - 1), 0) if base else None, rows=rows, d_man=round(100 * wavg(dd, "opponentStatsCoverageSchemeManPassingDropbacksPercentage", "opponentStatsPassingDropbacksTotal"), 0), d_two_high=round(100 * wavg(dd, "opponentStatsCoverageSchemeTwoHighPassingDropbacksPercentage", "opponentStatsPassingDropbacksTotal"), 0))
RV = load("player_receiving-advanced", seasons=SEASONS); RV["routes"] = num(RV.playerStatsReceivingRoutesTotal)
SEP, NRT = "playerStatsReceivingSeparationScorePercentage", "playerStatsReceivingSeparationRoutesTotal"
TABS = [("route", load("player_receiving-separation-by-routes", flat=True, seasons=SEASONS), ["RouteSlant","RouteOut","RouteInDig","RouteCrossers","RouteGo","RoutePost","RouteCorner","RouteHitch","RouteFlat"]), ("coverage", load("player_receiving-separation-by-coverage", flat=True, seasons=SEASONS), ["Man","Zone","Cover2","Cover3","Cover4"])]
LGSEP = {lab: {b: 100 * wavg(frame, f"{b}__{SEP}", f"{b}__{NRT}") for b in buckets if f"{b}__{SEP}" in frame.columns} for lab, frame, buckets in TABS}
LAST_TEAM = RV.sort_values(["__season","__week"]).groupby("nm").tail(1).set_index("nm").team
def receivers(O, D):
    recs = RV[(RV.nm.map(LAST_TEAM) == O) & RV.playerPosition.isin(["WR","TE"])].groupby("nm").routes.sum().sort_values(ascending=False); recs = recs[recs >= 100].head(3); out = []
    for nm_ in recs.index:
        cells = []
        for lab, frame, buckets in TABS:
            P = frame[frame.nm == nm_]; Dd = frame[frame.opp == D]
            for b, lg in LGSEP[lab].items():
                c, n = f"{b}__{SEP}", f"{b}__{NRT}"
                if num(P[n]).sum() < 15 or num(Dd[n]).sum() < 40: continue
                pe = 100 * wavg(P, c, n) - lg; de = 100 * wavg(Dd, c, n) - lg; cells.append((b.replace("Route",""), pe + de, pe, de))
        if not cells: continue
        cells.sort(key=lambda x: -x[1]); out.append(dict(name=nm_, best=[dict(look=b, stacked=round(t, 1), player=round(p, 1), d_allows=round(q, 1)) for b, t, p, q in cells[:2]], worst=dict(look=cells[-1][0], stacked=round(cells[-1][1], 1))))
    return out
def familiarity(O, D):
    """QB's prior dropbacks (this + last season) against defenses whose blitz / man rate is top-third; vs this defense's rate."""
    dd = db[db.defteam == D]
    if not len(dd) or dd.blitz_l.isna().all(): return None
    d_blitz = float((dd.blitz_l == "blitzed").mean()); d_man = float((dd.mz == "man").mean()) if dd.mz.notna().any() else np.nan
    q = QP[(QP.team == O) & (QP.db >= 10)].sort_values(["__season","__week"])
    if not len(q): return None
    starter = q.iloc[-1].nm; short = starter.split()[0][0] + "." + starter.split()[-1]
    mine = db[(db.posteam == O) & (db.passer_player_name.fillna(db.rusher_player_name) == short)]
    if len(mine) < 100: return None
    per_d = db.groupby("defteam").agg(blitz=("blitz_l", lambda s: (s == "blitzed").mean()), man=("mz", lambda s: (s == "man").mean()))
    hi_b, hi_m = per_d.blitz.quantile(0.67), per_d.man.quantile(0.67)
    faced = mine.merge(per_d, left_on="defteam", right_index=True, how="left")
    return dict(qb=starter, d_blitz=round(100 * d_blitz, 0), d_blitz_is_high=bool(d_blitz >= hi_b), share_vs_high_blitz=round(100 * float((faced.blitz >= hi_b).mean()), 0), d_man=round(100 * d_man, 0) if not np.isnan(d_man) else None, d_man_is_high=bool(d_man >= hi_m) if not np.isnan(d_man) else False, share_vs_high_man=round(100 * float((faced.man >= hi_m).mean()), 0), qb_epa_vs_blitz=round(float(mine[mine.blitz_l == "blitzed"].epa.mean()), 3) if (mine.blitz_l == "blitzed").sum() >= 30 else None, qb_epa_no_blitz=round(float(mine[mine.blitz_l == "not blitzed"].epa.mean()), 3) if (mine.blitz_l == "not blitzed").sum() >= 30 else None)
# ---------------------------------------------------------------- internal data
games = fetch("nfl_slate_games", f"select=game_id,home_ab,away_ab,home_team,away_team,kickoff,assigned_referee,fg_spread_open,fg_spread_close,fg_total_open,fg_total_close,fg_pred_spread,fg_pred_total,fg_spread_pick,fg_total_pick,fg_home_cover_prob,fg_spread_edge,fg_total_edge,wx_summary,wx_wind_mph,wx_temp_f,wx_precip_mm,wx_indoors,final_home&season=eq.{SEASON}&week=eq.{WEEK}")
now_iso = dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%S"); games = [g for g in games if g.get("kickoff") and str(g["kickoff"])[:19] > now_iso]
flags = fetch("nfl_slate_flags", f"select=game_id,signal_key,side,market,conviction,tier,bet_team,bet_direction&season=eq.{SEASON}&week=eq.{WEEK}")
defs = {x["signal_key"]: x for x in fetch("nfl_signal_defs", "select=signal_key,display_name,typical_hit,one_liner")}
picks = fetch("nfl_slate_picks", f"select=game_id,card_group,pick_side,pick_label,conviction,has_play,edge&season=eq.{SEASON}&week=eq.{WEEK}")
inj = fetch("nfl_injuries_raw", f"select=team,player,position,report_status&season=eq.{SEASON}&week=eq.{WEEK}")
refs = {r["referee"]: r for r in fetch("nfl_referee_trends", "select=referee,career_games,splits")}
def ref_trend(name):
    r = refs.get(name); out = []
    if not r: return out
    for market in ("total","spread"):
        try: cell = (r.get("splits") or {})[market]["overall"]["15"]; n, pct = int(cell.get("n") or 0), float(cell.get("pct") or 0)
        except (KeyError, TypeError): continue
        if n >= 12 and (pct >= 0.65 or pct <= 0.35): out.append(dict(market=market, n=n, pct=round(pct, 2), direction=("OVER" if market == "total" else "favorite covers") if pct >= 0.65 else ("UNDER" if market == "total" else "favorite fails")))
    return out
AB2 = lambda a: AB.get(a, a)
# ---------------------------------------------------------------- score + fact sheets
def sign_side(v, home, away, thr):
    return home if v > thr else (away if v < -thr else None)
rows = []
for g in games:
    gid = str(g["game_id"]); home, away = AB2(g["home_ab"]), AB2(g["away_ab"]); hn, an = g["home_team"], g["away_team"]
    F = {"away_pass": passing_shift(away, home), "home_pass": passing_shift(home, away), "away_run": run_game(away, home), "home_run": run_game(home, away),
         "away_trench": trenches(away, home), "home_trench": trenches(home, away), "away_qb": qb_vs_mix(away, home), "home_qb": qb_vs_mix(home, away),
         "away_recv": receivers(away, home), "home_recv": receivers(home, away), "away_fam": familiarity(away, home), "home_fam": familiarity(home, away)}
    tells, lean = [], {home: 0.0, away: 0.0}       # lean = which team the matchup facts favor, in EPA-shift-ish units
    for side, opp_, nm in ((away, home, an), (home, away, hn)):
        ps = F[f"{'away' if side == away else 'home'}_pass"]
        if ps and abs(ps["shift"]) >= 0.10: tells.append(("FP", f"{nm} passing game projects {ps['shift']:+.2f} points per dropback vs its norm against this coverage mix")); lean[side] += ps["shift"]
        rg = F[f"{'away' if side == away else 'home'}_run"]
        if rg and abs(rg["shift"]) >= 0.06: tells.append(("FP", f"{nm} run game projects {rg['shift']:+.2f} per carry vs its norm against these boxes")); lean[side] += rg["shift"] * 0.5
        tr = F[f"{'away' if side == away else 'home'}_trench"]
        if tr and not np.isnan(LG_PRESS) and tr["o_allowed"] >= LG_PRESS + 0.04 and tr["d_generated"] >= LG_PRESS + 0.03: tells.append(("FP", f"{nm} line allows pressure {100*tr['o_allowed']:.0f}% of dropbacks against a defense that generates {100*tr['d_generated']:.0f}% (league {100*LG_PRESS:.0f}%)")); lean[side] -= 0.08
        if tr and not np.isnan(LG_PRESS) and tr["o_allowed"] <= LG_PRESS - 0.04 and tr["d_generated"] <= LG_PRESS - 0.03: tells.append(("FP", f"{nm} line allows pressure only {100*tr['o_allowed']:.0f}% against a defense that generates only {100*tr['d_generated']:.0f}%")); lean[side] += 0.05
        qm = F[f"{'away' if side == away else 'home'}_qb"]
        if qm and qm["pct"] is not None and abs(qm["pct"]) >= 15: tells.append(("FP", f"{qm['qb']} projects {qm['pct']:+.0f}% vs his own rate against this coverage mix ({opp_} plays man {qm['d_man']:.0f}%, two-high {qm['d_two_high']:.0f}%)")); lean[side] += 0.004 * qm["pct"]
        fm = F[f"{'away' if side == away else 'home'}_fam"]
        if fm and fm["d_blitz_is_high"] and fm["share_vs_high_blitz"] <= 25: tells.append(("FP", f"{fm['qb']} has faced a blitz-heavy defense on only {fm['share_vs_high_blitz']:.0f}% of his dropbacks over two seasons; {opp_} blitzes {fm['d_blitz']:.0f}%")); lean[side] -= 0.04
        if fm and fm["d_man_is_high"] and fm["share_vs_high_man"] <= 25: tells.append(("FP", f"{fm['qb']} has rarely seen a man-heavy defense ({fm['share_vs_high_man']:.0f}% of dropbacks); {opp_} plays man {fm['d_man']:.0f}%")); lean[side] -= 0.04
    # internal
    sp = next((p for p in picks if str(p["game_id"]) == gid and p["card_group"] == "spread"), None); tp = next((p for p in picks if str(p["game_id"]) == gid and p["card_group"] == "total"), None)
    model_side = None
    if sp and sp.get("has_play"): model_side = home if sp["pick_side"] == "HOME" else away; tells.append(("INT", f"model play: {sp['pick_label']} ({sp['conviction']}), cover probability {g.get('fg_home_cover_prob')}"))
    if tp and tp.get("has_play"): tells.append(("INT", f"model total play: {tp['pick_label']} ({tp['conviction']})"))
    act = [f for f in flags if str(f["game_id"]) == gid and f.get("tier") == "active" and f.get("signal_key") != "sides_model"]
    for f in act[:4]: tells.append(("INT", f"signal {defs.get(f['signal_key'], {}).get('display_name', f['signal_key'])}: {f.get('side')} ({defs.get(f['signal_key'], {}).get('typical_hit')})"))
    wx = []
    if g.get("wx_wind_mph") and float(g["wx_wind_mph"]) >= 15: wx.append(f"wind {float(g['wx_wind_mph']):.0f} mph")
    if g.get("wx_temp_f") is not None and float(g["wx_temp_f"]) <= 32: wx.append(f"{float(g['wx_temp_f']):.0f}°F")
    if g.get("wx_precip_mm") and float(g["wx_precip_mm"]) >= 1: wx.append("precipitation")
    if wx: tells.append(("INT", "weather: " + ", ".join(wx)))
    for rt in ref_trend(g.get("assigned_referee")): tells.append(("INT", f"referee {g['assigned_referee']}: last {rt['n']} games {rt['direction']} in {100*(rt['pct'] if rt['pct'] >= .5 else 1 - rt['pct']):.0f}%"))
    outs = [i for i in inj if AB2(str(i.get("team"))) in (home, away) and str(i.get("report_status") or "").lower() in ("out","doubtful")]
    qb_out = [i for i in outs if str(i.get("position")).strip() == "QB"]; skill_out = [i for i in outs if str(i.get("position")).strip() in ("WR","TE","RB","OT","G","C","T")]
    if qb_out: tells.append(("INT", "quarterback listed " + ", ".join(f"{i['player']} ({AB2(i['team'])}) {i['report_status']}" for i in qb_out)))
    if skill_out: tells.append(("INT", "out or doubtful: " + ", ".join(f"{i['player']} ({AB2(i['team'])} {i['position']})" for i in skill_out[:5])))
    n_fp, n_int = sum(t[0] == "FP" for t in tells), sum(t[0] == "INT" for t in tells)
    fp_side = home if lean[home] - lean[away] > 0.06 else (away if lean[away] - lean[home] > 0.06 else None)
    align = "aligned" if (model_side and fp_side and model_side == fp_side) else ("tension" if (model_side and fp_side) else "no model play" if not model_side else "matchup even")
    score = n_fp + n_int + (1.5 if align == "aligned" else 0) + (0.5 if align == "tension" else 0)
    rows.append(dict(game_id=gid, matchup=f"{an} @ {hn}", home=home, away=away, hn=hn, an=an, g=g, F=F, tells=tells, n_fp=n_fp, n_int=n_int, fp_side=fp_side, model_side=model_side, align=align, score=score, sp=sp, tp=tp, wx=wx))
sel = sorted([r for r in rows if r["n_fp"] >= 2 and r["n_int"] >= 1], key=lambda r: (-r["score"], r["g"]["kickoff"]))[:MAX_GAMES]
print(f"{SEASON} week {WEEK}: {len(games)} unplayed games scored; featured {len(sel)}: " + ", ".join(f"{r['matchup']} ({r['score']:.1f}, {r['align']})" for r in sel))
def sheet(r):
    g, F, home, away, hn, an = r["g"], r["F"], r["home"], r["away"], r["hn"], r["an"]; L = []
    L.append(f"THE NUMBER. {an} @ {hn}. Spread {hn} {float(g['fg_spread_close']):+g} (opened {float(g['fg_spread_open']):+g}), total {g['fg_total_close']}. Model spread {hn} {float(g['fg_pred_spread']):+g}, model total {g['fg_pred_total']}. "
             + (f"Model play: {r['sp']['pick_label']} ({r['sp']['conviction']})." if r["model_side"] else "No model play on the spread (under the confidence floor or the two models split).")
             + (f" Total play: {r['tp']['pick_label']} ({r['tp']['conviction']})." if r["tp"] and r["tp"].get("has_play") else f" Total lean {g.get('fg_total_pick')} without a play."))
    for side, opp_, nm, key in ((away, home, an, "away"), (home, away, hn, "home")):
        ps, rg, tr, qm, fm, rc = F[f"{key}_pass"], F[f"{key}_run"], F[f"{key}_trench"], F[f"{key}_qb"], F[f"{key}_fam"], F[f"{key}_recv"]
        s = f"{nm.upper()} OFFENSE vs {opp_} DEFENSE. "
        if ps: s += f"Passing game projects {ps['shift']:+.2f} points per dropback vs its own norm against {opp_}'s coverage mix" + (" (" + "; ".join(f"{t['look']}: {opp_} shows it {100*t['d_share']:.0f}%, stacked {t['stacked']:+.2f}" for t in ps["top"][:2]) + "). " if ps["top"] else ". ")
        if qm: s += f"{qm['qb']} projects {qm['pct']:+.0f}% vs his own rate against this mix ({opp_} plays man {qm['d_man']:.0f}%, two-high {qm['d_two_high']:.0f}%). "
        if tr: s += f"Trenches: {nm} allows pressure on {100*tr['o_allowed']:.0f}% of dropbacks" + (f" ({100*tr['o_allowed_5plus']:.0f}% vs five or more rushers)" if tr.get("o_allowed_5plus") else "") + f"; {opp_} generates pressure {100*tr['d_generated']:.0f}%, sends five or more {100*tr['d_5plus_rate']:.0f}%" + (f", blitzes {100*tr['d_blitz_rate']:.0f}%" if tr.get("d_blitz_rate") is not None else "") + f" (league pressure {100*tr['league']:.0f}%). "
        if rg: s += f"Run game projects {rg['shift']:+.2f} per carry vs norm against {opp_}'s boxes" + (" (" + "; ".join(f"{c['box']} {100*c['d_share']:.0f}% of the time, stacked {c['stacked']:+.2f}" for c in rg["cells"][:3]) + "). " if rg["cells"] else ". ")
        if fm and (fm["d_blitz_is_high"] or fm["d_man_is_high"]): s += f"Familiarity: {fm['qb']} has faced blitz-heavy defenses on {fm['share_vs_high_blitz']:.0f}% of his dropbacks over two seasons and man-heavy ones on {fm['share_vs_high_man']:.0f}%; {opp_} blitzes {fm['d_blitz']:.0f}%" + (f", plays man {fm['d_man']:.0f}%" if fm.get("d_man") is not None else "") + (f"; his efficiency vs the blitz {fm['qb_epa_vs_blitz']:+.2f} vs {fm['qb_epa_no_blitz']:+.2f} without it" if fm.get("qb_epa_vs_blitz") is not None and fm.get("qb_epa_no_blitz") is not None else "") + ". "
        if rc: s += "Receivers: " + "; ".join(f"{x['name']} wins on {x['best'][0]['look']} ({x['best'][0]['stacked']:+.0f} separation vs league, {opp_} allows {x['best'][0]['d_allows']:+.0f}) and loses on {x['worst']['look']}" for x in rc[:2]) + ". "
        L.append(s)
    sit = [t[1] for t in r["tells"] if t[0] == "INT" and not t[1].startswith("model")]
    if sit: L.append("SITUATIONAL. " + " ".join(x[0].upper() + x[1:] + "." for x in sit))
    L.append({"aligned": f"WHAT LINES UP. The matchup facts lean {r['fp_side']} and the model's play is on the same side.", "tension": f"WHAT DOES NOT LINE UP. The matchup facts lean {r['fp_side']} while the model's play is on {r['model_side']}; treat it as tension, not a resolution.", "no model play": f"WHAT LINES UP. The matchup facts lean {r['fp_side'] or 'neither side'}; the model has no play here, so this is a watch, not a number.", "matchup even": "WHAT LINES UP. The matchup facts do not favor either side; the model's play stands on its own."}[r["align"]])
    return "\n".join(L)
# write: replace this week's rows
requests.delete(f"{lib.SUPA}/nfl_matchup_facts?season=eq.{SEASON}&week=eq.{WEEK}", headers=H, timeout=30)
for r in sel:
    body = sheet(r); facts = {k: v for k, v in r["F"].items()}; facts["tells"] = r["tells"]; facts["align"] = r["align"]; facts["fp_side"] = r["fp_side"]; facts["model_side"] = r["model_side"]
    row = dict(game_id=r["game_id"], season=SEASON, week=WEEK, matchup=r["matchup"], away_ab=r["away"], home_ab=r["home"], score=r["score"], direction=r["align"], facts=json.loads(json.dumps(facts, default=lambda o: None if (isinstance(o, float) and np.isnan(o)) else (float(o) if isinstance(o, (np.floating, np.integer)) else str(o)))), body=body)
    x = requests.post(f"{lib.SUPA}/nfl_matchup_facts", headers={**H, "Prefer": "resolution=merge-duplicates"}, json=row, timeout=30); print(f"  {r['matchup']}: {x.status_code} | {len(body)} chars | {r['n_fp']} matchup tells, {r['n_int']} internal, {r['align']}")
