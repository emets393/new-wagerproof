#!/usr/bin/env python3
"""PLAYER PROP NARRATIVES for the NFL regression report (owner spec 2026-09-18).
For every player with a posted line this week (nfl_slate_props: receptions, receiving yards, rush
yards/attempts, pass yards/completions/attempts), gather every independent thing the data says about
that number and which way it points — then keep only the players where several things point the same
way and write a facet-by-facet rundown. NOT a pick: the sheet says "the numbers point toward the
OVER/UNDER" and shows every number behind it.
Tells (each carries a direction):
  receivers  route stack vs this coverage (player_chain), coverage identity shift (his yards/route vs
             man/zone x how much of each this defense plays), target-share direction, primary alignment
             stack, pocket (expected pressure vs his QB's norm x how his share moves under pressure)
  QBs        QB vs this coverage mix (fantasy pts/dropback by coverage x defense's shares), trenches
             (pressure allowed vs generated), team pass-defense allowed vs league
  backs      run-concept stack (his yards/att by zone/man concept vs what this front allows), before/after
             contact profile vs the front's stuffs, run-defense success allowed vs league
  everyone   last-5 average vs the line, this-season average vs the line, defense allowed to the position
             vs league, teammate Out/Doubtful share (receivers up; QB out = receivers down), practice
             status, model game context (spread play / total lean) as script
Keep: >= 3 tells one way and net >= 2; one card per player; quotas QB 3 / WR-TE 5 / RB 3; max 10.
Writes nfl_prop_narratives (replaces the week). Runs on the fp-data-inseason job after the pull.
Usage: nfl_prop_narratives.py [season week]"""
import json, os, re, sys, datetime as dt, numpy as np, pandas as pd, requests, warnings
warnings.filterwarnings("ignore")
HERE = os.path.dirname(os.path.abspath(__file__)); os.chdir(HERE); sys.path.insert(0, os.path.dirname(HERE)); sys.path.insert(0, HERE)
import football_report_lib as lib
from fp_hist import read_fp
from player_chain import Chain
num = lambda s: pd.to_numeric(s, errors="coerce")
NICK = {"Cardinals":"ARI","Falcons":"ATL","Ravens":"BAL","Bills":"BUF","Panthers":"CAR","Bears":"CHI","Bengals":"CIN","Browns":"CLE","Cowboys":"DAL","Broncos":"DEN","Lions":"DET","Packers":"GB","Texans":"HOU","Colts":"IND","Jaguars":"JAX","Chiefs":"KC","Rams":"LA","Chargers":"LAC","Raiders":"LV","Dolphins":"MIA","Vikings":"MIN","Patriots":"NE","Saints":"NO","Giants":"NYG","Jets":"NYJ","Eagles":"PHI","Steelers":"PIT","Seahawks":"SEA","49ers":"SF","Buccaneers":"TB","Titans":"TEN","Commanders":"WAS"}
AB = {"ARZ":"ARI","BLT":"BAL","CLV":"CLE","HST":"HOU","LAR":"LA"}; ab = lambda a: AB.get(str(a), str(a))
def tk(d):
    s = d.teamAbbreviation if "teamAbbreviation" in d.columns and d.teamAbbreviation.notna().any() else d.teamNickname.map(NICK); return s.map(ab)
env = lib.load_env(); H = lib.hdr(env)
def fetch(table, params):
    j = requests.get(f"{lib.SUPA}/{table}?{params}", headers=H, timeout=60).json(); return j if isinstance(j, list) else []
if len(sys.argv) >= 3: SEASON, WEEK = int(sys.argv[1]), int(sys.argv[2])
elif os.environ.get("NFL_SEASON"): SEASON, WEEK = int(os.environ["NFL_SEASON"]), int(os.environ["NFL_WEEK"])
else:
    a = fetch("nfl_slate_games", "select=season,week&order=season.desc,week.desc&limit=1"); SEASON, WEEK = a[0]["season"], a[0]["week"]
