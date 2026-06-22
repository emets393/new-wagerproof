"""Per-game analysis frame for 1st-half + team-total research.

One row per game (2023-2025) with, for each market (FG spread/total/ML,
1H spread/total/ML, home/away team totals):
  - open  = first pre-kickoff snapshot where the market exists (achievable)
  - close = last pre-kickoff snapshot
  - consensus line = median across books at that snapshot
  - consensus price = median PAYOUT across books (medians of american odds
    straddling +/-100 explode — props lesson)
plus quarter/half scores and nflverse metadata.

Output: data/h1tt_frame.parquet
"""
import numpy as np
import pandas as pd
from pathlib import Path

ROOT = Path(__file__).resolve().parent

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


# (market, line col(s), price col(s)) — consensus per snapshot
MARKETS = {
    "spread":    (["spread_home"], ["spread_home_price", "spread_away_price"]),
    "total":     (["total_point"], ["total_over_price", "total_under_price"]),
    "ml":        ([], ["ml_home", "ml_away"]),
    "h1_spread": (["h1_spread_home"], ["h1_spread_home_price", "h1_spread_away_price"]),
    "h1_total":  (["h1_total_point"], ["h1_total_over_price", "h1_total_under_price"]),
    "h1_ml":     ([], ["h1_ml_home", "h1_ml_away"]),
    "tt_home":   (["tt_home_point"], ["tt_home_over_price", "tt_home_under_price"]),
    "tt_away":   (["tt_away_point"], ["tt_away_over_price", "tt_away_under_price"]),
}


def main():
    d = pd.read_parquet(ROOT / "data" / "odds_hist.parquet")
    d["snap_dt"] = pd.to_datetime(d.snap_ts, utc=True, format="ISO8601")
    comm = pd.to_datetime(d.commence_time, utc=True, format="ISO8601")
    d["gameday"] = comm.dt.tz_convert("America/New_York").dt.strftime("%Y-%m-%d")
    d["home_ab"] = d.home_team.map(CITY_NAMES)
    d["away_ab"] = d.away_team.map(CITY_NAMES)
    d = d[d.snap_dt < comm]  # pre-kickoff snapshots only (vs earliest commence variant)

    # ML payouts (lines are the prices themselves for ML)
    for c in ["spread_home_price", "spread_away_price", "total_over_price",
              "total_under_price", "ml_home", "ml_away",
              "h1_spread_home_price", "h1_spread_away_price",
              "h1_total_over_price", "h1_total_under_price", "h1_ml_home", "h1_ml_away",
              "tt_home_over_price", "tt_home_under_price",
              "tt_away_over_price", "tt_away_under_price"]:
        d[f"pay__{c}"] = payout(d[c])

    gk = ["season", "gameday", "home_ab", "away_ab"]
    frames = []
    for mkt, (lines, prices) in MARKETS.items():
        cols = lines + prices
        sub = d.dropna(subset=cols, how="all")
        # a snapshot counts for this market only if the line (or any price) exists
        anchor = lines[0] if lines else prices[0]
        sub = sub[sub[anchor].notna()]
        if not len(sub):
            continue
        # consensus per game-snapshot
        agg = {c: (c, "median") for c in lines}
        agg.update({f"pay__{c}": (f"pay__{c}", "median") for c in prices})
        agg["n_books"] = (anchor, "count")
        cons = (sub.groupby(gk + ["snap_dt"]).agg(**agg).reset_index()
                .sort_values(gk + ["snap_dt"]))
        first = cons.groupby(gk).first().reset_index()
        last = cons.groupby(gk).last().reset_index()
        nsnaps = cons.groupby(gk).size().rename("n_snaps").reset_index()
        ren_f = {c: f"{mkt}_open_{c.replace('pay__', 'pay_')}" for c in cons.columns if c not in gk}
        ren_l = {c: f"{mkt}_close_{c.replace('pay__', 'pay_')}" for c in cons.columns if c not in gk}
        f = (first.rename(columns=ren_f)
             .merge(last.rename(columns=ren_l), on=gk)
             .merge(nsnaps.rename(columns={"n_snaps": f"{mkt}_n_snaps"}), on=gk))
        frames.append(f.set_index(gk))
    wide = pd.concat(frames, axis=1).reset_index()

    # join results + metadata
    q = pd.read_parquet(ROOT / "data" / "quarter_scores.parquet")
    g = pd.read_parquet(ROOT / "data" / "nflverse_games.parquet")
    g["gameday"] = pd.to_datetime(g.gameday).dt.strftime("%Y-%m-%d")
    q = q.merge(g[["game_id", "gameday", "gametime", "weekday", "div_game",
                   "roof", "temp", "wind"]], on="game_id", how="left")
    out = wide.merge(
        q.rename(columns={"home_team": "home_ab", "away_team": "away_ab"}),
        on=["season", "gameday", "home_ab", "away_ab"], how="inner")
    print(f"odds games: {len(wide)} | joined to results: {len(out)}")
    miss = wide.merge(q.rename(columns={"home_team": "home_ab", "away_team": "away_ab"}),
                      on=["season", "gameday", "home_ab", "away_ab"],
                      how="left", indicator=True)
    nm = miss[miss._merge == "left_only"]
    if len(nm):
        print(f"odds games without results ({len(nm)}, phantoms/flex expected):")
        print(nm[["season", "gameday", "home_ab", "away_ab"]].head(25).to_string(index=False))

    out.to_parquet(ROOT / "data" / "h1tt_frame.parquet", index=False)
    print(out.groupby("season").size())
    cov = {m: out[f"{m}_close_{(MARKETS[m][0] or MARKETS[m][1])[0]}"
                  if MARKETS[m][0] else f"{m}_close_pay_{MARKETS[m][1][0]}"]
           .notna().mean() for m in MARKETS}
    print("close coverage:", {k: round(v, 3) for k, v in cov.items()})


if __name__ == "__main__":
    main()
