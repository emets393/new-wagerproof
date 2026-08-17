"""NFL movement microstructure on the 5-season odds_hist archive — PRE-REGISTERED.

New data: 2021-2022 slate-wide multi-book snapshots (backfilled 2026-08-17) extending the
2023-2025 archive. No model in this battery — pure market-structure questions, graded per
the backtest-grading framework (bet at the T-24 line -> grade vs the T-24 line).

Tests:
  1. NAIVE CONTINUATION — consensus spread/total moved >= 0.5 open->T24: bet the move's
     direction at T24. Football verdict elsewhere: priced. Establishes the NFL number.
  2. SHARP-BOOK LEAD — at T24, a sharp reference (median of betonlineag+lowvig, the
     no-vig-tight books) differs from the slow-consensus (median of the rest) by >= 0.5:
     (a) does the close move toward the sharp side (CLV test)?
     (b) does betting the sharp side at the slow consensus line win at T24-grade?
  3. LATE VS EARLY MOVE mix — of the full open->close move >= 1, what share arrives
     after T24 (context stat for the CFB timing finding; no bet).
Consensus = median across books per snapshot. open = earliest snap >= 5 days out is NOT
required (archive starts Tue-ish); open = first snapshot, t24 = snapshot nearest 24h
pre-kick, close = last pre-kick snapshot. Results from games_enriched (scores only).
"""
import numpy as np
import pandas as pd
from pathlib import Path

D = Path(__file__).resolve().parent / "data"
SHARP = {"betonlineag", "lowvig"}

CITY2AB = {"Arizona": "ARI", "Atlanta": "ATL", "Baltimore": "BAL", "Buffalo": "BUF",
           "Carolina": "CAR", "Chicago": "CHI", "Cincinnati": "CIN", "Cleveland": "CLE",
           "Dallas": "DAL", "Denver": "DEN", "Detroit": "DET", "Green Bay": "GB",
           "Houston": "HOU", "Indianapolis": "IND", "Jacksonville": "JAX", "Kansas City": "KC",
           "LA Rams": "LA", "LA Chargers": "LAC", "Las Vegas": "LV", "Miami": "MIA",
           "Minnesota": "MIN", "New England": "NE", "New Orleans": "NO", "NY Giants": "NYG",
           "NY Jets": "NYJ", "Philadelphia": "PHI", "Pittsburgh": "PIT", "Seattle": "SEA",
           "San Francisco": "SF", "Tampa Bay": "TB", "Tennessee": "TEN", "Washington": "WAS"}


def load():
    oh = pd.read_parquet(D / "odds_hist.parquet")
    oh = oh[oh.season.between(2021, 2025)].copy()
    oh["snap"] = pd.to_datetime(oh.snap_ts, utc=True, errors="coerce")
    oh["comm"] = pd.to_datetime(oh.commence_time, utc=True, errors="coerce")
    oh = oh[oh.snap < oh.comm]
    oh["gk"] = oh.season.astype(str) + "|" + oh.home_team + "|" + oh.away_team + "|" + oh.comm.dt.strftime("%Y%m%d")
    return oh


def per_snapshot(oh, sharp):
    sub = oh[oh.book.isin(SHARP)] if sharp else oh[~oh.book.isin(SHARP)]
    g = sub.groupby(["gk", "season", "snap", "comm"]).agg(
        spread=("spread_home", "median"), total=("total_point", "median")).reset_index()
    return g


def anchor(g, prefix):
    g = g.sort_values("snap")
    first = g.groupby("gk").first().rename(columns=lambda c: f"{prefix}open_{c}")
    last = g.groupby("gk").last().rename(columns=lambda c: f"{prefix}close_{c}")
    g["dt24"] = (g.comm - g.snap - pd.Timedelta(hours=24)).abs()
    t24 = g.loc[g.groupby("gk").dt24.idxmin()].set_index("gk").rename(columns=lambda c: f"{prefix}t24_{c}")
    out = first.join(last).join(t24)
    return out[[c for c in out.columns if c.endswith(("_spread", "_total")) or c.endswith("_season")]]


