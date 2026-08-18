"""Generate cfb_dryrun_flags — one row per fired bet signal, Week-7 2025. Spread/total flags come from the
AUTHORITATIVE spot_library (each flag carries ITS OWN side — fixes the conflicting-spots bug where the net
sides_bet mislabeled games like Ohio State@Illinois). Team-total + 1H flags from the harness CSVs.
Each flag: market, side, line (its grade_line), edge, conviction, active/tracking, stake. Back-fills game counts."""
import os
import numpy as np, pandas as pd, warnings, requests, json
import dry_common as C
import cfb_style_delta as SD
import cfb_early_roster_signals as ER
warnings.filterwarnings("ignore")
SEASON, WEEK = C.season_week()

gm, te, S = C.harness_week(SEASON, WEEK)
# OWNER RULE: every signal conditions on ODDS-API lines, never CFBD consensus. 2026 wk1 audit
# found 5/51 CFBD lines bad (2 sign-FLIPPED: Miami@Stanford, Coastal@WVU; 3 zero-filled read
# as pick'em). Override te's close lines from odds_game_frame; no Odds-API line -> NaN (skip).
_ogf = pd.read_parquet("data/odds_game_frame.parquet")
_ogf = _ogf[_ogf.season == SEASON][["home", "away", "open_spread", "close_spread", "open_total", "close_total"]]
te = te.merge(_ogf, left_on=["homeTeam", "awayTeam"], right_on=["home", "away"], how="left")
te["spread_close"] = te["close_spread"]
te["total_close"] = te["close_total"]
g7 = set(te.game_id)
def lab(r): return f"{r.awayTeam} @ {r.homeTeam}"
rows = []

# Cold-model spots are DEGENERATE in weeks 1-3 (opponent-adjusted model has no games -> uniform
# edges), so suppress all MODEL-EDGE spot keys early. Contextual spots (g5/key/conf/book/style)
# still fire. Previously this was only a one-off DB delete; now durable in the generator.
EARLY_SUPPRESS = {"model_highedge_dog", "model_total_over", "model_total_under",
                  "model_total_over_pace", "model_road_value", "premium_lay_fav"}

# spread/total spots from spot_library (true per-spot side)
for name, (mask, side, market, gl) in S.items():
    if C.is_blanket(name): continue   # skip slate-wide leans (week==N openers, base model_lean) — not per-game signals
    if WEEK <= 3 and C.key_for(name) in EARLY_SUPPRESS: continue   # cold-model spots off until wk4
    sub = te[mask.reindex(te.index, fill_value=False).values] if hasattr(mask, "reindex") else te[mask]
    meta = C.classify(name); conv = meta[2] if meta else "T3"; active = meta[3] if meta else True
    mkt_norm = "total" if market == "total" else "spread"   # spot_library uses 'side' for spreads
    for _, r in sub.iterrows():
        if market == "total":
            line = C.total_line(r, gl); edge = r.total_edge
        else:
            line = C.spread_line(r, gl, side); edge = r.side_edge
        is_mam = bool(r.mammoth == 1 and mkt_norm == "spread" and side == C.model_side(r))
        rows.append({"game_id": int(r.game_id), "season": SEASON, "week": WEEK, "game": lab(r),
                     "source": name, "signal_key": C.key_for(name), "market": mkt_norm, "side": side,
                     "line": round(float(line), 1) if pd.notna(line) else None, "price": -110,
                     "edge": round(float(edge), 1) if pd.notna(edge) else None,
                     "conviction": "mammoth" if is_mam else conv, "tier": "active" if active else "tracking",
                     "stake_units": C.STAKE["mammoth" if is_mam else conv], "grade_line": gl, "mammoth": is_mam})

# team-total flags — UNIFIED: full-game-derived team points vs posted team total (coherent with the score).
# event-odds (per-team totals) aren't captured preseason -> empty frame so TT flags just don't fire; the
# other spots (model, G5 openers, style) still generate.
_evp = f"data/event_odds/events_{SEASON}.parquet"
_EVC = ["game_id", "market", "name", "description", "point"]
ev = pd.read_parquet(_evp) if os.path.exists(_evp) else pd.DataFrame(columns=_EVC)
if ev.empty or "game_id" not in ev.columns:  # preseason: schema-less 0-row parquet
    ev = pd.DataFrame(columns=_EVC)
ev = ev[(ev.game_id.isin(g7)) & (ev.market == "team_totals") & (ev.name == "Over")].copy()
def _tdb(o):
    AL = {"Appalachian State Mountaineers": "App State", "Hawaii Rainbow Warriors": "Hawai'i", "UMass Minutemen": "Massachusetts", "San Jose State Spartans": "San José State", "Southern Miss Golden Eagles": "Southern Miss"}
    nm = sorted(set(gm.homeTeam) | set(gm.awayTeam))
    if o in AL: return AL[o]
    c = [x for x in nm if str(o).startswith(str(x) + " ") or o == x]; c.sort(key=len, reverse=True); return c[0] if c else None
