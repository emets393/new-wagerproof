#!/usr/bin/env python3
"""Compose the weekly spotlight narratives with an LLM — WITHOUT letting it near the analysis.

⛔ READ THIS BEFORE CHANGING THE PROMPT. This repo already retired an LLM for this exact job.
`daily-widget-summaries` (writer LLM -> gate -> judge LLM) wrote the game-detail headlines and
"kept getting side attribution backwards — calling a -3.3 home edge '+3.3 for the home team' —
which QC did not reliably catch" (CLAUDE.md, .claude/docs/17_widget_headlines.md). It was replaced
by deterministic formatters that take values the component had ALREADY derived, so a headline
cannot contradict the numbers under it.

The same rule binds here, and it is the whole architecture:

  THE MODEL NEVER DERIVES, ATTRIBUTES OR COMPUTES ANYTHING.
  Every number, every direction and every rank is decided by fp_spotlight.py. The model receives
  finished, already-correct sentences and may only join them into prose.

And the piece that was missing last time is a VALIDATOR rather than another LLM judge:
  · every number in the output must appear in the input facts — a fabricated or altered figure
    fails the row outright;
  · the direction word must match the computed direction, and the opposite word may not appear
    except inside a quoted "points toward" phrase;
  · no verdict verbs (bet, lock, smash, target, hammer, guarantee) — doc 20's scope rule;
  · failure falls back to the DETERMINISTIC summary, which is always correct if plainer.

A fallback is not a failure of the feature. A wrong sentence is.
"""
from __future__ import annotations
import argparse, json, os, re, sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
MODEL = os.environ.get("SPOTLIGHT_MODEL", "gpt-4.1")
BANNED = re.compile(r"\b(bet|lock|smash|hammer|guarantee|lean|play it|take the|free money|"
                    r"can't lose|sure thing|must)\b", re.I)
NUMRE = re.compile(r"-?\d+(?:\.\d+)?")


def api_key():
    for name in ("OPENAI_API_KEY_REPORTS", "OPENAI_API_KEY"):
        v = os.environ.get(name)
        if v:
            return v
        for p in (HERE / ".." / ".." / ".env.local", HERE / ".." / ".." / ".env"):
            if p.exists():
                for ln in open(p):
                    if ln.startswith(name + "="):
                        val = ln.split("=", 1)[1].strip()
                        if val:
                            return val
    return None


def deterministic(row):
    """The fallback, and the thing the LLM output is checked against. Always correct."""
    d = row["direction"].upper()
    counted = [t for t in row["tells"] if t["w"] > 0]
    ctx = [t for t in row["tells"] if t["w"] == 0]
    head = (f"{row['market_label']} {row['line']} vs {row['opp']}: "
            f"{len(counted)} of the things we track point {d}.")
    body = " ".join(s["text"][0].upper() + s["text"][1:] + "." for s in counted)
    tail = (" Against it: " + " ".join(s["text"] + "." for s in ctx)) if ctx else ""
    return head + " " + body + tail


def numbers_in(s):
    """Sign-stripped, because a fact of "-89%" is honestly rendered as "89% below".

    Keep the magnitudes strict though: the first run rejected three correct paragraphs on the sign
    alone AND caught a real fabrication — the model wrote San Francisco's Cover 3 rate as 49% when
    the fact said 47%. That is exactly the error that retired the previous headline pipeline, so
    the magnitude check stays literal.
    """
    return {n.lstrip("-") for n in NUMRE.findall(s or "")}


LEAD_READS = 3          # how many reads the paragraph actually narrates


def lead_tells(row):
    """The reads the paragraph must cover, strongest first.

    ⛔ IT USED TO BE ALL OF THEM, and that is what made the prose unreadable. A pick carries 4-9
    counted tells; demanding a figure from every one of them inside 110 words produced a list of
    nine numbers with no argument, and it dragged irrelevant reads in by force — the Aaron Jones
    rushing write-up ended on "they pass 45% against their own 55% overall", a PASSING stat on a
    RUSHING pick, purely because the rule required that tell to appear.

    The card already renders every tell underneath the paragraph, so nothing is lost by narrating
    only the strongest few. Weight first, then the original family order, which runs roughly
    volume -> matchup -> efficiency.
    """
    counted = [t for t in row["tells"] if t["w"] > 0]
    ranked = sorted(enumerate(counted), key=lambda x: (-x[1]["w"], x[0]))
    return [t for _, t in ranked[:LEAD_READS]], counted


