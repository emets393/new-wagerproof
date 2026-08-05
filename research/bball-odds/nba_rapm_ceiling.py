#!/usr/bin/env python3
"""Does player IMPACT beat the NBA line where player BOX SCORES did not?

This is the same harness as nba_player_ceiling.py -- deliberately, so the two are directly
comparable -- run on RAPM-derived team features instead of per-36 counting stats. The
number to beat, from that earlier run:

    semi-oracle LEVEL   FG margin +4.8   FG total +4.0   1H total +4.0   1H margin +1.6
    R2 vs market NEGATIVE in every cell (-0.69 to -1.30)
    placebo band -3.7 to +2.2

So the previous result was inside, or barely outside, its own null. If RAPM lands in the
same place, the answer is that the NBA market prices the roster and the granular data does
not change that. If it lands well outside, the earlier failure was a data-layer problem,
which was the whole reason for building stints and RAPM.

Everything is fit on the MARKET RESIDUAL (actual minus the T-60 line), never on the raw
score, and scored out of sample under an expanding monthly walk-forward. R2 is measured
against predicting zero residual, so NEGATIVE means worse than simply trusting the line.

THREE HYPOTHESES, REGISTERED HERE BEFORE THE NUMBERS:
  1. OUT beats LEVEL. The market prices roster quality all summer; it cannot pre-price who
     is unavailable tonight. If LEVEL scores and OUT does not, the model is reading team
     strength, which the line already contains.
  2. Totals beat margins for the OUT features. A missing rim protector and a missing
     scorer move the total in OPPOSITE directions, and that distinction does not exist in
     a box score -- it is the single most specific thing RAPM adds.
  3. sem beats prj by a wide margin. sem knows who is actually out; prj only knows who
     played last game. The gap is the dollar value of an availability feed.

If all three fail, the honest reading is that the impact layer did not help either, and
that gets reported as a failure rather than sanded into a positive.

Bet simulation is against the T-60 close at posted prices, and every win rate is printed
next to ITS OWN slice's baseline, because a 54% that sits in a 53% slice is nothing.
"""
import os
import warnings

import numpy as np
import pandas as pd
from sklearn.linear_model import Ridge
from sklearn.preprocessing import StandardScaler

warnings.filterwarnings("ignore")

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "data", "parquet")
RNG = np.random.default_rng(7)
ALPHA = 25.0          # ~19 features per framing, far fewer than the 348-column box model
MIN_TRAIN = 700
BOOT = 2000


def load():
    F = pd.read_parquet(f"{OUT}/nba_model_features.parquet")
    F = F[~F["game.id"].duplicated(keep=False)].copy()
    A = pd.read_parquet(f"{OUT}/nba_rapm_team_agg.parquet")
    G = pd.read_parquet(f"{OUT}/bdl_games.parquet")[
        ["id", "home_team.id", "visitor_team.id", "postseason"]].rename(
        columns={"id": "game.id"})

    feats = [c for c in A.columns if c.startswith(("sem_", "dur_", "prj_", "shk_"))]
    # A is keyed by ESPN team_id, G by balldontlie team ids, so the home/away split has to
    # come from the box score's own home_away flag rather than a team-id comparison
    B = pd.concat([pd.read_parquet(f, columns=["game_id", "team_id", "home_away"])
                   for f in sorted(__import__("glob").glob(
                       f"{ROOT}/data/raw/nba_pbp/player_box_*.parquet"))],
                  ignore_index=True).drop_duplicates(["game_id", "team_id"])
    A = A.merge(B, on=["game_id", "team_id"], how="left")

    H = A[A["home_away"] == "home"][["game.id"] + feats].rename(
        columns={c: f"h_{c}" for c in feats})
    V = A[A["home_away"] == "away"][["game.id"] + feats].rename(
        columns={c: f"a_{c}" for c in feats})

    d = F.merge(H, on="game.id", how="inner").merge(V, on="game.id", how="inner")
    d = d.merge(G[["game.id", "postseason"]], on="game.id", how="left")
    for c in feats:
        d[f"d_{c}"] = d[f"h_{c}"] - d[f"a_{c}"]
        d[f"s_{c}"] = d[f"h_{c}"] + d[f"a_{c}"]
    d["date"] = pd.to_datetime(d["date"])
    return d.sort_values("date").reset_index(drop=True), feats


def cols_for(feats, kinds, market):
    pre = "d_" if market == "margin" else "s_"
    return [f"{pre}{c}" for c in feats if any(c.startswith(k) for k in kinds)]


def walk_forward(d, X, y, mask):
    pred = np.full(len(d), np.nan)
    per = d["date"].dt.to_period("M")
    for p in sorted(per.unique()):
        te = (per == p).to_numpy() & mask
        tr = (per < p).to_numpy() & mask
        if te.sum() == 0 or tr.sum() < MIN_TRAIN:
            continue
        sc = StandardScaler().fit(X[tr])
        m = Ridge(alpha=ALPHA).fit(sc.transform(X[tr]), y[tr])
        pred[te] = m.predict(sc.transform(X[te]))
    return pred


