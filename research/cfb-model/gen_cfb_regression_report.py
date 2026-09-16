"""CFB weekly regression report — daily storyline generator (owner spec 2026-08-30).

Deterministic storyline engine over the week's slate. The LLM only writes the
narrative afterwards (football_report_lib). NO PICKS. Storyline families live
here; each family re-evaluates fully every run, so the lib's sync marks
vanished conditions RESOLVED instead of deleting them.

Families v1 (data available now):
  injuries      — covers.com listings for slate teams (QBs lead), backup-QB triggers
  signals       — CONFLUENCE engine (owner spec 2026-09-16): flags are grouped per
                  game+market, graded per family against this season's finals, and the
                  report surfaces (a) multi-signal alignments with no opposing signal,
                  (b) strong solo signals, (c) explicit conflict storylines — instead
                  of one storyline per raw flag. regime_* (ratings-fed) excluded:
                  the daily wipe+reinsert rewrites played games' rows with post-game
                  ratings, so their "records" are hindsight, not live performance.
  line_movement — open->current across FG/TT/1H; steam vs the model's lean
  coach         — hammer/mercy-tier coaches laying big numbers (behavioral context)
Families gated until current-season data exists: EPA/luck regression, team form.
CFB cap: top ~30 by materiality (owner call). Usage: gen_cfb_regression_report.py [season week]
"""
import datetime as dt
import re
import sys
from pathlib import Path

import pandas as pd
import requests

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))
import football_report_lib as lib

MAX_STORYLINES = 30


def fetch(env, table, params):
    r = requests.get(f"{lib.SUPA}/{table}?{params}", headers=lib.hdr(env), timeout=60)
    j = r.json()
    return j if isinstance(j, list) else []


# Ratings-fed families whose stored rows for played games are regenerated with
# post-game inputs (daily wipe+reinsert) — their table "records" are hindsight.
RATINGS_FED = ("regime_", "padded_road", "rvr_")
PRIOR_N = 20   # pseudo-games behind the backtest rate when blending with live


def live_signal_records(env, season, week):
    """Grade every prior-week flag THIS season against finals via the structured
    bet_* fields (team+signed line / over-under+line). Returns {key: (w, l)}.
    Line-anchored and preseason-static signals regenerate identically post-kickoff,
    so this is safe for them; RATINGS_FED keys are excluded upstream."""
    fl = fetch(env, "cfb_slate_flags",
               f"select=game_id,signal_key,market,bet_team,bet_direction,bet_line"
               f"&season=eq.{season}&week=lt.{week}")
    gs = fetch(env, "cfb_slate_games",
               f"select=game_id,home_team,final_home,final_away"
               f"&season=eq.{season}&week=lt.{week}&final_home=not.is.null")
    fin = {g["game_id"]: g for g in gs}
    rec = {}
    for f in fl:
        g = fin.get(f["game_id"])
        k = f["signal_key"]
        if not g or any(k.startswith(p) for p in RATINGS_FED) or f.get("bet_line") is None:
            continue
        bl = float(f["bet_line"])
        bt, bd = f.get("bet_team"), f.get("bet_direction")
        hm = g["final_home"] - g["final_away"]
        tot = g["final_home"] + g["final_away"]
        res = None
        if f["market"] == "spread" and bt:
            m = hm if bt == g["home_team"] else -hm
            res = None if m + bl == 0 else m + bl > 0
        elif f["market"] == "total" and bd:
            res = None if tot == bl else (bd == "over") == (tot > bl)
        elif f["market"] == "team_total" and bt and bd:
            pts = g["final_home"] if bt == g["home_team"] else g["final_away"]
            res = None if pts == bl else (bd == "over") == (pts > bl)
        if res is not None:
            w, l = rec.get(k, (0, 0))
            rec[k] = (w + int(res), l + int(not res))
    return rec


def signal_score(key, defs, live):
    """Blend the validated backtest rate (prior) with this season's graded record."""
    prior = 54.0
    m = re.search(r"(\d+(?:\.\d+)?)%", (defs.get(key) or {}).get("typical_hit") or "")
    if m:
        prior = float(m.group(1))
    w, l = live.get(key, (0, 0))
    return (prior * PRIOR_N + 100.0 * w) / (PRIOR_N + w + l), (w, l)