ev["team"] = ev.description.map(_tdb); ev = ev.dropna(subset=["team", "point"])
tt_cons = ev.groupby(["game_id", "team"]).point.median(); tt_bu = ev.groupby(["game_id", "team"]).point.max(); tt_bo = ev.groupby(["game_id", "team"]).point.min()
for _, r in te.iterrows():
    for team, is_home in [(r.homeTeam, True), (r.awayTeam, False)]:
        if (r.game_id, team) not in tt_cons.index or pd.isna(r.pred_total): continue
        proj = C.fg_team_pts(float(r.pred_total), float(r.pred_margin), is_home); vg = float(tt_cons[(r.game_id, team)])
        p5 = (r.homeConference if is_home else r.awayConference) in C.P5CONF
        pside = "OVER" if proj >= vg else "UNDER"; ck = C.tt_conv_key(proj - vg, pside, p5)
        if not ck: continue
        line = float(tt_bu[(r.game_id, team)] if pside == "UNDER" else tt_bo[(r.game_id, team)])
        rows.append({"game_id": int(r.game_id), "season": SEASON, "week": WEEK, "game": f"{r.awayTeam} @ {r.homeTeam}",
                     "source": f"TEAM-TOTAL {team} ({'P5' if p5 else 'G5'})", "signal_key": "team_total", "market": "team_total",
                     "side": f"{team} {pside}", "line": round(line, 1), "price": -110, "edge": round(proj - vg, 1),
                     "conviction": ck, "tier": "active", "stake_units": C.STAKE[ck], "grade_line": "best", "mammoth": False})

# 1H flags (harness CSV absent preseason -> empty so 1H flags just don't fire)
_h1p = f"out/cfb_h1_model_{SEASON}.csv"
h1 = pd.read_csv(_h1p) if os.path.exists(_h1p) else pd.DataFrame(columns=["game_id"])
h1 = h1[h1.game_id.isin(g7)]
for _, r in h1.iterrows():
    g = f"{r.awayTeam} @ {r.homeTeam}"
    if isinstance(r.h1_spread_bet, str) and r.h1_spread_bet:
        rows.append({"game_id": int(r.game_id), "season": SEASON, "week": WEEK, "game": g, "source": "1H spread (NOSTR model)",
                     "signal_key": "h1_spread", "market": "h1_spread", "side": r.h1_spread_bet, "line": round(float(r.hs), 1), "price": -110,
                     "edge": round(float(r.h1_spread_edge), 1), "conviction": "T3", "tier": "active", "stake_units": 1.0, "grade_line": "close", "mammoth": False})
    if isinstance(r.h1_tot_bet, str) and r.h1_tot_bet:
        side = r.h1_tot_bet.split("@")[0]; line = r.h1t_hi if side == "UNDER" else r.h1t_lo
        rows.append({"game_id": int(r.game_id), "season": SEASON, "week": WEEK, "game": g, "source": "1H total (pruned tempo model)",
                     "signal_key": "h1_total", "market": "h1_total", "side": side, "line": round(float(line), 1) if pd.notna(line) else None, "price": -110,
                     "edge": round(float(r.h1_pt - line), 1) if pd.notna(line) else None, "conviction": "T3", "tier": "active", "stake_units": 1.0, "grade_line": "best", "mammoth": False})
    if isinstance(r.h1_ml_bet, str) and r.h1_ml_bet:
        side = "HOME" if "HOME" in r.h1_ml_bet else "AWAY"; ml = r.mlh_best if side == "HOME" else r.mla_best
        rows.append({"game_id": int(r.game_id), "season": SEASON, "week": WEEK, "game": g, "source": "1H ML (dog-conversion, track-live)",
                     "signal_key": "h1_ml", "market": "h1_ml", "side": f"{side} ML", "line": round(float(ml)) if pd.notna(ml) else None, "price": round(float(ml)) if pd.notna(ml) else None,
                     "edge": None, "conviction": "track", "tier": "tracking", "stake_units": 0.5, "grade_line": "best", "mammoth": False})

