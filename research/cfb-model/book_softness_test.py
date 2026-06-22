"""
SOFT vs SHARP test. A book deviating from consensus is SHARP if its lean predicts the outcome (the book is
ahead of the market) and SOFT if its lean is wrong (the consensus is right -> the book's number is exploitable).

For each game where book B's CLOSE spread deviates from the cross-book consensus by >= thresh:
  book leans HOME if book_spread_home < cons (book has home as bigger fav than market).
  Grade the BOOK-LEAN side at the CONSENSUS number:
    sharp book -> book-lean side covers consensus > 52.4%
    soft  book -> book-lean side covers consensus < 47.6%  (so FADE the book = bet the better number it offers)
Also report the line-shop value: avg better-number the book gives vs consensus on its deviated side.
"""
import os, glob
import numpy as np
import pandas as pd

HERE = os.path.dirname(os.path.abspath(__file__))
gm = pd.read_parquet(os.path.join(HERE, "data", "model_games.parquet"))
cfbd = sorted(set(gm.homeTeam) | set(gm.awayTeam))
ALIAS = {"Appalachian State Mountaineers": "App State", "Hawaii Rainbow Warriors": "Hawai'i",
         "UMass Minutemen": "Massachusetts", "San Jose State Spartans": "San José State",
         "Southern Miss Golden Eagles": "Southern Miss"}
def to_cfbd(o):
    if o in ALIAS: return ALIAS[o]
    c = [x for x in cfbd if o.startswith(x + " ") or o == x]; c.sort(key=len, reverse=True)
    return c[0] if c else None

parts = []
for f in glob.glob(os.path.join(HERE, "data", "odds_history", "odds_*.parquet")):
    yr = int(os.path.basename(f).split("_")[1].split(".")[0]); d = pd.read_parquet(f); d["season"] = yr; parts.append(d)
od = pd.concat(parts, ignore_index=True)
od["home_c"] = od.home_team.map(to_cfbd); od["away_c"] = od.away_team.map(to_cfbd)
od = od.dropna(subset=["home_c", "away_c", "hrs_to_kick"]); od = od[od.hrs_to_kick >= 0]
idx = od.groupby(["season", "game_id", "book"]).hrs_to_kick.idxmin()
close = od.loc[idx, ["season", "game_id", "home_c", "away_c", "book", "spread_home", "hrs_to_kick"]].copy()
mg = gm[["season", "homeTeam", "awayTeam", "actual_margin"]].rename(columns={"homeTeam": "home_c", "awayTeam": "away_c"})
close = close.merge(mg, on=["season", "home_c", "away_c"], how="inner")
close = close[close.hrs_to_kick < 12].dropna(subset=["spread_home"])
# consensus = median across OTHER books (leave-one-out so a book can't bias its own consensus)
tot = close.groupby(["season", "game_id"]).spread_home.transform("median")
cnt = close.groupby(["season", "game_id"]).spread_home.transform("count")
close["cons"] = tot   # median is robust; LOO≈median for n>=8 books
close = close[cnt >= 6]
close["dev"] = close.spread_home - close.cons          # book - consensus
close["lean_home"] = close.dev < -0.001                # book has home as bigger fav than market
close["lean_away"] = close.dev > 0.001

THRESH = 0.5
def grade(book, sub):
    d = sub[(sub.book == book) & (sub.dev.abs() >= THRESH)]
    if len(d) < 40: return None
    # book-lean side graded at CONSENSUS number
    # lean_home: bet home -cons -> covers if actual_margin + cons > 0
    # lean_away: bet away +cons -> covers if -(actual_margin + cons) > 0
    res = np.where(d.lean_home, d.actual_margin + d.cons, -(d.actual_margin + d.cons))
    nz = res != 0
    win = (res[nz] > 0).mean()
    shop = d.dev.abs().mean()   # avg better number the book offers on its deviated side
    return len(d), 100 * win, shop

print(f"=== SOFT/SHARP: book-lean side graded @ CONSENSUS number, |dev|>={THRESH} ===")
print("   sharp = lean covers >52%, SOFT = lean covers <48% (fade book / take its number)\n")
print(f"{'book':<16}{'ALLn':>6}{'lean_cov%':>10}{'avg_dev':>8}   per-season lean_cov%")
TS = [2021, 2022, 2023, 2024, 2025]
books = close.book.value_counts()
for book in books[books >= 1500].index:
    r = grade(book, close)
    if not r: continue
    n, w, shop = r
    per = []
    for s in TS:
        rs = grade(book, close[close.season == s])
        per.append(f"{rs[1]:.0f}" if rs else "--")
    flag = "  <<SOFT" if w < 48 else ("  SHARP" if w > 52 else "")
    print(f"{book:<16}{n:>6}{w:>10.1f}{shop:>8.2f}   {'/'.join(per)}{flag}")
