"""CFB weekly regression report — daily storyline generator (owner spec 2026-08-30).

Deterministic storyline engine over the week's slate. The LLM only writes the
narrative afterwards (football_report_lib). NO PICKS. Storyline families live
here; each family re-evaluates fully every run, so the lib's sync marks
vanished conditions RESOLVED instead of deleting them.

Families v1 (data available now):
  injuries      — covers.com listings for slate teams (QBs lead), backup-QB triggers
  signals       — active flags with model-agreement framing + live/all-time records
  line_movement — open->current across FG/TT/1H; steam vs the model's lean
  coach         — hammer/mercy-tier coaches laying big numbers (behavioral context)
Families gated until current-season data exists: EPA/luck regression, team form.
CFB cap: top ~30 by materiality (owner call). Usage: gen_cfb_regression_report.py [season week]
"""
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
    upcoming = [g for g in games if g.get("kickoff")]
    gmap = {str(g["game_id"]): g for g in upcoming}
    label = {str(g["game_id"]): f"{g['away_team']} @ {g['home_team']}" for g in upcoming}
    flags = fetch(env, "cfb_slate_flags",
                  f"select=game_id,signal_key,side,market,conviction,tier,source"
                  f"&season=eq.{season}&week=eq.{week}")
    picks = fetch(env, "cfb_slate_picks",
                  f"select=game_id,card_group,pick_side,pick_team&season=eq.{season}&week=eq.{week}")
    defs = {d["signal_key"]: d for d in fetch(env, "cfb_signal_defs",
            "select=signal_key,display_name,typical_hit,one_liner")}
    perf = {p["signal_key"]: p for p in fetch(env, "signal_performance",
            f"select=signal_key,n,wins,losses,hit_rate&sport=eq.cfb&order=season.desc")}
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

    # ---- signals with model-agreement framing --------------------------------
    for f in flags:
        gid = str(f["game_id"])
        if gid not in gmap or f.get("tier") != "active":
            continue
        d = defs.get(f["signal_key"], {})
        ms = model_side.get(gid) if f["market"] == "spread" else (
            model_tot.get(gid) if f["market"] == "total" else None)
        agree = (ms == f.get("side")) if ms and f.get("side") in ("HOME", "AWAY", "OVER", "UNDER") else None
        pr = perf.get(f["signal_key"])
        rec = (f" Live this season: {pr['wins']}-{pr['losses']}." if pr and (pr.get("wins") or pr.get("losses")) else "")
        frame = (" The model leans the same way." if agree is True else
                 (" Note: the model leans the other way — treat as tension, not confirmation." if agree is False else ""))
        S.append(dict(storyline_key=f"signal:{f['signal_key']}:{gid}", family="signals",
                      game_id=gid, matchup=label.get(gid),
                      title=f"{d.get('display_name', f['signal_key'])} — {label.get(gid)}",
                      body=f"{d.get('one_liner','Validated signal')} fired on {f.get('side')} "
                           f"({f['market']}). Historical record: {d.get('typical_hit','validated')}." + rec + frame,
                      data={"signal_key": f["signal_key"], "side": f.get("side"),
                            "market": f["market"], "model_agrees": agree,
                            "conviction": f.get("conviction")},
                      rank=20 if agree else 35))

    # ---- line movement (all markets) -----------------------------------------
    for g in upcoming:
        gid = str(g["game_id"])
        so, sc = g.get("fg_spread_open"), g.get("fg_spread_close")
        to_, tc = g.get("fg_total_open"), g.get("fg_total_close")
        moves = []
        if so is not None and sc is not None and abs(float(sc) - float(so)) >= 1.5:
            direction = "toward the home side" if float(sc) < float(so) else "toward the away side"
            with_model = (g.get("fg_spread_pick") or "").split(" ")[0]
            moves.append(f"spread {float(so):+g} -> {float(sc):+g} ({direction})")
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
    QUOTA = {"injuries": 10, "signals": 12, "line_movement": 8, "coach": 5}
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
    lib.write_report(env, "cfb", season, week, narrative, model, log,
                     {"games": len(upcoming), "storylines": len(stored), "families": fam_counts})
    print(f"cfb report {season} wk{week}: {len(S)} storylines "
          f"({len([l for l in log if l['type']=='new'])} new, "
          f"{len([l for l in log if l['type']=='updated'])} updated, "
          f"{len([l for l in log if l['type']=='resolved'])} resolved) | narrative: {bool(narrative)}")


if __name__ == "__main__":
    main()
