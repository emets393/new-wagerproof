"""
Finals writer (task #10) — NFL + CFB. Post-game, UPDATE {nfl,cfb}_dryrun_games.final_home/away
from the canonical full-game sources:
  NFL <- nflverse_games (home_score/away_score)
  CFB <- cfb_games       (home_points/away_points, the CFBD cron table)

This DECOUPLES live finals from the gens (the NFL gen otherwise sources finals from the
1H sub-pipeline's h1tt_frame.parquet). Every grader (agent edge-fn, signal RPC, prop RPC)
reads final_*, so this unblocks live grading.

1H (h1_home/away) is NOT filled — neither source carries halftime; that needs PBP / CFBD
line scores (tracking-tier, deferred with the 1H model).

Run:  python3 fill_finals.py            # dry-run: match + validate vs existing finals
      python3 fill_finals.py --write    # PATCH final_home/away for matched games
"""
import sys
import requests
import pandas as pd
from pathlib import Path
from fetch import fetch_table, nflverse_games

ROOT = Path(__file__).resolve().parent
BASE = "https://jpxnjuwglavsjbgbasnl.supabase.co/rest/v1"
WRITE = "--write" in sys.argv


def service_key():
    for line in (ROOT.parent.parent / ".env.local").read_text().splitlines():
        if line.startswith("SUPABASE_SERVICE_KEY="):
            return line.split("=", 1)[1].strip()
    raise SystemExit("SUPABASE_SERVICE_KEY not found in .env.local")


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
        n = 0
        for _, r in matched.iterrows():
            resp = requests.patch(f"{BASE}/{table}?game_id=eq.{r.game_id}", headers=hdr,
                                  json={"final_home": int(r.sh), "final_away": int(r.sa)}, timeout=30)
            resp.raise_for_status()
            n += 1
        print(f"[{label}] PATCHed final_home/away on {n} games")


def fill_nfl(hdr):
    nv = nflverse_games()
    nv = nv[nv["home_score"].notna()].rename(
        columns={"home_team": "home_ab", "away_team": "away_ab",
                 "home_score": "sh", "away_score": "sa"})
    dg = fetch_table("nfl_dryrun_games",
                     select="game_id,season,week,home_ab,away_ab,final_home,final_away")
    m = dg.merge(nv[["season", "week", "home_ab", "away_ab", "sh", "sa"]],
                 on=["season", "week", "home_ab", "away_ab"], how="left", indicator=True)
    _report_and_write("NFL", "nfl_dryrun_games", dg, m, ["home_ab", "away_ab"], hdr)


def fill_cfb(hdr):
    cg = fetch_table("cfb_games", select="season,week,home_team,away_team,home_points,away_points")
    cg = cg[cg["home_points"].notna()].rename(columns={"home_points": "sh", "away_points": "sa"})
    dg = fetch_table("cfb_dryrun_games",
                     select="game_id,season,week,home_team,away_team,final_home,final_away")
    m = dg.merge(cg[["season", "week", "home_team", "away_team", "sh", "sa"]],
                 on=["season", "week", "home_team", "away_team"], how="left", indicator=True)
    _report_and_write("CFB", "cfb_dryrun_games", dg, m, ["home_team", "away_team"], hdr)


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
        print("\n[dry-run] no writes. Re-run with --write once match + validate are clean.")


if __name__ == "__main__":
    main()
