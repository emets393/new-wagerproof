"""Generate cfb_dryrun_picks — one row per bet-type per game (the prediction cards). Everything precomputed:
model number, fair line, vegas consensus line, edge, BEST book line+odds+logo, conviction, signals, has_play.
Best line rule: spread/h1_spread -> max line for the pick side (fewer to lay / more to take); total/team_total/
h1_total -> OVER=lowest line, UNDER=highest line; ties + moneyline -> highest American odds (best price).
Also writes conviction_summary onto cfb_dryrun_games for the slate pills."""
import os
import numpy as np, pandas as pd, warnings, requests, json
import dry_common as C

warnings.filterwarnings("ignore")
SEASON, WEEK = C.season_week()
BOOKS = {"draftkings": ("DraftKings", "draftkings.com"), "fanduel": ("FanDuel", "fanduel.com"),
 "betmgm": ("BetMGM", "betmgm.com"), "betrivers": ("BetRivers", "betrivers.com"),
 "williamhill_us": ("Caesars", "caesars.com"), "fanatics": ("Fanatics Sportsbook", "fanatics.com"),
 "bovada": ("Bovada", "bovada.lv"), "betonlineag": ("BetOnline", "betonline.ag"),
 "mybookieag": ("MyBookie", "mybookie.ag"), "betus": ("BetUS", "betus.com.pa"), "lowvig": ("LowVig", "lowvig.ag")}
def book_meta(k): n, d = BOOKS.get(k, (k, None)); return n, (f"https://logo.clearbit.com/{d}" if d else None)
CONV_RANK = {"mammoth": 5, "T1": 4, "T2": 3, "T3": 2, "track": 1}
TIER_DISP = {"mammoth": "mammoth", "T1": "high", "T2": "med", "T3": "low", "track": "lean"}

gm, te, S = C.harness_week(SEASON, WEEK)

# ⛔ Lines rule: te's CFBD-sourced close lines are corrupt for some games (sign flips /
# zero-fills — Miami@Stanford arrived as Stanford -22.5). Override from the Odds-API
# game frame, mirroring gen_cfb_dryrun_flags, and recompute the edges the side pick
# derives from. No Odds-API line -> NaN (card shows no line, no play).
_ogf = pd.read_parquet("data/odds_game_frame.parquet")
_ogf = _ogf[_ogf.season == SEASON][["home", "away", "close_spread", "close_total"]]
te = te.merge(_ogf, left_on=["homeTeam", "awayTeam"], right_on=["home", "away"], how="left")
te["spread_close"] = te["close_spread"]
te["total_close"] = te["close_total"]
te = te.drop(columns=["home", "away"], errors="ignore")
te["side_edge"] = te.pred_margin + te.spread_close
te["total_edge"] = te.pred_total - te.total_close

g7 = set(te.game_id)
names = sorted(set(gm.homeTeam) | set(gm.awayTeam))
AL = {"Appalachian State Mountaineers": "App State", "Hawaii Rainbow Warriors": "Hawai'i",
      "UMass Minutemen": "Massachusetts", "San Jose State Spartans": "San José State", "Southern Miss Golden Eagles": "Southern Miss"}
def tdb(o):
    if o in AL: return AL[o]
    c = [x for x in names if str(o).startswith(str(x) + " ") or o == x]; c.sort(key=len, reverse=True)
    return c[0] if c else None

# ---- per-book FULL-GAME close lines (odds_history -> cfbd game) ----
oh = pd.read_parquet(f"data/odds_history/odds_{SEASON}.parquet")
oh["h"] = oh.home_team.map(tdb); oh["a"] = oh.away_team.map(tdb); oh = oh.dropna(subset=["h", "a"])
pair2gid = {(r.homeTeam, r.awayTeam): r.game_id for _, r in te.iterrows()}
oh["gid"] = [pair2gid.get((h, a)) for h, a in zip(oh.h, oh.a)]
oh = oh[oh.gid.notna() & (oh.hrs_to_kick > 0)].sort_values("hrs_to_kick")
fg = oh.drop_duplicates(["gid", "book"], keep="first")  # close = nearest pre-kick per book
FG = {}
for _, r in fg.iterrows():
    FG[(int(r.gid), r.book)] = r

