"""Derive per-quarter (and half/OT) scores from nflverse play-by-play.

End-of-quarter score = max cumulative total_home/away_score within the quarter
(cumulative is monotonic). Validates final scores against nflverse_games.
Output: data/quarter_scores.parquet — one row per game with q1-q4 + ot points
per team, plus h1/h2 convenience columns (h2 excludes OT; book 2H bets
usually include OT, so use h2 + ot for grading those).
"""
import urllib.request
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parent
PBP_CACHE = ROOT / "data" / "pbp_cache"
URL = "https://github.com/nflverse/nflverse-data/releases/download/pbp/play_by_play_{y}.parquet"
COLS = ["game_id", "season", "week", "season_type", "home_team", "away_team",
        "qtr", "total_home_score", "total_away_score"]


def season_pbp(year):
    PBP_CACHE.mkdir(parents=True, exist_ok=True)
    fn = PBP_CACHE / f"pbp_{year}.parquet"
    if not fn.exists():
        print(f"downloading pbp {year}...", flush=True)
        urllib.request.urlretrieve(URL.format(y=year), fn)
    return pd.read_parquet(fn, columns=COLS)


def main():
    pbp = pd.concat([season_pbp(y) for y in (2023, 2024, 2025)], ignore_index=True)
    pbp = pbp[pbp.qtr.notna()]
    pbp["qtr"] = pbp.qtr.clip(upper=5).astype(int)  # 5 = all OT periods

    eoq = (pbp.groupby(["game_id", "season", "week", "season_type",
                        "home_team", "away_team", "qtr"])
           [["total_home_score", "total_away_score"]].max().reset_index())
    w = eoq.pivot_table(index=["game_id", "season", "week", "season_type",
                               "home_team", "away_team"],
                        columns="qtr",
                        values=["total_home_score", "total_away_score"])
    w.columns = [f"{'hm' if a == 'total_home_score' else 'aw'}_cum_q{b}"
                 for a, b in w.columns]
    w = w.reset_index()

    out = w[["game_id", "season", "week", "season_type", "home_team", "away_team"]].copy()
    for side in ("hm", "aw"):
        prev = 0
        for q in (1, 2, 3, 4, 5):
            cum = w.get(f"{side}_cum_q{q}")
            # cumulative carries forward through scoreless quarters; q5 NaN = no OT
            cum = cum.fillna(prev if isinstance(prev, int) else prev)
            name = "ot" if q == 5 else f"q{q}"
            out[f"{name}_{'home' if side == 'hm' else 'away'}"] = (cum - prev).astype(int)
            prev = cum
    for side in ("home", "away"):
        out[f"h1_{side}"] = out[f"q1_{side}"] + out[f"q2_{side}"]
        out[f"h2_{side}"] = out[f"q3_{side}"] + out[f"q4_{side}"]
        out[f"final_{side}"] = out[f"h1_{side}"] + out[f"h2_{side}"] + out[f"ot_{side}"]

    # validate against nflverse schedule finals
    g = pd.read_parquet(ROOT / "data" / "nflverse_games.parquet")
    chk = out.merge(g[["game_id", "home_score", "away_score"]], on="game_id", how="inner")
    bad = chk[(chk.final_home != chk.home_score) | (chk.final_away != chk.away_score)]
    print(f"games: {len(out)} | validated vs schedule: {len(chk)} | mismatches: {len(bad)}")
    if len(bad):
        print(bad[["game_id", "final_home", "home_score", "final_away", "away_score"]]
              .head(20).to_string(index=False))

    out.to_parquet(ROOT / "data" / "quarter_scores.parquet", index=False)
    print(out.groupby("season").size())
    print("\nsanity (means): ", {c: round(out[c].mean(), 2) for c in
          ["q1_home", "q2_home", "q3_home", "q4_home", "h1_home", "h1_away", "ot_home"]})


if __name__ == "__main__":
    main()
