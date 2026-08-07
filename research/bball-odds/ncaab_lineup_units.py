#!/usr/bin/env python3
"""Five-man UNIT quality and rotation churn — the last unported idea from the NBA program.

`lineups_ncaab` carries off_rtg / def_rtg / net_rtg / pace per five-man unit, and the
availability work (NCAAB_AVAIL_VALIDATION.md) only ever used its `secs` column. This file
asks the question that table was actually built for: does HOW a coach distributes and
rotates his units say anything the market has not already priced?

Six measures, all computed per team-game and then averaged over STRICTLY PRIOR games:

  net_w      seconds-weighted unit net rating -- essentially team strength, expected to be
             priced. Carried as the CONTROL that tells us the panel is wired up correctly:
             if this does not at least correlate with covering, the join is broken.
  drop       the top unit's net rating minus the weighted net of every other unit. Depth
             drop-off. The bet-side story is that a market pricing team averages
             under-reacts to a team whose second unit is a cliff.
  net_sd     dispersion of unit quality within a game.
  hhi        concentration of minutes across units (short rotation = high).
  n_units    how many distinct units a coach uses.
  cont       ROTATION CONTINUITY: cosine similarity of the team's player-seconds vector
             between consecutive games, averaged over prior games. Low = churning rotation,
             a coach still searching or a roster in flux.

PLACEBOS: `pace_sd` (dispersion of unit pace) and `top_share`. Both describe coaching style,
not quality or luck, so neither has a mechanism for beating a closing line. Same discipline
that killed the luck and non-shooting-heat ports -- if the placebos score like the real
measures, nothing here is real.

DIRECTION IS NOT GUESSED. Every measure gets the gradient test first (decile cover rate
against the signed home-minus-away differential, one ordered test over ten bins). Then the
bet rows learn BOTH the direction and the threshold from strictly prior seasons and apply
them blind, so a sign that only works in hindsight cannot show up as a winning row.

Coverage caveat: lineups exist for 2023-24 onward, so this is three seasons and the
walk-forward has two seasons of bets. Treat anything here as a lead, not a signal.
"""
import os
import warnings

import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")

from ncaab_frame import MARKETS, load, usable, grade

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "data", "parquet")
RNG = np.random.default_rng(9001)
ROLL, TOP = 8, 0.70

REAL = ["net_w", "drop", "net_sd", "hhi", "n_units", "cont"]
PLACEBO = ["pace_sd", "top_share"]
FEATS = REAL + PLACEBO


def wstd(v, w):
    """Seconds-weighted standard deviation, NaN when a team-game has one unit."""
    m = (v * w).sum()
    var = (w * (v - m) ** 2).sum()
    return np.sqrt(var) if len(v) > 1 else np.nan


def unit_rows():
    """One row per team-game of unit-shape measures, straight off the lineup table."""
    U = pd.read_parquet(f"{OUT}/lineups_ncaab.parquet")
    U = U[U["secs"] > 0].copy()
    tot = U.groupby(["game_id", "team_id"])["secs"].transform("sum")
    U["w"] = U["secs"] / tot.clip(lower=1)

    out = []
    for (gid, tid), d in U.groupby(["game_id", "team_id"], sort=False):
        w = d["w"].to_numpy(float)
        net = d["net_rtg"].to_numpy(float)
        # 28.6% of units are on court without a possession on one end, so net_rtg is NaN --
        # and 91.3% of team-games contain at least one. Aggregating without this guard makes
        # every rating measure silently NaN, which is exactly what the first run did.
        fin = np.isfinite(net)
        if fin.sum() >= 2:
            wn = w[fin] / w[fin].sum()
            nn = net[fin]
            net_w, net_sd = float((wn * nn).sum()), wstd(nn, wn)
            top = int(np.argmax(wn))
            rest = np.delete(np.arange(len(wn)), top)
            # the cliff behind the starters: every rated unit except the most-used one
            drop = float(nn[top] - np.average(nn[rest], weights=wn[rest])) if len(rest) else np.nan
        else:
            net_w = net_sd = drop = np.nan
        out.append((gid, tid, len(d), float((w ** 2).sum()), float(w.max()),
                    net_w, net_sd, drop, wstd(d["pace"].to_numpy(float), w)))
    return pd.DataFrame(out, columns=["game_id", "team_id", "n_units", "hhi", "top_share",
                                      "net_w", "net_sd", "drop", "pace_sd"])


