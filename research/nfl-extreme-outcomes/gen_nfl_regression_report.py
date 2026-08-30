"""NFL weekly regression report — daily storyline generator (owner spec 2026-08-30).

Deterministic storyline engine over the week's slate; LLM writes the narrative
only (football_report_lib). NO PICKS. Families re-evaluate fully each run so
vanished conditions resolve on the record.

Families v1:
  injuries      — team injury digests + notable Out/Doubtful (empty until Sept reports)
  signals       — active flags with model-agreement framing + records
  line_movement — open->current across FG spread/total, TT, 1H (all captured markets)
  ref_trends    — assigned referee with a strong directional trend in ANY market
                  (gated until assignments publish in game week)
  coach_trends  — either head coach with a strong career-window market trend
  confluence    — ref + coach pointing the SAME direction on the same market (top billing)
Gated until current-season data: EPA gaps, turnover luck, rest/travel/schedule.
Usage: gen_nfl_regression_report.py [season week]
"""
import sys
from pathlib import Path

import requests

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))
import football_report_lib as lib

MAX_STORYLINES = 30
STRONG_PCT, STRONG_N = 0.65, 12          # L15 window bar for "strong" trend


def fetch(env, table, params):
    r = requests.get(f"{lib.SUPA}/{table}?{params}", headers=lib.hdr(env), timeout=60)
    j = r.json()
    return j if isinstance(j, list) else []


def trend_read(splits, market, dim="overall", window="15"):
    """(pct, n, direction_label) for a splits jsonb cell, or None."""
    try:
        cell = splits[market][dim][window]
        n, pct = int(cell.get("n") or 0), float(cell.get("pct") or 0)
    except (KeyError, TypeError):
        return None
    if n < STRONG_N:
        return None
    if pct >= STRONG_PCT:
        side = {"total": "OVER", "spread": "the cover side"}.get(market, "one side")
        return pct, n, ("OVER" if market == "total" else "COVER")
    if pct <= 1 - STRONG_PCT:
        return pct, n, ("UNDER" if market == "total" else "FADE")
    return None


