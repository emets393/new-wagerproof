"""Generate cfb_dryrun_games — one row per Week-7 2025 FBS game (every game gets a number).
Assembles model_games (identity/lines/actuals) + games_2025 (kickoff) + odds_game_frame (ML) +
event-odds archive (team totals + 1H posted close) + harness CSVs (preds, spots, TT, 1H). Walk-forward
(harness trained <2025; as-of features through wk6). Actuals stored for VALIDATION ONLY."""
import numpy as np, pandas as pd, warnings
import dry_common as C
warnings.filterwarnings("ignore")
SEASON, WEEK = C.season_week()
P5 = {"SEC", "Big Ten", "Big 12", "ACC", "Pac-12"}

gm = pd.read_parquet("data/model_games.parquet")
m = gm[(gm.season == SEASON) & (gm.week == WEEK)].copy()
g7 = set(m.game_id)
# kickoff
g25 = pd.read_parquet("data/cfbd/games_2025.parquet")[["id", "startDate"]].rename(columns={"id": "game_id"})
m = m.merge(g25, on="game_id", how="left")
# ML close
of = pd.read_parquet("data/odds_game_frame.parquet")[["season", "home", "away", "close_home_ml", "close_away_ml"]]
m = m.merge(of, left_on=["season", "homeTeam", "awayTeam"], right_on=["season", "home", "away"], how="left")
# harness preds + spots
pred = pd.read_csv("out/cfb_predictions_2025.csv")
bets = pd.read_csv("out/cfb_bets_2025.csv")
m = m.merge(pred[["homeTeam", "awayTeam", "pred_total", "pred_spread", "totals_bet", "sides_bet", "mammoth", "spots"]],
            on=["homeTeam", "awayTeam"], how="left")
m = m.merge(bets[["game_id", "pred_margin", "side_edge", "total_edge", "p_home_conf"]], on="game_id", how="left")
# cfb_bets only has games where a spot fired -> pred_margin is null for no-spot games. Backfill from
# pred_spread (cfb_predictions, ALL games) so every game gets predicted team points (= -pred_spread).
m["pred_margin"] = m.pred_margin.fillna(-m.pred_spread)
# WEATHER (Visual Crossing forecast, keyed game_api_id == game_id). Condition icon derived (icon_text sparse).
wx = pd.read_parquet("data/cfb_weather_data.parquet")[["game_api_id", "temp_at_kick_f", "windspeed_avg_mph", "precip_sum_mm"]]
m = m.merge(wx.rename(columns={"game_api_id": "game_id"}), on="game_id", how="left")
def wx_icon(temp, wind, precip, indoors):
    if indoors: return "indoors"
    if pd.notna(precip) and precip >= 1 and pd.notna(temp) and temp <= 32: return "snow"
    if pd.notna(precip) and precip >= 1: return "rain"
    if pd.notna(wind) and wind >= 15: return "wind"
    if pd.notna(temp) and temp <= 32: return "cold"
    if pd.notna(temp) and temp >= 90: return "hot"
    return "clear"
def wx_summary(temp, wind, precip, indoors):
    if indoors: return "Indoors (dome)"
    if pd.isna(temp): return None
    s = f"{round(temp)}°F"
    if pd.notna(wind): s += f" · {round(wind)} mph wind"
    if pd.notna(precip) and precip >= 0.5: s += " · precip"
    return s

# event-odds: team totals + 1H posted CLOSE consensus (tag-agnostic: last pre-kick snap)
ev = pd.read_parquet("data/event_odds/events_2025.parquet")
ev = ev[ev.game_id.isin(g7)].copy()
names = sorted(set(gm.homeTeam) | set(gm.awayTeam))
AL = {"Appalachian State Mountaineers": "App State", "Hawaii Rainbow Warriors": "Hawai'i",
      "UMass Minutemen": "Massachusetts", "San Jose State Spartans": "San José State",
      "Southern Miss Golden Eagles": "Southern Miss"}
