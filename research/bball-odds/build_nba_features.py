#!/usr/bin/env python3
"""NBA model feature store — leak-safe, opponent-adjusted, all markets.

This is the layer that never got built. The earlier NBA work (regression_study.py)
screened mean-reversion features ONE AT A TIME as bet triggers, found ~50% on all
of them, and stopped. That test can only see marginal information; every edge this
program has actually found (S1, S7, S8) lives in a CONJUNCTION. So the features go
in a model instead.

Everything here is strictly prior-only. The two things that silently manufacture a
fake edge are (a) using a stat that includes the game being predicted and (b) using
a season-long percentile computed over the whole season. Both are avoided: rolling
stats are shift(1)-then-expand, and the opponent adjustment is refit per DATE using
only games already played.

Groups produced (per team, then widened to h_/a_ per game):
  base_*    four factors, pace, efficiency — s2d / l3 / l5 / l10, home-away splits
  adj_*     OPPONENT-ADJUSTED net/off/def power ratings (ridge on team dummies,
            refit each date on prior games only) — the piece raw box stats cannot
            give you, because a hot team may just have played bad defences
  form_*    l5 minus s2d for margin/efficiency/3P — the "regression" features that
            failed univariately. They stay, because a GBM can condition them
  strk_*    ATS / OU / 1H-cover / 1H-OU / win streaks (public info, priced alone)
  sched_*   rest days, b2b, 3-in-4, games in last 7, road-trip length
  abs_*     tiered absences from build_nba_absence.py (fresh vs stale, ppg removed)
  shape_*   roster concentration — minutes HHI, top-player minute share, star
            dependence. Lineup shape moved margin models in the CBB lab more than
            any other group, and NBA has no equivalent yet
  half_*    the team's own prior 1H SHARE of scoring and margin. This is the
            feature the derivative markets need and nothing else supplies: the
            book sets 1H = 0.573x the full-game number for every team alike
  mkt_*     open / T-24 / T-4 / T-60 lines and the movement between them

Outputs data/parquet/nba_model_features.parquet at GAME level with targets.
"""
import glob
import os

import numpy as np
import pandas as pd

from name_maps import norm

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "data", "parquet")

WINDOWS = (3, 5, 10)


