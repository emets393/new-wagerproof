"""Silly-but-honest streak/sequence mining (2018-25, matchup.parquet, 2226 games).

Guru hunch family: "a team never does X more than N times in a row" -> after a run of N,
is the NEXT game a profitable revert/continue? All streaks are computed ENTERING a game
(prior games only, no leak); the test outcome is the current game. Graded at -110
(BE 52.38%). We report pooled hit/ROI AND per-season durability (how many of the seasons
with a usable sample clear break-even) so a one-year fluke can't masquerade as a trend.
"""
import numpy as np
import pandas as pd
import os
from forecast_harness import DATA

BE = 52.38


def team_log():
    d = pd.read_parquet(os.path.join(str(DATA), "matchup.parquet"))
    d = d.dropna(subset=["home_score", "away_score", "ou_vegas_line",
                         "home_spread", "game_date"]).copy()
    d["game_date"] = pd.to_datetime(d.game_date)
    rows = []
    for _, r in d.iterrows():
        hm = r.home_score - r.away_score
        tot = r.home_score + r.away_score
        over = tot - r.ou_vegas_line
        for is_home, team, opp, score, oscore, spread, margin in (
            (1, r.home_team, r.away_team, r.home_score, r.away_score, r.home_spread, hm),
            (0, r.away_team, r.home_team, r.away_score, r.home_score, r.away_spread, -hm)):
            cov = margin + spread
            rows.append(dict(
                season=int(r.season), week=int(r.week), date=r.game_date,
                team=team, opp=opp, is_home=is_home,
                div=bool(r.div_game), conf=bool(r.conference_game),
                score=score, margin=margin, fav=spread < 0,
                over=np.nan if over == 0 else int(over > 0),
                cover=np.nan if cov == 0 else int(cov > 0),
                win=np.nan if margin == 0 else int(margin > 0)))
    t = pd.DataFrame(rows).sort_values(["team", "date"]).reset_index(drop=True)
    return t


def entering_streak(series):
    """For each row, length of the consecutive run of the SAME value ending at the
    PRIOR row (signed: +k if prior run was 1's, -k if 0's). NaN-aware (NaN breaks run)."""
    out = []
    run_val, run_len = None, 0
    for v in series:
        # value entering THIS game = run state from prior games
        out.append(0 if run_val is None else (run_len if run_val == 1 else -run_len))
        if pd.isna(v):
            run_val, run_len = None, 0
        elif v == run_val:
            run_len += 1
        else:
            run_val, run_len = v, 1
    return out


def rep(label, mask, outcome):
    """outcome: 1=win of the stated bet, 0=loss; mask selects qualifying rows."""
    sub = pd.DataFrame({"season": MASK_SEASON[mask], "o": outcome[mask]}).dropna()
    n = len(sub)
    if n < 30:
        return
    w = sub.o.sum()
    hit = w / n * 100
    roi = (w * 0.9091 - (n - w)) / n * 100
    seas = []
    for s, g in sub.groupby("season"):
        if len(g) >= 8:
            seas.append(g.o.mean() * 100)
    good = sum(1 for x in seas if x >= BE)
    star = "  <<<" if hit >= 53 and len(seas) >= 4 and good >= len(seas) * 0.6 else ""
    print(f"  {label:46s} n={n:4d}  hit={hit:5.1f}%  ROI={roi:+6.1f}%  "
          f"[{good}/{len(seas)} seas>BE]{star}")


