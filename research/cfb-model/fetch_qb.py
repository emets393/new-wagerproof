"""
Pull per-game QB (top passer) per team from /games/players, 2021 -> current season.
-> data/cfbd/qb_starts.parquet : season, week, game_id, team, qb, att, cmp, yds, td, int

Usage: fetch_qb.py [--force]      (--force re-pulls instead of using the cached parquet)
"""
import datetime
import os
import sys

import pandas as pd
import cfbd

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "data", "cfbd")


def _current_season() -> int:
    """CFB season year — the season starts in August, so Jan-Jul belongs to the prior season."""
    n = datetime.datetime.now(datetime.timezone.utc)
    return n.year if n.month >= 8 else n.year - 1


# Through the CURRENT season, not a frozen list. The old hardcoded [2021..2025] meant the live
# season's QB starts were never pulled, and the two consumers that matter — the backup_qb trigger
# and cfb_forecast's QB live overlay — need exactly that. On Render the file never existed at all
# because this script was not in run_cfb_week.sh, so both printed "skipped" on every run of 2026.
YEARS = list(range(2021, _current_season() + 1))


def main():
    out = os.path.join(DATA, "qb_starts.parquet")
    # The cache is correct for frozen history but wrong mid-season, when the current year gains a
    # week of starts every Saturday — so the weekly runner passes --force.
    if os.path.exists(out) and "--force" not in sys.argv:
        print("cached"); return
    rows = []
    for y in YEARS:
        for wk in range(1, 16):
            try:
                games = cfbd.get("/games/players", year=y, week=wk)
            except Exception:
                continue
            for g in games:
                gid = g.get("id")
                for t in g.get("teams", []):
                    team = t.get("team")
                    for cat in t.get("categories", []):
                        if cat.get("name") != "passing":
                            continue
                        # gather per-athlete attempts from C/ATT
                        stats = {}
                        for typ in cat.get("types", []):
                            for a in typ.get("athletes", []):
                                stats.setdefault(a["name"], {})[typ["name"]] = a["stat"]
                        # pick top passer by attempts
                        best, best_att = None, -1
                        for name, s in stats.items():
                            ca = s.get("C/ATT", "0/0")
                            try:
                                att = int(str(ca).split("/")[1])
                            except Exception:
                                att = 0
                            if att > best_att:
                                best, best_att = name, att
                        if best and best_att >= 1:
                            s = stats[best]
                            cmp_, att = (str(s.get("C/ATT", "0/0")).split("/") + ["0"])[:2]
                            rows.append({"season": y, "week": wk, "game_id": gid, "team": team,
                                         "qb": best, "att": int(att) if att.isdigit() else 0})
        print(f"  {y}: {len(rows)} rows so far")
    pd.DataFrame(rows).to_parquet(out, index=False)
    print(f"qb_starts: {len(rows)} -> {out}")


if __name__ == "__main__":
    main()
