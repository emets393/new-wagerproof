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
        f"{SUPA}/football_regression_storylines?select=id,storyline_key,body,rank,status,updates"
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
        elif old.get("body") != s["body"]:
            patch.update(status="updated", body=s["body"], data=s.get("data"),
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
                 "note": "No longer holds at current lines/data — kept for the record."}],
            "updated_at": "now()"}, timeout=30)
        log.append({"type": "resolved", "key": key})
    return log


def write_report(env, sport, season, week, narrative, narrative_model, run_log, summary):
    H = hdr(env)
    cur = requests.get(f"{SUPA}/football_regression_reports?select=changelog"
                       f"&sport=eq.{sport}&season=eq.{season}&week=eq.{week}",
                       headers=H, timeout=30).json()
    day = today_et()
    changelog = (cur[0]["changelog"] if cur else []) or []
    changelog = [c for c in changelog if c.get("date") != day]
    if run_log:
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
- Lead with the 2-4 most material storylines (rank order is provided). Group the rest
  briefly by theme. Mention resolved storylines only if instructive.
- Plain language, no hype, no emojis. Numbers stated exactly as given."""


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