# Week-1 situational spot: G5 underdog getting 21-27.5 from a P5 favorite in the opener.
# Pure situational (no model edge) — the dog has covered ~76% here (8/9 openers, ~41 games).
# line = signed home spread (same convention as the spot_library spread flags); side = the G5 dog.
if WEEK == 1:
    G5CONF = {"American Athletic", "Conference USA", "Mid-American", "Mountain West", "Sun Belt"}
    for _, r in te.iterrows():
        sp = r.spread_close  # home spread; <0 = home favored
        if pd.isna(sp) or not (21 <= abs(float(sp)) < 28):
            continue
        hc, ac = r.homeConference, r.awayConference
        home_p5, away_p5 = hc in C.P5CONF, ac in C.P5CONF
        home_g5, away_g5 = hc in G5CONF, ac in G5CONF
        if not ((home_p5 and away_g5) or (away_p5 and home_g5)):
            continue
        fav_is_home = sp < 0
        # only the standard shape: P5 is the favorite, the G5 is the dog getting points
        if not ((fav_is_home and home_p5) or ((not fav_is_home) and away_p5)):
            continue
        dog_side = "AWAY" if fav_is_home else "HOME"
        rows.append({"game_id": int(r.game_id), "season": SEASON, "week": WEEK,
                     "game": f"{r.awayTeam} @ {r.homeTeam}", "source": "G5 dog vs P5 (Wk1, laying 21-27.5)",
                     "signal_key": "g5_dog_wk1_bigfav", "market": "spread", "side": dog_side,
                     "line": round(float(sp), 1), "price": -110, "edge": None,
                     "conviction": "T3", "tier": "active", "stake_units": C.STAKE["T3"],
                     "grade_line": "close", "mammoth": False})

    # Week-1 situational team total: the G5 offense gets held under in a competitive opener (spread < 21)
    # vs a P5 defense — its team total goes UNDER (~73%, under-leaning all 3 seasons; TT data 2023+).
    for _, r in te.iterrows():
        sp = r.spread_close
        if pd.isna(sp) or abs(float(sp)) >= 21:
            continue
        for team, my_conf, opp_conf in [(r.homeTeam, r.homeConference, r.awayConference),
                                        (r.awayTeam, r.awayConference, r.homeConference)]:
            if my_conf in G5CONF and opp_conf in C.P5CONF and (r.game_id, team) in tt_bu.index:
                line = float(tt_bu[(r.game_id, team)])  # highest posted number = best price for the UNDER
                rows.append({"game_id": int(r.game_id), "season": SEASON, "week": WEEK,
                             "game": f"{r.awayTeam} @ {r.homeTeam}", "source": f"G5 team-total UNDER {team} (Wk1, spread<21)",
                             "signal_key": "g5_tt_under_wk1", "market": "team_total", "side": f"{team} UNDER",
                             "line": round(line, 1), "price": -110, "edge": None,
                             "conviction": "T3", "tier": "active", "stake_units": C.STAKE["T3"],
                             "grade_line": "best", "mammoth": False})

# ── S-CFB1 style-delta UNDER: offense has underperformed its baseline vs the opp's DEF archetype (≥2 priors)
#    → bet the UNDER (game total + that team's team total). Leak-safe deltas from prior completed games. ──
try:
    matchups = []
    for _, r in te.iterrows():
        matchups += [(r.homeTeam, r.awayTeam), (r.awayTeam, r.homeTeam)]
    fired = SD.deltas_for_week(SEASON, WEEK, matchups)
    for _, r in te.iterrows():
        hf, af = fired.get(r.homeTeam), fired.get(r.awayTeam)
        if hf or af:
            best = min([f for f in (hf, af) if f], key=lambda x: x["delta"])
            if pd.notna(r.total_close):
                rows.append({"game_id": int(r.game_id), "season": SEASON, "week": WEEK,
                             "game": f"{r.awayTeam} @ {r.homeTeam}", "source": "Style under (offense underperforms opp D-archetype)",
                             "signal_key": "style_offense_under", "market": "total", "side": "UNDER",
                             "line": round(float(r.total_close), 1), "price": -110, "edge": best["delta"],
                             "conviction": best["tier"], "tier": "active", "stake_units": C.STAKE[best["tier"]],
                             "grade_line": "close", "mammoth": False})
        for team, info in [(r.homeTeam, hf), (r.awayTeam, af)]:
            if info and (r.game_id, team) in tt_bu.index:
                rows.append({"game_id": int(r.game_id), "season": SEASON, "week": WEEK,
                             "game": f"{r.awayTeam} @ {r.homeTeam}", "source": f"Style TT under {team} (offense underperforms opp D-archetype)",
                             "signal_key": "style_offense_under", "market": "team_total", "side": f"{team} UNDER",
                             "line": round(float(tt_bu[(r.game_id, team)]), 1), "price": -110, "edge": info["delta"],
                             "conviction": info["tier"], "tier": "active", "stake_units": C.STAKE[info["tier"]],
                             "grade_line": "best", "mammoth": False})
except Exception as e:
    print(f"  [style_offense_under] skipped: {e}")

# ── Weeks 1-3 early-roster ATS: back the more-experienced roster (ret_prod_edge, T2) and the big portal-talent
#    haul (portal_talent_influx, T3). Preseason-known, leak-safe; decays after wk3 so it only fires wk1-3. ──
try:
    matchups = []
    for _, r in te.iterrows():
        # conference-game flag: ret_prod_edge is non-conference-only (validated split, see
        # cfb_early_roster_signals docstring / FOOTBALL_PROFILES S-CFB2)
        is_conf = bool(pd.notna(r.homeConference) and pd.notna(r.awayConference)
                       and r.homeConference == r.awayConference)
        matchups += [(r.homeTeam, r.awayTeam, is_conf), (r.awayTeam, r.homeTeam, is_conf)]
    er = ER.triggers_for_week(SEASON, WEEK, matchups)
    SRC = {"ret_prod_edge": "Returning-production edge (wk1-3)", "portal_talent_influx": "Portal talent influx (wk1-3)"}
    for _, r in te.iterrows():
        if pd.isna(r.spread_close):
            continue
        for team, is_home in [(r.homeTeam, True), (r.awayTeam, False)]:
            for sk, val, tier in er.get(team, []):
                rows.append({"game_id": int(r.game_id), "season": SEASON, "week": WEEK,
                             "game": f"{r.awayTeam} @ {r.homeTeam}", "source": f"{SRC[sk]}: {team}",
                             "signal_key": sk, "market": "spread", "side": "HOME" if is_home else "AWAY",
                             "line": round(float(r.spread_close), 1), "price": -110, "edge": val,
                             "conviction": tier, "tier": "active", "stake_units": C.STAKE[tier],
                             "grade_line": "close", "mammoth": False})
