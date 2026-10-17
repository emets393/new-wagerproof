"""
Finals writer (task #10) — NFL + CFB. Post-game, UPDATE {nfl,cfb}_slate_games.final_home/away
from the canonical full-game sources:
  NFL <- nflverse_games (home_score/away_score)
  CFB <- cfb_games       (home_points/away_points, the CFBD cron table)

This DECOUPLES live finals from the gens (the NFL gen otherwise sources finals from the
1H sub-pipeline's h1tt_frame.parquet). Every grader (agent edge-fn, signal RPC, prop RPC)
reads final_*, so this unblocks live grading.

1H (h1_home/away) is filled by the companion fill_h1.py (NFL nflverse PBP end-of-Q2, CFB
CFBD /games line scores). This script is full-game only; grade_week.sh runs both.

Run:  python3 fill_finals.py            # slate: match + validate vs existing finals
      python3 fill_finals.py --write    # PATCH final_home/away for matched games
"""
import sys
import time

import requests
import pandas as pd
from pathlib import Path
from fetch import fetch_table, nflverse_games


def _gid(v):
    """URL-safe game_id: collapse float64 CFB ids (401864570.0 -> 401864570); NFL string ids pass through."""
    if isinstance(v, float) and v == int(v):
        return int(v)
    return v


ROOT = Path(__file__).resolve().parent
BASE = "https://jpxnjuwglavsjbgbasnl.supabase.co/rest/v1"
WRITE = "--write" in sys.argv


def service_key():
    for line in (ROOT.parent.parent / ".env.local").read_text().splitlines():
        if line.startswith("SUPABASE_SERVICE_KEY="):
            return line.split("=", 1)[1].strip()
    raise SystemExit("SUPABASE_SERVICE_KEY not found in .env.local")


def _patch_final(table, gid, sh, sa, hdr, tries=3):
    """One idempotent finals PATCH, retried on a transient failure.

    `set -e` in grade_week.sh means ONE bad response here skips steps 1b-5 (1H finals,
    player logs, prop + pick grading, the analysis_base append) for the whole run — so a
    single hiccup costs a full grading cycle. Seen 2026-10-15: a lone 400 on a no-op write
    (row already held the same score, table has no triggers or check constraints) killed
    the 08:00Z run. raise_for_status() also discards the response body, so the log said
    only "400 Bad Request" — carry it into the message or the next failure is just as blind.
    """
    last = None
    for attempt in range(tries):
        try:
            resp = requests.patch(f"{BASE}/{table}?game_id=eq.{gid}", headers=hdr,
                                  json={"final_home": sh, "final_away": sa}, timeout=30)
        except requests.exceptions.RequestException as e:
            # ⛔ A DROPPED CONNECTION NEVER REACHED THE RETRY ABOVE. requests RAISES on an
            # SSL EOF or a reset rather than returning a response, so the loop was skipped
            # entirely and the exception took the run with it — exactly how fill_h1 died on
            # 2026-10-15 and 10-16 ("SSLEOFError ... EOF occurred in violation of protocol").
            # Over a season these two writers make four-figure single-row calls a day; a
            # transient drop is a certainty, not an edge case.
            last = f"{type(e).__name__}: {str(e)[:300]}"
        else:
            if resp.ok:
                return
            last = f"HTTP {resp.status_code} {resp.text[:300]}"
        # 4xx that is genuinely our fault (bad column, bad type) will not heal on retry,
        # but we cannot tell those apart from a pooler-level 400 without the body — so
        # retry a few times and let the message say what came back.
        if attempt < tries - 1:
            time.sleep(2 * (attempt + 1))
    raise SystemExit(f"[finals] PATCH {table} game_id={gid} -> {sh}-{sa} failed "
                     f"after {tries} tries: {last}")


def _report_and_write(label, table, dg, m, keycols, hdr):
    matched = m[m["_merge"] == "both"]
    unmatched = m[m["_merge"] != "both"]
    print(f"[{label}] matched {len(matched)}/{len(dg)} by (season,week,{','.join(keycols)})")
    if len(unmatched):
        print(f"[{label}] UNMATCHED (source has no completed row / abbr mismatch):")
        print(unmatched[["season", "week"] + keycols].to_string(index=False))

    chk = matched[matched["final_home"].notna()]
    mism = chk[(chk["final_home"] != chk["sh"]) | (chk["final_away"] != chk["sa"])]
    print(f"[{label}] {len(chk)} matched games already have finals; score mismatches: {len(mism)}")
    if len(mism):
        print(mism[["season", "week"] + keycols +
                   ["final_home", "sh", "final_away", "sa"]].to_string(index=False))

    if WRITE and hdr is not None:
        # ⛔ WRITE WHAT CHANGED, NOT THE WHOLE SEASON. This loop re-sent every matched game
        # on every run — 80 NFL + 339 CFB, three runs a day, against rows the line above had
        # just confirmed already hold the same score ("score mismatches: 0"). Each one is its
        # own HTTPS round trip, so the no-op writes were both the entire failure surface and
        # pure load. `todo` keeps the genuinely new rows (no final yet) and the handful that
        # disagree with the source.
        todo = matched[matched["final_home"].isna()
                       | (matched["final_home"] != matched["sh"])
                       | (matched["final_away"] != matched["sa"])]
        for _, r in todo.iterrows():
            _patch_final(table, _gid(r.game_id), int(r.sh), int(r.sa), hdr)
        print(f"[{label}] PATCHed final_home/away on {len(todo)} games "
              f"({len(matched) - len(todo)} already correct, skipped)")


def fill_nfl(hdr):
    nv = nflverse_games()
    nv = nv[nv["home_score"].notna()].rename(
        columns={"home_team": "home_ab", "away_team": "away_ab",
                 "home_score": "sh", "away_score": "sa"})
    dg = fetch_table("nfl_slate_games",
                     select="game_id,season,week,home_ab,away_ab,final_home,final_away")
    m = dg.merge(nv[["season", "week", "home_ab", "away_ab", "sh", "sa"]],
                 on=["season", "week", "home_ab", "away_ab"], how="left", indicator=True)
    _report_and_write("NFL", "nfl_slate_games", dg, m, ["home_ab", "away_ab"], hdr)


def fill_cfb(hdr):
    cg = fetch_table("cfb_games", select="season,week,home_team,away_team,home_points,away_points")
    cg = cg[cg["home_points"].notna()].rename(columns={"home_points": "sh", "away_points": "sa"})
    dg = fetch_table("cfb_slate_games",
                     select="game_id,season,week,home_team,away_team,final_home,final_away")
    m = dg.merge(cg[["season", "week", "home_team", "away_team", "sh", "sa"]],
                 on=["season", "week", "home_team", "away_team"], how="left", indicator=True)
    _report_and_write("CFB", "cfb_slate_games", dg, m, ["home_team", "away_team"], hdr)


def main():
    hdr = None
    if WRITE:
        k = service_key()
        hdr = {"apikey": k, "Authorization": f"Bearer {k}",
               "Content-Type": "application/json", "Prefer": "return=minimal"}
    fill_nfl(hdr)
    print()
    fill_cfb(hdr)
    if not WRITE:
        print("\n[slate] no writes. Re-run with --write once match + validate are clean.")


if __name__ == "__main__":
    main()
