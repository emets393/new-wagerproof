#!/usr/bin/env python3
"""Build the one-row-per-game frame for the NBA signal hunt.

Everything the hunt searches over has to be (a) knowable before tip and (b) gradeable
against the T-60 close, so this script does the joining and the as-of rolling ONCE and
writes a single frame. `nba_hunt_sweep.py` then does nothing but slice it.

Spine is movement_games_nba (open/t24/t4/t60 lines + final + 1H scores). Everything else
hangs off it:
    event_id -> games_nba.espn_id -> nba_game_crosswalk -> bdl_game_id
and bdl_games carries team ids, conference/division, postseason, NBA Cup stage, and the
quarter scores that let us detect OT (which has to be split out -- pooled over-rates
diverge badly from non-OT ones).

Leak discipline: every rolling feature is computed on a team-game log sorted by date and
shifted by one game within season, so a row never sees its own result. The line columns
are the only "future" information and they are exactly what we grade against.

Writes data/parquet/nba_hunt_frame.parquet.
"""
import os
import sys
import warnings
import numpy as np
import pandas as pd

warnings.filterwarnings("ignore", category=pd.errors.PerformanceWarning)

ROOT = os.path.dirname(os.path.abspath(__file__))
PQ = os.path.join(ROOT, "data", "parquet")


def rd(name, **kw):
    return pd.read_parquet(os.path.join(PQ, f"{name}.parquet"), **kw)


# ---------------------------------------------------------------- spine ---

def build_spine():
    mv = rd("movement_games_nba")
    gn = rd("games_nba")[["event_id", "espn_id"]]
    xw = rd("nba_game_crosswalk")[["espn_game_id", "bdl_game_id"]]

    df = mv.merge(gn, on="event_id", how="left")
    df["espn_id"] = pd.to_numeric(df["espn_id"], errors="coerce")
    xw["espn_game_id"] = pd.to_numeric(xw["espn_game_id"], errors="coerce")
    df = df.merge(xw, left_on="espn_id", right_on="espn_game_id", how="left")
    df = df.rename(columns={"bdl_game_id": "bdl_id"})

    bg = rd("bdl_games")
    ot_cols = ["home_ot1", "home_ot2", "home_ot3", "visitor_ot1", "visitor_ot2", "visitor_ot3"]
    for c in ot_cols:
        bg[c] = pd.to_numeric(bg[c], errors="coerce").fillna(0)
    bg["is_ot"] = ((bg[ot_cols].sum(axis=1) > 0) | (pd.to_numeric(bg["period"], errors="coerce") > 4)).astype(int)
    bg["is_cup"] = bg["ist_stage"].notna().astype(int)
    keep = bg[[
        "id", "date", "postseason", "is_ot", "is_cup",
        "home_team.id", "visitor_team.id",
        "home_team.conference", "visitor_team.conference",
        "home_team.division", "visitor_team.division",
        "home_q1", "home_q2", "visitor_q1", "visitor_q2",
    ]].rename(columns={
        "id": "bdl_id", "date": "game_date",
        "home_team.id": "home_tid", "visitor_team.id": "away_tid",
        "home_team.conference": "home_conf", "visitor_team.conference": "away_conf",
        "home_team.division": "home_div", "visitor_team.division": "away_div",
    })
    df = df.merge(keep, on="bdl_id", how="left")

    df["game_date"] = pd.to_datetime(df["game_date"], errors="coerce")
    ct = pd.to_datetime(df["commence_time"], errors="coerce", utc=True)
    # Fall back to the odds commence time (ET date) where the bdl join missed.
    df["game_date"] = df["game_date"].fillna(ct.dt.tz_convert("America/New_York").dt.normalize().dt.tz_localize(None))

    df["postseason"] = df["postseason"].fillna(False).astype(bool).astype(int)
    df["is_divisional"] = (df["home_div"] == df["away_div"]).astype(int)
    df["is_conference"] = (df["home_conf"] == df["away_conf"]).astype(int)

    # ---- outcomes, all from the HOME perspective ----
    df["margin"] = df["home_score"] - df["away_score"]
    df["gm_total"] = df["home_score"] + df["away_score"]
    df["h1_margin"] = df["home_h1"] - df["away_h1"]
    df["h1_total"] = df["home_h1"] + df["away_h1"]

    # Cover margin vs the T-60 close. spread_home_point is the home number, so a home
    # favourite is negative and cover means margin + point > 0.
    df["ats_margin"] = df["margin"] + df["t60_spread_home_point"]
    df["ou_margin"] = df["gm_total"] - df["t60_total_point"]
    df["home_cover"] = np.where(df["ats_margin"] > 0, 1, np.where(df["ats_margin"] < 0, 0, np.nan))
    df["over"] = np.where(df["ou_margin"] > 0, 1, np.where(df["ou_margin"] < 0, 0, np.nan))
    df["home_win"] = (df["margin"] > 0).astype(float)

    df["open_spread_move"] = df["t60_spread_home_point"] - df["open_spread_home_point"]
    df["open_total_move"] = df["t60_total_point"] - df["open_total_point"]
    df["late_spread_move"] = df["t60_spread_home_point"] - df["t4_spread_home_point"]
    df["late_total_move"] = df["t60_total_point"] - df["t4_total_point"]

    return df.sort_values("game_date").reset_index(drop=True)


