#!/usr/bin/env python3
"""NFL OVER/UNDER LUCK RATING (owner 2026-09-23, after seeing Action Network's totals luck).

A spread luck rating asks "did this team win more than it deserved". The totals version asks
"did this team's games SCORE more than the play deserved" — points that came from short fields,
red-zone conversion running hot, returns, or a kicker on a heater rather than from moving the ball.
Those points are the least repeatable thing on a scoreboard, so if the market has priced them into
a team's total, the correction is an UNDER.

Built as points-over-expectation:

    luck_for     = points scored  - E[points | offensive yards]
    luck_against = points allowed - E[points | yards allowed]      (defensive side of the same idea)

E[points|yards] is fit WALK-FORWARD on prior seasons only. Luck is then accumulated season-to-date
ENTERING the game (the current game is always excluded), so nothing a team did today can flow into
its own rating. A game's totals luck is the sum across both teams.

Pre-registered, stated before looking:
  H1  REGRESSION — high accumulated luck means the total is propped up by scoring that will not
      repeat, so bet UNDER. Low/negative luck, bet OVER.
  H2  PERSISTENCE — the inverse. Teams that score above expectation keep doing it (good red-zone
      offense, good kicker) and the market under-rates it, so bet OVER on high luck.
Exactly one can be right. Both near 50% means the market already prices it, which is the base case
for anything this easy to compute.

Graded vs the CLOSE and vs the OPENER, per season, pushes dropped.
"""
import numpy as np, pandas as pd, warnings
warnings.filterwarnings("ignore")
from scipy.stats import binomtest

MIN_GAMES = 3          # don't rate a team off one or two games
YRS = (2021, 2025)


def team_games():
    """One row per team-game: points for/against, yards for/against, and the game's lines."""
    po = pd.read_parquet("data/player_offense.parquet")
    po = po[po.season_type == "REG"]
    # team offensive yards = passing + rushing (receiving would double-count the passing yards)
    ty = (po.groupby(["season", "week", "team"], as_index=False)
            .agg(pass_yds=("passing_yards", "sum"), rush_yds=("rushing_yards", "sum")))
    ty["yards"] = ty.pass_yds.fillna(0) + ty.rush_yds.fillna(0)

    g = pd.read_parquet("data/games_enriched.parquet")
    g = g[(g.game_type == "REG") & g.home_score.notna() & g.total_line.notna()].copy()
    g = g[g.season.between(*YRS)]
    od = pd.read_parquet("data/odds_consensus.parquet")[
        ["season", "home_ab", "away_ab", "open_total"]].rename(
        columns={"home_ab": "home_team", "away_ab": "away_team"})
    for c in ("home_team", "away_team"):
        od[c] = od[c].replace({"LA": "LAR"})
    g = g.merge(od, on=["season", "home_team", "away_team"], how="left")

    rows = []
    for home in (True, False):
        rows.append(pd.DataFrame(dict(
            season=g.season, week=g.week, game_id=g.game_id,
            team=g.home_team if home else g.away_team,
            opp=g.away_team if home else g.home_team,
            pts=g.home_score if home else g.away_score,
            pts_opp=g.away_score if home else g.home_score,
            total_close=g.total_line, total_open=g.open_total,
            actual_total=g.home_score + g.away_score)))
    t = pd.concat(rows, ignore_index=True)
    t = t.merge(ty[["season", "week", "team", "yards"]], on=["season", "week", "team"], how="left")
    opp_y = ty.rename(columns={"team": "opp", "yards": "yards_opp"})
    t = t.merge(opp_y[["season", "week", "opp", "yards_opp"]], on=["season", "week", "opp"], how="left")
    return t.dropna(subset=["yards", "yards_opp"]).sort_values(["team", "season", "week"])


def add_luck(t):
    """points-over-expectation, with the yards->points fit trained on PRIOR seasons only."""
    t = t.copy()
    t["luck_for"] = np.nan
    t["luck_against"] = np.nan
    for s in sorted(t.season.unique()):
        prior = t[t.season < s]
        if len(prior) < 400:
            continue
        b, a = np.polyfit(prior.yards, prior.pts, 1)
        m = t.season == s
        t.loc[m, "luck_for"] = t.loc[m, "pts"] - (a + b * t.loc[m, "yards"])
        t.loc[m, "luck_against"] = t.loc[m, "pts_opp"] - (a + b * t.loc[m, "yards_opp"])
    t = t[t.luck_for.notna()].copy()

    # season-to-date ENTERING this game — shift(1) before the expanding mean, or a team's own
    # result leaks into the rating that is supposed to predict it
    gp = t.groupby(["team", "season"])
    for c in ("luck_for", "luck_against"):
        t[c + "_s2d"] = gp[c].transform(lambda s: s.shift(1).expanding().mean())
        t[c + "_n"] = gp[c].transform(lambda s: s.shift(1).expanding().count())
    t["luck_total_s2d"] = t.luck_for_s2d + t.luck_against_s2d   # both sides of this team's games
    return t


def game_frame(t, line="close"):
    """Collapse to one row per GAME with both teams' entering luck."""
    col = f"total_{line}"
    k = t[t[col].notna() & (t.luck_for_n >= MIN_GAMES)]
    a = k[["game_id", "season", "week", "team", col, "actual_total",
           "luck_for_s2d", "luck_against_s2d", "luck_total_s2d"]]
    m = a.merge(a, on=["game_id", "season", "week", col, "actual_total"], suffixes=("_a", "_b"))
    m = m[m.team_a < m.team_b]                      # one row per game
    # a game's totals luck: how much both teams' games have out-scored their yardage
    m["game_luck"] = (m.luck_for_s2d_a + m.luck_for_s2d_b
                      + m.luck_against_s2d_a + m.luck_against_s2d_b) / 2
    m["off_luck"] = m.luck_for_s2d_a + m.luck_for_s2d_b
    m["resid"] = m.actual_total - m[col]            # + = the OVER hit
    return m