def main():
    env = lib.load_env()
    if len(sys.argv) >= 3:
        season, week = int(sys.argv[1]), int(sys.argv[2])
    else:
        a = fetch(env, "nfl_slate_games", "select=season,week&order=season.desc,week.desc&limit=1")
        season, week = a[0]["season"], a[0]["week"]

    games = fetch(env, "nfl_slate_games",
                  f"select=game_id,home_team,away_team,kickoff,assigned_referee,"
                  f"fg_spread_open,fg_spread_close,fg_total_open,fg_total_close,"
                  f"tt_home_close,tt_away_close,h1_spread_close,h1_total_close,"
                  f"fg_spread_pick,fg_total_pick&season=eq.{season}&week=eq.{week}")
    label = {str(g["game_id"]): f"{g['away_team']} @ {g['home_team']}" for g in games}
    flags = fetch(env, "nfl_slate_flags",
                  f"select=game_id,signal_key,side,market,conviction,tier&season=eq.{season}&week=eq.{week}")
    picks = fetch(env, "nfl_slate_picks",
                  f"select=game_id,card_group,pick_side&season=eq.{season}&week=eq.{week}")
    defs = {d["signal_key"]: d for d in fetch(env, "nfl_signal_defs",
            "select=signal_key,display_name,typical_hit,one_liner")}
    perf = {p["signal_key"]: p for p in fetch(env, "signal_performance",
            "select=signal_key,n,wins,losses&sport=eq.nfl&order=season.desc")}
    refs = {r["referee"]: r for r in fetch(env, "nfl_referee_trends", "select=referee,career_games,splits")}
    coaches = fetch(env, "nfl_coach_trends", "select=coach,current_team,splits,career_games")
    coach_by_ab = {c["current_team"]: c for c in coaches if c.get("current_team")}
    inj = fetch(env, "nfl_injuries_raw",
                f"select=team,player,position,report_status&season=eq.{season}&week=eq.{week}")
    model_side = {str(p["game_id"]): p.get("pick_side") for p in picks if p.get("card_group") == "spread"}
    model_tot = {str(p["game_id"]): p.get("pick_side") for p in picks if p.get("card_group") == "total"}

    S = []

    # ---- injuries (graceful until September reports) --------------------------
    by_team = {}
    for i in inj:
        if str(i.get("report_status") or "").lower() in ("out", "doubtful", "injured reserve"):
            by_team.setdefault(i["team"], []).append(i)
    for team_ab, rows in by_team.items():
        gid = next((str(g["game_id"]) for g in games
                    if team_ab in str(g["game_id"]).split("_")[2:4]), None)
        names = ", ".join(f"{r['player']} ({r['position']}) {r['report_status']}" for r in rows[:5])
        S.append(dict(storyline_key=f"injury:{team_ab}", family="injuries", game_id=gid,
                      matchup=label.get(gid), title=f"{team_ab} injury report",
                      body=f"{team_ab}: {names}.",
                      data={"team": team_ab, "listings": rows}, rank=15))

    # ---- signals with model-agreement framing --------------------------------
    for f in flags:
        gid = str(f["game_id"])
        if gid not in label or f.get("tier") != "active":
            continue
        d = defs.get(f["signal_key"], {})
        ms = model_side.get(gid) if f["market"] == "spread" else (
            model_tot.get(gid) if f["market"] == "total" else None)
        agree = (ms == f.get("side")) if ms and f.get("side") in ("HOME", "AWAY", "OVER", "UNDER") else None
        pr = perf.get(f["signal_key"])
        rec = (f" Live record: {pr['wins']}-{pr['losses']}." if pr and (pr.get("wins") or pr.get("losses")) else "")
        frame = (" The model leans the same way." if agree is True else
                 (" Note: the model leans the other way — tension, not confirmation." if agree is False else ""))
        S.append(dict(storyline_key=f"signal:{f['signal_key']}:{gid}", family="signals",
                      game_id=gid, matchup=label.get(gid),
                      title=f"{d.get('display_name', f['signal_key'])} — {label.get(gid)}",
                      body=f"{d.get('one_liner','Validated signal')} fired on {f.get('side')} "
                           f"({f['market']}). Historical: {d.get('typical_hit','validated')}." + rec + frame,
                      data={"signal_key": f["signal_key"], "side": f.get("side"),
                            "market": f["market"], "model_agrees": agree},
                      rank=20 if agree else 35))

    # ---- line movement — every captured market -------------------------------
    for g in games:
        gid = str(g["game_id"])
        moves = []
        so, sc = g.get("fg_spread_open"), g.get("fg_spread_close")
        if so is not None and sc is not None and abs(float(sc) - float(so)) >= 1.0:
            moves.append(f"spread {float(so):+g} -> {float(sc):+g}")
        to_, tc = g.get("fg_total_open"), g.get("fg_total_close")
        if to_ is not None and tc is not None and abs(float(tc) - float(to_)) >= 1.5:
            d = "down" if float(tc) < float(to_) else "up"
            agree_t = (model_tot.get(gid) == ("UNDER" if d == "down" else "OVER"))
            moves.append(f"total {float(to_):g} -> {float(tc):g}"
                         + (" — same direction as the model's lean" if agree_t else ""))
        if moves:
            S.append(dict(storyline_key=f"move:{gid}", family="line_movement", game_id=gid,
                          matchup=label.get(gid), title=f"Line movement — {label.get(gid)}",
                          body=f"{label.get(gid)}: " + "; ".join(moves)
                               + ". Sharp-window research: moves 24-72h out and inside 6h are the"
                                 " informative ones; naive chasing of already-moved numbers is not.",
                          data={"moves": moves}, rank=40))

    # ---- referee trends + confluence (gated until assignments publish) --------
    for g in games:
        gid = str(g["game_id"])
        ref_name = g.get("assigned_referee")
        if not ref_name or ref_name not in refs:
            continue
        ref = refs[ref_name]
        for market in ("total", "spread"):
            t = trend_read(ref.get("splits") or {}, market)
            if not t:
                continue
            pct, n, direction = t
            body = (f"{ref_name} is the assigned referee for {label.get(gid)}. His last {n} games "
                    f"have gone {direction} at {pct*100:.0f}% — a strong directional lean on the "
                    f"{market} market ({ref.get('career_games')} career games).")
            key = f"ref:{gid}:{market}"
            conf = None
            for ab in str(gid).split("_")[2:4]:
                c = coach_by_ab.get(ab)
                ct = trend_read((c or {}).get("splits") or {}, market) if c else None
                if ct and ct[2] == direction:
                    conf = (c["coach"], ct)
            if conf:
                cname, (cp, cn, _) = conf
                S.append(dict(storyline_key=f"confluence:{gid}:{market}", family="confluence",
                              game_id=gid, matchup=label.get(gid),
                              title=f"Ref + coach confluence — {label.get(gid)} {market}",
                              body=body + f" Independently, head coach {cname}'s last {cn} games have "
                                          f"gone the same direction at {cp*100:.0f}%. Two unrelated "
                                          f"tendencies pointing the same way on the same market.",
                              data={"referee": ref_name, "coach": cname, "market": market,
                                    "direction": direction}, rank=10))
            else:
                S.append(dict(storyline_key=key, family="ref_trends", game_id=gid,
                              matchup=label.get(gid),
                              title=f"Referee trend — {ref_name} ({market})",
                              body=body, data={"referee": ref_name, "market": market,
                                               "direction": direction, "pct": pct, "n": n},
                              rank=25))

    # ---- coach trends (standalone strong) ------------------------------------
    for g in games:
        gid = str(g["game_id"])
        for ab in str(gid).split("_")[2:4]:
            c = coach_by_ab.get(ab)
            if not c:
                continue
            for market in ("total", "spread"):
                t = trend_read(c.get("splits") or {}, market)
                if not t:
                    continue
                pct, n, direction = t
                S.append(dict(storyline_key=f"coach:{gid}:{ab}:{market}", family="coach_trends",
                              game_id=gid, matchup=label.get(gid),
                              title=f"Coach trend — {c['coach']} ({market})",
                              body=f"{c['coach']} ({ab})'s last {n} games have gone {direction} at "
                                   f"{pct*100:.0f}% on the {market} market — a career-window tendency "
                                   f"worth knowing in {label.get(gid)}.",
                              data={"coach": c["coach"], "market": market,
                                    "direction": direction, "pct": pct, "n": n}, rank=45))

    # ---- rank with family quotas, cap, sync ----------------------------------
    QUOTA = {"confluence": 6, "injuries": 10, "signals": 10, "ref_trends": 8,
             "line_movement": 8, "coach_trends": 6}
    dedup = {}
    for s in S:
        dedup.setdefault(s["storyline_key"], s)
    S = sorted(dedup.values(), key=lambda s: (s["rank"], s["storyline_key"]))
    by_fam, capped = {}, []
    for s in S:
        n = by_fam.get(s["family"], 0)
        if n < QUOTA.get(s["family"], 5):
            capped.append(s)
            by_fam[s["family"]] = n + 1
    S = capped[:MAX_STORYLINES]
    for i, s in enumerate(S):
        s["rank"] = i + 1
    log = lib.sync_storylines(env, "nfl", season, week, S)
    stored = fetch(env, "football_regression_storylines",
                   f"select=family,title,body,rank,matchup,status&sport=eq.nfl"
                   f"&season=eq.{season}&week=eq.{week}&order=rank")
    narrative, model = lib.generate_narrative(
        env, "NFL", stored, f"Week {week}, {season} season. {len(games)} games on the slate.")
    fam_counts = {}
    for s in stored:
        fam_counts[s["family"]] = fam_counts.get(s["family"], 0) + 1
    lib.write_report(env, "nfl", season, week, narrative, model, log,
                     {"games": len(games), "storylines": len(stored), "families": fam_counts})
    print(f"nfl report {season} wk{week}: {len(S)} storylines "
          f"({len([l for l in log if l['type']=='new'])} new, "
          f"{len([l for l in log if l['type']=='updated'])} updated, "
          f"{len([l for l in log if l['type']=='resolved'])} resolved) | narrative: {bool(narrative)}")


if __name__ == "__main__":
    main()
