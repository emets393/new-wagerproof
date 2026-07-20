#!/usr/bin/env python3
"""NBA props battery #1 (PROPS_BBALL_BRIEF1.md) — combos from day one.

  A. Teammate-out bumps: star/guard/big freshly out -> remaining players'
     overs (points/assists/rebounds), tiered by the surviving player's role.
  B. Line-vs-form lag (P12/P13 analog): consensus line vs player's prior L5
     average — does the market lag hot/cold form?
  C. Opponent style tiers: pace, FT-allowing, 3PA-allowing defenses.
  D. Minutes trend: role expanding (L3 minutes >> season average).

All at T-60 consensus decimal prices; per-season (3 seasons). BE 52.4%.
"""
import os

import numpy as np
import pandas as pd

from name_maps import norm

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "data", "parquet")

MAIN = {"player_points": "pts", "player_rebounds": "reb", "player_assists": "ast",
        "player_threes": "fg3m", "player_points_rebounds_assists": "pra"}


def load():
    g = pd.read_parquet(f"{OUT}/props_graded.parquet")
    g["pkey"] = g["player"].map(norm)

    pb = pd.read_parquet(f"{OUT}/bdl_player_box.parquet")
    st = pd.DataFrame({
        "pkey": (pb["player.first_name"] + " " + pb["player.last_name"]).map(norm),
        "date_et": pd.to_datetime(pb["game.date"]),
        "game_key": pb["game.id"], "team_id": pb["team.id"],
        "season_yr": pb["game.season"],
        "mins": pd.to_numeric(pb["min"], errors="coerce"),
        "pts": pb["pts"], "reb": pb["reb"], "ast": pb["ast"], "fg3m": pb["fg3m"],
    }).drop_duplicates(["pkey", "date_et"])
    st["pra"] = st["pts"] + st["reb"] + st["ast"]
    st = st.sort_values(["pkey", "date_et"])
    gp = st.groupby(["pkey", "season_yr"])
    for c in ("pts", "reb", "ast", "fg3m", "pra", "mins"):
        st[f"s2d_{c}"] = gp[c].transform(lambda s: s.shift(1).expanding(min_periods=3).mean())
        st[f"l5_{c}"] = gp[c].transform(lambda s: s.shift(1).rolling(5, min_periods=3).mean())
    st["l3_mins"] = gp["mins"].transform(lambda s: s.shift(1).rolling(3, min_periods=2).mean())

    g = g.merge(st[["pkey", "date_et", "game_key", "season_yr"]
                   + [c for c in st.columns if c.startswith(("s2d_", "l5_", "l3_"))]],
                on=["pkey", "date_et"], how="left")

    fl = pd.read_parquet(f"{OUT}/player_flags_nba.parquet")[
        ["game_key", "team_id", "top1_out", "big_out", "guard_out", "reg_out_n"]]
    g = g.merge(fl, on=["game_key", "team_id"], how="left")

    sty = pd.read_parquet(f"{OUT}/style_nba.parquet")
    opp = sty[["game_key", "is_home", "pct_pace", "pct_d_ftr", "pct_d_p3a_rate"]]
    bg = pd.read_parquet(f"{OUT}/bdl_games.parquet").drop_duplicates("id")[
        ["id", "home_team.id"]].rename(columns={"id": "game_key"})
    g = g.merge(bg, on="game_key", how="left")
    g["is_home"] = g["team_id"] == g["home_team.id"]
    g["opp_is_home"] = ~g["is_home"]
    g = g.merge(opp.rename(columns={"is_home": "opp_is_home", "pct_pace": "opp_pace",
                                    "pct_d_ftr": "opp_d_ftr",
                                    "pct_d_p3a_rate": "opp_d_p3a"}),
                on=["game_key", "opp_is_home"], how="left")
    return g


def bet(df, side, label, lines, min_n=40):
    push = df["push"]
    ok = ~push
    n = int(ok.sum())
    if n < min_n:
        return
    win = df["over"] if side == "over" else (~df["over"] & ~push)
    dec = df["over_dec"] if side == "over" else df["under_dec"]
    w = win & ok
    profit = np.where(~ok, 0.0, np.where(w, dec.fillna(1.909) - 1, -1.0))
    per = []
    for s, gg in df.assign(w=w, ok=ok, pr=profit).groupby("season"):
        m = int(gg["ok"].sum())
        if m:
            per.append(f"{s}: {gg['w'].sum()}/{m} {gg['w'].sum()/m*100:.0f}% {gg[gg['ok']]['pr'].mean()*100:+.0f}%")
    lines.append(f"| {label} | {n:,} | {w.sum()/n*100:.1f}% | "
                 f"{profit[ok].mean()*100:+.1f}% | {' · '.join(per)} |")