S = [SEASON - 1, SEASON]
def load(t, flat=False):
    d = read_fp(t, flat); d = d[d.__season.isin(S)].copy(); d["team"] = tk(d)
    if "opponentAbbreviation" in d.columns: d["opp"] = d.opponentAbbreviation.map(ab)
    if "playerFirstName" in d.columns: d["nm"] = d.playerFirstName.astype(str) + " " + d.playerLastName.astype(str)
    return d[(d.__season < SEASON) | (d.__week < WEEK)]          # entering-week only
def wavg(df, val, wt):
    v, w = num(df[val]), num(df[wt]); ok = v.notna() & w.notna() & (w > 0); return float((v[ok] * w[ok]).sum() / w[ok].sum()) if w[ok].sum() > 0 else np.nan
SUF = re.compile(r"\s+(jr|sr|ii|iii|iv|v)\.?$", re.I); nn = lambda s: SUF.sub("", str(s).lower()).replace(".", "").replace("'", "").replace("-", " ").strip()
# ---------------------------------------------------------------- internal
games = {str(g["game_id"]): g for g in fetch("nfl_slate_games", f"select=game_id,home_ab,away_ab,home_team,away_team,kickoff,fg_spread_close,fg_spread_pick,fg_pred_total,fg_total_close,fg_total_pick,fg_home_cover_prob,wx_wind_mph,wx_summary&season=eq.{SEASON}&week=eq.{WEEK}")}
now_iso = dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%S"); games = {k: g for k, g in games.items() if g.get("kickoff") and str(g["kickoff"])[:19] > now_iso}
props = pd.DataFrame(fetch("nfl_slate_props", f"select=game_id,player_id,player_name,position,team,opponent,market,close_line,best_over_line,best_over_price,best_over_book_name,best_under_line,best_under_price,best_under_book_name,headshot_url,report_status,practice_status&season=eq.{SEASON}&week=eq.{WEEK}&limit=5000"))
MK = {"player_reception_yds": ("rec_yds", "receiving yards"), "player_receptions": ("rec", "receptions"), "player_rush_yds": ("rush_yds", "rushing yards"), "player_rush_attempts": ("rush_att", "rushing attempts"), "player_pass_yds": ("pass_yds", "passing yards"), "player_pass_completions": ("pass_comp", "completions"), "player_pass_attempts": ("pass_att", "pass attempts")}
props = props[props.market.isin(MK) & props.game_id.astype(str).isin(games) & props.close_line.notna()].copy()
# QB rushing / non-QB passing props: the position logic above does not apply to them
props = props[~((props.position == "QB") & props.market.isin(["player_rush_yds","player_rush_attempts"])) & ~((props.position != "QB") & props.market.str.startswith("player_pass"))].copy()
props["team"] = props.team.map(ab); props["key"] = props.player_name.map(nn)
inj = pd.DataFrame(fetch("nfl_injuries_raw", f"select=team,player,position,report_status&season=eq.{SEASON}&week=eq.{WEEK}"))
if len(inj): inj["team"] = inj.team.map(ab); inj["key"] = inj.player.map(nn); inj = inj[inj.report_status.astype(str).str.lower().isin(["out","doubtful"])]
# ---------------------------------------------------------------- FP per-game player tables (form, ids, defense allowed by position)
RV = load("player_receiving-advanced"); RV["pid"] = RV.playerPlayerId.astype(str); RV["key"] = RV.nm.map(nn)
for c, s in (("tgt","playerStatsReceivingTargetsTotal"), ("rec","playerStatsReceivingReceptionsTotal"), ("rec_yds","playerStatsReceivingYardsTotal"), ("routes","playerStatsReceivingRoutesTotal"), ("tsh","marketShareReceivingTargetsTotal")): RV[c] = num(RV[s])
RU = load("player_rushing-advanced"); RU["pid"] = RU.playerPlayerId.astype(str); RU["key"] = RU.nm.map(nn)
for c, s in (("rush_att","playerStatsRushingAttemptsTotal"), ("rush_yds","playerStatsRushingYardsTotal"), ("zatt","playerStatsRushingConceptZoneAttemptsTotal"), ("zyds","playerStatsRushingConceptZoneYardsTotal"), ("matt","playerStatsRushingConceptManAttemptsTotal"), ("myds","playerStatsRushingConceptManYardsTotal"), ("ybc","playerStatsRushingYardsBeforeContactPerAttempt"), ("yac","playerStatsRushingYardsAfterContactPerAttempt"), ("mtf","playerStatsRushingMissedTacklesForcedPerAttempt")): RU[c] = num(RU[s]) if s in RU.columns else np.nan
QB = load("passingAdvanced__player"); QB["pid"] = QB.playerPlayerId.astype(str); QB["key"] = QB.nm.map(nn)
for c, s in (("pass_att","playerStatsPassingAttemptsTotal"), ("pass_comp","playerStatsPassingCompletionsTotal"), ("pass_yds","playerStatsPassingYardsTotal"), ("db","playerStatsPassingDropbacksTotal")): QB[c] = num(QB[s])
QCM = load("qbCoverageMatchup__player"); QCM = QCM[num(QCM.playerStatsPassingDropbacksTotal) >= 15]
CVO = load("coverageMatrix__opponent"); PT, PO = load("passingAdvanced__team"), load("passingAdvanced__opponent"); RO = load("rushingAdvanced__opponent")
LG_PRESS = wavg(PT, "teamStatsPassingPressuredPercentage", "teamStatsPassingDropbacksTotal")
def form(df, key, team, stat):
    x = df[(df.key == key) & (df.team == team)].sort_values(["__season","__week"]); x = x[x[stat].notna()]
    if not len(x): return None
    this = x[x.__season == SEASON]; l5 = x.tail(5)
    return dict(l5=float(l5[stat].mean()), n5=len(l5), szn=float(this[stat].mean()) if len(this) else None, n_szn=len(this), last=float(x[stat].iloc[-1]), games=len(x))
