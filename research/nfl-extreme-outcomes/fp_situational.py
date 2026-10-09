#!/usr/bin/env python3
"""Situational splits, computed AS OF a given week so a backtest cannot cheat.

Owner 2026-10-08: "in our previous regression report player prop model, we have situations that
certain players do well in, so like primetime games, divisional games, against specific
opponents". Those exist in nfl_player_prop_trends and the spotlight never read them.

⛔ THE LIVE TABLE CANNOT BE USED FOR A BACKTEST. nfl_player_prop_trends is a SNAPSHOT — one row per
player "through 2026 wk4" — so scoring 2025 week 6 with it would use games from weeks 7-18 and
every season since. That is the same shape of leak that made P12 look like a 70% signal. This
recomputes the splits from games strictly BEFORE the target week.

Dimensions: home / away / division / non_division / primetime / regular. Each is "how often did he
clear the posted line in this kind of spot", which is only meaningful against his OVERALL rate —
a 60% primetime record means nothing if he clears 60% everywhere.

⚠ PER-OPPONENT HISTORY IS DELIBERATELY NOT HERE. "How he does against THIS defense" measured
22-35% WORSE than baseline (prop-baseline-blend-law): 1-3 meetings is history, not projection.
Use the defense's ALLOWANCE, which the matchup blob already carries.

Source is props_frame.parquet — the same consensus close + actual the backtest grades on, so a
split and its grading agree by construction.
"""
import io
import os

import pandas as pd
import requests

HERE = os.path.dirname(os.path.abspath(__file__))
GAMES_CSV = "https://github.com/nflverse/nfldata/raw/master/data/games.csv"
NORM = {"LAR": "LA", "WSH": "WAS", "JAC": "JAX", "OAK": "LV", "SD": "LAC", "STL": "LA"}
MIN_N = 4                 # under four games in a spot is an anecdote, not a split
_CTX = None


def game_context():
    """{(season, week, team): (is_home, div_game, primetime)} for every team-game."""
    global _CTX
    if _CTX is not None:
        return _CTX
    g = pd.read_csv(io.StringIO(requests.get(GAMES_CSV, timeout=90).text), low_memory=False)
    g = g[g.game_type == "REG"].copy()
    g["home_ab"] = g.home_team.replace(NORM)
    g["away_ab"] = g.away_team.replace(NORM)
    g["pt"] = pd.to_numeric(g.gametime.str.slice(0, 2), errors="coerce").fillna(0) >= 19
    out = {}
    for r in g.itertuples(index=False):
        div = bool(getattr(r, "div_game", 0) == 1)
        out[(int(r.season), int(r.week), r.home_ab)] = (True, div, bool(r.pt))
        out[(int(r.season), int(r.week), r.away_ab)] = (False, div, bool(r.pt))
    _CTX = out
    return out


def _dims(is_home, div, pt):
    return (["home" if is_home else "away"]
            + ["division" if div else "non_division"]
            + ["primetime" if pt else "regular"])


def splits_as_of(season, week, seasons_back=2):
    """{(player_id, market): {dim: {"n":…, "hit":…, "pct":…}, "overall": …}} from games BEFORE
    (season, week). Includes prior seasons, which is the point — a primetime record needs years.
    """
    pf = pd.read_parquet(os.path.join(HERE, "data", "props_frame.parquet"))
    lo = season - seasons_back
    pf = pf[(pf.season >= lo) & ((pf.season < season) | (pf.week < week))].copy()
    if pf.empty:
        return {}
    for c in ("close_line", "actual"):
        pf[c] = pd.to_numeric(pf[c], errors="coerce")
    pf = pf.dropna(subset=["close_line", "actual", "player_id", "team"])
    # one row per player-game-market; props_frame is PER BOOK
    g = pf.groupby(["season", "week", "player_id", "market", "team"], as_index=False).agg(
        close_line=("close_line", "median"), actual=("actual", "first"))
    g = g[g.actual != g.close_line]
    if g.empty:
        return {}
    ctx = game_context()
    g["ctx"] = [ctx.get((int(s), int(w), t)) for s, w, t in zip(g.season, g.week, g.team)]
    g = g[g.ctx.notna()]
    g["over"] = g.actual > g.close_line

    out = {}
    for (pid, mkt), gg in g.groupby(["player_id", "market"]):
        rec = {"overall": {"n": int(len(gg)), "hit": int(gg.over.sum()),
                           "pct": round(float(gg.over.mean()), 3)}}
        for r in gg.itertuples(index=False):
            for d in _dims(*r.ctx):
                b = rec.setdefault(d, {"n": 0, "hit": 0})
                b["n"] += 1
                b["hit"] += int(r.over)
        for d, b in rec.items():
            if d != "overall":
                b["pct"] = round(b["hit"] / b["n"], 3) if b["n"] else None
        out[(str(pid), mkt)] = rec
    return out


def read_for(splits, player_id, market, is_home, div, pt):
    """The dims that apply to THIS game, each with its lift over the player's own overall rate.

    The lift is the whole point: a 62% primetime record is noise if he clears 62% everywhere, and
    a 55% one is real if his overall is 40%.
    """
    rec = splits.get((str(player_id), market))
    if not rec or "overall" not in rec:
        return []
    ov = rec["overall"]
    if ov["n"] < MIN_N or ov.get("pct") is None:
        return []
    out = []
    for d in _dims(is_home, div, pt):
        b = rec.get(d)
        if not b or b["n"] < MIN_N or b.get("pct") is None:
            continue
        out.append({"dim": d, "n": b["n"], "hit": b["hit"], "pct": b["pct"],
                    "overall_pct": ov["pct"], "overall_n": ov["n"],
                    "lift": round(b["pct"] - ov["pct"], 3)})
    return out


if __name__ == "__main__":
    import sys
    s = int(sys.argv[1]) if len(sys.argv) > 1 else 2026
    w = int(sys.argv[2]) if len(sys.argv) > 2 else 5
    sp = splits_as_of(s, w)
    print(f"splits as of {s} wk{w}: {len(sp)} (player, market) pairs")
    rich = [(k, v) for k, v in sp.items() if v["overall"]["n"] >= 10]
    print(f"  with 10+ graded games: {len(rich)}")
    for k, v in rich[:3]:
        print(f"   {k}: overall {v['overall']['hit']}/{v['overall']['n']} "
              f"({v['overall']['pct']})  dims={[d for d in v if d != 'overall']}")