# ---- per-book TT + 1H close lines (event odds) ----
# Preseason (e.g. Week 1 before books post event props), events_{SEASON}.parquet may not exist yet.
# Fall back to an empty frame so full-game picks still generate — TT/1H just won't have per-book lines.
_ev_path = f"data/event_odds/events_{SEASON}.parquet"
if os.path.exists(_ev_path) and not (_e := pd.read_parquet(_ev_path)).empty and "game_id" in _e.columns:
    ev = _e[_e.game_id.isin(g7)].copy()
    ev["snap_dt"] = pd.to_datetime(ev.snap, utc=True); ev["description"] = ev.description.fillna("_")
    ev = ev.sort_values("snap_dt").groupby(["game_id", "market", "book", "name", "description"], as_index=False).last()
else:
    # Full events schema so downstream ev slices (which reference .home/.away/.description) stay column-complete.
    ev = pd.DataFrame(columns=["season", "game_id", "home", "away", "snap_tag", "snap", "book",
                               "market", "name", "description", "price", "point", "snap_dt"])

def best_spread(gid, side):
    v = []
    for (g, bk), r in FG.items():
        if g != gid or pd.isna(r.spread_home): continue
        line = r.spread_home if side == "HOME" else -r.spread_home
        price = r.spread_home_price if side == "HOME" else r.spread_away_price
        v.append((float(line), float(price) if pd.notna(price) else -110, bk))
    return max(v, key=lambda x: (x[0], x[1])) if v else None
def best_total(gid, side):
    v = []
    for (g, bk), r in FG.items():
        if g != gid or pd.isna(r.total): continue
        price = r.over_price if side == "OVER" else r.under_price
        v.append((float(r.total), float(price) if pd.notna(price) else -110, bk))
    if not v: return None
    return min(v, key=lambda x: (x[0], -x[1])) if side == "OVER" else max(v, key=lambda x: (x[0], x[1]))
def best_ml(gid, side):
    v = [(float(r.home_ml if side == "HOME" else r.away_ml), bk) for (g, bk), r in FG.items()
         if g == gid and pd.notna(r.home_ml if side == "HOME" else r.away_ml)]
    return max(v, key=lambda x: x[0]) if v else None
def ev_rows(gid, market, name=None):
    s = ev[(ev.game_id == gid) & (ev.market == market)]
    return s[s.name == name] if name else s
def best_tt(gid, team, ou):
    s = ev_rows(gid, "team_totals", "Over"); s = s[s.description.map(tdb) == team]
    su = ev_rows(gid, "team_totals", "Under"); su = su[su.description.map(tdb) == team]
    pr = {r.book: r.price for _, r in (su if ou == "UNDER" else s).iterrows()}
    v = [(float(r.point), float(pr.get(r.book, -110)), r.book) for _, r in s.iterrows() if pd.notna(r.point)]
    if not v: return None
    return max(v, key=lambda x: (x[0], x[1])) if ou == "UNDER" else min(v, key=lambda x: (x[0], -x[1]))
def best_h1_spread(gid, side):
    s = ev_rows(gid, "spreads_h1"); s["nm"] = s.name.map(tdb); s = s[s.nm == s.home]
    v = []
    for _, r in s.iterrows():
        if pd.isna(r.point): continue
        line = r.point if side == "HOME" else -r.point
        v.append((float(line), float(r.price) if pd.notna(r.price) else -110, r.book))
    return max(v, key=lambda x: (x[0], x[1])) if v else None
def best_h1_total(gid, side):
    s = ev_rows(gid, "totals_h1", side.capitalize())
    v = [(float(r.point), float(r.price) if pd.notna(r.price) else -110, r.book) for _, r in s.iterrows() if pd.notna(r.point)]
    if not v: return None
    return min(v, key=lambda x: (x[0], -x[1])) if side == "OVER" else max(v, key=lambda x: (x[0], x[1]))
def best_h1_ml(gid, side):
    s = ev_rows(gid, "h2h_h1"); s["nm"] = s.name.map(tdb)
    tgt = (te[te.game_id == gid].homeTeam if side == "HOME" else te[te.game_id == gid].awayTeam).iloc[0]
    v = [(float(r.price), r.book) for _, r in s.iterrows() if r.nm == tgt and pd.notna(r.price)]
    return max(v, key=lambda x: x[0]) if v else None

# ---- posted team-total consensus (vegas) per team; predictions come from the full-game model now ----
def tt_vegas(gid, team):
    s = ev_rows(gid, "team_totals", "Over"); s = s[s.description.map(tdb) == team]
    return float(s.point.median()) if len(s) else None