def rec(name, s, side):
    """side: +1 bet OVER, -1 bet UNDER."""
    s = s[s.resid != 0]
    if len(s) < 40:
        print(f"  {name:48s} n={len(s):4d}  (too few)"); return
    side = np.asarray(side)[: len(s)] if hasattr(side, "__len__") else np.full(len(s), side)
    won = (np.sign(s.resid.values) == side)
    n, w = len(s), int(won.sum())
    roi = 100 * ((w * (100 / 110) - (n - w)) / n)
    by = s.assign(w=won).groupby("season").w.mean()
    print(f"  {name:48s} n={n:4d}  {w}-{n-w}  {100*w/n:5.1f}%  roi {roi:+6.1f}%  "
          f"p={binomtest(w,n,0.5).pvalue:.3f}  {int((by>=.524).sum())}/{len(by)} szn")


def run(m, tag):
    print(f"\n{'='*100}\n{tag}: {len(m)} games | over hits {100*(m.resid>0).mean():.1f}%"
          f" | game luck sd {m.game_luck.std():.1f} pts\n{'='*100}")
    hi = m.game_luck >= m.game_luck.quantile(.75)
    lo = m.game_luck <= m.game_luck.quantile(.25)
    print("-- H1 REGRESSION: lucky scoring will not repeat --")
    rec("top-quartile luck -> UNDER", m[hi], -1)
    rec("bottom-quartile luck -> OVER", m[lo], +1)
    print("-- H2 PERSISTENCE: the inverse --")
    rec("top-quartile luck -> OVER", m[hi], +1)
    rec("bottom-quartile luck -> UNDER", m[lo], -1)

    print("\n-- dose response: bet UNDER as accumulated luck rises --")
    qs = pd.qcut(m.game_luck, 5, labels=["very unlucky", "unlucky", "neutral", "lucky", "very lucky"])
    for q in qs.cat.categories:
        rec(f"  {q} -> UNDER", m[qs == q], -1)

    print("\n-- offence-only luck (points scored above yardage), same test --")
    oh = m.off_luck >= m.off_luck.quantile(.75)
    ol = m.off_luck <= m.off_luck.quantile(.25)
    rec("  top-quartile OFF luck -> UNDER", m[oh], -1)
    rec("  bottom-quartile OFF luck -> OVER", m[ol], +1)


if __name__ == "__main__":
    t = add_luck(team_games())
    print(f"team-games {len(t)} | yards->points fit is walk-forward | luck_for sd {t.luck_for.std():.1f} pts")
    # is this even a persistent team trait? if not, "luck rating" is the right name for it
    p = t.dropna(subset=["luck_for_s2d"])
    print(f"does scoring luck persist? corr(entering s2d luck, this game's luck) = "
          f"{p.luck_for_s2d.corr(p.luck_for):+.3f}  (n={len(p)})")
    for line in ("close", "open"):
        m = game_frame(t, line)
        if len(m) >= 200:
            run(m, f"NFL {YRS[0]}-{YRS[1]}, graded vs the {line.upper()}")

# =================================================================================================
# VERDICT (2026-09-23). A totals luck rating does not predict, and the reason is in one number.
#
# PERSISTENCE: corr(a team's entering season-to-date scoring luck, its luck THIS game) = +0.084
#   on 2,046 team-games. Points-over-expectation is almost pure noise game to game — which is what
#   makes "luck" the right name for it, and which caps how much any rating built on it can carry.
#
# THE BETS, both directions, quartiles of accumulated game luck:
#   vs the CLOSE   top-quartile -> UNDER 45.0% (n=222)   bottom -> OVER 50.7% (n=223)
#   vs the OPENER  top-quartile -> UNDER 52.6% (n=156)   bottom -> OVER 53.2% (n=156)
#   The top-quartile cell FLIPS SIDES between the opener and the close. That is the signature of
#   noise, not of an edge that happens to be small.
#   Dose response vs the close, very unlucky -> very lucky, all betting UNDER:
#     48.9 / 49.4 / 53.9 / 48.0 / 47.5% — the middle bucket is the best one. No gradient.
#   Offence-only luck (points above yardage, ignoring the defensive side): 48.0% / 47.3%. Nothing.
#
# THIS MATCHES WHAT CFB ALREADY FOUND. gen_cfb_slate_flags.py: "cumulative luck ledgers all tested
# NULL — only deceptive WINS mislead the market, and only for ONE game." A season-long luck rating
# is the shape that fails in both sports and both markets. What works in CFB is the narrow
# interaction — won a game it deserved to lose AND covered a number it deserved to miss — faded
# exactly once, 60.7% on n=107.
#
# SO: luck is useful as a ONE-GAME RATING CORRECTION, not as a standing rating and not as a totals
# input. Do not wire anything from this file.
#
# WHAT WOULD CHANGE THE ANSWER: a better luck definition than points-vs-yards. Red-zone TD rate
# against expectation, turnover-driven starting field position, return and defensive touchdowns and
# kicker make-rate are all more specifically non-repeatable than raw points-over-yards, and are the
# components a vendor rating would more likely use. If any of those persists at r well above 0.08,
# this is worth rebuilding on it; at r~0.1 across every proxy tested so far (see
# exp_luck_regression.py, where pts_over_yds and turnover margin both land at +0.11), it will not.
# =================================================================================================
