#!/usr/bin/env python3
"""NFL port of the CFB deceptive-win fade (owner 2026-09-23).

CFB ships two flags off CFBD's postgame win expectancy — how often a team wins given how the game
was actually PLAYED, with the score removed:

  double_luck_fade  won with own win-expectancy <= .50 AND covered a spread it deserved to miss
                    by >= 4  ->  fade its next game.  60.7% (n=107, all 5 seasons >= 53%)
  lucky_win_fade    won with win-expectancy <= .40 (no double-luck)  ->  fade.  56.0% (n=327)

The NFL has no equivalent shipped and no vendor PWE field, so the win expectancy is built here from
play-by-play: a probit of WIN on score-free box differentials (success rate, EPA per play, turnover
margin, yards), fit WALK-FORWARD on prior seasons so no game is scored by a model that saw it.
Score-free is the whole point — a win-expectancy that knows the score cannot tell you the win was
undeserved.

    deserved_margin = K * Phi^-1(win_expectancy)     K fit on prior seasons, the CFB analogue of 10.2
    deceptive cover = covered by >= 4 more than the deserved margin says it should have

Fades are graded on the team's NEXT game ATS vs the OPENER (the repo's grading law: the trigger is
known the moment the previous game ends, so the opener is the line you could actually take).
Pushes dropped, per-season lines always shown.

First run pulls play-by-play via nfl_data_py and caches data/_nfl_teamgame_box.parquet.
"""
import os
import numpy as np, pandas as pd, warnings
warnings.filterwarnings("ignore")
from scipy.stats import norm, binomtest

CACHE = "data/_nfl_teamgame_box.parquet"
YEARS = list(range(2016, 2026))


def team_box():
    if os.path.exists(CACHE):
        return pd.read_parquet(CACHE)
    import nfl_data_py as nfl
    cols = ["game_id", "season", "week", "season_type", "posteam", "defteam", "epa", "success",
            "yards_gained", "interception", "fumble_lost", "pass", "rush"]
    out = []
    for yr in YEARS:
        p = nfl.import_pbp_data([yr], columns=cols, downcast=True, cache=False)
        p = p[(p.season_type == "REG") & p.posteam.notna()
              & (p["pass"].fillna(0) + p["rush"].fillna(0) > 0)]
        out.append(p.groupby(["game_id", "season", "week", "posteam", "defteam"], as_index=False)
                    .agg(epa=("epa", "mean"), succ=("success", "mean"),
                         yds=("yards_gained", "sum"), plays=("epa", "size"),
                         ints=("interception", "sum"), fum=("fumble_lost", "sum")))
    t = pd.concat(out, ignore_index=True)
    t["to"] = t.ints.fillna(0) + t.fum.fillna(0)
    t.to_parquet(CACHE, index=False)
    return t


