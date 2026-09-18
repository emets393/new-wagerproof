"""NFL weekly regression report — daily storyline generator (owner spec 2026-08-30).

Deterministic storyline engine over the week's slate; LLM writes the narrative
only (football_report_lib). NO PICKS. Families re-evaluate fully each run so
vanished conditions resolve on the record.

Families v1:
  matchups      — FEATURED MATCHUPS (owner spec 2026-09-18): top-4 games where the Fantasy
                  Points / charting matchup facts AND our internal data (model play, signals,
                  weather, referee, injuries) are both telling. Read from nfl_matchup_facts,
                  which nfl_matchup_facts.py writes on the fp-data-inseason job (Tue/Thu).
  injuries      — team injury digests + notable Out/Doubtful (empty until Sept reports)
  signals       — CONFLUENCE engine (shared w/ CFB, football_report_lib): per-game
                  alignments / strong solos / explicit conflicts, records graded
                  live from finals (owner spec 2026-09-16)
  line_movement — open->current across FG spread/total, TT, 1H (all captured markets)
  ref_trends    — assigned referee with a strong directional trend in ANY market
                  (gated until assignments publish in game week)
  coach_trends  — either head coach with a strong career-window market trend
  confluence    — ref + coach pointing the SAME direction on the same market (top billing)
Gated until current-season data: EPA gaps, turnover luck, rest/travel/schedule.
Usage: gen_nfl_regression_report.py [season week]
"""
import datetime as dt
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


