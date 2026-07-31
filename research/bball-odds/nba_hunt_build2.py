#!/usr/bin/env python3
"""Widen the hunt frame with everything the first pass did not have.

nba_hunt_frame.parquet carries trailing RESULTS (margin, total, cover, ATS margin) and
standings, and nothing about HOW a team plays. So the first hunt could not have found a
pace, style, matchup or shooting-regression signal -- those features did not exist in it.
This builds them from bdl_player_box (complete box scores, 5,282 games, joins to the hunt
frame on bdl_id) and merges them on.

Families added, all leak-safe (every trailing window is shifted so the current game is
never in its own feature):

  box      per-100 efficiency, eFG, 3PAr, 3P%, FT%, FTr, ORB%, TOV%, and each of those
           ALLOWED, for L3 / L5 / L10 / season-to-date
  reg      SHOOTING REGRESSION -- trailing minus own season-to-date, and trailing minus
           league mean, for 3P% / opp 3P% / FT% / eFG / opp eFG. This is what "regression
           signal" actually means; the first frame only had trailing margin deltas
  style    pace, and the matchup terms that only exist as a PAIR: pace sum and gap, 3PAr
           sum, ORB% vs opponent DRB%, TOV forced vs TOV committed
  shape    quarter scoring shape -- q1 share, first-half front-load, second-half fade
  usage    minutes concentration (HHI), top-scorer share, starter minutes -- a thin roster
           and a spread-out one respond differently to rest and to pace

    python3 nba_hunt_build2.py
"""
import os
import warnings

import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")
ROOT = os.path.dirname(os.path.abspath(__file__))
PQ = os.path.join(ROOT, "data", "parquet")

WINDOWS = (3, 5, 10)


def team_game_box():
    """bdl player rows -> one row per team per game, with the opponent's row attached."""
    b = pd.read_parquet(os.path.join(PQ, "bdl_player_box.parquet"))
    b = b[b["game.postseason"] == False].copy()  # noqa: E712 -- pandas object column

    # minutes are whole minutes as strings in this feed ("37"), but the API also emits
    # "34:12" on some rows -- handle both. Unparseable means DNP, which is 0 and not NaN,
    # or the concentration measures silently drop bench players.
    mm = b["min"].astype(str).str.split(":", expand=True)
    b["mins"] = pd.to_numeric(mm[0], errors="coerce").fillna(0)
    if mm.shape[1] > 1:
        b["mins"] += pd.to_numeric(mm[1], errors="coerce").fillna(0) / 60.0

    g = b.groupby(["game.id", "team.id"], as_index=False).agg(
        date=("game.date", "first"), season=("game.season", "first"),
        fga=("fga", "sum"), fgm=("fgm", "sum"), fg3a=("fg3a", "sum"), fg3m=("fg3m", "sum"),
        fta=("fta", "sum"), ftm=("ftm", "sum"), oreb=("oreb", "sum"), dreb=("dreb", "sum"),
        tov=("turnover", "sum"), pf=("pf", "sum"), ast=("ast", "sum"), pts=("pts", "sum"),
        hid=("game.home_team_id", "first"),
        hq1=("game.home_q1", "first"), hq2=("game.home_q2", "first"),
        hq3=("game.home_q3", "first"), hq4=("game.home_q4", "first"),
        vq1=("game.visitor_q1", "first"), vq2=("game.visitor_q2", "first"),
        vq3=("game.visitor_q3", "first"), vq4=("game.visitor_q4", "first"),
    )
    g["is_home"] = (g["team.id"] == g["hid"]).astype(int)

    # minutes concentration: how much of the night runs through a few players
    def conc(x):
        m = x.to_numpy(float)
        m = m[m > 0]
        if m.sum() <= 0 or len(m) < 5:
            return pd.Series({"hhi": np.nan, "top3_min": np.nan, "n_played": np.nan})
        s = np.sort(m)[::-1] / m.sum()
        return pd.Series({"hhi": float((s ** 2).sum()), "top3_min": float(s[:3].sum()),
                          "n_played": float(len(m))})

    c = b.groupby(["game.id", "team.id"])["mins"].apply(conc).unstack().reset_index()
    p = b.groupby(["game.id", "team.id"])["pts"].apply(
        lambda x: x.max() / max(x.sum(), 1)).rename("top_scorer_share").reset_index()
    g = g.merge(c, on=["game.id", "team.id"], how="left").merge(
        p, on=["game.id", "team.id"], how="left")

    # attach the opponent's counting stats so "allowed" versions can be built
    opp = g[["game.id", "team.id", "fga", "fgm", "fg3a", "fg3m", "fta", "ftm",
             "oreb", "dreb", "tov", "pts"]].copy()
    opp.columns = ["game.id", "opp_tid"] + ["o_" + c for c in opp.columns[2:]]
    g = g.merge(opp, on="game.id")
    g = g[g["team.id"] != g["opp_tid"]].copy()

    # Possessions: the standard estimate. 0.44 is the league FTA-to-possession factor.
    g["poss"] = g["fga"] - g["oreb"] + g["tov"] + 0.44 * g["fta"]
    g["o_poss"] = g["o_fga"] - g["o_oreb"] + g["o_tov"] + 0.44 * g["o_fta"]
    g["pace"] = (g["poss"] + g["o_poss"]) / 2.0

    g["off_eff"] = 100 * g["pts"] / g["poss"].clip(lower=1)
    g["def_eff"] = 100 * g["o_pts"] / g["o_poss"].clip(lower=1)
    g["efg"] = (g["fgm"] + 0.5 * g["fg3m"]) / g["fga"].clip(lower=1)
    g["efg_alwd"] = (g["o_fgm"] + 0.5 * g["o_fg3m"]) / g["o_fga"].clip(lower=1)
    g["p3_pct"] = g["fg3m"] / g["fg3a"].clip(lower=1)
    g["p3_pct_alwd"] = g["o_fg3m"] / g["o_fg3a"].clip(lower=1)
    g["p3a_rate"] = g["fg3a"] / g["fga"].clip(lower=1)
    g["p3a_rate_alwd"] = g["o_fg3a"] / g["o_fga"].clip(lower=1)
    g["ft_pct"] = g["ftm"] / g["fta"].clip(lower=1)
    g["ftr"] = g["fta"] / g["fga"].clip(lower=1)
    g["ftr_alwd"] = g["o_fta"] / g["o_fga"].clip(lower=1)
    g["orb_pct"] = g["oreb"] / (g["oreb"] + g["o_dreb"]).clip(lower=1)
    g["drb_pct"] = g["dreb"] / (g["dreb"] + g["o_oreb"]).clip(lower=1)
    g["tov_rate"] = 100 * g["tov"] / g["poss"].clip(lower=1)
    g["tov_forced"] = 100 * g["o_tov"] / g["o_poss"].clip(lower=1)
    g["ast_rate"] = g["ast"] / g["fgm"].clip(lower=1)

    # quarter shape, from this team's point of view
    own = np.where(g["is_home"] == 1, g["hq1"], g["vq1"])
    own2 = np.where(g["is_home"] == 1, g["hq2"], g["vq2"])
    own3 = np.where(g["is_home"] == 1, g["hq3"], g["vq3"])
    own4 = np.where(g["is_home"] == 1, g["hq4"], g["vq4"])
    tot = np.maximum(own + own2 + own3 + own4, 1)
    g["q1_share"] = own / tot
    g["h1_share"] = (own + own2) / tot
    g["q4_share"] = own4 / tot
    g["date"] = pd.to_datetime(g["date"])
    return g.sort_values(["team.id", "date"]).reset_index(drop=True)


