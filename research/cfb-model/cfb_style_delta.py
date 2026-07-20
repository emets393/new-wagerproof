"""S-CFB1 style-delta — pregame, leak-safe computation used by gen_cfb_dryrun_flags.py.
A team's ACTUAL offensive EPA/play vs an opponent's DEFENSE archetype minus its own season baseline, from
PRIOR completed same-season games only. delta ≤ -0.10 (T3) / ≤ -0.15 (T2) with ≥2 prior meetings vs the
archetype → bet the UNDER (game total + that team's team total). Validated in FOOTBALL_PROFILES.md.

Opponent archetype = the opponent's LATEST completed-game DEF_type this season (leak-safe proxy for their
current defensive identity; ~1 week behind the backtest's exact as-of, immaterial at ~75% type stability)."""
import numpy as np, pandas as pd

THRESH_T3, THRESH_T2, MIN_PRIORS = -0.10, -0.15, 2

def load_profiles(path="data/cfb_team_games_profiled.parquet"):
    return pd.read_parquet(path)

def deltas_for_week(season, week, matchups, prof=None):
    """matchups: iterable of (team, opponent). Returns {team: {delta, n_priors_vs, opp_DEF, tier}} for teams
    that TRIGGER (delta ≤ -0.10, ≥2 priors vs the opp's archetype). Uses only games with week < `week`."""
    if prof is None: prof = load_profiles()
    comp = prof[(prof.season == season) & (prof.week < week)]
    out = {}
    for team, opp in matchups:
        tp = comp[comp.team == team].dropna(subset=["off_ppa"])
        op = comp[comp.team == opp]
        if len(tp) < 1 or len(op) < 1:
            continue
        opp_def = op.sort_values("week").iloc[-1]["opp_self_def"] if "opp_self_def" in op else op.sort_values("week").iloc[-1]["DEF_type"]
        base = tp.off_ppa.mean()
        vs_rows = tp[tp.opp_DEF == opp_def]
        n = int(vs_rows.off_ppa.notna().sum())
        if n < MIN_PRIORS or not np.isfinite(base):
            continue
        delta = float(vs_rows.off_ppa.mean() - base)
        if delta > THRESH_T3:
            continue
        out[team] = {"delta": round(delta, 3), "n_priors_vs": n, "opp_DEF": int(opp_def),
                     "tier": "T2" if delta <= THRESH_T2 else "T3"}
    return out

if __name__ == "__main__":
    # self-test: reproduce fires on a historical week and check the subsequent-game UNDER rate
    prof = load_profiles()
    hits, unders = 0, 0
    for (season, week), wk in prof[prof.week >= 4].groupby(["season", "week"]):
        mat= list(dict.fromkeys(zip(wk.team, wk.opponent)))
        fired = deltas_for_week(season, week, mat, prof)
        for team, info in fired.items():
            row = wk[wk.team == team]
            if row.empty or pd.isna(row.over.iloc[0]): continue
            hits += 1; unders += int(row.over.iloc[0] == 0)
    print(f"self-test: {hits} historical fires (week>=4), game UNDER {unders/hits*100:.1f}%  (validated ~54-58%)")
    # example: latest season, a mid-season week
    ex = prof[(prof.season == 2024) & (prof.week == 10)]
    mat = list(dict.fromkeys(zip(ex.team, ex.opponent)))
    fired = deltas_for_week(2024, 10, mat, prof)
    print(f"2024 wk10 example fires ({len(fired)}):")
    for t, i in list(fired.items())[:8]:
        print(f"  {t:20s} delta {i['delta']:+.3f}  n={i['n_priors_vs']}  vs opp DEF T{i['opp_DEF']}  [{i['tier']}]")
