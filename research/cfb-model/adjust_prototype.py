"""
Prototype: recreate opponent-adjusted EPA season-to-date (through week W-1) from
CFBD per-game raw stats, and validate against the purchased week-W file.

Iterative opponent adjustment (Connelly-style):
  L = league mean of the raw metric (over all team-games in window)
  adj_off[t] = mean_g( off_val_g - (adj_def[opp_g] - L) )
  adj_def[t] = mean_g( def_val_g - (adj_off[opp_g] - L) )   # def_val = value ALLOWED
  iterate to convergence.
adj_off high = good offense; adj_def low = good (stingy) defense.
"""
import os
import numpy as np
import pandas as pd

HERE = os.path.dirname(os.path.abspath(__file__))


def adjust_metric(ga, off_col, def_col, iters=15):
    """ga: per-team-game rows in the window. Returns dict team -> (adj_off, adj_def)."""
    d = ga[["team", "opponent", off_col, def_col]].dropna()
    off_val = d.groupby("team")[off_col].mean()
    L = d[off_col].mean()
    teams = sorted(set(d["team"]) | set(d["opponent"]))
    adj_off = {t: off_val.get(t, L) for t in teams}
    adj_def = {t: d[d.team == t][def_col].mean() if (d.team == t).any() else L for t in teams}
    rows = d.to_dict("records")
    by_team = {}
    for r in rows:
        by_team.setdefault(r["team"], []).append(r)
    for _ in range(iters):
        new_off, new_def = {}, {}
        for t in teams:
            gs = by_team.get(t, [])
            if not gs:
                new_off[t], new_def[t] = L, L
                continue
            new_off[t] = np.mean([g[off_col] - (adj_def.get(g["opponent"], L) - L) for g in gs])
            new_def[t] = np.mean([g[def_col] - (adj_off.get(g["opponent"], L) - L) for g in gs])
        adj_off, adj_def = new_off, new_def
    return adj_off, adj_def, L


def main():
    W = 6  # validate the purchased week-6 file => window is weeks 1..5
    ga = pd.read_parquet(os.path.join(HERE, "data", "cfbd", f"game_advanced_2025.parquet"))
    ga = ga[(ga["seasonType"] == "regular") & (ga["week"] < W)].copy()
    print(f"window weeks 1..{W-1}: {len(ga)} team-game rows, {ga['team'].nunique()} teams")

    # purchased target
    pur = pd.read_csv(os.path.join(HERE, "data", "purchased_2025_week06.csv"))

    # map purchased columns -> (cfbd off raw, cfbd def raw)
    METRICS = {
        "adjusted_epa": ("offense.ppa", "defense.ppa"),
        "adjusted_success": ("offense.successRate", "defense.successRate"),
        "adjusted_explosiveness": ("offense.explosiveness", "defense.explosiveness"),
        "adjusted_line_yards": ("offense.lineYards", "defense.lineYards"),
        "adjusted_rushing_epa": ("offense.rushingPlays.ppa", "defense.rushingPlays.ppa"),
        "adjusted_passing_epa": ("offense.passingPlays.ppa", "defense.passingPlays.ppa"),
        "adjusted_standard_down_success": ("offense.standardDowns.successRate", "defense.standardDowns.successRate"),
        "adjusted_passing_down_success": ("offense.passingDowns.successRate", "defense.passingDowns.successRate"),
    }

    print(f"\n{'metric':<34}{'corr_off':>10}{'corr_def':>10}   (our adj vs purchased, home+away pooled)")
    print("-" * 64)
    for pcol, (ocol, dcol) in METRICS.items():
        adj_off, adj_def, L = adjust_metric(ga, ocol, dcol)
        # build comparison: for each purchased row, our adj_off[home] vs purchased home_<pcol>
        recs = []
        for _, row in pur.iterrows():
            for side in ("home", "away"):
                t = row[f"{side}_team"]
                recs.append({
                    "our_off": adj_off.get(t, np.nan),
                    "pur_off": row.get(f"{side}_{pcol}", np.nan),
                    "our_def": adj_def.get(t, np.nan),
                    "pur_def": row.get(f"{side}_{pcol}_allowed", np.nan),
                })
        c = pd.DataFrame(recs).dropna()
        if len(c) < 20:
            print(f"{pcol:<34}{'n/a (cols?)':>20}")
            continue
        co = np.corrcoef(c["our_off"], c["pur_off"])[0, 1]
        cd = np.corrcoef(c["our_def"], c["pur_def"])[0, 1]
        print(f"{pcol:<34}{co:>10.3f}{cd:>10.3f}   (n={len(c)})")


if __name__ == "__main__":
    main()