# Everything a trailing window gets built over. Kept explicit so it is obvious what the
# search is allowed to see.
RATE = ["pace", "off_eff", "def_eff", "efg", "efg_alwd", "p3_pct", "p3_pct_alwd",
        "p3a_rate", "p3a_rate_alwd", "ft_pct", "ftr", "ftr_alwd", "orb_pct", "drb_pct",
        "tov_rate", "tov_forced", "ast_rate", "hhi", "top3_min", "top_scorer_share",
        "n_played", "q1_share", "h1_share", "q4_share"]
# Shooting percentages regress hard; rates and volumes barely do. Only the first group
# gets a regression feature, because "3PAr is above its season mean" is a style fact, not
# a luck fact, and treating it as one is how the luck work went wrong the first time.
REGRESS = ["p3_pct", "p3_pct_alwd", "ft_pct", "efg", "efg_alwd"]


def trailing(g):
    """Leak-safe rolling windows: shift(1) FIRST, so a game never sees itself."""
    out = g[["game.id", "team.id", "date", "season", "is_home"]].copy()
    grp = g.groupby("team.id", sort=False)
    for c in RATE:
        prior = grp[c].shift(1)
        pg = prior.groupby(g["team.id"], sort=False)
        for w in WINDOWS:
            out[f"b_l{w}_{c}"] = pg.rolling(w, min_periods=w).mean().reset_index(level=0, drop=True)
        # season-to-date, restarted each season -- an expanding mean of prior games only
        out[f"b_s2d_{c}"] = (prior.groupby([g["team.id"], g["season"]], sort=False)
                             .expanding().mean().reset_index(level=[0, 1], drop=True))
        out[f"b_gp_{c}"] = (prior.groupby([g["team.id"], g["season"]], sort=False)
                            .expanding().count().reset_index(level=[0, 1], drop=True))

    # REGRESSION: hot/cold relative to the team's OWN season norm, and to the league's.
    # Own-baseline is the load-bearing one -- a 38% three-point team at 44% over five games
    # is a different animal from a 33% team at 39%, and the league-mean version cannot tell
    # them apart. That distinction is exactly what made S10 work.
    for c in REGRESS:
        lg = g.groupby("season")[c].transform("mean")
        for w in WINDOWS:
            out[f"r_own{w}_{c}"] = out[f"b_l{w}_{c}"] - out[f"b_s2d_{c}"]
            out[f"r_lg{w}_{c}"] = out[f"b_l{w}_{c}"] - lg
    return out


