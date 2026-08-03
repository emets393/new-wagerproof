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
ev = pd.read_parquet(_evp) if os.path.exists(_evp) else pd.DataFrame(columns=["game_id", "market", "name", "description", "point"])
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
