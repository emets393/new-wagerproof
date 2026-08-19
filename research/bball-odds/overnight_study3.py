#!/usr/bin/env python3
"""Overnight study 3 — composites, the props mechanism, and the 1H derivative gate.

Pre-registered:
  P1 CBB ASSEMBLED RULE — stack the confirmed pieces: ship band (1.5-4) x steam filter
     (skip line-already-moved-≥1-toward-model; CONFIRMED p=0.01) x signal agreement from
     overnight-1 (menu). Grade each layer so the marginal value of every piece is visible.
  P2 PROPS MECHANISM (NBA_PROPS_VERDICT §9.6) — the cold-raise UNDER rule: split its bets
     by whether the player's TEAM had a fresh absence that day (nba_absence). Hypothesis
     stated in the verdict: the book raises a slumping player because a teammate is out
     and the market over-weights that vs current form. If true, the rule should
     concentrate in the absence half.
  P3 1H DERIVATIVE GATE (3 seasons of 1H odds) — derived-market-gating-law: FG total
     model ≥8 off the FG number -> bet the 1H total the SAME direction at its own T-60
     line. Parents-alone control: 1H bets where the FG model is <5 off (should be ~zero
     or negative if the law holds). Both sports.
Writes OVERNIGHT3_COMPOSITES.md.
"""
import glob
import importlib.util
import os
import traceback
import warnings

import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")

ROOT = os.path.dirname(os.path.abspath(__file__))
PQ = os.path.join(ROOT, "data", "parquet")
OUT = os.path.join(ROOT, "OVERNIGHT3_COMPOSITES.md")

spec = importlib.util.spec_from_file_location("ms", os.path.join(ROOT, "movement_study.py"))
ms = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ms)


def cell_rows(df, sides, kind, lines, label, min_n=25):
    if len(df) < min_n:
        return
    win = np.zeros(len(df), dtype=bool)
    push = np.zeros(len(df), dtype=bool)
    profit = np.zeros(len(df))
    opts = ("home", "away") if kind == "spread" else ("over", "under")
    fn = ms.grade_side if kind == "spread" else ms.grade_total
    for s in opts:
        pick = sides == s
        if pick.sum():
            w, pu, pr = fn(df[pick], s)
            win[pick], push[pick], profit[pick] = w, pu, pr
    n = int((~push).sum())
    if n < min_n:
        return
    per = []
    for ssn, g in df.assign(win=win, push=push, profit=profit).groupby("season"):
        m = int((~g["push"]).sum())
        if m >= 5:
            per.append(f"{ssn[2:5]}{ssn[7:]}: {int(g['win'].sum())}/{m} "
                       f"{g['profit'].mean()*100:+.0f}%")
    lines.append(f"| {label} | {n:,} | {win.sum()/n*100:.1f}% | "
                 f"{profit[~push].mean()*100:+.1f}% | {' · '.join(per)} |")


def p1(lines):
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
    notsteamed = (rel < 1.0).fillna(True).values

    agree = np.zeros(len(B), dtype=int)
    for name, fs in fade.items():
        h = np.array([(g_, t) in fs for g_, t in zip(B["cbbd_id"], B["h_tid"])])
        a = np.array([(g_, t) in fs for g_, t in zip(B["cbbd_id"], B["a_tid"])])
        s_side = np.where(h & ~a, "away", np.where(a & ~h, "home", ""))
        agree += ((s_side != "") & (s_side == msides)).astype(int)

    lines += ["\n## P1 CBB assembled rule — marginal value of each layer\n",
              "| layer | n | win% | ROI | per season |", "|---|---|---|---|---|"]
    cell_rows(B, msides, "spread", lines, "L0 ship band (baseline)")
    cell_rows(B[notsteamed], msides[notsteamed], "spread", lines,
              "L1 + steam filter (CONFIRMED)")
    m1 = notsteamed & (agree >= 1)
    cell_rows(B[m1], msides[m1], "spread", lines, "L2 + ≥1 signal agrees (menu)")
    m2 = notsteamed & (agree >= 2)
    cell_rows(B[m2], msides[m2], "spread", lines, "L3 + ≥2 signals agree (menu)")
    dropped = ~notsteamed
    cell_rows(B[dropped], msides[dropped], "spread", lines, "[dropped by L1]")


