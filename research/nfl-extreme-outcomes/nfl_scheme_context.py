"""Scheme-context foundation tables (RESEARCH ONLY) — the substrate for scheme-matchup research.

From scheme_plays.parquet (nflverse PBP + participation + FTN charting, 2018-2025) build three
LEAK-SAFE as-of tables:
  1) nfl_def_scheme.parquet  — per (season, week, defteam): the defense's scheme IDENTITY entering
     the game: two_high_rate (COVER_2/4/6/2-MAN share), man_rate, pressure_rate, heavy/light box
     rates, pass_rushers. s2d (within-season, shift(1)) + l8 (cross-season rolling, recent identity).
  2) nfl_off_scheme.parquet  — per (season, week, posteam): offense identity: aDOT, deep_rate
     (air_yards>=15), shotgun_rate, pass-play EPA; + FTN (2022+): pa_rate, motion_rate, rpo_rate.
  3) nfl_player_vs_scheme.parquet — per (season, week, player_id): the player's CAREER as-of
     production split BY COVERAGE FAMILY: yards/target + EPA/target + targets/game vs MAN vs ZONE,
     and vs 1-HIGH vs 2-HIGH shells; plus the differentials (man_minus_zone, one_minus_two).
All rolling stats shift(1) before the window (the current game never feeds its own feature).
Coverage labels exist on ~60% of pass plays; rates are computed over LABELED plays only.
"""
import numpy as np
import pandas as pd
from pathlib import Path

DATA = Path(__file__).resolve().parent / "data"
TWO_HIGH = {"COVER_2", "COVER_4", "COVER_6", "2_MAN"}
ONE_HIGH = {"COVER_0", "COVER_1", "COVER_3"}


def load():
    sp = pd.read_parquet(DATA / "scheme_plays.parquet")
    ftn = pd.read_parquet(DATA / "ftn_charting.parquet")[
        ["game_id", "play_id", "is_play_action", "is_motion", "is_rpo", "n_blitzers"]]
    sp = sp.merge(ftn, on=["game_id", "play_id"], how="left")
    sp["covfam"] = sp.defense_coverage_type.where(sp.defense_coverage_type.isin(TWO_HIGH | ONE_HIGH))
    sp["two_high"] = np.where(sp["covfam"].isin(TWO_HIGH), 1.0, np.where(sp["covfam"].isin(ONE_HIGH), 0.0, np.nan))
    sp["man"] = np.where(sp.defense_man_zone_type == "MAN_COVERAGE", 1.0,
                         np.where(sp.defense_man_zone_type == "ZONE_COVERAGE", 0.0, np.nan))
    return sp


def _asof(df, key, cols, l=8):
    """s2d (within-season expanding, shift(1)) + l{l} (cross-season rolling, shift(1)) per key."""
    df = df.sort_values([key, "season", "week"])
    out = df[[key, "season", "week"]].copy()
    for c in cols:
        out[f"{c}_s2d"] = df.groupby([key, "season"])[c].transform(
            lambda s: s.shift(1).expanding(min_periods=2).mean())
        out[f"{c}_l{l}"] = df.groupby(key)[c].transform(
            lambda s: s.shift(1).rolling(l, min_periods=3).mean())
    return out


def def_scheme(sp):
    d = sp[sp["pass"] == 1]
    g = d.groupby(["season", "week", "defteam"]).agg(
        two_high_rate=("two_high", "mean"), man_rate=("man", "mean"),
        pressure_rate=("was_pressure", "mean"), rushers=("number_of_pass_rushers", "mean"),
        blitzers=("n_blitzers", "mean")).reset_index()
    box = sp.dropna(subset=["defenders_in_box"]).groupby(["season", "week", "defteam"]).agg(
        heavy_box_rate=("defenders_in_box", lambda s: (s >= 8).mean()),
        light_box_rate=("defenders_in_box", lambda s: (s <= 6).mean())).reset_index()
    g = g.merge(box, on=["season", "week", "defteam"], how="left")
    cols = ["two_high_rate", "man_rate", "pressure_rate", "rushers", "blitzers",
            "heavy_box_rate", "light_box_rate"]
    return _asof(g.rename(columns={"defteam": "team"}), "team", cols)


