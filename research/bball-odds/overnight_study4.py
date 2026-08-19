#!/usr/bin/env python3
"""Overnight study 4 — close the loose ends: L2 confirm + props mechanism (fixed join).

Q1  Permutation confirm for the signal-agreement layer (L2) of the assembled CBB rule:
    within the L1 set (ship band, steam-filtered), shuffle the agree labels 2,000x and
    test the observed agree-vs-rest win gap. Same construction as the steam-filter
    confirm that passed at p=0.01.
Q2  Props cold-raise mechanism (P2 retry): pkey -> team via bdl_player_box (player_id,
    team_id, game date), then split the rule's tickets by same-day fresh team absence.
Writes OVERNIGHT4_CONFIRMS.md.
"""
import importlib.util
import os
import traceback
import warnings

import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")

ROOT = os.path.dirname(os.path.abspath(__file__))
PQ = os.path.join(ROOT, "data", "parquet")
OUT = os.path.join(ROOT, "OVERNIGHT4_CONFIRMS.md")

spec = importlib.util.spec_from_file_location("ms", os.path.join(ROOT, "movement_study.py"))
ms = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ms)


def q1(lines):
    preds = pd.read_parquet(f"{PQ}/_move_model_preds_ncaab.parquet")
    g = pd.read_parquet(f"{PQ}/games_ncaab.parquet")
    mg = pd.read_parquet(f"{PQ}/movement_games_ncaab.parquet").drop(
        columns=["home_team", "away_team", "season", "home_h1", "away_h1",
                 "commence_time"], errors="ignore")
    df = g.merge(mg, on="event_id", suffixes=("", "_mg")).merge(preds, on="event_id")
    df = df[df["home_score"].notna() & df["d_spread"].notna()].copy()
    tb = pd.read_parquet(f"{PQ}/cbbd_team_box.parquet",
                         columns=["gameId", "teamId", "isHome"]).drop_duplicates(
        ["gameId", "teamId"])
    df["h_tid"] = df["cbbd_id"].map(tb[tb["isHome"]].set_index("gameId")["teamId"])
    df["a_tid"] = df["cbbd_id"].map(tb[~tb["isHome"]].set_index("gameId")["teamId"])
    fl = pd.read_parquet(f"{PQ}/player_flags_ncaab.parquet")
    fade = {}
    for name in ("big_out", "top1_out", "guard_out"):
        s = fl[fl[name] > 0.5]
        fade[name] = set(zip(s["game_key"], s["team_id"]))
    ht = pd.read_parquet(f"{PQ}/ncaab_player_heat.parquet")
    thr = ht["p_heat"].quantile(0.75)
    fade["heat_hi"] = set(zip(ht.loc[ht["p_heat"] >= thr, "gameId"],
                              ht.loc[ht["p_heat"] >= thr, "teamId"]))

    band = df["d_spread"].abs().between(1.5, 4.0)
    B = df[band].copy()
    msides = np.where(B["d_spread"] >= 0, "home", "away")
    move = -(B["t60_spread_home_point"] - B["open_spread_home_point"])
    rel = pd.Series(np.where(B["d_spread"] >= 0, move, -move), index=B.index)
    keep = (rel < 1.0).fillna(True).values
    agree = np.zeros(len(B), dtype=int)
    for name, fs in fade.items():
        h = np.array([(g_, t) in fs for g_, t in zip(B["cbbd_id"], B["h_tid"])])
        a = np.array([(g_, t) in fs for g_, t in zip(B["cbbd_id"], B["a_tid"])])
        s_side = np.where(h & ~a, "away", np.where(a & ~h, "home", ""))
        agree += ((s_side != "") & (s_side == msides)).astype(int)

    win = np.zeros(len(B), dtype=bool)
    push = np.zeros(len(B), dtype=bool)
    for s in ("home", "away"):
        pick = msides == s
        w, pu, _ = ms.grade_side(B[pick], s)
        win[pick], push[pick] = w, pu
    L1 = keep & ~push
    lab = (agree >= 1)[L1]
    wv = win[L1]
    gap = wv[lab].mean() - wv[~lab].mean()
    rng = np.random.default_rng(20260819)
    lab2 = lab.copy()
    null = []
    for _ in range(2000):
        rng.shuffle(lab2)
        null.append(wv[lab2].mean() - wv[~lab2].mean())
    p = float((np.array(null) >= gap).mean())
    lines += ["\n## Q1 L2 signal-agreement layer — permutation confirm\n",
              f"Within L1 (n={int(L1.sum()):,}): agree win {wv[lab].mean()*100:.1f}% vs "
              f"rest {wv[~lab].mean()*100:.1f}%, gap {gap*100:+.2f} pts, permutation "
              f"p = {p:.4f} (2,000 shuffles). "
              + ("**CONFIRMED.**" if p < 0.05 else "**NOT confirmed at 0.05.**")]
    print(f"[q1] gap {gap*100:+.2f} p={p:.4f}", flush=True)


