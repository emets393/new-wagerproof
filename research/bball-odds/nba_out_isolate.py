#!/usr/bin/env python3
"""Which of the two corrections killed the 61%? A 2x2, judged at matched bet counts.

nba_out_signal.py reported the durable-absence rule at 61.2% (vs a 50.0% slice base) on the
full-game spread against the opener. nba_out_streaks.py rebuilt the same rule with two
corrections and got 50.7% vs a 50.9% base -- nothing. Both cannot be right, and until it is
known WHICH correction moved it, neither number can be reported.

The two constructions differ in exactly two independent ways:

  GRID    listed-only : a player's prior games are his own rows on the box score. A player
                        absent long enough stops being listed at all, so this reads a long
                        absence as consecutive appearances.
          full        : every player reindexed onto his TEAM'S schedule; an unlisted game is
                        an absence. 17.8% of player-team-games turn out to be reconstructed
                        this way, so this is not a rounding change.

  BASE    decay       : rotation-minute baseline is a 10-game rolling mean that COUNTS an
                        absence as zero minutes. A player out ~10 straight decays below the
                        16-minute rotation filter and silently stops counting as missing, so
                        the feature is implicitly fresh-absence-only.
          played      : baseline from the last 10 games he actually PLAYED, so absence
                        length stops being entangled with whether he counts at all.

MATCHED BET COUNTS. The four cells scale the gap differently, so a fixed threshold like
">=2.0" selects 188 games in one cell and 1,593 in another and the comparison is
meaningless. Every cell is instead cut at the |gap| QUANTILE that yields the same number of
bets, and the same counts are used for all four. A cell that is genuinely better must be
better at equal selectivity.

The placebo (gap permuted within season) is run for every cell at every count, because the
whole point is that one of these four numbers is a mirage and the placebo is what says so.
"""
import glob
import os
import warnings

import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "data", "parquet")
RAW = os.path.join(ROOT, "data", "raw", "nba_pbp")
SHRINK_MIN = 600.0
ROT_MIN = 16.0
RNG = np.random.default_rng(7)
COUNTS = (200, 400, 800)


def to_dec(a):
    a = pd.to_numeric(a, errors="coerce").to_numpy(dtype=float)
    return np.where((a >= 1.01) & (a <= 40.0), a,
                    np.where(a > 0, 1 + a / 100.0, 1 + 100.0 / np.abs(a)))


def raw_box():
    B = pd.concat([pd.read_parquet(f, columns=[
        "game_id", "game_date", "athlete_id", "team_id", "minutes", "did_not_play",
        "home_away"]) for f in sorted(glob.glob(f"{RAW}/player_box_*.parquet"))],
        ignore_index=True)
    B["minutes"] = pd.to_numeric(B["minutes"], errors="coerce").fillna(0.0)
    B["athlete_id"] = pd.to_numeric(B["athlete_id"], errors="coerce")
    B["team_id"] = pd.to_numeric(B["team_id"], errors="coerce")
    B = B.dropna(subset=["athlete_id", "team_id"])
    B["date"] = pd.to_datetime(B["game_date"])
    B["season"] = np.where(B["date"].dt.month >= 8, B["date"].dt.year,
                           B["date"].dt.year - 1)
    return B.drop_duplicates(["game_id", "athlete_id"])


def make_rows(B, grid):
    if grid == "listed":
        G = B[["athlete_id", "team_id", "season", "game_id", "date", "home_away",
               "minutes"]].copy()
    else:
        sched = B.drop_duplicates(["game_id", "team_id"])[
            ["season", "team_id", "game_id", "date", "home_away"]]
        span = B.groupby(["athlete_id", "team_id", "season"])["date"].agg(
            ["min", "max"]).reset_index()
        G = span.merge(sched, on=["season", "team_id"])
        G = G[(G["date"] >= G["min"]) & (G["date"] <= G["max"])]
        G = G[["athlete_id", "team_id", "season", "game_id", "date", "home_away"]].merge(
            B[["game_id", "athlete_id", "minutes"]], on=["game_id", "athlete_id"],
            how="left")
        G["minutes"] = G["minutes"].fillna(0.0)
    G["out"] = G["minutes"] <= 0
    return G.sort_values(["athlete_id", "season", "date"]).reset_index(drop=True)


