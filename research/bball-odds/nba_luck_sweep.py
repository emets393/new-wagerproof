#!/usr/bin/env python3
"""Does team-level luck regression pay, in ANY NBA betting market? The exhaustive sweep.

Every luck family from nba_luck_build.py, at two trailing windows, over all minutes and
competitive minutes only, against seven markets. That is roughly 700 cells, and 700 cells
searched for a 54% hit rate WILL produce several 57% cells from noise alone. So the headline
number of this file is not the best cell -- it is the best cell's FAMILY-WISE p-value.

THE MULTIPLICITY CONTROL. For each of 300 shuffles the outcome/price rows are permuted
within each market, every one of the ~700 cells is recomputed, and the LARGEST edge anywhere
in the sweep is recorded. That distribution is what the observed best cell must beat. A cell
at p=.01 on its own is unremarkable when 700 were tried; this asks whether the sweep as a
whole found more than a sweep of pure noise would.

DIRECTIONS ARE PRE-REGISTERED below, not chosen after seeing results, and they are not all
the same sign -- that is the part worth getting right:

  own three_pct / efg / ft_pct / off_eff  HIGH = the team has been LUCKY
  three_pct_alwd / efg_alwd / def_eff     HIGH = the team has been UNLUCKY (opponents hit
                                          shots against it that normally miss)
  pyth / close / margin / ats             HIGH = won more than it deserved

  SIDES  fade the luckier team; back the unluckier one. It is due positive regression.
  TOTALS a different question, so a different sign map. What matters is whether recent
         SCORING was inflated. Both own-offence luck AND opponent-shooting-allowed luck
         push a team's game totals UP, so for totals they carry the SAME sign, unlike
         for sides where they oppose. Getting this backwards would be a silent bug that
         still produces plausible numbers.

  CONTROLS shot RATES (three_rate, three_rate_alwd), strength of schedule and garbage-time
         share. Rates are process/skill, not luck, and should be null. If a rate control
         scores as high as the luck features, the sweep is finding schedule or style, not
         luck, and nothing here should be believed.
"""
import glob
import os
import warnings

import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")

from nba_out_isolate import to_dec

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "data", "parquet")
N_SHUF = 300
RNG = np.random.default_rng(101)
FRACS = (0.20, 0.33)
MIN_BETS = 60

#            base name            lucky_high  inflates_scoring
DIRECTIONS = {
    "three_pct":        (+1, +1),
    "three_pct_alwd":   (-1, +1),
    "ft_pct":           (+1, +1),
    "efg":              (+1, +1),
    "efg_alwd":         (-1, +1),
    "off_eff":          (+1, +1),
    "def_eff":          (-1, +1),
    "pyth":             (+1, 0),
    "close":            (+1, 0),
    "margin":           (+1, 0),
    "ats":              (+1, 0),
    # controls -- expected null
    "three_rate":       (0, 0),
    "three_rate_alwd":  (0, 0),
}
CONTROLS = {"three_rate", "three_rate_alwd"}
VARIANTS = ("", "_c")
WINDOWS = (5, 10)


def load():
    G = pd.read_parquet(f"{OUT}/nba_team_luck_games.parquet")
    g = pd.read_parquet(f"{OUT}/games_nba.parquet").dropna(subset=["espn_id"])
    g = g.sort_values("commence_time").drop_duplicates("event_id")
    G = G.merge(g[["event_id", "season", "home_score", "away_score",
                   "home_h1", "away_h1"]], on="event_id", how="left")
    mv = pd.read_parquet(f"{OUT}/movement_games_nba.parquet").drop_duplicates("event_id")
    G = G.merge(mv, on="event_id", how="left", suffixes=("", "_mv"))

    # 1H + team-total consensus close (decimal median across books)
    h = pd.concat([pd.read_parquet(p) for p in
                   sorted(glob.glob(f"{OUT}/h1tt_nba_*.parquet"))], ignore_index=True)
    for c in ("h1_spread_home_price", "h1_spread_away_price", "h1_total_over_price",
              "h1_total_under_price", "tt_home_over_price", "tt_home_under_price",
              "tt_away_over_price", "tt_away_under_price"):
        h[c] = to_dec(h[c])
    cons = h.groupby("event_id").agg(
        h1_spread=("h1_spread_home_point", "median"),
        h1_sp_h=("h1_spread_home_price", "median"),
        h1_sp_a=("h1_spread_away_price", "median"),
        h1_total=("h1_total_point", "median"),
        h1_ov=("h1_total_over_price", "median"),
        h1_un=("h1_total_under_price", "median"),
        tt_h=("tt_home_point", "median"),
        tt_h_ov=("tt_home_over_price", "median"),
        tt_h_un=("tt_home_under_price", "median"),
        tt_a=("tt_away_point", "median"),
        tt_a_ov=("tt_away_over_price", "median"),
        tt_a_un=("tt_away_under_price", "median")).reset_index()
    G = G.merge(cons, on="event_id", how="left")

    marg = G["home_score"] - G["away_score"]
    tot = G["home_score"] + G["away_score"]
    G["y_sp_open"] = marg + pd.to_numeric(G["open_spread_home_point"], errors="coerce")
    G["y_sp_t60"] = marg + pd.to_numeric(G["t60_spread_home_point"], errors="coerce")
    G["y_tot_t60"] = tot - pd.to_numeric(G["t60_total_point"], errors="coerce")
    G["y_ml"] = marg
    G["y_h1_sp"] = (G["home_h1"] - G["away_h1"]) + G["h1_spread"]
    G["y_h1_tot"] = (G["home_h1"] + G["away_h1"]) - G["h1_total"]
    G["y_tt_h"] = G["home_score"] - G["tt_h"]
    G["y_tt_a"] = G["away_score"] - G["tt_a"]
    return G