# ------------------------------------------------------- first-half lines ---

def add_h1_lines(df):
    """1H + team-total closes, consensus = median across books."""
    frames = []
    for s in ["2023-24", "2024-25", "2025-26"]:
        p = os.path.join(PQ, f"h1tt_nba_{s}.parquet")
        if os.path.exists(p):
            frames.append(pd.read_parquet(p))
    if not frames:
        return df
    h = pd.concat(frames, ignore_index=True)
    num = ["h1_spread_home_point", "h1_total_point", "tt_home_point", "tt_away_point",
           "h1_ml_home_price", "h1_ml_away_price", "h1_spread_home_price", "h1_spread_away_price",
           "h1_total_over_price", "h1_total_under_price",
           "tt_home_over_price", "tt_home_under_price", "tt_away_over_price", "tt_away_under_price"]
    agg = h.groupby("event_id")[num].median().reset_index()
    agg.columns = ["event_id"] + [f"c_{c}" for c in num]
    df = df.merge(agg, on="event_id", how="left")

    df["h1_ats_margin"] = df["h1_margin"] + df["c_h1_spread_home_point"]
    df["h1_ou_margin"] = df["h1_total"] - df["c_h1_total_point"]
    df["h1_home_cover"] = np.where(df["h1_ats_margin"] > 0, 1, np.where(df["h1_ats_margin"] < 0, 0, np.nan))
    df["h1_over"] = np.where(df["h1_ou_margin"] > 0, 1, np.where(df["h1_ou_margin"] < 0, 0, np.nan))
    df["tt_home_over"] = np.where(df["home_score"] > df["c_tt_home_point"], 1,
                                  np.where(df["home_score"] < df["c_tt_home_point"], 0, np.nan))
    df["tt_away_over"] = np.where(df["away_score"] > df["c_tt_away_point"], 1,
                                  np.where(df["away_score"] < df["c_tt_away_point"], 0, np.nan))
    return df


# ------------------------------------------------------ team-game history ---

ROLL_SPECS = {
    "margin": "margin",
    "gtot": "gm_total",
    "own": "own_score",
    "opp": "opp_score",
    "atsm": "ats_margin_t",     # cover margin vs that game's own close
    "oum": "ou_margin_t",
    "cover": "covered",
    "over": "went_over",
    "win": "won",
    "h1m": "h1_margin_t",
    "h1t": "h1_total_t",
}
WINDOWS = [3, 5, 10]


def team_log(df):
    """Long frame: two rows per game, one per team, from that team's perspective."""
    home = pd.DataFrame({
        "bdl_id": df["bdl_id"], "event_id": df["event_id"], "season": df["season"],
        "game_date": df["game_date"], "tid": df["home_tid"], "is_home": 1,
        "own_score": df["home_score"], "opp_score": df["away_score"],
        "spread_t": df["t60_spread_home_point"], "total_t": df["t60_total_point"],
        "h1_own": df["home_h1"], "h1_opp": df["away_h1"],
    })
    away = pd.DataFrame({
        "bdl_id": df["bdl_id"], "event_id": df["event_id"], "season": df["season"],
        "game_date": df["game_date"], "tid": df["away_tid"], "is_home": 0,
        "own_score": df["away_score"], "opp_score": df["home_score"],
        "spread_t": -df["t60_spread_home_point"], "total_t": df["t60_total_point"],
        "h1_own": df["away_h1"], "h1_opp": df["home_h1"],
    })
    t = pd.concat([home, away], ignore_index=True)
    t["margin"] = t["own_score"] - t["opp_score"]
    t["gm_total"] = t["own_score"] + t["opp_score"]
    t["ats_margin_t"] = t["margin"] + t["spread_t"]
    t["ou_margin_t"] = t["gm_total"] - t["total_t"]
    t["covered"] = (t["ats_margin_t"] > 0).astype(float)
    t["went_over"] = (t["ou_margin_t"] > 0).astype(float)
    t["won"] = (t["margin"] > 0).astype(float)
    t["h1_margin_t"] = t["h1_own"] - t["h1_opp"]
    t["h1_total_t"] = t["h1_own"] + t["h1_opp"]
    return t.sort_values(["tid", "season", "game_date"]).reset_index(drop=True)