# ---- 1H model projections for EVERY game (not just games with a posted line) ----
import cfb_forecast as F, h1_signals
_gmf, _feats, _nets = F.load()
_h1pred = h1_signals.build(_gmf, _feats, _nets, SEASON)
h1proj = {int(r.game_id): (float(r.h1_pm), float(r.h1_pt)) for _, r in _h1pred.iterrows() if int(r.game_id) in g7}
# Preseason: the 1H model CSV won't exist until we have live 1H odds. Fall back to empty so full-game picks still run.
_h1csv_path = f"out/cfb_h1_model_{SEASON}.csv"
h1csv = pd.read_csv(_h1csv_path).set_index("game_id") if os.path.exists(_h1csv_path) else pd.DataFrame().set_index(pd.Index([], name="game_id"))   # only games with a 1H PLAY
def h1s_cons(gid):
    s = ev_rows(gid, "spreads_h1"); s = s.assign(nm=s.name.map(tdb)); s = s[s.nm == s.home]
    return float(s.point.median()) if len(s) else None
def h1t_cons(gid):
    s = ev_rows(gid, "totals_h1", "Over"); return float(s.point.median()) if len(s) else None

# ---- flags (conviction + signals per card) from the loaded table ----
fl = requests.get(f"{C.URL}/rest/v1/cfb_dryrun_flags?week=eq.{WEEK}&select=*", headers={**C.H, "Prefer": ""}).json()
flags = pd.DataFrame(fl)
CG = {"spread": "spread", "total": "total", "team_total": "team_total", "h1_spread": "h1_spread", "h1_total": "h1_total", "h1_ml": "h1_ml"}
def counter_keys(gid, card_group, side, team=None):
    """Signal keys firing the OPPOSITE side of this market — the card's
    'Contradicts this pick' bucket. Real information (e.g. a tracking-tier
    regime fade against the model's active lean), hidden until now."""
    if side is None or not len(flags):
        return []
    f = flags[(flags.game_id == gid) & (flags.market.map(lambda m: CG.get(m)) == card_group)]
    opp = {"HOME": "AWAY", "AWAY": "HOME", "OVER": "UNDER", "UNDER": "OVER"}.get(side)
    if opp is None:
        return []
    if card_group == "team_total" and team is not None:
        # TT flag sides are "<Team> OVER|UNDER", not bare OVER/UNDER
        f = f[f.side.str.contains(team, na=False, regex=False) & f.side.str.contains(opp, na=False, regex=False)]
        return sorted(set(f.signal_key))
    return sorted(set(f[f.side == opp].signal_key))

def conv_for(gid, card_group, side=None, team=None, ou=None):
    f = flags[(flags.game_id == gid) & (flags.market.map(lambda m: CG.get(m)) == card_group)] if len(flags) else flags
    if len(f) and card_group == "team_total":
        f = f[f.side.str.contains(team, na=False) & f.side.str.contains(ou, na=False)]
    elif len(f) and side is not None:
        f = f[f.side == side]
    if not len(f): return "none", False, []
    best = max(f.conviction, key=lambda c: CONV_RANK.get(c, 0))
    return TIER_DISP.get(best, "low"), bool(f.mammoth.any()), sorted(set(f.signal_key))

rows = []
EARLY = WEEK <= 3   # opponent-adjusted model is COLD in Weeks 1-3 -> contextual signals drive the pick, not the model

# Weeks 1-3 the harness has no played games, so its per-game pred_margin/pred_total collapse toward
# the league mean (every matchup lands near -4 / 53). gen_cfb_dryrun_games.py swaps in the preseason
# priors blend for exactly this reason; mirror it or every card contradicts the game row it sits on.
if EARLY:
    _ep_path = f"out/cfb_early_preds_{SEASON}.csv"
    if not os.path.exists(_ep_path):
        raise SystemExit(f"[early] {_ep_path} missing — run cfb_early_week.py before generating picks")
    _ep = pd.read_csv(_ep_path)[["homeTeam", "awayTeam", "pred_spread", "pred_total"]]
    te = te.drop(columns=["pred_spread", "pred_total"], errors="ignore").merge(
        _ep, on=["homeTeam", "awayTeam"], how="left")
    te["pred_margin"] = -te.pred_spread
    # Recompute edges off the blend — the harness edges belong to the cold model we just replaced.
    te["side_edge"] = te.pred_margin + te.spread_close
    te["total_edge"] = te.pred_total - te.total_close