def add_base(G, base):
    if base == "decay":
        # absences counted as zero minutes -- the original construction
        G["b"] = G.groupby(["athlete_id", "season"])["minutes"].transform(
            lambda s: s.shift(1).rolling(10, min_periods=3).mean())
    else:
        P = G[G["minutes"] > 0].copy()
        P["ri"] = P.groupby(["athlete_id", "season"])["minutes"].transform(
            lambda s: s.rolling(10, min_periods=3).mean())
        G = G.merge(P[["athlete_id", "game_id", "ri"]], on=["athlete_id", "game_id"],
                    how="left").sort_values(
            ["athlete_id", "season", "date"]).reset_index(drop=True)
        G["b"] = G.groupby(["athlete_id", "season"])["ri"].transform(
            lambda s: s.shift(1).ffill())
    first = G.groupby(["athlete_id", "season"]).head(1)
    assert first["b"].isna().all(), "BASELINE LEAKED INTO A PLAYER'S FIRST GAME"
    return G


def add_rapm(G):
    R = pd.read_parquet(f"{OUT}/nba_player_rapm.parquet")
    R["asof"] = pd.PeriodIndex(R["asof_month"], freq="M").to_timestamp()
    R["pid"] = R["player_id"].astype("int64")
    R = R.sort_values("asof")
    G["month"] = G["date"].dt.to_period("M").dt.to_timestamp()
    G["pid"] = G["athlete_id"].astype("int64")
    o = pd.merge_asof(G[["pid", "month"]].reset_index().sort_values("month"),
                      R.drop(columns=["player_id"]), left_on="month", right_on="asof",
                      by="pid", direction="backward").set_index("index").sort_index()
    assert (o["asof"].dropna() <= o.loc[o["asof"].notna(), "month"]).all(), \
        "RAPM RATING FROM THE FUTURE LEAKED INTO A GAME"
    k = o["prior_minutes"].fillna(0.0) / (o["prior_minutes"].fillna(0.0) + SHRINK_MIN)
    G["rapm_m"] = (o["rapm_margin"].fillna(0.0) * k).to_numpy()
    return G


def gap_frame(G):
    """Durable absence = out tonight AND out the previous game, exactly as originally defined."""
    G["prev_out"] = G.groupby(["athlete_id", "season"])["out"].shift(1).fillna(False)
    rot = G[G["b"] >= ROT_MIN].copy()
    den = rot.groupby(["game_id", "team_id"])["b"].transform("sum")
    dur = (rot["out"] & rot["prev_out"]).astype(float)
    rot["v"] = 5.0 * rot["b"] / den.clip(lower=1e-9) * rot["rapm_m"] * dur
    rot["nout"] = dur
    agg = rot.groupby(["game_id", "team_id"])[["v", "nout"]].sum().reset_index()
    ha = G.drop_duplicates(["game_id", "team_id"])[["game_id", "team_id", "home_away"]]
    agg = agg.merge(ha, on=["game_id", "team_id"])
    C = pd.read_parquet(f"{OUT}/nba_game_crosswalk.parquet")
    agg = agg.merge(C, left_on="game_id", right_on="espn_game_id").rename(
        columns={"bdl_game_id": "game.id"})
    H = agg[agg["home_away"] == "home"][["game.id", "v", "nout"]].rename(
        columns={"v": "hv", "nout": "hn"})
    V = agg[agg["home_away"] == "away"][["game.id", "v", "nout"]].rename(
        columns={"v": "av", "nout": "an"})
    F = pd.read_parquet(f"{OUT}/nba_model_features.parquet")
    F = F[~F["game.id"].duplicated(keep=False)].copy()
    d = F.merge(H, on="game.id", how="inner").merge(V, on="game.id", how="inner")
    d["y_open"] = d["y_fg_margin"] + d["open_spread_home_point"]
    d["gap"] = d["av"] - d["hv"]
    return d