def _streak(vals):
    """Signed run length of the trailing outcome, computed on already-shifted values."""
    out = np.zeros(len(vals))
    run = 0
    prev = np.nan
    for i, v in enumerate(vals):
        if np.isnan(v):
            run = 0
        elif v == prev:
            run += 1
        else:
            run = 1
        out[i] = run if v == 1 else (-run if v == 0 else 0)
        prev = v
    return out


def add_form(df, t):
    g = t.groupby(["tid", "season"], sort=False)
    for name, col in ROLL_SPECS.items():
        sh = g[col].shift(1)
        tmp = pd.DataFrame({"tid": t["tid"], "season": t["season"], "v": sh})
        gg = tmp.groupby(["tid", "season"], sort=False)["v"]
        for w in WINDOWS:
            t[f"l{w}_{name}"] = gg.transform(lambda s, w=w: s.rolling(w, min_periods=w).mean())
        # season-to-date mean, so "last 3 vs own norm" is expressible
        t[f"s2d_{name}"] = gg.transform(lambda s: s.expanding(5).mean())
        t[f"d3_{name}"] = t[f"l3_{name}"] - t[f"s2d_{name}"]
        t[f"d5_{name}"] = t[f"l5_{name}"] - t[f"s2d_{name}"]

    # streaks on shifted binary outcomes
    for src, nm in [("covered", "ats"), ("went_over", "ou"), ("won", "su")]:
        sh = g[src].shift(1)
        t[f"streak_{nm}"] = (
            pd.DataFrame({"tid": t["tid"], "season": t["season"], "v": sh})
            .groupby(["tid", "season"], sort=False)["v"]
            .transform(lambda s: _streak(s.to_numpy()))
        )

    # 1H over/under streak vs the FG total's first-half share is not available pre-2023,
    # so the 1H streak uses the 1H total line only where we have it (added later).
    t["gp_prior"] = g.cumcount()
    t["rest_days"] = g["game_date"].diff().dt.days
    t["b2b"] = (t["rest_days"] == 1).astype(float)
    t["g_last7"] = (
        t.set_index("game_date").groupby(["tid", "season"], sort=False)["margin"]
        .transform(lambda s: s.shift(1).rolling("7D").count()).to_numpy()
    )

    feat_cols = [c for c in t.columns if c.startswith(("l3_", "l5_", "l10_", "s2d_", "d3_", "d5_", "streak_"))] \
        + ["gp_prior", "rest_days", "b2b", "g_last7"]

    h = t[t.is_home == 1].set_index("event_id")[feat_cols].add_prefix("h_")
    a = t[t.is_home == 0].set_index("event_id")[feat_cols].add_prefix("a_")
    df = df.merge(h, left_on="event_id", right_index=True, how="left")
    df = df.merge(a, left_on="event_id", right_index=True, how="left")
    for c in feat_cols:
        df[f"d_{c}"] = df[f"h_{c}"] - df[f"a_{c}"]
    return df


# --------------------------------------------- form measured AGAINST the line ---

def add_form_vs_line(df):
    """The family the owner asked for by name: recent form compared to the number the
    market is asking for in THIS game, not to zero and not to the other team."""
    sp = df["t60_spread_home_point"]
    tot = df["t60_total_point"]

    # margin the home team must beat to cover, in the same units as l3_margin
    need = -sp
    for w in WINDOWS:
        df[f"h_l{w}_margin_vs_need"] = df[f"h_l{w}_margin"] - need
        df[f"a_l{w}_margin_vs_need"] = df[f"a_l{w}_margin"] - (-need)
        # both teams' recent scoring environment vs the posted total
        df[f"pair_l{w}_gtot_vs_line"] = (df[f"h_l{w}_gtot"] + df[f"a_l{w}_gtot"]) / 2.0 - tot
        df[f"h_l{w}_gtot_vs_line"] = df[f"h_l{w}_gtot"] - tot
        df[f"a_l{w}_gtot_vs_line"] = df[f"a_l{w}_gtot"] - tot
        # implied margin from each side's own recent scoring, vs the line
        df[f"pair_l{w}_margin_vs_line"] = (df[f"h_l{w}_own"] - df[f"a_l{w}_opp"]) / 2.0 \
            + (df[f"a_l{w}_own"] - df[f"h_l{w}_opp"]) / -2.0 - need
    # cumulative ATS cover margin says how far recent form has run vs recent lines;
    # comparing that to the current line asks "has the market caught up yet".
    df["pair_l3_atsm"] = df["h_l3_atsm"] - df["a_l3_atsm"]
    df["pair_l5_atsm"] = df["h_l5_atsm"] - df["a_l5_atsm"]
    df["pair_l3_oum"] = (df["h_l3_oum"] + df["a_l3_oum"]) / 2.0
    df["pair_l5_oum"] = (df["h_l5_oum"] + df["a_l5_oum"]) / 2.0
    return df