def allowed_by_pos(df, stat, pos):
    """yards/receptions/etc. allowed to a POSITION per game: this opp vs league, entering."""
    x = df[df.playerPosition.isin(pos)].groupby(["opp","__season","__week"])[stat].sum().reset_index()
    per = x.groupby("opp")[stat].mean(); lg = x[stat].mean(); return per, lg
ALLOWED = {"rec_yds": allowed_by_pos(RV, "rec_yds", ["WR"]), "rec_yds_te": allowed_by_pos(RV, "rec_yds", ["TE"]), "rec_yds_rb": allowed_by_pos(RV, "rec_yds", ["RB"]), "rec": allowed_by_pos(RV, "rec", ["WR"]), "rec_te": allowed_by_pos(RV, "rec", ["TE"]), "rec_rb": allowed_by_pos(RV, "rec", ["RB"]),
           "rush_yds": allowed_by_pos(RU, "rush_yds", ["RB"]), "rush_att": allowed_by_pos(RU, "rush_att", ["RB"]), "pass_yds": allowed_by_pos(QB, "pass_yds", ["QB"]), "pass_comp": allowed_by_pos(QB, "pass_comp", ["QB"]), "pass_att": allowed_by_pos(QB, "pass_att", ["QB"])}
def allowed(stat, pos, opp):
    k = stat + ({"TE": "_te", "RB": "_rb"}.get(pos, "") if stat in ("rec_yds","rec") else ""); per, lg = ALLOWED[k]
    v = per.get(opp, np.nan); return (float(v), float(lg)) if not np.isnan(v) else None
# team target share out (entering share of Out/Doubtful WR/TE teammates) and QB out
share_out = {}
if len(inj):
    for tm, rows in inj.groupby("team"):
        sh = 0.0
        for k in rows[rows.position.isin(["WR","TE"])].key:
            x = RV[(RV.key == k) & (RV.team == tm)]
            if len(x): sh += wavg(x, "tsh", "routes") or 0
        share_out[tm] = 100 * sh