def p2(lines):
    # rebuild the cold-raise bet set exactly as nba_props_streaks does, then split by
    # same-day team absence
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
    # one ticket per player-game, biggest-line market first
    prio = {m: i for i, m in enumerate(ns["MARKETS"])}
    A["prio"] = A["market"].map(prio)
    A = A.sort_values("prio").drop_duplicates(["date", "pkey"])
    print(f"[p2] cold-raise tickets: {len(A):,}", flush=True)

    tcol = [c for c in A.columns if c in ("team_id", "team", "tid", "bdl_team_id")]
    if not tcol:
        lines.append("\nP2: no team column on props frame — columns: "
                     + ", ".join(list(A.columns)[:30]))
        return
    tcol = tcol[0]
    ab = pd.read_parquet(f"{PQ}/nba_absence.parquet")
    ab["date"] = pd.to_datetime(ab["date"]).dt.normalize()
    ab["tid"] = pd.to_numeric(ab["team_id"], errors="coerce")
    out_map = ab.set_index(["date", "tid"])[["fresh_n", "fresh_max_ppg"]]
    A["date_n"] = pd.to_datetime(A["date"]).dt.normalize()
    A["tid"] = pd.to_numeric(A[tcol], errors="coerce")
    j = A.join(out_map, on=["date_n", "tid"])
    hasab = j["fresh_n"].fillna(0) > 0
    bigab = j["fresh_max_ppg"].fillna(0) >= 15

    def roiline(mask, label):
        s = j[mask]
        if len(s) < 20:
            return
        win = 1 - s["y_best_under"] if False else (1 - s["y_best_over"])
        # UNDER leg: win = 1 - y (both y_best_* are coded "went over")
        dec = s["best_under_dec"]
        profit = np.where(win.astype(bool), dec - 1, -1.0)
        per = []
        for ssn, gg in s.assign(w=win, p=profit).groupby(s["season_x"]):
            per.append(f"{ssn}: {int(gg['w'].sum())}/{len(gg)} {gg['p'].mean()*100:+.0f}%")
        lines.append(f"| {label} | {len(s):,} | {win.mean()*100:.1f}% | "
                     f"{profit.mean()*100:+.1f}% | {' · '.join(per)} |")

    lines += ["\n## P2 props cold-raise UNDER — split by same-day team absence\n",
              "| cell | n | win% | ROI | per season |", "|---|---|---|---|---|"]
    roiline(pd.Series(True, index=j.index), "ALL cold-raise tickets")
    roiline(hasab, "team has FRESH absence")
    roiline(~hasab, "no fresh absence")
    roiline(bigab, "fresh 15+ppg absence")


def p3(lines):
    for sport in ("ncaab", "nba"):
        try:
            preds = pd.read_parquet(f"{PQ}/_move_model_preds_{sport}.parquet")
            g = pd.read_parquet(f"{PQ}/games_{sport}.parquet")
            frames = [pd.read_parquet(p) for p in
                      sorted(glob.glob(f"{PQ}/h1tt_{sport}_*.parquet"))]
            h1 = pd.concat(frames, ignore_index=True)
            tp = [c for c in h1.columns if "totals_h1" in c and "point" in c] or \
                 [c for c in h1.columns if c.startswith("h1_total") and "point" in c]
            if not tp:
                lines.append(f"\nP3 {sport}: no 1H total column — cols "
                             + ", ".join(list(h1.columns)[:25]))
                continue
            tp = tp[0]
            op = tp.replace("point", "over_price")
            up = tp.replace("point", "under_price")
            cons = h1.groupby("event_id").agg(
                h1_line=(tp, "median"),
                h1_over=(op, "median") if op in h1.columns else (tp, "size"),
                h1_under=(up, "median") if up in h1.columns else (tp, "size"),
                season=("season", "first") if "season" in h1.columns else (tp, "size"))
            df = g.merge(preds, on="event_id").merge(cons, on="event_id")
            df = df[df["home_h1"].notna() & df["away_h1"].notna()
                    & df["h1_line"].notna() & df["d_total"].notna()].copy()
            if "season_y" in df.columns:
                df["season"] = df["season_x"]
            h1tot = df["home_h1"] + df["away_h1"]
            for lab, mask, side in (
                    ("FG model ≥8 OVER → 1H OVER", df["d_total"] >= 8, "over"),
                    ("FG model ≥8 UNDER → 1H UNDER", df["d_total"] <= -8, "under"),
                    ("[ctl] FG model <5 → 1H follow sign",
                     df["d_total"].abs() < 5, None)):
                s = df[mask]
                if len(s) < 25:
                    continue
                if side is None:
                    sides = np.where(s["d_total"] >= 0, "over", "under")
                else:
                    sides = np.array([side] * len(s))
                tt = s["home_h1"] + s["away_h1"]
                win = np.where(sides == "over", tt > s["h1_line"], tt < s["h1_line"])
                push = tt == s["h1_line"]
                dec = np.where(sides == "over",
                               pd.to_numeric(s["h1_over"], errors="coerce").fillna(1.909),
                               pd.to_numeric(s["h1_under"], errors="coerce").fillna(1.909))
                # h1tt prices may be american — convert if magnitudes look american
                am = np.abs(dec) > 50
                dec = np.where(am, ms.am_to_dec(dec), dec)
                profit = np.where(push, 0.0, np.where(win, dec - 1, -1.0))
                n = int((~push).sum())
                per = []
                sdf = s.assign(win=win & ~push, push=push, profit=profit)
                for ssn, gg in sdf.groupby("season"):
                    m2 = int((~gg["push"]).sum())
                    if m2 >= 5:
                        per.append(f"{str(ssn)[2:5]}{str(ssn)[7:]}: "
                                   f"{int(gg['win'].sum())}/{m2} "
                                   f"{gg['profit'].mean()*100:+.0f}%")
                if n >= 25:
                    if f"P3 {sport}" not in "".join(lines[-6:]):
                        lines += [f"\n## P3 {sport.upper()} — FG total model gates the "
                                  "1H total (3 odds seasons)\n",
                                  "| cell | n | win% | ROI | per season |",
                                  "|---|---|---|---|---|"]
                    lines.append(f"| {lab} | {n:,} | {win[~push].mean()*100:.1f}% | "
                                 f"{profit[~push].mean()*100:+.1f}% | {' · '.join(per)} |")
        except Exception:
            lines.append(f"\nP3 {sport} failed: " + traceback.format_exc()[-400:])


def main():
    lines = ["# Overnight 3 — composites, props mechanism, 1H gate", ""]
    for name, fn in (("p1", p1), ("p2", p2), ("p3", p3)):
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
