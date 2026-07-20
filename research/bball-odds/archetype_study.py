#!/usr/bin/env python3
"""TRUE team architecture profiles + within-season style-split plus-minus
(ARCHETYPE_BRIEF1.md).

Multi-dimensional archetypes (prior-only, within-season percentiles — a team
can hold several, or none):

OFFENSE
  O_PAINT_BIG   tall roster + paint-heavy shot mix + efficient at the rim
  O_THREE_GUN   high 3PA rate + efficient from three
  O_TEMPO       top-quartile pace
  O_FT_ATTACK   elite free-throw generation
DEFENSE
  D_PAINT_WALL  tall + holds opponents to low rim FG%
  D_PRESS       forces turnovers at high rate + plays fast
  D_PERIM_LOCK  suppresses 3PA rate AND opponent 3P%
  D_SOFT_FOUL   fouls a lot + soft at the rim

Style-split plus-minus (the owner's ask): team's prior-games performance
(offensive efficiency, ATS cover rate) VS opponents holding archetype X,
minus their overall prior average — SAME SEASON ONLY, strictly prior, min 3
prior meetings vs that archetype. Then: does the split predict the next game
against that archetype, in every market?
"""
import glob
import os

import numpy as np
import pandas as pd

import build_possession_features as bp
from movement_study import am_to_dec
from combo3_study import height_table
from name_maps import norm

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "data", "parquet")

O_LABELS = ["O_PAINT_BIG", "O_THREE_GUN", "O_TEMPO", "O_FT_ATTACK"]
D_LABELS = ["D_PAINT_WALL", "D_PRESS", "D_PERIM_LOCK", "D_SOFT_FOUL"]


def build_labels():
    st = pd.read_parquet(f"{OUT}/style_ncaab.parquet")
    poss = pd.read_parquet(f"{OUT}/possession_team_games.parquet")
    m = st.merge(poss, left_on=["game_key", "is_home"],
                 right_on=["gameId", "isHomeTeam"], how="left")
    names = pd.read_parquet(f"{OUT}/cbbd_team_box.parquet",
                            columns=["gameId", "teamId", "team", "season"]
                            ).drop_duplicates(["gameId", "teamId"])
    m = m.merge(names.rename(columns={"gameId": "game_key"}),
                on=["game_key"], how="left", suffixes=("", "_n"))
    m = m[m["teamId_n" if "teamId_n" in m.columns else "teamId"] == m["teamId"]]
    ht = height_table()
    m["key"] = m["team"].map(norm)
    m["season_lbl"] = m["season"].astype(str)
    ht2 = ht.copy()
    ht2["season_yr"] = ht2["season"].str.split("-").str[0].astype(int) + 1
    m = m.merge(ht2.rename(columns={"key": "key"})[["key", "season_yr", "Hgt5"]],
                left_on=["key", "season"], right_on=["key", "season_yr"], how="left")
    m["hgt_pct"] = m.groupby("season")["Hgt5"].rank(pct=True)
    for c in ("p_rim_pct", "p_three_pct", "p_rim_pct_alwd", "p_three_pct_alwd"):
        m[f"{c}_pct"] = m.groupby("season")[c].rank(pct=True)

    lab = pd.DataFrame(index=m.index)
    lab["O_PAINT_BIG"] = ((m["pct_paint_share"] >= .65) & (m["hgt_pct"] >= .55)
                          & (m["p_rim_pct_pct"] >= .5))
    lab["O_THREE_GUN"] = (m["pct_p3a_rate"] >= .65) & (m["p_three_pct_pct"] >= .55)
    lab["O_TEMPO"] = m["pct_pace"] >= .75
    lab["O_FT_ATTACK"] = m["pct_ftr"] >= .7
    lab["D_PAINT_WALL"] = (m["hgt_pct"] >= .55) & (m["p_rim_pct_alwd_pct"] <= .4)
    lab["D_PRESS"] = (m["pct_d_to_forced"] >= .7) & (m["pct_pace"] >= .55)
    lab["D_PERIM_LOCK"] = (m["pct_d_p3a_rate"] <= .45) & (m["p_three_pct_alwd_pct"] <= .45)
    lab["D_SOFT_FOUL"] = (m["pct_d_ftr"] >= .7) & (m["p_rim_pct_alwd_pct"] >= .6)
    dcol = "date" if "date" in m.columns else "date_x"
    out = pd.concat([m[["game_key", "teamId", "team", "season", dcol]].rename(
        columns={dcol: "date"}), lab], axis=1)
    out.to_parquet(f"{OUT}/archetype_labels.parquet", index=False)
    freqs = {c: f"{lab[c].mean()*100:.0f}%" for c in lab.columns}
    print("label frequencies:", freqs, flush=True)
    return out