qb_out = set(inj[inj.position == "QB"].team) if len(inj) else set()
# ---------------------------------------------------------------- QB / RB facts
def qb_vs_mix(key, team, opp):
    q = QB[(QB.key == key) & (QB.team == team)]
    if not len(q): return None
    nm = q.nm.iloc[-1]; Qc = QCM[QCM.nm == nm]; dd = CVO[CVO.team == opp]
    if not len(Qc) or not len(dd): return None
    base = num(Qc.playerStatsFantasyPointsPpr).sum() / max(num(Qc.playerStatsPassingDropbacksTotal).sum(), 1); exp_, wsum, rows = 0.0, 0.0, []
    for s in ("Man","Cover2","Cover3","Cover4","Cover6"):
        f, dcol = f"playerStatsCoverageScheme{s}FantasyPointsPprTotal", f"playerStatsCoverageScheme{s}PassingDropbacksTotal"; n = num(Qc[dcol]).sum()
        if n < 15: continue
        v = num(Qc[f]).sum() / n; sh = wavg(dd, f"opponentStatsCoverageScheme{s}PassingDropbacksPercentage", "opponentStatsPassingDropbacksTotal")
        if np.isnan(sh): continue
        exp_ += v * sh; wsum += sh; rows.append((s, v, sh))
    if not wsum or not base: return None
    e = exp_ / wsum; return dict(pct=100 * (e / base - 1), man=100 * wavg(dd, "opponentStatsCoverageSchemeManPassingDropbacksPercentage", "opponentStatsPassingDropbacksTotal"), two=100 * wavg(dd, "opponentStatsCoverageSchemeTwoHighPassingDropbacksPercentage", "opponentStatsPassingDropbacksTotal"), worst=min(rows, key=lambda r: r[1])[0] if rows else None)
def trenches(team, opp):
    o, dd = PT[PT.team == team], PO[PO.team == opp]
    if not len(o) or not len(dd): return None
    return dict(allowed=100 * wavg(o, "teamStatsPassingPressuredPercentage", "teamStatsPassingDropbacksTotal"), generated=100 * wavg(dd, "opponentStatsPassingPressuredPercentage", "opponentStatsPassingDropbacksTotal"), lg=100 * LG_PRESS)
def rb_concepts(key, team, opp):
    b = RU[(RU.key == key) & (RU.team == team)]; f = RO[RO.team == opp]
    if b.rush_att.sum() < 40 or not len(f): return None
    lg_z = RU.zyds.sum() / max(RU.zatt.sum(), 1); lg_m = RU.myds.sum() / max(RU.matt.sum(), 1)
    out = dict(ybc=wavg(b, "ybc", "rush_att"), yac=wavg(b, "yac", "rush_att"), mtf=wavg(b, "mtf", "rush_att"), lg_ybc=wavg(RU, "ybc", "rush_att"), lg_yac=wavg(RU, "yac", "rush_att"), stuff_allowed=100 * wavg(f, "opponentStatsRushingAttemptsStuffsPercentage", "opponentStatsRushingAttemptsTotal"), lg_stuff=100 * wavg(RO, "opponentStatsRushingAttemptsStuffsPercentage", "opponentStatsRushingAttemptsTotal"),
               succ_allowed=100 * wavg(f, "opponentStatsRushingAttemptsSuccessPercentage", "opponentStatsRushingAttemptsTotal"), lg_succ=100 * wavg(RO, "opponentStatsRushingAttemptsSuccessPercentage", "opponentStatsRushingAttemptsTotal"), cells=[])
    for lab, a, y, fa, fy, lg in (("zone", "zatt", "zyds", "opponentStatsRushingConceptZoneAttemptsTotal", "opponentStatsRushingConceptZoneYardsTotal", lg_z), ("man/gap", "matt", "myds", "opponentStatsRushingConceptManAttemptsTotal", "opponentStatsRushingConceptManYardsTotal", lg_m)):
        if b[a].sum() >= 20 and num(f[fa]).sum() >= 40:
            his = b[y].sum() / b[a].sum() - lg; front = num(f[fy]).sum() / num(f[fa]).sum() - lg; out["cells"].append(dict(concept=lab, share=float(b[a].sum() / max(b.zatt.sum() + b.matt.sum(), 1)), his=his, front=front, stacked=his + front))
    return out