# --------------------------------------------------------------------------- #
# 1. team-game panel
# --------------------------------------------------------------------------- #
def team_game_panel():
    """One row per team-game with box, advanced and quarter detail."""
    pb = pd.read_parquet(f"{OUT}/bdl_player_box.parquet").drop_duplicates(
        ["game.id", "player.id"])
    pb["min"] = pd.to_numeric(pb["min"], errors="coerce").fillna(0)
    played = pb[pb["min"] > 0].copy()

    agg = played.groupby(["game.id", "team.id"]).agg(
        pts=("pts", "sum"), fgm=("fgm", "sum"), fga=("fga", "sum"),
        fg3m=("fg3m", "sum"), fg3a=("fg3a", "sum"), ftm=("ftm", "sum"),
        fta=("fta", "sum"), oreb=("oreb", "sum"), dreb=("dreb", "sum"),
        ast=("ast", "sum"), stl=("stl", "sum"), blk=("blk", "sum"),
        tov=("turnover", "sum"), pf=("pf", "sum"), mins=("min", "sum"),
        n_played=("player.id", "size")).reset_index()

    # roster shape: how concentrated are minutes and points?
    def hhi(s):
        t = s.sum()
        return float(((s / t) ** 2).sum()) if t > 0 else np.nan

    shape = played.groupby(["game.id", "team.id"]).agg(
        min_hhi=("min", hhi), pts_hhi=("pts", hhi),
        top_min_share=("min", lambda s: s.max() / s.sum() if s.sum() > 0 else np.nan),
        top_pts_share=("pts", lambda s: s.max() / s.sum() if s.sum() > 0 else np.nan),
    ).reset_index()

    meta = pb.drop_duplicates("game.id")[[
        "game.id", "game.season", "game.date", "game.home_team_id",
        "game.visitor_team_id", "game.home_team_score", "game.visitor_team_score",
        "game.home_q1", "game.home_q2", "game.home_q3", "game.home_q4",
        "game.visitor_q1", "game.visitor_q2", "game.visitor_q3", "game.visitor_q4",
        "game.postseason"]].copy()
    meta["date"] = pd.to_datetime(meta["game.date"])

    # advanced: minutes-weighted team aggregates
    adv = pd.read_parquet(f"{OUT}/bdl_player_advanced.parquet").drop_duplicates(
        ["game.id", "player.id"])
    adv = adv.merge(played[["game.id", "player.id", "min"]], on=["game.id", "player.id"],
                    how="inner")
    advcols = ["pace", "offensive_rating", "defensive_rating", "net_rating",
               "true_shooting_percentage", "effective_field_goal_percentage",
               "usage_percentage", "assist_percentage", "turnover_ratio",
               "offensive_rebound_percentage", "defensive_rebound_percentage", "pie"]
    for c in advcols:
        adv[c] = pd.to_numeric(adv[c], errors="coerce")
    adv["w"] = adv["min"]
    rows = []
    for c in advcols:
        num = (adv[c] * adv["w"]).groupby([adv["game.id"], adv["team.id"]]).sum()
        den = adv["w"].where(adv[c].notna()).groupby(
            [adv["game.id"], adv["team.id"]]).sum()
        rows.append((num / den).rename(f"adv_{c}"))
    A = pd.concat(rows, axis=1).reset_index()
    # usage concentration among rotation players = star dependence proxy
    rot = adv[adv["min"] >= 15]
    A = A.merge(rot.groupby(["game.id", "team.id"]).agg(
        adv_usg_max=("usage_percentage", "max"),
        adv_usg_std=("usage_percentage", "std"),
        adv_rot_n=("player.id", "size")).reset_index(),
        on=["game.id", "team.id"], how="left")

    T = agg.merge(shape, on=["game.id", "team.id"]).merge(
        A, on=["game.id", "team.id"], how="left").merge(
        meta, on="game.id", how="left")
    T["is_home"] = T["team.id"] == T["game.home_team_id"]
    T["opp_id"] = np.where(T["is_home"], T["game.visitor_team_id"], T["game.home_team_id"])
    T["own_score"] = np.where(T["is_home"], T["game.home_team_score"],
                              T["game.visitor_team_score"])
    T["opp_score"] = np.where(T["is_home"], T["game.visitor_team_score"],
                              T["game.home_team_score"])
    for q in (1, 2, 3, 4):
        T[f"own_q{q}"] = np.where(T["is_home"], T[f"game.home_q{q}"], T[f"game.visitor_q{q}"])
        T[f"opp_q{q}"] = np.where(T["is_home"], T[f"game.visitor_q{q}"], T[f"game.home_q{q}"])
    T["own_h1"] = T["own_q1"] + T["own_q2"]
    T["opp_h1"] = T["opp_q1"] + T["opp_q2"]
    T["margin"] = T["own_score"] - T["opp_score"]
    T["total"] = T["own_score"] + T["opp_score"]
    T["h1_margin"] = T["own_h1"] - T["opp_h1"]
    T["h1_total"] = T["own_h1"] + T["opp_h1"]
    # the derivative-market targets: what SHARE of the game landed in the first half
    T["h1_tot_share"] = T["h1_total"] / T["total"].replace(0, np.nan)
    T["h1_marg_share"] = np.where(T["margin"].abs() > 0, T["h1_margin"] / T["margin"], np.nan)

    # four factors + possessions
    T["poss"] = T["fga"] - T["oreb"] + T["tov"] + 0.44 * T["fta"]
    T["ortg"] = 100 * T["own_score"] / T["poss"].replace(0, np.nan)
    T["efg"] = (T["fgm"] + 0.5 * T["fg3m"]) / T["fga"].replace(0, np.nan)
    T["tov_rate"] = T["tov"] / T["poss"].replace(0, np.nan)
    T["ftr"] = T["fta"] / T["fga"].replace(0, np.nan)
    T["p3_rate"] = T["fg3a"] / T["fga"].replace(0, np.nan)
    T["p3_pct"] = T["fg3m"] / T["fg3a"].replace(0, np.nan)
    T["ft_pct"] = T["ftm"] / T["fta"].replace(0, np.nan)
    T["season"] = T["game.season"]
    T = T.sort_values(["team.id", "date"]).reset_index(drop=True)
    T["team_key"] = T["team.id"].astype(str) + "_" + T["season"].astype(str)
    T["gidx"] = T.groupby("team_key").cumcount()
    return T


