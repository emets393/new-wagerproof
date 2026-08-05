"""v3 features — the missing VOLUME/USAGE priors (RESEARCH ONLY).
The v2 model lacked within-team usage: it used l3/l5/szn of the raw actual but never the player's
SHARE of team volume (target/rush/attempt share) or snap participation — the #1 driver of volume &
receiving props and far more stable than the noisy per-game actual. Build them leak-safe (s2d/l5/l3,
shift(1) before the window) and attach to the v2 panel -> nfl_prop_v3_panel.parquet.
"""
import numpy as np
import pandas as pd
from pathlib import Path
DATA = Path(__file__).resolve().parent / "data"
NORM = {"LAR": "LA", "WSH": "WAS", "JAC": "JAX", "OAK": "LV", "SD": "LAC", "STL": "LA"}


def _wins(df, gcol, val, pfx):
    g = df.groupby(gcol)[val]
    df[f"{pfx}_s2d"] = g.transform(lambda s: s.shift(1).expanding(min_periods=2).mean())
    df[f"{pfx}_l5"] = g.transform(lambda s: s.shift(1).rolling(5, min_periods=2).mean())
    df[f"{pfx}_l3"] = g.transform(lambda s: s.shift(1).rolling(3, min_periods=2).mean())
    return df


def usage_shares():
    po = pd.read_parquet(DATA / "player_offense.parquet")
    po["team"] = po.team.replace(NORM)
    po = po[po.season_type == "REG"] if "season_type" in po.columns else po
    tt = po.groupby(["season", "week", "team"], as_index=False).agg(
        tt_tgt=("targets", "sum"), tt_carry=("carries", "sum"), tt_att=("attempts", "sum"))
    d = po[["season", "week", "player_id", "team", "targets", "carries", "attempts"]].merge(
        tt, on=["season", "week", "team"], how="left")
    d["tgt_share"] = d.targets / d.tt_tgt.replace(0, np.nan)
    d["carry_share"] = d.carries / d.tt_carry.replace(0, np.nan)
    d["att_share"] = d.attempts / d.tt_att.replace(0, np.nan)
    d = d.sort_values(["player_id", "season", "week"])
    for base in ("tgt_share", "carry_share", "att_share"):
        d = _wins(d, "player_id", base, base)
    keep = ["season", "week", "player_id"] + [f"{b}_{w}" for b in ("tgt_share", "carry_share", "att_share")
                                              for w in ("s2d", "l5", "l3")]
    return d[keep]


def snap_share():
    sc = pd.read_parquet(DATA / "snap_counts.parquet")
    sc = sc[sc.game_type == "REG"] if "game_type" in sc.columns else sc
    xw = pd.read_parquet(DATA / "players_xwalk.parquet")[["gsis_id", "pfr_id"]].dropna()
    sc = sc.merge(xw, left_on="pfr_player_id", right_on="pfr_id", how="left").dropna(subset=["gsis_id"])
    sc = sc.rename(columns={"gsis_id": "player_id"})
    sc = sc.groupby(["season", "week", "player_id"], as_index=False).offense_pct.max()  # one row/game
    sc = sc.sort_values(["player_id", "season", "week"])
    sc = _wins(sc, "player_id", "offense_pct", "snap_pct")
    return sc[["season", "week", "player_id", "snap_pct_s2d", "snap_pct_l5", "snap_pct_l3"]]


def build():
    p = pd.read_parquet(DATA / "nfl_prop_v2_panel.parquet")
    us = usage_shares(); sn = snap_share()
    p = p.merge(us, on=["season", "week", "player_id"], how="left")
    p = p.merge(sn, on=["season", "week", "player_id"], how="left")
    # leak assert: s2d share must not equal the current-game share on nonzero rows
    po = pd.read_parquet(DATA / "player_offense.parquet"); po["team"] = po.team.replace(NORM)
    return p


if __name__ == "__main__":
    p = build()
    USAGE = [f"{b}_{w}" for b in ("tgt_share", "carry_share", "att_share") for w in ("s2d", "l5", "l3")]
    SNAP = ["snap_pct_s2d", "snap_pct_l5", "snap_pct_l3"]
    ev = p[p.season.isin([2024, 2025])].dropna(subset=["close_line", "actual"])
    print(f"[v3] {len(p)} rows | eval {len(ev)}")
    print("USAGE coverage on eval:", {c: f"{ev[c].notna().mean()*100:.0f}%" for c in ["tgt_share_s2d", "carry_share_s2d", "att_share_s2d"]})
    print("SNAP coverage on eval:", {c: f"{ev[c].notna().mean()*100:.0f}%" for c in SNAP})
    # coverage by market for the relevant share
    for mkt, sh in [("player_receptions", "tgt_share_s2d"), ("player_rush_yds", "carry_share_s2d"),
                    ("player_pass_yds", "att_share_s2d")]:
        e = ev[ev.market == mkt]
        print(f"  {mkt}: {sh} cov {e[sh].notna().mean()*100:.0f}% | snap cov {e['snap_pct_s2d'].notna().mean()*100:.0f}%")
    p.to_parquet(DATA / "nfl_prop_v3_panel.parquet", index=False)
    print("[cache] wrote data/nfl_prop_v3_panel.parquet")
