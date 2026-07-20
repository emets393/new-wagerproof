#!/usr/bin/env python3
"""CBB sides round 4 (CBB_SIDES_BRIEF4.md): narrative fades, schedule spots,
rematch dynamics, coverage subsets.

Narrative-fade hypothesis (from the guard/press result): the market over-
prices LOUD stories. Candidates: revenge (lost the first meeting badly),
letdown (just upset a KenPom top-25), lookahead (top-15 opponent next),
long road trips, November MTE tournaments.

Coverage hypothesis: games with few posting books (n_books small) are softer —
retest the KenPom-edge signal inside the low-coverage subset.

All strictly-prior information (schedules are known pregame → lookahead is
leak-safe). T-60 prices. BE 52.4%.
"""
import glob
import os

import numpy as np
import pandas as pd

from regression_study import team_games

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "data", "parquet")


def bet(df, win, push, dec, label, lines, min_n=40):
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


def load():
    t = team_games("ncaab")   # per team-game: cover/push/margin/team_spread/prices
    tb = pd.read_parquet(f"{OUT}/cbbd_team_box.parquet").drop_duplicates(
        ["gameId", "teamId"])[["gameId", "teamId", "team", "opponent",
                               "conferenceGame", "neutralSite", "conference"]]
    # team_key in team_games = "{teamId}_{season}"
    t["team_id"] = t["team_key"].str.split("_").str[0].astype(int)
    t = t.merge(tb.rename(columns={"gameId": "game_key", "teamId": "team_id"}),
                on=["game_key", "team_id"], how="left")

    feats = pd.read_parquet(f"{OUT}/ncaab_model_features.parquet")
    if "season" not in feats.columns:
        feats = feats.rename(columns={"season_x": "season"})
    kp = feats[["event_id", "home_kp_rank", "away_kp_rank"]]
    t = t.merge(kp, on="event_id", how="left")
    t["own_rank"] = np.where(t["is_home"], t["home_kp_rank"], t["away_kp_rank"])
    t["opp_rank"] = np.where(t["is_home"], t["away_kp_rank"], t["home_kp_rank"])

    oc_frames = []
    for p in sorted(glob.glob(f"{OUT}/openclose_ncaab_*.parquet")):
        oc_frames.append(pd.read_parquet(p, columns=["event_id", "n_books"]))
    nb = pd.concat(oc_frames).drop_duplicates("event_id")
    t = t.merge(nb, on="event_id", how="left")

    t = t.sort_values(["team_key", "date"]).reset_index(drop=True)
    g = t.groupby("team_key")
    t["prev_opp_rank"] = g["opp_rank"].shift(1)
    t["prev_won"] = g["margin"].shift(1) > 0
    t["prev_margin"] = g["margin"].shift(1)
    t["next_opp_rank"] = g["opp_rank"].shift(-1)  # schedule known pregame — leak-safe
    away = (~t["is_home"]).astype(int)
    t["road_streak"] = away.groupby(t["team_key"]).transform(
        lambda s: s.groupby((s == 0).cumsum()).cumsum())
    t["month"] = pd.to_datetime(t["date"]).dt.month
    return t


