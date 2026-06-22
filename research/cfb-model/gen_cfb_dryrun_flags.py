"""Generate cfb_dryrun_flags — one row per fired bet signal, Week-7 2025. Spread/total flags come from the
AUTHORITATIVE spot_library (each flag carries ITS OWN side — fixes the conflicting-spots bug where the net
sides_bet mislabeled games like Ohio State@Illinois). Team-total + 1H flags from the harness CSVs.
Each flag: market, side, line (its grade_line), edge, conviction, active/tracking, stake. Back-fills game counts."""
import numpy as np, pandas as pd, warnings, requests, json
import dry_common as C
warnings.filterwarnings("ignore")
SEASON, WEEK = C.season_week()

gm, te, S = C.harness_week(SEASON, WEEK)
g7 = set(te.game_id)
def lab(r): return f"{r.awayTeam} @ {r.homeTeam}"
rows = []

# spread/total spots from spot_library (true per-spot side)
for name, (mask, side, market, gl) in S.items():
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

# team-total flags — UNIFIED: full-game-derived team points vs posted team total (coherent with the score)
ev = pd.read_parquet("data/event_odds/events_2025.parquet"); ev = ev[(ev.game_id.isin(g7)) & (ev.market == "team_totals") & (ev.name == "Over")].copy()
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

# 1H flags
h1 = pd.read_csv("out/cfb_h1_model_2025.csv"); h1 = h1[h1.game_id.isin(g7)]
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

df = pd.DataFrame(rows)
print(f"cfb_dryrun_flags rows: {len(df)} | tier {df.tier.value_counts().to_dict()} | market {df.market.value_counts().to_dict()}")
print(f"  conviction {df.conviction.value_counts().to_dict()} | mammoth flags {int(df.mammoth.sum())}")
C.wipe("cfb_dryrun_flags", f"season=eq.{SEASON}&week=eq.{WEEK}")
C.insert("cfb_dryrun_flags", df)
act = df[df.tier == "active"].groupby("game_id").size(); trk = df[df.tier == "tracking"].groupby("game_id").size()
for gid in g7:
    requests.patch(f"{C.URL}/rest/v1/cfb_dryrun_games?game_id=eq.{gid}", headers=C.H,
                   data=json.dumps({"n_flags_active": int(act.get(gid, 0)), "n_flags_tracking": int(trk.get(gid, 0))}))
print("  back-filled n_flags on games")
