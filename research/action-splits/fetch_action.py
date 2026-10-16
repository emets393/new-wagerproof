"""
Action Network public-betting splits, fetched instead of pasted.

Replaces the manual loop (copy the page -> raw/*.txt -> parse_action.py). Emits the SAME
`data/action_splits.csv` schema, so join_results.py and analyze_action.py are untouched.

    python3 fetch_action.py nfl 2026 6          one week
    python3 fetch_action.py ncaaf 2026 1-7      a range
    python3 fetch_action.py nfl 2026 current    whatever week the site is showing
    python3 fetch_action.py nfl 2026 6 --out /tmp/x.csv --no-merge    dry run, no merge

Where the numbers come from. The page is server-rendered off ONE endpoint:

    https://api.actionnetwork.com/web/v2/scoreboard/{nfl|ncaaf}
        ?period=game&seasonType=reg&season=YYYY&week=N&bookIds=<the ten below>

⛔ `bookIds` is camelCase and the FULL list is load-bearing. `book_ids=` returns
`games: []`, and a short list (tried `15,30`) returns the games with `markets: {}` — no
odds, no splits, no error. A thin result here is a bad query, not a quiet week.

Per game, `markets[<book_id>].event.{spread,total,moneyline}` holds one row per side:

    book 30   the OPENER. No `bet_info` — an opening line has no splits.
    book 15   the CONSENSUS: the current line AND the ticket/money percentages the
              page prints. Every other book repeats the same percentages (they are a
              game-level figure), so read them once, from 15.
    the rest  individual sportsbooks, each with its own line and price. The page's
              "BEST ODDS" column is the best of these per side, which is what
              best_side() recomputes.

Orientation follows the pasted file exactly, because the downstream joins assume it:
the away slot is the AWAY team for spread/ml and the OVER for totals; `market` is
spelled `ml`, not `moneyline`; `away_price`/`home_price` stay empty on ml rows because
there the price IS the line.

Verified against the 1,469 hand-pasted rows before this script replaced them — see
`verify_fetch.py`, which re-fetches the pasted weeks and diffs them field by field.
"""
import argparse
import csv
import json
import sys
import time
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "data" / "action_splits.csv"

API = "https://api.actionnetwork.com/web/v2/scoreboard/{league}"
UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/131.0 Safari/537.36")

# The ten books the public-betting page itself requests. Keep all of them: see the
# bookIds note above.
BOOK_IDS = [15, 30, 68, 69, 71, 75, 79, 123, 2988, 4727]
CONSENSUS, OPENER = "15", "30"

# the league slug in the URL -> the value the `sport` column has always carried
SPORT = {"nfl": "nfl", "ncaaf": "cfb"}

COLS = ["sport", "season", "week", "market", "away", "home", "raw_nums",
        "away_open", "home_open", "away_close", "away_price", "home_close",
        "home_price", "bets_away", "bets_home", "money_away", "money_home",
        "tickets", "away_move", "home_move", "money_minus_bets_away"]


def get(league, season, week):
    q = {"period": "game", "seasonType": "reg", "season": season,
         "bookIds": ",".join(str(b) for b in BOOK_IDS)}
    if week is not None:
        q["week"] = week
    url = f"{API.format(league=league)}?{urlencode(q)}"
    req = Request(url, headers={"User-Agent": UA,
                                "Referer": "https://www.actionnetwork.com/",
                                "Accept": "application/json"})
    with urlopen(req, timeout=45) as r:
        return json.loads(r.read().decode())


def best_side(outcomes, market, side):
    """The best line a bettor could take on one side, across the real sportsbooks.

    "Best" is side-specific and that is the whole point: an over wants the LOWEST
    total, an under the highest; a spread wants the most points either way; a
    moneyline just wants the biggest number (+260 beats +230, -270 beats -305).
    Ties on the line break on price. Books 15 and 30 are excluded — they are the
    consensus and the opener, not places you can bet.
    """
    cands = [o for o in outcomes
             if o["side"] == side and o.get("_book") not in (CONSENSUS, OPENER)
             and o.get("odds") is not None]
    if not cands:
        return None
    if market == "ml":
        return max(cands, key=lambda o: o["odds"])
    if market == "total" and side == "over":
        return min(cands, key=lambda o: (o["value"], -o["odds"]))
    return max(cands, key=lambda o: (o["value"], o["odds"]))


def sides_for(market):
    return ("away", "home") if market in ("spread", "ml") else ("over", "under")


def collect(game):
    """{market: [outcome, ...]} across every book, each tagged with its book id."""
    out = {"spread": [], "total": [], "ml": []}
    for book_id, blk in (game.get("markets") or {}).items():
        ev = (blk or {}).get("event") or {}
        for api_key, market in (("spread", "spread"), ("total", "total"),
                                ("moneyline", "ml")):
            for o in (ev.get(api_key) or []):
                o = dict(o)
                o["_book"] = book_id
                out[market].append(o)
    return out


def fmt(v, market, side):
    """Render a line the way the pasted page did, for the raw_nums audit string."""
    if v is None:
        return ""
    if market == "total":
        return f"{'o' if side == 'over' else 'u'}{v:g}"
    return f"{v:+g}"


def num(v):
    return "" if v is None else f"{float(v)}"