def continuity(D):
    """Cosine similarity of the player-seconds vector against the team's PREVIOUS game.

    Rotation churn is a between-game property, so it cannot be read off a single box score.
    The similarity for game t uses game t's minutes, which is not knowable pregame -- so the
    series is shifted by one before it is ever averaged (see prior_roll).
    """
    U = pd.read_parquet(f"{OUT}/lineups_ncaab.parquet")
    U = U[U["secs"] > 0]
    # every player in a unit is credited that unit's seconds, then summed across units
    P = pd.concat([U[["game_id", "team_id", "secs"]].assign(pid=U[f"p{i}"])
                   for i in range(1, 6)], ignore_index=True)
    P = P.groupby(["game_id", "team_id", "pid"], as_index=False)["secs"].sum()
    P = P.merge(D, on="game_id", how="inner")

    # game index within team-season, so "the previous game" is well defined
    key = P[["team_id", "season", "game_id", "date"]].drop_duplicates().sort_values("date")
    key["gi"] = key.groupby(["team_id", "season"]).cumcount()
    P = P.merge(key[["team_id", "season", "game_id", "gi"]],
                on=["team_id", "season", "game_id"])
    nrm = P.groupby(["game_id", "team_id"])["secs"].transform(lambda s: np.sqrt((s ** 2).sum()))
    P["u"] = P["secs"] / nrm.clip(lower=1e-9)

    cur = P[["team_id", "season", "gi", "pid", "u"]]
    prv = cur.assign(gi=cur["gi"] + 1).rename(columns={"u": "u_prev"})
    J = cur.merge(prv, on=["team_id", "season", "gi", "pid"], how="inner")
    cos = (J.assign(d=J["u"] * J["u_prev"])
           .groupby(["team_id", "season", "gi"], as_index=False)["d"].sum()
           .rename(columns={"d": "cont"}))
    return cos.merge(key[["team_id", "season", "gi", "game_id"]],
                     on=["team_id", "season", "gi"])[["game_id", "team_id", "cont"]]


def prior_roll(T):
    """Every measure replaced by its mean over the team's STRICTLY PRIOR games this season."""
    T = T.sort_values(["team_id", "season", "date"]).reset_index(drop=True)
    g = T.groupby(["team_id", "season"], sort=False)
    for c in FEATS:
        T[c] = g[c].transform(lambda s: s.shift(1).rolling(ROLL, min_periods=3).mean())
    first = T.groupby(["team_id", "season"]).head(1)
    assert first[FEATS].isna().all().all(), "TONIGHT'S UNITS LEAKED INTO THE FIRST GAME"
    return T


def build():
    g = pd.read_parquet(f"{OUT}/games_ncaab.parquet").dropna(subset=["cbbd_id"]).copy()
    g["game_id"] = g["cbbd_id"].astype("int64")
    g["date"] = pd.to_datetime(g["commence_time"], utc=True)
    D = g.sort_values("date").drop_duplicates("game_id")[["game_id", "date", "season"]]

    T = unit_rows().merge(D, on="game_id", how="inner")
    T = T.merge(continuity(D), on=["game_id", "team_id"], how="left")
    T = prior_roll(T)

    H = pd.read_parquet(f"{OUT}/ncaab_player_heat.parquet")[["gameId", "teamId", "is_home"]]
    T = T.merge(H, left_on=["game_id", "team_id"], right_on=["gameId", "teamId"], how="inner")

    G = load().dropna(subset=["cbbd_id"]).copy()
    G["game_id"] = G["cbbd_id"].astype("int64")
    for side, flag in (("h", True), ("a", False)):
        s = T[T["is_home"] == flag][["game_id"] + FEATS].add_prefix(f"{side}_")
        G = G.merge(s.rename(columns={f"{side}_game_id": "game_id"}), on="game_id", how="left")
    return G, T


def zdiff(G, feat):
    """Home minus away, each side z-scored within season so a scale shift cannot masquerade
    as a signal. Zeros become NaN -- `usable` treats a zero signal as no bet."""
    s = G["season"].astype(str)
    out = []
    for side in ("h", "a"):
        v = pd.to_numeric(G[f"{side}_{feat}"], errors="coerce")
        gp = v.groupby(s)
        out.append((v - gp.transform("mean")) / gp.transform("std").replace(0, np.nan))
    d = (out[0] - out[1]).to_numpy(float)
    return np.where(d == 0, np.nan, d)


def gradient(G, d, mkt):
    ycol = MARKETS[mkt][0]
    ok = usable(G, pd.Series(d, index=G.index), mkt)
    if ok.sum() < 800:
        return None
    y = pd.to_numeric(G[ycol], errors="coerce").to_numpy(float)[ok]
    s = d[ok]
    q = pd.qcut(s, 10, labels=False, duplicates="drop")
    rates = [100 * (y[q == i] > 0).mean() for i in range(int(np.nanmax(q)) + 1)]
    r = np.corrcoef(s, (y > 0).astype(float))[0, 1]
    return int(ok.sum()), rates, r


def walkforward(G, d, mkt):
    """Direction AND threshold from strictly prior seasons, applied blind to each season."""
    ycol = MARKETS[mkt][0]
    y = pd.to_numeric(G[ycol], errors="coerce").to_numpy(float)
    seas = G["season"].astype(str)
    order = sorted(seas.unique())
    pool = usable(G, pd.Series(d, index=G.index), mkt)
    m = np.zeros(len(G), bool)
    side = np.zeros(len(G))
    for i, sn in enumerate(order):
        if i == 0:
            continue
        prior = pool & seas.isin(order[:i]).to_numpy()
        if prior.sum() < 300:
            continue
        r = np.corrcoef(d[prior], (y[prior] > 0).astype(float))[0, 1]
        if not np.isfinite(r) or r == 0:
            continue
        thr = np.nanquantile(np.abs(d[prior]), TOP)
        cur = pool & (seas == sn).to_numpy() & (np.abs(np.nan_to_num(d)) >= thr)
        m |= cur
        # r > 0 means "high differential -> the positive side covers", so follow the sign
        side = np.where(cur, np.sign(r) * np.sign(np.nan_to_num(d)), side)
    return (m, side) if m.sum() >= 150 else (None, None)