# ------------------------------------------------------------------- H2H ---

def add_h2h(df):
    """'Last series with the same team' -- meeting number, gap, and what happened."""
    df = df.sort_values("game_date").reset_index(drop=True)
    key = df.apply(lambda r: tuple(sorted([r["home_tid"], r["away_tid"]]))
                   if pd.notna(r["home_tid"]) and pd.notna(r["away_tid"]) else None, axis=1)
    df["pairkey"] = key  # not _pair: itertuples renames leading-underscore columns
    out = {c: np.full(len(df), np.nan) for c in
           ["meet_n", "h2h_days", "h2h_prev_margin_h", "h2h_prev_cover_h",
            "h2h_prev_total", "h2h_prev_ou_margin", "h2h_prev_same_venue", "h2h_prev_ats_margin_h"]}
    seen = {}
    for i, r in enumerate(df.itertuples()):
        if r.pairkey is None:
            continue
        k = (r.pairkey, r.season)
        prev = seen.get(k)
        out["meet_n"][i] = 1 if prev is None else prev["n"] + 1
        if prev is not None:
            out["h2h_days"][i] = (r.game_date - prev["date"]).days
            # flip the prior result into THIS game's home-team frame
            flip = 1 if prev["home_tid"] == r.home_tid else -1
            out["h2h_prev_margin_h"][i] = prev["margin"] * flip
            out["h2h_prev_ats_margin_h"][i] = prev["ats_margin"] * flip
            out["h2h_prev_cover_h"][i] = prev["cover"] if flip == 1 else (
                1 - prev["cover"] if not np.isnan(prev["cover"]) else np.nan)
            out["h2h_prev_total"][i] = prev["total"]
            out["h2h_prev_ou_margin"][i] = prev["ou_margin"]
            out["h2h_prev_same_venue"][i] = 1.0 if prev["home_tid"] == r.home_tid else 0.0
        seen[k] = {"n": out["meet_n"][i], "date": r.game_date, "home_tid": r.home_tid,
                   "margin": r.margin, "ats_margin": r.ats_margin, "cover": r.home_cover,
                   "total": r.gm_total, "ou_margin": r.ou_margin}
    for c, v in out.items():
        df[c] = v
    return df.drop(columns=["pairkey"])


# ------------------------------------------------- ratings, standings, travel ---

def add_ratings(df):
    ar = rd("nba_adj_ratings_fixed").sort_values("date")
    ar["date"] = pd.to_datetime(ar["date"])
    # merge_asof needs an exact dtype match on `by`, and rejects float keys outright,
    # so NaN rows (bdl join misses) are dropped and both sides forced to int64.
    ar["team.id"] = ar["team.id"].astype("int64")
    cols = ["adj_net", "adj_off", "adj_def", "adj_hca", "adj_tempo_pts"]
    d = df.sort_values("game_date")
    for side, tcol in [("h", "home_tid"), ("a", "away_tid")]:
        left = d[["game_date", tcol]].rename(columns={tcol: "team.id"}).reset_index()
        left["team.id"] = pd.to_numeric(left["team.id"], errors="coerce")
        left = left[left["team.id"].notna() & left["game_date"].notna()].copy()
        left["team.id"] = left["team.id"].astype("int64")
        m = pd.merge_asof(
            left.sort_values("game_date"), ar[["date", "team.id"] + cols].sort_values("date"),
            left_on="game_date", right_on="date", by="team.id", allow_exact_matches=False,
        ).set_index("index")
        for c in cols:
            df.loc[m.index, f"{side}_{c}"] = m[c]

    # power ratings -> implied number, and the gap vs the posted line. This is the
    # "power ratings compared to the line" family.
    df["rt_imp_margin"] = (df["h_adj_net"] - df["a_adj_net"]) + df["h_adj_hca"].fillna(2.5)
    # adj_tempo_pts is ALREADY a full-game total estimate for that team's games (league
    # mean 226.7), not the points that team itself scores. Summing the two doubled it, so
    # rt_total_gap came out with a mean of +225 and every cut on it was silently a cut on
    # the posted total -- the whole "ratings vs the line" totals family read as dead when
    # it had never actually been tested. Average, do not add.
    df["rt_imp_total"] = (df["h_adj_tempo_pts"] + df["a_adj_tempo_pts"]) / 2.0
    df["rt_spread_gap"] = df["rt_imp_margin"] - (-df["t60_spread_home_point"])
    df["rt_total_gap"] = df["rt_imp_total"] - df["t60_total_point"]
    df["rt_net_diff"] = df["h_adj_net"] - df["a_adj_net"]
    # Offence/defence quality vs the posted total, independent of tempo: two efficient
    # teams and two inefficient teams can share a pace estimate and not a scoring one.
    df["rt_eff_sum"] = (df["h_adj_off"] + df["a_adj_off"]) - (df["h_adj_def"] + df["a_adj_def"])
    return df


