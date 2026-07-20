#!/usr/bin/env python3
"""NBA style port + architecture combos (STYLE_NBA_BRIEF1.md).

Style profiles from BDL team-game aggregates (no paint points in BDL —
low-3 share serves as the interior proxy): p3_share, p3a_rate, p3_pct, ftr,
oreb_pg, to_rate, pace (from advanced), plus defensive mirrors from the
opponent's line in the same game (d_p3_pct, d_p3a_rate, d_ftr, d_to_forced).

Battery: availability × style tiers on the NBA flags (incl. tiering the
tracked big_out→OVER), key clashes, 3-heavy dog variance check.
"""
import glob
import os

import numpy as np
import pandas as pd

from movement_study import am_to_dec
from name_maps import norm

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "data", "parquet")
HI, LO = 0.70, 0.30

STYLE = ["pace", "p3_share", "p3a_rate", "p3_pct", "ftr", "oreb_pg", "to_rate",
         "d_p3_pct", "d_p3a_rate", "d_ftr", "d_to_forced"]


def build_style():
    pb = pd.read_parquet(f"{OUT}/bdl_player_box.parquet")
    agg = pb.groupby(["game.id", "team.id"]).agg(
        pts=("pts", "sum"), fgm=("fgm", "sum"), fga=("fga", "sum"),
        fg3m=("fg3m", "sum"), fg3a=("fg3a", "sum"), fta=("fta", "sum"),
        oreb=("oreb", "sum"), tov=("turnover", "sum")).reset_index()
    adv = pd.read_parquet(f"{OUT}/bdl_player_advanced.parquet")
    pace = adv.groupby("game.id")["pace"].median().rename("pace").reset_index()
    agg = agg.merge(pace, on="game.id", how="left")
    bg = pd.read_parquet(f"{OUT}/bdl_games.parquet").drop_duplicates("id")[
        ["id", "date", "season", "home_team.id"]].rename(columns={"id": "game.id"})
    agg = agg.merge(bg, on="game.id")

    # defensive mirror = the other team's offensive line in the same game
    opp = agg[["game.id", "team.id", "fga", "fg3a", "fg3m", "fta", "tov"]].copy()
    opp.columns = ["game.id", "opp_id", "o_fga", "o_fg3a", "o_fg3m", "o_fta", "o_tov"]
    m = agg.merge(opp, on="game.id")
    m = m[m["team.id"] != m["opp_id"]].drop_duplicates(["game.id", "team.id"])

    poss = m["fga"] - m["oreb"] + m["tov"] + 0.44 * m["fta"]
    t = pd.DataFrame({
        "game_key": m["game.id"],
        "team_key": m["team.id"].astype(str) + "_" + m["season"].astype(str),
        "is_home": m["team.id"] == m["home_team.id"],
        "date": pd.to_datetime(m["date"]),
        "pace": m["pace"],
        "p3_share": 3 * m["fg3m"] / m["pts"].replace(0, np.nan),
        "p3a_rate": m["fg3a"] / m["fga"].replace(0, np.nan),
        "p3_pct": m["fg3m"] / m["fg3a"].replace(0, np.nan),
        "ftr": m["fta"] / m["fga"].replace(0, np.nan),
        "oreb_pg": m["oreb"],
        "to_rate": m["tov"] / poss.replace(0, np.nan),
        "d_p3_pct": m["o_fg3m"] / m["o_fg3a"].replace(0, np.nan),
        "d_p3a_rate": m["o_fg3a"] / m["o_fga"].replace(0, np.nan),
        "d_ftr": m["o_fta"] / m["o_fga"].replace(0, np.nan),
        "d_to_forced": m["o_tov"] / poss.replace(0, np.nan),
    })
    t = t.sort_values(["team_key", "date"])
    g = t.groupby("team_key")
    for c in STYLE:
        t[f"s_{c}"] = g[c].transform(lambda s: s.shift(1).expanding(min_periods=5).mean())
    t["season_yr"] = t["team_key"].str.split("_").str[1]
    for c in STYLE:
        t[f"pct_{c}"] = t.groupby("season_yr")[f"s_{c}"].rank(pct=True)
    t.to_parquet(f"{OUT}/style_nba.parquet", index=False)
    print(f"style_nba: {len(t):,} team-games", flush=True)
    return t