def off_scheme(sp):
    d = sp[sp["pass"] == 1]
    g = d.groupby(["season", "week", "posteam"]).agg(
        adot=("air_yards", "mean"),
        deep_rate=("air_yards", lambda s: (s >= 15).mean()),
        pass_epa=("epa", "mean"), tt=("time_to_throw", "mean"),
        pa_rate=("is_play_action", "mean"), motion_rate=("is_motion", "mean"),
        rpo_rate=("is_rpo", "mean")).reset_index()
    fm = sp.dropna(subset=["offense_formation"]).groupby(["season", "week", "posteam"]).agg(
        shotgun_rate=("offense_formation", lambda s: s.isin(["SHOTGUN", "EMPTY"]).mean())).reset_index()
    g = g.merge(fm, on=["season", "week", "posteam"], how="left")
    cols = ["adot", "deep_rate", "pass_epa", "tt", "pa_rate", "motion_rate", "rpo_rate", "shotgun_rate"]
    return _asof(g.rename(columns={"posteam": "team"}), "team", cols)


def player_vs_scheme(sp):
    """Receiver production per game split by coverage family, then CAREER as-of expanding means."""
    t = sp[(sp["pass"] == 1) & sp.receiver_player_id.notna()].copy()
    rows = []
    for fam, mask in [("man", t.man == 1), ("zone", t.man == 0),
                      ("twohigh", t.two_high == 1), ("onehigh", t.two_high == 0)]:
        g = t[mask].groupby(["season", "week", "receiver_player_id"]).agg(
            **{f"tgt_{fam}": ("play_id", "count"), f"yds_{fam}": ("yards_gained", "sum"),
               f"epa_{fam}": ("epa", "sum")}).reset_index()
        rows.append(g)
    m = rows[0]
    for r in rows[1:]:
        m = m.merge(r, on=["season", "week", "receiver_player_id"], how="outer")
    m = m.fillna(0).sort_values(["receiver_player_id", "season", "week"])
    out = m[["season", "week", "receiver_player_id"]].copy()
    for fam in ("man", "zone", "twohigh", "onehigh"):
        ct = m.groupby("receiver_player_id")[f"tgt_{fam}"].transform(lambda s: s.shift(1).expanding().sum())
        cy = m.groupby("receiver_player_id")[f"yds_{fam}"].transform(lambda s: s.shift(1).expanding().sum())
        ce = m.groupby("receiver_player_id")[f"epa_{fam}"].transform(lambda s: s.shift(1).expanding().sum())
        out[f"tgts_{fam}"] = ct
        out[f"ypt_{fam}"] = (cy / ct.replace(0, np.nan))
        out[f"epat_{fam}"] = (ce / ct.replace(0, np.nan))
    # differentials (require >=15 career targets in BOTH families to be meaningful)
    ok_mz = (out.tgts_man >= 15) & (out.tgts_zone >= 15)
    ok_12 = (out.tgts_onehigh >= 15) & (out.tgts_twohigh >= 15)
    out["ypt_man_minus_zone"] = np.where(ok_mz, out.ypt_man - out.ypt_zone, np.nan)
    out["epat_man_minus_zone"] = np.where(ok_mz, out.epat_man - out.epat_zone, np.nan)
    out["ypt_one_minus_two"] = np.where(ok_12, out.ypt_onehigh - out.ypt_twohigh, np.nan)
    return out.rename(columns={"receiver_player_id": "player_id"})


if __name__ == "__main__":
    sp = load()
    ds = def_scheme(sp); ds.to_parquet(DATA / "nfl_def_scheme.parquet", index=False)
    print(f"[def] {len(ds)} rows | 2025 two_high_l8 sample:",
          ds[(ds.season == 2025)].dropna(subset=["two_high_rate_l8"]).groupby("team").two_high_rate_l8.last().sort_values().round(2).to_dict())
    os_ = off_scheme(sp); os_.to_parquet(DATA / "nfl_off_scheme.parquet", index=False)
    print(f"[off] {len(os_)} rows")
    pv = player_vs_scheme(sp); pv.to_parquet(DATA / "nfl_player_vs_scheme.parquet", index=False)
    have = pv.ypt_man_minus_zone.notna().mean()
    print(f"[player] {len(pv)} rows | man/zone differential available on {have*100:.0f}% of player-weeks")
