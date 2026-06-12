"""Battery 3: book-level dynamics for 1H spreads/totals.

1. Which book LEADS 1H line moves (first to a new consensus level)?
2. Stale-book chase: leader moved >=1, laggard still at old line ->
   bet laggard's line+price in move direction (graded at that line/price).
3. Line-shop uplift: best price across books at close vs consensus,
   for the steam-follow keeper population.

Per-season always; trigger bets graded at trigger-snapshot book line+price.
"""
import numpy as np
import pandas as pd
from pathlib import Path

from h1tt_p2_movement import CITY_NAMES, payout, roi

ROOT = Path(__file__).resolve().parent
pd.set_option("display.width", 220)
GK = ["season", "gameday", "home_ab", "away_ab"]


def rep(df, lab, win="win", push="push", pay="pay"):
    print(f"\n== {lab} ==")
    if not len(df):
        print("  (no bets)")
        return
    for s in sorted(df.season.unique()):
        g = df[df.season == s]
        r = roi(g[win].astype(bool), g[push].astype(bool), g[pay])
        wr = g[win][~g[push].astype(bool)].mean()
        print(f"  {s} (n={len(g)}): win {wr:.1%} | roi {np.nanmean(r)*100:+.1f}%")
    r = roi(df[win].astype(bool), df[push].astype(bool), df[pay])
    print(f"  ALL (n={len(df)}): win {df[win][~df[push].astype(bool)].mean():.1%} | "
          f"roi {np.nanmean(r)*100:+.1f}%")


def load():
    d = pd.read_parquet(ROOT / "data" / "odds_hist.parquet")
    d["snap_dt"] = pd.to_datetime(d.snap_ts, utc=True, format="ISO8601")
    comm = pd.to_datetime(d.commence_time, utc=True, format="ISO8601")
    d["gameday"] = comm.dt.tz_convert("America/New_York").dt.strftime("%Y-%m-%d")
    d["home_ab"] = d.home_team.map(CITY_NAMES)
    d["away_ab"] = d.away_team.map(CITY_NAMES)
    d = d[d.snap_dt < comm]
    frame = pd.read_parquet(ROOT / "data" / "h1tt_frame.parquet")
    frame["h1_margin"] = frame.h1_home - frame.h1_away
    frame["h1_total_actual"] = frame.h1_home + frame.h1_away
    resmap = frame.set_index(GK)[["h1_margin", "h1_total_actual"]]
    return d, resmap


def book_moves(d, col):
    """Per game/book first-move events for `col` (line column)."""
    sub = d[d[col].notna()][GK + ["book", "snap_dt", col]].sort_values("snap_dt")
    ev = []
    for key, g in sub.groupby(GK + ["book"]):
        v = g[col].values
        t = g.snap_dt.values
        chg = np.where(v[1:] != v[:-1])[0]
        for i in chg:
            ev.append((*key, t[i + 1], v[i], v[i + 1]))
    return pd.DataFrame(ev, columns=GK + ["book", "t", "frm", "to"])


def lead_table(ev, label):
    """For each game + new line level, who got there first?"""
    ev = ev.sort_values("t")
    firsts = ev.groupby(GK + ["to"]).first().reset_index()
    n_total = len(firsts)
    counts = firsts.book.value_counts()
    # also: of moves where >=2 books eventually reach the level, who was first
    multi = ev.groupby(GK + ["to"]).filter(lambda g: g.book.nunique() >= 3)
    mf = multi.sort_values("t").groupby(GK + ["to"]).first().reset_index()
    print(f"\n== {label}: first-to-level (n levels={n_total}; "
          f"levels reached by >=3 books n={len(mf)}) ==")
    tab = pd.DataFrame({"all_firsts": counts,
                        "multi3_firsts": mf.book.value_counts()}).fillna(0).astype(int)
    tab["multi3_share"] = (tab.multi3_firsts / len(mf)).round(3)
    print(tab.sort_values("multi3_firsts", ascending=False).head(12).to_string())


