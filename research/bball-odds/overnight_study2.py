#!/usr/bin/env python3
"""Overnight study 2 — the untested-data sweep, both sports, six seasons.

Every battery below is a construction we have the data for and have never tested. Each is
pre-registered HERE with its mechanism before any number is computed; thresholds are stated
once, not swept. All features are strictly-pregame (trailing shift-1, or schedule facts);
grading is the T-60 median line/price; every cell vs its slice's own baseline; per-season
always; n floor 30. Cells from this menu need confirm runs before vaulting.

CBB batteries:
  C1 VENUE DRAW (attendance_ncaab, never used anywhere): realized attendance is POSTGAME —
     the pregame feature is the home team's TRAILING median attendance (shift-1, in-season).
     Mechanism: books price a fairly standing HCA; teams that draw nobody should have less
     of it. Test: bottom-quartile draw -> fade HOME on spread; top-quartile -> back HOME.
  C2 OT HANGOVER (game_ot_ncaab): team played OT in its PREVIOUS game (<=3 days ago).
     Mechanism: extra minutes + emotional game -> flat next game. Test: fade on spread;
     game total UNDER when either team is post-OT.
  C3 SCHEDULE DENSITY: 3rd game in 4 days (MTE weeks). Mechanism: legs. Test: fade the
     dense team on spread; UNDER if both dense.
  C4 REMATCH ADJUSTMENT: conference rematch (2nd meeting of season). Mechanism: losing
     coach adjusts; market anchors on meeting 1. Test: back the meeting-1 LOSER on spread
     in meeting 2 (straight-up loser).
  C5 LOOKAHEAD TRAP: current opponent weak (KenPom gap >= 8) AND next game vs a top-15
     KenPom team within 4 days. Mechanism: focus leaks forward. Test: fade the distracted
     team vs the spread.
NBA batteries:
  N1 CUMULATIVE LOAD x TOTAL (nba_travel, a CUT model family but never a standalone state):
     both teams top-quartile km_14d -> UNDER. Mechanism: tired legs score less; the total
     model cut travel so this info is NOT in the shipping number.
  N2 OT HANGOVER: OT last game <=2 days ago -> fade on spread, UNDER on total.
  N3 DENSITY: 4-in-6 team -> fade on spread; both-dense -> UNDER.
  N4 LOOKAHEAD: opponent win_pct <= .35 now, next opponent win_pct >= .65 within 3 days ->
     fade the favourite in the trap game.
  N5 DEAD-TEAM TOTALS (S9's table, never crossed with totals): late season, either team
     eliminated/tanking -> pre-registered direction OVER (dead teams stop defending first;
     defense is effort, offense is habit).
Writes OVERNIGHT2_UNTESTED.md.
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
OUT = os.path.join(ROOT, "OVERNIGHT2_UNTESTED.md")

spec = importlib.util.spec_from_file_location("ms", os.path.join(ROOT, "movement_study.py"))
ms = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ms)


def row(df, side, kind, lines, label, min_n=30):
    if len(df) < min_n:
        return
    fn = ms.grade_side if kind == "spread" else ms.grade_total
    win, push, profit = fn(df, side) if isinstance(side, str) else (None, None, None)
    if isinstance(side, str):
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


def row_sides(df, sides, kind, lines, label, min_n=30):
    """Per-row side array."""
    if len(df) < min_n:
        return
    win = np.zeros(len(df), dtype=bool)
    push = np.zeros(len(df), dtype=bool)
    profit = np.zeros(len(df))
    opts = ("home", "away") if kind == "spread" else ("over", "under")
    fn = ms.grade_side if kind == "spread" else ms.grade_total
    for s in opts:
        pick = sides == s
        if pick.sum() == 0:
            continue
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


def team_schedule(g, hcol, acol):
    """Long per-team-game table with date, from a games frame."""
    h = g[["event_id", "season", "date", hcol]].rename(columns={hcol: "team"})
    h["is_home"] = True
    a = g[["event_id", "season", "date", acol]].rename(columns={acol: "team"})
    a["is_home"] = False
    t = pd.concat([h, a], ignore_index=True).sort_values(["team", "date"])
    grp = t.groupby(["team", "season"])
    t["prev_date"] = grp["date"].shift(1)
    t["days_rest"] = (t["date"] - t["prev_date"]).dt.days
    t["g_in_4d"] = [0] * len(t)
    # games in trailing 4/6 days including today
    for w, col in ((4, "g4"), (6, "g6")):
        t[col] = grp["date"].transform(
            lambda s: pd.Series(
                [(s <= d).sum() - (s <= d - pd.Timedelta(days=w)).sum() for d in s],
                index=s.index))
    t["next_date"] = grp["date"].shift(-1)
    t["next_event"] = grp["event_id"].shift(-1)
    return t


def cbb(lines):
    g = pd.read_parquet(f"{PQ}/games_ncaab.parquet")
    idcols = [c for c in g.columns if "cbbd" in c.lower()]
    cbbd = idcols[0]
    mg = pd.read_parquet(f"{PQ}/movement_games_ncaab.parquet").drop(
        columns=["home_score", "away_score", "home_team", "away_team", "season",
                 "home_h1", "away_h1", "commence_time"], errors="ignore")
    g["date"] = pd.to_datetime(g["commence_time"]).dt.tz_localize(None).dt.normalize() \
        if "commence_time" in g.columns else pd.to_datetime(g["date_et"])
    df = g.merge(mg, on="event_id")
    df = df[df["home_score"].notna()].copy()
    df["date"] = pd.to_datetime(df["date"])
    print(f"[cbb] {len(df):,} games", flush=True)

    # ---------- C1 venue draw
    try:
        att = pd.read_parquet(f"{PQ}/attendance_ncaab.parquet")
        d1 = df.merge(att, left_on=cbbd, right_on="cbbd_id", how="left")
        d1 = d1.sort_values("date")
        # trailing home-team draw, shift-1 inside season
        d1["draw"] = d1.groupby(["home_team", "season"])["attendance"].transform(
            lambda s: s.shift(1).expanding(min_periods=3).median())
        qlo = d1.groupby("season")["draw"].transform(lambda s: s.quantile(0.25))
        qhi = d1.groupby("season")["draw"].transform(lambda s: s.quantile(0.75))
        lines += ["\n## C1 CBB venue draw (trailing median home attendance)\n",
                  "| cell | n | win% | ROI | per season |", "|---|---|---|---|---|"]
        row(d1[d1["draw"] <= qlo], "away", "spread", lines, "low-draw home → bet AWAY")
        row(d1[d1["draw"] >= qhi], "home", "spread", lines, "high-draw home → bet HOME")
        row(d1[d1["draw"].notna()], "away", "spread", lines, "[base] any-draw → AWAY")
    except Exception:
        lines.append("C1 failed: " + traceback.format_exc()[-300:])

    # ---------- C2 OT hangover
    try:
        ot = pd.read_parquet(f"{PQ}/game_ot_ncaab.parquet")
        ot_ids = set(ot.loc[ot["went_ot"], "gameId"])
        sched = team_schedule(df, "home_team", "away_team")
        sched = sched.merge(df[["event_id", cbbd]], on="event_id")
        sched["was_ot"] = sched[cbbd].isin(ot_ids)
        grp = sched.sort_values("date").groupby(["team", "season"])
        sched["prev_ot"] = grp["was_ot"].shift(1).fillna(False)
        po = sched[sched["prev_ot"] & (sched["days_rest"] <= 3)]
        m = df.merge(po[["event_id", "team", "is_home"]], on="event_id")
        lines += ["\n## C2 CBB OT hangover (prev game OT, ≤3 days)\n",
                  "| cell | n | win% | ROI | per season |", "|---|---|---|---|---|"]
        row_sides(m, np.where(m["is_home"], "away", "home"), "spread", lines,
                  "post-OT team → fade on spread")
        row(m, "under", "total", lines, "post-OT team in game → UNDER")
        row(df, "under", "total", lines, "[base] all games UNDER")
    except Exception:
        lines.append("C2 failed: " + traceback.format_exc()[-300:])

    # ---------- C3 density
    try:
        sched = team_schedule(df, "home_team", "away_team")
        dense = sched[sched["g4"] >= 3]
        m = df.merge(dense[["event_id", "is_home"]], on="event_id")
        lines += ["\n## C3 CBB 3-in-4 density\n",
                  "| cell | n | win% | ROI | per season |", "|---|---|---|---|---|"]
        row_sides(m, np.where(m["is_home"], "away", "home"), "spread", lines,
                  "dense team → fade on spread")
        both = df[df["event_id"].isin(
            dense.groupby("event_id").size().pipe(lambda s: s[s >= 2]).index)]
        row(both, "under", "total", lines, "BOTH dense → UNDER")
    except Exception:
        lines.append("C3 failed: " + traceback.format_exc()[-300:])

    # ---------- C4 rematch
    try:
        df["pair"] = np.where(df["home_team"] < df["away_team"],
                              df["home_team"] + "|" + df["away_team"],
                              df["away_team"] + "|" + df["home_team"])
        df = df.sort_values("date")
        df["meet_n"] = df.groupby(["pair", "season"]).cumcount() + 1
        first = df[df["meet_n"] == 1][["pair", "season", "home_team", "home_score",
                                       "away_score"]].rename(
            columns={"home_team": "m1_home", "home_score": "m1_hs", "away_score": "m1_as"})
        second = df[df["meet_n"] == 2].merge(first, on=["pair", "season"])
        m1_winner = np.where(second["m1_hs"] > second["m1_as"],
                             second["m1_home"],
                             np.where(second["home_team"] == second["m1_home"],
                                      second["away_team"], second["home_team"]))
        loser_is_home = m1_winner != second["home_team"]
        lines += ["\n## C4 CBB rematch (2nd meeting): back meeting-1 LOSER\n",
                  "| cell | n | win% | ROI | per season |", "|---|---|---|---|---|"]
        row_sides(second, np.where(loser_is_home, "home", "away"), "spread", lines,
                  "meeting-1 loser ATS in meeting 2")
        big = (second["m1_hs"] - second["m1_as"]).abs() >= 15
        row_sides(second[big], np.where(loser_is_home[big], "home", "away"), "spread",
                  lines, "loser by 15+ in meeting 1")
    except Exception:
        lines.append("C4 failed: " + traceback.format_exc()[-300:])

    # ---------- C5 lookahead
    try:
        kp = pd.read_parquet(f"{PQ}/kenpom_archive_daily.parquet")
        kcol = [c for c in kp.columns if c.lower() in ("adjem", "adj_em", "em")]
        rcol = [c for c in kp.columns if "rank" in c.lower() and "em" in c.lower()] or \
               [c for c in kp.columns if c.lower() == "rankadjem"]
        nm = _kp_map()
        kp["team_n"] = kp["TeamName"].map(lambda x: nm.get(x, x))
        kp["d"] = pd.to_datetime(kp["ArchiveDate"])
        latest = kp.sort_values("d").groupby(["team_n", "Season"]).tail(1)
        em = dict(zip(zip(latest["team_n"], latest["Season"]), latest[kcol[0]]))
        syr = df["season"].str[:4].astype(int) + 1
        df["h_em"] = [em.get((t, s), np.nan) for t, s in zip(df["home_team"], syr)]
        df["a_em"] = [em.get((t, s), np.nan) for t, s in zip(df["away_team"], syr)]
        sched = team_schedule(df, "home_team", "away_team")
        sched["syr"] = sched["season"].str[:4].astype(int) + 1
        sched["own_em"] = [em.get((t, s), np.nan) for t, s in zip(sched["team"], sched["syr"])]
        opp = df.set_index("event_id")
        sched["opp_team"] = np.where(sched["is_home"],
                                     sched["event_id"].map(opp["away_team"]),
                                     sched["event_id"].map(opp["home_team"]))
        sched["opp_em"] = [em.get((t, s), np.nan)
                           for t, s in zip(sched["opp_team"], sched["syr"])]
        nxt = sched.set_index(["team", "season", "event_id"])
        sched["next_opp_em"] = sched.groupby(["team", "season"])["opp_em"].shift(-1)
        sched["days_to_next"] = (sched["next_date"] - sched["date"]).dt.days
        trap = sched[(sched["own_em"] - sched["opp_em"] >= 8)
                     & (sched["next_opp_em"] >= sched["own_em"] + 3)
                     & (sched["days_to_next"] <= 4)]
        m = df.merge(trap[["event_id", "is_home"]], on="event_id")
        lines += ["\n## C5 CBB lookahead trap (big fav now, tougher game ≤4d away)\n",
                  "| cell | n | win% | ROI | per season |", "|---|---|---|---|---|"]
        row_sides(m, np.where(m["is_home"], "away", "home"), "spread", lines,
                  "fade the distracted favourite")
    except Exception:
        lines.append("C5 failed: " + traceback.format_exc()[-300:])


def _kp_map():
    try:
        import name_maps
        return dict(name_maps.kp_to_cbbd)
    except Exception:
        return {}


def nba(lines):
    mg = pd.read_parquet(f"{PQ}/movement_games_nba.parquet")
    W = pd.read_parquet(f"{PQ}/_nba_wide_cache.parquet")
    keep = [c for c in ("event_id", "game.id", "hid", "aid", "home_team_id",
                        "away_team_id", "date") if c in W.columns]
    df = mg.merge(W[keep], on="event_id", how="inner")
    st = pd.read_parquet(f"{PQ}/nba_standings_feats.parquet")
    st["game.id"] = pd.to_numeric(st["game.id"], errors="coerce")
    if "game.id" in df.columns:
        df["game.id"] = pd.to_numeric(df["game.id"], errors="coerce")
        df = df.merge(st, on="game.id", how="left")
    df = df[df["home_score"].notna()].copy()
    df["date"] = pd.to_datetime(df["date"] if "date" in keep
                                else df["commence_time"]).dt.tz_localize(None)
    hid = "hid" if "hid" in df.columns else "home_team_id"
    aid = "aid" if "aid" in df.columns else "away_team_id"
    gid = "game.id"
    for c in (gid, hid, aid):
        df[c] = pd.to_numeric(df[c], errors="coerce")
    print(f"[nba] {len(df):,} games", flush=True)

    # ---------- N1 load x total
    try:
        tv = pd.read_parquet(f"{PQ}/nba_travel.parquet")
        tv["k"] = list(zip(pd.to_numeric(tv["bdl_id"], errors="coerce"),
                           pd.to_numeric(tv["team_id"], errors="coerce")))
        km = dict(zip(tv["k"], tv["km_14d"]))
        df["h_km"] = [km.get((g_, t), np.nan) for g_, t in zip(df[gid], df[hid])]
        df["a_km"] = [km.get((g_, t), np.nan) for g_, t in zip(df[gid], df[aid])]
        qh = df.groupby("season")["h_km"].transform(lambda s: s.quantile(0.75))
        qa = df.groupby("season")["a_km"].transform(lambda s: s.quantile(0.75))
        both = df[(df["h_km"] >= qh) & (df["a_km"] >= qa)]
        lines += ["\n## N1 NBA cumulative load (both teams top-quartile km_14d)\n",
                  "| cell | n | win% | ROI | per season |", "|---|---|---|---|---|"]
        row(both, "under", "total", lines, "both heavy-travel → UNDER")
        row(df, "under", "total", lines, "[base] all games UNDER")
    except Exception:
        lines.append("N1 failed: " + traceback.format_exc()[-300:])

    # ---------- N2 OT hangover + N3 density (from pbp OT + schedule)
    try:
        frames = []
        import glob as _g
        for p in sorted(_g.glob(f"{PQ}/../raw/nba_pbp/pbp_*.parquet")):
            d = pd.read_parquet(p, columns=["game_id", "period_number"])
            frames.append(d.groupby("game_id")["period_number"].max().reset_index())
        maxp = pd.concat(frames).drop_duplicates("game_id")
        ot_espn = set(maxp.loc[maxp["period_number"] > 4, "game_id"].astype(str))
        cw = pd.read_parquet(f"{PQ}/nba_game_crosswalk.parquet")
        espn_of = dict(zip(pd.to_numeric(cw["bdl_game_id"], errors="coerce"),
                           cw["espn_game_id"].astype(str)))
        sched = team_schedule(df.assign(h=df[hid], a=df[aid]), "h", "a")
        sched = sched.merge(df[["event_id", gid]], on="event_id")
        sched["espn"] = sched[gid].map(espn_of)
        sched["was_ot"] = sched["espn"].isin(ot_espn)
        grp = sched.sort_values("date").groupby(["team", "season"])
        sched["prev_ot"] = grp["was_ot"].shift(1).fillna(False)
        po = sched[sched["prev_ot"] & (sched["days_rest"] <= 2)]
        m = df.merge(po[["event_id", "is_home"]], on="event_id")
        lines += ["\n## N2 NBA OT hangover (prev game OT, ≤2 days)\n",
                  "| cell | n | win% | ROI | per season |", "|---|---|---|---|---|"]
        row_sides(m, np.where(m["is_home"], "away", "home"), "spread", lines,
                  "post-OT team → fade on spread")
        row(m, "under", "total", lines, "post-OT game → UNDER")
        dense = sched[sched["g6"] >= 4]
        m = df.merge(dense[["event_id", "is_home"]], on="event_id")
        lines += ["\n## N3 NBA 4-in-6 density\n",
                  "| cell | n | win% | ROI | per season |", "|---|---|---|---|---|"]
        row_sides(m, np.where(m["is_home"], "away", "home"), "spread", lines,
                  "4-in-6 team → fade on spread")
        both = df[df["event_id"].isin(
            dense.groupby("event_id").size().pipe(lambda s: s[s >= 2]).index)]
        row(both, "under", "total", lines, "BOTH 4-in-6 → UNDER")
    except Exception:
        lines.append("N2/N3 failed: " + traceback.format_exc()[-300:])

    # ---------- N4 lookahead
    try:
        sched = team_schedule(df.assign(h=df[hid], a=df[aid]), "h", "a")
        wp = {}
        for pre, tid in (("st_h", hid), ("st_a", aid)):
            col = f"{pre}_win_pct"
            if col in df.columns:
                for g_, t, v in zip(df[gid], df[tid], df[col]):
                    wp[(g_, t)] = v
        sched = sched.merge(df[["event_id", gid]], on="event_id")
        opp = df.set_index("event_id")
        sched["opp"] = np.where(sched["is_home"], sched["event_id"].map(opp[aid]),
                                sched["event_id"].map(opp[hid]))
        sched["opp_wp"] = [wp.get((g_, t), np.nan) for g_, t in zip(sched[gid], sched["opp"])]
        grp = sched.sort_values("date").groupby(["team", "season"])
        sched["next_opp_wp"] = grp["opp_wp"].shift(-1)
        sched["days_to_next"] = (grp["date"].shift(-1) - sched["date"]).dt.days
        trap = sched[(sched["opp_wp"] <= 0.35) & (sched["next_opp_wp"] >= 0.65)
                     & (sched["days_to_next"] <= 3)]
        m = df.merge(trap[["event_id", "is_home"]], on="event_id")
        lines += ["\n## N4 NBA lookahead trap\n",
                  "| cell | n | win% | ROI | per season |", "|---|---|---|---|---|"]
        row_sides(m, np.where(m["is_home"], "away", "home"), "spread", lines,
                  "fade the trap-game favourite side")
    except Exception:
        lines.append("N4 failed: " + traceback.format_exc()[-300:])

    # ---------- N5 dead-team totals
    try:
        late = df[(df["st_h_gp"] >= 50)]
        dead = late[(late["st_h_eliminated"] > 0.5) | (late["st_h_tank"] > 0.5)
                    | (late["st_a_eliminated"] > 0.5) | (late["st_a_tank"] > 0.5)] \
            if "st_a_eliminated" in df.columns else \
            late[(late["st_h_eliminated"] > 0.5) | (late["st_h_tank"] > 0.5)]
        lines += ["\n## N5 NBA dead-team totals (late, either team dead → OVER "
                  "pre-registered)\n",
                  "| cell | n | win% | ROI | per season |", "|---|---|---|---|---|"]
        row(dead, "over", "total", lines, "dead-team game → OVER")
        row(dead, "under", "total", lines, "[mirror] dead-team game → UNDER")
        row(late, "over", "total", lines, "[base] all late games → OVER")
    except Exception:
        lines.append("N5 failed: " + traceback.format_exc()[-300:])


def main():
    lines = ["# Overnight 2 — untested constructions (six seasons)", "",
             "Pre-registered batteries; thresholds stated once in the script header. "
             "T-60 grading, per-season, slice baselines. Menu → confirm before vaulting.", ""]
    for name, fn in (("cbb", cbb), ("nba", nba)):
        try:
            fn(lines)
        except Exception:
            lines += [f"\n**{name} SECTION FAILED:**", "```",
                      traceback.format_exc()[-1500:], "```"]
            print(f"[{name}] FAILED", flush=True)
    with open(OUT, "w") as f:
        f.write("\n".join(lines) + "\n")
    print(f"wrote {OUT}", flush=True)


if __name__ == "__main__":
    main()
