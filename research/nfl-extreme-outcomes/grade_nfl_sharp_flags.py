"""Grade EVERY NFL signal flag on its OWN side and line, and publish season-to-date records.

WHY THIS IS NOT THROUGH THE PICK CARDS (owner, 2026-10-05). refresh_signal_performance
grades NFL game signals by joining nfl_slate_picks.signal_keys to the CARD and crediting
the CARD's result to the signal. That can only ever measure a signal on the subset of
games where the model happened to agree with it — and when the card listed a signal that
pointed the other way, it credited the wrong side outright: legacy_primetime read 2-0 in
2026 because PIT@CLE attached it to a Cleveland +3 card (won) while the signal itself took
Pittsburgh -3 (lost by 3). Separating counter_signal_keys stopped the false win, but a
signal that disagrees with the model still vanished from its own record, win or lose.

A signal IS a bet. nfl_slate_flags stores its side, its own line (bet_line, already signed
from the bet's perspective), its grade_line and its stake. So grade it there: bet-team
margin + bet_line for sides, actual vs line for totals, bet-team points for team totals.
No agreement with the model required, because none is implied.

This file used to grade six hand-listed sharp-action keys; it now covers every key present
in nfl_slate_flags and OVERWRITES their signal_performance rows. Runs in grade_week.sh
AFTER run_grade_rpcs, which rebuilds the season first — the RPC still owns the prop-flag
keys (nfl_slate_props), which are a different path.

Every market is oracle-checked before anything is written: build the side the realised
result makes a winner and assert it grades as a win. A sign flip in any branch is a silent
inversion of a published record, so it fails the run instead.

CFB TOO (2026-10-06). cfb_slate_flags has IDENTICAL columns, and the CFB block of
refresh_signal_performance still rebuilds from cfb_slate_picks.signal_keys — so every CFB
signal was undercounted exactly as NFL was: key_dog published 16 of 42 fired, soft_book_gap
36 of 66, ret_prod_edge 48 of 78, and home_dog_ml / conf_sunbelt_fade published NOTHING while
firing 17 and 3 times. Pass the sport; the tables are symmetric.

Usage: grade_nfl_sharp_flags.py [season] [sport]      # sport = nfl (default) | cfb
"""
import collections
import os
import sys

import requests

HERE = os.path.dirname(os.path.abspath(__file__))
SUPA = "https://jpxnjuwglavsjbgbasnl.supabase.co/rest/v1"


def _key():
    for line in open(os.path.join(HERE, "..", "..", ".env.local")):
        if line.startswith("SUPABASE_SERVICE_KEY="):
            return line.split("=", 1)[1].strip()
    return os.environ.get("SUPABASE_SERVICE_KEY") or sys.exit("no key")


def _num(v):
    try:
        return None if v is None else float(v)
    except (TypeError, ValueError):
        return None


def cover_margin(flag, game, *, side_override=None, line_override=None):
    """Signed margin for the BET. >0 win, <0 loss, 0 push, None ungradeable.

    `side_override` / `line_override` exist for the oracle check, which needs to grade a
    synthetic bet it knows the answer to without touching the stored flag.
    """
    fh, fa = _num(game.get("final_home")), _num(game.get("final_away"))
    if fh is None or fa is None:
        return None
    mkt = flag["market"]
    side = str(side_override if side_override is not None else (flag.get("side") or "")).upper()
    is_home = flag.get("bet_team") == game.get("home_team")
    # `side` is authoritative; bet_direction is only a fallback for rows whose side string
    # does not name a direction. OR-ing the two let bet_direction override an explicit side —
    # the oracle caught it on 2026_01_SF_LA, where a synthetic UNDER graded as an OVER
    # because the stored flag's bet_direction was "over". A disagreement between the two
    # must resolve to the side, never to both.
    if "OVER" in side or "UNDER" in side:
        over, under = "OVER" in side, "UNDER" in side
    else:
        bd = str(flag.get("bet_direction") or "").lower()
        over, under = bd == "over", bd == "under"

    if mkt in ("h1_spread", "h1_total"):
        hh, ha = _num(game.get("h1_home")), _num(game.get("h1_away"))
        if hh is None or ha is None:
            return None                     # 1H score not filled yet
        fh, fa = hh, ha

    if mkt in ("spread", "h1_spread"):
        # bet_line is ALREADY signed from the bet side's view (PIT -3 -> -3.0). `line` is
        # home-perspective, so falling back to it silently inverts every away bet — skip
        # instead (8 of 134 rows carry no bet_line).
        ln = line_override if line_override is not None else _num(flag.get("bet_line"))
        if ln is None:
            return None
        margin = (fh - fa) if is_home else (fa - fh)
        return margin + ln
    if mkt in ("total", "h1_total"):
        ln = line_override if line_override is not None else _num(flag.get("line"))
        if ln is None or not (over or under):
            return None
        return ((fh + fa) - ln) * (1 if over else -1)
    if mkt == "team_total":
        ln = line_override if line_override is not None else _num(flag.get("line"))
        if ln is None or not (over or under):
            return None
        pts = fh if is_home else fa
        return (pts - ln) * (1 if over else -1)
    if mkt == "ml":
        margin = (fh - fa) if is_home else (fa - fh)
        return margin                        # a tie is a push, which is correct for ML
    return None


