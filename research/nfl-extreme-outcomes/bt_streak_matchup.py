"""MATCHUP-specific (head-to-head series) streak mining (2018-25).

Not team form -- the rivalry's OWN history. Key = the unordered pair {A,B}. Sort that
pair's meetings by date; the "streak" is consecutive O/U (or cover) results within THAT
matchup only. Then test the NEXT meeting. Example: JETS-RAVENS went under 3 straight
meetings -> did meeting #4 go over?

Caveat baked in: most pairs meet 1-2x/yr (divisional) or ~2x in 8yrs (cross-conf), so
deep matchup streaks are RARE. We print the streak-length supply so the reader sees how
thin each cell is. Graded at -110, BE 52.38%. Per-season is meaningless here (a streak
spans years) so we report pooled hit/ROI + sample only.
"""
import numpy as np
import pandas as pd
import os
from forecast_harness import DATA

BE = 52.38


def games():
    d = pd.read_parquet(os.path.join(str(DATA), "matchup.parquet"))
    d = d.dropna(subset=["home_score", "away_score", "ou_vegas_line",
                         "home_spread", "game_date"]).copy()
    d["game_date"] = pd.to_datetime(d.game_date)
    d["tot"] = d.home_score + d.away_score
    d["over"] = np.where(d.tot == d.ou_vegas_line, np.nan,
                         (d.tot > d.ou_vegas_line).astype(float))
    hm = d.home_score - d.away_score
    cov = hm + d.home_spread
    d["home_cov"] = np.where(cov == 0, np.nan, (cov > 0).astype(float))
    # order-independent matchup key + a fixed "reference" team (alphabetical first)
    d["pair"] = d.apply(lambda r: " vs ".join(sorted([r.home_team, r.away_team])), axis=1)
    d["ref_team"] = d.pair.str.split(" vs ").str[0]
    d["ref_is_home"] = (d.ref_team == d.home_team).astype(int)
    # did the reference team cover (fixed identity across the series, home or away)
    d["ref_cov"] = np.where(d.ref_is_home == 1, d.home_cov,
                            np.where(d.home_cov.isna(), np.nan, 1 - d.home_cov))
    return d.sort_values("game_date").reset_index(drop=True)


def entering_streak(vals):
    """Signed run length of identical values ending at the PRIOR element (no leak)."""
    out, rv, rl = [], None, 0
    for v in vals:
        out.append(0 if rv is None else (rl if rv == 1 else -rl))
        if pd.isna(v):
            rv, rl = None, 0
        elif v == rv:
            rl += 1
        else:
            rv, rl = v, 1
    return out


def supply(streak_col, label):
    vc = streak_col.value_counts().sort_index()
    print(f"  supply of {label}: " +
          "  ".join(f"{int(k):+d}:{v}" for k, v in vc.items() if k != 0))


def rep(label, mask, outcome):
    o = outcome[mask].dropna()
    n = len(o)
    if n < 15:
        print(f"  {label:46s} n={n:4d}  (too thin)")
        return
    w = o.sum()
    hit = w / n * 100
    roi = (w * 0.9091 - (n - w)) / n * 100
    star = "  <<<" if hit >= 55 and n >= 30 else ("  <" if hit >= 55 else "")
    print(f"  {label:46s} n={n:4d}  hit={hit:5.1f}%  ROI={roi:+6.1f}%{star}")


def main():
    d = games()
    npair = d.pair.nunique()
    meets = d.groupby("pair").size()
    print("=" * 88)
    print(f"MATCHUP-SPECIFIC STREAKS  (2018-25; {npair} distinct pairings, "
          f"{len(d)} meetings)")
    print(f"meetings/pair: max={meets.max()}  median={int(meets.median())}  "
          f"pairs with >=4 meetings={int((meets >= 4).sum())}")
    print("=" * 88)

    # within-matchup entering streaks
    d["ou_streak"] = d.groupby("pair", group_keys=False).over.apply(
        lambda s: pd.Series(entering_streak(s.values), index=s.index))
    d["homecov_streak"] = d.groupby("pair", group_keys=False).home_cov.apply(
        lambda s: pd.Series(entering_streak(s.values), index=s.index))
    d["refcov_streak"] = d.groupby("pair", group_keys=False).ref_cov.apply(
        lambda s: pd.Series(entering_streak(s.values), index=s.index))

    print("\n-- supply (how often a matchup even reaches a streak) --")
    supply(d.ou_streak, "matchup O/U streak")
    supply(d.homecov_streak, "matchup home-cover streak")

    over = d.over
    print("\n-- (1) MATCHUP O/U reversion: this pairing went UNDER k straight -> OVER --")
    for k in (2, 3, 4):
        rep(f"matchup UNDER {k} straight -> OVER next", d.ou_streak <= -k, over)
    print("   mirror: this pairing went OVER k straight -> UNDER")
    for k in (2, 3, 4):
        rep(f"matchup OVER {k} straight  -> UNDER next", d.ou_streak >= k, 1 - over)

    print("\n-- (2) MATCHUP ATS: home side covered k straight in this pairing --")
    hc = d.home_cov
    for k in (2, 3, 4):
        rep(f"matchup HOME covered {k} straight -> home cover", d.homecov_streak >= k, hc)
        rep(f"matchup HOME covered {k} straight -> FADE home", d.homecov_streak >= k, 1 - hc)

    print("\n-- (3) MATCHUP ATS: same TEAM (identity) covered k straight in pairing --")
    rc = d.ref_cov
    for k in (2, 3, 4):
        rep(f"same team covered {k} straight -> covers again", d.refcov_streak >= k, rc)
        rep(f"same team covered {k} straight -> FADE (other team)", d.refcov_streak >= k, 1 - rc)

    print("\n-- (4) restrict to DIVISIONAL rivalries (the only pairs with deep history) --")
    dv = d[d.div_game == True] if d.div_game.dtype != bool else d[d["div_game"]]
    for k in (2, 3):
        m = (d.ou_streak <= -k) & d["div_game"].astype(bool)
        rep(f"DIV matchup UNDER {k} straight -> OVER", m, over)
        m = (d.ou_streak >= k) & d["div_game"].astype(bool)
        rep(f"DIV matchup OVER {k} straight  -> UNDER", m, 1 - over)

    print("\n-- baselines --")
    rep("ALL meetings -> OVER", d.over.notna(), over)
    rep("ALL meetings -> home cover", d.home_cov.notna(), hc)


if __name__ == "__main__":
    main()