# market -> (outcome, price when betting POSITIVE, price when NEGATIVE, family)
# family: "side" uses the differential, "tot" the sum, "tt_h"/"tt_a" a single team's luck
MARKETS = {
    "FG spread OPEN": ("y_sp_open", "open_spread_home_price", "open_spread_away_price", "side"),
    "FG spread T-60": ("y_sp_t60", "t60_spread_home_price", "t60_spread_away_price", "side"),
    "FG moneyline":   ("y_ml", "t60_ml_home_price", "t60_ml_away_price", "side"),
    "FG total":       ("y_tot_t60", "t60_total_over_price", "t60_total_under_price", "tot"),
    "1H spread":      ("y_h1_sp", "h1_sp_h", "h1_sp_a", "side"),
    "1H total":       ("y_h1_tot", "h1_ov", "h1_un", "tot"),
    "team total HOME": ("y_tt_h", "tt_h_ov", "tt_h_un", "tt_h"),
    "team total AWAY": ("y_tt_a", "tt_a_ov", "tt_a_un", "tt_a"),
}


def signal_for(G, base, w, var, family):
    """Signed luck score and the side it implies, per the pre-registered direction table."""
    lucky, inflate = DIRECTIONS[base]
    col = f"luck{w}_{base}{var}"
    if family == "side":
        if lucky == 0 and base in CONTROLS:
            lucky = +1                     # controls get an arbitrary but fixed direction
        c = f"d_{col}"
        if c not in G.columns:
            return None
        s = lucky * pd.to_numeric(G[c], errors="coerce").to_numpy(dtype=float)
        return s, -np.sign(s)              # fade the luckier team
    if family == "tot":
        if inflate == 0:
            return None
        c = f"s_{col}"
        if c not in G.columns:
            return None
        s = inflate * pd.to_numeric(G[c], errors="coerce").to_numpy(dtype=float)
        return s, -np.sign(s)              # scoring was inflated -> under
    # single-team totals
    if inflate == 0:
        return None
    pre = "h_" if family == "tt_h" else "a_"
    c = f"{pre}{col}"
    if c not in G.columns:
        return None
    s = inflate * pd.to_numeric(G[c], errors="coerce").to_numpy(dtype=float)
    return s, -np.sign(s)


def cells(G):
    """Every (market, feature, window, variant, frac) selection, as masks + sides."""
    out = []
    for mk, (ycol, pp, pn, fam) in MARKETS.items():
        y = pd.to_numeric(G[ycol], errors="coerce").to_numpy(dtype=float)
        dp, dn = to_dec(G[pp]), to_dec(G[pn])
        valid = np.isfinite(y) & (y != 0) & np.isfinite(dp) & np.isfinite(dn)
        for base in DIRECTIONS:
            for w in WINDOWS:
                for var in VARIANTS:
                    r = signal_for(G, base, w, var, fam)
                    if r is None:
                        continue
                    s, side = r
                    ok = valid & np.isfinite(s) & (s != 0)
                    if ok.sum() < MIN_BETS:
                        continue
                    a = np.abs(s)
                    for fr in FRACS:
                        thr = np.quantile(a[ok], 1 - fr)
                        m = ok & (a >= thr)
                        if m.sum() < MIN_BETS:
                            continue
                        out.append(dict(market=mk, feat=f"{base}{var}", w=w, frac=fr,
                                        ycol=ycol, idx=np.flatnonzero(m),
                                        side=side[m], ctrl=base in CONTROLS))
    return out


def score(c, y, dp, dn):
    i, sd = c["idx"], c["side"]
    yy = y[i]
    win = np.where(sd > 0, yy > 0, yy < 0)
    base = max((yy > 0).mean(), (yy < 0).mean())
    dec = np.where(sd > 0, dp[i], dn[i])
    return win, win.mean() - base, base, np.where(win, dec - 1.0, -1.0).mean()