C = Chain(SEASON, WEEK)
# ---------------------------------------------------------------- tells per prop
def evaluate(r):
    stat, label = MK[r.market]; key, team, opp_full = r.key, r.team, r.opponent; g = games[str(r.game_id)]
    opp = ab(g["away_ab"]) if team == ab(g["home_ab"]) else ab(g["home_ab"]); line = float(r.close_line); tells = []; facts = {}
    T = lambda src, direction, text, weight=1.0: tells.append(dict(src=src, dir=direction, text=text, w=weight))
    # form
    df = {"rec_yds": RV, "rec": RV, "rush_yds": RU, "rush_att": RU, "pass_yds": QB, "pass_comp": QB, "pass_att": QB}[stat]; fm = form(df, key, team, stat); facts["form"] = fm
    if fm and fm["n5"] >= 3:
        gap = (fm["l5"] - line) / max(line, 1)
        if gap >= 0.15: T("form", "over", f"last {fm['n5']} games average {fm['l5']:.1f} {label}, {100*gap:.0f}% above the line")
        elif gap <= -0.15: T("form", "under", f"last {fm['n5']} games average {fm['l5']:.1f} {label}, {100*-gap:.0f}% below the line")
    # defense allowed to the position
    al = allowed(stat, r.position, opp); facts["allowed"] = al
    if al:
        v, lg = al; gap = (v - lg) / max(lg, 1e-9)
        if gap >= 0.12: T("defense", "over", f"{opp} allows {v:.1f} {label} per game to {r.position}s, {100*gap:.0f}% above league ({lg:.1f})")
        elif gap <= -0.12: T("defense", "under", f"{opp} allows {v:.1f} {label} per game to {r.position}s, {100*-gap:.0f}% below league ({lg:.1f})")
    # injuries
    so = share_out.get(team, 0.0); facts["share_out"] = so
    if stat in ("rec_yds","rec") and so >= 15: T("injury", "over", f"teammates listed Out/Doubtful carried {so:.0f}% of the target share")
    if stat in ("rec_yds","rec") and team in qb_out: T("injury", "under", "the starting quarterback is listed Out/Doubtful")
    if stat in ("pass_yds","pass_comp","pass_att") and so >= 20: T("injury", "under", f"receivers carrying {so:.0f}% of the target share are Out/Doubtful")
    if str(r.report_status or "").lower() in ("out","doubtful"): return None
    if str(r.practice_status or "").upper() in ("DNP",): T("injury", "under", f"did not practice ({r.practice_status})")
    # game script from the model
    home = team == ab(g["home_ab"]); sp = g.get("fg_spread_close"); tp = g.get("fg_total_pick"); facts["script"] = dict(spread=sp, total_pick=tp, model_total=g.get("fg_pred_total"))
    if sp is not None:
        my_spread = float(sp) if home else -float(sp)
        if stat in ("rush_att","rush_yds") and my_spread <= -6.5: T("script", "over", f"{team} is a {abs(my_spread):g}-point favorite (a leading script feeds carries)")
        if stat in ("rush_att","rush_yds") and my_spread >= 6.5: T("script", "under", f"{team} is a {my_spread:g}-point underdog (a trailing script cuts carries)")
        if stat in ("pass_att","pass_yds","pass_comp") and my_spread >= 6.5: T("script", "over", f"{team} is a {my_spread:g}-point underdog (a trailing script adds dropbacks)")
    if tp and g.get("fg_pred_total") is not None and g.get("fg_total_close") is not None:
        gap = float(g["fg_pred_total"]) - float(g["fg_total_close"])
        if abs(gap) >= 4 and stat in ("rec_yds","rec","pass_yds","pass_comp","pass_att"): T("model", "over" if gap > 0 else "under", f"the game model has the total {abs(gap):.1f} points {'above' if gap > 0 else 'below'} the posted {g['fg_total_close']}", 0.5)
    # position-specific matchup
    if stat in ("rec_yds","rec"):
        pid = RV[(RV.key == key) & (RV.team == team)].pid.iloc[-1] if len(RV[(RV.key == key) & (RV.team == team)]) else None
        calls, brief = C.chain(r.player_name, team, opp, pid=pid) if pid else (None, None); facts["chain"] = {k: (None if isinstance(v, float) and np.isnan(v) else v) for k, v in (calls or {}).items() if not isinstance(v, (list, dict))}
        if calls:
            if calls.get("top_route") and calls.get("top_route_stack", 0) >= 6: T("routes", "over", f"his top stacked route vs {opp} is the {calls['top_route']} ({calls['top_route_stack']:+.0f} separation vs league, his edge plus what {opp} allows)")
            if calls.get("worst_route") and calls.get("top_route_stack", 0) < 0: T("routes", "under", f"no route stacks in his favor vs {opp}; the {calls['worst_route']} is the weak spot")
            ys = calls.get("yprr_shift"); by = calls.get("base_yprr")
            if ys is not None and by and abs(ys) / by >= 0.10: T("coverage", "over" if ys > 0 else "under", f"{opp}'s coverage mix (man {calls['opp_man']:.0f}%, two-high {calls['opp_two']:.0f}% vs his usual {calls['his_man_norm']:.0f}% / {calls['his_two_norm']:.0f}%) moves his yards per route {100*ys/by:+.0f}%")
            if calls.get("share_dir") in ("up","down"): T("coverage", "over" if calls["share_dir"] == "up" else "under", f"his target share runs {calls['share_dir']} ({calls['share_shift']:+.1f} pts) against this kind of coverage")
            if calls.get("best_align") and calls.get("best_align_stack", 0) >= 6 and calls.get("prim_align") == calls.get("best_align"): T("alignment", "over", f"lines up {calls['prim_align'].lower()} most of the time, where the stack vs {opp} is {calls['best_align_stack']:+.0f}")
            ep, qn = calls.get("exp_press"), calls.get("qb_press_norm"); pe = calls.get("press_effect_on_share")
            if ep is not None and qn is not None and ep - qn >= 4 and pe is not None and pe <= -1.5: T("pocket", "under", f"expected pressure {ep:.0f}% vs his QB's norm {qn:.0f}%, and his share drops {abs(pe):.1f} pts when the QB is pressured")
            if ep is not None and qn is not None and ep - qn >= 4 and pe is not None and pe >= 1.5: T("pocket", "over", f"expected pressure {ep:.0f}% vs his QB's norm {qn:.0f}%, and his share RISES {pe:.1f} pts when the QB is pressured")
    elif stat in ("pass_yds","pass_comp","pass_att"):
        qm = qb_vs_mix(key, team, opp); facts["qb_mix"] = qm
        if qm and abs(qm["pct"]) >= 15: T("coverage", "over" if qm["pct"] > 0 else "under", f"projects {qm['pct']:+.0f}% vs his own rate against this coverage mix ({opp} plays man {qm['man']:.0f}%, two-high {qm['two']:.0f}%" + (f"; {qm['worst']} is his worst look" if qm["worst"] else "") + ")")
        tr = trenches(team, opp); facts["trenches"] = tr
        if tr and tr["allowed"] >= tr["lg"] + 4 and tr["generated"] >= tr["lg"] + 3: T("trenches", "under", f"his line allows pressure on {tr['allowed']:.0f}% of dropbacks against a front that generates {tr['generated']:.0f}% (league {tr['lg']:.0f}%)")
        if tr and tr["allowed"] <= tr["lg"] - 4 and tr["generated"] <= tr["lg"] - 3: T("trenches", "over", f"his line allows pressure on only {tr['allowed']:.0f}% against a front that generates only {tr['generated']:.0f}% (league {tr['lg']:.0f}%)")
    elif stat in ("rush_yds","rush_att"):
        rc = rb_concepts(key, team, opp); facts["rb"] = rc
        if rc:
            best = max(rc["cells"], key=lambda c: c["stacked"]) if rc["cells"] else None
            if best and best["stacked"] >= 0.6 and best["share"] >= 0.35: T("concept", "over", f"on {best['concept']} runs ({100*best['share']:.0f}% of his carries) he is {best['his']:+.1f} yards/att vs league and {opp} allows {best['front']:+.1f}")
            if best and best["stacked"] <= -0.6 and best["share"] >= 0.35: T("concept", "under", f"on {best['concept']} runs ({100*best['share']:.0f}% of his carries) he is {best['his']:+.1f} yards/att vs league and {opp} allows {best['front']:+.1f}")
            if rc["ybc"] <= rc["lg_ybc"] - 0.4 and rc["stuff_allowed"] >= rc["lg_stuff"] + 3: T("trenches", "under", f"his line gives him {rc['ybc']:.1f} yards before contact (league {rc['lg_ybc']:.1f}) against a front that stuffs {rc['stuff_allowed']:.0f}% of runs (league {rc['lg_stuff']:.0f}%)")
            if rc["yac"] >= rc["lg_yac"] + 0.4 and rc["succ_allowed"] >= rc["lg_succ"] + 3: T("back", "over", f"he creates {rc['yac']:.1f} yards after contact (league {rc['lg_yac']:.1f}) against a front that allows {rc['succ_allowed']:.0f}% rush success (league {rc['lg_succ']:.0f}%)")
    if not tells: return None
    n_over = sum(t["w"] for t in tells if t["dir"] == "over"); n_under = sum(t["w"] for t in tells if t["dir"] == "under")
    direction = "over" if n_over > n_under else "under"; n_for, n_against = (n_over, n_under) if direction == "over" else (n_under, n_over)
    return dict(direction=direction, n_for=n_for, n_against=n_against, net=n_for - n_against, tells=tells, facts=facts, opp=opp, label=label, line=line)
