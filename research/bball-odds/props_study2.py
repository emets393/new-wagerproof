#!/usr/bin/env python3
"""NBA props battery #2 (PROPS_BBALL_BRIEF2.md): the price-structure exploits.

  A. LINE SHOPPING: the under-side asymmetry from Brief #1 re-graded at the
     BEST available book (highest line + best under price) instead of consensus.
  B. STALE BOOK: a book's line ≥1.5 off the cross-book median -> bet toward
     the median AT that book (props version of the H1TT test).
  C. STAR RETURNS: top-minutes player back after absence -> role teammates'
     points UNDER (their lines inflated by absence-window production).

Book-level prices; per-season. BE 52.4% at -110 (shopped prices vary).
"""
import glob
import os

import numpy as np
import pandas as pd

from movement_study import am_to_dec
from name_maps import norm

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "data", "parquet")


def book_level():
    frames = []
    for p in sorted(glob.glob(f"{OUT}/props_nba_*.parquet")):
        season = os.path.basename(p).replace("props_nba_", "").replace(".parquet", "")
        df = pd.read_parquet(p)
        df["season"] = season
        frames.append(df)
    b = pd.concat(frames, ignore_index=True)
    b["over_dec"] = am_to_dec(b["over_price"])
    b["under_dec"] = am_to_dec(b["under_price"])
    b["pkey"] = b["player"].map(norm)
    return b


def bet_rows(df, win, push, dec, label, lines, min_n=40):
    ok = ~push & win.notna() & dec.notna()
    n = int(ok.sum())
    if n < min_n:
        return
    w = win.fillna(False) & ok
    profit = np.where(~ok, 0.0, np.where(w, dec - 1, -1.0))
    per = []
    for s, g in df.assign(w=w, ok=ok, pr=profit).groupby("season"):
        m = int(g["ok"].sum())
        if m:
            per.append(f"{s}: {g['w'].sum()}/{m} {g['w'].sum()/m*100:.0f}% {g[g['ok']]['pr'].mean()*100:+.0f}%")
    lines.append(f"| {label} | {n:,} | {w.sum()/n*100:.1f}% | "
                 f"{profit[ok].mean()*100:+.1f}% | {' · '.join(per)} |")