def score(y, p, mask):
    k = mask & np.isfinite(p) & np.isfinite(y)
    if k.sum() < 100:
        return np.nan, np.nan, int(k.sum())
    r2 = 100 * (1 - ((y[k] - p[k]) ** 2).sum() / (y[k] ** 2).sum())
    return 100 * np.corrcoef(y[k], p[k])[0, 1], r2, int(k.sum())


def to_dec(a):
    """These odds columns are DECIMAL (~1.909), not American. Reading them as American
    printed a -46% ROI on a 52% win rate, which is arithmetically impossible and was the
    tell. Both forms are accepted so the helper cannot be silently mis-fed later."""
    a = pd.to_numeric(a, errors="coerce").to_numpy(dtype=float)
    amer = np.where(a > 0, 1 + a / 100.0, 1 + 100.0 / np.abs(a))
    return np.where((a >= 1.01) & (a <= 40.0), a, amer)


def roi(win, dec):
    return np.where(win, dec - 1.0, -1.0)


def bet_table(d, p, ycol, price_hi, price_lo, label, L):
    """Win rate by |predicted edge|, each cell next to the baseline of that same cell."""
    y = d[ycol].to_numpy(dtype=float)
    ph, pl = to_dec(d[price_hi]), to_dec(d[price_lo])
    seas = d["season"].to_numpy()
    ok = np.isfinite(p) & np.isfinite(y) & np.isfinite(ph) & np.isfinite(pl) & (y != 0)

    L += ["", f"### {label} — bets vs the T-60 close", "",
          "| min edge | n | side taken | win % | slice base % | ROI % | boot p5 win% | "
          "by season (win% / n) |", "|---|---|---|---|---|---|---|---|"]
    for thr in (0.0, 1.0, 2.0, 3.0, 4.0, 5.0):
        m = ok & (np.abs(p) >= thr)
        if m.sum() < 100:
            continue
        take_hi = p[m] > 0
        win = np.where(take_hi, y[m] > 0, y[m] < 0)
        dec = np.where(take_hi, ph[m], pl[m])
        # the baseline for THIS slice: blindly taking whichever side won more often here.
        # A 56% that sits in a 55% slice is nothing, and pooling hides that.
        base = max((y[m] > 0).mean(), (y[m] < 0).mean())
        bs = RNG.choice(win, size=(BOOT, len(win)), replace=True).mean(axis=1)
        # per-season, because a pooled number can be carried entirely by one good year
        sm = seas[m]
        per = " ".join(f"{s}:{100*win[sm == s].mean():.0f}/{(sm == s).sum()}"
                       for s in sorted(set(sm)))
        L.append(f"| {thr:.0f} | {m.sum():,} | {100*take_hi.mean():.0f}% high | "
                 f"{100*win.mean():.1f} | {100*base:.1f} | "
                 f"{100*roi(win, dec).mean():+.1f} | {100*np.quantile(bs, .05):.1f} | "
                 f"{per} |")


