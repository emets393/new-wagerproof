"""Game-script -> spread / moneyline, with a FAVORITE control (2024-25).

Tests whether run-heavy prep (pass-lean down + rush-lean up) beats the SPREAD, and
whether it adds anything BEYOND just being the favorite (the collinearity check).
"""
import numpy as np
import pandas as pd
from pathlib import Path
from game_script_team import team_actuals, team_lines, rep, NORM

DATA = Path(__file__).resolve().parent / "data"


def outcomes_sp():
    h = pd.read_parquet(DATA / "h1tt_frame.parquet")
    h["home_ab"] = h.home_ab.replace(NORM); h["away_ab"] = h.away_ab.replace(NORM)
    rows = []
    for _, r in h.iterrows():
        for home in (True, False):
            tp = r.final_home if home else r.final_away
            op = r.final_away if home else r.final_home
            tsp = r.spread_close_spread_home if home else -r.spread_close_spread_home
            rows.append(dict(season=int(r.season), week=int(r.week),
                team=r.home_ab if home else r.away_ab,
                team_margin=tp - op, team_spread=tsp))
    return pd.DataFrame(rows)


def main():
    tg = outcomes_sp().merge(team_lines(), on=["season", "week", "team"], how="left") \
        .merge(team_actuals()[["season", "week", "team", "avg_pass_prior", "avg_rush_prior"]],
               on=["season", "week", "team"], how="left")
    tg["pass_lean"] = tg.pass_att_line - tg.avg_pass_prior
    tg["rush_lean"] = tg.rush_att_line - tg.avg_rush_prior
    tg = tg.dropna(subset=["pass_lean", "rush_lean", "team_spread", "team_margin"])
    tg = tg[tg.team_margin + tg.team_spread != 0]                 # drop ATS pushes
    tg["cover"] = tg.team_margin + tg.team_spread > 0
    tg["win"] = tg.team_margin > 0
    tg["is_fav"] = tg.team_spread < 0

    rh = tg[(tg.pass_lean < 0) & (tg.rush_lean > 0)]
    ph = tg[(tg.pass_lean > 0) & (tg.rush_lean < 0)]
    print(f"team-games: {len(tg)} | run-heavy: {len(rh)} | pass-heavy: {len(ph)}")
    print(f"base ATS cover={tg.cover.mean()*100:.1f}%  base win={tg.win.mean()*100:.1f}%  "
          f"base favorite-rate={tg.is_fav.mean()*100:.1f}%\n")

    print("(1) run-heavy prep -> spread COVER / moneyline WIN:")
    rep("run-heavy -> ATS cover", rh, rh.cover, 50.0)
    rep("run-heavy -> ML win", rh, rh.win, tg.win.mean()*100)
    rep("pass-heavy -> ATS cover (fade side)", ph, ~ph.cover, 50.0)

    print(f"\n(2) COLLINEARITY CHECK — is run-heavy just 'the favorite'?")
    print(f"    run-heavy teams that are FAVORITES: {rh.is_fav.mean()*100:.0f}% "
          f"(vs {tg.is_fav.mean()*100:.0f}% league) — pass-heavy favorites: {ph.is_fav.mean()*100:.0f}%")
    fav = tg[tg.is_fav]
    print(f"    ALL favorites -> ATS cover: {fav.cover.mean()*100:.1f}% (n={len(fav)})")

    print("\n(3) DOES IT ADD ANYTHING BEYOND FAVORITE? — split run-heavy by fav/dog:")
    rep("run-heavy & FAVORITE -> ATS cover", rh[rh.is_fav], rh[rh.is_fav].cover, fav.cover.mean()*100)
    dog = tg[~tg.is_fav]
    rep("run-heavy & UNDERDOG -> ATS cover", rh[~rh.is_fav], rh[~rh.is_fav].cover, dog.cover.mean()*100)
    print(f"    (baseline: favorites cover {fav.cover.mean()*100:.1f}%, underdogs cover {dog.cover.mean()*100:.1f}%)")


if __name__ == "__main__":
    main()
