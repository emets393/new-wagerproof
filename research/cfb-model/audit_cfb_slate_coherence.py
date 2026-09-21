"""Coherence audit for one CFB slate week: every number the apps render for a game must agree.

Checks cfb_slate_games x cfb_slate_picks x cfb_slate_flags for (season, week):
  - pick cards: side/sign of model_line, vegas_line vs the game row; total/ML/1H/TT sides vs the projection
  - fg_home_cover_prob (the SCOREBOARD's spread side) vs fg_spread_pick
  - flags: model-keyed signals vs the model's close-basis side; displayed line vs the Odds-API line
Exit 1 on any contradiction. Run after gen_cfb_picks.py (also called at the end of run_cfb_week.sh).
"""
import sys, requests, numpy as np, pandas as pd
import dry_common as C

SEASON, WEEK = C.season_week()

def q(t, sel, extra=""):
    r = requests.get(f"{C.URL}/rest/v1/{t}?season=eq.{SEASON}&week=eq.{WEEK}{extra}&select={sel}", headers=C.H, timeout=60)
    r.raise_for_status()
    return pd.DataFrame(r.json())

p = q("cfb_slate_picks", "game_id,card_group,pick_side,pick_team,pick_label,model_line,vegas_line,edge,has_play,conviction")
g = q("cfb_slate_games", "game_id,away_team,home_team,fg_pred_away_pts,fg_pred_home_pts,fg_pred_margin,fg_pred_spread,"
      "fg_spread_open,fg_spread_close,fg_spread_edge,fg_spread_pick,fg_spread_capped,fg_pred_total,fg_total_open,fg_total_close,"
      "fg_total_edge,fg_total_pick,fg_home_win_prob,fg_home_cover_prob,h1_pred_margin,h1_pred_total,h1_spread_close,"
      "h1_total_close,h1_spread_pick,h1_total_pick,tt_home_close,tt_away_close")
f = q("cfb_slate_flags", "game_id,game,signal_key,market,side,line,grade_line,tier")
issues, notes = [], []

for _, r in p.merge(g, on="game_id").iterrows():
    cg, ps, lab = r.card_group, r.pick_side, f"{r.away_team} @ {r.home_team}"
    # Market line and model line on a spread card must be written from the SAME team, pick or no
    # pick — the bar needs both on one side (the hourly refresher flipped 17 no-side cards, wk4-2026).
    if cg == "spread" and pd.notna(r.model_line) and pd.notna(r.vegas_line) and pd.notna(r.fg_pred_spread) and pd.notna(r.fg_spread_close) \
            and abs(r.fg_pred_spread) >= 0.3 and abs(r.fg_spread_close) >= 0.3:
        mo = "HOME" if abs(r.model_line - r.fg_pred_spread) <= abs(r.model_line + r.fg_pred_spread) else "AWAY"
        vo = "HOME" if abs(r.vegas_line - r.fg_spread_close) <= abs(r.vegas_line + r.fg_spread_close) else "AWAY"
        if mo != vo: issues.append((lab, cg, "market line and model line on different teams", f"vegas={vo} {r.vegas_line}", f"model={mo} {r.model_line}"))
    if cg == "spread" and ps in ("HOME", "AWAY"):
        exp = r.fg_pred_spread if ps == "HOME" else -r.fg_pred_spread
        if pd.notna(r.model_line) and abs(r.model_line - exp) > 0.15: issues.append((lab, cg, "model_line sign", r.model_line, exp))
        if r.fg_spread_pick and ps != r.fg_spread_pick: issues.append((lab, cg, "side vs game row", ps, r.fg_spread_pick))
        if not r.fg_spread_pick: issues.append((lab, cg, "card has a side, game row has none", ps, r.fg_spread_capped))
        if pd.notna(r.edge) and r.edge < 0: issues.append((lab, cg, "negative edge", r.edge, None))
    elif cg == "total" and ps in ("OVER", "UNDER"):
        exp = "OVER" if r.fg_pred_total > r.fg_total_close else "UNDER"
        if ps != exp: issues.append((lab, cg, "side vs projection/close", ps, exp))
        if r.fg_total_pick and ps != r.fg_total_pick: issues.append((lab, cg, "side vs game row", ps, r.fg_total_pick))
    elif cg == "moneyline" and ps in ("HOME", "AWAY"):
        exp = "HOME" if r.fg_pred_home_pts > r.fg_pred_away_pts else "AWAY"
        if ps != exp: issues.append((lab, cg, "ML side vs projected score", ps, exp))
    elif cg == "h1_spread" and ps in ("HOME", "AWAY") and pd.notna(r.h1_spread_close) and pd.notna(r.h1_pred_margin):
        exp = "HOME" if r.h1_pred_margin + r.h1_spread_close > 0 else "AWAY"
        if ps != exp: issues.append((lab, cg, "1H side vs margin/close", ps, exp))
    elif cg == "h1_total" and ps in ("OVER", "UNDER") and pd.notna(r.h1_total_close) and pd.notna(r.h1_pred_total):
        exp = "OVER" if r.h1_pred_total > r.h1_total_close else "UNDER"
        if ps != exp: issues.append((lab, cg, "1H total vs projection/close", ps, exp))
    elif cg == "team_total" and r.pick_team and ps in ("OVER", "UNDER"):
        ish = r.pick_team == r.home_team
        pts, cl = (r.fg_pred_home_pts, r.tt_home_close) if ish else (r.fg_pred_away_pts, r.tt_away_close)
        if pd.notna(cl) and pd.notna(pts) and ps != ("OVER" if pts > cl else "UNDER"):
            issues.append((lab, cg, f"TT {r.pick_team} side vs projected pts/close", ps, f"pts={pts} close={cl}"))