def stale_chase(d, resmap, lead_book, line_col, price_h, price_a, move_min, total_mode):
    """leader moved >= move_min; bet other books still at the pre-move line."""
    cols = GK + ["book", "snap_dt", line_col, price_h, price_a]
    sub = d[d[line_col].notna()][cols].sort_values("snap_dt")
    rows = []
    for key, g in sub.groupby(GK):
        if key not in resmap.index:
            continue
        lead = g[g.book == lead_book]
        if len(lead) < 2:
            continue
        v = lead[line_col].values
        moves = np.where(np.abs(v[1:] - v[:-1]) >= move_min)[0]
        if not len(moves):
            continue
        i = moves[0]
        t_move, frm, to = lead.snap_dt.iloc[i + 1], v[i], v[i + 1]
        dirn = np.sign(to - frm)
        # laggards at the SAME snapshot still posting the old line
        lag = g[(g.snap_dt == t_move) & (g.book != lead_book) & (g[line_col] == frm)]
        if not len(lag):
            continue
        b = lag.iloc[0]
        if total_mode:
            act = resmap.loc[key, "h1_total_actual"]
            if dirn > 0:   # leader raised total -> bet OVER at laggard
                win, push, pay = act > b[line_col], act == b[line_col], payout(pd.Series([b[price_h]]))[0]
            else:
                win, push, pay = act < b[line_col], act == b[line_col], payout(pd.Series([b[price_a]]))[0]
        else:
            m = resmap.loc[key, "h1_margin"]
            if dirn < 0:   # spread_home dropped -> steam on HOME -> bet home at laggard
                win, push, pay = m + b[line_col] > 0, m + b[line_col] == 0, payout(pd.Series([b[price_h]]))[0]
            else:
                win, push, pay = m + b[line_col] < 0, m + b[line_col] == 0, payout(pd.Series([b[price_a]]))[0]
        rows.append(dict(season=key[0], win=win, push=push, pay=pay))
    return pd.DataFrame(rows)


def main():
    d, resmap = load()
    bk_counts = d[d.h1_spread_home.notna()].book.value_counts()
    print("books carrying 1H spread (snapshot-rows):")
    print(bk_counts.head(12).to_string())

    ev_sp = book_moves(d, "h1_spread_home")
    lead_table(ev_sp, "1H SPREAD")
    ev_tot = book_moves(d, "h1_total_point")
    lead_table(ev_tot, "1H TOTAL")

    top_books = bk_counts.head(4).index.tolist()
    for lead in top_books:
        df = stale_chase(d, resmap, lead, "h1_spread_home",
                         "h1_spread_home_price", "h1_spread_away_price",
                         1.0, total_mode=False)
        rep(df, f"stale chase 1H SPREAD: leader={lead} moved >=1, bet laggard old line")
    for lead in top_books:
        df = stale_chase(d, resmap, lead, "h1_total_point",
                         "h1_total_over_price", "h1_total_under_price",
                         1.0, total_mode=True)
        rep(df, f"stale chase 1H TOTAL: leader={lead} moved >=1, bet laggard old line")

    # ---- line-shop uplift on the steam-follow keeper (FG spread < 7)
    print("\n" + "=" * 80)
    print("LINE-SHOP: steam-follow keeper, consensus close vs best book at close")
    from h1tt_p2_movement import build_snapshots, per_game
    cons, gk = build_snapshots()
    keep = []
    for key, g in per_game(cons, gk, "fg_sp", "h1_sp", 3):
        if key not in resmap.index:
            continue
        o, c = g.iloc[0], g.iloc[-1]
        if np.abs(c.h1_sp - o.h1_sp) < 1.0 or np.abs(c.fg_sp) >= 7:
            continue
        keep.append((key, c.h1_sp - o.h1_sp < 0, c.snap_dt))  # True = bet home
    rows_c, rows_b = [], []
    for key, bet_home, t_close in keep:
        m = resmap.loc[key, "h1_margin"]
        snap = d[(d.season == key[0]) & (d.gameday == key[1]) & (d.home_ab == key[2])
                 & (d.away_ab == key[3]) & (d.h1_spread_home.notna())]
        snap = snap[snap.snap_dt == snap.snap_dt.max()]
        if not len(snap):
            continue
        line_cons = snap.h1_spread_home.median()
        at_cons = snap[snap.h1_spread_home == line_cons]
        if not len(at_cons):
            continue
        if bet_home:
            pays = payout(at_cons.h1_spread_home_price).astype(float)
            win, push = m + line_cons > 0, m + line_cons == 0
        else:
            pays = payout(at_cons.h1_spread_away_price).astype(float)
            win, push = m + line_cons < 0, m + line_cons == 0
        if np.all(np.isnan(pays)):
            continue
        rows_c.append(dict(season=key[0], win=win, push=push, pay=np.nanmedian(pays)))
        rows_b.append(dict(season=key[0], win=win, push=push, pay=np.nanmax(pays)))
    rep(pd.DataFrame(rows_c), "keeper @ consensus line, median price")
    rep(pd.DataFrame(rows_b), "keeper @ consensus line, BEST price (price-shopped)")


if __name__ == "__main__":
    main()