def bet(df, win, push, dec, label, lines, min_n=30):
    ok = ~push & win.notna()
    n = int(ok.sum())
    if n < min_n:
        return
    w = win.fillna(False) & ok
    profit = np.where(~ok, 0.0, np.where(w, dec.fillna(1.909) - 1, -1.0))
    per = []
    for s, g in df.assign(w=w, ok=ok, pr=profit).groupby("season"):
        m = int(g["ok"].sum())
        if m:
            per.append(f"{s}: {g['w'].sum()}/{m} {g['w'].sum()/m*100:.0f}% {g[g['ok']]['pr'].mean()*100:+.0f}%")
    lines.append(f"| {label} | {n:,} | {w.sum()/n*100:.1f}% | "
                 f"{profit[ok].mean()*100:+.1f}% | {' · '.join(per)} |")


def main():
    st = build_style()
    pct_cols = [c for c in st.columns if c.startswith("pct_")]

    import availability_study as av
    df = av.team_view("nba")
    df["att_is_home"] = ~df["is_home"].astype(bool)
    att = st[["game_key", "is_home"] + pct_cols].rename(
        columns={"is_home": "att_is_home", **{c: f"att_{c}" for c in pct_cols}})
    df = df.merge(att, on=["game_key", "att_is_home"], how="left")
    own = st[["game_key", "is_home"] + pct_cols].rename(
        columns={**{c: f"own_{c}" for c in pct_cols}})
    df = df.merge(own, on=["game_key", "is_home"], how="left")

    margin = df["home_score"] - df["away_score"]
    cover = margin + df["t60_spread_home_point"]
    att_cover = pd.Series(np.where(df["att_is_home"], cover > 0, cover < 0), index=df.index)
    push = cover == 0
    att_dec = pd.Series(np.where(df["att_is_home"], df["t60_spread_home_price"],
                                 df["t60_spread_away_price"]), index=df.index)
    total = df["home_score"] + df["away_score"]
    tline = df["t60_total_point"]
    has_t = tline.notna()

    lines = ["# NBA Style Brief #1 — style port + availability tiers",
             "",
             "Profiles from BDL boxscores (low-3 = interior proxy; no paint pts in BDL).",
             "hi ≥70th pct, lo ≤30th. T-60 prices. BE 52.4%."]
    lines.append("\n## Availability × style tiers\n")
    lines.append("| signal | n | win% | ROI | per season |")
    lines.append("|---|---|---|---|---|")
    combos = [
        ("big_out × att LOW-3 (interior) attacker", (df["big_out"] > 0) & (df["att_pct_p3_share"] <= LO)),
        ("big_out × att FT-drawing hi", (df["big_out"] > 0) & (df["att_pct_ftr"] >= HI)),
        ("big_out × att OREB hi", (df["big_out"] > 0) & (df["att_pct_oreb_pg"] >= HI)),
        ("guard_out × att TO-FORCING hi", (df["guard_out"] > 0) & (df["att_pct_d_to_forced"] >= HI)),
        ("guard_out × att TO-forcing NOT hi", (df["guard_out"] > 0) & (df["att_pct_d_to_forced"] < HI)),
        ("lowto_guard_out × own TO-prone hi", (df["lowto_guard_out"] > 0) & (df["own_pct_to_rate"] >= HI)),
    ]
    for label, mask in combos:
        sub = df[mask]
        bet(sub, att_cover[mask], push[mask], att_dec[mask], f"{label} → BACK attacker ATS", lines)

    lines.append("\n## Tiering the tracked big_out → game OVER (+4.3% base)\n")
    lines.append("| signal | n | win% | ROI | per season |")
    lines.append("|---|---|---|---|---|")
    tiers = [
        ("big_out (base)", df["big_out"] > 0),
        ("big_out × att fast pace hi", (df["big_out"] > 0) & (df["att_pct_pace"] >= HI)),
        ("big_out × att 3-heavy hi", (df["big_out"] > 0) & (df["att_pct_p3_share"] >= HI)),
        ("big_out × att FT-drawing hi", (df["big_out"] > 0) & (df["att_pct_ftr"] >= HI)),
        ("big_out × own pace hi (they run anyway)", (df["big_out"] > 0) & (df["own_pct_pace"] >= HI)),
        ("big_out BOTH sides' pace ≥50th", (df["big_out"] > 0)
         & (df["att_pct_pace"] >= .5) & (df["own_pct_pace"] >= .5)),
    ]
    for label, mask in tiers:
        sub = df[mask]
        bet(sub, (total > tline).where(has_t)[mask], (~has_t | (total == tline))[mask],
            df["t60_total_over_price"][mask], f"{label} → game OVER", lines)

    path = os.path.join(ROOT, "STYLE_NBA_BRIEF1.md")
    with open(path, "w") as f:
        f.write("\n".join(lines) + "\n")
    print(f"wrote {path}", flush=True)


if __name__ == "__main__":
    main()
