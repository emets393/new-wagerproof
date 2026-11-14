#!/usr/bin/env python3
"""Zig-zag ATS: back the team that did NOT cover its last game, against one that DID.

Owner 2026-11-03 asked for this weekly, so it does the whole job in one run:
grade the season to date, print the dimension records, then score the upcoming board
against them.

    python3 zigzag_ats.py                 # auto: grade season to date + score the next week
    python3 zigzag_ats.py --week 9         # score a specific week
    python3 zigzag_ats.py --grade-only     # just the season record + dimension table

THE SPOT
--------
In a game where exactly one team covered its last game and the other did not, back the
team that did NOT cover. "Last game" is each team's most recent PLAYED game, so a team
off a bye carries its pre-bye result forward rather than dropping out. Pushes are excluded
on both the prior game and the graded game.

It fires on roughly HALF the slate (~6 bets/week), which is worth keeping in mind: a rule
that bets half the board is close to a coin flip by construction, and the lifetime number
says exactly that -- 2023-25 went 179-177 (50.3%), -15.7u. 2026 is the outlier season.

DIMENSIONS
----------
primetime (kick >=19:00 ET) | divisional | favourite/underdog | home/road | model agree.

⛔ THE MODEL DIMENSION IS TWO DIFFERENT DIMENSIONS AND THEY CONTRADICT EACH OTHER.
Measured on 2026 weeks 1-8 (48 bets, base 30-18):

    current model (fg_home_cover_prob)   disagreed 20-6  76.9%   agreed 10-12 45.5%
    legacy  model (nfl_predictions_epa)  disagreed 13-10 56.5%   agreed 17-8  68.0%

The current model wants to DISAGREE with the bet; the legacy model wants to AGREE. Both
cannot be a mechanism. The two models make the same call on only 23 of 48 bets, so they are
near-independent of one another. Both are reported and neither is treated as the truth.

⛔ LINE SOURCE: fg_spread_close on nfl_slate_games, which is The Odds API. Never nflverse's
spread_line -- scores come from the schedule, lines never do.

⛔ The legacy probability goes through apply_pregame_cutoff. nfl_predictions_epa is
append-only with several runs per game and the newest row for a finished game can post-date
kickoff; grading off that reads the answer.

HONEST LIMITS, so a future reader does not over-trust the cells below
---------------------------------------------------------------------
  * 48 bets split five binary ways is 32 cells. A 12-2 cell is expected from luck alone.
  * Two differently-defined "best" cells (current-disagreed+plain, and legacy-agreed+
    current-disagreed) were both 12-2 and shared 8 of their 14 games -- one lucky cluster
    found twice, not two effects.
  * Of the 2026 splits, only home/road pointed the same way on 2023-25. Primetime vanished
    (48.7 vs 50.7), favourite/underdog vanished (50.9 vs 50.0), and DIVISIONAL REVERSED
    (2023-25: divisional 52.4%, non-div 49.4% -- the opposite of 2026).
  * Home-only across all four seasons is 113-90 (55.7%, +14.0u), above break-even in 3 of 4.
    That is the only cut with a consistent sign, and it is the modest one.
"""
import argparse
import datetime as dt
import os
import sys

import pandas as pd
import requests

HERE = os.path.dirname(os.path.abspath(__file__))
SUPA = "https://jpxnjuwglavsjbgbasnl.supabase.co/rest/v1"
PRIMETIME_ET = 19
BREAK_EVEN = 0.524


def key():
    k = os.environ.get("SUPABASE_SERVICE_KEY")
    if k:
        return k
    p = os.path.join(HERE, "..", "..", ".env.local")
    if os.path.exists(p):
        for ln in open(p):
            if ln.startswith("SUPABASE_SERVICE_KEY="):
                return ln.split("=", 1)[1].strip()
    sys.exit("[zigzag] no SUPABASE_SERVICE_KEY")


def get(table, params):
    k = key()
    h = {"apikey": k, "Authorization": f"Bearer {k}"}
    out, off = [], 0
    while True:
        r = requests.get(f"{SUPA}/{table}?{params}&limit=1000&offset={off}", headers=h,
                         timeout=60)
        if r.status_code != 200:
            # Never swallow a 400 into "no rows" -- that reads as "no spots this week".
            sys.exit(f"[zigzag] {table} failed ({r.status_code}): {r.text[:200]}")
        rows = r.json()
        out += rows
        if len(rows) < 1000:
            return out
        off += 1000