# --------------------------------------------------------------------------- #
# 2. opponent-adjusted ratings, refit per date on prior games only
# --------------------------------------------------------------------------- #
def adjusted_ratings(T, alpha=25.0):
    """Ridge on team dummies -> leak-safe adjusted net/off/def per team-date.

    For every date in a season we fit on that season's games played BEFORE that
    date, so a team's rating on game N uses exactly games 1..N-1. Ridge (not OLS)
    because early in a season the design matrix is rank-deficient — alpha shrinks
    unplayed matchups toward league average instead of exploding.
    """
    games = T[T["is_home"]].copy()  # one row per game, home perspective
    games = games[["game.id", "season", "date", "team.id", "opp_id",
                   "margin", "total", "own_score", "opp_score"]].rename(
        columns={"team.id": "h_id", "opp_id": "a_id"})
    out = []
    for season, gs in games.groupby("season"):
        gs = gs.sort_values("date")
        teams = sorted(set(gs["h_id"]) | set(gs["a_id"]))
        tix = {t: i for i, t in enumerate(teams)}
        nt = len(teams)
        dates = sorted(gs["date"].unique())
        for d in dates:
            prior = gs[gs["date"] < d]
            if len(prior) < nt:                      # too little to fit anything
                continue
            n = len(prior)
            hi = prior["h_id"].map(tix).values
            ai = prior["a_id"].map(tix).values
            # margin model: margin = net_h - net_a + hca
            X = np.zeros((n, nt + 1))
            X[np.arange(n), hi] = 1.0
            X[np.arange(n), ai] = -1.0
            X[:, nt] = 1.0
            P = X.T @ X + alpha * np.eye(nt + 1)
            P[nt, nt] -= alpha                       # do not shrink the intercept
            net = np.linalg.solve(P, X.T @ prior["margin"].values)
            # scoring model: points_scored = league level + off_scorer + def_conceder + hca
            #
            # The GLOBAL INTERCEPT (column 2*nt) is load-bearing and used to be missing: it
            # was set on the home-scored rows only, so every row's ~114-point base level had
            # to be carried by the penalised off/def coefficients, and alpha flattened them
            # against it. Symptom was arithmetic: adj_off + adj_def averaged 65.5 where a team
            # scores ~114, and the ratings correlated -0.015 / +0.001 with the closing total,
            # i.e. they contained nothing. Repaired they hit +0.38 / +0.49, and the two teams'
            # scoring environments summed correlate +0.64 with the closing total.
            # The margin ridge above never had the bug because margin is centred near zero.
            # See NBA_ADJ_RATINGS_FIX.md.
            K = 2 * nt + 2
            Xo = np.zeros((2 * n, K))
            y = np.concatenate([prior["own_score"].values, prior["opp_score"].values])
            r = np.arange(n)
            Xo[r, hi] = 1.0                          # home offence
            Xo[r, nt + ai] = 1.0                     # away defence
            Xo[n + r, ai] = 1.0                      # away offence
            Xo[n + r, nt + hi] = 1.0                 # home defence
            Xo[:, 2 * nt] = 1.0                      # league scoring level, EVERY row
            Xo[r, 2 * nt + 1] = 1.0                  # home-court scoring bump, home rows only
            Po = Xo.T @ Xo + alpha * np.eye(K)
            Po[2 * nt, 2 * nt] -= alpha              # do not shrink the level
            Po[2 * nt + 1, 2 * nt + 1] -= alpha      # do not shrink the home bump
            od = np.linalg.solve(Po, Xo.T @ y)
            lvl = od[2 * nt]
            for t, i in tix.items():
                # reported in real points and centred on the league level, so adj_off reads as
                # "points this team scores against an average defence"
                out.append((season, d, t, net[i], lvl + od[i], lvl + od[nt + i], net[nt]))
    R = pd.DataFrame(out, columns=["season", "date", "team.id", "adj_net", "adj_off",
                                   "adj_def", "adj_hca"])
    R["adj_tempo_pts"] = R["adj_off"] + R["adj_def"]   # team's own scoring environment
    return R