except Exception as e:
    print(f"  [early_roster_signals] skipped: {e}")

# ── DK-specific SMALL HOME-DOG MONEYLINE: when DraftKings prices the HOME team as a small dog (+100..+140),
#    take the home moneyline. dk_ml_bands.py: home dogs in this band win outright ~48% vs ~43% DK-implied =
#    +5.9% flat-bet ROI, 4/5 seasons (n=291). Structural: road favorites are overbet (all home dogs -1.5% vs
#    all away dogs -10.1%), and this small band is the bettable slice. HOME only — away dogs +100..140 don't
#    hold (-1.4%). Graded on outright win at the DK number, so line=price=the DK home ML. ──
try:
    for _, r in te.iterrows():
        mlh = pd.to_numeric(pd.Series([r.get("dk_ml_home_close")]), errors="coerce").iloc[0]
        if pd.isna(mlh) or not (100 <= mlh <= 140):
            continue
        rows.append({"game_id": int(r.game_id), "season": SEASON, "week": WEEK,
                     "game": f"{r.awayTeam} @ {r.homeTeam}", "source": f"Small home-dog ML +{int(round(mlh))} (DK)",
                     "signal_key": "home_dog_ml", "market": "ml", "side": "HOME ML",
                     "line": int(round(mlh)), "price": int(round(mlh)), "edge": None,
                     "conviction": "T3", "tier": "active", "stake_units": C.STAKE["T3"],
                     "grade_line": "dk", "mammoth": False})
except Exception as e:
    print(f"  [home_dog_ml] skipped: {e}")

# --- REGIME FADE family (TRACKING-ONLY, wired 2026-08-04) -----------------------------------
# True-preseason power rating (TR predictive) vs the Odds-API close, wk1-3, |gap| >= 2:
#   the side the RATING favors has a 1st-year HC  -> FADE it   (58.4% / +11.5, n=137, 2018-25)
#   the OPPONENT of the rating's side has new HC  -> FOLLOW it (62.2% / +18.7, n=111)
# Five straight positive seasons 2021-25 on true preseason ratings (the earlier "2025 flip"
# was a stale-ratings artifact). Anti-control confirms direction (wrong-side fade = 37.8%).
# TRACKING tier until a live season confirms — the discovery grid scanned 30 cells. Vault:
# FOOTBALL_PROFILES.md "regime fade". Inputs refresh weekly (preseason_tr / coaches parquets).
_trp = f"data/cfbd/preseason_tr_{SEASON}.parquet"
_cop = f"data/cfbd/coaches_{SEASON}.parquet"
if WEEK <= 3 and os.path.exists(_trp) and os.path.exists(_cop):
    _trr = pd.read_parquet(_trp).set_index("team").tr_rating
    _rsp = "data/roster_scores.parquet"
    _rsdf = pd.read_parquet(_rsp) if os.path.exists(_rsp) else pd.DataFrame(columns=["season","team","ret_share"])
    _retsh = _rsdf[_rsdf.season == SEASON].set_index("team").ret_share.to_dict()
    _co = pd.read_parquet(_cop)
    _newhc = set(_co[_co.new_hc].school)
    for _, r in te.iterrows():
        sp = r.spread_close
        h, a = _trr.get(r.homeTeam), _trr.get(r.awayTeam)
        if pd.isna(sp) or h is None or a is None:
            continue
        implied = (h - a) + (0.0 if bool(getattr(r, "neutralSite", False)) else 2.5)
        gap = implied - (-float(sp))
        if abs(gap) < 2:
            continue
        rated_team = r.homeTeam if gap > 0 else r.awayTeam      # side the rating favors vs the line
        opp_team = r.awayTeam if gap > 0 else r.homeTeam
        rated_side = "HOME" if gap > 0 else "AWAY"
        opp_side = "AWAY" if gap > 0 else "HOME"
        common = {"game_id": int(r.game_id), "season": SEASON, "week": WEEK,
                  "game": f"{r.awayTeam} @ {r.homeTeam}", "market": "spread",
                  "line": round(float(sp), 1), "price": -110, "edge": round(float(gap), 1),
                  "conviction": "track", "tier": "tracking", "stake_units": 0.5,
                  "grade_line": "close", "mammoth": False}
        # returning-production tier (owner grid 2026-08-04): new-HC + roster teardown = the
        # 6/6-season core (61.2%/+16.8); same-HC teardown fades too (56%, 5/6). ret_share is
        # NaN until CFBD posts current-season rosters -> tiers self-activate when data lands.
        _ret = _retsh.get(rated_team, float("nan"))
        if rated_team in _newhc:
            tear = " + FULL TEARDOWN (<45% returning)" if _ret == _ret and _ret < 0.45 else ""
            rows.append({**common, "source": f"REGIME FADE: rating leans on {rated_team} (new HC{tear}), gap {gap:+.1f}",
                         "signal_key": "regime_fade_hc", "side": opp_side})
        elif opp_team in _newhc:
            rows.append({**common, "source": f"REGIME FOLLOW: {opp_team} has new HC, rating likes {rated_team}, gap {gap:+.1f}",
                         "signal_key": "regime_follow_hc", "side": rated_side})
        elif _ret == _ret and _ret < 0.30:
            rows.append({**common, "source": f"REGIME FADE: rating leans on {rated_team} (roster gutted, {_ret*100:.0f}% returning, same HC), gap {gap:+.1f}",
                         "signal_key": "regime_fade_teardown", "side": opp_side})

