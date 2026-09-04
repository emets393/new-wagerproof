"""Grade DIRECT-GRADED flags (sharp action + late-season defense family) at their DETECTION line and publish season-to-date records.

The signal_performance rollup grades through pick cards; sharp-action flags fire mid-week
on their own side/line, so they are graded here directly (side margin + detection line)
and upserted into signal_performance (pk sport, signal_key, season). Runs in grade_week.sh
AFTER run_grade_rpcs (the RPC rebuilds the season's rows first; this appends ours).
"""
import json
import os
import sys

import requests

HERE = os.path.dirname(os.path.abspath(__file__))
SUPA = "https://jpxnjuwglavsjbgbasnl.supabase.co/rest/v1"
KEYS = ("sharp_action_1to3d", "sharp_action_6h", "mid_fade_good_defense",
        "late_bad_o_vs_good_d_tt_under", "late_good_o_vs_bad_d_tt_over", "late_matchup_under")


def _key():
    for line in open(os.path.join(HERE, "..", "..", ".env.local")):
        if line.startswith("SUPABASE_SERVICE_KEY="):
            return line.split("=", 1)[1].strip()
    return os.environ.get("SUPABASE_SERVICE_KEY") or sys.exit("no key")


def main():
    season = int(sys.argv[1]) if len(sys.argv) > 1 else 2026
    sk = _key()
    hdr = {"apikey": sk, "Authorization": f"Bearer {sk}", "Content-Type": "application/json"}
    fl = requests.get(f"{SUPA}/nfl_slate_flags?season=eq.{season}&signal_key=in.({','.join(KEYS)})"
                      f"&select=game_id,week,signal_key,market,side,bet_team,bet_direction,bet_line,line", headers=hdr, timeout=60).json()
    if not fl:
        print("[sharp-grade] no sharp flags yet"); return
    gids = ",".join(sorted({f["game_id"] for f in fl}))
    gm = requests.get(f"{SUPA}/nfl_slate_games?game_id=in.({gids})&select=game_id,home_team,final_home,final_away",
                      headers=hdr, timeout=60).json()
    finals = {g["game_id"]: g for g in gm if g.get("final_home") is not None}
    out = []
    for key in KEYS:
        w = l = p = 0; last = 0
        for f in fl:
            if f["signal_key"] != key or f["game_id"] not in finals:
                continue
            g = finals[f["game_id"]]
            is_home = f.get("bet_team") == g["home_team"]
            tot = g["final_home"] + g["final_away"]
            side = str(f.get("side") or "").upper()
            if f["market"] == "total":
                cm = (tot - float(f["line"])) * (1 if "OVER" in side else -1)
            elif f["market"] == "team_total":
                pts = g["final_home"] if is_home else g["final_away"]
                cm = (pts - float(f["line"])) * (1 if (f.get("bet_direction") or "").lower() == "over" or "OVER" in side else -1)
            else:
                margin = (g["final_home"] - g["final_away"]) if is_home else (g["final_away"] - g["final_home"])
                cm = margin + float(f.get("bet_line") if f.get("bet_line") is not None else f["line"])
            if cm > 0: w += 1
            elif cm < 0: l += 1
            else: p += 1
            last = max(last, int(f["week"]))
        n = w + l + p
        if not n:
            continue
        units = w * (100 / 110) - l
        out.append({"sport": "nfl", "signal_key": key, "season": season, "n": n, "wins": w, "losses": l,
                    "pushes": p, "hit_rate": round(w / (w + l), 4) if (w + l) else None,
                    "units": round(units, 3), "roi": round(units / n, 4), "last_week": last})
    if out:
        r = requests.post(f"{SUPA}/signal_performance?on_conflict=sport,signal_key,season",
                          headers={**hdr, "Prefer": "resolution=merge-duplicates,return=minimal"}, json=out, timeout=60)
        r.raise_for_status()
    summary = [(o["signal_key"], "%d-%d-%d" % (o["wins"], o["losses"], o["pushes"])) for o in out]
    print(f"[sharp-grade] {summary or 'nothing graded yet'}")


if __name__ == "__main__":
    main()
