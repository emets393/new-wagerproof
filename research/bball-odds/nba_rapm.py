#!/usr/bin/env python3
"""Walk-forward RAPM for NBA players, from reconstructed lineup stints.

RAPM exists because box scores cannot measure on-court impact. A player's per-36 scoring
says nothing about whether his team outscores opponents when he plays, and raw plus-minus
confounds him with his four teammates and five opponents. Ridge regression over stints
disentangles them: one column per player, +1 when he is on the floor for the home side,
-1 for the away side, and the fitted coefficient is his impact net of everyone he shared
the court with.

This is the layer the NBA side of this project never had. nba_player_ceiling.py scored ~+4%
correlation against the market using per-36 rates and shrunken plus-minus -- the known-
inferior proxies for exactly this quantity -- while the NCAAB side has had player_rapm_ncaab
all along.

TWO TARGETS from one design matrix, because they serve different markets:

  margin RAPM  y = home margin per 48 minutes, home players +1 / away players -1.
               The coefficient is net impact. Feeds SPREAD markets.
  total  RAPM  y = combined points per 48 minutes, ALL TEN players +1.
               The coefficient is a player's effect on the scoring environment -- pace and
               efficiency together, on both ends. Feeds TOTALS markets. A slow grind-it-out
               defender and a run-and-gun guard can have identical margin impact and
               opposite total impact, and only this target sees the difference.

PER-48 RATHER THAN PER-100-POSSESSIONS, deliberately. The textbook unit is per-possession,
which separates efficiency from pace. But the thing being predicted here is a game's final
margin and total against a posted line, and those are per-48 quantities. Converting to
possessions and back would launder pace out and then require putting it back in.

LEAK DISCIPLINE. A season-long RAPM would be contaminated by games we are trying to predict
-- the single easiest way to manufacture a spectacular backtest. Ratings are refit MONTHLY
on strictly prior stints only, and every player-month rating is stamped with the month it
becomes usable. Recency decay is applied by half-life so a rating tracks form without
throwing away the career signal that makes early-season estimates possible at all.

Writes data/parquet/nba_player_rapm.parquet -- (player_id, asof_month, rapm_margin,
rapm_total, prior_minutes).
"""
import os
import warnings

import numpy as np
import pandas as pd
from scipy import sparse
from sklearn.linear_model import Ridge

warnings.filterwarnings("ignore")

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "data", "parquet")

# Ridge penalty in RAPM is not a nuisance knob -- it IS the prior that a randomly chosen
# player is league-average. Public NBA RAPM implementations land around 2000-4000 on
# possession-weighted data; this is tuned to the same shrinkage in per-48/seconds units.
ALPHA = 3000.0

# Half-life on stint recency, in days. ~1.5 seasons: long enough that a rating survives the
# offseason (the structural advantage of player ratings over team ratings), short enough
# that a player who genuinely improved is not anchored to who he was three years ago.
HALFLIFE_DAYS = 550.0

MIN_STINTS = 8000     # burn-in; months before this have too little history to fit
MIN_SECONDS = 12.0    # sub-12-second stints are timeout/foul noise with huge per-48 blowup


def load_stints():
    S = pd.read_parquet(f"{OUT}/nba_stints.parquet")
    G = pd.read_parquet(f"{OUT}/bdl_games.parquet")[["id", "date"]]
    # stints are keyed by ESPN game_id; dates come from the pbp file itself instead
    import glob
    frames = [pd.read_parquet(f, columns=["game_id", "game_date"]).drop_duplicates()
              for f in sorted(glob.glob(f"{ROOT}/data/raw/nba_pbp/pbp_*.parquet"))]
    D = pd.concat(frames, ignore_index=True).drop_duplicates("game_id")
    S = S.merge(D, on="game_id", how="left")
    S["date"] = pd.to_datetime(S["game_date"])
    S = S[S["seconds"] >= MIN_SECONDS].copy()
    for c in ("h_lineup", "a_lineup"):
        S[c] = S[c].apply(lambda s: [float(x) for x in
                                     s.strip("()").replace(" ", "").split(",") if x])
    S = S[(S["h_lineup"].str.len() == 5) & (S["a_lineup"].str.len() == 5)]
    return S.sort_values("date").reset_index(drop=True)