# ── Weeks 1-3 coach-pace UNDER (FOOTBALL_PROFILES coach-scheme study, TRACKING tier) ──
# First-year HC arriving from a faster offense (pace_gap >= +4 plays/game): the market
# prices the tempo hype in before the roster can execute it. Study dose-response (2017-25
# wk1-3, at the close): >=+4 went UNDER 66.7% (n=21); the >=+8 mechanism cell averaged
# -5.0 pts vs the line (baseline -4.2 -> increment is modest, hence tracking, not active).
# coach_moves_{SEASON}.parquet refreshes weekly via fetch_preseason_ratings.tr_and_coaches.
_cmp = f"data/cfbd/coach_moves_{SEASON}.parquet"
if WEEK <= 3 and os.path.exists(_cmp):
    _cm = pd.read_parquet(_cmp)
    _fast = {r.school: r for _, r in _cm.iterrows() if pd.notna(r.pace_gap) and r.pace_gap >= 4}
    for _, r in te.iterrows():
        if pd.isna(r.total_close):
            continue
        for tm in (r.homeTeam, r.awayTeam):
            m = _fast.get(tm)
            if m is None:
                continue
            rows.append({"game_id": int(r.game_id), "season": SEASON, "week": WEEK,
                         "game": f"{r.awayTeam} @ {r.homeTeam}", "market": "total",
                         "side": "UNDER", "line": round(float(r.total_close), 1), "price": -110,
                         "edge": round(float(m.pace_gap), 1), "conviction": "track",
                         "tier": "tracking", "stake_units": 0.5, "grade_line": "close",
                         "mammoth": False, "signal_key": "coach_pace_under",
                         "source": f"PACE HYPE UNDER: {tm} new HC {m.coach} from {m.prev_school} "
                                   f"(+{m.pace_gap:.1f} plays/gm faster than {tm} played) — "
                                   f"market prices the tempo before the roster can run it"})

# ── Week-1 ROSTER HYPE FADE (owner-registered 2026-08-07, TRACKING tier) ──
# Portal-era repricing: the market now OVERPAYS moderate roster-continuity edges.
# Wk1 2024+2025, fade the higher-ret_prod side vs the OPEN: 61.4% (+17.3% ROI),
# positive both seasons; the collapse lives in MODERATE share gaps (backing them
# hit 36% in 2024) while EXTREME gaps (>=20pp) still follow (~54-56%) — that
# region belongs to ret_prod_edge (S-CFB2), so this signal EXCLUDES it: fires
# only when |ret_share gap| < 0.20 (our player-built share, corr +0.884 with
# CFBD percentPPA). Grade vs the OPEN — the roster facts are summer knowledge.
_rsp2 = "data/roster_scores.parquet"
if WEEK == 1 and os.path.exists(_rsp2):
    _rs2 = pd.read_parquet(_rsp2)
    _rs2 = _rs2[_rs2.season == SEASON].set_index("team")
    for _, r in te.iterrows():
        op = getattr(r, "open_spread", np.nan)
        if pd.isna(op):
            continue
        try:
            rh, ra = _rs2.loc[r.homeTeam], _rs2.loc[r.awayTeam]
        except KeyError:
            continue
        if pd.isna(rh.ret_prod) or pd.isna(ra.ret_prod) or rh.ret_prod == ra.ret_prod:
            continue
        if pd.notna(rh.ret_share) and pd.notna(ra.ret_share) \
                and abs(rh.ret_share - ra.ret_share) >= 0.20:
            continue  # extreme-continuity region -> ret_prod_edge's validated cell
        loaded_home = rh.ret_prod > ra.ret_prod
        loaded = r.homeTeam if loaded_home else r.awayTeam
        other = r.awayTeam if loaded_home else r.homeTeam
        lo, hi = (ra.ret_prod, rh.ret_prod) if loaded_home else (rh.ret_prod, ra.ret_prod)
        rows.append({"game_id": int(r.game_id), "season": SEASON, "week": WEEK,
                     "game": f"{r.awayTeam} @ {r.homeTeam}", "market": "spread",
                     "side": "AWAY" if loaded_home else "HOME",
                     "line": round(float(op), 1), "price": -110,
                     "edge": round(float(hi - lo), 1), "conviction": "track",
                     "tier": "tracking", "stake_units": 0.5, "grade_line": "open",
                     "mammoth": False, "signal_key": "roster_hype_fade",
                     "source": f"ROSTER HYPE FADE: {loaded} returns {hi:.0f} PPA vs {other} "
                               f"{lo:.0f} — portal-era market overpays moderate continuity "
                               f"edges wk1 (share gap <20%)"})

