#!/usr/bin/env python3
"""Overnight study 1 — MODEL x SIGNAL confluence, both sports, + steam-filter confirm.

Owner brief (2026-08-18, overnight): "see if we get even better results if any particular
signal or multiple signals favor the same side as our model."

Design, pre-registered: within the shipping model band (CBB spread 1.5-4, NBA total >=8,
NBA spread >=8), each signal implies a SIDE for the game. Cells:
  AGREE    signal side == model side  -> bet model side at T-60
  DISAGREE signal side != model side  -> bet model side at T-60 (does the signal warn?)
  SILENT   signal did not fire
Every cell is compared to the band's own unconditional performance (matched slice), never
to 50%. Signal-alone rows shown for reference. A STACK row counts how many signals agree.

Signals (all from tables on disk, sides per their vaulted/validated direction):
  CBB: big_out fresh -> fade that team; top1_out fresh -> fade; guard_out -> fade;
       p_heat top-quartile (in-season) -> fade; p_luck top-quartile (finishing above
       looks, from xq) -> fade.
  NBA: S9 dead/tanking HOME late -> back the favourite; fresh 25+ppg out -> fade depleted
       (FG direction per S8 inverted-U); p_heat top-quartile -> fade; big_out fresh -> fade.

Section Z: the CBB steam-filter candidate from MOVEMENT_MODEL_BRIEF gets its confirm —
permutation test (2,000 shuffles of the movement labels within the ship band) on the
WITH-cell vs rest win-rate gap.

Grading: T-60 median line/price. Per-season always. n floor 25. Sections wrapped in
try/except — a failed join logs and moves on. Writes OVERNIGHT1_CONFLUENCE.md.
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
OUT = os.path.join(ROOT, "OVERNIGHT1_CONFLUENCE.md")

spec = importlib.util.spec_from_file_location("ms", os.path.join(ROOT, "movement_study.py"))
ms = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ms)


def grade_cell(df, side_arr, lines, label, min_n=25):
    """side_arr: 'home'/'away' per row. Returns (n, win%, roi) and appends a row."""
    if len(df) < min_n:
        return None
    win = np.zeros(len(df), dtype=bool)
    push = np.zeros(len(df), dtype=bool)
    profit = np.zeros(len(df))
    for s in ("home", "away", "over", "under"):
        pick = side_arr == s
        if pick.sum() == 0:
            continue
        fn = ms.grade_side if s in ("home", "away") else ms.grade_total
        w, pu, pr = fn(df[pick], s)
        win[pick], push[pick], profit[pick] = w, pu, pr
    n = int((~push).sum())
    if n < min_n:
        return None
    wr, roi = win.sum() / n * 100, profit[~push].mean() * 100
    per = []
    for ssn, g in df.assign(win=win, push=push, profit=profit).groupby("season"):
        m = int((~g["push"]).sum())
        if m >= 5:
            per.append(f"{ssn[2:5]}{ssn[7:]}: {int(g['win'].sum())}/{m} "
                       f"{g['profit'].mean()*100:+.0f}%")
    lines.append(f"| {label} | {n:,} | {wr:.1f}% | {roi:+.1f}% | {' · '.join(per)} |")
    return n, wr, roi


def model_side(d):
    return np.where(d >= 0, "home", "away")


# ---------------------------------------------------------------- CBB
def cbb(lines):
    preds = pd.read_parquet(f"{PQ}/_move_model_preds_ncaab.parquet")
    mg = pd.read_parquet(f"{PQ}/movement_games_ncaab.parquet")
    g = pd.read_parquet(f"{PQ}/games_ncaab.parquet")
    idcols = [c for c in g.columns if "cbbd" in c.lower()]
    df = mg.merge(preds, on="event_id").merge(g[["event_id"] + idcols], on="event_id")
    df = df[df["home_score"].notna() & df["d_spread"].notna()].copy()
    cbbd_col = idcols[0]
    print(f"[cbb] {len(df):,} games with preds; cbbd id col = {cbbd_col}", flush=True)

    tb = pd.read_parquet(f"{PQ}/cbbd_team_box.parquet",
                         columns=["gameId", "teamId", "isHome"]).drop_duplicates(["gameId", "teamId"])
    home_map = tb[tb["isHome"]].set_index("gameId")["teamId"]
    away_map = tb[~tb["isHome"]].set_index("gameId")["teamId"]
    df["h_tid"] = df[cbbd_col].map(home_map)
    df["a_tid"] = df[cbbd_col].map(away_map)

    # ---- signal states per (gameId, teamId): True = FADE this team
    sig = {}
    fl = pd.read_parquet(f"{PQ}/player_flags_ncaab.parquet")
    fl["k"] = list(zip(fl["game_key"], fl["team_id"]))
    for name in ("big_out", "top1_out", "guard_out"):
        s = fl[fl[name] > 0.5]
        sig[name] = set(s["k"])
    ht = pd.read_parquet(f"{PQ}/ncaab_player_heat.parquet")
    ht = ht.merge(tb, left_on=["gameId", "teamId"], right_on=["gameId", "teamId"])
    thr = ht["p_heat"].quantile(0.75)
    sig["heat_hi"] = set(zip(ht.loc[ht["p_heat"] >= thr, "gameId"],
                             ht.loc[ht["p_heat"] >= thr, "teamId"]))
    xq = pd.read_parquet(f"{PQ}/shot_quality_ncaab.parquet")
    lthr = xq["p_luck"].quantile(0.75)
    sig["luck_hi"] = set(zip(xq.loc[xq["p_luck"] >= lthr, "gameId"],
                             xq.loc[xq["p_luck"] >= lthr, "teamId"]))

    band = df["d_spread"].abs().between(1.5, 4.0)
    B = df[band].copy()
    msides = model_side(B["d_spread"])
    lines += ["\n## CBB spread — shipping band 1.5-4, model side at T-60\n",
              "| cell | n | win% | ROI | per season |", "|---|---|---|---|---|"]
    grade_cell(B, msides, lines, "band UNCONDITIONAL (baseline)")

    agree_count = np.zeros(len(B), dtype=int)
    fired = np.zeros(len(B), dtype=bool)
    for name, fade_set in sig.items():
        h_fade = np.array([(gid, t) in fade_set for gid, t in zip(B[cbbd_col], B["h_tid"])])
        a_fade = np.array([(gid, t) in fade_set for gid, t in zip(B[cbbd_col], B["a_tid"])])
        sig_side = np.where(h_fade & ~a_fade, "away", np.where(a_fade & ~h_fade, "home", ""))
        has = sig_side != ""
        fired |= has
        agree = has & (sig_side == msides)
        disagree = has & (sig_side != msides)
        agree_count += agree.astype(int)
        grade_cell(B[agree], msides[agree], lines, f"{name} AGREES")
        grade_cell(B[disagree], msides[disagree], lines, f"{name} DISAGREES")
        # signal alone (all games, not just band)
        allh = np.array([(gid, t) in fade_set for gid, t in zip(df[cbbd_col], df["h_tid"])])
        alla = np.array([(gid, t) in fade_set for gid, t in zip(df[cbbd_col], df["a_tid"])])
        s_side = np.where(allh & ~alla, "away", np.where(alla & ~allh, "home", ""))
        m = s_side != ""
        grade_cell(df[m], s_side[m], lines, f"[ref] {name} ALONE, all games")
    grade_cell(B[agree_count >= 2], msides[agree_count >= 2], lines, "STACK: ≥2 signals agree")
    grade_cell(B[fired & (agree_count == 0)], msides[fired & (agree_count == 0)],
               lines, "STACK: signals fired, NONE agree")

    # ---- Z: steam-filter permutation confirm
    move = -(B["t60_spread_home_point"] - B["open_spread_home_point"])
    rel = pd.Series(np.where(B["d_spread"] >= 0, move, -move), index=B.index)
    withm = (rel >= 1.0).values
    win = np.zeros(len(B), dtype=bool)
    push = np.zeros(len(B), dtype=bool)
    for s in ("home", "away"):
        pick = msides == s
        w, pu, _ = ms.grade_side(B[pick], s)
        win[pick], push[pick] = w, pu
    ok = ~push
    gap = win[ok & ~withm].mean() - win[ok & withm].mean()
    rng = np.random.default_rng(20260818)
    null = []
    lab = withm[ok].copy()
    wv = win[ok]
    for _ in range(2000):
        rng.shuffle(lab)
        null.append(wv[~lab].mean() - wv[lab].mean())
    p = float((np.array(null) >= gap).mean())
    lines += ["", f"**Z. Steam-filter confirm:** keep-cells minus WITH-cell win gap = "
              f"{gap*100:+.2f} pts; permutation p = {p:.4f} (2,000 shuffles). "
              f"{'CONFIRMED — the filter is real.' if p < 0.05 else 'NOT confirmed at 0.05.'}"]
    print(f"[cbb] steam filter gap {gap*100:+.2f}pts p={p:.4f}", flush=True)


# ---------------------------------------------------------------- NBA
def nba(lines):
    preds = pd.read_parquet(f"{PQ}/_move_model_preds_nba.parquet")
    mg = pd.read_parquet(f"{PQ}/movement_games_nba.parquet")
    W = pd.read_parquet(f"{PQ}/_nba_wide_cache.parquet")
    idc = [c for c in W.columns if c in ("event_id", "game.id", "hid", "aid",
                                         "home_team_id", "away_team_id", "espn_game_id")]
    df = mg.merge(preds, on="event_id").merge(W[idc + ["season"]].rename(
        columns={"season": "syr"}), on="event_id", how="left")
    df = df[df["home_score"].notna()].copy()
    print(f"[nba] {len(df):,} games | id cols {idc}", flush=True)
    gid = "game.id"
    hid = "hid" if "hid" in df.columns else "home_team_id"
    aid = "aid" if "aid" in df.columns else "away_team_id"
    for c in (gid, hid, aid):
        df[c] = pd.to_numeric(df[c], errors="coerce")

    st = pd.read_parquet(f"{PQ}/nba_standings_feats.parquet")
    st["game.id"] = pd.to_numeric(st["game.id"], errors="coerce")
    df = df.merge(st, on="game.id", how="left")

    ab = pd.read_parquet(f"{PQ}/nba_absence.parquet")
    ab["k"] = list(zip(pd.to_numeric(ab["game_key"], errors="coerce"),
                       pd.to_numeric(ab["team_id"], errors="coerce")))
    fade_abs = set(ab.loc[(ab["fresh_max_ppg"] >= 25), "k"])
    fl = pd.read_parquet(f"{PQ}/player_flags_nba.parquet")
    fl["k"] = list(zip(pd.to_numeric(fl["game_key"], errors="coerce"),
                       pd.to_numeric(fl["team_id"], errors="coerce")))
    fade_big = set(fl.loc[fl["big_out"] > 0.5, "k"])
    hr = pd.read_parquet(f"{PQ}/nba_player_regression.parquet")
    thr = hr["p_heat"].quantile(0.75)
    hr["k"] = list(zip(pd.to_numeric(hr["game.id"], errors="coerce"),
                       pd.to_numeric(hr["team_id"], errors="coerce")))
    # heat table team_id is ESPN-space; map via is_home instead
    fade_heat_h = set(hr.loc[(hr["p_heat"] >= thr) & hr["is_home"], "game.id"].astype(float))
    fade_heat_a = set(hr.loc[(hr["p_heat"] >= thr) & ~hr["is_home"].astype(bool),
                             "game.id"].astype(float))

    for mkt, dcol, klo in (("spread", "d_spread", 8.0), ("total", "d_total", 8.0)):
        d = df[dcol]
        band = d.abs() >= klo
        B = df[band & d.notna()].copy()
        if mkt == "spread":
            msides = model_side(B[dcol])
        else:
            msides = np.where(B[dcol] >= 0, "over", "under")
        lines += [f"\n## NBA {mkt} — shipping band ≥{klo:.0f}, model side at T-60\n",
                  "| cell | n | win% | ROI | per season |", "|---|---|---|---|---|"]
        grade_cell(B, msides, lines, "band UNCONDITIONAL (baseline)", min_n=20)

        sigs = {}
        # S9: dead/tanking home, late -> back favourite
        late = (B["st_h_gp"] >= 50) & ((B["st_h_eliminated"] > 0.5) | (B["st_h_tank"] > 0.5))
        fav = np.where(B["t60_spread_home_point"] <= 0, "home", "away")
        sigs["S9 dead-home (side=fav)"] = np.where(late, fav, "")
        # absence 25+ppg fresh out -> fade depleted team
        h_out = np.array([(g_, t) in fade_abs for g_, t in zip(B[gid], B[hid])])
        a_out = np.array([(g_, t) in fade_abs for g_, t in zip(B[gid], B[aid])])
        sigs["star25+ out (fade)"] = np.where(h_out & ~a_out, "away",
                                              np.where(a_out & ~h_out, "home", ""))
        h_big = np.array([(g_, t) in fade_big for g_, t in zip(B[gid], B[hid])])
        a_big = np.array([(g_, t) in fade_big for g_, t in zip(B[gid], B[aid])])
        sigs["big out (fade)"] = np.where(h_big & ~a_big, "away",
                                          np.where(a_big & ~h_big, "home", ""))
        h_heat = B[gid].isin(fade_heat_h).values
        a_heat = B[gid].isin(fade_heat_a).values
        sigs["heat hi (fade)"] = np.where(h_heat & ~a_heat, "away",
                                          np.where(a_heat & ~h_heat, "home", ""))
        agree_count = np.zeros(len(B), dtype=int)
        for name, s_side in sigs.items():
            if mkt == "total":
                # for the total, a fade-side signal has no over/under meaning except
                # absence: star out -> UNDER lean (points leave the game)
                if "out" not in name:
                    continue
                has = s_side != ""
                t_side = np.where(has, "under", "")
                agree = has & (t_side == msides)
                disagree = has & (t_side != msides) & has
                grade_cell(B[agree], msides[agree], lines, f"{name}→UNDER AGREES", min_n=20)
                grade_cell(B[disagree], msides[disagree], lines, f"{name}→UNDER DISAGREES", min_n=20)
                continue
            has = s_side != ""
            agree = has & (s_side == msides)
            disagree = has & (s_side != msides)
            agree_count += agree.astype(int)
            grade_cell(B[agree], msides[agree], lines, f"{name} AGREES", min_n=20)
            grade_cell(B[disagree], msides[disagree], lines, f"{name} DISAGREES", min_n=20)
        if mkt == "spread":
            grade_cell(B[agree_count >= 1], msides[agree_count >= 1], lines,
                       "STACK: ≥1 signal agrees", min_n=20)


def main():
    lines = ["# Overnight 1 — model x signal confluence (six seasons)", "",
             "Every cell vs its band's own baseline. Signal directions are the vaulted ones. "
             "Cells from this menu need confirm runs before vaulting.", ""]
    for name, fn in (("cbb", cbb), ("nba", nba)):
        try:
            fn(lines)
        except Exception:
            lines += [f"\n**{name} SECTION FAILED:**", "```",
                      traceback.format_exc()[-1500:], "```"]
            print(f"[{name}] FAILED", traceback.format_exc()[-800:], flush=True)
    with open(OUT, "w") as f:
        f.write("\n".join(lines) + "\n")
    print(f"wrote {OUT}", flush=True)


if __name__ == "__main__":
    main()
