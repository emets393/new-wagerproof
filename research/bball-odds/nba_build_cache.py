#!/usr/bin/env python3
"""Build `data/parquet/_nba_wide_cache.parquet` — the frame every NBA model reads.

WHY THIS FILE EXISTS. The cache was assembled once, interactively, by running the attach
chain inside `nba_markets.main()` and writing the result. Nothing in the repo could
rebuild it, so when the outcome columns turned out to be wrong for six games there was no
way to regenerate the frame short of reconstructing the chain from memory. Six modelling
rounds had by then been run on a file with no producer.

The chain, in order (each step adds columns to the same one-row-per-event frame):

    nba_spread_dims.build_spread()   base frame off nba_model_features + spread dims
    nba_total_v3.with_fixed_ratings  adjusted ratings, refit with a global intercept
    nba_total_v4.dim_features        themed dimension blocks
    nba_matchup_nets.attach          possession/net matchup features
    nba_adj_stats.attach             opponent-adjusted own/net scoring ratings
    nba_markets.market_structure     mk_* derivative-market consistency family

Run after any change to `build_nba_features.py` or to the outcome sources it reads.
"""
import importlib.util
import os
import warnings

import pandas as pd

warnings.filterwarnings("ignore")

ROOT = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(ROOT, "data", "parquet", "_nba_wide_cache.parquet")


def _load(name, path):
    spec = importlib.util.spec_from_file_location(name, os.path.join(ROOT, path))
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


def build():
    mk = _load("mk", "nba_markets.py")
    D = mk.sd.build_spread()
    assert D["event_id"].is_unique, "frame has duplicate event_ids — phantom drop did not run"
    D = mk.v3.with_fixed_ratings(D)
    D, _themes = mk.v4.dim_features(D)
    D, _rblocks = mk.nets.attach(D)
    D, _ablocks = mk.adj.attach(D)
    D, _mkcols = mk.market_structure(D)

    # cheap invariants — an is_unique assert is what caught the phantom listings, and the
    # outcome identities are what six rounds of modelling never checked
    assert D["event_id"].is_unique
    m = D["y_home_pts"] - D["y_away_pts"]
    assert m.sub(D["y_fg_margin"]).abs().max() == 0, "y_fg_margin is not home - away"
    assert (D["y_fg_marg_resid"] - (D["y_fg_margin"] + D["t60_spread_home_point"])
            ).abs().max() < 1e-9, "y_fg_marg_resid is not margin + posted spread"
    return D


def main():
    D = build()
    D.to_parquet(CACHE, index=False)
    print(f"_nba_wide_cache: {len(D):,} games x {D.shape[1]:,} columns | "
          f"seasons {sorted(D['season'].dropna().unique())}", flush=True)


if __name__ == "__main__":
    main()