def main():
    env = lib.load_env()
    if len(sys.argv) >= 3:
        season, week = int(sys.argv[1]), int(sys.argv[2])
    else:
        a = fetch(env, "cfb_slate_games", "select=season,week&order=season.desc,week.desc&limit=1")
        season, week = a[0]["season"], a[0]["week"]

    games = fetch(env, "cfb_slate_games",
                  f"select=game_id,home_team,away_team,kickoff,fg_spread_open,fg_spread_close,"
                  f"fg_total_open,fg_total_close,fg_pred_spread,fg_pred_total,fg_spread_pick,"
                  f"fg_total_pick,tt_home_close,tt_away_close,wx_summary"
                  f"&season=eq.{season}&week=eq.{week}")
    # Played games out of the report: their storylines auto-resolve via sync.
    now_iso = dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%S")
    upcoming = [g for g in games if g.get("kickoff") and str(g["kickoff"])[:19] > now_iso]
    gmap = {str(g["game_id"]): g for g in upcoming}
    label = {str(g["game_id"]): f"{g['away_team']} @ {g['home_team']}" for g in upcoming}
    flags = fetch(env, "cfb_slate_flags",
                  f"select=game_id,signal_key,side,market,conviction,tier,source,"
                  f"bet_team,bet_direction,bet_line"
                  f"&season=eq.{season}&week=eq.{week}")
    picks = fetch(env, "cfb_slate_picks",
                  f"select=game_id,card_group,pick_side,pick_team&season=eq.{season}&week=eq.{week}")
    defs = {d["signal_key"]: d for d in fetch(env, "cfb_signal_defs",
            "select=signal_key,display_name,typical_hit,one_liner")}
    # (signal_performance no longer read here — live records are graded directly
    # from finals in live_signal_records(), which also skips RATINGS_FED keys.)
    injuries = fetch(env, "cfb_injuries",
                     f"select=cfbd_team,player,pos,status,detail&season=eq.{season}&week=eq.{week}")
    model_side = {str(p["game_id"]): p.get("pick_side") for p in picks if p.get("card_group") == "spread"}
    model_tot = {str(p["game_id"]): p.get("pick_side") for p in picks if p.get("card_group") == "total"}

    S = []

    # ---- injuries -------------------------------------------------------------
    slate_teams = {g["home_team"] for g in upcoming} | {g["away_team"] for g in upcoming}
    inj = [i for i in injuries if i.get("cfbd_team") in slate_teams]
    by_team = {}
    for i in inj:
        by_team.setdefault(i["cfbd_team"], []).append(i)
    for team, rows in by_team.items():
        outs = [r for r in rows if r["status"] in ("Out", "IR")]
        qbs = [r for r in rows if r["pos"] == "QB"]
        if not outs and not qbs:
            continue
        gid = next((str(g["game_id"]) for g in upcoming if team in (g["home_team"], g["away_team"])), None)
        sev = 3 if any(q["status"] in ("Out", "IR") for q in qbs) else (2 if len(outs) >= 2 else 1)
        parts = []
        if qbs:
            parts.append("QB " + "; ".join(f"{q['player']} {q['status']}"
                                           + (f" ({q['detail']})" if q.get("detail") else "") for q in qbs))
        if outs:
            non_qb = [o for o in outs if o["pos"] != "QB"]
            if non_qb:
                parts.append(", ".join(f"{o['player']} ({o['pos']}) Out" for o in non_qb[:4]))
        S.append(dict(storyline_key=f"injury:{team}", family="injuries", game_id=gid,
                      matchup=label.get(gid), title=f"{team} injury report",
                      body=f"{team}: " + " | ".join(parts)
                           + ". CFB injury reporting is unmandated — an unlisted player is unreported, not confirmed healthy.",
                      data={"team": team, "listings": rows}, rank=100 - sev * 25))

    # ---- signals: CONFLUENCE engine ------------------------------------------
    # Per game+market: do the fired signals AGREE (one direction, no opposition),
    # CONFLICT (both directions fired), or stand alone? Alignments with no
    # opposing signal rank first, weighted by each family's blended record
    # (backtest prior + this season's graded finals). One raw flag != one
    # storyline any more (owner spec 2026-09-16).
    live = live_signal_records(env, season, week)

    def sig_label(key):
        d = defs.get(key, {})
        sc, (w, l) = signal_score(key, defs, live)
        bits = []
        m = re.search(r"(\d+(?:\.\d+)?)%", d.get("typical_hit") or "")
        if m:
            bits.append(f"{m.group(1)}% validated")
        if w + l >= 3:
            bits.append(f"{w}-{l} this season")
        return f"{d.get('display_name', key)}" + (f" ({', '.join(bits)})" if bits else ""), sc

    by_game = {}
    for f in flags:
        gid = str(f["game_id"])
        if gid not in gmap or any(f["signal_key"].startswith(p) for p in RATINGS_FED):
            continue
        by_game.setdefault(gid, []).append(f)

    for gid, fl in by_game.items():
        g = gmap[gid]
        sc_, tc_ = g.get("fg_spread_close"), g.get("fg_total_close")

        # -- spread group: direction = the team a flag bets
        sp = [f for f in fl if f["market"] == "spread" and f.get("bet_team")]
        teams = {f["bet_team"] for f in sp}
        # cross-market tension: a team-total UNDER on a team the spread flags lay
        tt_under = {f["bet_team"] for f in fl
                    if f["market"] == "team_total" and f.get("bet_direction") == "under"}
        if len(teams) == 1 and sp:
            team = next(iter(teams))
            line = (float(sc_) if team == g["home_team"] else -float(sc_)) if sc_ is not None else None
            target = f"{team} {line:+g}" if line is not None else team
            labels, scores = zip(*(sig_label(f["signal_key"]) for f in sp))
            avg = sum(scores) / len(scores)
            ms = model_side.get(gid)
            agree = (ms == ("HOME" if team == g["home_team"] else "AWAY")) if ms else None
            tension = (f" One signal argues the other way: a team-total under is live on {team}"
                       " — a thin-scoring cover is the risk." if team in tt_under and line is not None and line <= -14 else "")
            if len(sp) >= 2:
                S.append(dict(storyline_key=f"conf:spread:{gid}", family="signals", game_id=gid,
                              matchup=label.get(gid),
                              title=f"{len(sp)} signals align: {target}",
                              body=f"{label.get(gid)}: {len(sp)} independent signals point the same way"
                                   f" with nothing firing against them — {'; '.join(labels)}."
                                   + (" The model leans the same way." if agree else "")
                                   + tension
                                   + " Alignment of validated signals is the strongest read this board produces.",
                              data={"market": "spread", "target": target, "signals": [f["signal_key"] for f in sp],
                                    "blended_score": round(avg, 1), "model_agrees": agree},
                              rank=12 - 3 * min(len(sp), 4) + (0 if agree else 2)))
            elif scores[0] >= 57:
                S.append(dict(storyline_key=f"solo:{sp[0]['signal_key']}:{gid}", family="signals",
                              game_id=gid, matchup=label.get(gid),
                              title=f"{defs.get(sp[0]['signal_key'],{}).get('display_name', sp[0]['signal_key'])}: {target}",
                              body=f"{label.get(gid)}: {labels[0]} points to {target}, and no other signal"
                                   f" on this game argues against it. "
                                   f"{(defs.get(sp[0]['signal_key'],{}).get('one_liner') or '').rstrip('.')}."
                                   + (" The model leans the same way." if agree else "") + tension,
                              data={"market": "spread", "target": target, "signals": [sp[0]["signal_key"]],
                                    "blended_score": round(scores[0], 1), "model_agrees": agree},
                              rank=22 if agree else 26))
        elif len(teams) >= 2:
            sides = []
            for team in sorted(teams):
                ls = [sig_label(f["signal_key"])[0] for f in sp if f["bet_team"] == team]
                sides.append(f"{team}: {'; '.join(ls)}")
            S.append(dict(storyline_key=f"conflict:spread:{gid}", family="signals", game_id=gid,
                          matchup=label.get(gid),
                          title=f"Signals conflict — {label.get(gid)} spread",
                          body=f"{label.get(gid)}: our signals fire on BOTH sides of this spread — "
                               + " vs ".join(sides)
                               + ". When validated signals disagree, history says the edge cancels —"
                                 " this is a stay-away, not a lean.",
                          data={"market": "spread", "conflict": sides}, rank=46))

        # -- total group: total flags + team-total flags as direction evidence
        tot = [f for f in fl if f["market"] == "total" and f.get("bet_direction")]
        tt = [f for f in fl if f["market"] == "team_total" and f.get("bet_direction")]
        dirs = {f["bet_direction"] for f in tot} | {f["bet_direction"] for f in tt}
        if len(dirs) == 1 and tot and tc_ is not None:
            d0 = next(iter(dirs))
            target = f"{d0.upper()} {float(tc_):g}"
            group = tot + tt
            labels, scores = zip(*(sig_label(f["signal_key"]) for f in group))
            agree = (model_tot.get(gid) == d0.upper()) if model_tot.get(gid) else None
            # early_total_edge IS the blend's own lean — "the model agrees" would be
            # circular self-confirmation, and its rank bonus let auto-agreeing totals
            # groups crowd every spread alignment out of the quota (ND wk3 incident).
            if any(f["signal_key"] == "early_total_edge" for f in group):
                agree = None
            if len(group) >= 2:
                S.append(dict(storyline_key=f"conf:total:{gid}", family="signals", game_id=gid,
                              matchup=label.get(gid),
                              title=f"{len(group)} signals align: {target}",
                              body=f"{label.get(gid)}: every totals-family signal on this game points"
                                   f" {d0} — {'; '.join(labels)}."
                                   + (" The model leans the same way." if agree else "")
                                   + " Alignment of validated signals is the strongest read this board produces.",
                              data={"market": "total", "target": target, "signals": [f["signal_key"] for f in group],
                                    "blended_score": round(sum(scores) / len(scores), 1), "model_agrees": agree},
                              rank=12 - 3 * min(len(group), 4) + (0 if agree else 2)))
            elif scores[0] >= 57:
                S.append(dict(storyline_key=f"solo:{tot[0]['signal_key']}:{gid}", family="signals",
                              game_id=gid, matchup=label.get(gid),
                              title=f"{defs.get(tot[0]['signal_key'],{}).get('display_name', tot[0]['signal_key'])}: {target}",
                              body=f"{label.get(gid)}: {labels[0]} points to {target}, with nothing firing"
                                   f" the other way. "
                                   f"{(defs.get(tot[0]['signal_key'],{}).get('one_liner') or '').rstrip('.')}."
                                   + (" The model leans the same way." if agree else ""),
                              data={"market": "total", "target": target, "signals": [tot[0]["signal_key"]],
                                    "blended_score": round(scores[0], 1), "model_agrees": agree},
                              rank=22 if agree else 26))
        elif len(dirs) >= 2 and tc_ is not None:
            sides = []
            for d0 in sorted(dirs):
                ls = [sig_label(f["signal_key"])[0] for f in tot + tt if f["bet_direction"] == d0]
                sides.append(f"{d0}: {'; '.join(ls)}")
            S.append(dict(storyline_key=f"conflict:total:{gid}", family="signals", game_id=gid,
                          matchup=label.get(gid),
                          title=f"Signals conflict — {label.get(gid)} total",
                          body=f"{label.get(gid)}: totals signals fire in BOTH directions — "
                               + " vs ".join(sides)
                               + ". Conflicting signals cancel — stay away rather than pick a side.",
                          data={"market": "total", "conflict": sides}, rank=46))

    # ---- line movement (all markets) -----------------------------------------
    for g in upcoming:
        gid = str(g["game_id"])
        so, sc = g.get("fg_spread_open"), g.get("fg_spread_close")
        to_, tc = g.get("fg_total_open"), g.get("fg_total_close")
        moves = []
        if so is not None and sc is not None and abs(float(sc) - float(so)) >= 1.5:
            # Name the team the market moved toward — home-perspective line, so a
            # falling number = money on the home side. Abstract "home/away side"
            # phrasing let the narrative LLM invert direction (Tulsa incident).
            mover = g["home_team"] if float(sc) < float(so) else g["away_team"]
            moves.append(f"the spread moved from {g['home_team']} {float(so):+g} to "
                         f"{g['home_team']} {float(sc):+g} — money has come in on {mover}")
        if to_ is not None and tc is not None and abs(float(tc) - float(to_)) >= 1.5:
            d = "down" if float(tc) < float(to_) else "up"
            agree_t = (model_tot.get(gid) == ("UNDER" if d == "down" else "OVER"))
            moves.append(f"total {float(to_):g} -> {float(tc):g} ({d}"
                         + (", same direction as the model's lean" if agree_t else "") + ")")
        if moves:
            S.append(dict(storyline_key=f"move:{gid}", family="line_movement", game_id=gid,
                          matchup=label.get(gid), title=f"Line movement — {label.get(gid)}",
                          body=f"{label.get(gid)}: " + "; ".join(moves)
                               + ". Movement is information, not instruction — our steam research"
                                 " only validates totals moves confirmed by the model, and moves of"
                                 " 2.5+ that already happened are historically chased too late.",
                          data={"moves": moves}, rank=40))

    # ---- coach hammer/mercy on big numbers -----------------------------------
    try:
        hm = pd.read_csv(HERE / "coach_blowout" / "out" / "hammer_2026_teams.csv")
        tier_by_team = dict(zip(hm.school, hm.tier))
        coach_by_team = dict(zip(hm.school, hm.coach))
        for g in upcoming:
            sc = g.get("fg_spread_close")
            if sc is None or abs(float(sc)) < 14:
                continue
            fav = g["home_team"] if float(sc) < 0 else g["away_team"]
            tier = tier_by_team.get(fav)
            if tier not in ("hammer", "mercy"):
                continue
            gid = str(g["game_id"])
            verb = ("keeps starters in and keeps scoring with big leads"
                    if tier == "hammer" else "pulls back early with big leads")
            S.append(dict(storyline_key=f"coach:{gid}", family="coach", game_id=gid,
                          matchup=label.get(gid),
                          title=f"Coach disposition — {coach_by_team.get(fav)} laying {abs(float(sc)):g}",
                          body=f"{fav} is a {abs(float(sc)):g}-point favorite and our five-season"
                               f" blowout study grades {coach_by_team.get(fav)} as a '{tier}' coach —"
                               f" he historically {verb}. Early-season big spreads often come down to"
                               f" exactly this fourth-quarter disposition.",
                          data={"coach": coach_by_team.get(fav), "tier": tier, "spread": sc},
                          rank=45 if tier == "hammer" else 50))
    except Exception as e:
        print(f"[coach] skipped: {e}")

    # ---- rank, cap, sync ------------------------------------------------------
    # Family quotas keep the report diverse: without them 38 signal storylines
    # outrank everything and evict injuries/movement/coach entirely (first-run
    # bug), and the eviction set churns between runs. Injuries always seat
    # (owner rule). Deterministic order: (rank, key).
    QUOTA = {"injuries": 10, "signals": 15, "line_movement": 6, "coach": 4}
    dedup = {}
    for s in S:
        dedup.setdefault(s["storyline_key"], s)
    S = list(dedup.values())
    S.sort(key=lambda s: (s["rank"], s["storyline_key"]))
    by_fam, capped = {}, []
    for s in S:
        n = by_fam.get(s["family"], 0)
        if n < QUOTA.get(s["family"], 5):
            capped.append(s)
            by_fam[s["family"]] = n + 1
    S = capped[:MAX_STORYLINES]
    for i, s in enumerate(S):
        s["rank"] = i + 1
    log = lib.sync_storylines(env, "cfb", season, week, S)
    stored = fetch(env, "football_regression_storylines",
                   f"select=family,title,body,rank,matchup,status&sport=eq.cfb"
                   f"&season=eq.{season}&week=eq.{week}&order=rank")
    narrative, model = lib.generate_narrative(
        env, "college football",
        stored, f"Week {week}, {season} season. {len(upcoming)} games on the slate.")
    fam_counts = {}
    for s in stored:
        fam_counts[s["family"]] = fam_counts.get(s["family"], 0) + 1
    # Early-season banner: families gated on current-season data. Each item's
    # condition self-clears (week advances / data arrives) and the client hides
    # the banner when the list is empty — server-driven, no app update needed.
    coming = []
    if week <= 4:
        coming.append({"emoji": "📊", "label": "EPA & performance regression",
                       "note": "Which teams are over- or under-performing their underlying numbers — "
                               "activates once a few weeks of 2026 games are in the books (around Week 4)."})
        coming.append({"emoji": "🍀", "label": "Turnover & scoring luck",
                       "note": "Teams riding unsustainable turnover or finishing luck, due to regress — "
                               "needs a few weeks of games."})
        coming.append({"emoji": "📅", "label": "Team form & situational trends",
                       "note": "Recent-form reads (last 3-5 games, rest, lookahead spots) join the "
                               "report as the season builds a sample."})
    lib.write_report(env, "cfb", season, week, narrative, model, log,
                     {"games": len(upcoming), "storylines": len(stored), "families": fam_counts,
                      "coming_soon": coming,
                      "model_record": lib.fetch_model_record(env, "cfb", season)})
    print(f"cfb report {season} wk{week}: {len(S)} storylines "
          f"({len([l for l in log if l['type']=='new'])} new, "
          f"{len([l for l in log if l['type']=='updated'])} updated, "
          f"{len([l for l in log if l['type']=='resolved'])} resolved) | narrative: {bool(narrative)}")


if __name__ == "__main__":
    main()
