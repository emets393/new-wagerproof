"""Shared engine for the NFL/CFB weekly regression reports.

The WEEK is the document; the daily generator run is an editor:
  - storylines APPEND (never delete); dedupe on storyline_key
  - a changed storyline gets an UPDATE entry on its timeline (status 'updated')
  - a dead storyline gets RESOLVED with the reason — grayed out, not removed
  - every run writes a "what changed today" changelog entry on the report row
  - the LLM writes the weekly narrative over the CURATED storyline payload
    (never raw data) and is guarded against contradicting it — the MLB
    report's writer-not-analyst pattern. NO PICKS anywhere (owner rule).

Used by research/nfl-extreme-outcomes/gen_nfl_regression_report.py and
research/cfb-model/gen_cfb_regression_report.py.
"""
import datetime as dt
import json
import os
from pathlib import Path

import requests

SUPA = "https://jpxnjuwglavsjbgbasnl.supabase.co/rest/v1"
ROOT = Path(__file__).resolve().parent


def load_env():
    env = {}
    for fn in (ROOT.parent / ".env.local", ROOT.parent / ".env"):
        if fn.exists():
            for line in fn.read_text().splitlines():
                if "=" in line and not line.startswith("#"):
                    k, v = line.split("=", 1)
                    env.setdefault(k.strip(), v.strip())
    for k in ("SUPABASE_SERVICE_KEY", "OPENAI_API_KEY_REPORTS", "OPENAI_API_KEY_MLB"):
        if os.environ.get(k):
            env[k] = os.environ[k]
    return env


def hdr(env):
    k = env["SUPABASE_SERVICE_KEY"]
    return {"apikey": k, "Authorization": f"Bearer {k}", "Content-Type": "application/json"}


def today_et():
    return dt.datetime.now(dt.timezone.utc).astimezone(
        dt.timezone(dt.timedelta(hours=-4))).strftime("%Y-%m-%d")


def sync_storylines(env, sport, season, week, fresh):
    """Reconcile freshly-computed storylines against the stored week.

    fresh: list of dicts with storyline_key, family, title, body, data, rank,
    and optional game_id/matchup. Returns the changelog entries for this run.
    """
    H = hdr(env)
    existing = requests.get(
        f"{SUPA}/football_regression_storylines?select=id,storyline_key,title,body,rank,status,updates"
        f"&sport=eq.{sport}&season=eq.{season}&week=eq.{week}", headers=H, timeout=60).json()
    by_key = {e["storyline_key"]: e for e in existing}
    log, day = [], today_et()

    for s in fresh:
        key = s["storyline_key"]
        old = by_key.pop(key, None)
        if old is None:
            row = dict(sport=sport, season=season, week=week, **s)
            r = requests.post(f"{SUPA}/football_regression_storylines", headers=H,
                              json=row, timeout=30)
            if r.status_code == 201:
                log.append({"type": "new", "key": key, "title": s["title"]})
            continue
        patch = {"rank": s.get("rank"), "updated_at": "now()"}
        if old.get("status") == "resolved":
            # condition is TRUE again after being resolved — reactivate on the record
            patch.update(status="updated", body=s["body"], data=s.get("data"),
                         updates=(old.get("updates") or []) + [
                             {"date": day, "status": "updated", "note": "Condition re-emerged — storyline reactivated."}])
            log.append({"type": "reactivated", "key": key, "title": s["title"]})
        elif old.get("body") != s["body"] or old.get("title") != s["title"]:
            patch.update(status="updated", title=s["title"], body=s["body"], data=s.get("data"),
                         updates=(old.get("updates") or []) + [
                             {"date": day, "status": "updated", "note": s.get("update_note") or "Details refreshed with today's data."}])
            log.append({"type": "updated", "key": key, "title": s["title"]})
        requests.patch(f"{SUPA}/football_regression_storylines?id=eq.{old['id']}",
                       headers=H, json=patch, timeout=30)

    # anything stored-but-not-fresh whose family re-evaluates every run is now
    # RESOLVED (the condition no longer holds). Families that only accrue
    # (e.g. one-shot notes) can be excluded by the caller via resolve_families.
    for key, old in by_key.items():
        if old.get("status") == "resolved":
            continue
        requests.patch(f"{SUPA}/football_regression_storylines?id=eq.{old['id']}", headers=H, json={
            "status": "resolved",
            "updates": (old.get("updates") or []) + [
                {"date": day, "status": "resolved",
                 "note": "No longer applies — the line moved, the data changed, or the game has kicked off. Kept for the record."}],
            "updated_at": "now()"}, timeout=30)
        log.append({"type": "resolved", "key": key, "title": old.get("title") or key})
    return log