def validate(text, row):
    """Reject anything the facts do not support. Returns (ok, reason)."""
    if not text or len(text) < 40:
        return False, "empty or too short"
    if BANNED.search(text):
        return False, f"verdict verb: {BANNED.search(text).group(0)!r}"
    allowed = set()
    for t in row["tells"]:
        allowed |= numbers_in(t["text"])
    allowed |= numbers_in(str(row.get("line")))
    allowed |= numbers_in(str(len([t for t in row["tells"] if t["w"] > 0])))
    allowed |= {str(x) for x in range(0, 33)}            # ranks and small counts
    bad = [n for n in numbers_in(text) if n not in allowed]
    if bad:
        return False, f"numbers not in the facts: {bad[:4]}"
    # ⛔ CHECKING ONLY FOR INVENTED NUMBERS IS NOT ENOUGH, and this caught it live: for Geno Smith
    # the model wrote "as favorites, the Jets pass more often" from a fact reading "they pass 53%
    # against their own 60% overall" — a REVERSED relationship that passed because it OMITTED the
    # numbers that would have exposed it. Omission is how a reversal hides.
    # So every counted tell must put at least one of its own distinctive figures into the prose.
    for t in lead_tells(row)[0]:
        if t["w"] <= 0:
            continue
        own = {n for n in numbers_in(t["text"]) if n not in {"0", "1", "2", "3", "4", "5"}}
        if own and not (own & numbers_in(text)):
            return False, (f"drops every figure from the {t['src']} read, so its direction cannot "
                           f"be checked: {t['text'][:70]}...")
    d, opp = row["direction"].lower(), ("under" if row["direction"].lower() == "over" else "over")
    if d not in text.lower():
        return False, f"never states the direction {d!r}"
    # the opposite word may appear only where a tell itself used it
    tell_text = " ".join(t["text"] for t in row["tells"]).lower()
    if opp in text.lower() and opp not in tell_text:
        return False, f"introduces the opposite direction {opp!r}"
    return True, ""


def prompt_for(row):
    lead, counted = lead_tells(row)
    rest = len(counted) - len(lead)
    facts = "\n".join(f"- [{t['dir'].upper()}] {t['text']}" for t in lead)
    context = ""
    return f"""Write the summary paragraph for a sports-analytics card. 55-85 words, one paragraph.

PLAYER: {row['player']} ({row['pos']}, {row['team']}) vs {row['opp']}
MARKET: {row['market_label']}, line {row['line']}
WHAT THE NUMBERS SAY: they point {row['direction'].upper()} — {len(counted)} independent reads agree, {row['n_against']} disagree.

THE READS TO NARRATE (strongest first — these are the only ones you write about):
{facts}
{f"{chr(10)}There are {rest} further reads pointing the same way. The card lists them under your paragraph, so do NOT mention them individually. You may close by noting that {rest} more reads agree." if rest > 0 else ""}

RULES — these are absolute:
1. Use ONLY the numbers above. Do not compute, combine, round or infer any new figure.
2. Do not reverse or reattribute anything. If a read says a defense allows less than league, it
   allows less — never flip it into a positive for the player.
3. Never tell the reader what to bet. No bet, lock, smash, hammer, target, guarantee, must.
   The frame is "the numbers point {row['direction']}", and the reader decides.
4. Plain language a knowledgeable fan reads at a glance. No hype, no emoji, no headings.
5. Lead with the first read listed, which is the strongest, then the other two, then the
   disagreement if any. Write it as an argument that builds, not a list of facts.
5b. Stay on the market. This is a {row['market_label'].lower()} pick — do not close on a figure
   about a different market.
6. Quote at least one figure from EVERY read listed above. Describing a read without its numbers
   is how a relationship gets reversed, and the paragraph will be rejected.
6b. Write about NOTHING ELSE. Reads not listed above belong to the card, not the paragraph.
7. Never name a season or a year. Say "last season" and "this season" exactly as the facts do.
8. Preserve every comparison's direction. If a figure is below a baseline, it is below — do not
   render it as the team or player doing more of something.

Write only the paragraph."""