def oracle_check(flags, finals):
    """Grade a bet that KNOWS the result. Must win every time, in every market branch."""
    checked = collections.Counter()
    for f in flags:
        g = finals.get(str(f["game_id"]))
        if not g:
            continue
        mkt = f["market"]
        fh, fa = _num(g.get("final_home")), _num(g.get("final_away"))
        if mkt in ("h1_spread", "h1_total"):
            fh, fa = _num(g.get("h1_home")), _num(g.get("h1_away"))
        if fh is None or fa is None:
            continue
        if mkt in ("spread", "h1_spread"):
            margin = (fh - fa) if f.get("bet_team") == g.get("home_team") else (fa - fh)
            if margin == 0:
                continue
            # lay the bet team by just under its own margin -> must win
            cm = cover_margin(f, g, line_override=-(abs(margin) - 0.5) if margin > 0 else None,
                              side_override=f.get("side"))
            if margin > 0:
                assert cm is not None and cm > 0, f"oracle {mkt} on {f['game_id']} ({cm})"
                checked[mkt] += 1
        elif mkt in ("total", "h1_total", "team_total"):
            pts = (fh + fa) if mkt != "team_total" else (
                fh if f.get("bet_team") == g.get("home_team") else fa)
            cm = cover_margin(f, g, side_override="OVER", line_override=pts - 0.5)
            assert cm is not None and cm > 0, f"oracle {mkt} OVER on {f['game_id']} ({cm})"
            cm = cover_margin(f, g, side_override="UNDER", line_override=pts + 0.5)
            assert cm is not None and cm > 0, f"oracle {mkt} UNDER on {f['game_id']} ({cm})"
            checked[mkt] += 1
    print(f"  [oracle] passed in {dict(checked)}")


def main():
    season = int(sys.argv[1]) if len(sys.argv) > 1 else 2026
    sport = (sys.argv[2] if len(sys.argv) > 2 else "nfl").lower()
    if sport not in ("nfl", "cfb"):
        sys.exit(f"sport must be nfl or cfb, got {sport!r}")
    sk = _key()
    hdr = {"apikey": sk, "Authorization": f"Bearer {sk}", "Content-Type": "application/json"}
    fl = requests.get(f"{SUPA}/{sport}_slate_flags?season=eq.{season}&select=game_id,week,signal_key,"
                      f"market,side,bet_team,bet_direction,bet_line,line,tier&limit=20000",
                      headers=hdr, timeout=90).json()
    if not isinstance(fl, list) or not fl:
        print(f"[signal-grade] {sport}: no flags yet"); return
    # cfb_slate_flags.game_id is an INT while nfl_slate_flags.game_id is TEXT, so normalise to
    # str on both the URL filter and the lookup key — otherwise the finals dict never matches.
    gids = ",".join(sorted({str(f["game_id"]) for f in fl}))
    gm = requests.get(f"{SUPA}/{sport}_slate_games?game_id=in.({gids})"
                      f"&select=game_id,home_team,final_home,final_away,h1_home,h1_away",
                      headers=hdr, timeout=90).json()
    finals = {str(g["game_id"]): g for g in gm if g.get("final_home") is not None}
    oracle_check(fl, finals)

    rec = collections.defaultdict(lambda: [0, 0, 0, 0])      # key -> w, l, p, last_week
    skipped = collections.Counter()
    for f in fl:
        g = finals.get(str(f["game_id"]))
        if not g:
            continue
        cm = cover_margin(f, g)
        if cm is None:
            skipped[f"{f['market']}/no-line-or-direction"] += 1
            continue
        r = rec[f["signal_key"]]
        r[0 if cm > 0 else (1 if cm < 0 else 2)] += 1
        r[3] = max(r[3], int(f["week"]))
    out = []
    for key, (w, l, p, last) in sorted(rec.items()):
        n = w + l + p
        units = w * (100 / 110) - l
        out.append({"sport": sport, "signal_key": key, "season": season, "n": n, "wins": w,
                    "losses": l, "pushes": p,
                    "hit_rate": round(w / (w + l), 4) if (w + l) else None,
                    "units": round(units, 3), "roi": round(units / n, 4) if n else None,
                    "last_week": last})
    if out:
        r = requests.post(f"{SUPA}/signal_performance?on_conflict=sport,signal_key,season",
                          headers={**hdr, "Prefer": "resolution=merge-duplicates,return=minimal"},
                          json=out, timeout=90)
        r.raise_for_status()
    print(f"[signal-grade] {len(out)} signals graded on their OWN side/line"
          + (f" | skipped: {dict(skipped)}" if skipped else ""))
    for o in sorted(out, key=lambda x: -x["n"])[:40]:
        rr = f"{o['wins']}-{o['losses']}" + (f"-{o['pushes']}" if o["pushes"] else "")
        print(f"   {o['signal_key']:<34}{rr:>12}  n={o['n']:<4}"
              + (f"hit {o['hit_rate']*100:.1f}%" if o["hit_rate"] is not None else ""))


if __name__ == "__main__":
    main()
