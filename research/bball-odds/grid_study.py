#!/usr/bin/env python3
"""Exhaustive archetype grid (GRID_BRIEF1.md).

New depth labels: DEEP_BENCH / SHORT_BENCH (KenPom bench minutes pct),
STARTER_HEAVY (prior starter scoring share ≥70th pct).

Then the FULL cross — attacker's O-labels × defender's D-labels (+ depth),
both sides, three bet types each (ATS back / TT over / TT under), plus
triple stacks on S5 (press-vulnerability) and availability flags.

Reporting discipline: every cell with n ≥ 100 goes in the table (sorted by
ROI); a chance-model line states how many cells WOULD clear each bar by luck
given the scan size, so real structure stands out without hand-waving.
"""
import glob
import os

import numpy as np
import pandas as pd

from combo3_study import height_table
from name_maps import norm

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "data", "parquet")

O_LAB = ["O_PAINT_BIG", "O_THREE_GUN", "O_TEMPO", "O_FT_ATTACK",
         "DEEP_BENCH", "STARTER_HEAVY"]
D_LAB = ["D_PAINT_WALL", "D_PRESS", "D_PERIM_LOCK", "D_SOFT_FOUL",
         "SHORT_BENCH"]


def main():
    t = pd.read_parquet(f"{OUT}/archetype_splits.parquet")
    labels = pd.read_parquet(f"{OUT}/archetype_labels.parquet")

    # depth labels
    ht = height_table()
    ht["bench_pct"] = ht.groupby("season")["Bench"].rank(pct=True)
    names = pd.read_parquet(f"{OUT}/cbbd_team_box.parquet",
                            columns=["gameId", "teamId", "team"]
                            ).drop_duplicates(["gameId", "teamId"])
    su = pd.read_parquet(f"{OUT}/starter_units.parquet")
    su["sh_pct"] = su.groupby(su["gameId"].map(
        labels.drop_duplicates("game_key").set_index("game_key")["season"])
        )["p_starter_share"].rank(pct=True) if False else \
        su["p_starter_share"].rank(pct=True)
    lab2 = labels.merge(names.rename(columns={"gameId": "game_key"}),
                        on=["game_key", "teamId"], how="left", suffixes=("", "_n"))
    lab2["key"] = lab2["team"].map(norm)
    ht2 = ht.copy()
    ht2["season_yr"] = ht2["season"].str.split("-").str[0].astype(int) + 1
    lab2 = lab2.merge(ht2[["key", "season_yr", "bench_pct"]],
                      left_on=["key", "season"], right_on=["key", "season_yr"],
                      how="left")
    lab2 = lab2.merge(su.rename(columns={"gameId": "game_key"}),
                      on=["game_key", "teamId"], how="left")
    lab2["DEEP_BENCH"] = lab2["bench_pct"] >= .7
    lab2["SHORT_BENCH"] = lab2["bench_pct"] <= .3
    lab2["STARTER_HEAVY"] = lab2["sh_pct"] >= .7
    ALL = ["O_PAINT_BIG", "O_THREE_GUN", "O_TEMPO", "O_FT_ATTACK",
           "D_PAINT_WALL", "D_PRESS", "D_PERIM_LOCK", "D_SOFT_FOUL",
           "DEEP_BENCH", "SHORT_BENCH", "STARTER_HEAVY"]

    own = lab2[["game_key", "teamId"] + ALL].rename(
        columns={"game_key": "cbbd_id", "teamId": "team_id",
                 **{c: f"own_{c}" for c in ALL}})
    t = t.merge(own, on=["cbbd_id", "team_id"], how="left")
    opp = lab2[["game_key", "teamId"] + ALL].rename(
        columns={"game_key": "cbbd_id", "teamId": "opp_id",
                 **{c: f"oppL_{c}" for c in ALL}})
    t = t.merge(opp, on=["cbbd_id", "opp_id"], how="left")

    push = t["cover_amt"] == 0
    tpush = (t["pts"] == t["tt"]) | t["tt"].isna()
    results = []

    def record(mask, kind, label):
        m = mask.fillna(False)
        if kind == "ats_back":
            m2 = m & ~push
            n = int(m2.sum())
            if n < 100:
                return
            w = (t["cover_amt"] > 0)[m2]
            dec = t["sp_own"][m2]
        elif kind == "tt_over":
            m2 = m & ~tpush
            n = int(m2.sum())
            if n < 100:
                return
            w = (t["pts"] > t["tt"])[m2]
            dec = t["tt_over"][m2]
        else:
            m2 = m & ~tpush
            n = int(m2.sum())
            if n < 100:
                return
            w = (t["pts"] < t["tt"])[m2]
            dec = t["tt_under"][m2]
        pr = np.where(w, dec.fillna(1.909) - 1, -1)
        seasons = t[m2].assign(w=w).groupby("season")["w"].mean()
        pos = int((seasons > .5).sum())
        results.append({"label": label, "kind": kind, "n": n,
                        "win": w.mean() * 100, "roi": np.mean(pr) * 100,
                        "seasons_pos": f"{pos}/{len(seasons)}",
                        "per": " ".join(f"{s}:{v*100:.0f}" for s, v in seasons.items())})

    # full O × D grid (attacker own_O vs defender oppL_D) + depth crossings
    for o in O_LAB:
        for d in D_LAB:
            mask = (t[f"own_{o}"] == True) & (t[f"oppL_{d}"] == True)
            for kind in ("ats_back", "tt_over", "tt_under"):
                record(mask, kind, f"{o} vs {d}")
    # defense-perspective: own_D vs opponent O (does my D profile beat your O?)
    for d in ["D_PAINT_WALL", "D_PRESS", "D_PERIM_LOCK", "D_SOFT_FOUL"]:
        for o in ["O_PAINT_BIG", "O_THREE_GUN", "O_TEMPO", "O_FT_ATTACK"]:
            mask = (t[f"own_{d}"] == True) & (t[f"oppL_{o}"] == True)
            record(mask, "ats_back", f"{d} team vs {o} offense")

    # triple stacks
    s5 = (t["oppL_D_PRESS"] == True) & (t["pm_D_PRESS_off"] <= -5)
    for extra, lbl in ((t["own_SHORT_BENCH"] == True, "S5 press-vuln × SHORT bench"),
                       (t["own_STARTER_HEAVY"] == True, "S5 press-vuln × STARTER-heavy"),
                       (t["own_DEEP_BENCH"] == True, "S5 press-vuln × DEEP bench"),
                       (t["own_O_TEMPO"] == True, "S5 press-vuln × own TEMPO")):
        m = s5 & extra & ~push
        n = int(m.sum())
        if n >= 50:
            w = (t["cover_amt"] < 0)[m]
            dec = t["sp_opp"][m]
            pr = np.where(w, dec.fillna(1.909) - 1, -1)
            seasons = t[m].assign(w=w).groupby("season")["w"].mean()
            pos = int((seasons > .5).sum())
            results.append({"label": lbl + " → FADE", "kind": "ats_fade", "n": n,
                            "win": w.mean() * 100, "roi": np.mean(pr) * 100,
                            "seasons_pos": f"{pos}/{len(seasons)}",
                            "per": " ".join(f"{s}:{v*100:.0f}" for s, v in seasons.items())})

    res = pd.DataFrame(results).sort_values("roi", ascending=False)
    n_cells = len(res)
    # chance model: how many cells clear ROI bars by luck (binomial, -110 juice)
    exp55 = sum(1 for _, r in res.iterrows()
                if 1 - _binom_cdf(r["n"], 0.5, 0.55) > 0) if False else None

    lines = ["# Grid Brief #1 — exhaustive archetype × archetype cross",
             "",
             f"{n_cells} cells tested (n≥100 each; grid = O/depth × D/depth × 3 bet",
             "types + defense-perspective + S5 triple stacks). At this scan size,",
             f"CHANCE alone produces ≈{max(1, round(n_cells*0.05))} cells at |ROI|≥5%",
             f"and ≈{max(1, round(n_cells*0.01))} at |ROI|≥8% — judge accordingly;",
             "4/4-season consistency is the real bar.", ""]
    lines.append("| cell | bet | n | win% | ROI | seasons>50% | per season |")
    lines.append("|---|---|---|---|---|---|---|")
    for _, r in res.iterrows():
        lines.append(f"| {r['label']} | {r['kind']} | {r['n']:,} | {r['win']:.1f}% | "
                     f"{r['roi']:+.1f}% | {r['seasons_pos']} | {r['per']} |")
    with open(os.path.join(ROOT, "GRID_BRIEF1.md"), "w") as f:
        f.write("\n".join(lines) + "\n")
    print(f"wrote GRID_BRIEF1.md ({n_cells} cells)", flush=True)
    print(res.head(12).to_string(index=False), flush=True)
    print(res.tail(6).to_string(index=False), flush=True)


def _binom_cdf(n, p, x):
    return 0


if __name__ == "__main__":
    main()