def fmt_line(v): return ("+" if v > 0 else "") + f"{v:g}" if v is not None else None
def driving_spread_side(gid):
    """Cold-week spread pick side = the highest-conviction CONTEXTUAL spread signal that fired
    (e.g. g5_dog_wk1_bigfav on the dog). Returns 'HOME'/'AWAY' or None. Blanket/model keys are
    already excluded upstream, so any spread flag here is a real per-game signal."""
    if not len(flags): return None
    f = flags[(flags.game_id == gid) & (flags.market == "spread")]
    if not len(f): return None
    return f.sort_values("conviction", key=lambda s: s.map(lambda c: CONV_RANK.get(c, 0)), ascending=False).iloc[0].side
for _, r in te.iterrows():
    gid = int(r.game_id); H, A = r.homeTeam, r.awayTeam
    side_edge = float(r.side_edge) if pd.notna(r.side_edge) else None
    sp_conv, sp_mam, sp_sig, sp_has = "none", False, [], False   # captured for ML inheritance
    # ---- SPREAD ----
    if side_edge is not None:
        # >= : edge exactly 0 (pred lands on the line) breaks to HOME, matching
        # gen_cfb_dryrun_games' "AWAY if edge < 0 else HOME" — Stanford-Hawai'i 2026-wk1
        # tied at 0.0 and the sign guard killed the run on the mismatch.
        ph = side_edge >= 0; pteam = H if ph else A; pside = "HOME" if ph else "AWAY"
        # EARLY: contextual signals no longer OVERRIDE the pick side. That rule predates the
        # early blend (true-preseason ratings + roster) — the model side is real now, the game
        # row displays it, and an overriding flag made the card contradict the row above it
        # (UTEP@OU 2026-wk1: portal_talent_influx flipped the card to "Oklahoma -39.5").
        # A signal that AGREES with the model side still drives conviction (conv_for is
        # side-filtered) and exempts the degenerate-edge cap; a disagreeing signal renders
        # in the game's signal list, never as the headline pick.
        drv = driving_spread_side(gid) if EARLY else None
        capped = (abs(side_edge) > 14) and not (drv == pside)
        bs = best_spread(gid, pside); model_line = round(-r.pred_margin if ph else r.pred_margin, 1)
        cv, mam, sig = conv_for(gid, "spread", side=pside)
        if capped: cv, mam, sig = "none", False, []
        sp_conv, sp_mam, sp_sig, sp_has = cv, mam, sig, (not capped and cv != "none")
        vline = r.spread_close if ph else -r.spread_close
        rows.append(dict(game_id=gid, card_group="spread", bet_type="spread", sort_order=1, pick_side=pside, pick_team=pteam,
            pick_label=f"{pteam} {fmt_line(bs[0] if bs else vline)}", model_number=round(float(r.pred_margin), 1), model_line=model_line,
            vegas_line=round(float(vline), 1), vegas_price=-110, edge=round(abs(side_edge), 1),
            best_book=bs[2] if bs else None, best_line=round(bs[0], 1) if bs else None, best_odds=bs[1] if bs else None,
            conviction=cv, is_mammoth=mam, has_play=(not capped and cv != "none"), display_only=capped,
            signal_keys=sig, counter_signal_keys=counter_keys(gid, "spread", pside),
            stake_units=C.STAKE.get({"mammoth":"mammoth","high":"T1","med":"T2","low":"T3","lean":"track"}.get(cv,"track"),0)))
    # ---- TOTAL ----
    if pd.notna(r.total_edge):
        pside = "OVER" if r.total_edge > 0 else "UNDER"; bt = best_total(gid, pside)
        cv, mam, sig = conv_for(gid, "total", side=pside)
        rows.append(dict(game_id=gid, card_group="total", bet_type="total", sort_order=2, pick_side=pside, pick_team=None,
            pick_label=f"{pside.title()} {bt[0] if bt else r.total_close:g}", model_number=round(float(r.pred_total), 1), model_line=round(float(r.pred_total), 1),
            vegas_line=round(float(r.total_close), 1), vegas_price=-110, edge=round(abs(float(r.total_edge)), 1),
            best_book=bt[2] if bt else None, best_line=round(bt[0], 1) if bt else None, best_odds=bt[1] if bt else None,
            conviction=cv, is_mammoth=mam, has_play=(cv != "none"), display_only=False, signal_keys=sig,
            counter_signal_keys=counter_keys(gid, "total", pside),
            stake_units=C.STAKE.get({"mammoth":"mammoth","high":"T1","med":"T2","low":"T3","lean":"track"}.get(cv,"track"),0)))
    # ---- TEAM TOTALS (both, always) ----
    # TEAM TOTALS — UNIFIED: predicted points come from the FULL-GAME model (coherent with the headline score:
    # home+away = pred_total, home-away = pred_margin). Bet derives from that edge vs the posted team total.
    for team, bt_name, so, is_home in [(H, "team_total_home", 3, True), (A, "team_total_away", 3, False)]:
        proj = C.fg_team_pts(float(r.pred_total), float(r.pred_margin), is_home)
        p5 = (r.homeConference if is_home else r.awayConference) in C.P5CONF
        vg = tt_vegas(gid, team)         # posted team total may be missing -> show model only
        if vg is None:
            pside, edge, bt, ckey = None, None, None, None
        else:
            edge = proj - vg; pside = "OVER" if proj >= vg else "UNDER"
            # Weeks 1-3 the projections are the early blend, which tt_conv_key was never
            # validated on — model TT conviction off until wk4; flag signals still promote.
            ckey = None if EARLY else C.tt_conv_key(edge, pside, p5)
            bt = best_tt(gid, team, pside)
        play = ckey is not None
        cv = {"T1": "high", "T2": "med"}.get(ckey, "none")
        # Attach REAL flag keys (tt_away_under et al) so signal_performance can roll
        # them up — the old hardcoded ["team_total"] placeholder meant team-total
        # signals never accrued a season-to-date record. A firing flag also makes
        # the card a play at its own tier when the model's own tt edge is quiet.
        cv2, _m2, sig2 = conv_for(gid, "team_total", team=team, ou=pside) if pside else ("none", False, [])
        if sig2 and not play:
            play, cv = True, cv2
        line_disp = (bt[0] if bt else vg) if vg is not None else None
        rows.append(dict(game_id=gid, card_group="team_total", bet_type=bt_name, sort_order=so, pick_side=pside, pick_team=team,
            pick_label=(f"{team} {pside.title()} {line_disp:g}" if (vg is not None and pside) else f"{team} proj {proj:.1f} (no line)"),
            model_number=round(float(proj), 1), model_line=round(float(proj), 1),
            vegas_line=round(float(vg), 1) if vg is not None else None, vegas_price=-110 if vg is not None else None,
            edge=round(float(edge), 1) if edge is not None else None,
            best_book=bt[2] if bt else None, best_line=round(bt[0], 1) if bt else None, best_odds=bt[1] if bt else None,
            conviction=cv, is_mammoth=False, has_play=bool(play), display_only=(vg is None), signal_keys=(sorted(set(sig2)) or (["team_total"] if play else [])),
            counter_signal_keys=counter_keys(gid, "team_total", pside, team=team),
            stake_units=C.STAKE.get(ckey, 0) if play else 0))
    # ---- MONEYLINE — predicted winner (by predicted SCORE) + best price; signal pills only if a signal applies ----
    if pd.notna(r.pred_margin):
        ph = r.pred_margin > 0; pteam = H if ph else A; pside = "HOME" if ph else "AWAY"   # winner by predicted score
        bm = best_ml(gid, pside); vml = r.get("close_home_ml") if ph else r.get("close_away_ml")
        mlsig = conv_for(gid, "moneyline", side=pside)[2]   # generic: empty unless an ML signal exists
        rows.append(dict(game_id=gid, card_group="moneyline", bet_type="moneyline", sort_order=4, pick_side=pside, pick_team=pteam,
            pick_label=f"{pteam} ML", model_number=round(float(1/(1+np.exp(-r.pred_margin/9.5))), 3), model_line=None,
            vegas_line=None, vegas_price=round(float(vml), 0) if pd.notna(vml) else None, edge=None,
            best_book=bm[1] if bm else None, best_line=None, best_odds=bm[0] if bm else None,
            conviction="none", is_mammoth=False, has_play=False, display_only=True, signal_keys=mlsig, stake_units=0))
    # ---- 1H cards (model projection per game; vegas line + play only when posted) ----
    # Weeks 1-3: the 1H MODEL stays silent (cold nets -> spurious projections), but posted
    # 1H LINES render as display-only market cards — books do post wk1 1H lines (owner
    # 2026-08-24; the old "no book has posted" premise predates the live 1H capture).
    if EARLY:
        hs, tline = h1s_cons(gid), h1t_cons(gid)
        # Coherent early 1H projection from the displayed blend score (52.7%/59.9% shares —
        # same derivation as the games-table h1_pred columns). Display-only, never a play.
        _pm = float(r.pred_margin) if pd.notna(r.pred_margin) else None
        _pt = float(r.pred_total) if pd.notna(r.pred_total) else None
        h1_proj_m = round(0.599 * _pm, 1) if _pm is not None else None
        h1_proj_t = round(0.527 * _pt, 1) if _pt is not None else None
        if hs is not None:
            # Label = the side the MODEL's projection favors vs the line (owner 2026-08-24:
            # showing the market favorite in the pick slot reads as a wrong pick when the
            # model leans the other way — NDSU -3.5 vs a 0.3-margin projection).
            _cov = (h1_proj_m + hs) if h1_proj_m is not None else None   # >0 = home side covers
            _mh = _cov is None or _cov > 0
            _mteam, _mline = (H, hs) if _mh else (A, -hs)
            bsp = best_h1_spread(gid, "HOME" if _mh else "AWAY")
            rows.append(dict(game_id=gid, card_group="h1_spread", bet_type="h1_spread", sort_order=5,
                pick_side=("HOME" if _mh else "AWAY") if h1_proj_m is not None else None,
                pick_team=_mteam if h1_proj_m is not None else None,
                pick_label=f"{_mteam} 1H {fmt_line(_mline)}",
                model_number=h1_proj_m,
                # pick-perspective line, mirroring the FG spread card (away pick -> +margin)
                model_line=((-h1_proj_m if _mh else h1_proj_m) if h1_proj_m is not None else None),
                vegas_line=round(float(_mline), 1), vegas_price=-110,
                edge=None, best_book=bsp[2] if bsp else None, best_line=round(bsp[0], 1) if bsp else None,
                best_odds=bsp[1] if bsp else None, conviction="none", is_mammoth=False,
                has_play=False, display_only=True, signal_keys=[], stake_units=0))
        _mlrows = ev_rows(gid, "h2h_h1")
        if len(_mlrows):
            _mlrows = _mlrows.assign(nm=_mlrows.name.map(tdb))
            _mh = _mlrows[_mlrows.nm == _mlrows.home].price.median()
            _prob = None
            if h1_proj_m is not None:
                import math
                _prob = round(0.5 * (1 + math.erf((h1_proj_m) / (16.0 * math.sqrt(2)))), 3)
            rows.append(dict(game_id=gid, card_group="h1_ml", bet_type="h1_ml", sort_order=7,
                pick_side=None, pick_team=None,
                pick_label=f"{H} 1H ML {int(_mh):+d}" if pd.notna(_mh) else "1H ML",
                model_number=_prob, model_line=None,
                vegas_line=None, vegas_price=int(_mh) if pd.notna(_mh) else None,
                edge=None, best_book=None, best_line=None,
                best_odds=(lambda b: b[0] if b else None)(best_h1_ml(gid, "HOME")),
                conviction="none", is_mammoth=False, has_play=False, display_only=True,
                signal_keys=[], stake_units=0))
        if tline is not None:
            bht = best_h1_total(gid, "OVER")
            _lean = ("Over" if h1_proj_t > tline else "Under") if h1_proj_t is not None else None
            rows.append(dict(game_id=gid, card_group="h1_total", bet_type="h1_total", sort_order=6,
                pick_side=(_lean.upper() if _lean else None), pick_team=None,
                pick_label=(f"1H {_lean} {tline:g}" if _lean else f"1H O/U {tline:g}"),
                model_number=h1_proj_t, model_line=h1_proj_t,
                vegas_line=round(float(tline), 1), vegas_price=-110,
                edge=None, best_book=bht[2] if bht else None, best_line=round(bht[0], 1) if bht else None,
                best_odds=bht[1] if bht else None, conviction="none", is_mammoth=False,
                has_play=False, display_only=True, signal_keys=[], stake_units=0))
    if gid in h1proj and not EARLY:
        h1pm, h1pt = h1proj[gid]
        inrow = h1csv.loc[gid] if gid in h1csv.index else None
        # 1H SPREAD
        hs = h1s_cons(gid)
        ph = (h1pm + hs) > 0 if hs is not None else (h1pm > 0)
        pteam = H if ph else A; pside = "HOME" if ph else "AWAY"
        bsp = best_h1_spread(gid, pside) if hs is not None else None
        play = inrow is not None and isinstance(inrow.h1_spread_bet, str) and inrow.h1_spread_bet == pside
        cv, mam, sig = conv_for(gid, "h1_spread", side=pside) if play else ("none", False, [])
        vline = (hs if ph else -hs) if hs is not None else None
        rows.append(dict(game_id=gid, card_group="h1_spread", bet_type="h1_spread", sort_order=5, pick_side=pside, pick_team=pteam,
            pick_label=(f"{pteam} 1H {fmt_line(bsp[0] if bsp else vline)}" if vline is not None else f"{pteam} 1H proj {(-h1pm if ph else h1pm):.1f} (no line)"),
            model_number=round(float(h1pm), 1), model_line=round(float(-h1pm if ph else h1pm), 1),
            vegas_line=round(float(vline), 1) if vline is not None else None, vegas_price=-110 if vline is not None else None,
            edge=round(abs(h1pm + hs), 1) if hs is not None else None,
            best_book=bsp[2] if bsp else None, best_line=round(bsp[0], 1) if bsp else None, best_odds=bsp[1] if bsp else None,
            conviction=cv, is_mammoth=False, has_play=bool(play), display_only=not play, signal_keys=sig, stake_units=1.0 if play else 0))
        # 1H TOTAL
        tline = h1t_cons(gid)
        pside_t = ("OVER" if h1pt > tline else "UNDER") if tline is not None else None
        bht = best_h1_total(gid, pside_t) if tline is not None else None
        play_t = inrow is not None and isinstance(inrow.h1_tot_bet, str) and pside_t is not None and inrow.h1_tot_bet.startswith(pside_t)
        cv, mam, sig = conv_for(gid, "h1_total", side=pside_t) if play_t else ("none", False, [])
        rows.append(dict(game_id=gid, card_group="h1_total", bet_type="h1_total", sort_order=6, pick_side=pside_t, pick_team=None,
            pick_label=(f"1H {pside_t.title()} {bht[0] if bht else tline:g}" if tline is not None else f"1H total proj {h1pt:.1f} (no line)"),
            model_number=round(float(h1pt), 1), model_line=round(float(h1pt), 1),
            vegas_line=round(float(tline), 1) if tline is not None else None, vegas_price=-110 if tline is not None else None,
            edge=round(abs(h1pt - tline), 1) if tline is not None else None,
            best_book=bht[2] if bht else None, best_line=round(bht[0], 1) if bht else None, best_odds=bht[1] if bht else None,
            conviction=cv, is_mammoth=False, has_play=bool(play_t), display_only=not play_t, signal_keys=sig, stake_units=1.0 if play_t else 0))
        # 1H ML — predicted 1H leader + best price; signal pill only if the dog-conversion play fires
        ph2 = h1pm > 0; pteam2 = H if ph2 else A; pside2 = "HOME" if ph2 else "AWAY"
        bhm = best_h1_ml(gid, pside2)
        play_m = inrow is not None and isinstance(inrow.h1_ml_bet, str) and bool(inrow.h1_ml_bet) and (pside2 in inrow.h1_ml_bet)
        rows.append(dict(game_id=gid, card_group="h1_ml", bet_type="h1_ml", sort_order=7, pick_side=pside2, pick_team=pteam2,
            pick_label=f"{pteam2} 1H ML", model_number=round(float(1/(1+np.exp(-h1pm/5.5))), 3), model_line=None,
            vegas_line=None, vegas_price=None, edge=None,
            best_book=bhm[1] if bhm else None, best_line=None, best_odds=bhm[0] if bhm else None,
            conviction="none", is_mammoth=False, has_play=bool(play_m), display_only=not play_m,
            signal_keys=["h1_ml"] if play_m else [], stake_units=0.5 if play_m else 0))