def main():
    d, feats = load()
    print(f"{len(d):,} games with RAPM aggregates joined", flush=True)

    # placebo: permute whole feature ROWS within season. Sign-flipping is a no-op for
    # totals (h+a is unchanged by a swap) and would print a reassuring bug.
    perm = np.arange(len(d))
    for s in d["season"].unique():
        idx = np.where(d["season"].to_numpy() == s)[0]
        perm[idx] = RNG.permutation(idx)

    gp = d[["h_gp", "a_gp"]].min(axis=1)
    phase = np.where(gp < 15, "early", np.where(gp < 50, "mid", "late"))
    phase = np.where(d["postseason"].fillna(False).to_numpy(dtype=bool), "playoffs", phase)

    TARGETS = [("1H margin", "y_h1_marg_resid", "margin"),
               ("1H total", "y_h1_tot_resid", "total"),
               ("FG margin", "y_fg_marg_resid", "margin"),
               ("FG total", "y_fg_tot_resid", "total")]

    def lvl(w):
        return [f"{w}_lvl", f"{w}_top", f"{w}_best", f"{w}_worst", f"{w}_hhi",
                f"{w}_n", f"{w}_covered"]

    SETS = [("semi-oracle LEVEL", lvl("sem")),
            ("durable LEVEL", lvl("dur")),
            ("projected LEVEL", lvl("prj")),
            ("semi-oracle SHOCK", ["shk_sem"]),
            ("durable SHOCK", ["shk_dur"]),
            ("semi-oracle OUT", ["sem_out"]),
            ("durable OUT", ["dur_out"]),
            ("projected OUT", ["prj_out"]),
            ("semi-oracle ALL", ["sem_", "shk_sem"]),
            ("durable ALL", ["dur_", "shk_dur"])]

    L = ["# NBA player-IMPACT model — the RAPM ceiling test", "",
         "Same harness as `NBA_PLAYER_CEILING_BRIEF.md`, run on RAPM features instead of "
         "box-score rates. Fit on the market residual (actual − T-60 line), ridge "
         "alpha=25, expanding monthly walk-forward. **Negative R² means worse than "
         "trusting the line.**", "",
         "Box-score baseline to beat: FG margin +4.8, FG total +4.0, 1H total +4.0, "
         "1H margin +1.6, all with negative R², placebo band −3.7 to +2.2.", "",
         "| market | feature set | n | corr(pred, resid) % | R² vs market % |",
         "|---|---|---|---|---|"]

    store = {}
    for lab, ycol, mk in TARGETS:
        y = d[ycol].to_numpy(dtype=float)
        base = np.isfinite(y)
        for kname, kinds in SETS:
            X = np.nan_to_num(d[cols_for(feats, kinds, mk)].to_numpy(dtype=float),
                              nan=0.0, posinf=0.0, neginf=0.0)
            p = walk_forward(d, X, np.nan_to_num(y), base)
            c, r2, n = score(y, p, base)
            store[(lab, kname)] = p
            L.append(f"| {lab} | {kname} | {n:,} | {c:+.1f} | {r2:+.2f} |")
        X = np.nan_to_num(d[cols_for(feats, ["sem_"], mk)].to_numpy(dtype=float),
                          nan=0.0, posinf=0.0, neginf=0.0)[perm]
        p = walk_forward(d, X, np.nan_to_num(y), base)
        c, r2, n = score(y, p, base)
        store[(lab, "placebo")] = p
        L.append(f"| {lab} | **placebo (rows permuted)** | {n:,} | {c:+.1f} | {r2:+.2f} |")

    L += ["", "## Hypothesis 1 — does OUT beat LEVEL?", "",
          "Registered before the run. The market prices roster quality over the summer "
          "and cannot pre-price tonight's absences. If LEVEL scores and OUT does not, "
          "the model is re-reading team strength that the line already contains.", "",
          "| market | LEVEL (dur) | OUT (dur) | SHOCK (dur) | placebo |",
          "|---|---|---|---|---|"]
    for lab, ycol, mk in TARGETS:
        y = d[ycol].to_numpy(dtype=float)
        b = np.isfinite(y)
        cells = [f"{score(y, store[(lab, k)], b)[0]:+.1f}" for k in
                 ("durable LEVEL", "durable OUT", "durable SHOCK", "placebo")]
        L.append(f"| {lab} | " + " | ".join(cells) + " |")

    L += ["", "## Hypothesis 3 — how much is an availability feed worth?", "",
          "`sem` knows who is actually out; `prj` only knows who played last game.", "",
          "| market | sem OUT (exact) | dur OUT (bettable) | prj OUT (no feed) | dur LEVEL |", "|---|---|---|---|---|"]
    for lab, ycol, mk in TARGETS:
        y = d[ycol].to_numpy(dtype=float)
        b = np.isfinite(y)
        cells = [f"{score(y, store[(lab, k)], b)[0]:+.1f}" for k in
                 ("semi-oracle OUT", "durable OUT", "projected OUT",
                  "durable LEVEL")]
        L.append(f"| {lab} | " + " | ".join(cells) + " |")

    L += ["", "## By season phase", "",
          "| market | feature set | early | mid | late | playoffs |",
          "|---|---|---|---|---|---|"]
    for lab, ycol, mk in TARGETS:
        y = d[ycol].to_numpy(dtype=float)
        b = np.isfinite(y)
        for kname in ("durable LEVEL", "durable OUT", "durable ALL", "placebo"):
            p = store[(lab, kname)]
            cells = []
            for ph in ("early", "mid", "late", "playoffs"):
                c, _, n = score(y, p, b & (phase == ph))
                cells.append("—" if not np.isfinite(c) else f"{c:+.1f} (n={n:,})")
            L.append(f"| {lab} | {kname} | " + " | ".join(cells) + " |")

    # bet simulation on the strongest set per market, at real prices
    L += ["", "## What it would have actually bet"]
    PRICES = {"FG margin": ("t60_spread_home_price", "t60_spread_away_price"),
              "FG total": ("t60_total_over_price", "t60_total_under_price"),
              "1H margin": ("t60_spread_home_price", "t60_spread_away_price"),
              "1H total": ("t60_total_over_price", "t60_total_under_price")}
    for lab, ycol, mk in TARGETS:
        y = d[ycol].to_numpy(dtype=float)
        b = np.isfinite(y)
        best = max([s[0] for s in SETS],
                   key=lambda k: (score(y, store[(lab, k)], b)[0]
                                  if np.isfinite(score(y, store[(lab, k)], b)[0])
                                  else -99))
        hi, lo = PRICES[lab]
        bet_table(d, store[(lab, best)], ycol, hi, lo, f"{lab} — {best}", L)
        bet_table(d, store[(lab, "placebo")], ycol, hi, lo, f"{lab} — PLACEBO", L)

    path = os.path.join(ROOT, "NBA_RAPM_CEILING_BRIEF.md")
    with open(path, "w") as f:
        f.write("\n".join(L) + "\n")
    print("\n".join(L), flush=True)
    print(f"\nwrote {path}", flush=True)


if __name__ == "__main__":
    main()