# ── In-season CORE total edge (owner-pushed 2026-08-08, TRACKING tier) ──
# As-of CORE off/def -> implied total; >=4 off the close = 54.1% ALL 5 seasons
# positive (n=1,389, core_totals_test.py). Needs as-of CORE ratings with >=4 weeks
# of games -> fires weeks 5+ only; self-activates mid-season. Walk-forward betas
# frozen from the 2021-25 calibration (re-freeze with the pkls).
_cap = "data/cfbd/core_asof.parquet"
if WEEK >= 5 and os.path.exists(_cap):
    _ca = pd.read_parquet(_cap)
    # Freshest snapshot <= WEEK-1 (not an exact match): the live feed is written by
    # fetch_preseason_ratings from CFBD's latest, and a one-week CFBD lag should degrade
    # to a staler-but-valid snapshot, not silently disable the signal. Floor of 4 played
    # weeks preserved (the backtest never fired on thinner data).
    _ca = _ca[(_ca.season == SEASON) & (_ca.thru_week <= WEEK - 1) & (_ca.thru_week >= 4)]
    if len(_ca):
        _tw = int(_ca.thru_week.max())
        _ca = _ca[_ca.thru_week == _tw].set_index("team")
        print(f"  [core_total_edge] using as-of CORE thru wk{_tw} ({len(_ca)} teams)")
        # TT AWAY UNDER companion (2026-08-17 battery): the away team-total line for
        # each slate game, straight from the slate table the games generator just wrote.
        _ttq = requests.get(f"{C.URL}/rest/v1/cfb_dryrun_games?season=eq.{SEASON}&week=eq.{WEEK}"
                            f"&select=game_id,tt_away_close,tt_away_best_under", headers=C.H, timeout=30)
        _ttmap = {int(x["game_id"]): (x.get("tt_away_close"), x.get("tt_away_best_under"))
                  for x in (_ttq.json() if _ttq.ok else [])}
        B_OFF, B_DEF, B0 = 0.2285, 0.2547, 53.95   # frozen lstsq betas (2021-25, n=2708)
        for _, r in te.iterrows():
            if pd.isna(r.total_close):
                continue
            try:
                ho, ao = _ca.loc[r.homeTeam], _ca.loc[r.awayTeam]
            except KeyError:
                continue
            hat = B_OFF * (ho.off + ao.off) + B_DEF * (ho.dfn + ao.dfn) + B0
            edge = hat - float(r.total_close)
            if abs(edge) < 4:
                continue
            side = "OVER" if edge > 0 else "UNDER"
            # STEAM tier ladder (cfb_total_mammoth_dig 2026-08-08, wks5-15 2021-25):
            #   base edge>=4 alone            54.1% 5/5 seasons  -> tracking 0.5u
            #   + line moved >=0.5 toward us  58.1% n=353 +10.9% -> T2 active 1u
            #   + line moved >=1.5 toward us  60.9% n=169 +16.4% -> T1 active 1.5u (MAMMOTH-
            #     candidate; first live season before the 3u brand). >=2.5 DECAYS (55.6) —
            #     never chase fully-moved lines.
            ot = getattr(r, "open_total", np.nan)
            move = (float(r.total_close) - float(ot)) if pd.notna(ot) else np.nan
            steam = move if side == "OVER" else -move if pd.notna(move) else np.nan
            if pd.notna(steam) and steam >= 1.5:
                conv, tier, stake = "T1", "active", 1.5
            elif pd.notna(steam) and steam >= 0.5:
                conv, tier, stake = "T2", "active", 1.0
            else:
                conv, tier, stake = "track", "tracking", 0.5
            stx = f", steam {steam:+.1f} toward us" if pd.notna(steam) else ""
            rows.append({"game_id": int(r.game_id), "season": SEASON, "week": WEEK,
                         "game": f"{r.awayTeam} @ {r.homeTeam}", "market": "total",
                         "side": side, "line": round(float(r.total_close), 1), "price": -110,
                         "edge": round(float(edge), 1), "conviction": conv,
                         "tier": tier, "stake_units": stake, "grade_line": "close",
                         "mammoth": False, "signal_key": "core_total_edge",
                         "source": f"CORE TOTAL EDGE: context-adjusted O/D implies "
                                   f"{hat:.1f} vs line {r.total_close:g} ({edge:+.1f}{stx})"})
            # ── TT AWAY UNDER (validated 2026-08-17, cfb_h1tt_movement.py + LOCKED §9):
            # model under-edge <= -4 -> AWAY team total UNDER = 61.3% (n=271, 61/60/62
            # by season, +16.9% @ -110), beats the parent FG under (56.8%) on the same
            # games. HOME mirror is dead (books shade home TTs; the total's error
            # concentrates on the away half). Ships ACTIVE T2 1u per owner 2026-08-17.
            if side == "UNDER":
                _ttl, _ttpx = _ttmap.get(int(r.game_id), (None, None))
                if _ttl is not None:
                    rows.append({"game_id": int(r.game_id), "season": SEASON, "week": WEEK,
                                 "game": f"{r.awayTeam} @ {r.homeTeam}", "market": "team_total",
                                 "side": f"{r.awayTeam} UNDER", "line": round(float(_ttl), 1),
                                 "price": int(_ttpx) if _ttpx is not None else -110,
                                 "edge": round(float(edge), 1), "conviction": "T2",
                                 "tier": "active", "stake_units": 1.0, "grade_line": "close",
                                 "mammoth": False, "signal_key": "tt_away_under",
                                 "bet_team": r.awayTeam, "bet_direction": "UNDER",
                                 "bet_line": round(float(_ttl), 1),
                                 "source": f"TT AWAY UNDER: game total looks {abs(edge):.1f} too high — "
                                           f"the inflated points sit on the road side; {r.awayTeam} "
                                           f"team total UNDER {_ttl:g}"})