from nfl_current_coaches import current_coaches  # noqa: E402 — see that module's docstring


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
    # Played games out of the report: their storylines auto-resolve via sync.
    now_iso = dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%S")
    games = [g for g in games if g.get("kickoff") and str(g["kickoff"])[:19] > now_iso]
    label = {str(g["game_id"]): f"{g['away_team']} @ {g['home_team']}" for g in games}
    flags = fetch(env, "nfl_slate_flags",
                  f"select=game_id,signal_key,side,market,conviction,tier,"
                  f"bet_team,bet_direction,bet_line&season=eq.{season}&week=eq.{week}")
    picks = fetch(env, "nfl_slate_picks",
                  f"select=game_id,card_group,pick_side&season=eq.{season}&week=eq.{week}")
    defs = {d["signal_key"]: d for d in fetch(env, "nfl_signal_defs",
            "select=signal_key,display_name,typical_hit,one_liner")}
    # (live signal records are graded from finals inside lib.confluence_storylines)
    refs = {r["referee"]: r for r in fetch(env, "nfl_referee_trends", "select=referee,career_games,splits")}
    coaches = fetch(env, "nfl_coach_trends", "select=coach,splits,career_games,through_season")
    # One trend row per coach NAME (table has snapshot duplicates — keep freshest),
    # then attach to teams via the schedule feed's CURRENT coach mapping. A
    # rookie HC with no career row correctly gets no coach storyline.
    trend_by_coach = {}
    for c in coaches:
        prev = trend_by_coach.get(c["coach"])
        if prev is None or (c.get("through_season") or 0) > (prev.get("through_season") or 0):
            trend_by_coach[c["coach"]] = c
    coach_by_ab = {ab: trend_by_coach[nm] for ab, nm in current_coaches(season).items()
                   if nm in trend_by_coach}
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

    # ---- featured matchups (owner spec 2026-09-18) ---------------------------
    # nfl_matchup_facts is written by nfl_matchup_facts.py (Fantasy Points /
    # charting matchup facts crossed with the model, signals, weather, referee,
    # injuries — top MAX_GAMES games by how many independent things are telling).
    # It needs the FP parquets + play-by-play caches, which only the fp-data
    # job's disk has, so this generator READS the table rather than computing.
    # Storyline keys are per game; the sync resolves a game once it kicks off
    # (it is dropped from `games` above) or falls out of the featured set.
    # Card shows the two-sentence summary (body); the facet-by-facet rundown rides in
    # data.full and expands in place on the web (owner 2026-09-18: no duplicate prose).
    for f in fetch(env, "nfl_matchup_facts",
                   f"select=game_id,matchup,direction,body,score,facts&season=eq.{season}&week=eq.{week}&order=score.desc"):
        gid = str(f["game_id"])
        if gid not in label:
            continue
        summ = ((f.get("facts") or {}).get("summary")) or f["body"].split("\n")[1].lstrip("- ")
        S.append(dict(storyline_key=f"matchup:{gid}", family="matchups", game_id=gid,
                      matchup=label.get(gid), title=f"Featured matchup — {label.get(gid)}",
                      body=summ, data={"full": f["body"], "direction": f.get("direction"), "score": f.get("score")},
                      rank=5))

    # ---- signals: CONFLUENCE engine (shared, football_report_lib) ------------
    # sides_model is the base model lean on ~every spread (blanket — excluded);
    # consensus_totals_HC / M2 are the model's own totals lean (no circular
    # "model agrees" bonus).
    gmap = {str(g["game_id"]): g for g in games}
    S += lib.confluence_storylines(
        env, "nfl", season, week, gmap, label, flags, defs, model_side, model_tot,
        "nfl_slate_flags", "nfl_slate_games",
        model_own_keys={"consensus_totals_HC", "M2_k1_model_lean"},
        blanket_keys={"sides_model"})

    # ---- line movement — every captured market -------------------------------
    for g in games:
        gid = str(g["game_id"])
        moves = []
        so, sc = g.get("fg_spread_open"), g.get("fg_spread_close")
        if so is not None and sc is not None and abs(float(sc) - float(so)) >= 1.0:
            # Home-perspective line: falling number = money on the home side.
            # Name the team so the narrative LLM can't invert direction.
            mover = g["home_team"] if float(sc) < float(so) else g["away_team"]
            moves.append(f"the spread moved from {g['home_team']} {float(so):+g} to "
                         f"{g['home_team']} {float(sc):+g} — money has come in on {mover}")
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
            # trend_read's pct is the OVER/COVER rate; show the rate of the
            # DIRECTION being claimed ("UNDER in 80%", never "UNDER at 20%").
            disp = pct if direction in ("OVER", "COVER") else 1 - pct
            verb = {"OVER": "gone OVER", "UNDER": "gone UNDER",
                    "COVER": "seen the favorite side cover",
                    "FADE": "seen the favorite side fail to cover"}[direction]
            body = (f"{ref_name} is the assigned referee for {label.get(gid)}. His last {n} games "
                    f"have {verb} in {disp*100:.0f}% — a strong directional lean on the "
                    f"{market} market ({ref.get('career_games')} career games).")
            key = f"ref:{gid}:{market}"
            conf = None
            for ab in str(gid).split("_")[2:4]:
                c = coach_by_ab.get(ab)
                ct = trend_read((c or {}).get("splits") or {}, market) if c else None
                if ct and ct[2] == direction:
                    conf = (c["coach"], ct)
            if conf:
                cname, (cp, cn, cdir) = conf
                cdisp = cp if cdir in ("OVER", "COVER") else 1 - cp
                S.append(dict(storyline_key=f"confluence:{gid}:{market}", family="confluence",
                              game_id=gid, matchup=label.get(gid),
                              title=f"Ref + coach confluence — {label.get(gid)} {market}",
                              body=body + f" Independently, head coach {cname} has gone the same "
                                          f"direction in {cdisp*100:.0f}% of his last {cn} games. Two "
                                          f"unrelated tendencies pointing the same way on the same market.",
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
                disp = pct if direction in ("OVER", "COVER") else 1 - pct
                verb = {"OVER": "gone OVER", "UNDER": "gone UNDER",
                        "COVER": "covered the spread",
                        "FADE": "failed to cover the spread"}[direction]
                S.append(dict(storyline_key=f"coach:{gid}:{ab}:{market}", family="coach_trends",
                              game_id=gid, matchup=label.get(gid),
                              title=f"Coach trend — {c['coach']} ({market})",
                              body=f"{c['coach']} ({ab}): his teams have {verb} in {disp*100:.0f}% of "
                                   f"his last {n} games — a career-window tendency worth knowing in "
                                   f"{label.get(gid)}.",
                              data={"coach": c["coach"], "market": market,
                                    "direction": direction, "pct": pct, "n": n}, rank=45))

    # ---- rank with family quotas, cap, sync ----------------------------------
    QUOTA = {"matchups": 4, "confluence": 6, "injuries": 10, "signals": 10, "ref_trends": 8,
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
    n_feat = sum(1 for s in stored if s.get("family") == "matchups" and s.get("status") != "resolved")
    narrative, model = lib.generate_narrative(
        env, "NFL", stored,
        f"Week {week}, {season} season. {len(games)} games on the slate."
        + (f" {n_feat} 'matchups' storylines are FEATURED MATCHUPS and have their own expandable "
           "cards with the full rundown, so do NOT write them up: mention in ONE sentence which games "
           "are featured this week and move on. Describe any model play as 'the model shows a play on "
           "X' — never 'recommends', 'suggests', or any imperative." if n_feat else ""))
    fam_counts = {}
    for s in stored:
        fam_counts[s["family"]] = fam_counts.get(s["family"], 0) + 1
    # Early-season banner: each item's gate self-clears the first run its data
    # exists (injuries land, refs assigned, season sample builds) and the client
    # hides the banner when the list is empty — no app update needed.
    coming = []
    if not inj:
        coming.append({"emoji": "🏥", "label": "Injury reports",
                       "note": "Weekly practice reports begin in September — team-by-team Out/Doubtful "
                               "listings will appear here the day they publish."})
    if not any(g.get("assigned_referee") for g in games):
        coming.append({"emoji": "🦓", "label": "Referee trends",
                       "note": "Crew assignments publish during game week. Referees with a strong "
                               "directional lean in any market — and ref + coach confluence — appear then."})
    if week <= 4:
        coming.append({"emoji": "📊", "label": "EPA gaps & regression",
                       "note": "Team EPA differentials, turnover luck, and rest/travel/schedule edges "
                               "activate once a few weeks of 2026 games are in the books."})
    lib.write_report(env, "nfl", season, week, narrative, model, log,
                     {"games": len(games), "storylines": len(stored), "families": fam_counts,
                      "coming_soon": coming,
                      "model_record": lib.fetch_model_record(env, "nfl", season)})
    print(f"nfl report {season} wk{week}: {len(S)} storylines "
          f"({len([l for l in log if l['type']=='new'])} new, "
          f"{len([l for l in log if l['type']=='updated'])} updated, "
          f"{len([l for l in log if l['type']=='resolved'])} resolved) | narrative: {bool(narrative)}")


if __name__ == "__main__":
    main()