MARKET_LABELS = {"fg_spread": "Spread", "fg_total": "Total", "fg_ml": "Moneyline",
                 "tt": "Team Totals", "h1_spread": "1H Spread", "h1_total": "1H Total",
                 "h1_ml": "1H Moneyline"}


def fetch_model_record(env, sport, season):
    """Overall per-market model records vs the close, for the report summary.

    football_model_record itself is SERVER-ONLY (owner call 2026-08-31 —
    edge/team splits are not for external anon readers); the report embeds
    just these headline records, which is the sanctioned public surface.
    """
    rows = requests.get(
        f"{SUPA}/football_model_record?select=market,wins,losses,pushes,roi_units,roi_n"
        f"&sport=eq.{sport}&season=eq.{season}&scope=eq.overall&order=market",
        headers=hdr(env), timeout=30).json()
    if not isinstance(rows, list):
        return []
    order = list(MARKET_LABELS)
    rows.sort(key=lambda r: order.index(r["market"]) if r["market"] in order else 99)
    return [dict(market=r["market"], label=MARKET_LABELS.get(r["market"], r["market"]),
                 wins=r["wins"], losses=r["losses"], pushes=r["pushes"],
                 roi_units=r["roi_units"], roi_n=r.get("roi_n")) for r in rows]


def write_report(env, sport, season, week, narrative, narrative_model, run_log, summary):
    H = hdr(env)
    cur = requests.get(f"{SUPA}/football_regression_reports?select=changelog"
                       f"&sport=eq.{sport}&season=eq.{season}&week=eq.{week}",
                       headers=H, timeout=30).json()
    day = today_et()
    changelog = (cur[0]["changelog"] if cur else []) or []
    if run_log:
        # Replace today's entry with the fresh log; a NO-CHANGE run keeps the
        # earlier entry (a later idempotent rerun must not erase the day's news).
        changelog = [c for c in changelog if c.get("date") != day]
        changelog.insert(0, {"date": day, "entries": run_log})
    row = dict(sport=sport, season=season, week=week, narrative=narrative,
               narrative_model=narrative_model, changelog=changelog,
               summary=summary, updated_at="now()")
    if cur:
        requests.patch(f"{SUPA}/football_regression_reports?sport=eq.{sport}"
                       f"&season=eq.{season}&week=eq.{week}", headers=H, json=row, timeout=30)
    else:
        requests.post(f"{SUPA}/football_regression_reports", headers=H, json=row, timeout=30)


NARRATIVE_SYSTEM = """You are a sharp sports analytics writer for WagerProof, a premium
sports betting analytics platform. Write a concise 500-700 word weekly {league} report in
markdown from the structured storylines provided.

HARD RULES:
- NEVER recommend, suggest, or imply a pick or bet. You describe what the data shows and
  what to WATCH; the reader decides. No "take", "back", "fade", "play", "bet" imperatives.
- Use ONLY facts present in the storylines JSON. Never invent numbers, players, trends,
  or injuries. If a storyline lacks a number, describe it qualitatively.
- When a signal storyline says the model agrees, say so plainly; when it conflicts with
  the model, present it as tension, not as a resolution.
- Line movement: repeat the storyline's own wording about WHICH TEAM money came in on.
  NEVER re-derive direction from the numbers yourself — a home-perspective spread going
  UP means money on the AWAY team, and getting this backwards is a firing offense.
- Lead with the 2-4 most material storylines (rank order is provided). Group the rest
  briefly by theme. Skip resolved storylines entirely.
- Plain language, no hype. One fitting emoji at the start of each section heading is
  encouraged (e.g. "## 🏥 Injuries"); none in body text. Numbers stated exactly as given."""


