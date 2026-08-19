#!/usr/bin/env python3
"""Movement x MODEL interactions — the MLB shape, on the six-season basketball warehouse.

Brief #2 closed standalone movement: priced from every angle. What paid in MLB was never
movement alone but movement CONDITIONED on the model ([[mlb-line-movement-signals]]): line
drop + model small edge = follow the model; line drop + model screaming = fade. This is
that matrix for the four basketball market-sport combos we own an originator for.

THE MATRIX, pre-registered (MLB priors, stated before running):
  rows    = model edge bucket (the shipping cuts: CBB spread 1.5-4 / 4+; NBA total & spread
            5-8 / 8+; small-edge row shown for completeness)
  columns = movement RELATIVE TO THE MODEL'S SIDE, open->T-60: WITH >=1.0 pt, FLAT <1.0,
            AGAINST >=1.0 pt
  bet     = always the model's side at T-60 (the matrix only conditions)
Readings we expect if MLB transfers: WITH-column >= unconditional (steam confirms);
AGAINST x small edge worse (market knows); AGAINST x screaming edge is where MLB flipped
to fade — if that cell is deeply negative here, the fade becomes a candidate, not a rule.

Fits: the six-season configs exactly as validated in cbb_six_seasons.py / nba_six_seasons.py
(CBB recent-era feature gate 381 feats hl365; NBA spread CORE hl120, total T1 hl180), ONE
target (no nulls — cells are read against their own in-slice base + per-season consistency,
and any cell promoted from this menu must then clear its own pre-registered confirm run).
Predictions cached to data/parquet/_move_model_preds_{sport}.parquet — delete to refit.

Grading: T-60 line and median price, per nfl-backtest-grading-framework (the trigger needs
both the model number and the T-60 line, so T-60 is the honest bettable moment).
Writes MOVEMENT_MODEL_BRIEF.md.
"""
import importlib.util
import os
import warnings

import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")

ROOT = os.path.dirname(os.path.abspath(__file__))
PQ = os.path.join(ROOT, "data", "parquet")
OUT = os.path.join(ROOT, "MOVEMENT_MODEL_BRIEF.md")


def _mod(name, path):
    spec = importlib.util.spec_from_file_location(name, os.path.join(ROOT, path))
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


# ---------------------------------------------------------------- CBB fits (spread + total)
def cbb_preds():
    cache = os.path.join(PQ, "_move_model_preds_ncaab.parquet")
    if os.path.exists(cache):
        return pd.read_parquet(cache)
    cp = _mod("cp", "cbb_panel.py")
    D, feat, blocks = cp.build_frame()
    recent = D["season"].isin(("2022-23", "2023-24", "2024-25", "2025-26"))
    bad = cp.MARKET | cp.OUTCOME | cp.IDS
    feat2 = [c for c in D.columns
             if c not in bad and not c.startswith(("y_", "open_", "t24_", "t4_", "t60_",
                                                   "h1_", "tt_"))
             and pd.api.types.is_numeric_dtype(D[c])
             and D.loc[recent, c].notna().mean() > 0.55]
    for c in ("conferenceGame", "neutralSite"):
        D[c] = D[c].astype(float)
        if c not in feat2:
            feat2.append(c)
    cp.assert_originator(feat2)
    P, fcols = cp.build_panel(D, feat2)
    P["_yfg"] = P["pts"].astype(float) - P["impl"].astype(float)
    G = D.set_index("event_id")
    print(f"[cbb] fitting {len(fcols)} feats, {len(P):,} rows", flush=True)
    pred = cp.pa.ridge_multi(P[fcols].astype(float), P["date"], [P["_yfg"]],
                             min_train=cp.MIN_TRAIN, refit_days=cp.REFIT_DAYS,
                             half_life=cp.HL_FG)[0]
    t = P.assign(p=pred)[["event_id", "team_row", "p"]]
    g = t.pivot(index="event_id", columns="team_row", values="p").reindex(G.index)
    out = pd.DataFrame({"event_id": G.index,
                        "d_spread": (g["home"] - g["away"]).values,
                        "d_total": (g["home"] + g["away"]).values})
    out.to_parquet(cache, index=False)
    return out


# ---------------------------------------------------------------- NBA fits (spread + total)
def nba_preds():
    cache = os.path.join(PQ, "_move_model_preds_nba.parquet")
    if os.path.exists(cache):
        return pd.read_parquet(cache)
    pr = _mod("pr", "nba_prune.py")
    tp = _mod("tp", "nba_total_prune.py")
    pa, P, G, cols = pr.load()
    fam = pd.Series({c: pr.famof(c) for c in cols})
    SPREAD_CUT = ["misc", "style", "schedule", "absence", "usage", "rot_flags", "adj_eff",
                  "form", "nets", "dims", "travel", "raw_box", "talent", "ratings",
                  "pace_ix", "standings"]
    TOTAL_CUT = ["raw_box", "rot_flags", "travel"]
    sgn = np.where(P["team_row"] == "home", 1.0, -1.0)
    y_sp = pd.Series(P["event_id"].map(G["y_fg_margin"]).astype(float) * sgn, index=P.index)
    pts = np.where(P["team_row"] == "home", P["event_id"].map(G["y_home_pts"]),
                   P["event_id"].map(G["y_away_pts"]))
    y_tot = pd.Series(pts.astype(float), index=P.index)

    use_sp = [c for c in cols if fam[c] not in SPREAD_CUT]
    print(f"[nba] spread fit {len(use_sp)} feats", flush=True)
    p_sp = pa.ridge_multi(P[use_sp].astype(float), P["date"], [y_sp], half_life=120.0)[0]
    use_t = [c for c in cols if fam[c] not in TOTAL_CUT]
    print(f"[nba] total fit {len(use_t)} feats", flush=True)
    p_t = pa.ridge_multi(P[use_t].astype(float), P["date"], [y_tot], half_life=180.0)[0]

    t = P.assign(m=p_sp, p=p_t)[["event_id", "team_row", "m", "p"]]
    gm = t.pivot(index="event_id", columns="team_row", values="m").reindex(G.index)
    gp = t.pivot(index="event_id", columns="team_row", values="p").reindex(G.index)
    # margin from +/- rows (nba_prune2._to_game): mean of home(+) and -away
    marg = (gm["home"] - gm["away"]) / 2.0
    out = pd.DataFrame({"event_id": G.index,
                        "d_spread": (marg + G["t60_spread_home_point"].astype(float)).values,
                        "d_total": (gp["home"] + gp["away"]
                                    - G["t60_total_point"].astype(float)).values})
    out.to_parquet(cache, index=False)
    return out