def at_count(d, gap, n_target):
    """Cut |gap| at the quantile giving ~n_target bets, so cells compare at equal selectivity."""
    y = d["y_open"].to_numpy(dtype=float)
    ok = np.isfinite(y) & (y != 0) & np.isfinite(gap) & (gap != 0)
    if ok.sum() < n_target:
        return None
    thr = np.quantile(np.abs(gap[ok]), max(0.0, 1.0 - n_target / ok.sum()))
    m = ok & (np.abs(gap) >= thr)
    hi = gap[m] > 0
    win = np.where(hi, y[m] > 0, y[m] < 0)
    dec = np.where(hi, to_dec(d["open_spread_home_price"])[m],
                   to_dec(d["open_spread_away_price"])[m])
    return {"n": int(m.sum()), "win": 100 * win.mean(),
            "base": 100 * max((y[m] > 0).mean(), (y[m] < 0).mean()),
            "home": 100 * hi.mean(),
            "roi": 100 * np.where(win, dec - 1.0, -1.0).mean(),
            "per": " ".join(f"{s}:{100*win[d['season'].to_numpy()[m] == s].mean():.0f}"
                            for s in sorted(set(d["season"])))}


def main():
    B = raw_box()
    L = ["# Which correction killed the 61%? — a 2x2 at matched bet counts", "",
         "All cells: durable absences (out tonight and last game, >=16 min baseline), RAPM-"
         "valued, FG spread graded vs the OPENER. Cut at the |gap| quantile that yields the "
         "stated bet count, so selectivity is held equal across cells.", "",
         "`edge` is win% minus the baseline OF ITS OWN SUBSET, which is the only honest "
         "way to read any of these. The placebo is scored the same way, so a placebo edge "
         "near zero is the pass condition and a placebo edge near the signal's is a fail.",
         "",
         "| grid | baseline | bets | win % | base % | edge | ROI % | bets home % | by season | placebo edge |",
         "|---|---|---|---|---|---|---|---|---|---|"]

    leak = []
    for grid in ("listed", "full"):
        for base in ("decay", "played"):
            G = add_rapm(add_base(make_rows(B, grid), base))
            d = gap_frame(G)
            gap = d["gap"].to_numpy(dtype=float)
            pg = gap.copy()
            for s in d["season"].unique():
                idx = np.where(d["season"].to_numpy() == s)[0]
                pg[idx] = RNG.permutation(gap[idx])
            nz = int((gap != 0).sum())
            for c in COUNTS:
                r = at_count(d, gap, c)
                p = at_count(d, pg, c)
                if r is None:
                    continue
                L.append(f"| {grid} | {base} | {r['n']:,} | {r['win']:.1f} | "
                         f"{r['base']:.1f} | **{r['win']-r['base']:+.1f}** | "
                         f"{r['roi']:+.1f} | {r['home']:.0f} | {r['per']} | "
                         f"{p['win']-p['base']:+.1f} |")
            L.append(f"| {grid} | {base} | *fires on {nz:,} of {len(d):,} games* | | | | | | | |")
            # the leak that killed the first version of this work: blowouts empty benches,
            # so a DNP count can read the final margin backwards.
            mg = d["y_fg_margin"].to_numpy(dtype=float)
            tot = (d["hn"] + d["an"]).to_numpy(dtype=float)
            dif = (d["hn"] - d["an"]).to_numpy(dtype=float)
            leak.append(f"| {grid} | {base} | {np.corrcoef(np.abs(mg), tot)[0,1]:+.3f} | "
                        f"{np.corrcoef(mg, dif)[0,1]:+.3f} |")

    L += ["", "## Blowout-leak check", "",
          "`corr(|margin|, total absences)` is the artifact channel — blowouts empty both "
          "benches, so it must be near zero. `corr(margin, home−away absences)` is the real "
          "basketball effect and should stay negative.", "",
          "| grid | baseline | corr(\\|margin\\|, total out) | corr(margin, home−away out) |",
          "|---|---|---|---|"] + leak

    path = os.path.join(ROOT, "NBA_OUT_ISOLATE_BRIEF.md")
    with open(path, "w") as f:
        f.write("\n".join(L) + "\n")
    print("\n".join(L), flush=True)
    print(f"\nwrote {path}", flush=True)


if __name__ == "__main__":
    main()