def main():
    oh = load()
    cons = anchor(per_snapshot(oh, sharp=False), "")
    shp = anchor(per_snapshot(oh, sharp=True), "s_")
    w = cons.join(shp, how="left").reset_index()
    w["season"] = w.gk.str.split("|").str[0].astype(int)
    ge = pd.read_parquet(D / "games_enriched.parquet")
    ge = ge[ge.season.between(2021, 2025)].copy()
    ab2city = {v: k for k, v in CITY2AB.items()}
    ge["gk"] = ge.season.astype(str) + "|" + ge.home_team.map(ab2city) + "|" + ge.away_team.map(ab2city) \
        + "|" + pd.to_datetime(ge.gameday).dt.strftime("%Y%m%d")
    # kickoff date in UTC can differ from gameday for late games — match on (season, teams) with date +/- 1
    res = ge[["gk", "home_score", "away_score"]].dropna()
    base = w.merge(res, on="gk", how="inner")
    alt = w.copy()
    alt["gk_shift"] = alt.gk  # fallback join: try day+1 for games whose UTC kick crosses midnight
    missing = w[~w.gk.isin(res.gk)].copy()
    parts = missing.gk.str.split("|", expand=True)
    parts[3] = (pd.to_datetime(parts[3]) - pd.Timedelta(days=1)).dt.strftime("%Y%m%d")
    missing["gk2"] = parts[0] + "|" + parts[1] + "|" + parts[2] + "|" + parts[3]
    m2 = missing.merge(res.rename(columns={"gk": "gk2"}), on="gk2", how="inner").drop(columns="gk2")
    w = pd.concat([base, m2], ignore_index=True)
    w["margin"] = w.home_score - w.away_score
    w["tot_act"] = w.home_score + w.away_score
    print(f"frame: {len(w)} games with results, seasons "
          f"{w.season.value_counts().sort_index().to_dict()}")

    def cell(name, s, win):
        if len(s) < 25:
            print(f"  {name:48s} n={len(s)} (<25 skip)")
            return
        hit = win.mean() * 100
        roi = np.mean(np.where(win, 100 / 110, -1.0)) * 100
        per = " ".join(f"{y}:{win[(s.season == y).values].mean()*100:.0f}%({(s.season == y).sum()})"
                       for y in range(2021, 2026) if (s.season == y).sum() > 0)
        print(f"  {name:48s} n={len(s):4d} hit={hit:5.1f}% ROI={roi:+6.1f}% [{per}]")

    print("\n=== 1. NAIVE CONTINUATION (open->T24 move >= 0.5, bet @ T24, grade vs T24) ===")
    mv_t = w.t24_total - w.open_total
    s = w[(mv_t.abs() >= 0.5) & w.tot_act.notna() & w.t24_total.notna()]
    s = s[s.tot_act != s.t24_total]
    up = (mv_t[s.index] > 0)
    cell("TOTAL follow-the-move", s, np.where(up, s.tot_act > s.t24_total, s.tot_act < s.t24_total))
    mv_s = w.t24_spread - w.open_spread     # spread_home: negative = home favored
    s2 = w[(mv_s.abs() >= 0.5) & w.margin.notna() & w.t24_spread.notna()]
    s2 = s2[s2.margin != -s2.t24_spread]
    toward_home = mv_s[s2.index] < 0        # line moving down = toward home
    cell("SPREAD follow-the-move", s2,
         np.where(toward_home, s2.margin > -s2.t24_spread, s2.margin < -s2.t24_spread))

    print("\n=== 2. SHARP-BOOK LEAD at T24 (sharp ref vs slow consensus, gap >= 0.5) ===")
    for mkt, sc, cc, act, is_spread in [("SPREAD", "s_t24_spread", "t24_spread", "margin", True),
                                        ("TOTAL", "s_t24_total", "t24_total", "tot_act", False)]:
        gap = w[sc] - w[cc]
        m = gap.abs() >= 0.5
        s3 = w[m & w[act].notna() & w[cc].notna() & (w.close_spread.notna() if is_spread else w.close_total.notna())]
        gap3 = gap[s3.index]
        # (a) CLV: did the close move from the slow consensus toward the sharp number?
        close_col = "close_spread" if is_spread else "close_total"
        moved = (s3[close_col] - s3[cc]) * np.sign(gap3)
        print(f"  {mkt}: n={len(s3)}  close moved toward sharp {(moved > 0).mean()*100:.0f}% "
              f"| away {(moved < 0).mean()*100:.0f}% | flat {(moved == 0).mean()*100:.0f}%")
        # (b) result grade: bet the sharp side at the slow consensus number
        if is_spread:
            s4 = s3[s3.margin != -s3[cc]]
            sharp_home = gap3[s4.index] < 0
            win = np.where(sharp_home, s4.margin > -s4[cc], s4.margin < -s4[cc])
        else:
            s4 = s3[s3.tot_act != s3[cc]]
            sharp_over = gap3[s4.index] > 0
            win = np.where(sharp_over, s4.tot_act > s4[cc], s4.tot_act < s4[cc])
        cell(f"{mkt} bet sharp side @ slow line", s4, win)

    print("\n=== 3. WHEN does the move arrive (|open->close| >= 1) ===")
    full = (w.close_total - w.open_total).abs()
    late = (w.close_total - w.t24_total).abs()
    m = full >= 1
    print(f"  totals: n={m.sum()}, share of move arriving AFTER T24: "
          f"{(late[m] / full[m]).clip(0, 1).mean()*100:.0f}% (mean)")


if __name__ == "__main__":
    main()