def add_standings(df):
    st = rd("nba_standings_feats").rename(columns={"game.id": "bdl_id"})
    df = df.merge(st, on="bdl_id", how="left")
    # Lust 2018: the underdog's games-back / games-remaining RATIO carried the effect,
    # not the binary eliminated flag. Guard the denominator at 1 game left.
    gl_h = df["st_h_games_left"].clip(lower=1)
    gl_a = df["st_a_games_left"].clip(lower=1)
    df["gbr_h"] = df["st_h_gb_6"] / gl_h
    df["gbr_a"] = df["st_a_gb_6"] / gl_a
    df["gbr_d"] = df["gbr_h"] - df["gbr_a"]
    df["gbr_dog"] = np.where(df["t60_spread_home_point"] > 0, df["gbr_h"], df["gbr_a"])
    df["gbr_fav"] = np.where(df["t60_spread_home_point"] > 0, df["gbr_a"], df["gbr_h"])
    return df


def add_travel(df):
    tv = rd("nba_travel")
    cols = ["trav_km", "km_7d", "km_14d", "venues_7d", "days_since_home", "alt_m", "trav_tz"]
    h = tv[tv.is_home == 1].set_index("bdl_id")[cols].add_prefix("h_")
    a = tv[tv.is_home == 0].set_index("bdl_id")[cols].add_prefix("a_")
    df = df.merge(h, left_on="bdl_id", right_index=True, how="left")
    df = df.merge(a, left_on="bdl_id", right_index=True, how="left")
    for c in cols:
        df[f"d_{c}"] = df[f"h_{c}"] - df[f"a_{c}"]
    return df


def add_phase(df):
    gp = df[["h_gp_prior", "a_gp_prior"]].min(axis=1)
    df["min_gp"] = gp
    df["phase"] = np.select(
        [df["postseason"] == 1, gp < 15, gp < 45, gp < 66],
        ["playoffs", "early", "mid", "late"], default="veryLate")
    return df


def main():
    df = build_spine()
    print(f"spine {df.shape}, bdl matched {df.bdl_id.notna().mean():.3f}")
    df = add_h1_lines(df)
    t = team_log(df)
    df = add_form(df, t)
    df = add_form_vs_line(df)
    df = add_h2h(df)
    df = add_ratings(df)
    df = add_standings(df)
    df = add_travel(df)
    df = add_phase(df)

    out = os.path.join(PQ, "nba_hunt_frame.parquet")
    df.to_parquet(out, index=False)
    print(f"wrote {out} {df.shape}")

    # sanity: base rates must land on ~50% or something upstream is sign-flipped
    print("\n-- base rates --")
    for c, lab in [("home_cover", "home covers"), ("over", "overs"), ("home_win", "home SU"),
                   ("h1_home_cover", "1H home covers"), ("h1_over", "1H overs"),
                   ("tt_home_over", "home TT over"), ("tt_away_over", "away TT over")]:
        s = df[c].dropna()
        print(f"  {lab:18s} n={len(s):5d}  {s.mean()*100:5.2f}%")
    print("\n-- phase counts --")
    print(df.groupby(["season", "phase"]).size().unstack(fill_value=0))
    print(f"\nOT rate {df.is_ot.mean():.3f}; over rate OT={df[df.is_ot==1]['over'].mean():.3f} "
          f"non-OT={df[df.is_ot==0]['over'].mean():.3f}")
    print(f"ratings coverage {df.rt_spread_gap.notna().mean():.3f}; "
          f"standings {df.st_h_gp.notna().mean():.3f}; 1H lines {df.c_h1_total_point.notna().mean():.3f}")


if __name__ == "__main__":
    main()