def main():
    g = pd.read_parquet(f"{OUT}/props_graded.parquet")
    g["pkey"] = g["player"].map(norm)
    b = book_level()

    # prior form for the form-lag signals
    pb = pd.read_parquet(f"{OUT}/bdl_player_box.parquet")
    st = pd.DataFrame({
        "pkey": (pb["player.first_name"] + " " + pb["player.last_name"]).map(norm),
        "date_et": pd.to_datetime(pb["game.date"]),
        "game_key": pb["game.id"], "team_id": pb["team.id"],
        "season_yr": pb["game.season"],
        "mins": pd.to_numeric(pb["min"], errors="coerce"),
        "pts": pb["pts"], "reb": pb["reb"], "ast": pb["ast"], "fg3m": pb["fg3m"],
    }).drop_duplicates(["pkey", "date_et"]).sort_values(["pkey", "date_et"])
    gp = st.groupby(["pkey", "season_yr"])
    for c in ("pts", "reb", "ast", "fg3m", "mins"):
        st[f"l5_{c}"] = gp[c].transform(lambda s: s.shift(1).rolling(5, min_periods=3).mean())
        st[f"s2d_{c}"] = gp[c].transform(lambda s: s.shift(1).expanding(min_periods=3).mean())
    # g already carries team_id from the spine build — don't re-merge it
    g = g.merge(st[["pkey", "date_et", "game_key"]
                   + [c for c in st.columns if c.startswith(("l5_", "s2d_"))]],
                on=["pkey", "date_et"], how="left")

    lines = ["# NBA Props Brief #2 — price-structure exploits",
             "",
             "Book-level lines/prices (6-10 books per prop)."]

    # ---- A: line shopping the under-asymmetry ----
    # Best book for an UNDER = highest line; tie-break best under price.
    best = b.sort_values(["line_point", "under_dec"], ascending=[False, False]) \
        .drop_duplicates(["event_id", "market", "player"])[
        ["event_id", "market", "player", "line_point", "under_dec", "book"]].rename(
        columns={"line_point": "best_line", "under_dec": "best_under"})
    ga = g.merge(best, on=["event_id", "market", "player"], how="left")
    lines.append("\n## A — under-asymmetry, consensus vs BEST-SHOPPED line+price\n")
    lines.append("| signal | n | win% | ROI | per season |")
    lines.append("|---|---|---|---|---|")
    for mkt, stat, thr in (("player_threes", "fg3m", 1.0), ("player_rebounds", "reb", 1.0),
                           ("player_assists", "ast", 1.0), ("player_points", "pts", 1.7)):
        m = (ga["market"] == mkt) & ((ga[f"l5_{stat}"] - ga["line"]) <= -thr)
        sub = ga[m]
        bet_rows(sub, ~sub["over"] & ~sub["push"], sub["push"], sub["under_dec"],
                 f"{stat} L5 below line → UNDER @consensus", lines)
        w = sub["actual"] < sub["best_line"]
        p = sub["actual"] == sub["best_line"]
        bet_rows(sub, w, p, sub["best_under"], f"{stat} L5 below line → UNDER @BEST book", lines)

    # ---- B: stale-book chase ----
    med = b.groupby(["event_id", "market", "player"])["line_point"].median().rename("med")
    bb = b.merge(med, on=["event_id", "market", "player"])
    bb["dev"] = bb["line_point"] - bb["med"]
    act = g[["event_id", "market", "player", "actual", "season"]].drop_duplicates(
        ["event_id", "market", "player"])
    bb = bb.drop(columns=["season"]).merge(act, on=["event_id", "market", "player"], how="inner")
    lines.append("\n## B — stale book: line ≥1.5 off cross-book median, bet toward median at that book\n")
    lines.append("| signal | n | win% | ROI | per season |")
    lines.append("|---|---|---|---|---|")
    big_mkts = bb["market"].isin(["player_points", "player_points_rebounds_assists",
                                  "player_points_rebounds", "player_points_assists"])
    hi = bb[big_mkts & (bb["dev"] >= 1.5)]
    bet_rows(hi, hi["actual"] < hi["line_point"], hi["actual"] == hi["line_point"],
             hi["under_dec"], "book ≥1.5 ABOVE median → UNDER at book", lines)
    lo = bb[big_mkts & (bb["dev"] <= -1.5)]
    bet_rows(lo, lo["actual"] > lo["line_point"], lo["actual"] == lo["line_point"],
             lo["over_dec"], "book ≥1.5 BELOW median → OVER at book", lines)

    # ---- C: star returns -> role unders ----
    fl = pd.read_parquet(f"{OUT}/player_flags_nba.parquet").sort_values(["team_key", "gidx"])
    fl["star_returned"] = (fl.groupby("team_key")["top1_out"].shift(1).fillna(0) > 0) \
        & (fl["top1_out"] == 0)
    ret = fl[["game_key", "team_id", "star_returned", "top1_out"]]
    gc = g.merge(ret, on=["game_key", "team_id"], how="left")
    role = (gc["s2d_mins"] >= 18) & (gc["s2d_mins"] < 30)
    pts_m = gc["market"] == "player_points"
    inflated = gc["line"] >= gc["s2d_pts"] + 1.5
    lines.append("\n## C — star returns → role-player unders\n")
    lines.append("| signal | n | win% | ROI | per season |")
    lines.append("|---|---|---|---|---|")
    for label, mask in (
            ("STAR RETURNED → role points UNDER", (gc["star_returned"].fillna(False)) & pts_m & role),
            ("STAR RETURNED × line ≥1.5 above s2d → UNDER",
             (gc["star_returned"].fillna(False)) & pts_m & role & inflated),
            ("STAR RETURNED → ALL teammates points UNDER", (gc["star_returned"].fillna(False)) & pts_m),
            ("(control) star still out × inflated line → UNDER",
             (gc["top1_out"].fillna(0) > 0) & pts_m & role & inflated)):
        sub = gc[mask]
        bet_rows(sub, ~sub["over"] & ~sub["push"], sub["push"], sub["under_dec"], label, lines)

    path = os.path.join(ROOT, "PROPS_BBALL_BRIEF2.md")
    with open(path, "w") as f:
        f.write("\n".join(lines) + "\n")
    print(f"wrote {path}", flush=True)


if __name__ == "__main__":
    main()