def main():
    print("building team-game box from bdl player rows ...", flush=True)
    g = team_game_box()
    print(f"  {len(g):,} team-games, {g['game.id'].nunique():,} games", flush=True)

    t = trailing(g)
    feat = [c for c in t.columns if c.startswith(("b_", "r_"))]
    print(f"  {len(feat)} per-team features", flush=True)

    home = t[t["is_home"] == 1].drop(columns=["is_home", "team.id", "date", "season"])
    away = t[t["is_home"] == 0].drop(columns=["is_home", "team.id", "date", "season"])
    home.columns = ["game.id"] + ["h" + c for c in home.columns[1:]]
    away.columns = ["game.id"] + ["a" + c for c in away.columns[1:]]
    w = home.merge(away, on="game.id")

    # Home-minus-away for everything: the spread is a difference, so the diff is usually
    # the form a signal wants.
    for c in feat:
        w["d" + c] = w["h" + c] - w["a" + c]

    # MATCHUP terms -- these only exist as a pair and are the whole reason style was worth
    # adding. A sum says "how fast/how many threes will this GAME be"; a mismatch says
    # "whose strength meets whose weakness".
    for wnd in WINDOWS:
        w[f"m_l{wnd}_pace_sum"] = w[f"hb_l{wnd}_pace"] + w[f"ab_l{wnd}_pace"]
        w[f"m_l{wnd}_pace_gap"] = (w[f"hb_l{wnd}_pace"] - w[f"ab_l{wnd}_pace"]).abs()
        w[f"m_l{wnd}_3rate_sum"] = w[f"hb_l{wnd}_p3a_rate"] + w[f"ab_l{wnd}_p3a_rate"]
        w[f"m_l{wnd}_eff_sum"] = ((w[f"hb_l{wnd}_off_eff"] - w[f"ab_l{wnd}_def_eff"])
                                  + (w[f"ab_l{wnd}_off_eff"] - w[f"hb_l{wnd}_def_eff"]))
        # shooters vs a defence that concedes threes, both directions
        w[f"m_l{wnd}_h3_vs_ad"] = w[f"hb_l{wnd}_p3a_rate"] * w[f"ab_l{wnd}_p3_pct_alwd"]
        w[f"m_l{wnd}_a3_vs_hd"] = w[f"ab_l{wnd}_p3a_rate"] * w[f"hb_l{wnd}_p3_pct_alwd"]
        # crash the glass vs a defence that lets you
        w[f"m_l{wnd}_horb_vs_adrb"] = w[f"hb_l{wnd}_orb_pct"] - (1 - w[f"ab_l{wnd}_drb_pct"])
        w[f"m_l{wnd}_aorb_vs_hdrb"] = w[f"ab_l{wnd}_orb_pct"] - (1 - w[f"hb_l{wnd}_drb_pct"])
        # turnovers are a two-sided market: who forces vs who gives it away
        w[f"m_l{wnd}_h_tov_edge"] = w[f"ab_l{wnd}_tov_forced"] - w[f"hb_l{wnd}_tov_rate"]
        w[f"m_l{wnd}_a_tov_edge"] = w[f"hb_l{wnd}_tov_forced"] - w[f"ab_l{wnd}_tov_rate"]
        w[f"m_l{wnd}_thin_sum"] = w[f"hb_l{wnd}_hhi"] + w[f"ab_l{wnd}_hhi"]

    hf = pd.read_parquet(os.path.join(PQ, "nba_hunt_frame.parquet"))
    hf["bdl_id"] = pd.to_numeric(hf["bdl_id"], errors="coerce")
    w = w.rename(columns={"game.id": "bdl_id"})
    out = hf.merge(w, on="bdl_id", how="left")

    new = [c for c in out.columns if c not in hf.columns]
    cov = out[new].notna().mean(axis=1)
    print(f"\n{len(new)} new columns; {int((cov > 0.9).sum()):,}/{len(out):,} games with "
          f">90% of them populated", flush=True)

    # A leak screen on the loudest new family: a legitimate pregame feature has to be at
    # least as correlated with the LINE as with the RESULT. If it knows the result better
    # than the market does, it saw the result.
    print("\nleak screen (|corr| with closing line vs with outcome; line must win):",
          flush=True)
    for c in ["m_l5_pace_sum", "m_l5_eff_sum", "hr_own5_p3_pct", "hb_l5_off_eff"]:
        v = out[c]
        cl = v.corr(out["t60_total_point"] if "pace" in c or "eff_sum" in c
                    else out["t60_spread_home_point"])
        rs = v.corr(out["gm_total"] if "pace" in c or "eff_sum" in c else out["margin"])
        flag = "OK" if abs(cl) >= abs(rs) else "  <-- CHECK"
        print(f"  {c:22s} line {cl:+.4f}   result {rs:+.4f}{flag}", flush=True)

    path = os.path.join(PQ, "nba_hunt_frame2.parquet")
    out.to_parquet(path, index=False)
    print(f"\n{out.shape[0]:,} games x {out.shape[1]} cols -> {path}", flush=True)


if __name__ == "__main__":
    main()