df = pd.DataFrame(rows)
if "counter_signal_keys" in df.columns:
    df["counter_signal_keys"] = df.counter_signal_keys.map(lambda v: v if isinstance(v, list) else [])
else:
    df["counter_signal_keys"] = [[] for _ in range(len(df))]
df["recommendation"] = [C.recommendation(c, h) for c, h in zip(df.conviction, df.has_play)]  # ready-to-display label
# display-only markets show a predicted winner, not a graded bet -> clearer labels than "No Bet"/"Play"
df.loc[df.card_group == "moneyline", "recommendation"] = "Predicted Winner"
df.loc[(df.card_group == "h1_ml") & (~df.has_play), "recommendation"] = "Predicted Winner"
df.loc[(df.card_group == "h1_ml") & (df.has_play), "recommendation"] = "Small Lean"
for c in ["best_book_name", "best_book_logo"]:
    df[c] = None
# fallback: if no per-book best line was found but a consensus (vegas) line exists, show the consensus
# so every market with ANY posted line still displays a line (book logo just absent).
_fb = df.best_line.isna() & df.vegas_line.notna() & ~df.card_group.isin(["moneyline", "h1_ml"])
df.loc[_fb, "best_line"] = df.loc[_fb, "vegas_line"]; df.loc[_fb, "best_odds"] = -110
df["best_book_name"] = df.best_book.map(lambda k: book_meta(k)[0] if k else None)
df["best_book_logo"] = df.best_book.map(lambda k: book_meta(k)[1] if k else None)
print(f"cfb_dryrun_picks rows: {len(df)} | cards/game avg {len(df)/te.game_id.nunique():.1f}")
print(f"  has_play: {int(df.has_play.sum())} | by card_group: {df.card_group.value_counts().to_dict()}")
print(f"  best_book coverage: {int(df.best_book.notna().sum())}/{len(df)}")

