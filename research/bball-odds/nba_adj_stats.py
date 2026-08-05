#!/usr/bin/env python3
"""Opponent-adjusted NBA team stats — the KenPom treatment, applied to the whole box.

WHAT WAS MISSING. `build_nba_features.adjusted_ratings()` opponent-adjusts exactly four
numbers: margin (`adj_net`), points scored and conceded (`adj_off` / `adj_def`), and their
sum. Everything else the model sees -- eFG, turnover rate, free-throw rate, offensive
rebounding, 3PA rate, 3P%, pace, usage concentration -- is a RAW rolling mean. A team whose
last ten games came against the league's worst defences reads as an elite offence and nothing
in the feature set can tell the difference. In college basketball we lean on KenPom, which is
adjusted by construction, so the gap never showed up there.

THE MODEL, one ridge per stat, identical in form to the scoring ridge:

    stat produced by team A against team B  =  league level + off_A + def_B + (home bump)

`off_A` reads as "what this team does to an average opponent" and `def_B` as "what an average
opponent does to this team", both in the stat's own units. Fitted per season per date on that
season's games played strictly BEFORE that date, so a rating on game N uses games 1..N-1 only.

WHY THIS IS ALMOST FREE. The design matrix is the SAME for every stat -- same teams, same
games, same home flags. Only the right-hand side changes. So all stats solve together as one
multi-RHS linear system instead of one system each. Adjusting nine stats costs about what
adjusting one costs.

TWO WEIGHTINGS, because they are different claims. `adj_` weights every prior game equally,
which is the honest season-to-date rating. `adjr_` applies an exponential decay with a 40-DAY
half-life, which is KenPom's recency idea and answers "who are they NOW" rather than "who have
they been". Whether recency helps is an empirical question, so both are built and both are
handed to the audit rather than one being assumed.

MEASURED RESULT, so nobody re-runs this hoping for more: opponent adjustment is close to
worthless in the NBA. Against the highest-powered target available -- forecasting the team's
own next-game value -- the adjusted rating beats BOTH unadjusted estimates on 3 of 9 stats, by
margins of +0.011 (pace), +0.003 (free-throw rate) and +0.0001 (3P%), while the plain
season-to-date mean wins the other 6. The reason is structural: 30 teams on a balanced 82-game
schedule face nearly identical average opposition, so there is very little schedule effect to
remove. College is the opposite -- a team can play two thirds of its games inside one
conference -- which is why KenPom is load-bearing there and this is not here.

THE MATCHUP QUANTITY FALLS OUT FOR FREE. Once both sides are on a common opponent-adjusted
scale, the predicted stat for home offence against away defence is just
`off_home + def_away - level`. That is the matchup net, but built from adjusted inputs instead
of the raw rolling means `nba_matchup_nets.py` uses -- which is the whole point of doing this.
"""
import importlib.util
import os
import warnings

import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "data", "parquet")
CACHE = os.path.join(OUT, "nba_adj_stats.parquet")

ALPHA = 25.0        # same shrinkage as the scoring ridge; early-season matchups are rank-deficient
HALFLIFE = 40.0     # DAYS, for the recency-weighted variant. An NBA team plays about every
                    # other day, so 40 days is roughly a 20-game half-life -- but it has to be
                    # expressed in days, because the ridge is fitted on LEAGUE games and the
                    # league plays ~7 a day. See the weighting block in fit_season().

# The stats worth adjusting: the four factors both ways, shot mix, and pace.
STATS = ["off_eff", "efg", "tov_rate", "ftr", "oreb_pct", "three_rate", "three_pct",
         "two_pct", "poss"]


def _load(name, path):
    spec = importlib.util.spec_from_file_location(name, os.path.join(ROOT, path))
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