def main():
    t = load()
    lines = ["# CBB Sides Brief #4 — narrative fades, spots, rematches, coverage",
             "",
             f"{len(t):,} team-games. T-60 prices. BE 52.4%."]
    push = t["push"]
    own = t["own_price"]
    opp = t["opp_price"]

    # ---- A: narrative fades ----
    lines.append("\n## A — narrative spots (fade the story?)\n")
    lines.append("| signal | n | win% | ROI | per season |")
    lines.append("|---|---|---|---|---|")
    letdown = (t["prev_won"]) & (t["prev_opp_rank"] <= 25) & (t["own_rank"] > 40)
    lookahead = (t["next_opp_rank"] <= 15) & (t["opp_rank"] >= 60)
    for label, mask in (
            ("LETDOWN: unranked just beat KP top-25", letdown),
            ("LETDOWN + now favored", letdown & (t["team_spread"] < 0)),
            ("LOOKAHEAD: top-15 next, weak opp now", lookahead),
            ("LOOKAHEAD + favored ≥7 now", lookahead & (t["team_spread"] <= -7)),
            ("BLOWOUT WIN last game (≥25)", t["prev_margin"] >= 25),
            ("BLOWOUT LOSS last game (≤-25)", t["prev_margin"] <= -25)):
        sub = t[mask]
        bet(sub, ~sub["cover"] & ~push[mask], push[mask], opp[mask], f"{label} → FADE", lines)
        bet(sub, sub["cover"], push[mask], own[mask], f"{label} → BACK", lines)

    # ---- B: rematch / revenge ----
    lines.append("\n## B — conference rematches (same opponent, same season)\n")
    lines.append("| signal | n | win% | ROI | per season |")
    lines.append("|---|---|---|---|---|")
    t2 = t.sort_values(["team_key", "date"])
    t2["pair"] = t2["team_key"] + "|" + t2["opponent"].astype(str)
    gp = t2.groupby("pair")
    t2["meet_no"] = gp.cumcount() + 1
    t2["m1_margin"] = gp["margin"].shift(1)
    t2["m1_cover"] = gp["cover"].shift(1)
    rematch = t2["meet_no"] == 2
    for label, mask in (
            ("REVENGE: lost meeting 1 by 15+", rematch & (t2["m1_margin"] <= -15)),
            ("REVENGE: lost meeting 1 by 15+, now HOME",
             rematch & (t2["m1_margin"] <= -15) & t2["is_home"]),
            ("WON meeting 1 by 15+ (repeat blowout?)", rematch & (t2["m1_margin"] >= 15)),
            ("COVERED meeting 1 (ATS repeat?)", rematch & (t2["m1_cover"] == True)),
            ("FAILED to cover meeting 1", rematch & (t2["m1_cover"] == False))):
        sub = t2[mask]
        bet(sub, sub["cover"], t2["push"][mask], t2["own_price"][mask],
            f"{label} → BACK", lines)
        bet(sub, ~sub["cover"] & ~t2["push"][mask], t2["push"][mask],
            t2["opp_price"][mask], f"{label} → FADE", lines)

    # ---- C: schedule spots ----
    lines.append("\n## C — schedule spots\n")
    lines.append("| signal | n | win% | ROI | per season |")
    lines.append("|---|---|---|---|---|")
    for label, mask in (
            ("road game 3+ in a row", (t["road_streak"] >= 3) & ~t["is_home"]),
            ("road game 4+ in a row", (t["road_streak"] >= 4) & ~t["is_home"]),
            ("November NEUTRAL site (MTE)", (t["month"] == 11) & (t["neutralSite"] == True)),
            ("neutral + BOTH KP top-50 (marquee MTE)",
             (t["month"] == 11) & (t["neutralSite"] == True)
             & (t["own_rank"] <= 50) & (t["opp_rank"] <= 50))):
        sub = t[mask]
        bet(sub, sub["cover"], push[mask], own[mask], f"{label} → BACK", lines)
        bet(sub, ~sub["cover"] & ~push[mask], push[mask], opp[mask], f"{label} → FADE", lines)

    # ---- D: coverage subsets ----
    lines.append("\n## D — market-coverage subsets (n_books)\n")
    lines.append("| signal | n | win% | ROI | per season |")
    lines.append("|---|---|---|---|---|")
    feats = pd.read_parquet(f"{OUT}/ncaab_model_features.parquet")
    if "season" not in feats.columns:
        feats = feats.rename(columns={"season_x": "season"})
    kp_edge = feats[["event_id"]].copy()
    # KenPom fanmatch margin edge, rebuilt quickly from kenpom_edge_study output frame
    from kenpom_edge_study import load as kload
    ke = kload()[["event_id", "spread_edge"]]
    t3 = t.merge(ke, on="event_id", how="left")
    t3["own_edge"] = np.where(t3["is_home"], t3["spread_edge"], -t3["spread_edge"])
    low = t3["n_books"] <= 6
    high = t3["n_books"] >= 10
    for label, mask in (
            ("LOW coverage (≤6 books): KP likes team ≥3 → BACK", low & (t3["own_edge"] >= 3)),
            ("HIGH coverage (≥10): KP likes team ≥3 → BACK", high & (t3["own_edge"] >= 3)),
            ("LOW coverage: KP likes team ≥5 → BACK", low & (t3["own_edge"] >= 5)),
            ("LOW coverage home dog → BACK", low & (t3["team_spread"] > 0) & t3["is_home"]),
            ("HIGH coverage home dog → BACK", high & (t3["team_spread"] > 0) & t3["is_home"])):
        sub = t3[mask]
        bet(sub, sub["cover"], t3["push"][mask], t3["own_price"][mask], label, lines)

    path = os.path.join(ROOT, "CBB_SIDES_BRIEF4.md")
    with open(path, "w") as f:
        f.write("\n".join(lines) + "\n")
    print(f"wrote {path}", flush=True)


if __name__ == "__main__":
    main()