# SIGN GUARD (mandatory, per the sign-conventions law): a pick card must NEVER contradict
# the games row it renders under — UTEP@OU 2026-wk1 shipped "Oklahoma -39.5" while the game
# row correctly said AWAY. Cross-check spread + total sides against cfb_dryrun_games and
# refuse to write on ANY mismatch (hard fail stops the runner before users see it).
_g = requests.get(f"{C.URL}/rest/v1/cfb_slate_games?season=eq.{SEASON}&week=eq.{WEEK}"
                  f"&select=game_id,fg_spread_pick,fg_total_pick", headers={**C.H, "Prefer": ""}).json()
_gsp = {int(x["game_id"]): x["fg_spread_pick"] for x in _g if x.get("fg_spread_pick")}
_gtp = {int(x["game_id"]): x["fg_total_pick"] for x in _g if x.get("fg_total_pick")}
_bad = []
for _, r in df[df.pick_side.notna()].iterrows():
    want = _gsp.get(int(r.game_id)) if r.bet_type == "spread" else (
        _gtp.get(int(r.game_id)) if r.bet_type == "total" else None)
    if want and r.pick_side != want:
        _bad.append((int(r.game_id), r.bet_type, r.pick_side, f"games={want}"))
if _bad:
    raise SystemExit(f"[SIGN GUARD] {len(_bad)} pick(s) contradict cfb_dryrun_games — REFUSING TO WRITE: {_bad[:6]}")
print(f"  sign guard: {len(df[(df.bet_type == 'spread') & df.pick_side.notna()])} spread + "
      f"{len(df[(df.bet_type == 'total') & df.pick_side.notna()])} total sides agree with games table")

C.wipe("cfb_dryrun_picks", f"season=eq.{SEASON}&week=eq.{WEEK}")
df["season"] = SEASON; df["week"] = WEEK
C.insert("cfb_dryrun_picks", df)

# conviction_summary onto games (slate pills)
summ = {}
for gid, sub in df[df.has_play].groupby("game_id"):
    items = []
    for cg, s2 in sub.groupby("card_group"):
        top = max(s2.conviction, key=lambda c: ["lean","low","med","high","mammoth"].index(c) if c in ["lean","low","med","high","mammoth"] else -1)
        items.append({"card": cg, "conviction": top, "mammoth": bool(s2.is_mammoth.any())})
    summ[int(gid)] = items
for gid in g7:
    requests.patch(f"{C.URL}/rest/v1/cfb_slate_games?game_id=eq.{gid}", headers=C.H,
                   data=json.dumps({"conviction_summary": summ.get(int(gid), [])}))
print("  conviction_summary written to games")