def call_openai(prompt, key, model=MODEL):
    import requests
    r = requests.post("https://api.openai.com/v1/chat/completions",
                      headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
                      json={"model": model, "temperature": 0.3,
                            "messages": [{"role": "system", "content":
                                          "You compose sports-analytics summaries from facts you "
                                          "are given. You never calculate, never infer a number, "
                                          "and never recommend a wager."},
                                         {"role": "user", "content": prompt}]},
                      timeout=90)
    if r.status_code != 200:
        raise RuntimeError(f"openai {r.status_code}: {r.text[:200]}")
    return r.json()["choices"][0]["message"]["content"].strip()


SUPA = "https://jpxnjuwglavsjbgbasnl.supabase.co/rest/v1"


def _service_key():
    k = os.environ.get("SUPABASE_SERVICE_KEY")
    if k:
        return k
    env = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", ".env.local")
    if os.path.exists(env):
        for ln in open(env):
            if ln.startswith("SUPABASE_SERVICE_KEY="):
                return ln.split("=", 1)[1].strip()
    return None


def save_narrative(season, week, row, text, model):
    """PATCH one spotlight row's narrative, matched on its natural key.

    A PATCH, not an upsert: fp_spotlight.py --write owns the pick and must stay the record of
    what the reader was shown. Writing a whole row from here could resurrect a pick the board no
    longer carries, or overwrite a line that has since been graded.
    """
    import requests
    k = _service_key()
    if not k:
        print("  ! no SUPABASE_SERVICE_KEY — narrative not saved")
        return False
    q = (f"season=eq.{season}&week=eq.{week}&player_id=eq.{row['player_id']}"
         f"&market=eq.{row['market']}")
    r = requests.patch(f"{SUPA}/nfl_prop_spotlight?{q}",
                       headers={"apikey": k, "Authorization": f"Bearer {k}",
                                "Content-Type": "application/json",
                                "Prefer": "return=representation"},
                       json={"narrative": text, "narrative_model": model,
                             "updated_at": "now()"}, timeout=60)
    if r.status_code not in (200, 204):
        print(f"  ! narrative save failed ({r.status_code}): {r.text[:160]}")
        return False
    # A 200 with an empty body means the key matched nothing — the board row was never written,
    # which is silent data loss unless it is called out here.
    if r.status_code == 200 and isinstance(r.json(), list) and not r.json():
        print(f"  ! no nfl_prop_spotlight row for {row['player']} / {row['market']} — "
              f"run fp_spotlight.py --emit --write first")
        return False
    return True


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("board", help="json produced by fp_spotlight.py --emit")
    ap.add_argument("--model", default=MODEL)
    ap.add_argument("--dry-run", action="store_true", help="show the deterministic text only")
    ap.add_argument("--write", action="store_true",
                    help="save each narrative onto its nfl_prop_spotlight row")
    ap.add_argument("--season", type=int, default=int(os.environ.get("NFL_SEASON", 2026)))
    ap.add_argument("--week", type=int, default=int(os.environ.get("NFL_WEEK", 0)))
    a = ap.parse_args()
    rows = json.load(open(a.board))
    key = api_key()
    if not key and not a.dry_run:
        raise SystemExit("no OPENAI_API_KEY_REPORTS found; run with --dry-run")
    if a.write and not a.week:
        raise SystemExit("--write needs --week (or NFL_WEEK) to match the board rows")
    ok = fail = saved = 0
    for row in rows:
        det = deterministic(row)
        out, note = det, "deterministic"
        if not a.dry_run:
            try:
                cand = call_openai(prompt_for(row), key, a.model)
                good, why = validate(cand, row)
                if good:
                    out, note, ok = cand, f"llm ({a.model})", ok + 1
                else:
                    note, fail = f"LLM REJECTED — {why}; fell back", fail + 1
            except Exception as e:
                note, fail = f"LLM error {e}; fell back", fail + 1
        print("=" * 96)
        print(f"{row['player']} — {row['pos']}, {row['team']} vs {row['opp']} · "
              f"{row['market_label']} {row['line']} · points {row['direction'].upper()}  [{note}]")
        print("  " + out.replace("\n", "\n  "))
        # Saved whether the model wrote it or the deterministic fallback did: the page needs a
        # write-up either way, and `narrative_model` records which one the reader got.
        if a.write and row.get("player_id"):
            saved += bool(save_narrative(a.season, a.week, row, out,
                                         a.model if note.startswith("llm") else "deterministic"))
    if not a.dry_run:
        print(f"\n{ok} written by the model, {fail} fell back to the deterministic text")
    if a.write:
        print(f"{saved} of {len(rows)} narratives saved to nfl_prop_spotlight")


if __name__ == "__main__":
    main()