def games():
    """One row per TEAM-game with the score-free differentials, the result, and both lines."""
    t = team_box().rename(columns={"posteam": "team", "defteam": "opp"})
    o = t.rename(columns={"team": "opp", "opp": "team", "epa": "o_epa", "succ": "o_succ",
                          "yds": "o_yds", "to": "o_to"})[
        ["game_id", "team", "opp", "o_epa", "o_succ", "o_yds", "o_to"]]
    t = t.merge(o, on=["game_id", "team", "opp"], how="inner")
    t["sr_diff"] = t.succ - t.o_succ
    t["epa_diff"] = t.epa - t.o_epa
    t["to_margin"] = t.o_to - t.to                  # + = this team won the turnover battle
    t["yds_diff"] = (t.yds - t.o_yds) / 100.0

    g = pd.read_parquet("data/games_enriched.parquet")
    g = g[(g.game_type == "REG") & g.home_score.notna() & g.spread_line.notna()].copy()
    od = pd.read_parquet("data/odds_consensus.parquet")[
        ["season", "home_ab", "away_ab", "open_spread"]].rename(
        columns={"home_ab": "home_team", "away_ab": "away_team"})
    for c in ("home_team", "away_team"):
        od[c] = od[c].replace({"LA": "LAR"})
    g = g.merge(od, on=["season", "home_team", "away_team"], how="left")

    rows = []
    for home in (True, False):
        s = 1 if home else -1
        rows.append(pd.DataFrame(dict(
            game_id=g.game_id, season=g.season, week=g.week,
            team=g.home_team if home else g.away_team,
            margin=(g.home_score - g.away_score) * s,
            # nflverse spread_line is positive when HOME is favoured, so team points laid is
            # +spread_line for home. odds_consensus.open_spread uses the OPPOSITE convention
            # (corr with spread_line is -0.93), so it is negated here. Getting this wrong reads
            # as a 57% home cover rate vs the opener and inverts every opener-graded result —
            # it did, until the oracle below was extended to the opener.
            lay_close=g.spread_line * s,
            lay_open=(-g.open_spread) * s)))
    r = pd.concat(rows, ignore_index=True)
    d = t.merge(r, on=["game_id", "season", "week", "team"], how="inner")
    d["won"] = (d.margin > 0).astype(int)
    d["cover_close"] = np.sign(d.margin - d.lay_close)
    d["cover_open"] = np.sign(d.margin - d.lay_open)
    # ORACLE: betting the realised side must win 100%, on BOTH lines. Checking only the close
    # is what let an inverted opener through.
    for c in ("close", "open"):
        o2 = d[d[f"cover_{c}"].notna() & (d[f"cover_{c}"] != 0)]
        assert (np.sign(o2.margin - o2[f"lay_{c}"]) == o2[f"cover_{c}"]).all(), c
        # and a sanity floor: favourites cover near half, never 57%
        fav = o2[o2[f"lay_{c}"] > 0]
        r = (fav[f"cover_{c}"] > 0).mean()
        assert 0.44 < r < 0.56, f"{c}: favourites cover {r:.1%} — sign convention is wrong"
    return d.sort_values(["team", "season", "week"])


X = ["sr_diff", "epa_diff", "to_margin", "yds_diff"]


def add_we(d):
    """Score-free win expectancy, probit, walk-forward by season."""
    from scipy.optimize import minimize
    d = d.dropna(subset=X + ["won"]).copy()
    d["we"] = np.nan
    d["K"] = np.nan
    for s in sorted(d.season.unique()):
        prior = d[d.season < s]
        if len(prior) < 600:
            continue
        A = np.c_[np.ones(len(prior)), prior[X].values]
        y = prior.won.values

        def nll(b):
            p = np.clip(norm.cdf(A @ b), 1e-6, 1 - 1e-6)
            return -(y * np.log(p) + (1 - y) * np.log(1 - p)).sum()

        beta = minimize(nll, np.zeros(A.shape[1]), method="BFGS").x
        m = d.season == s
        B = np.c_[np.ones(int(m.sum())), d.loc[m, X].values]
        d.loc[m, "we"] = norm.cdf(B @ beta)
        # K converts a win expectancy into a deserved margin, same shape as CFB's 10.2
        pw = np.clip(norm.cdf(A @ beta), .001, .999)
        d.loc[m, "K"] = np.polyfit(norm.ppf(pw), prior.margin.values, 1)[0]
    d = d[d.we.notna()].copy()
    d["deserved"] = d.K * norm.ppf(np.clip(d.we, .001, .999))
    # how much MORE it covered by than it deserved to
    d["cover_gap_close"] = (d.margin - d.lay_close) - (d.deserved - d.lay_close)
    return d


def add_next(d, line="open"):
    """Attach the team's NEXT game in the same season — what the fade actually bets."""
    d = d.sort_values(["team", "season", "week"]).copy()
    g = d.groupby(["team", "season"])
    d["next_cover"] = g[f"cover_{line}"].shift(-1)
    d["next_week"] = g.week.shift(-1)
    return d


def fade(name, s):
    s = s[s.next_cover.notna() & (s.next_cover != 0)]
    if len(s) < 40:
        print(f"  {name:50s} n={len(s):4d}  (too few)"); return
    w = int((s.next_cover < 0).sum())            # fade = the team FAILS to cover next game
    n = len(s)
    roi = 100 * ((w * (100 / 110) - (n - w)) / n)
    by = s.assign(w=s.next_cover < 0).groupby("season").w.mean()
    print(f"  {name:50s} n={n:4d}  {w}-{n-w}  {100*w/n:5.1f}%  roi {roi:+6.1f}%  "
          f"p={binomtest(w,n,0.5).pvalue:.3f}  {int((by>=.524).sum())}/{len(by)} szn")


