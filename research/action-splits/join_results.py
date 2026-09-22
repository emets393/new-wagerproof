#!/usr/bin/env python3
"""Join the Action Network splits to our graded results.

The two feeds name teams differently — Action writes "VA Tech", "Miami (FL)", "S. Florida",
CFBD writes "Virginia Tech", "Miami", "South Florida" — and there is no id in the paste. Rather
than maintain a 300-row alias table, games are matched on the PAIR: inside one week, score every
Action game against every model_games row by (away~away + home~home) string similarity and keep
the best if it clears a threshold. A wrong pair would need BOTH names to beat the right one, so
the pair constraint does most of the work a hand alias table would.

Roughly half of an early-season CFB slate is an FBS team hosting an FCS team. Those are on the
Action board but not in model_games, so they cannot be graded and drop out here — that is the
main reason the joined count is far below the pasted count, not a matching failure.

Output: data/action_joined.parquet, one row per (game, market) with the splits, the line move,
and the realised result, all oriented AWAY-side so every market reads the same direction.
"""
import os, re
import numpy as np, pandas as pd
from difflib import SequenceMatcher

HERE = os.path.dirname(os.path.abspath(__file__))
GAMES = os.path.join(HERE, "..", "cfb-model", "data", "model_games.parquet")
MIN_SIM = 1.45   # out of 2.0 across the two names

ABBR = {
    "st": "state", "s": "south", "n": "north", "e": "east", "w": "west",
    "cent": "central", "so": "southern", "ky": "kentucky", "la": "louisiana",
    "miss": "mississippi", "car": "carolina", "intl": "international",
    "univ": "university", "tech": "tech", "mich": "michigan", "fla": "florida",
    "ill": "illinois", "wash": "washington", "col": "colorado", "am": "am",
}
FIX = {   # names where similarity alone is not enough
    "unc": "north carolina", "usc": "southern california", "smu": "southern methodist",
    "tcu": "texas christian", "lsu": "lsu", "byu": "brigham young", "ucf": "ucf",
    "utep": "utep", "utsa": "utsa", "unlv": "unlv", "fiu": "florida international",
    "fau": "florida atlantic", "uab": "uab", "ole miss": "mississippi",
    "miami fl": "miami", "miami oh": "miami ohio", "pitt": "pittsburgh",
    "ул": "", "jmu": "james madison", "umass": "massachusetts", "uconn": "connecticut",
    "app state": "appalachian state", "hawaii": "hawai i", "san jose state": "san jose state",
}


def norm(s):
    s = str(s).lower().replace("&", " and ")
    s = re.sub(r'[^a-z0-9 ]', ' ', s)
    s = re.sub(r'\s+', ' ', s).strip()
    if s in FIX:
        return FIX[s]
    out = [ABBR.get(w, w) for w in s.split()]
    s = " ".join(out)
    return FIX.get(s, s)


def sim(a, b):
    return SequenceMatcher(None, a, b).ratio()


def main():
    spl = pd.read_csv(os.path.join(HERE, "data", "action_splits.csv"))
    g = pd.read_parquet(GAMES)
    g = g[(g.season == 2026) & g.actual_margin.notna()].copy()
    g["na"], g["nh"] = g.awayTeam.map(norm), g.homeTeam.map(norm)
    spl["na"], spl["nh"] = spl.away.map(norm), spl.home.map(norm)

    pairs = []
    for (season, week), blk in spl.groupby(["season", "week"]):
        cand = g[(g.season == season) & (g.week == week)]
        if cand.empty:
            continue
        # Score every (action game, cfbd game) pair, then assign greedily best-first with each
        # side used once. Without the one-to-one rule "Sac State @ E. Michigan" and
        # "San Jose St @ E. Michigan" both grab the San José State row and Sacramento State's
        # real game is silently dropped.
        cells = []
        for key, row in blk.drop_duplicates(subset=["away", "home"]).set_index(["away", "home"]).iterrows():
            for gi, c in cand.iterrows():
                s = sim(row.na, c.na) + sim(row.nh, c.nh)
                if s >= MIN_SIM:
                    cells.append((s, key, gi))
        used_a, used_g = set(), set()
        for s, key, gi in sorted(cells, key=lambda x: -x[0]):
            if key in used_a or gi in used_g:
                continue
            used_a.add(key); used_g.add(gi)
            b = cand.loc[gi]
            pairs.append(dict(season=season, week=week, away=key[0], home=key[1],
                              game_id=b.game_id, cfbd_away=b.awayTeam, cfbd_home=b.homeTeam,
                              score=round(s, 3)))
    xw = pd.DataFrame(pairs)
    d = spl.merge(xw.drop(columns=["score"]), on=["season", "week", "away", "home"], how="inner")
    d = d.merge(g[["game_id", "spread_close", "total_close", "actual_margin", "actual_total", "homePoints", "awayPoints",
                   "awayTeam", "homeTeam"]], on="game_id", how="left")

    # Everything oriented to the AWAY side of the board so the three markets read alike.
    # model_games stores the HOME spread (negative = home favoured) and actual_margin as
    # home-minus-away, so the HOME side covers when actual_margin + spread_close > 0 and the
    # away side is its exact negation. Writing it via "points the away team receives" is how the
    # sign got flipped the first time and printed a 77% home cover rate.
    d["home_ats_margin"] = d.actual_margin + d.spread_close           # >0 = home covered
    d["away_ats_margin"] = -d.home_ats_margin                         # >0 = away covered
    d["over_margin"] = d.actual_total - d.total_close                 # >0 = over hit
    d["away_won"] = (d.actual_margin < 0).astype(int)

    # result for the away side of THIS market: +1 the away/over side won, -1 it lost, 0 push
    d["away_result"] = np.where(d.market == "spread", np.sign(d.away_ats_margin),
                       np.where(d.market == "total", np.sign(d.over_margin),
                                np.where(d.actual_margin < 0, 1, -1)))

    # ORACLE (repo law): re-derive each result from the raw score and line by an INDEPENDENT
    # route and require an exact match. An assertion written off away_result itself is
    # tautological and catches nothing — that is how the sign bug above survived one pass.
    chk = []
    for _, r in d.iterrows():
        ap, hp = float(r.awayPoints), float(r.homePoints)     # raw scoreboard, not a margin
        if r.market == "spread":
            # the away team is handed -spread_close points; add them to its score
            v = np.sign((ap + (-r.spread_close)) - hp)
        elif r.market == "total":
            v = np.sign((ap + hp) - r.total_close)
        else:
            v = 1 if ap > hp else -1
        chk.append(v)
    assert (np.array(chk) == d.away_result.values).all(), "oracle mismatch"
    # and a sanity floor: home teams cover somewhere near half, never 3/4
    hc = (d[d.market == "spread"].away_result == -1).mean()
    assert 0.35 < hc < 0.65, f"home cover rate {hc:.1%} — orientation is wrong"

    out = os.path.join(HERE, "data", "action_joined.parquet")
    d.to_parquet(out, index=False)
    print(f"crosswalk matched {len(xw)} distinct games | joined {len(d)} game-market rows -> {out}")
    print(d.groupby(["week", "market"]).agg(n=("game_id", "size"),
                                            graded=("away_result", lambda s: int((s != 0).sum()))).to_string())
    print("\nlowest-confidence matches (check these):")
    print(xw.nsmallest(8, "score")[["week", "away", "home", "cfbd_away", "cfbd_home", "score"]].to_string(index=False))


if __name__ == "__main__":
    main()