def fit_season(gs, stats, alpha=ALPHA, halflife=None):
    """Per-date ridge for one season. Returns rows of (date, team, off_*, def_*) per stat.

    One row per GAME here, carrying both teams' values for every stat, so the stacked design
    below has the home-produced rows on top and the away-produced rows underneath.
    """
    teams = sorted(set(gs["h_id"]) | set(gs["a_id"]))
    tix = {t: i for i, t in enumerate(teams)}
    nt = len(teams)
    K = 2 * nt + 2
    out = []

    hi_all = gs["h_id"].map(tix).values
    ai_all = gs["a_id"].map(tix).values
    dates = np.sort(gs["date"].unique())
    dv = gs["date"].values

    for d in dates:
        keep = dv < d
        n = int(keep.sum())
        if n < nt:                       # too little to identify 30 offences and 30 defences
            continue
        hi, ai = hi_all[keep], ai_all[keep]

        X = np.zeros((2 * n, K))
        r = np.arange(n)
        X[r, hi] = 1.0                   # home offence produced the home rows
        X[r, nt + ai] = 1.0              # away defence conceded them
        X[n + r, ai] = 1.0               # away offence produced the away rows
        X[n + r, nt + hi] = 1.0          # home defence conceded them
        X[:, 2 * nt] = 1.0               # league level, EVERY row (see NBA_ADJ_RATINGS_FIX.md)
        X[r, 2 * nt + 1] = 1.0           # home-court bump, home rows only

        # Y is (2n x n_stats): every stat rides the same design, so they solve together.
        Y = np.empty((2 * n, len(stats)))
        for j, s in enumerate(stats):
            Y[:n, j] = gs[f"h_{s}"].values[keep]
            Y[n:, j] = gs[f"a_{s}"].values[keep]
        bad = ~np.isfinite(Y)
        if bad.any():                    # a missing stat must not poison the shared solve
            for j in range(Y.shape[1]):
                col = Y[:, j]
                col[~np.isfinite(col)] = np.nanmean(col[np.isfinite(col)]) if np.isfinite(
                    col).any() else 0.0

        if halflife is not None:
            # Recency must be measured in DAYS, not in rows. The rows here are LEAGUE games --
            # about seven per day -- so decaying by row index made a half-life of "20" mean
            # roughly three days, crushing everything older than a week to zero weight. That is
            # not recency weighting, it is throwing the season away, and it showed up as the
            # adjusted-with-recency ratings scoring half what the flat ones did.
            age_days = (d - dv[keep]) / np.timedelta64(1, "D")
            w = 0.5 ** (age_days / halflife)
            sw = np.sqrt(np.concatenate([w, w]))[:, None]
            Xw, Yw = X * sw, Y * sw
        else:
            Xw, Yw = X, Y

        P = Xw.T @ Xw + alpha * np.eye(K)
        P[2 * nt, 2 * nt] -= alpha            # never shrink the level...
        P[2 * nt + 1, 2 * nt + 1] -= alpha    # ...or the home bump, toward zero
        try:
            B = np.linalg.solve(P, Xw.T @ Yw)          # (K x n_stats)
        except np.linalg.LinAlgError:
            continue
        lvl = B[2 * nt]
        for t, i in tix.items():
            row = [d, t]
            for j in range(len(stats)):
                row.append(lvl[j] + B[i, j])           # offence, in the stat's own units
                row.append(lvl[j] + B[nt + i, j])      # defence: what an average offence gets
            out.append(row)
    return out


