"""
Build opponent-adjusted team ratings AS-OF each week (leak-safe season-to-date).

ratings_asof[season, asof_week, team] uses only games with week <= asof_week.
A game in week G must therefore use asof_week = G-1 (strictly before kickoff).

Iterative opponent adjustment (validated ~0.9 corr vs purchased, see adjust_prototype.py):
  L = league mean; adj_off[t] = mean_g(off_g - (adj_def[opp]-L)); adj_def[t] = mean_g(def_g - (adj_off[opp]-L)).
Output: data/team_ratings_asof.parquet
"""
import os
import numpy as np
import pandas as pd

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "data", "cfbd")
YEARS = [2016, 2017, 2018, 2019, 2021, 2022, 2023, 2024, 2025]

# purchased_col_stub -> (offense raw col, defense raw col)
METRICS = {
    "epa": ("offense.ppa", "defense.ppa"),
    "rushing_epa": ("offense.rushingPlays.ppa", "defense.rushingPlays.ppa"),
    "passing_epa": ("offense.passingPlays.ppa", "defense.passingPlays.ppa"),
    "success": ("offense.successRate", "defense.successRate"),
    "standard_down_success": ("offense.standardDowns.successRate", "defense.standardDowns.successRate"),
    "passing_down_success": ("offense.passingDowns.successRate", "defense.passingDowns.successRate"),
    "explosiveness": ("offense.explosiveness", "defense.explosiveness"),
    "rush_explosiveness": ("offense.rushingPlays.explosiveness", "defense.rushingPlays.explosiveness"),
    "pass_explosiveness": ("offense.passingPlays.explosiveness", "defense.passingPlays.explosiveness"),
    "line_yards": ("offense.lineYards", "defense.lineYards"),
    "second_level_yards": ("offense.secondLevelYards", "defense.secondLevelYards"),
    "open_field_yards": ("offense.openFieldYards", "defense.openFieldYards"),
}


def adjust_metric(games, ocol, dcol, iters=12):
    """games: rows with team, opponent, ocol, dcol in the window. Returns (adj_off, adj_def, L)."""
    d = games[["team", "opponent", ocol, dcol]].dropna()
    if len(d) == 0:
        return {}, {}, np.nan
    L = d[ocol].mean()
    teams = sorted(set(d["team"]) | set(d["opponent"]))
    seed_off = d.groupby("team")[ocol].mean()
    seed_def = d.groupby("team")[dcol].mean()
    adj_off = {t: float(seed_off.get(t, L)) for t in teams}
    adj_def = {t: float(seed_def.get(t, L)) for t in teams}
    by_team = {}
    for r in d.to_dict("records"):
        by_team.setdefault(r["team"], []).append((r[ocol], r[dcol], r["opponent"]))
    for _ in range(iters):
        no, nd = {}, {}
        for t in teams:
            gs = by_team.get(t)
            if not gs:
                no[t], nd[t] = L, L
                continue
            no[t] = np.mean([ov - (adj_def.get(opp, L) - L) for ov, dv, opp in gs])
            nd[t] = np.mean([dv - (adj_off.get(opp, L) - L) for ov, dv, opp in gs])
        adj_off, adj_def = no, nd
    return adj_off, adj_def, L


def main():
    out_rows = []
    for year in YEARS:
        ga = pd.read_parquet(os.path.join(DATA, f"game_advanced_{year}.parquet"))
        ga = ga[ga["seasonType"] == "regular"].copy()
        max_wk = int(ga["week"].max())
        for asof in range(1, max_wk + 1):
            window = ga[ga["week"] <= asof]
            # compute all metrics on this window
            per_metric = {}
            for stub, (ocol, dcol) in METRICS.items():
                ao, ad, L = adjust_metric(window, ocol, dcol)
                per_metric[stub] = (ao, ad)
            teams = set()
            for ao, ad in per_metric.values():
                teams |= set(ao) | set(ad)
            ngames = window.groupby("team").size().to_dict()
            for t in teams:
                row = {"season": year, "asof_week": asof, "team": t,
                       "games_played": int(ngames.get(t, 0))}
                for stub, (ao, ad) in per_metric.items():
                    row[f"adj_{stub}"] = ao.get(t, np.nan)
                    row[f"adj_{stub}_allowed"] = ad.get(t, np.nan)
                out_rows.append(row)
        print(f"  {year}: weeks 1..{max_wk} done")
    df = pd.DataFrame(out_rows)
    out = os.path.join(HERE, "data", "team_ratings_asof.parquet")
    df.to_parquet(out, index=False)
    print(f"team_ratings_asof: {len(df)} rows ({df['team'].nunique()} teams) -> {out}")


if __name__ == "__main__":
    main()