def sheet(r, e):
    g = games[str(r.game_id)]; L = [f"### 🔢 The line", f"- **{e['label'].capitalize()} {e['line']:g}** ({r.team} vs {e['opp']})" + (f" — best over {r.best_over_line:g} at {r.best_over_book_name} ({int(r.best_over_price):+d})" if pd.notna(r.best_over_line) and pd.notna(r.best_over_price) else "") + (f", best under {r.best_under_line:g} at {r.best_under_book_name} ({int(r.best_under_price):+d})" if pd.notna(r.best_under_line) and pd.notna(r.best_under_price) else "")]
    fm = e["facts"].get("form")
    if fm: L.append(f"- Last {fm['n5']}: {fm['l5']:.1f} per game" + (f"; this season: {fm['szn']:.1f} over {fm['n_szn']} game{'s' if fm['n_szn'] != 1 else ''}" if fm.get("szn") is not None else "") + f"; last game: {fm['last']:.0f}")
    groups = [("🎯 Matchup", ("routes","coverage","alignment","pocket","concept","trenches","back")), ("🛡️ The defense", ("defense",)), ("🏥 Context", ("injury",)), ("🧮 Game script and model", ("script","model"))]
    for title, srcs in groups:
        ts = [t for t in e["tells"] if t["src"] in srcs]
        if ts: L.append(f"### {title}"); L += [f"- {'🟢' if t['dir'] == 'over' else '🔴'} {t['text'][0].upper() + t['text'][1:]}" for t in ts]
    L.append("### 🧭 Where the numbers point")
    L.append(f"- **{e['n_for']:g} of {e['n_for'] + e['n_against']:g}** things point toward the **{e['direction'].upper()}**" + (f"; {e['n_against']:g} point the other way" if e["n_against"] else "") + ". A read on the numbers, not a pick.")
    return "\n".join(L)