def build(force=False):
    """Adjusted stats per team-date, both weightings. Cached — the ridge loop is the slow part."""
    if os.path.exists(CACHE) and not force:
        R = pd.read_parquet(CACHE)
        print(f"[adj] cached {len(R):,} team-dates, {R.shape[1]} cols", flush=True)
        return R

    nets = _load("nets", "nba_matchup_nets.py")
    P = nets.team_game_box()
    P["season"] = np.where(P["date"].dt.month >= 8, P["date"].dt.year, P["date"].dt.year - 1)

    # collapse to one row per game carrying both teams, which is what the stacked design wants
    keep = ["gameId", "teamId", "opp_id", "date", "season"] + STATS
    G = P[keep].copy()
    home = G.merge(G, on="gameId", suffixes=("", "_o"))
    home = home[home["teamId"] == home["opp_id_o"]]
    # the home team is not flagged in the box, so take the first team id per game as "home".
    # It only sets which side carries the home bump; every rating is symmetric otherwise.
    home = home.sort_values(["gameId", "teamId"]).drop_duplicates("gameId")
    gs = pd.DataFrame({"date": home["date"].values, "season": home["season"].values,
                       "h_id": home["teamId"].values, "a_id": home["teamId_o"].values})
    for s in STATS:
        gs[f"h_{s}"] = pd.to_numeric(home[s], errors="coerce").values
        gs[f"a_{s}"] = pd.to_numeric(home[f"{s}_o"], errors="coerce").values

    frames = []
    for tag, hl in (("adj", None), ("adjr", HALFLIFE)):
        rows = []
        for season, g in gs.groupby("season"):
            g = g.sort_values("date")
            rows += fit_season(g, STATS, halflife=hl)
            print(f"[{tag}] season {season}: {len(rows):,} team-dates so far", flush=True)
        cols = ["date", "team.id"] + [f"{tag}_{d}_{s}" for s in STATS for d in ("off", "def")]
        frames.append(pd.DataFrame(rows, columns=cols).set_index(["date", "team.id"]))

    R = pd.concat(frames, axis=1).reset_index()
    R["date"] = pd.to_datetime(R["date"])
    R.to_parquet(CACHE, index=False)
    print(f"[adj] built {len(R):,} team-dates, {R.shape[1]} cols -> {CACHE}", flush=True)
    return R


def attach(D, tags=("adj", "adjr")):
    """Join adjusted ratings for both teams and form the matchup quantities.

    Returns (D, blocks) with blocks keyed 'aown' (each team's own adjusted levels) and 'anet'
    (the opponent-adjusted matchup nets). 'aown' is the CONTROL: if 'anet' does not beat it,
    the matchup construction earned nothing and only the adjustment did.
    """
    R = build()
    n0 = len(D)
    D = D.copy()
    D["date"] = pd.to_datetime(D["date"])
    blocks = {"aown": [], "anet": []}

    for side, idc in (("h", "hid"), ("a", "aid")):
        cols = [c for c in R.columns if c not in ("date", "team.id")]
        S = R.rename(columns={"team.id": idc, **{c: f"{side}_{c}" for c in cols}})
        D = D.merge(S, on=["date", idc], how="left")
    assert len(D) == n0, f"adjusted-rating join changed row count {n0} -> {len(D)}"

    for tag in tags:
        for s in STATS:
            ho, hd = D[f"h_{tag}_off_{s}"], D[f"h_{tag}_def_{s}"]
            ao, ad = D[f"a_{tag}_off_{s}"], D[f"a_{tag}_def_{s}"]
            # own levels: the control block
            for nm, v in ((f"{tag}_own_{s}_sum_off", ho + ao), (f"{tag}_own_{s}_sum_def", hd + ad),
                          (f"{tag}_own_{s}_d_off", ho - ao), (f"{tag}_own_{s}_d_def", hd - ad)):
                D[nm] = v
                blocks["aown"].append(nm)
            # the matchup: home offence meets away defence. Both are already on a common
            # opponent-adjusted scale, so the predicted level is off + def - level, and the
            # league level is a constant the ridge will absorb -- drop it and keep off + def.
            nh, na = ho + ad, ao + hd
            for nm, v in ((f"{tag}_net_{s}_h", nh), (f"{tag}_net_{s}_a", na),
                          (f"{tag}_net_{s}_sum", nh + na), (f"{tag}_net_{s}_d", nh - na)):
                D[nm] = v
                blocks["anet"].append(nm)

    cov = D[blocks["anet"][0]].notna().mean()
    print(f"[adj] own={len(blocks['aown'])} net={len(blocks['anet'])} "
          f"joined on {cov:.1%} of games", flush=True)
    return D, blocks


if __name__ == "__main__":
    build(force=True)