# ── EARLY TOTAL EDGE (owner-pushed 2026-08-11): the wk1-3 preseason-CORE blend's RAW
# total >=4 off the close = 55.1% (n=352, 5/5 seasons >=52), >=6 = 57.9% (n=209) —
# cfb_early_edge_backtest.py, exact production features. The weeks-1-3 front end of
# core_total_edge (same O/D structure, preseason inputs). Spreads carry NO such edge
# (48-51%) — display-only there stands. Raw (pre-anchor) total: the ±6 display cap
# truncates exactly the edges that pay.
if WEEK <= 3:
    _ep_path = f"out/cfb_early_preds_{SEASON}.csv"
    if os.path.exists(_ep_path):
        _ep = pd.read_csv(_ep_path)
        if "pred_total_raw" in _ep.columns:
            _ep = _ep[["homeTeam", "awayTeam", "pred_total_raw"]]
            _te2 = te.merge(_ep, on=["homeTeam", "awayTeam"], how="left")
            for _, r in _te2.iterrows():
                if pd.isna(r.total_close) or pd.isna(r.pred_total_raw):
                    continue
                edge = float(r.pred_total_raw) - float(r.total_close)
                if abs(edge) < 4:
                    continue
                side = "OVER" if edge > 0 else "UNDER"
                if abs(edge) >= 6:
                    conv, tier, stake = "T3", "active", C.STAKE["T3"]
                else:
                    conv, tier, stake = "track", "tracking", 0.5
                rows.append({"game_id": int(r.game_id), "season": SEASON, "week": WEEK,
                             "game": f"{r.awayTeam} @ {r.homeTeam}", "market": "total",
                             "side": side, "line": round(float(r.total_close), 1), "price": -110,
                             "edge": round(edge, 1), "conviction": conv,
                             "tier": tier, "stake_units": stake, "grade_line": "close",
                             "mammoth": False, "signal_key": "early_total_edge",
                             "source": f"EARLY TOTAL EDGE: preseason-CORE blend implies "
                                       f"{r.pred_total_raw:.1f} vs line {r.total_close:g} ({edge:+.1f})"})
                # ── TT AWAY UNDER, early-season variant (owner-pushed 2026-08-17): the
                # weeks-1-4 subset of the validated cell holds (61.5% n=39 vs 61.2% wks5+),
                # so the road-team under also rides the wk1-3 preseason-blend under calls.
                # One tier lower (T3) until the early sample matures — the early gate is
                # the analogous-but-not-identical formula (blend vs in-season CORE).
                if side == "UNDER":
                    _q = requests.get(f"{C.URL}/rest/v1/cfb_dryrun_games?game_id=eq.{int(r.game_id)}"
                                      f"&select=tt_away_close,tt_away_best_under", headers=C.H, timeout=30)
                    _tr = (_q.json() or [{}])[0] if _q.ok else {}
                    _ttl, _ttpx = _tr.get("tt_away_close"), _tr.get("tt_away_best_under")
                    if _ttl is not None:
                        rows.append({"game_id": int(r.game_id), "season": SEASON, "week": WEEK,
                                     "game": f"{r.awayTeam} @ {r.homeTeam}", "market": "team_total",
                                     "side": f"{r.awayTeam} UNDER", "line": round(float(_ttl), 1),
                                     "price": int(_ttpx) if _ttpx is not None else -110,
                                     "edge": round(edge, 1), "conviction": "T3",
                                     "tier": "active", "stake_units": C.STAKE["T3"],
                                     "grade_line": "close", "mammoth": False,
                                     "signal_key": "tt_away_under",
                                     "bet_team": r.awayTeam, "bet_direction": "UNDER",
                                     "bet_line": round(float(_ttl), 1),
                                     "source": f"TT AWAY UNDER (early season): total looks "
                                               f"{abs(edge):.1f} too high per the preseason blend — "
                                               f"inflated points sit on the road side; {r.awayTeam} "
                                               f"team total UNDER {_ttl:g}"})