def et(ts):
    t = dt.datetime.fromisoformat(str(ts).replace("Z", "+00:00"))
    return t - dt.timedelta(hours=4 if 3 <= t.month <= 10 else 5)


def legacy_probs(season):
    """{(week, home_ab): p(home covers)} from the legacy model, pregame rows only."""
    try:
        from legacy_pred import apply_pregame_cutoff, team_abbrev
    except Exception as e:
        print(f"  [legacy] unavailable ({e}) — model dimension will show current only")
        return {}
    rows = get("nfl_predictions_epa",
               f"season=eq.{season}&select=unique_id,week,home_team,away_team,"
               f"home_away_spread_cover_prob,as_of_ts")
    if not rows:
        print(f"  [legacy] no rows for {season} — the legacy cron has not run")
        return {}
    leg = pd.DataFrame(rows)
    leg["season"] = season
    leg = apply_pregame_cutoff(leg, verbose=False)
    ab = team_abbrev()
    leg["h_ab"] = leg.home_team.map(ab)
    leg = leg.dropna(subset=["h_ab", "home_away_spread_cover_prob"])
    return {(int(r.week), r.h_ab): float(r.home_away_spread_cover_prob)
            for r in leg.itertuples()}


def board(season):
    d = pd.DataFrame(get("nfl_slate_games",
                         f"season=eq.{season}&select=week,away_ab,home_ab,final_away,final_home,"
                         f"fg_spread_close,fg_home_cover_prob,kickoff&order=week.asc"))
    for c in ("week", "final_home", "final_away", "fg_spread_close", "fg_home_cover_prob"):
        d[c] = pd.to_numeric(d[c], errors="coerce")
    return d


def divisional(season):
    p = os.path.join(HERE, "data", "games_enriched.parquet")
    if not os.path.exists(p):
        return {}
    g = pd.read_parquet(p)
    g = g[g.season == season]
    return {(int(r.week), r.home_team, r.away_team): bool(r.div_game) for r in g.itertuples()}


def spots(d, div, legp, weeks=None):
    """Every zig-zag bet in `d`, tagged. Graded where a final exists."""
    played = d[d.final_home.notna() & d.fg_spread_close.notna()].copy()
    played["home_ats"] = (played.final_home - played.final_away) + played.fg_spread_close
    last = {}
    for r in played.sort_values("week").itertuples():
        if r.home_ats != 0:
            last[r.home_ab] = (int(r.week), r.home_ats > 0)
            last[r.away_ab] = (int(r.week), r.home_ats < 0)

    # A team's prior result must come from BEFORE the game being judged, so rebuild the
    # running view week by week rather than reusing the end-of-season `last`.
    out = []
    for wk in sorted(d.week.dropna().unique()):
        wk = int(wk)
        if weeks and wk not in weeks:
            continue
        prior = {}
        for r in played[played.week < wk].sort_values("week").itertuples():
            if r.home_ats != 0:
                prior[r.home_ab] = (int(r.week), r.home_ats > 0)
                prior[r.away_ab] = (int(r.week), r.home_ats < 0)
        for r in d[(d.week == wk) & d.fg_spread_close.notna()].itertuples():
            lh, la = prior.get(r.home_ab), prior.get(r.away_ab)
            if not lh or not la or lh[1] == la[1]:
                continue
            back_home = not lh[1]
            team = r.home_ab if back_home else r.away_ab
            sp = r.fg_spread_close if back_home else -r.fg_spread_close
            cur_p = (r.fg_home_cover_prob if back_home else 1 - r.fg_home_cover_prob
                     ) if pd.notna(r.fg_home_cover_prob) else None
            lgh = legp.get((wk, r.home_ab))
            lg_p = None if lgh is None else (lgh if back_home else 1 - lgh)
            ats = ((r.final_home - r.final_away) + r.fg_spread_close
                   if pd.notna(r.final_home) else None)
            won = None
            if ats is not None and ats != 0:
                won = (ats > 0) if back_home else (ats < 0)
            e = et(r.kickoff)
            out.append({
                "week": wk, "game": f"{r.away_ab} @ {r.home_ab}",
                "bet": f"{team} {sp:+g}", "kick": e.strftime("%a %-I:%M%p ET"),
                "won": won,
                "venue": "home" if back_home else "road",
                "role": "pick'em" if sp == 0 else ("favorite" if sp < 0 else "underdog"),
                "prime": e.hour >= PRIMETIME_ET,
                "divg": div.get((wk, r.home_ab, r.away_ab)),
                "cur": None if cur_p is None else ("agreed" if cur_p > .5 else "disagreed"),
                "leg": None if lg_p is None else ("agreed" if lg_p > .5 else "disagreed"),
            })
    return pd.DataFrame(out)