def main():
    t = team_log()
    global MASK_SEASON
    MASK_SEASON = t.season
    print("=" * 92)
    print(f"STREAK / SEQUENCE GURU MINE  (2018-25, {t.team.nunique()} teams, "
          f"{len(t)} team-games)   <<< = durable")
    print("=" * 92)

    # per-team entering streaks
    t["ou_streak"] = t.groupby("team", group_keys=False).over.apply(
        lambda s: pd.Series(entering_streak(s.values), index=s.index))
    t["cov_streak"] = t.groupby("team", group_keys=False).cover.apply(
        lambda s: pd.Series(entering_streak(s.values), index=s.index))
    t["win_streak"] = t.groupby("team", group_keys=False).win.apply(
        lambda s: pd.Series(entering_streak(s.values), index=s.index))

    over = t.over
    cover = t.cover
    fade_home_cover = 1 - cover  # bet away/fade

    print("\n-- (1) TOTALS reversion: after k straight UNDER -> bet OVER next --")
    for k in (2, 3, 4):
        rep(f"entering UNDER streak >= {k}  -> OVER", t.ou_streak <= -k, over)
    print("   mirror: after k straight OVER -> bet UNDER next")
    for k in (2, 3, 4):
        rep(f"entering OVER streak >= {k}  -> UNDER", t.ou_streak >= k, 1 - over)

    print("\n-- (2) ATS reversion/continuation: after k straight COVERS --")
    for k in (2, 3, 4):
        rep(f"covered {k} straight -> COVER again", t.cov_streak >= k, cover)
        rep(f"covered {k} straight -> FADE (bet against)", t.cov_streak >= k, fade_home_cover)
    print("   after k straight non-covers")
    for k in (2, 3, 4):
        rep(f"failed {k} straight -> COVER (bounce)", t.cov_streak <= -k, cover)

    print("\n-- (3) HOME-team ATS streaks (only home rows) --")
    h = t.is_home == 1
    for k in (2, 3):
        rep(f"HOME covered {k} straight -> cover", h & (t.cov_streak >= k), cover)
        rep(f"HOME covered {k} straight -> FADE", h & (t.cov_streak >= k), fade_home_cover)

    print("\n-- (4) DIVISIONAL games only (cover continuation/fade) --")
    dv = t["div"]
    for k in (2, 3):
        rep(f"DIV covered {k} straight -> cover", dv & (t.cov_streak >= k), cover)
        rep(f"DIV covered {k} straight -> FADE", dv & (t.cov_streak >= k), fade_home_cover)
    rep("DIV home team -> cover (base)", dv & h, cover)
    rep("DIV home favorite -> cover", dv & h & t.fav, cover)

    print("\n-- (5) SU win/loss streak -> ATS next (public overvalue) --")
    for k in (2, 3, 4):
        rep(f"won {k} straight SU -> COVER", t.win_streak >= k, cover)
        rep(f"won {k} straight SU -> FADE", t.win_streak >= k, fade_home_cover)
        rep(f"lost {k} straight SU -> COVER (live dog)", t.win_streak <= -k, cover)

    print("\n-- (6) BLOWOUT hangover (prior-game margin) -> ATS / total this game --")
    t["prior_margin"] = t.groupby("team").margin.shift(1)
    rep("won prior by 20+ -> COVER", t.prior_margin >= 20, cover)
    rep("won prior by 20+ -> FADE", t.prior_margin >= 20, fade_home_cover)
    rep("lost prior by 20+ -> COVER (bounce)", t.prior_margin <= -20, cover)
    rep("won prior by 20+ -> game OVER", t.prior_margin >= 20, over)
    rep("won prior by 20+ -> game UNDER", t.prior_margin >= 20, 1 - over)

    print("\n-- (7) FAVORITE / DOG role streaks --")
    t["fav_cov_streak"] = t.groupby("team", group_keys=False).apply(
        lambda g: pd.Series(entering_streak(np.where(g.fav, g.cover, np.nan)), index=g.index))
    for k in (2, 3):
        rep(f"as FAV covered {k} straight -> cover (any role)", t.fav_cov_streak >= k, cover)
        rep(f"as FAV covered {k} straight -> FADE", t.fav_cov_streak >= k, fade_home_cover)

    print("\n-- (8) SCORING streaks -> totals next --")
    t["hi30"] = (t.score >= 30).astype(float)
    t["lo17"] = (t.score <= 17).astype(float)
    t["hi30_streak"] = t.groupby("team", group_keys=False).hi30.apply(
        lambda s: pd.Series(entering_streak(s.values), index=s.index))
    t["lo17_streak"] = t.groupby("team", group_keys=False).lo17.apply(
        lambda s: pd.Series(entering_streak(s.values), index=s.index))
    for k in (2, 3):
        rep(f"scored 30+ {k} straight -> game OVER", t.hi30_streak >= k, over)
        rep(f"scored 30+ {k} straight -> game UNDER", t.hi30_streak >= k, 1 - over)
        rep(f"held to <=17 {k} straight -> game UNDER", t.lo17_streak >= k, 1 - over)

    print("\n-- baselines --")
    rep("ALL -> OVER", t.season > 0, over)
    rep("ALL -> home/team COVER", t.season > 0, cover)


if __name__ == "__main__":
    main()