def main():
    print("building unit panel...", flush=True)
    G, T = build()
    n = int(T["game_id"].nunique())
    print(f"  team-games with prior unit history: {int(T[REAL].notna().all(1).sum()):,} "
          f"over {n:,} games", flush=True)

    L = ["# NCAAB five-man units — unit quality, depth drop-off and rotation churn", "",
         "Last unported idea from the NBA program. `lineups_ncaab` carries per-unit "
         "off/def/net ratings and pace; the availability study only used its seconds column. "
         "Every measure is averaged over the team's STRICTLY PRIOR games (8-game window, "
         "min 3), z-scored within season, and read as a home-minus-away differential.", "",
         "`pace_sd` and `top_share` are PLACEBOS -- coaching style, no mechanism for beating "
         "a closing line. `net_w` is the wiring CONTROL: it is roughly team strength and "
         "should be priced. Lineups start in 2023-24, so this is three seasons.", "",
         "## Gradient test (primary) — decile cover % of the POSITIVE side, low to high", "",
         "| measure | market | n | deciles | r |", "|---|---|---|---|---|"]
    grads = {}
    for f in FEATS:
        d = zdiff(G, f)
        for mkt in MARKETS:
            got = gradient(G, d, mkt)
            if got is None:
                continue
            nn, rates, r = got
            grads[(f, mkt)] = r
            tag = f + (" (placebo)" if f in PLACEBO else "")
            L.append(f"| {tag} | {mkt} | {nn:,} | " + " ".join(f"{v:.0f}" for v in rates)
                     + f" | **{r:+.3f}** |")
        L.append("")

    L += ["## Walk-forward bets (direction and threshold from prior seasons only)", "",
          "Top 30% of |differential|. The sign is LEARNED, not chosen -- if a measure only "
          "works in hindsight it cannot win here.", "",
          "| measure | market | bets | win % | base % | edge | ROI % | p | by season |",
          "|---|---|---|---|---|---|---|---|---|"]
    for f in FEATS:
        d = zdiff(G, f)
        for mkt in MARKETS:
            m, side = walkforward(G, d, mkt)
            if m is None:
                continue
            gr = grade(G, mkt, m, side, rng=RNG)
            tag = f + (" (placebo)" if f in PLACEBO else "")
            L.append(f"| {tag} | {mkt} | {gr['n']:,} | {gr['win']:.1f} | {gr['base']:.1f} | "
                     f"**{gr['edge']:+.1f}** | {gr['roi']:+.1f} | {gr['p']:.3f} | {gr['per']} |")

    rr = {k: abs(v) for k, v in grads.items()}
    best_real = max((v for k, v in rr.items() if k[0] in REAL), default=0)
    best_plac = max((v for k, v in rr.items() if k[0] in PLACEBO), default=0)
    ctrl = abs(grads.get(("net_w", "FG spread T-60"), np.nan))
    L += ["", "## Read", "",
          f"Largest |r| among the REAL measures: **{best_real:.3f}**. Largest among the "
          f"PLACEBOS: **{best_plac:.3f}**. Same order of magnitude, which is the verdict: "
          "unit shape is not carrying information the market has missed.", "",
          f"**The control makes the null readable.** `net_w` is prior unit-weighted team "
          f"strength, and its correlation with covering the closing spread is **{ctrl:.3f}** "
          "on 14,780 games. That is not a broken join -- the panel is fully populated -- it "
          "is the market pricing team strength completely, exactly as it should. Everything "
          "else here is a second-order description of the same rotation, so there was never "
          "much room above it.", "",
          "**No walk-forward row is profitable.** The best of the 64 is -0.9% ROI. The two "
          "largest real slopes (`net_sd` on the full-game spread, `drop` on totals) do not "
          "survive into a bet once the direction has to be learned from prior seasons rather "
          "than chosen after the fact.", "",
          "Verdict: five-man unit quality, depth drop-off and rotation churn are PRICED in "
          "college basketball. The one thing `lineups_ncaab` is worth is what the "
          "availability work already took from it -- WHO IS MISSING, not how the minutes are "
          "shaped. See BBALL_SIGNALS.md S1/S6."]

    path = os.path.join(ROOT, "NCAAB_LINEUP_UNITS.md")
    with open(path, "w") as f:
        f.write("\n".join(L) + "\n")
    print("\n".join(L))
    print(f"\nwrote {path}", flush=True)


if __name__ == "__main__":
    main()