# --------------------------------------------------------------------------- #
# 3. rolling / prior-only team features
# --------------------------------------------------------------------------- #
ROLL_COLS = ["margin", "total", "own_score", "opp_score", "ortg", "efg", "tov_rate",
             "ftr", "p3_rate", "p3_pct", "ft_pct", "poss", "oreb", "dreb", "ast",
             "adv_pace", "adv_offensive_rating", "adv_defensive_rating",
             "adv_true_shooting_percentage", "adv_usage_percentage",
             "adv_usg_max", "adv_rot_n", "min_hhi", "pts_hhi", "top_min_share",
             "h1_total", "h1_margin", "h1_tot_share", "h1_marg_share",
             "own_h1", "opp_h1", "own_q1", "own_q4"]


def rolling_features(T):
    g = T.groupby("team_key")
    F = T[["game.id", "team.id", "team_key", "season", "date", "gidx", "is_home",
           "opp_id"]].copy()
    for c in ROLL_COLS:
        s = T[c].astype(float)
        prev = s.groupby(T["team_key"]).shift(1)
        F[f"s2d_{c}"] = prev.groupby(T["team_key"]).expanding().mean() \
            .reset_index(level=0, drop=True)
        for w in WINDOWS:
            F[f"l{w}_{c}"] = prev.groupby(T["team_key"]).rolling(w, min_periods=2) \
                .mean().reset_index(level=0, drop=True)
        F[f"sd_{c}"] = prev.groupby(T["team_key"]).expanding().std() \
            .reset_index(level=0, drop=True)
    # form = recent minus baseline (the features that failed univariately)
    for c in ("margin", "ortg", "p3_pct", "adv_pace", "total", "h1_tot_share"):
        F[f"form_{c}"] = F[f"l5_{c}"] - F[f"s2d_{c}"]
        F[f"form3_{c}"] = F[f"l3_{c}"] - F[f"s2d_{c}"]
    # home/away split baselines
    for side, flag in (("home", True), ("away", False)):
        m = T["is_home"] == flag
        for c in ("margin", "total", "ortg", "h1_tot_share"):
            v = T[c].where(m)
            prev = v.groupby(T["team_key"]).shift(1)
            F[f"{side}_{c}"] = prev.groupby(T["team_key"]).expanding().mean() \
                .reset_index(level=0, drop=True)
    F["gp"] = F["gidx"]
    return F


def streak_features(T, G):
    """ATS / OU / 1H streaks — public info, deliberately included so the model can
    learn WHEN the public record matters rather than assuming it never does."""
    m = G[["event_id", "bdl_id", "t60_spread_home_point", "t60_total_point",
           "h1_spread", "h1_total_line"]].dropna(subset=["bdl_id"])
    x = T.merge(m, left_on="game.id", right_on="bdl_id", how="left")
    own_sp = np.where(x["is_home"], x["t60_spread_home_point"], -x["t60_spread_home_point"])
    x["ats"] = np.sign(x["margin"] + own_sp)
    x["ou"] = np.sign(x["total"] - x["t60_total_point"])
    own_h1sp = np.where(x["is_home"], x["h1_spread"], -x["h1_spread"])
    x["h1ats"] = np.sign(x["h1_margin"] + own_h1sp)
    x["h1ou"] = np.sign(x["h1_total"] - x["h1_total_line"])
    x["win"] = np.sign(x["margin"])
    S = x[["game.id", "team.id"]].copy()
    for c in ("ats", "ou", "h1ats", "h1ou", "win"):
        v = pd.to_numeric(x[c], errors="coerce").replace(0, np.nan)
        prev = v.groupby(x["team_key"]).shift(1)
        S[f"strk_{c}_pct"] = prev.groupby(x["team_key"]).expanding().mean() \
            .reset_index(level=0, drop=True)
        S[f"strk_{c}_l5"] = prev.groupby(x["team_key"]).rolling(5, min_periods=2) \
            .mean().reset_index(level=0, drop=True)

        def run(s):
            out, c_ = [], 0.0
            for v_ in s:
                if pd.isna(v_):
                    out.append(c_)
                    continue
                c_ = c_ + v_ if (c_ == 0 or np.sign(c_) == v_) else v_
                out.append(c_)
            return pd.Series(out, index=s.index)

        S[f"strk_{c}_run"] = prev.groupby(x["team_key"]).apply(run) \
            .reset_index(level=0, drop=True)
    return S