def generate_narrative(env, league, storylines, extra_context=""):
    key = env.get("OPENAI_API_KEY_REPORTS") or env.get("OPENAI_API_KEY_MLB")
    if not key:
        return None, None
    payload = [{k: s.get(k) for k in ("family", "title", "body", "rank", "matchup", "status")}
               for s in storylines]
    body = {
        "model": "gpt-4o",
        "messages": [
            {"role": "system", "content": NARRATIVE_SYSTEM.format(league=league)},
            {"role": "user", "content": (extra_context + "\n\nSTORYLINES:\n"
                                         + json.dumps(payload, default=str))[:60000]},
        ],
        "max_tokens": 1400, "temperature": 0.4,
    }
    try:
        r = requests.post("https://api.openai.com/v1/chat/completions",
                          headers={"Authorization": f"Bearer {key}"}, json=body, timeout=120)
        r.raise_for_status()
        text = r.json()["choices"][0]["message"]["content"]
        lowered = text.lower()
        for banned in ("bet the", "take the", "back the", "fade the", "our pick", "we like"):
            if banned in lowered:
                return None, None      # guardrail: no-picks rule violated -> ship without narrative
        return text, "gpt-4o"
    except Exception as e:
        print(f"[narrative] failed ({e}) — shipping structured report without narrative")
        return None, None


# ---------------------------------------------------------------------------
# Signal CONFLUENCE engine (owner spec 2026-09-16) — shared by the CFB and NFL
# regression reports so the logic can never drift between sports.
#
# Groups a week's flags per game+market and emits storylines for:
#   (a) multi-signal alignments with no opposing signal  (rank rewards count)
#   (b) strong solo signals (blended record >= SOLO_BAR, nothing opposing)
#   (c) explicit conflicts — signals firing on BOTH sides = stay-away
# Each family's record is graded live against this season's finals via the
# structured bet_* fields, then blended with the validated backtest rate.
# ---------------------------------------------------------------------------
import re as _re

CONF_PRIOR_N = 20    # pseudo-games behind the backtest rate in the blend
CONF_SOLO_BAR = 57.0


def live_signal_records(env, season, week, flags_table, games_table, excluded=()):
    """{signal_key: (w, l)} — every prior-week flag this season graded against
    finals. Only full-game spread/total/team_total markets grade (no 1H).
    `excluded` families (ratings-fed) are skipped: their stored rows for played
    games were historically regenerated with post-game inputs."""
    fl = _fetch(env, flags_table,
                f"select=game_id,signal_key,market,bet_team,bet_direction,bet_line"
                f"&season=eq.{season}&week=lt.{week}")
    gs = _fetch(env, games_table,
                f"select=game_id,home_team,final_home,final_away"
                f"&season=eq.{season}&week=lt.{week}&final_home=not.is.null")
    fin = {str(g["game_id"]): g for g in gs}
    rec = {}
    for f in fl:
        g = fin.get(str(f["game_id"]))
        k = f["signal_key"]
        if not g or any(k.startswith(p) for p in excluded) or f.get("bet_line") is None:
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


def _fetch(env, table, params):
    import requests as _rq
    r = _rq.get(f"{SUPA}/{table}?{params}", headers=hdr(env), timeout=60)
    j = r.json()
    return j if isinstance(j, list) else []