def rec(x):
    x = x[x.won.notna()]
    w, l = int(x.won.sum()), int((~x.won.astype(bool)).sum())
    n = w + l
    if not n:
        return "n=0", 0.0, 0
    return f"{f'{w}-{l}':>7} {w/n:>6.1%} {w-l*1.1:>+7.1f}u  n={n:<3}", w / n, n


def dimension_table(g):
    cells = {}
    for name, mask in (
            ("current: disagreed", g.cur == "disagreed"), ("current: agreed", g.cur == "agreed"),
            ("legacy: agreed", g.leg == "agreed"), ("legacy: disagreed", g.leg == "disagreed"),
            ("underdog", g.role == "underdog"), ("favorite", g.role == "favorite"),
            ("not divisional", g.divg == False), ("divisional", g.divg == True),
            ("not primetime", ~g.prime), ("primetime", g.prime),
            ("home", g.venue == "home"), ("road", g.venue == "road")):
        s, p, n = rec(g[mask])
        if n:
            cells[name] = (s, p, n)
    return cells


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--season", type=int, default=2026)
    ap.add_argument("--week", type=int)
    ap.add_argument("--grade-only", action="store_true")
    a = ap.parse_args()

    d = board(a.season)
    if d.empty:
        sys.exit(f"[zigzag] no slate rows for {a.season}")
    legp = legacy_probs(a.season)
    div = divisional(a.season)
    allsp = spots(d, div, legp)
    graded = allsp[allsp.won.notna()].copy()
    graded["won"] = graded.won.astype(bool)

    s, p, n = rec(graded)
    print(f"\n=== ZIG-ZAG {a.season}, season to date: {s.strip()} "
          f"(break-even {BREAK_EVEN:.1%}) ===")
    cells = dimension_table(graded)
    print(f"\n{'cell':<20} {'record':<34} vs base")
    for k, (txt, pp, nn) in sorted(cells.items(), key=lambda kv: -kv[1][1]):
        print(f"{k:<20} {txt:<34} {100*(pp-p):>+6.1f}pp")
    print("\n⚠ the two model rows point OPPOSITE ways and are near-independent of each")
    print("  other; only home/road survived on 2023-25, and divisional REVERSED. See the")
    print("  module docstring before leaning on any single cell.")

    if a.grade_only:
        return
    wk = a.week
    if wk is None:
        ug = d[d.final_home.isna()].week.dropna()
        if ug.empty:
            print("\n[zigzag] no ungraded week on the board.")
            return
        wk = int(ug.min())
    up = spots(d, div, legp, weeks={wk})
    up = up[up.won.isna()]
    if up.empty:
        print(f"\n[zigzag] week {wk}: no qualifying spots.")
        return
    print(f"\n=== WEEK {wk} BOARD: {len(up)} spot(s) ===")
    print(f"{'bet':<12} {'game':<13} {'kick':<15} {'role':<9} {'venue':<5} "
          f"{'div':<4} {'prime':<6} {'current':<10} {'legacy':<10}")
    print("-" * 96)
    for r in up.itertuples():
        print(f"{r.bet:<12} {r.game:<13} {r.kick:<15} {r.role:<9} {r.venue:<5} "
              f"{('DIV' if r.divg else '-'):<4} {('PRIME' if r.prime else '-'):<6} "
              f"{str(r.cur):<10} {str(r.leg):<10}")
    print("\nworst cell each bet sits in (this season's record):")
    for r in up.itertuples():
        mine = []
        for nm, hit in (("primetime", r.prime), ("not primetime", not r.prime),
                        ("divisional", r.divg is True), ("not divisional", r.divg is False),
                        ("underdog", r.role == "underdog"), ("favorite", r.role == "favorite"),
                        ("home", r.venue == "home"), ("road", r.venue == "road"),
                        (f"current: {r.cur}", r.cur is not None),
                        (f"legacy: {r.leg}", r.leg is not None)):
            if hit and nm in cells:
                mine.append((nm, cells[nm][1]))
        if not mine:
            continue
        worst = min(mine, key=lambda t: t[1])
        best = max(mine, key=lambda t: t[1])
        print(f"   {r.bet:<12} worst {worst[0]:<20}{worst[1]:>6.1%}   "
              f"best {best[0]:<20}{best[1]:>6.1%}")


if __name__ == "__main__":
    main()