# ── Explicit bet target on every flag (owner rule 2026-08-07): a signal's text must
# SAY the bet ("→ bet Tulsa +12.5"), because side=HOME/AWAY never renders and a source
# that only names a team reads as backing that team even when it fades them (the OSU
# regime-fade confusion). Appended last so every emitter above stays untouched.
def _bet_text(r):
    away, home = r["game"].split(" @ ", 1)
    m, s, ln = r["market"], str(r["side"]), r.get("line")
    if m in ("spread", "h1_spread") and s in ("HOME", "AWAY"):
        team = home if s == "HOME" else away
        line = None if ln is None else (float(ln) if s == "HOME" else -float(ln))
        pre = "1H " if m == "h1_spread" else ""
        return f"{team} {pre}{line:+g}" if line is not None else team
    if m in ("total", "h1_total") and s in ("OVER", "UNDER"):
        pre = "1H " if m == "h1_total" else ""
        return f"{pre}{s.title()} {float(ln):g}" if ln is not None else s.title()
    if m == "moneyline" and s in ("HOME", "AWAY"):
        return f"{home if s == 'HOME' else away} ML"
    return s.title() if s else None

def _bet_fields(r):
    """Structured direction for the UI (owner 2026-08-10): bet_team -> team logo,
    bet_direction over/under -> green arrow, bet_line -> the signed number for that bet.
    Mechanical render — no text parsing, no 'which team is this about' ambiguity."""
    away, home = r["game"].split(" @ ", 1)
    m, s, ln = r["market"], str(r["side"]), r.get("line")
    if m in ("spread", "h1_spread", "moneyline") and s in ("HOME", "AWAY"):
        team = home if s == "HOME" else away
        line = None if ln is None or m == "moneyline" else (float(ln) if s == "HOME" else -float(ln))
        return team, None, line
    if m in ("total", "h1_total") and s in ("OVER", "UNDER"):
        return None, s.lower(), None if ln is None else float(ln)
    if m == "team_total":                      # side = "<Team> OVER|UNDER"
        parts = s.rsplit(" ", 1)
        if len(parts) == 2 and parts[1] in ("OVER", "UNDER"):
            return parts[0], parts[1].lower(), None if ln is None else float(ln)
    return None, None, None

for r in rows:
    bt = _bet_text(r)
    if bt:
        r["source"] = f"{r['source']} → bet {bt}"
    team, direction, line = _bet_fields(r)
    r["bet_team"] = team
    r["bet_direction"] = direction
    r["bet_line"] = line

df = pd.DataFrame(rows)

# ── Weeks 1-3 EXTREMITY TIER for fade_high_total (validated 2026-08-03, FOOTBALL_PROFILES) ──
# The flat close>=60 UNDER hides a dose-response early: wk1-3 the TOP-8% closes (within-season rank)
# hit 64.5%/+23.2 (8/9) vs 54.7% for the rest of >=60; wk4+ the premium decays (52.5%). RANK not an
# absolute cut because the totals environment drifts (top-8% = 68.6 in 2016 -> 60.5 in 2025). The
# >=60 floor stays (sub-60 rank cells have no historical sample). Upgrade = conviction T3 -> T2.
if WEEK <= 3 and len(df) and (df.signal_key == "fade_high_total").any():
    slate_p92 = te.total_close.quantile(0.92)
    hi = (df.signal_key == "fade_high_total") & (df.line >= max(float(slate_p92), 60.0))
    if hi.any():
        df.loc[hi, "conviction"] = "T2"
        df.loc[hi, "stake_units"] = C.STAKE["T2"]
        df.loc[hi, "source"] = df.loc[hi, "source"] + " (extreme, wk1-3)"
        print(f"  [extremity tier] fade_high_total upgraded to T2 on {int(hi.sum())} games (slate p92={slate_p92:.1f})")

print(f"cfb_dryrun_flags rows: {len(df)} | tier {df.tier.value_counts().to_dict()} | market {df.market.value_counts().to_dict()}")
print(f"  conviction {df.conviction.value_counts().to_dict()} | mammoth flags {int(df.mammoth.sum())}")
C.wipe("cfb_dryrun_flags", f"season=eq.{SEASON}&week=eq.{WEEK}")
C.insert("cfb_dryrun_flags", df)
act = df[df.tier == "active"].groupby("game_id").size(); trk = df[df.tier == "tracking"].groupby("game_id").size()
for gid in g7:
    requests.patch(f"{C.URL}/rest/v1/cfb_dryrun_games?game_id=eq.{gid}", headers=C.H,
                   data=json.dumps({"n_flags_active": int(act.get(gid, 0)), "n_flags_tracking": int(trk.get(gid, 0))}))
print("  back-filled n_flags on games")