def tdb(o):
    if o in AL: return AL[o]
    c = [x for x in names if str(o).startswith(str(x) + " ") or o == x]; c.sort(key=len, reverse=True)
    return c[0] if c else None
ev["snap_dt"] = pd.to_datetime(ev.snap, utc=True)
ev["description"] = ev.description.fillna("_")  # 1H markets have null desc; avoid groupby dropping NaN keys
ev = ev.sort_values("snap_dt").groupby(["game_id", "market", "book", "name", "description"], as_index=False).last()  # close=last snap

def tt_side(team_is_home):
    tt = ev[(ev.market == "team_totals") & (ev.name == "Over")].copy()
    tt["team"] = tt.description.map(tdb)
    out = {}
    for gid, sub in tt.groupby("game_id"):
        row = m[m.game_id == gid]
        if not len(row): continue
        tname = row.homeTeam.iloc[0] if team_is_home else row.awayTeam.iloc[0]
        s = sub[sub.team == tname]
        if len(s): out[gid] = (s.point.median(), s.point.max(), s.point.min())
    return out
tth, tta = tt_side(True), tt_side(False)
def h1_cons(market, name=None, home_side=False):
    p = ev[ev.market == market].copy()
    if name: p = p[p.name == name]
    if home_side: p["nm"] = p.name.map(tdb); p = p[p.nm == p.home]
    return p.groupby("game_id").point.median().to_dict()
h1s = h1_cons("spreads_h1", home_side=True); h1t = h1_cons("totals_h1", name="Over")
mlh = ev[(ev.market == "h2h_h1")]; mlh["nm"] = mlh.name.map(tdb)
h1mlh = mlh[mlh.nm == mlh.home].groupby("game_id").price.median().to_dict()
h1mla = mlh[mlh.nm == mlh.away].groupby("game_id").price.median().to_dict()

# TT + 1H model preds/picks
tt_csv = pd.read_csv("out/cfb_team_totals_2025.csv"); tt_csv = tt_csv[tt_csv.game_id.isin(g7)]
h1_csv = pd.read_csv("out/cfb_h1_model_2025.csv"); h1_csv = h1_csv[h1_csv.game_id.isin(g7)]
def tt_pred(gid, team):  # UNIFIED: full-game-derived team points (coherent with predicted score), pick by edge vs posted
    row = m[m.game_id == gid]
    if not len(row): return None, None
    row = row.iloc[0]; is_home = team == row.homeTeam
    proj = C.fg_team_pts(float(row.pred_total), float(row.pred_margin), is_home) if pd.notna(row.pred_total) and pd.notna(row.pred_margin) else None
    if proj is None: return None, None
    vg = (tth if is_home else tta).get(gid)
    if not vg: return round(proj, 1), None
    p5 = (row.homeConference if is_home else row.awayConference) in C.P5CONF
    pside = "OVER" if proj >= vg[0] else "UNDER"
    ck = C.tt_conv_key(proj - vg[0], pside, p5)
    return round(proj, 1), (pside if ck else None)
h1m = dict(zip(h1_csv.game_id, h1_csv.h1_pm)); h1pt = dict(zip(h1_csv.game_id, h1_csv.h1_pt))
h1sp = dict(zip(h1_csv.game_id, h1_csv.h1_spread_bet.fillna(""))); h1tp = dict(zip(h1_csv.game_id, h1_csv.h1_tot_bet.fillna(""))); h1mlp = dict(zip(h1_csv.game_id, h1_csv.h1_ml_bet.fillna("")))

