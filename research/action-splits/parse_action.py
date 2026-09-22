#!/usr/bin/env python3
"""Parse an Action Network public-betting paste into a tidy frame.

The owner copies a completed week's board out of Action Network. Each game block is a "Final"
line, both team names (each name appears twice — once with a "Team Icon" suffix — and big games
carry a 3-digit rotation number after it), then a numeric block, then the split percentages:

    Final                     <- or "Final - 3OT"
    Duquesne Team Icon        \ away name, repeated, optional rotation number
    Duquesne                  /
    Air Force Team Icon       \ home name, same shape
    Air Force                 /
    +23.5  -23.5              <- OPENING line, away side then home side
    +31.5  -110               <- CURRENT away line + price
    -31.5  -105               <- CURRENT home line + price
    90%  10%                  <- % of BETS (tickets), away then home
    7%   93%                  <- % of MONEY (handle), away then home
    +83%                      <- bets% - money% on the away side (absent when they match)
    3,705                     <- ticket count

Each paste is ONE sport, ONE week, ONE market, and the numeric block differs by market:

  spread  6 nums  away_open  home_open  away_close  away_price  home_close  home_price
  total   6 nums  over_open  under_open over_close  over_price  under_close under_price
                  (lines are written o49.5 / u50.5; the o/u prefix is stripped, the side is
                   carried by position, and the price rows have no prefix)
  ml      4 nums  away_open  home_open  away_close  home_close
                  (the price IS the line, so there are no separate price rows)

Tolerances learned from the 2026 CFB weeks 1-3 pastes: moneyline blocks routinely carry "N/A"
where a book never posted a side, and a game with no action at all has NO percentage rows. Both
are kept as nulls rather than dropped — a missing split is information about the game.
raw_nums always holds the untouched numeric sequence (N/A included) so a mapping can be revised
later without re-pasting.

Usage:  parse_action.py <sport> <season> <week> <market> <raw.txt>
        -> appends to data/action_splits.csv (dedup on sport+season+week+market+away+home)
"""
import os, re, sys
import pandas as pd

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "data", "action_splits.csv")
# a numeric cell: optional o/u side prefix (totals), optional sign, digits. "N/A" is a real value.
NUM = re.compile(r'^(?:[ou])?[+-]?\d+(?:\.\d+)?$')
NA = re.compile(r'^N/?A$', re.I)
PCT = re.compile(r'^([+-]?\d+)%$')
TICK = re.compile(r'^\d{1,3}(?:,\d{3})+$')

# how many numbers each market's block holds, and what those slots mean
LAYOUT = {
    "spread": ["away_open", "home_open", "away_close", "away_price", "home_close", "home_price"],
    "total":  ["away_open", "home_open", "away_close", "away_price", "home_close", "home_price"],
    "ml":     ["away_open", "home_open", "away_close", "home_close"],
}


def _f(v):
    """'o49.5' -> 49.5, '-110' -> -110.0, 'N/A'/None -> None."""
    if v is None or NA.match(v):
        return None
    return float(v.lstrip("ou"))


def parse(raw, market):
    slots = LAYOUT[market]
    blocks = re.split(r'(?m)^\s*Final(?:\s*-\s*\d?OT)?\s*$', raw)
    games, skipped = [], []
    for b in blocks:
        L = [x.strip() for x in b.strip().split("\n") if x.strip()]
        if not L:
            continue
        names, i = [], 0
        while i < len(L) and len(names) < 2:
            if L[i].endswith("Team Icon"):
                nm = L[i][: -len("Team Icon")].strip()
                names.append(nm)
                i += 1
                if i < len(L) and L[i] == nm:                    # repeated name line
                    i += 1
                if i < len(L) and re.fullmatch(r'\d{3}', L[i]):   # rotation number
                    i += 1
                continue
            i += 1
        if len(names) < 2:
            continue
        rest = L[i:]
        nums = [x for x in rest if NUM.match(x) or NA.match(x)]
        pcts = [PCT.match(x).group(1) for x in rest if PCT.match(x)]
        ticks = [x for x in rest if TICK.match(x)]
        if len(nums) < len(slots):
            # a game Action never priced (e.g. an FCS body-bag with one stale number)
            skipped.append(f"{names[0]} @ {names[1]}: {len(nums)} nums, need {len(slots)}")
            continue
        nums = nums[: len(slots)]
        g = dict(away=names[0], home=names[1], raw_nums="|".join(nums))
        g.update({k: _f(v) for k, v in zip(slots, nums)})
        for k in ("away_price", "home_price"):
            g.setdefault(k, None)
        # percentages: 4 when the game has action (bets away/home, money away/home), else none.
        # The 5th value, when present, is Action's own bets-minus-money diff on the away side.
        g.update(bets_away=int(pcts[0]) if len(pcts) >= 4 else None,
                 bets_home=int(pcts[1]) if len(pcts) >= 4 else None,
                 money_away=int(pcts[2]) if len(pcts) >= 4 else None,
                 money_home=int(pcts[3]) if len(pcts) >= 4 else None,
                 tickets=int(ticks[-1].replace(",", "")) if ticks else None)
        games.append(g)
    d = pd.DataFrame(games)
    if len(d):
        # + = the away side's number got better from open to close.
        # spread/total: points gained. ml: price lengthened (favourites are negative, so a
        # rising number is always movement AWAY from that side being backed).
        d["away_move"] = (d.away_close - d.away_open).round(2)
        d["home_move"] = (d.home_close - d.home_open).round(2)
        # money minus bets on the away side. + = the handle is heavier on away than the ticket
        # count is, i.e. bigger bets on away and a pile of small tickets on home.
        d["money_minus_bets_away"] = d.money_away - d.bets_away
    if skipped:
        print(f"  [no price] {len(skipped)} game(s): " + "; ".join(skipped[:4])
              + (" ..." if len(skipped) > 4 else ""))
    return d


if __name__ == "__main__":
    sport, season, week, market, path = (sys.argv[1].lower(), int(sys.argv[2]), int(sys.argv[3]),
                                         sys.argv[4].lower(), sys.argv[5])
    d = parse(open(path).read(), market)
    d.insert(0, "market", market); d.insert(0, "week", week)
    d.insert(0, "season", season); d.insert(0, "sport", sport)
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    if os.path.exists(OUT):
        old = pd.read_csv(OUT)
        d = pd.concat([old, d], ignore_index=True).drop_duplicates(
            subset=["sport", "season", "week", "market", "away", "home"], keep="last")
    d.to_csv(OUT, index=False)
    cur = d[(d.sport == sport) & (d.season == season) & (d.week == week) & (d.market == market)]
    split = int(cur.bets_away.notna().sum())
    print(f"{sport} {season} wk{week} {market}: {len(cur)} games ({split} with splits) "
          f"| file now {len(d)} rows")