# ---------------------------------------------------------------- the matrix
def matrix(sport, mg, preds, mkt, buckets, lines):
    ms = _mod("ms3", "movement_study.py")
    df = mg.merge(preds, on="event_id", how="inner")
    df = df[df["home_score"].notna()]
    if mkt == "spread":
        d = df["d_spread"]          # + = model likes HOME vs the T-60 number
        move = -(df["t60_spread_home_point"] - df["open_spread_home_point"])  # + = toward home
        grade = ms.grade_side
        pos_side, neg_side = "home", "away"
    else:
        d = df["d_total"]           # + = model OVER the T-60 number
        move = df["t60_total_point"] - df["open_total_point"]                 # + = toward over
        grade = ms.grade_total
        pos_side, neg_side = "over", "under"
    rel = pd.Series(np.where(d >= 0, move, -move), index=df.index)  # + = toward model side
    lines += [f"\n### {sport.upper()} {mkt} — bet the model side at T-60, "
              "conditioned on edge x relative movement\n",
              "| edge bucket | movement | n | win% | ROI | per season |",
              "|---|---|---|---|---|---|"]
    for lo, hi, btag in buckets:
        eb = (d.abs() >= lo) & (d.abs() < hi)
        for mtag, mm in (("WITH ≥1", rel >= 1.0), ("FLAT <1", rel.abs() < 1.0),
                         ("AGAINST ≥1", rel <= -1.0)):
            mask = eb & mm & df["open_spread_home_point" if mkt == "spread"
                                else "open_total_point"].notna()
            sub = df[mask]
            if len(sub) < 30:
                continue
            side = np.where(d[mask] >= 0, pos_side, neg_side)
            win = np.zeros(len(sub), dtype=bool)
            push = np.zeros(len(sub), dtype=bool)
            profit = np.zeros(len(sub))
            for s in (pos_side, neg_side):
                pick = side == s
                if pick.sum() == 0:
                    continue
                w, pu, pr = grade(sub[pick], s)
                win[pick], push[pick], profit[pick] = w, pu, pr
            per = []
            for ssn, g in sub.assign(win=win, push=push, profit=profit).groupby("season"):
                m = int((~g["push"]).sum())
                if m:
                    per.append(f"{ssn[2:5]}{ssn[7:]}: {int(g['win'].sum())}/{m} "
                               f"{g['profit'].mean()*100:+.0f}%")
            n = int((~push).sum())
            lines.append(f"| {btag} | {mtag} | {n:,} | {win.sum()/n*100:.1f}% | "
                         f"{profit[~push].mean()*100:+.1f}% | {' · '.join(per)} |")


def main():
    lines = ["# Movement x Model — the MLB matrix on basketball (six seasons)", "",
             "Bet = model side at T-60 always; cells condition on |edge| x movement relative "
             "to the model's side (open→T-60). Pre-registered readings in the script header. "
             "No nulls — promotion from this menu requires its own confirm run.", ""]
    for sport, predfn in (("ncaab", cbb_preds), ("nba", nba_preds)):
        mg = pd.read_parquet(f"{PQ}/movement_games_{sport}.parquet")
        preds = predfn()
        if sport == "ncaab":
            buckets_sp = [(0.0, 1.5, "0-1.5 (no-bet)"), (1.5, 4.0, "1.5-4 (SHIP)"),
                          (4.0, 99, "4+ (flagged)")]
            buckets_t = [(0.0, 2.0, "0-2"), (2.0, 5.0, "2-5"), (5.0, 99, "5+")]
        else:
            buckets_sp = [(0.0, 5.0, "0-5 (no-bet)"), (5.0, 8.0, "5-8"), (8.0, 99, "8+ (SHIP)")]
            buckets_t = [(0.0, 5.0, "0-5 (no-bet)"), (5.0, 8.0, "5-8"), (8.0, 99, "8+ (SHIP)")]
        matrix(sport, mg, preds, "spread", buckets_sp, lines)
        matrix(sport, mg, preds, "total", buckets_t, lines)
    with open(OUT, "w") as f:
        f.write("\n".join(lines) + "\n")
    print(f"wrote {OUT}", flush=True)


if __name__ == "__main__":
    main()