def rank(v): return int(v) if pd.notna(v) and v and v > 0 else None
rows = []
for _, r in m.iterrows():
    gid = r.game_id
    # model sides/totals direction (the headline pick); spots are separate flags
    edge = r.side_edge if pd.notna(r.side_edge) else (r.pred_margin + r.spread_open if pd.notna(r.pred_margin) else None)
    mside = ("AWAY" if edge < 0 else "HOME") if edge is not None else None
    tside = ("OVER" if pd.notna(r.total_edge) and r.total_edge > 0 else "UNDER") if pd.notna(r.total_edge) else None
    # conviction = only spots that AGREE with the model side count (conflicting opposite-side spots don't inflate)
    convs = []
    for tok in str(r.spots or "").split(";"):
        tok = tok.strip(); c = C.classify(tok)
        if not c: continue
        if c[0] == "spread":
            # spot side: parse from token where explicit, else model side
            ts = "HOME" if ("-> HOME" in tok or "=HOME" in tok or "lay-fav home" in tok) else ("AWAY" if ("AWAY" in tok or "=AWAY" in tok or "away-fav" in tok or "fade home" in tok or "lay-fav away" in tok) else mside)
            if ts == mside: convs.append(c[2])
        else:
            convs.append(c[2])
    has_tt = len(tt_csv[tt_csv.game_id == gid]) > 0
    if r.mammoth == 1: tier = "mammoth"
    elif "T1" in convs: tier = "high"
    elif "T2" in convs or has_tt: tier = "med"
    elif "T3" in convs: tier = "low"
    elif mside or tside: tier = "lean"
    else: tier = "none"
    stake = {"mammoth": 5, "high": 3, "med": 2, "low": 1, "lean": 0.5, "none": 0}[tier]
    capped = bool(edge is not None and abs(edge) > 14)
    rows.append({
        "game_id": int(gid), "season": SEASON, "week": WEEK,
        "kickoff": r.startDate, "neutral_site": bool(r.neutralSite),
        "wx_temp_f": round(float(r.temp_at_kick_f), 1) if pd.notna(r.get("temp_at_kick_f")) else None,
        "wx_wind_mph": round(float(r.windspeed_avg_mph), 1) if pd.notna(r.get("windspeed_avg_mph")) else None,
        "wx_precip_mm": round(float(r.precip_sum_mm), 2) if pd.notna(r.get("precip_sum_mm")) else None,
        "wx_indoors": (bool(r.wx_indoors) if pd.notna(r.get("wx_indoors")) else False),
        "wx_icon": wx_icon(r.get("temp_at_kick_f"), r.get("windspeed_avg_mph"), r.get("precip_sum_mm"), (bool(r.wx_indoors) if pd.notna(r.get("wx_indoors")) else False)),
        "wx_summary": wx_summary(r.get("temp_at_kick_f"), r.get("windspeed_avg_mph"), r.get("precip_sum_mm"), (bool(r.wx_indoors) if pd.notna(r.get("wx_indoors")) else False)),
        "home_team": r.homeTeam, "away_team": r.awayTeam, "home_conf": r.homeConference, "away_conf": r.awayConference,
        "home_rank": rank(r.home_self_rank), "away_rank": rank(r.away_self_rank),
        "fg_spread_open": r.spread_open, "fg_spread_close": r.spread_close,
        "fg_total_open": r.total_open, "fg_total_close": r.total_close,
        "fg_ml_home_close": r.close_home_ml, "fg_ml_away_close": r.close_away_ml,
        "tt_home_close": (tth.get(gid) or (None,))[0], "tt_home_best_under": (tth.get(gid) or (None, None, None))[1], "tt_home_best_over": (tth.get(gid) or (None, None, None))[2],
        "tt_away_close": (tta.get(gid) or (None,))[0], "tt_away_best_under": (tta.get(gid) or (None, None, None))[1], "tt_away_best_over": (tta.get(gid) or (None, None, None))[2],
        "h1_spread_close": h1s.get(gid), "h1_total_close": h1t.get(gid), "h1_ml_home_close": h1mlh.get(gid), "h1_ml_away_close": h1mla.get(gid),
        "fg_pred_margin": round(float(r.pred_margin), 1) if pd.notna(r.pred_margin) else None,
        # predicted team points — single source of truth for BOTH the headline score and the team-total cards
        "fg_pred_home_pts": round(C.fg_team_pts(float(r.pred_total), float(r.pred_margin), True), 1) if pd.notna(r.pred_total) and pd.notna(r.pred_margin) else None,
        "fg_pred_away_pts": round(C.fg_team_pts(float(r.pred_total), float(r.pred_margin), False), 1) if pd.notna(r.pred_total) and pd.notna(r.pred_margin) else None,
        "fg_pred_spread": round(float(r.pred_spread), 1) if pd.notna(r.pred_spread) else None,
        "fg_spread_edge": round(float(edge), 1) if edge is not None else None,
        "fg_spread_pick": (None if capped else mside),   # MODEL side (capped >14 = no-play); spots are flags
        "fg_spread_capped": capped,
        "fg_pred_total": round(float(r.pred_total), 1) if pd.notna(r.pred_total) else None,
        "fg_total_edge": round(float(r.total_edge), 1) if pd.notna(r.total_edge) else None,
        "fg_total_pick": tside,
        "fg_home_cover_prob": round(float(r.p_home_conf), 3) if pd.notna(r.p_home_conf) else None,
        "fg_home_win_prob": round(float(1 / (1 + np.exp(-(r.pred_margin if pd.notna(r.pred_margin) else 0) / 9.5))), 3),
        "tt_home_pred": tt_pred(gid, r.homeTeam)[0], "tt_home_pick": tt_pred(gid, r.homeTeam)[1],
        "tt_away_pred": tt_pred(gid, r.awayTeam)[0], "tt_away_pick": tt_pred(gid, r.awayTeam)[1],
        "h1_pred_margin": round(float(h1m[gid]), 1) if gid in h1m else None,
        "h1_pred_total": round(float(h1pt[gid]), 1) if gid in h1pt else None,
        "h1_spread_pick": h1sp.get(gid) or None, "h1_total_pick": h1tp.get(gid) or None, "h1_ml_pick": h1mlp.get(gid) or None,
        "conviction_tier": tier, "stake_units": stake, "mammoth": bool(r.mammoth == 1),
        "final_home": int(r.homePoints) if pd.notna(r.homePoints) else None,
        "final_away": int(r.awayPoints) if pd.notna(r.awayPoints) else None,
    })