def schedule_features(T):
    S = T[["game.id", "team.id", "team_key", "date"]].copy()
    d = T.groupby("team_key")["date"]
    S["sched_rest"] = (T["date"] - d.shift(1)).dt.days
    S["sched_b2b"] = (S["sched_rest"] == 1).astype(float)
    S["sched_rest2"] = (T["date"] - d.shift(2)).dt.days
    S["sched_3in4"] = (S["sched_rest2"] <= 3).astype(float)
    S["sched_g_last7"] = T.groupby("team_key")["date"].transform(
        lambda s: s.shift(1).apply(lambda _: np.nan))  # placeholder, filled below
    cnt = []
    for _, grp in T.groupby("team_key"):
        dd = grp["date"].values
        cnt.append(pd.Series([(dd[:i] > dd[i] - np.timedelta64(7, "D")).sum()
                              for i in range(len(dd))], index=grp.index))
    S["sched_g_last7"] = pd.concat(cnt).sort_index()
    # consecutive road games
    road = []
    for _, grp in T.sort_values(["team_key", "date"]).groupby("team_key"):
        run, vals = 0, []
        for h in grp["is_home"].shift(1).fillna(True):
            run = 0 if h else run + 1
            vals.append(run)
        road.append(pd.Series(vals, index=grp.index))
    S["sched_road_run"] = pd.concat(road).sort_index()
    S["sched_rest"] = S["sched_rest"].clip(upper=10)
    return S.drop(columns=["team_key", "date"])


# --------------------------------------------------------------------------- #
# 4. assemble to game level
# --------------------------------------------------------------------------- #
def drop_phantom_events(G):
    """The Odds API lists ~46 real games TWICE, ten minutes apart in commence_time.

    Both listings carry the same two teams on the same date, but only one carries the
    real market: for Nuggets-Knicks on 2022-11-16 the good listing says the home team is
    -9.25 and the phantom says -2.5. Left in, each phantom (a) fans the game out to eight
    rows through the two home/away merges downstream and (b) hands half of those rows a
    line that was never offered, which then propagates into y_*_resid for every market.

    The tell is the clock. Real NBA tips land on :10 and :40 past the hour (4,306 of 5,368
    events); the phantoms sit on the rounded :00 and :30 and carry ~24 of 32 snapshot
    fields against ~30 for a real one. So rank on snapshot coverage first and use the
    tipoff grid as the tie-break, rather than trusting either signal alone.
    """
    snap = [c for c in G.columns if c.startswith(("open_", "t24_", "t4_", "t60_"))]
    G = G.assign(
        _cov=G[snap].notna().sum(axis=1),
        _grid=G["date"].dt.minute.isin((10, 40)).astype(int),
    ).sort_values(["_cov", "_grid", "event_id"], ascending=[False, False, True])
    n = len(G)
    G = G.drop_duplicates(["hk", "dkey"], keep="first")
    if n - len(G):
        print(f"[market] dropped {n - len(G)} phantom duplicate odds listings")
    return G.drop(columns=["_cov", "_grid"]).sort_index()