def main():
    G = load()
    C = cells(G)
    print(f"{len(G):,} games, {len(C)} cells", flush=True)

    arrs = {}
    for mk, (ycol, pp, pn, fam) in MARKETS.items():
        arrs[mk] = (pd.to_numeric(G[ycol], errors="coerce").to_numpy(dtype=float),
                    to_dec(G[pp]), to_dec(G[pn]))

    res = []
    for c in C:
        y, dp, dn = arrs[c["market"]]
        win, edge, base, roi = score(c, y, dp, dn)
        res.append({**{k: c[k] for k in ("market", "feat", "w", "frac", "ctrl")},
                    "n": len(win), "win": 100 * win.mean(), "base": 100 * base,
                    "edge": 100 * edge, "roi": 100 * roi, "idx": c["idx"], "side": c["side"]})
    R = pd.DataFrame(res)

    # ---- family-wise null: best edge ANYWHERE in the sweep, under shuffled outcomes -----
    obs_max = R["edge"].max()
    by_mk = {mk: [c for c in C if c["market"] == mk] for mk in MARKETS}
    nul = np.empty(N_SHUF)
    for b in range(N_SHUF):
        best = -9e9
        for mk, cl in by_mk.items():
            if not cl:
                continue
            y, dp, dn = arrs[mk]
            p = RNG.permutation(len(y))
            ys = y[p]
            for c in cl:
                yy = ys[c["idx"]]
                win = np.where(c["side"] > 0, yy > 0, yy < 0)
                base = max((yy > 0).mean(), (yy < 0).mean())
                best = max(best, win.mean() - base)
        nul[b] = 100 * best
        if (b + 1) % 60 == 0:
            print(f"  shuffle {b+1}/{N_SHUF}", flush=True)
    fw_p = float((nul >= obs_max).mean())

    R = R.sort_values("edge", ascending=False)
    L = ["# NBA team-luck regression — exhaustive market sweep", "",
         f"{len(G):,} games, **{len(C)} cells** tested: "
         f"{len(DIRECTIONS)} luck families x {len(WINDOWS)} windows x all/competitive "
         f"minutes x {len(FRACS)} selection sizes x {len(MARKETS)} markets.", "",
         "## The multiplicity result — read this before any table below", "",
         f"Best edge found anywhere: **{obs_max:+.2f} pts**. Under {N_SHUF} shuffles of the "
         f"outcomes, the best edge a sweep of this size finds by luck alone averages "
         f"**{nul.mean():+.2f}** and exceeds the observed best **{100*fw_p:.1f}%** of the "
         f"time (95th pct of the null = {np.quantile(nul, 0.95):+.2f}).", "",
         f"**Family-wise p = {fw_p:.3f}.**", ""]
    L += ["## Top 25 cells (uncorrected — expect several to be noise)", "",
          "| market | feature | win | frac | n | win % | base % | edge | ROI % |",
          "|---|---|---|---|---|---|---|---|---|"]
    for _, r in R.head(25).iterrows():
        tag = " *(control)*" if r["ctrl"] else ""
        L.append(f"| {r['market']} | {r['feat']}{tag} | {r['w']} | {r['frac']:.0%} | "
                 f"{r['n']} | {r['win']:.1f} | {r['base']:.1f} | **{r['edge']:+.1f}** | "
                 f"{r['roi']:+.1f} |")

    L += ["", "## Controls — shot RATES, which are skill and should be null", "",
          "| market | feature | win | n | edge | ROI % |", "|---|---|---|---|---|---|"]
    for _, r in R[R["ctrl"]].sort_values("edge", ascending=False).head(10).iterrows():
        L.append(f"| {r['market']} | {r['feat']} | {r['w']} | {r['n']} | "
                 f"**{r['edge']:+.1f}** | {r['roi']:+.1f} |")

    L += ["", "## Best cell per market", "",
          "| market | feature | n | win % | base % | edge | ROI % |",
          "|---|---|---|---|---|---|---|"]
    for mk in MARKETS:
        s = R[(R["market"] == mk) & (~R["ctrl"])]
        if s.empty:
            continue
        r = s.iloc[0]
        L.append(f"| {mk} | {r['feat']} w{r['w']} {r['frac']:.0%} | {r['n']} | "
                 f"{r['win']:.1f} | {r['base']:.1f} | **{r['edge']:+.1f}** | {r['roi']:+.1f} |")

    path = os.path.join(ROOT, "NBA_LUCK_SWEEP_BRIEF.md")
    with open(path, "w") as f:
        f.write("\n".join(L) + "\n")
    R.drop(columns=["idx", "side"]).to_parquet(f"{OUT}/nba_luck_sweep_results.parquet",
                                               index=False)
    print("\n".join(L[:14]), flush=True)
    print(f"\nwrote {path}", flush=True)


if __name__ == "__main__":
    main()
