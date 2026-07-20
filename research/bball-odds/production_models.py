#!/usr/bin/env python3
"""Production per-market NCAAB models — tailored sets per PERMARKET_BRIEF.

Markets and their feature sets:
  fg_margin  : engineered cross-team + KP raw + style + class (lab-best)
  fg_total   : KP raw + engineered + class
  h1_margin  : minimal scaled-FG (KP raw + engineered + class) — nothing
               1H-specific helps
  h1_total   : KP raw + engineered + class
  tt_home    : KP raw + ASYMMETRIC (home offense × away defense) + class
  tt_away    : KP raw + ASYMMETRIC (away offense × home defense) + class

Trains on ALL seasons (production) + reports walk-forward validation.
Saves models to models/ with joblib + a feature manifest.
"""
import json
import os

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingRegressor

import model_lab as ml
import context_study as cs
from movement_study import am_to_dec
import glob

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "data", "parquet")
MODELS = os.path.join(ROOT, "models")
BEST = dict(learning_rate=0.05, max_leaf_nodes=15, min_samples_leaf=80,
            max_iter=700, l2_regularization=1.0, random_state=7)


def assemble():
    df = cs.load()
    e = ml.engineered(df)
    df = pd.concat([df, e], axis=1)
    df["is_conf"] = df["conferenceGame"].astype(float)
    df["is_neutral"] = (df["neutralSite"] == True).astype(float)
    G = ml.groups(df)
    klass = ["is_neutral", "is_conf", "h_tier", "a_tier", "blue_game",
             "conf_tourney", "mte", "ncaa", "ranked_conf", "month"]
    h = pd.concat([pd.read_parquet(p) for p in
                   sorted(glob.glob(f"{OUT}/h1tt_ncaab_*.parquet"))], ignore_index=True)
    cons = h.groupby("event_id")[["h1_spread_home_point", "h1_total_point",
                                  "tt_home_point", "tt_away_point"]].median()
    df = df.merge(cons, on="event_id", how="left")
    df["h1_margin"] = df["home_h1"] - df["away_h1"]
    df["h1_total"] = df["home_h1"] + df["away_h1"]
    df["fg_total"] = df["home_score"] + df["away_score"]

    # lineup-derived team profiles (prior-only) — roster SHAPE the box can't see;
    # star-dependency/rotation-depth improve margin models (fg_margin -0.09 MAE)
    prof = pd.read_parquet(f"{OUT}/lineup_profiles.parquet")
    for c in ["star_dep", "top2_share", "rotation_depth", "bench_dropoff"]:
        prof[f"{c}_pct"] = prof.groupby("season")[c].rank(pct=True)
    lpc = [f"{c}_pct" for c in ["star_dep", "top2_share", "rotation_depth", "bench_dropoff"]]
    for side, tid in (("h", "h_team_id"), ("a", "a_team_id")):
        p = prof.rename(columns={"team_id": tid, **{c: f"{side}_{c}" for c in lpc}})
        df = df.merge(p[["cbbd_id", tid] + [f"{side}_{c}" for c in lpc]],
                      on=["cbbd_id", tid], how="left")
    df["stardep_diff"] = df["h_star_dep_pct"] - df["a_star_dep_pct"]
    df["depth_diff"] = df["h_rotation_depth_pct"] - df["a_rotation_depth_pct"]
    lineup = [f"{s}_{c}" for s in ("h", "a") for c in lpc] + ["stardep_diff", "depth_diff"]

    kp, style, eng = G["kp_raw"], G["style"], list(e.columns)
    home_off = [c for c in kp + style if c.startswith(("home_kp_oe", "home_kp_tempo"))
                or (c.startswith("h_pct_") and "d_" not in c)]
    away_def = [c for c in kp + style if c.startswith("away_kp_de")
                or (c.startswith("a_pct_d_"))]
    away_off = [c for c in kp + style if c.startswith(("away_kp_oe", "away_kp_tempo"))
                or (c.startswith("a_pct_") and "d_" not in c)]
    home_def = [c for c in kp + style if c.startswith("home_kp_de")
                or (c.startswith("h_pct_d_"))]

    # lineup profiles added where they lowered walk-forward MAE (margins + away TT);
    # 1h_total / tt_home were flat so left minimal per the per-market law
    SPECS = {
        "fg_margin": ("margin", kp + style + eng + klass + lineup),
        "fg_total": ("fg_total", kp + eng + klass + lineup),
        "h1_margin": ("h1_margin", kp + eng + klass + lineup),
        "h1_total": ("h1_total", kp + eng + klass),
        "tt_home": ("home_score", kp + home_off + away_def + klass),
        "tt_away": ("away_score", kp + away_off + home_def + klass + lineup),
    }
    return df, SPECS


def main():
    df, SPECS = assemble()
    os.makedirs(MODELS, exist_ok=True)
    manifest = {}
    print(f"{'market':10s} {'walk-fwd MAE':>12s} {'market MAE':>11s}", flush=True)
    for name, (target, feats) in SPECS.items():
        feats = sorted(set(feats))
        # walk-forward validation
        preds = pd.Series(np.nan, index=df.index)
        for ts, trs in (("2023-24", ["2022-23"]), ("2024-25", ml.TRAIN),
                        ("2025-26", ml.TRAIN + [ml.VAL])):
            tr = df[df["season"].isin(trs) & df[target].notna()]
            te = df[df["season"] == ts]
            m = HistGradientBoostingRegressor(**BEST)
            m.fit(tr[feats], tr[target])
            preds.loc[te.index] = m.predict(te[feats])
        ok = preds.notna() & df[target].notna()
        mae = np.abs(df[target] - preds)[ok].mean()
        mkt_line = {"fg_margin": -df["t60_spread_home_point"],
                    "fg_total": df["t60_total_point"],
                    "h1_margin": -df["h1_spread_home_point"],
                    "h1_total": df["h1_total_point"],
                    "tt_home": df["tt_home_point"],
                    "tt_away": df["tt_away_point"]}[name]
        mok = ok & mkt_line.notna()
        mkt_mae = np.abs(df[target] - mkt_line)[mok].mean()
        # production fit on ALL data
        tr = df[df[target].notna()]
        m = HistGradientBoostingRegressor(**BEST)
        m.fit(tr[feats], tr[target])
        joblib.dump(m, f"{MODELS}/ncaab_{name}.joblib")
        manifest[name] = {"target": target, "n_features": len(feats),
                          "features": feats, "walkforward_mae": round(float(mae), 3),
                          "market_mae": round(float(mkt_mae), 3),
                          "trained_on": int(len(tr))}
        print(f"{name:10s} {mae:12.2f} {mkt_mae:11.2f}  ({len(feats)} feats)", flush=True)
    with open(f"{MODELS}/manifest.json", "w") as f:
        json.dump(manifest, f, indent=1)
    print(f"saved 6 models + manifest to {MODELS}/", flush=True)


if __name__ == "__main__":
    main()