def market_frame():
    """Odds side: 4 seasons FG (open/T24/T4/T60) + 3 seasons 1H/TT at the close."""
    mg = pd.read_parquet(f"{OUT}/movement_games_nba.parquet")
    g = pd.read_parquet(f"{OUT}/games_nba.parquet")[
        ["event_id", "home_h1", "away_h1", "espn_id"]]
    G = mg.merge(g, on="event_id", how="left", suffixes=("", "_g"))
    from movement_study import am_to_dec
    h = pd.concat([pd.read_parquet(p) for p in
                   sorted(glob.glob(f"{OUT}/h1tt_nba_*.parquet"))], ignore_index=True)
    for c in ("h1_spread_home_price", "h1_spread_away_price", "h1_total_over_price",
              "h1_total_under_price", "tt_home_over_price", "tt_home_under_price",
              "tt_away_over_price", "tt_away_under_price", "h1_ml_home_price",
              "h1_ml_away_price"):
        h[c] = am_to_dec(h[c])
    cons = h.groupby("event_id").agg(
        h1_spread=("h1_spread_home_point", "median"),
        h1_sp_h=("h1_spread_home_price", "median"),
        h1_sp_a=("h1_spread_away_price", "median"),
        h1_total_line=("h1_total_point", "median"),
        h1_ov=("h1_total_over_price", "median"), h1_un=("h1_total_under_price", "median"),
        tt_h=("tt_home_point", "median"), tt_h_o=("tt_home_over_price", "median"),
        tt_h_u=("tt_home_under_price", "median"),
        tt_a=("tt_away_point", "median"), tt_a_o=("tt_away_over_price", "median"),
        tt_a_u=("tt_away_under_price", "median")).reset_index()
    G = G.merge(cons, on="event_id", how="left")
    G["date"] = pd.to_datetime(G["commence_time"]).dt.tz_localize(None)

    bg = pd.read_parquet(f"{OUT}/bdl_games.parquet").drop_duplicates("id")
    bg["dkey"] = pd.to_datetime(bg["date"]).dt.strftime("%Y-%m-%d")
    bg["hk"] = bg["home_team.full_name"].map(norm)
    G["hk"] = G["home_team"].map(norm)
    G["dkey"] = (G["date"] - pd.Timedelta(hours=5)).dt.strftime("%Y-%m-%d")
    # must run BEFORE the bdl join — the join key is (home team, date), so a phantom
    # listing matches the same bdl game and doubles it
    G = drop_phantom_events(G)
    G = G.merge(bg[["hk", "dkey", "id", "home_team.id", "visitor_team.id"]],
                on=["hk", "dkey"], how="left").rename(
        columns={"id": "bdl_id", "home_team.id": "h_tid", "visitor_team.id": "a_tid"})
    assert G["bdl_id"].dropna().is_unique, "a bdl game still maps to more than one odds event"
    # movement features
    for mk, pt in (("spread", "spread_home_point"), ("total", "total_point")):
        G[f"mkt_{mk}_move_open_t60"] = G[f"t60_{pt}"] - G[f"open_{pt}"]
        G[f"mkt_{mk}_move_t4_t60"] = G[f"t60_{pt}"] - G[f"t4_{pt}"]
        G[f"mkt_{mk}_move_t24_t60"] = G[f"t60_{pt}"] - G[f"t24_{pt}"]
    G["mkt_h1_sp_ratio"] = G["h1_spread"] / G["t60_spread_home_point"].replace(0, np.nan)
    G["mkt_h1_tot_ratio"] = G["h1_total_line"] / G["t60_total_point"].replace(0, np.nan)
    G["mkt_tt_gap"] = G["tt_h"] - G["tt_a"]
    return G