def q2(lines):
    code = open(os.path.join(ROOT, "nba_props_streaks.py")).read()
    code = code.split('if __name__ == "__main__":')[0]
    ns = {"__file__": os.path.join(ROOT, "nba_props_streaks.py")}
    exec(compile(code, "nps", "exec"), ns)
    frames = []
    for mk in ns["MARKETS"]:
        R = ns["prep"](mk)
        R["market"] = mk
        frames.append(R)
    A = pd.concat(frames, ignore_index=True)
    A = A[(A["run_under"] >= 3) & (A["z_prev_line"] >= 0.75)].copy()
    prio = {m: i for i, m in enumerate(ns["MARKETS"])}
    A["prio"] = A["market"].map(prio)
    A = A.sort_values("prio").drop_duplicates(["date", "pkey"])
    A["date_n"] = pd.to_datetime(A["date"]).dt.normalize()
    print(f"[q2] tickets {len(A):,} | pkey sample {A['pkey'].iloc[0]!r}", flush=True)

    pb = pd.read_parquet(f"{PQ}/bdl_player_box.parquet")
    tcol = [c for c in pb.columns if c in ("team_id", "team.id")][0]
    dcol = [c for c in pb.columns if "date" in c.lower()][0]
    pb["date_n"] = pd.to_datetime(pb[dcol]).dt.normalize()
    # pkey is a lowercase "first last" name string
    pb["nm"] = (pb["player.first_name"].str.strip() + " "
                + pb["player.last_name"].str.strip()).str.lower()
    pmap = pb.drop_duplicates(["nm", "date_n"]).set_index(["nm", "date_n"])[tcol]
    key = pd.MultiIndex.from_arrays([A["pkey"].astype(str).str.lower().str.strip(),
                                     A["date_n"]])
    A["tid"] = pd.to_numeric(pmap.reindex(key).values, errors="coerce")
    cov = A["tid"].notna().mean()
    print(f"[q2] team-map coverage {cov:.1%}", flush=True)

    ab = pd.read_parquet(f"{PQ}/nba_absence.parquet")
    ab["date_n"] = pd.to_datetime(ab["date"]).dt.normalize()
    ab["tid"] = pd.to_numeric(ab["team_id"], errors="coerce")
    amap = ab.drop_duplicates(["date_n", "tid"]).set_index(
        ["date_n", "tid"])[["fresh_n", "fresh_max_ppg"]]
    j = A.join(amap, on=["date_n", "tid"])
    hasab = j["fresh_n"].fillna(0) > 0
    bigab = j["fresh_max_ppg"].fillna(0) >= 15

    def roiline(mask, label):
        s = j[mask & j["tid"].notna()]
        if len(s) < 20:
            return
        win = 1 - s["y_best_under"]
        dec = s["best_under_dec"]
        profit = np.where(win.astype(bool), dec - 1, -1.0)
        per = []
        for ssn, gg in s.assign(w=win, p=profit).groupby("season_x"):
            per.append(f"{ssn}: {int(gg['w'].sum())}/{len(gg)} {gg['p'].mean()*100:+.0f}%")
        lines.append(f"| {label} | {len(s):,} | {win.mean()*100:.1f}% | "
                     f"{profit.mean()*100:+.1f}% | {' · '.join(per)} |")

    lines += ["\n## Q2 props cold-raise UNDER — mechanism split (fresh team absence)\n",
              f"team-map coverage {cov:.1%}", "",
              "| cell | n | win% | ROI | per season |", "|---|---|---|---|---|"]
    roiline(pd.Series(True, index=j.index), "ALL mapped tickets")
    roiline(hasab, "team HAS fresh absence")
    roiline(~hasab, "NO fresh absence")
    roiline(bigab, "fresh 15+ppg out")


def main():
    lines = ["# Overnight 4 — confirms and mechanism", ""]
    for name, fn in (("q1", q1), ("q2", q2)):
        try:
            fn(lines)
        except Exception:
            lines += [f"\n**{name} FAILED:**", "```", traceback.format_exc()[-1200:], "```"]
            print(f"[{name}] FAILED", flush=True)
    with open(OUT, "w") as f:
        f.write("\n".join(lines) + "\n")
    print(f"wrote {OUT}", flush=True)


if __name__ == "__main__":
    main()
