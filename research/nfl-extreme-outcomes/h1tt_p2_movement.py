"""Battery 2: movement / staleness signals for 1H markets.

Honest grading: every trigger-time bet is graded at the consensus 1H line AND
price available at the trigger snapshot (not open, not close). Close bets at
close. Per-season always.

Signals:
  A. Stale 1H at trigger: first snapshot where FG spread (total) has moved
     >= 1.0 (1.5) from the common-window open while the 1H line is still at
     its open -> bet 1H in the direction of the FG move at that snapshot.
  B. Window move follow/fade at close: FG moved but 1H lagged (moved less
     than half the expected 0.55x/0.50x pass-through) -> bet 1H at close in
     FG-move direction. Also the mirror (1H overshot).
  C. 1H steam itself: 1H line moved >= 1 in window -> follow / fade at close.
"""
import numpy as np
import pandas as pd
from pathlib import Path

ROOT = Path(__file__).resolve().parent
pd.set_option("display.width", 220)

CITY_NAMES = {
    "Arizona": "ARI", "Atlanta": "ATL", "Baltimore": "BAL", "Buffalo": "BUF",
    "Carolina": "CAR", "Chicago": "CHI", "Cincinnati": "CIN", "Cleveland": "CLE",
    "Dallas": "DAL", "Denver": "DEN", "Detroit": "DET", "Green Bay": "GB",
    "Houston": "HOU", "Indianapolis": "IND", "Jacksonville": "JAX",
    "Kansas City": "KC", "LA Chargers": "LAC", "LA Rams": "LA", "Las Vegas": "LV",
    "Miami": "MIA", "Minnesota": "MIN", "NY Giants": "NYG", "NY Jets": "NYJ",
    "New England": "NE", "New Orleans": "NO", "Philadelphia": "PHI",
    "Pittsburgh": "PIT", "San Francisco": "SF", "Seattle": "SEA",
    "Tampa Bay": "TB", "Tennessee": "TEN", "Washington": "WAS",
}


def payout(o):
    o = pd.to_numeric(o, errors="coerce")
    return np.where(o > 0, o / 100, 100 / -o)


def roi(win, push, pay):
    return np.where(push, 0.0, np.where(win, pay, -1.0))


def report(df, label, win, push, pay):
    print(f"\n== {label} ==")
    if not len(df):
        print("  (no bets)")
        return
    for s, g in df.groupby("season"):
        v = g[win].notna() & g[pay].notna()
        g = g[v]
        r = roi(g[win].astype(bool), g[push].astype(bool), g[pay])
        wr = g[win][~g[push].astype(bool)].mean()
        print(f"  {s} (n={len(g)}): win {wr:.1%} | roi {np.nanmean(r)*100:+.1f}%")
    v = df[win].notna() & df[pay].notna()
    d = df[v]
    r = roi(d[win].astype(bool), d[push].astype(bool), d[pay])
    print(f"  ALL (n={len(d)}): win {d[win][~d[push].astype(bool)].mean():.1%} | "
          f"roi {np.nanmean(r)*100:+.1f}%")


def build_snapshots():
    d = pd.read_parquet(ROOT / "data" / "odds_hist.parquet")
    d["snap_dt"] = pd.to_datetime(d.snap_ts, utc=True, format="ISO8601")
    comm = pd.to_datetime(d.commence_time, utc=True, format="ISO8601")
    d["gameday"] = comm.dt.tz_convert("America/New_York").dt.strftime("%Y-%m-%d")
    d["home_ab"] = d.home_team.map(CITY_NAMES)
    d["away_ab"] = d.away_team.map(CITY_NAMES)
    d = d[d.snap_dt < comm]
    for c in ["h1_spread_home_price", "h1_spread_away_price",
              "h1_total_over_price", "h1_total_under_price"]:
        d[f"pay__{c}"] = payout(d[c])
    gk = ["season", "gameday", "home_ab", "away_ab"]
    cons = (d.groupby(gk + ["snap_dt"])
            .agg(fg_sp=("spread_home", "median"),
                 fg_tot=("total_point", "median"),
                 h1_sp=("h1_spread_home", "median"),
                 h1_tot=("h1_total_point", "median"),
                 pay_h1h=("pay__h1_spread_home_price", "median"),
                 pay_h1a=("pay__h1_spread_away_price", "median"),
                 pay_h1o=("pay__h1_total_over_price", "median"),
                 pay_h1u=("pay__h1_total_under_price", "median"),
                 n_h1sp=("h1_spread_home", "count"),
                 n_h1tot=("h1_total_point", "count"))
            .reset_index().sort_values(gk + ["snap_dt"]))
    return cons, gk