def main():
    print("panel...", flush=True)
    T = team_game_panel()
    print(f"  {len(T):,} team-games, {T['season'].nunique()} seasons", flush=True)

    print("adjusted ratings (ridge per date)...", flush=True)
    R = adjusted_ratings(T)
    print(f"  {len(R):,} team-date ratings", flush=True)

    print("rolling...", flush=True)
    F = rolling_features(T)
    S = schedule_features(T)

    G = market_frame()
    print("streaks...", flush=True)
    STR = streak_features(T, G)

    ab = pd.read_parquet(f"{OUT}/nba_absence.parquet")
    abcols = [c for c in ab.columns if c not in
              ("team_key", "season", "date", "gidx", "team_id", "game_key")]
    ab = ab.rename(columns={"game_key": "game.id", "team_id": "team.id"})[
        ["game.id", "team.id"] + abcols]
    ab.columns = ["game.id", "team.id"] + [f"abs_{c}" for c in abcols]

    st = pd.read_parquet(f"{OUT}/style_nba.parquet")
    # s_* only, NOT pct_* — the percentiles are ranked within the whole season, so their
    # reference distribution includes future games. The s_* values they rank are the honest
    # shift(1).expanding() means, so use those directly.
    stcols = [c for c in st.columns if c.startswith("s_")]
    st = st.rename(columns={"game_key": "game.id"})
    st["team.id"] = st["team_key"].str.split("_").str[0].astype(int)
    st = st[["game.id", "team.id"] + stcols]

    X = (F.merge(R, on=["season", "date", "team.id"], how="left")
           .merge(S, on=["game.id", "team.id"], how="left")
           .merge(STR, on=["game.id", "team.id"], how="left")
           .merge(ab, on=["game.id", "team.id"], how="left")
           .merge(st, on=["game.id", "team.id"], how="left"))
    feat = [c for c in X.columns if c not in
            ("game.id", "team.id", "team_key", "season", "date", "gidx", "is_home",
             "opp_id")]

    # widen: home features, away features, and their DIFFERENCES (what a spread is)
    hx = X[X["is_home"]][["game.id"] + feat].add_prefix("h_").rename(
        columns={"h_game.id": "game.id"})
    ax = X[~X["is_home"]][["game.id"] + feat].add_prefix("a_").rename(
        columns={"a_game.id": "game.id"})
    W = hx.merge(ax, on="game.id", how="inner")
    for c in feat:
        if pd.api.types.is_numeric_dtype(W[f"h_{c}"]):
            W[f"d_{c}"] = W[f"h_{c}"] - W[f"a_{c}"]
            W[f"sum_{c}"] = W[f"h_{c}"] + W[f"a_{c}"]

    # targets from the truth side of the panel
    tg = T[T["is_home"]][["game.id", "season", "date", "own_score", "opp_score",
                          "own_h1", "opp_h1", "game.postseason"]].rename(
        columns={"own_score": "y_home_pts", "opp_score": "y_away_pts",
                 "own_h1": "y_home_h1", "opp_h1": "y_away_h1"})
    W = W.merge(tg, on="game.id", how="left")
    W["y_fg_margin"] = W["y_home_pts"] - W["y_away_pts"]
    W["y_fg_total"] = W["y_home_pts"] + W["y_away_pts"]
    W["y_h1_margin"] = W["y_home_h1"] - W["y_away_h1"]
    W["y_h1_total"] = W["y_home_h1"] + W["y_away_h1"]
    W["y_h1_tot_share"] = W["y_h1_total"] / W["y_fg_total"].replace(0, np.nan)

    M = market_frame()
    mcols = [c for c in M.columns if c.startswith(("mkt_", "open_", "t24_", "t4_", "t60_"))
             ] + ["event_id", "bdl_id", "h1_spread", "h1_total_line", "h1_sp_h", "h1_sp_a",
                  "h1_ov", "h1_un", "tt_h", "tt_a", "tt_h_o", "tt_h_u", "tt_a_o", "tt_a_u"]
    W = W.merge(M[mcols].dropna(subset=["bdl_id"]), left_on="game.id", right_on="bdl_id",
                how="left")
    W = W[W["event_id"].notna()].copy()

    # derivative residual targets — what the book's mechanical split gets wrong
    W["y_h1_marg_resid"] = W["y_h1_margin"] + W["h1_spread"]
    W["y_fg_marg_resid"] = W["y_fg_margin"] + W["t60_spread_home_point"]
    W["y_h1_tot_resid"] = W["y_h1_total"] - W["h1_total_line"]
    W["y_fg_tot_resid"] = W["y_fg_total"] - W["t60_total_point"]
    W["y_tt_h_resid"] = W["y_home_pts"] - W["tt_h"]
    W["y_tt_a_resid"] = W["y_away_pts"] - W["tt_a"]

    W.to_parquet(f"{OUT}/nba_model_features.parquet", index=False)
    nf = len([c for c in W.columns if c.startswith(("h_", "a_", "d_", "sum_", "mkt_"))])
    print(f"nba_model_features: {len(W):,} games x {nf} features "
          f"| seasons {sorted(W['season'].dropna().unique())}")
    print(f"  1H line present: {W['h1_spread'].notna().mean()*100:.1f}% | "
          f"TT present: {W['tt_h'].notna().mean()*100:.1f}%")


if __name__ == "__main__":
    main()