def _sig_label(key, defs, live):
    d = defs.get(key) or {}
    prior = 54.0
    m = _re.search(r"(\d+(?:\.\d+)?)%", d.get("typical_hit") or "")
    if m:
        prior = float(m.group(1))
    w, l = live.get(key, (0, 0))
    score = (prior * CONF_PRIOR_N + 100.0 * w) / (CONF_PRIOR_N + w + l)
    bits = []
    if m:
        bits.append(f"{m.group(1)}% validated")
    if w + l >= 3:
        bits.append(f"{w}-{l} this season")
    return d.get("display_name", key) + (f" ({', '.join(bits)})" if bits else ""), score


def confluence_storylines(env, sport, season, week, gmap, label, flags, defs,
                          model_side, model_tot, flags_table, games_table,
                          model_own_keys=(), ratings_fed=(), blanket_keys=()):
    """Build the signals-family storylines. `gmap` = {gid: game row with
    home_team/away_team/fg_spread_close/fg_total_close}; `flags` need
    game_id/signal_key/market/bet_team/bet_direction/bet_line."""
    live = live_signal_records(env, season, week, flags_table, games_table, ratings_fed)
    out = []
    by_game = {}
    for f in flags:
        gid = str(f["game_id"])
        k = f["signal_key"]
        if gid not in gmap or k in blanket_keys or any(k.startswith(p) for p in ratings_fed):
            continue
        by_game.setdefault(gid, []).append(f)

    for gid, fl in by_game.items():
        g = gmap[gid]
        sc_, tc_ = g.get("fg_spread_close"), g.get("fg_total_close")

        sp = [f for f in fl if f["market"] == "spread" and f.get("bet_team")]
        teams = {f["bet_team"] for f in sp}
        tt_under = {f["bet_team"] for f in fl
                    if f["market"] == "team_total" and f.get("bet_direction") == "under"}
        if len(teams) == 1 and sp:
            team = next(iter(teams))
            line = (float(sc_) if team == g["home_team"] else -float(sc_)) if sc_ is not None else None
            target = f"{team} {line:+g}" if line is not None else team
            labels, scores = zip(*(_sig_label(f["signal_key"], defs, live) for f in sp))
            ms = model_side.get(gid)
            agree = (ms == ("HOME" if team == g["home_team"] else "AWAY")) if ms else None
            if any(f["signal_key"] in model_own_keys for f in sp):
                agree = None       # the group contains the model's own lean — no circular bonus
            tension = (f" One signal argues the other way: a team-total under is live on {team}"
                       " — a thin-scoring cover is the risk."
                       if team in tt_under and line is not None and line <= -14 else "")
            if len(sp) >= 2:
                out.append(dict(storyline_key=f"conf:spread:{gid}", family="signals", game_id=gid,
                                matchup=label.get(gid), title=f"{len(sp)} signals align: {target}",
                                body=f"{label.get(gid)}: {len(sp)} independent signals point the same way"
                                     f" with nothing firing against them — {'; '.join(labels)}."
                                     + (" The model leans the same way." if agree else "") + tension
                                     + " Alignment of validated signals is the strongest read this board produces.",
                                data={"market": "spread", "target": target,
                                      "signals": [f["signal_key"] for f in sp],
                                      "blended_score": round(sum(scores) / len(scores), 1),
                                      "model_agrees": agree},
                                rank=12 - 3 * min(len(sp), 4) + (0 if agree else 2)))
            elif scores[0] >= CONF_SOLO_BAR:
                key0 = sp[0]["signal_key"]
                out.append(dict(storyline_key=f"solo:{key0}:{gid}", family="signals", game_id=gid,
                                matchup=label.get(gid),
                                title=f"{(defs.get(key0) or {}).get('display_name', key0)}: {target}",
                                body=f"{label.get(gid)}: {labels[0]} points to {target}, and no other"
                                     f" signal on this game argues against it. "
                                     f"{((defs.get(key0) or {}).get('one_liner') or '').rstrip('.')}."
                                     + (" The model leans the same way." if agree else "") + tension,
                                data={"market": "spread", "target": target, "signals": [key0],
                                      "blended_score": round(scores[0], 1), "model_agrees": agree},
                                rank=22 if agree else 26))
        elif len(teams) >= 2:
            sides = []
            for team in sorted(teams):
                ls = [_sig_label(f["signal_key"], defs, live)[0] for f in sp if f["bet_team"] == team]
                sides.append(f"{team}: {'; '.join(ls)}")
            out.append(dict(storyline_key=f"conflict:spread:{gid}", family="signals", game_id=gid,
                            matchup=label.get(gid),
                            title=f"Signals conflict — {label.get(gid)} spread",
                            body=f"{label.get(gid)}: our signals fire on BOTH sides of this spread — "
                                 + " vs ".join(sides)
                                 + ". When validated signals disagree, the edge cancels — this is a"
                                   " stay-away, not a lean.",
                            data={"market": "spread", "conflict": sides}, rank=46))

        tot = [f for f in fl if f["market"] == "total" and f.get("bet_direction")]
        tt = [f for f in fl if f["market"] == "team_total" and f.get("bet_direction")]
        dirs = {f["bet_direction"] for f in tot} | {f["bet_direction"] for f in tt}
        if len(dirs) == 1 and tot and tc_ is not None:
            d0 = next(iter(dirs))
            target = f"{d0.upper()} {float(tc_):g}"
            group = tot + tt
            labels, scores = zip(*(_sig_label(f["signal_key"], defs, live) for f in group))
            agree = (model_tot.get(gid) == d0.upper()) if model_tot.get(gid) else None
            if any(f["signal_key"] in model_own_keys for f in group):
                agree = None
            if len(group) >= 2:
                out.append(dict(storyline_key=f"conf:total:{gid}", family="signals", game_id=gid,
                                matchup=label.get(gid), title=f"{len(group)} signals align: {target}",
                                body=f"{label.get(gid)}: every totals-family signal on this game points"
                                     f" {d0} — {'; '.join(labels)}."
                                     + (" The model leans the same way." if agree else "")
                                     + " Alignment of validated signals is the strongest read this board produces.",
                                data={"market": "total", "target": target,
                                      "signals": [f["signal_key"] for f in group],
                                      "blended_score": round(sum(scores) / len(scores), 1),
                                      "model_agrees": agree},
                                rank=12 - 3 * min(len(group), 4) + (0 if agree else 2)))
            elif scores[0] >= CONF_SOLO_BAR:
                key0 = tot[0]["signal_key"]
                out.append(dict(storyline_key=f"solo:{key0}:{gid}", family="signals", game_id=gid,
                                matchup=label.get(gid),
                                title=f"{(defs.get(key0) or {}).get('display_name', key0)}: {target}",
                                body=f"{label.get(gid)}: {labels[0]} points to {target}, with nothing"
                                     f" firing the other way. "
                                     f"{((defs.get(key0) or {}).get('one_liner') or '').rstrip('.')}."
                                     + (" The model leans the same way." if agree else ""),
                                data={"market": "total", "target": target, "signals": [key0],
                                      "blended_score": round(scores[0], 1), "model_agrees": agree},
                                rank=22 if agree else 26))
        elif len(dirs) >= 2 and tc_ is not None:
            sides = []
            for d0 in sorted(dirs):
                ls = [_sig_label(f["signal_key"], defs, live)[0] for f in tot + tt if f["bet_direction"] == d0]
                sides.append(f"{d0}: {'; '.join(ls)}")
            out.append(dict(storyline_key=f"conflict:total:{gid}", family="signals", game_id=gid,
                            matchup=label.get(gid),
                            title=f"Signals conflict — {label.get(gid)} total",
                            body=f"{label.get(gid)}: totals signals fire in BOTH directions — "
                                 + " vs ".join(sides)
                                 + ". Conflicting signals cancel — stay away rather than pick a side.",
                            data={"market": "total", "conflict": sides}, rank=46))
    return out