def per_game(cons, gk, fg_col, h1_col, min_books):
    """Common-window per-game records: open/close of both + full sequence."""
    recs = []
    nb = "n_h1sp" if h1_col == "h1_sp" else "n_h1tot"
    for key, g in cons.groupby(gk):
        g = g[g[fg_col].notna() & g[h1_col].notna() & (g[nb] >= min_books)]
        if len(g) < 3:
            continue
        recs.append((key, g))
    return recs


def main():
    cons, gk = build_snapshots()
    res = pd.read_parquet(ROOT / "data" / "quarter_scores.parquet")
    res["gameday"] = None  # join via frame instead
    frame = pd.read_parquet(ROOT / "data" / "h1tt_frame.parquet")
    frame["h1_margin"] = frame.h1_home - frame.h1_away
    frame["h1_total_actual"] = frame.h1_home + frame.h1_away
    resmap = frame.set_index(gk)[["h1_margin", "h1_total_actual"]]

    # ---------------- SPREAD ----------------
    games = per_game(cons, gk, "fg_sp", "h1_sp", 3)
    print(f"spread games with common window (>=3 snaps, >=3 books on 1H): {len(games)}")
    trig_rows, close_rows = [], []
    for key, g in games:
        if key not in resmap.index:
            continue
        h1_margin = resmap.loc[key, "h1_margin"]
        o = g.iloc[0]
        c = g.iloc[-1]
        fg_move = c.fg_sp - o.fg_sp          # negative = toward home
        h1_move = c.h1_sp - o.h1_sp
        # A) trigger-time stale
        hit = g[(np.abs(g.fg_sp - o.fg_sp) >= 1.0) & (g.h1_sp == o.h1_sp)]
        if len(hit):
            t = hit.iloc[0]
            dirn = -np.sign(t.fg_sp - o.fg_sp)   # +1 = FG moved toward home
            line, ph, pa = t.h1_sp, t.pay_h1h, t.pay_h1a
            if dirn > 0:
                win = h1_margin + line > 0
                push = h1_margin + line == 0
                pay = ph
            else:
                win = h1_margin + line < 0
                push = h1_margin + line == 0
                pay = pa
            trig_rows.append(dict(season=key[0], win=win, push=push, pay=pay,
                                  fgmv=t.fg_sp - o.fg_sp))
        # B/C) close-time records
        win_h = h1_margin + c.h1_sp > 0
        push_c = h1_margin + c.h1_sp == 0
        close_rows.append(dict(season=key[0], fg_move=fg_move, h1_move=h1_move,
                               win_home=win_h, push=push_c,
                               pay_h=c.pay_h1h, pay_a=c.pay_h1a))
    tr = pd.DataFrame(trig_rows)
    print(f"\n--- A. STALE 1H SPREAD at trigger (FG moved >=1, 1H unmoved; bet FG direction at trigger line/price) ---")
    report(tr, "follow FG move on stale 1H spread", "win", "push", "pay")
    # fade version
    if len(tr):
        tr2 = tr.copy()
        # fading: flip win except push; pay would be other side's price — approximate with same-snapshot other side
        # (we stored only the bet side's pay; recompute not needed: report follow only + note)
    cl = pd.DataFrame(close_rows)
    cl["exp_h1"] = 0.55 * cl.fg_move
    cl["lag"] = cl.h1_move - cl.exp_h1     # >0 = 1H moved less toward home than expected... careful with sign
    big = cl[np.abs(cl.fg_move) >= 1.5].copy()
    big["dir_home"] = big.fg_move < 0
    # 1H lagged if it moved less than half of FG move in same direction
    big["h1_lagged"] = np.abs(big.h1_move) < 0.5 * np.abs(big.fg_move)
    print(f"\n--- B. CLOSE: FG spread moved >=1.5 (n={len(big)}), split by whether 1H lagged ---")
    for lagged in (True, False):
        sub = big[big.h1_lagged == lagged].copy()
        sub["win"] = np.where(sub.dir_home, sub.win_home, ~sub.win_home & ~sub.push)
        sub["pay"] = np.where(sub.dir_home, sub.pay_h, sub.pay_a)
        report(sub, f"bet 1H at close in FG-move direction | 1H lagged={lagged}",
               "win", "push", "pay")
    # C) 1H steam follow/fade
    st = cl[np.abs(cl.h1_move) >= 1.0].copy()
    st["dir_home"] = st.h1_move < 0
    st["win_f"] = np.where(st.dir_home, st.win_home, ~st.win_home & ~st.push)
    st["pay_f"] = np.where(st.dir_home, st.pay_h, st.pay_a)
    st["win_x"] = np.where(~st.dir_home, st.win_home, ~st.win_home & ~st.push)
    st["pay_x"] = np.where(~st.dir_home, st.pay_h, st.pay_a)
    print(f"\n--- C. 1H SPREAD STEAM >=1.0 in window (n={len(st)}) ---")
    report(st, "FOLLOW 1H steam at close", "win_f", "push", "pay_f")
    report(st, "FADE 1H steam at close", "win_x", "push", "pay_x")

    # ---------------- TOTAL ----------------
    games = per_game(cons, gk, "fg_tot", "h1_tot", 3)
    print(f"\ntotal games with common window: {len(games)}")
    trig_rows, close_rows = [], []
    for key, g in games:
        if key not in resmap.index:
            continue
        h1_act = resmap.loc[key, "h1_total_actual"]
        o, c = g.iloc[0], g.iloc[-1]
        fg_move = c.fg_tot - o.fg_tot
        h1_move = c.h1_tot - o.h1_tot
        hit = g[(np.abs(g.fg_tot - o.fg_tot) >= 1.5) & (g.h1_tot == o.h1_tot)]
        if len(hit):
            t = hit.iloc[0]
            up = (t.fg_tot - o.fg_tot) > 0
            if up:
                win, push, pay = h1_act > t.h1_tot, h1_act == t.h1_tot, t.pay_h1o
            else:
                win, push, pay = h1_act < t.h1_tot, h1_act == t.h1_tot, t.pay_h1u
            trig_rows.append(dict(season=key[0], win=win, push=push, pay=pay))
        win_o = h1_act > c.h1_tot
        push_c = h1_act == c.h1_tot
        close_rows.append(dict(season=key[0], fg_move=fg_move, h1_move=h1_move,
                               win_over=win_o, push=push_c,
                               pay_o=c.pay_h1o, pay_u=c.pay_h1u))
    tr = pd.DataFrame(trig_rows)
    print(f"\n--- A. STALE 1H TOTAL at trigger (FG total moved >=1.5, 1H unmoved) ---")
    report(tr, "follow FG total move on stale 1H total", "win", "push", "pay")
    cl = pd.DataFrame(close_rows)
    big = cl[np.abs(cl.fg_move) >= 2.0].copy()
    big["dir_up"] = big.fg_move > 0
    big["h1_lagged"] = np.abs(big.h1_move) < 0.5 * np.abs(big.fg_move)
    print(f"\n--- B. CLOSE: FG total moved >=2.0 (n={len(big)}), split by 1H lag ---")
    for lagged in (True, False):
        sub = big[big.h1_lagged == lagged].copy()
        sub["win"] = np.where(sub.dir_up, sub.win_over, ~sub.win_over & ~sub.push)
        sub["pay"] = np.where(sub.dir_up, sub.pay_o, sub.pay_u)
        report(sub, f"bet 1H total at close in FG-move direction | 1H lagged={lagged}",
               "win", "push", "pay")
    st = cl[np.abs(cl.h1_move) >= 1.0].copy()
    st["dir_up"] = st.h1_move > 0
    st["win_f"] = np.where(st.dir_up, st.win_over, ~st.win_over & ~st.push)
    st["pay_f"] = np.where(st.dir_up, st.pay_o, st.pay_u)
    st["win_x"] = np.where(~st.dir_up, st.win_over, ~st.win_over & ~st.push)
    st["pay_x"] = np.where(~st.dir_up, st.pay_o, st.pay_u)
    print(f"\n--- C. 1H TOTAL STEAM >=1.0 in window (n={len(st)}) ---")
    report(st, "FOLLOW 1H total steam at close", "win_f", "push", "pay_f")
    report(st, "FADE 1H total steam at close", "win_x", "push", "pay_x")


if __name__ == "__main__":
    main()