def summary(r, e):
    lead = max(e["tells"], key=lambda t: (t["dir"] == e["direction"], t["w"])); return f"{e['label'].capitalize()} {e['line']:g} vs {e['opp']}: {e['n_for']:g} of {e['n_for'] + e['n_against']:g} things point {e['direction'].upper()}. {lead['text'][0].upper() + lead['text'][1:]}."
# ---------------------------------------------------------------- run
rows = []
for r in props.itertuples():
    try: e = evaluate(r)
    except Exception as ex: print(f"  [skip] {r.player_name} {r.market}: {ex}"); continue
    if e and e["n_for"] >= 3 and e["net"] >= 2: rows.append((r, e))
best = {}
for r, e in rows:                                           # one card per player: the market with the strongest net
    k = (r.key, r.team)
    if k not in best or e["net"] > best[k][1]["net"]: best[k] = (r, e)
QUOTA = {"QB": 3, "WR": 5, "TE": 5, "RB": 3}; used = {"QB": 0, "WRTE": 0, "RB": 0}; sel = []
for r, e in sorted(best.values(), key=lambda x: (-x[1]["net"], -x[1]["n_for"])):
    grp = "WRTE" if r.position in ("WR","TE") else r.position
    if used.get(grp, 0) >= (5 if grp == "WRTE" else QUOTA.get(grp, 2)): continue
    used[grp] = used.get(grp, 0) + 1; sel.append((r, e))
    if len(sel) >= 10: break