df = pd.DataFrame(rows)
# 1H actuals from line scores
g25b = pd.read_parquet("data/cfbd/games_2025.parquet")
g25b["h1_home"] = g25b.homeLineScores.apply(lambda a: int(sum(a[:2])) if a is not None and len(a) >= 2 else None)
g25b["h1_away"] = g25b.awayLineScores.apply(lambda a: int(sum(a[:2])) if a is not None and len(a) >= 2 else None)
df = df.merge(g25b[["id", "h1_home", "h1_away"]].rename(columns={"id": "game_id"}), on="game_id", how="left")
df["n_flags_active"] = 0; df["n_flags_tracking"] = 0   # filled by flags gen via update; placeholder
# coerce nullable int columns (NaN forces float -> '16.0' which PostgREST rejects for int cols)
for col in ["home_rank", "away_rank", "final_home", "final_away", "h1_home", "h1_away"]:
    df[col] = pd.Series([int(v) if pd.notna(v) else None for v in df[col]], dtype=object, index=df.index)
print(f"cfb_dryrun_games rows: {len(df)} | tiers: {df.conviction_tier.value_counts().to_dict()}")
print(f"  with TT close: {df.tt_home_close.notna().sum()} | 1H total: {df.h1_total_close.notna().sum()} | ML: {df.fg_ml_home_close.notna().sum()}")
C.wipe("cfb_dryrun_games", f"season=eq.{SEASON}&week=eq.{WEEK}")
C.insert("cfb_dryrun_games", df)