if __name__ == "__main__":
    d = add_we(games())
    print(f"team-games {len(d)} | seasons {d.season.min()}-{d.season.max()} | "
          f"win-expectancy AUC-ish: mean WE for winners {d[d.won==1].we.mean():.3f} "
          f"vs losers {d[d.won==0].we.mean():.3f} | K {d.K.mean():.1f}")

    for line in ("open", "close"):
        d = add_next(d, line)
        print(f"\n{'='*100}\nNEXT GAME ATS vs the {line.upper()}\n{'='*100}")
        won = d.won == 1
        dl = won & (d.we <= .50) & (d.cover_close > 0) & (d.cover_gap_close >= 4)
        lw = won & (d.we <= .40) & ~dl
        print("-- the two CFB rules, ported --")
        fade("DOUBLE LUCK: won undeserved AND stole the cover", d[dl])
        fade("LUCKY WIN: won with WE <= .40 (no double luck)", d[lw])
        print("-- components alone (CFB: each ~52%, the interaction is the signal) --")
        fade("  won with WE <= .50 (any cover result)", d[won & (d.we <= .50)])
        fade("  stole the cover by 4+ (any WE)", d[won & (d.cover_close > 0) & (d.cover_gap_close >= 4)])
        print("-- controls --")
        fade("  won DESERVEDLY (WE >= .60) — fade anyway", d[won & (d.we >= .60)])
        fade("  every winner — fade next game", d[won])
        fade("  every team — fade next game", d)

# =================================================================================================
# VERDICT (2026-09-23). The port does not replicate cleanly, and the data cannot settle it.
#
# THE WIN-EXPECTANCY MODEL IS FINE. Score-free probit on success-rate / EPA / turnover / yards
# differentials separates cleanly: winners average WE .842, losers .157. K = 6.1 points per probit
# unit (CFB's is 10.2 — NFL margins are tighter, as expected). This part is reusable.
#
# THE FADE, graded vs the OPENER — the correct line for this signal, since the trigger is known the
# moment the previous game ends. Opener history is 2023-25 ONLY (odds_consensus and
# nfl_historical_odds both start in 2023), so this is three seasons:
#     DOUBLE LUCK (CFB's rule, ported)      57.8%  (26-19, n=45, p=.371, 3/3 seasons)
#     won with WE <= .50, any cover result  58.5%  (48-34, n=82, p=.151, 2/3 seasons)
#     stole the cover by 4+, any WE         47.8%  (n=184)
#     baseline: fade ANY winner             48.1%  (n=702)   fade ANY team 50.0% (n=1418)
#
# THE SAME RULES vs the CLOSE — the wrong line for this signal, but eight seasons of it:
#     DOUBLE LUCK   52.9% (n=102, 3/8 seasons)      won with WE <= .50   50.9% (n=220, 4/8)
#
# TWO REASONS NOT TO SHIP IT:
#   * The encouraging cells are three seasons and 45-82 games at p > .15. The eight-season panel of
#     the same rules is flat. That is "not enough data", not "an edge".
#   * THE SHAPE IS DIFFERENT FROM CFB. There the interaction carried it — each component alone was
#     ~52% and the double-luck combination was 60.7%. Here the "stole the cover" leg is NEGATIVE
#     (47.8%) and the undeserved-win leg alone is the whole thing. A port whose mechanism does not
#     survive the port is a different claim wearing the same name, and it deserves its own
#     pre-registered test rather than inheriting CFB's evidence.
#
# WHAT WOULD SETTLE IT: opener seasons. Everything before 2023 is missing everywhere we look, so
# the honest path is to re-run this as 2026 and 2027 openers accumulate, against the frozen rule
# "won with WE <= .50 -> fade next game vs the opener". Nothing here gets wired today.
#
# ONE BUG WORTH REMEMBERING: odds_consensus.open_spread is HOME-PERSPECTIVE (negative = home
# favoured), the OPPOSITE of nflverse spread_line. This file first assumed they matched, which read
# as a 57% home cover rate vs the opener and inverted every opener-graded row. The rest of the repo
# has it right (dose_response.py does `actual_margin + open_spread`); the oracle now checks both
# lines and asserts favourites cover near half, which is what caught it.
# =================================================================================================