def rows_for_game(game, sport, season):
    teams = {t["id"]: t for t in game.get("teams") or []}
    away, home = teams.get(game.get("away_team_id")), teams.get(game.get("home_team_id"))
    if not away or not home:
        return []

    by_market = collect(game)
    tickets = game.get("num_bets")
    rows = []

    for market in ("spread", "total", "ml"):
        outcomes = by_market[market]
        if not outcomes:
            continue
        a_side, h_side = sides_for(market)

        def one(book, side):
            for o in outcomes:
                if o.get("_book") == book and o["side"] == side:
                    return o
            return None

        o_a, o_h = one(OPENER, a_side), one(OPENER, h_side)
        b_a, b_h = best_side(outcomes, market, a_side), best_side(outcomes, market, h_side)
        c_a, c_h = one(CONSENSUS, a_side), one(CONSENSUS, h_side)

        # On a moneyline the price IS the line; the pasted file left *_price empty.
        if market == "ml":
            a_open = o_a["odds"] if o_a else None
            h_open = o_h["odds"] if o_h else None
            a_close = b_a["odds"] if b_a else None
            h_close = b_h["odds"] if b_h else None
            a_price = h_price = None
        else:
            a_open = o_a["value"] if o_a else None
            h_open = o_h["value"] if o_h else None
            a_close = b_a["value"] if b_a else None
            h_close = b_h["value"] if b_h else None
            a_price = b_a["odds"] if b_a else None
            h_price = b_h["odds"] if b_h else None

        def pct(o, kind):
            bi = (o or {}).get("bet_info") or {}
            return (bi.get(kind) or {}).get("percent")

        bets_a, bets_h = pct(c_a, "tickets"), pct(c_h, "tickets")
        money_a, money_h = pct(c_a, "money"), pct(c_h, "money")

        raw = [fmt(a_open, market, a_side), fmt(h_open, market, h_side),
               fmt(a_close, market, a_side)]
        if market != "ml":
            raw.append("" if a_price is None else f"{a_price:g}")
        raw.append(fmt(h_close, market, h_side))
        if market != "ml":
            raw.append("" if h_price is None else f"{h_price:g}")

        mv_a = None if (a_close is None or a_open is None) else a_close - a_open
        mv_h = None if (h_close is None or h_open is None) else h_close - h_open
        diff = None if (money_a is None or bets_a is None) else money_a - bets_a

        rows.append({
            "sport": sport, "season": season, "week": game.get("week"),
            "market": market,
            "away": away.get("display_name"), "home": home.get("display_name"),
            "raw_nums": "|".join(raw),
            "away_open": num(a_open), "home_open": num(h_open),
            "away_close": num(a_close), "away_price": num(a_price),
            "home_close": num(h_close), "home_price": num(h_price),
            "bets_away": num(bets_a), "bets_home": num(bets_h),
            "money_away": num(money_a), "money_home": num(money_h),
            "tickets": num(tickets),
            "away_move": num(mv_a), "home_move": num(mv_h),
            "money_minus_bets_away": num(diff),
        })
    return rows


def parse_weeks(spec):
    if spec == "current":
        return [None]
    if "-" in spec:
        a, b = spec.split("-", 1)
        return list(range(int(a), int(b) + 1))
    return [int(w) for w in spec.split(",")]


def merge(existing, fresh, keys):
    """Replace only the (sport, season, week) blocks we just fetched; keep the rest.

    Pasted weeks the fetcher was not asked for survive untouched, so this is safe to
    re-run and safe to run alongside the old paste path during the changeover.
    """
    kept = [r for r in existing
            if (r["sport"], str(r["season"]), str(r["week"])) not in keys]
    return kept + fresh


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("league", choices=sorted(SPORT))
    ap.add_argument("season", type=int)
    ap.add_argument("weeks", help="6 | 1-7 | 1,3,5 | current")
    ap.add_argument("--out", default=str(OUT))
    ap.add_argument("--no-merge", action="store_true",
                    help="write ONLY the fetched rows (for diffing against the pastes)")
    a = ap.parse_args()

    sport = SPORT[a.league]
    fresh, keys = [], set()
    for wk in parse_weeks(a.weeks):
        d = get(a.league, a.season, wk)
        games = d.get("games") or []
        got = [r for g in games for r in rows_for_game(g, sport, a.season)]
        with_splits = sum(1 for r in got if r["bets_away"] != "")
        label = wk if wk is not None else "current"
        print(f"[{sport} {a.season} wk{label}] {len(games)} games -> {len(got)} rows, "
              f"{with_splits} with splits")
        # A week that returns games but no markets means the query was wrong (see the
        # bookIds note), not that nobody bet. Say so rather than writing empty rows.
        if games and not got:
            print(f"  ⚠ {len(games)} games carried NO markets — check bookIds", file=sys.stderr)
        for r in got:
            keys.add((r["sport"], str(r["season"]), str(r["week"])))
        fresh += got
        time.sleep(1)

    out = Path(a.out)
    rows = fresh
    if not a.no_merge and out.exists():
        with out.open() as f:
            rows = merge(list(csv.DictReader(f)), fresh, keys)
    rows.sort(key=lambda r: (r["sport"], int(r["season"]), int(r["week"]),
                             r["market"], r["away"]))
    out.parent.mkdir(parents=True, exist_ok=True)
    with out.open("w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=COLS)
        w.writeheader()
        w.writerows(rows)
    print(f"[out] {len(rows)} rows -> {out}")


if __name__ == "__main__":
    main()