def design(S, pidx):
    """Sparse stint x player matrices for both targets."""
    n, k = len(S), len(pidx)
    rows, cols, vals_m, vals_t = [], [], [], []
    for i, (hl, al) in enumerate(zip(S["h_lineup"], S["a_lineup"])):
        for p in hl:
            j = pidx.get(p)
            if j is None:
                continue
            rows.append(i); cols.append(j); vals_m.append(1.0); vals_t.append(1.0)
        for p in al:
            j = pidx.get(p)
            if j is None:
                continue
            rows.append(i); cols.append(j); vals_m.append(-1.0); vals_t.append(1.0)
    Xm = sparse.csr_matrix((vals_m, (rows, cols)), shape=(n, k))
    Xt = sparse.csr_matrix((vals_t, (rows, cols)), shape=(n, k))
    return Xm, Xt


def main():
    S = load_stints()
    print(f"{len(S):,} usable stints, {S['date'].min().date()} -> "
          f"{S['date'].max().date()}", flush=True)

    per48 = 2880.0 / S["seconds"].to_numpy(dtype=float)
    y_m = (S["h_pts"].to_numpy(dtype=float) - S["a_pts"].to_numpy(dtype=float)) * per48
    y_t = (S["h_pts"].to_numpy(dtype=float) + S["a_pts"].to_numpy(dtype=float)) * per48
    # clip the tails: a 13-second stint with one three-pointer implies +664 per 48, which
    # would dominate a squared-error fit for no basketball reason
    y_m = np.clip(y_m, -200, 200)
    y_t = np.clip(y_t, 0, 400)
    secs = S["seconds"].to_numpy(dtype=float)
    dates = S["date"].to_numpy()

    months = pd.PeriodIndex(S["date"], freq="M")
    out = []
    for p in sorted(months.unique()):
        tr = np.asarray(months < p)
        if tr.sum() < MIN_STINTS:
            continue
        Str = S[tr]
        players = sorted(set(np.concatenate(
            [np.concatenate(Str["h_lineup"].to_numpy()),
             np.concatenate(Str["a_lineup"].to_numpy())])))
        pidx = {pl: i for i, pl in enumerate(players)}
        Xm, Xt = design(Str, pidx)

        # recency weight x stint length: long recent stints carry the most evidence
        age = (p.to_timestamp() - pd.to_datetime(dates[tr])).days.to_numpy(dtype=float)
        w = secs[tr] * np.power(0.5, np.maximum(age, 0) / HALFLIFE_DAYS)

        rm = Ridge(alpha=ALPHA, fit_intercept=True, solver="sparse_cg")
        rm.fit(Xm, y_m[tr], sample_weight=w)
        rt = Ridge(alpha=ALPHA, fit_intercept=True, solver="sparse_cg")
        rt.fit(Xt, y_t[tr], sample_weight=w)

        pm = pd.DataFrame({
            "player_id": players,
            "asof_month": str(p),
            "rapm_margin": rm.coef_,
            "rapm_total": rt.coef_,
        })
        # prior minutes: how much evidence stands behind each rating, so downstream code
        # can shrink or drop thinly-observed players instead of trusting them equally
        mins = {}
        for lu, sc in ((Str["h_lineup"], secs[tr]), (Str["a_lineup"], secs[tr])):
            for players_i, s in zip(lu, sc):
                for pl in players_i:
                    mins[pl] = mins.get(pl, 0.0) + s / 60.0
        pm["prior_minutes"] = pm["player_id"].map(mins).fillna(0.0)
        out.append(pm)
        print(f"  {p}  train_stints={tr.sum():,}  players={len(players):,}", flush=True)

    R = pd.concat(out, ignore_index=True)
    path = f"{OUT}/nba_player_rapm.parquet"
    R.to_parquet(path, index=False)
    print(f"\nwrote {path}: {len(R):,} player-month ratings", flush=True)

    # sanity: the best-rated players by the final fit should be recognisable stars. If the
    # leaderboard is full of 200-minute bench players, the shrinkage is too weak.
    last = R[R["asof_month"] == R["asof_month"].max()]
    last = last[last["prior_minutes"] > 2000].nlargest(15, "rapm_margin")
    B = pd.read_parquet(f"{OUT}/bdl_player_box.parquet",
                        columns=["player.id", "player.first_name", "player.last_name"])
    print("\ntop 15 margin RAPM at final refit (>2000 prior minutes) -- sanity check:")
    print(last[["player_id", "rapm_margin", "rapm_total", "prior_minutes"]].to_string(
        index=False))


if __name__ == "__main__":
    main()