def main():
    labels = build_labels()
    perf = bp.per_game()
    perf["poss"] = perf["fga"] - perf["oreb"] + perf["to"] + 0.475 * perf["fta"]
    perf["off_eff"] = perf["pts"] / perf["poss"].replace(0, np.nan) * 100
    perf = perf[["gameId", "teamId", "off_eff"]]

    df = pd.read_parquet(f"{OUT}/sides_table_ncaab.parquet")
    h = pd.concat([pd.read_parquet(p) for p in
                   sorted(glob.glob(f"{OUT}/h1tt_ncaab_*.parquet"))], ignore_index=True)
    for c in ("tt_home_over_price", "tt_home_under_price",
              "tt_away_over_price", "tt_away_under_price"):
        h[c] = am_to_dec(h[c])
    cons = h.groupby("event_id")[["tt_home_point", "tt_home_over_price",
                                  "tt_home_under_price", "tt_away_point",
                                  "tt_away_over_price", "tt_away_under_price"]].median()
    df = df.merge(cons, on="event_id", how="left")

    # long team-game frame with own perf + OPPONENT labels
    rows = []
    for side, opp in (("h", "a"), ("a", "h")):
        sub = pd.DataFrame({
            "event_id": df["event_id"], "season": df["season"],
            "date": pd.to_datetime(df["date_et"]),
            "cbbd_id": df["cbbd_id"],
            "team_id": df[f"{side}_team_id"], "team": df[f"{side}_team"],
            "opp_id": df[f"{opp}_team_id"], "opp": df[f"{opp}_team"],
            "is_home": side == "h",
            "margin": df["margin"] * (1 if side == "h" else -1),
            "cover_amt": df["cover_amt"] * (1 if side == "h" else -1),
            "pts": df["home_score"] if side == "h" else df["away_score"],
            "tt": df["tt_home_point"] if side == "h" else df["tt_away_point"],
            "tt_over": df["tt_home_over_price"] if side == "h" else df["tt_away_over_price"],
            "tt_under": df["tt_home_under_price"] if side == "h" else df["tt_away_under_price"],
            "sp_own": df["t60_spread_home_price"] if side == "h" else df["t60_spread_away_price"],
            "sp_opp": df["t60_spread_away_price"] if side == "h" else df["t60_spread_home_price"]})
        rows.append(sub)
    t = pd.concat(rows, ignore_index=True)
    t = t.merge(perf.rename(columns={"gameId": "cbbd_id", "teamId": "team_id"}),
                on=["cbbd_id", "team_id"], how="left")
    opl = labels.rename(columns={"game_key": "cbbd_id", "teamId": "opp_id"})
    t = t.merge(opl[["cbbd_id", "opp_id"] + O_LABELS + D_LABELS],
                on=["cbbd_id", "opp_id"], how="left")
    t = t.sort_values(["team_id", "season", "date"]).reset_index(drop=True)
    t["tkey"] = t["team_id"].astype(str) + "_" + t["season"]

    g = t.groupby("tkey")
    t["prior_off"] = g["off_eff"].transform(lambda s: s.shift(1).expanding(min_periods=4).mean())
    t["prior_cov"] = g["cover_amt"].transform(lambda s: s.shift(1).expanding(min_periods=4).mean())
    for L in D_LABELS + O_LABELS:   # opponent's label; offense splits vs D, defense splits vs O
        vs = t["off_eff"].where(t[L] == True)
        cv = t["cover_amt"].where(t[L] == True)
        t[f"vs_{L}_off"] = g[vs.name].transform(lambda s: s) if False else \
            vs.groupby(t["tkey"]).transform(lambda s: s.shift(1).expanding(min_periods=3).mean())
        t[f"vs_{L}_cov"] = cv.groupby(t["tkey"]).transform(
            lambda s: s.shift(1).expanding(min_periods=3).mean())
        t[f"pm_{L}_off"] = t[f"vs_{L}_off"] - t["prior_off"]
        t[f"pm_{L}_cov"] = t[f"vs_{L}_cov"] - t["prior_cov"]

    lines = ["# Archetype Brief #1 — architecture profiles + style-split plus-minus",
             "", "Labels prior-only, within-season. Split +/- requires ≥3 prior meetings",
             "vs that archetype in the SAME season. All bets T-60 consensus. BE 52.4%."]
    lines.append("\n## Label frequencies\n")
    for L in O_LABELS + D_LABELS:
        lines.append(f"- {L}: {labels[L].mean()*100:.0f}% of team-games")

    # ---- predictive tests ----
    push = t["cover_amt"] == 0
    lines.append("\n## Does prior split +/- predict the NEXT meeting vs that archetype?\n")
    lines.append("| signal | n | win% | ROI | per season |")
    lines.append("|---|---|---|---|---|")
    def bet(mask, win, dec, label, min_n=40):
        m = mask.fillna(False) & ~push
        n = int(m.sum())
        if n < min_n:
            return
        w = win[m]
        pr = np.where(w, dec[m].fillna(1.909) - 1, -1)
        per = " ".join(f"{s}:{gg.mean()*100:.0f}%" for s, gg in
                       t[m].assign(w=w).groupby("season")["w"])
        lines.append(f"| {label} | {n:,} | {w.mean()*100:.1f}% | "
                     f"{np.mean(pr)*100:+.1f}% | {per} |")
    for L in D_LABELS:
        facing = t[L] == True
        good = t[f"pm_{L}_off"] >= 5
        bad = t[f"pm_{L}_off"] <= -5
        bet(facing & good, (t["cover_amt"] > 0), t["sp_own"],
            f"faces {L}, prior +5 eff vs it → BACK ATS")
        bet(facing & bad, (t["cover_amt"] < 0), t["sp_opp"],
            f"faces {L}, prior −5 eff vs it → FADE ATS")
        tpush = (t["pts"] == t["tt"]) | t["tt"].isna()
        m = (facing & good).fillna(False) & ~tpush
        if int(m.sum()) >= 40:
            w = (t["pts"] > t["tt"])[m]
            pr = np.where(w, t["tt_over"][m].fillna(1.909) - 1, -1)
            per = " ".join(f"{s}:{gg.mean()*100:.0f}%" for s, gg in
                           t[m].assign(w=w).groupby("season")["w"])
            lines.append(f"| faces {L}, prior +5 → TT OVER | {int(m.sum()):,} | "
                         f"{w.mean()*100:.1f}% | {np.mean(pr)*100:+.1f}% | {per} |")
        m = (facing & bad).fillna(False) & ~tpush
        if int(m.sum()) >= 40:
            w = (t["pts"] < t["tt"])[m]
            pr = np.where(w, t["tt_under"][m].fillna(1.909) - 1, -1)
            per = " ".join(f"{s}:{gg.mean()*100:.0f}%" for s, gg in
                           t[m].assign(w=w).groupby("season")["w"])
            lines.append(f"| faces {L}, prior −5 → TT UNDER | {int(m.sum()):,} | "
                         f"{w.mean()*100:.1f}% | {np.mean(pr)*100:+.1f}% | {per} |")

    # persistence: corr(prior split pm, this-game eff delta)
    lines.append("\n## Persistence check (is the split real skill or noise?)\n")
    for L in D_LABELS:
        facing = (t[L] == True) & t[f"pm_{L}_off"].notna() & t["prior_off"].notna() \
            & t["off_eff"].notna()
        cur_delta = (t["off_eff"] - t["prior_off"])[facing]
        pm = t[f"pm_{L}_off"][facing]
        if facing.sum() > 300:
            c = np.corrcoef(pm, cur_delta)[0, 1]
            lines.append(f"- {L}: corr(prior split +/- , this-game eff delta) = "
                         f"{c:+.3f} (n={int(facing.sum()):,})")

    # ---- concrete examples ----
    lines.append("\n## Concrete examples (audit trail)\n")
    ex = t[(t["season"] == "2024-25") & t["pm_D_PRESS_off"].notna()
           & (t["D_PRESS"] == True)].sort_values("pm_D_PRESS_off")
    for r in list(ex.head(3).itertuples()) + list(ex.tail(3).itertuples()):
        lines.append(f"- {r.date.date()} **{r.team}** vs {r.opp} (opponent=D_PRESS). "
                     f"Season prior eff {r.prior_off:.1f}, prior vs-press eff "
                     f"{r.vs_D_PRESS_off:.1f} (Δ{r.pm_D_PRESS_off:+.1f}). "
                     f"Game: eff {r.off_eff:.1f}, margin {r.margin:+.0f}, "
                     f"cover_amt {r.cover_amt:+.1f}")
    ex2 = t[(t["season"] == "2025-26") & t["pm_D_PAINT_WALL_off"].notna()
            & (t["D_PAINT_WALL"] == True)].sort_values("pm_D_PAINT_WALL_off")
    for r in list(ex2.head(3).itertuples()) + list(ex2.tail(3).itertuples()):
        lines.append(f"- {r.date.date()} **{r.team}** vs {r.opp} (opponent=D_PAINT_WALL). "
                     f"prior eff {r.prior_off:.1f}, vs-paint-wall "
                     f"{r.vs_D_PAINT_WALL_off:.1f} (Δ{r.pm_D_PAINT_WALL_off:+.1f}). "
                     f"Game: eff {r.off_eff:.1f}, margin {r.margin:+.0f}, "
                     f"cover {r.cover_amt:+.1f}")

    t.to_parquet(f"{OUT}/archetype_splits.parquet", index=False)
    with open(os.path.join(ROOT, "ARCHETYPE_BRIEF1.md"), "w") as f:
        f.write("\n".join(lines) + "\n")
    print("wrote ARCHETYPE_BRIEF1.md", flush=True)


if __name__ == "__main__":
    main()