print(f"{SEASON} week {WEEK}: {len(props)} posted props evaluated, {len(rows)} with 3+ tells one way, {len(sel)} featured")
requests.delete(f"{lib.SUPA}/nfl_prop_narratives?season=eq.{SEASON}&week=eq.{WEEK}", headers=H, timeout=30)
for r, e in sel:
    g = games[str(r.game_id)]; body = sheet(r, e); f = json.loads(json.dumps({**e["facts"], "tells": e["tells"]}, default=lambda o: None if (isinstance(o, float) and np.isnan(o)) else (float(o) if isinstance(o, (np.floating, np.integer)) else str(o))))
    row = dict(id=f"{r.game_id}|{r.player_name}|{r.market}", season=SEASON, week=WEEK, game_id=str(r.game_id), kickoff=g.get("kickoff"), player_id=str(r.player_id) if pd.notna(r.player_id) else None, player_name=r.player_name, team=r.team, opp=e["opp"], position=r.position, market=r.market, line=e["line"],
               best_over_line=None if pd.isna(r.best_over_line) else float(r.best_over_line), best_over_price=None if pd.isna(r.best_over_price) else float(r.best_over_price), best_over_book=r.best_over_book_name, best_under_line=None if pd.isna(r.best_under_line) else float(r.best_under_line), best_under_price=None if pd.isna(r.best_under_price) else float(r.best_under_price), best_under_book=r.best_under_book_name,
               headshot_url=r.headshot_url, direction=e["direction"], score=float(e["net"]), n_for=int(e["n_for"]), n_against=int(e["n_against"]), facts=f, summary=summary(r, e), body=body)
    x = requests.post(f"{lib.SUPA}/nfl_prop_narratives", headers={**H, "Prefer": "resolution=merge-duplicates"}, json=row, timeout=30)
    print(f"  {x.status_code} {r.player_name:24s} {r.position:2s} {e['label']:18s} {e['line']:5g} -> {e['direction'].upper():5s} {e['n_for']:g}/{e['n_for'] + e['n_against']:g}")