def main():
    g = load()
    lines = ["# NBA Props Brief #1 — teammate-out bumps, form-lag, style tiers",
             "",
             f"{len(g):,} graded consensus props. T-60 decimal prices. BE 52.4%."]

    # ---- A: teammate-out bumps ----
    lines.append("\n## A — teammate freshly out (player's own team flags)\n")
    lines.append("| signal | n | win% | ROI | per season |")
    lines.append("|---|---|---|---|---|")
    star_out = g["top1_out"].fillna(0) > 0
    pts = g["market"] == "player_points"
    ast = g["market"] == "player_assists"
    reb = g["market"] == "player_rebounds"
    pra = g["market"] == "player_points_rebounds_assists"
    starter = g["s2d_mins"] >= 28
    role = (g["s2d_mins"] >= 18) & (g["s2d_mins"] < 28)
    for label, mask, side in (
            ("STAR OUT → teammates points OVER (all)", star_out & pts, "over"),
            ("STAR OUT → starter (28+ min) points OVER", star_out & pts & starter, "over"),
            ("STAR OUT → role (18-28 min) points OVER", star_out & pts & role, "over"),
            ("STAR OUT → teammates PRA OVER", star_out & pra, "over"),
            ("GUARD OUT → other players assists OVER", (g["guard_out"].fillna(0) > 0) & ast, "over"),
            ("BIG OUT → other players rebounds OVER", (g["big_out"].fillna(0) > 0) & reb, "over"),
            ("≥2 OUT → teammates points OVER", (g["reg_out_n"].fillna(0) >= 2) & pts, "over"),
            ("≥2 OUT → role players points OVER", (g["reg_out_n"].fillna(0) >= 2) & pts & role, "over")):
        bet(g[mask], side, label, lines)

    # ---- B: line vs recent form ----
    lines.append("\n## B — line vs L5 form (does the market lag form?)\n")
    lines.append("| signal | n | win% | ROI | per season |")
    lines.append("|---|---|---|---|---|")
    for mkt, stat in MAIN.items():
        m = g["market"] == mkt
        diff = g[f"l5_{stat}"] - g["line"]
        scale = max(1.0, g.loc[m, "line"].mean() * 0.12)
        for tag, mask, side in (
                (f"{stat}: L5 ≥{scale:.1f} ABOVE line → OVER", m & (diff >= scale), "over"),
                (f"{stat}: L5 ≥{scale:.1f} BELOW line → UNDER", m & (diff <= -scale), "under")):
            bet(g[mask], side, tag, lines)

    # ---- C: opponent style tiers on points/threes ----
    lines.append("\n## C — opponent style tiers\n")
    lines.append("| signal | n | win% | ROI | per season |")
    lines.append("|---|---|---|---|---|")
    for label, mask, side in (
            ("opp PACE hi → points OVER", pts & (g["opp_pace"] >= .7), "over"),
            ("opp PACE lo → points UNDER", pts & (g["opp_pace"] <= .3), "under"),
            ("opp FT-allowing hi → points OVER", pts & (g["opp_d_ftr"] >= .7), "over"),
            ("opp allows 3PA hi → threes OVER", (g["market"] == "player_threes")
             & (g["opp_d_p3a"] >= .7), "over"),
            ("opp PACE hi → PRA OVER", pra & (g["opp_pace"] >= .7), "over"),
            ("STAR OUT × opp pace hi → points OVER", star_out & pts & (g["opp_pace"] >= .7), "over")):
        bet(g[mask], side, label, lines)

    # ---- D: minutes trend ----
    lines.append("\n## D — minutes trend (role expanding/shrinking)\n")
    lines.append("| signal | n | win% | ROI | per season |")
    lines.append("|---|---|---|---|---|")
    mtrend = g["l3_mins"] - g["s2d_mins"]
    for label, mask, side in (
            ("role EXPANDING (L3 mins ≥ s2d+4) → points OVER", pts & (mtrend >= 4), "over"),
            ("role EXPANDING → PRA OVER", pra & (mtrend >= 4), "over"),
            ("role SHRINKING (≤ s2d-4) → points UNDER", pts & (mtrend <= -4), "under"),
            ("role EXPANDING × star out → points OVER", pts & (mtrend >= 4) & star_out, "over")):
        bet(g[mask], side, label, lines)

    path = os.path.join(ROOT, "PROPS_BBALL_BRIEF1.md")
    with open(path, "w") as f:
        f.write("\n".join(lines) + "\n")
    print(f"wrote {path}", flush=True)


if __name__ == "__main__":
    main()
