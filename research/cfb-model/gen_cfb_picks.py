"""Generate cfb_dryrun_picks — one row per bet-type per game (the prediction cards). Everything precomputed:
model number, fair line, vegas consensus line, edge, BEST book line+odds+logo, conviction, signals, has_play.
Best line rule: spread/h1_spread -> max line for the pick side (fewer to lay / more to take); total/team_total/
h1_total -> OVER=lowest line, UNDER=highest line; ties + moneyline -> highest American odds (best price).
Also writes conviction_summary onto cfb_dryrun_games for the slate pills."""
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
g7 = set(te.game_id)
names = sorted(set(gm.homeTeam) | set(gm.awayTeam))
AL = {"Appalachian State Mountaineers": "App State", "Hawaii Rainbow Warriors": "Hawai'i",
      "UMass Minutemen": "Massachusetts", "San Jose State Spartans": "San José State", "Southern Miss Golden Eagles": "Southern Miss"}
def tdb(o):
    if o in AL: return AL[o]
    c = [x for x in names if str(o).startswith(str(x) + " ") or o == x]; c.sort(key=len, reverse=True)
    return c[0] if c else None

# ---- per-book FULL-GAME close lines (odds_history -> cfbd game) ----
oh = pd.read_parquet("data/odds_history/odds_2025.parquet")
oh["h"] = oh.home_team.map(tdb); oh["a"] = oh.away_team.map(tdb); oh = oh.dropna(subset=["h", "a"])
pair2gid = {(r.homeTeam, r.awayTeam): r.game_id for _, r in te.iterrows()}
oh["gid"] = [pair2gid.get((h, a)) for h, a in zip(oh.h, oh.a)]
oh = oh[oh.gid.notna() & (oh.hrs_to_kick > 0)].sort_values("hrs_to_kick")
fg = oh.drop_duplicates(["gid", "book"], keep="first")  # close = nearest pre-kick per book
FG = {}
for _, r in fg.iterrows():
    FG[(int(r.gid), r.book)] = r

# ---- per-book TT + 1H close lines (event odds) ----
ev = pd.read_parquet("data/event_odds/events_2025.parquet"); ev = ev[ev.game_id.isin(g7)].copy()
ev["snap_dt"] = pd.to_datetime(ev.snap, utc=True); ev["description"] = ev.description.fillna("_")
ev = ev.sort_values("snap_dt").groupby(["game_id", "market", "book", "name", "description"], as_index=False).last()

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
h1csv = pd.read_csv("out/cfb_h1_model_2025.csv").set_index("game_id")   # only games with a 1H PLAY
def h1s_cons(gid):
    s = ev_rows(gid, "spreads_h1"); s = s.assign(nm=s.name.map(tdb)); s = s[s.nm == s.home]
    return float(s.point.median()) if len(s) else None
def h1t_cons(gid):
    s = ev_rows(gid, "totals_h1", "Over"); return float(s.point.median()) if len(s) else None

# ---- flags (conviction + signals per card) from the loaded table ----
fl = requests.get(f"{C.URL}/rest/v1/cfb_dryrun_flags?week=eq.{WEEK}&select=*", headers={**C.H, "Prefer": ""}).json()
flags = pd.DataFrame(fl)
CG = {"spread": "spread", "total": "total", "team_total": "team_total", "h1_spread": "h1_spread", "h1_total": "h1_total", "h1_ml": "h1_ml"}
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
def fmt_line(v): return ("+" if v > 0 else "") + f"{v:g}" if v is not None else None
for _, r in te.iterrows():
    gid = int(r.game_id); H, A = r.homeTeam, r.awayTeam
    side_edge = float(r.side_edge) if pd.notna(r.side_edge) else None
    sp_conv, sp_mam, sp_sig, sp_has = "none", False, [], False   # captured for ML inheritance
    # ---- SPREAD ----
    if side_edge is not None:
        ph = side_edge > 0; pteam = H if ph else A; pside = "HOME" if ph else "AWAY"
        capped = abs(side_edge) > 14
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
            signal_keys=sig, stake_units=C.STAKE.get({"mammoth":"mammoth","high":"T1","med":"T2","low":"T3","lean":"track"}.get(cv,"track"),0)))
    # ---- TOTAL ----
    if pd.notna(r.total_edge):
        pside = "OVER" if r.total_edge > 0 else "UNDER"; bt = best_total(gid, pside)
        cv, mam, sig = conv_for(gid, "total", side=pside)
        rows.append(dict(game_id=gid, card_group="total", bet_type="total", sort_order=2, pick_side=pside, pick_team=None,
            pick_label=f"{pside.title()} {bt[0] if bt else r.total_close:g}", model_number=round(float(r.pred_total), 1), model_line=round(float(r.pred_total), 1),
            vegas_line=round(float(r.total_close), 1), vegas_price=-110, edge=round(abs(float(r.total_edge)), 1),
            best_book=bt[2] if bt else None, best_line=round(bt[0], 1) if bt else None, best_odds=bt[1] if bt else None,
            conviction=cv, is_mammoth=mam, has_play=(cv != "none"), display_only=False, signal_keys=sig,
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
            ckey = C.tt_conv_key(edge, pside, p5); bt = best_tt(gid, team, pside)
        play = ckey is not None
        cv = {"T1": "high", "T2": "med"}.get(ckey, "none")
        line_disp = (bt[0] if bt else vg) if vg is not None else None
        rows.append(dict(game_id=gid, card_group="team_total", bet_type=bt_name, sort_order=so, pick_side=pside, pick_team=team,
            pick_label=(f"{team} {pside.title()} {line_disp:g}" if (vg is not None and pside) else f"{team} proj {proj:g} (no line)"),
            model_number=round(float(proj), 1), model_line=round(float(proj), 1),
            vegas_line=round(float(vg), 1) if vg is not None else None, vegas_price=-110 if vg is not None else None,
            edge=round(float(edge), 1) if edge is not None else None,
            best_book=bt[2] if bt else None, best_line=round(bt[0], 1) if bt else None, best_odds=bt[1] if bt else None,
            conviction=cv, is_mammoth=False, has_play=bool(play), display_only=(vg is None), signal_keys=(["team_total"] if play else []),
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
    # ---- 1H cards (ALWAYS emit model projection for every game; vegas line + play only when posted) ----
    if gid in h1proj:
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
            pick_label=(f"{pteam} 1H {fmt_line(bsp[0] if bsp else vline)}" if vline is not None else f"{pteam} 1H proj {-h1pm if ph else h1pm:g} (no line)"),
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
            pick_label=(f"1H {pside_t.title()} {bht[0] if bht else tline:g}" if tline is not None else f"1H total proj {h1pt:g} (no line)"),
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
    requests.patch(f"{C.URL}/rest/v1/cfb_dryrun_games?game_id=eq.{gid}", headers=C.H,
                   data=json.dumps({"conviction_summary": summ.get(int(gid), [])}))
print("  conviction_summary written to games")
