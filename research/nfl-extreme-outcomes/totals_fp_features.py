#!/usr/bin/env python3
"""Build an ENTERING-GAME Fantasy Points team feature panel for NFL totals.

WHY. The first totals rebuild used only matchup.parquet (EPA/pace aggregates) and found nothing.
The FP Data Suite is charted data — coverage scheme, pressure over expected, PROE, play action,
yards before/after contact, stuffs — information that is NOT in EPA. Owner asked for it explicitly.

VALUES ARE PER-GAME, verified: every row has teamStatsGamesPlayed == 1 and the measures fluctuate
week to week (KC 2024 rushing yards 72/149/128/101...). So season-to-date = shift(1).expanding().
Byes are simply absent weeks, which expanding() handles correctly.

⛔ EVERY FEATURE IS SHIFTED. A team's row for week W carries only weeks < W of that season. Nothing
here can see the game it is used to predict.
"""
from __future__ import annotations
import warnings
warnings.filterwarnings("ignore")
import numpy as np, pandas as pd
from pathlib import Path

FP = Path(__file__).resolve().parent / "data" / "fpdata"
SRC = {
    "proe":     "proeReport__team",
    "runpass":  "runPassReport__team",
    "pass":     "passingAdvanced__team",
    "rush":     "rushingAdvanced__team",
    "dpass":    "passingAdvanced__opponent",     # what this team's DEFENSE allowed
    "drush":    "rushingAdvanced__opponent",
    "cover":    "coverageMatrix__team",
    "line":     "lineMatchups__team",
}
NICK2AB = {
 "Cardinals":"ARI","Falcons":"ATL","Ravens":"BAL","Bills":"BUF","Panthers":"CAR","Bears":"CHI",
 "Bengals":"CIN","Browns":"CLE","Cowboys":"DAL","Broncos":"DEN","Lions":"DET","Packers":"GB",
 # ⚠ matchup.parquet uses LAR for the Rams, not LA. Mapping to "LA" silently dropped every
 # Rams game from the join (merge rate 59%).
 "Texans":"HOU","Colts":"IND","Jaguars":"JAX","Chiefs":"KC","Chargers":"LAC","Rams":"LAR",
 "Raiders":"LV","Dolphins":"MIA","Vikings":"MIN","Giants":"NYG","Jets":"NYJ","Patriots":"NE",
 "Saints":"NO","Eagles":"PHI","Steelers":"PIT","49ers":"SF","Seahawks":"SEA","Buccaneers":"TB",
 "Titans":"TEN","Commanders":"WAS","Redskins":"WAS","Football Team":"WAS",
}
DROP = ("GamesPlayed",)


def _load(name, tag):
    d = pd.read_parquet(FP / f"{name}.parquet")
    d = d.rename(columns={"gameSeason": "season", "gameWeek": "week"})
    d["ab"] = d.teamNickname.map(NICK2AB)
    num = [c for c in d.columns
           if d[c].dtype.kind in "fi" and c not in ("season", "week", "teamTeamId")
           and not any(k in c for k in DROP)]
    out = d[["season", "week", "ab"] + num].copy()
    return out.rename(columns={c: f"fp_{tag}_{c.replace('teamStats','').replace('opponentStats','opp')}"
                               for c in num})


def build_panel(last_n=3):
    """One row per (season, week, team) of ENTERING-GAME means: season-to-date and last-3."""
    frames = [_load(n, t) for t, n in SRC.items()]
    p = frames[0]
    for f in frames[1:]:
        p = p.merge(f, on=["season", "week", "ab"], how="outer")
    p = p.dropna(subset=["ab"]).sort_values(["season", "ab", "week"]).reset_index(drop=True)
    meas = [c for c in p.columns if c.startswith("fp_")]
    g = p.groupby(["season", "ab"], sort=False)
    s2d = g[meas].transform(lambda s: s.shift(1).expanding().mean())
    l3 = g[meas].transform(lambda s: s.shift(1).rolling(last_n, min_periods=1).mean())
    s2d.columns = [f"{c}_s2d" for c in meas]
    l3.columns = [f"{c}_l{last_n}" for c in meas]
    out = pd.concat([p[["season", "week", "ab"]], s2d, l3], axis=1)
    out["fp_games_prior"] = g.cumcount()
    return out


if __name__ == "__main__":
    panel = build_panel()
    print(f"FP entering-game panel: {panel.shape}")
    print(f"  seasons {sorted(panel.season.unique())}")
    print(f"  feature columns: {len([c for c in panel.columns if c.startswith('fp_')])}")
    # leak proof: a week-1 row must be entirely NaN (no prior games that season)
    w1 = panel[panel.week == 1]
    featcols = [c for c in panel.columns if c.startswith("fp_") and c != "fp_games_prior"]
    print(f"\n  LEAK PROOF -- week 1 rows must be all-NaN: "
          f"non-null share = {w1[featcols].notna().mean().mean():.4f} (must be 0.0000)")
    w5 = panel[panel.week == 5]
    print(f"  week 5 rows non-null share = {w5[featcols].notna().mean().mean():.3f}")
    panel.to_parquet("data/fp_team_entering.parquet", index=False)
    print("\n-> data/fp_team_entering.parquet")