# scoreboard spread side = cover prob > 0.5
gg = g[g.fg_spread_pick.notna() & g.fg_home_cover_prob.notna()]
for _, r in gg.iterrows():
    cp_side = "HOME" if r.fg_home_cover_prob > 0.5 else "AWAY"
    if cp_side != r.fg_spread_pick:
        issues.append((f"{r.away_team} @ {r.home_team}", "cover_prob", "scoreboard side vs pick", r.fg_home_cover_prob, r.fg_spread_pick))
ww = g[((g.fg_home_win_prob > 0.5) & (g.fg_pred_home_pts < g.fg_pred_away_pts)) | ((g.fg_home_win_prob < 0.5) & (g.fg_pred_home_pts > g.fg_pred_away_pts))]
for _, r in ww.iterrows():
    issues.append((f"{r.away_team} @ {r.home_team}", "win_prob", "win prob vs projected score", r.fg_home_win_prob, None))

# flags
MODEL_KEYS = {"model_highedge_dog", "model_total_over", "model_total_under", "model_total_over_pace", "model_road_value"}
if len(f):
    m = f.merge(g, on="game_id")
    for _, r in m.iterrows():
        if r.market == "spread":
            model_side = "HOME" if r.fg_spread_edge >= 0 else "AWAY"
            odds = r.fg_spread_open if r.grade_line == "open" else r.fg_spread_close
        else:
            model_side = "OVER" if r.fg_total_edge > 0 else "UNDER"
            odds = r.fg_total_open if r.grade_line == "open" else r.fg_total_close
        if r.signal_key in MODEL_KEYS and r.side != model_side:
            issues.append((r.game, "flag", f"{r.signal_key} contradicts the model", r.side, model_side))
        # A flag keeps the line it fired at (grade line = signal line) while the hourly refresher
        # moves the game row's close, so in-week drift is expected and only NOTED. Anything
        # over a key number's worth (3 pts) is printed loudly so a stale flag can be re-fired.
        if pd.notna(r.line) and pd.notna(odds) and abs(r.line - odds) > 0.3:
            notes.append((r.game, "flag", f"{r.signal_key} fired at a different {r.grade_line} than the row now shows", r.line, odds))

# every flag the app shows must resolve to a definition row (the "Looking-Ahead Spot with no
# definition" report, 2026-09-20: three paper-track keys had no cfb_signal_defs entry)
if len(f):
    defs = requests.get(f"{C.URL}/rest/v1/cfb_signal_defs?select=signal_key&limit=500", headers=C.H, timeout=60).json()
    have = {d["signal_key"] for d in defs} if isinstance(defs, list) else set()
    for k in sorted(set(f.signal_key) - have):
        issues.append(("(all)", "flag", f"{k} has no cfb_signal_defs row — add it to gen_cfb_signal_defs.py", k, None))

pd.set_option("display.width", 250); pd.set_option("display.max_colwidth", 60)
I = pd.DataFrame(issues, columns=["game", "where", "issue", "got", "expected"])
N = pd.DataFrame(notes, columns=["game", "where", "issue", "got", "expected"])
print(f"cfb slate coherence {SEASON} wk{WEEK}: {len(g)} games, {len(p)} cards, {len(f)} flags -> {len(I)} contradictions, {len(N)} line-drift notes")
if len(N):
    big = N[(N.got - N.expected).abs() >= 3]
    if len(big): print("  line moved 3+ pts since the flag fired:"); print(big.to_string(index=False))
if len(I):
    print(I.to_string(index=False))
    sys.exit(1)
