#!/usr/bin/env python3
"""What should an NBA spread/moneyline model actually PREDICT? Four targets each, one bet rule.

THE QUESTION. Every NBA model in this repo predicts a RESIDUAL: the margin measured against the
posted line, or a team's win as a 0/1. The owner's point is that the other WagerProof models do not
work that way -- they predict the raw quantity (the margin of victory) or they predict the MARKET
(the fair line, the fair price) and bet the disagreement. Those are three genuinely different
estimation problems that happen to share a bet rule, and nothing here has ever compared them.

WHY IT IS NOT OBVIOUS WHICH WINS. Regressing the residual hands the model the line for free and asks
only for the part the market missed -- the cleanest statement of the thing we want, but a target with
a 13.5-point standard deviation that is ~97% noise. Regressing the raw margin makes the model
re-derive the whole 15.5-point quantity, most of which the line already knows, so almost all of the
fit is spent reproducing public information; but it is a target with real structure, and a ridge
given real structure estimates its coefficients far more stably than one fed near-noise. Regressing
the LINE ITSELF is the strangest of the three and the one the owner has had work elsewhere: the
target's sd is only 7.4 points and it is nearly deterministic in the features, so the fit is sharp --
but it is learning the market's own opinion function, and its disagreement with the posted number is
then estimation error rather than insight. That last objection is a real one and this file does not
argue it away; it measures it.

THE COMPARISON IS ONLY FAIR IF THE RULE IS IDENTICAL. Every variant below is reduced to the SAME
game-level quantity -- the model's margin minus the posted margin, in points -- and pushed through
the SAME ladder, the same 20 game-level null shuffles, the same T-60 prices, the same per-season and
per-phase breakouts. A variant that looks better only because its numbers are on a different scale
would be an artefact, so the scale is normalised before anything is graded.

WHAT "NO LINE" MEANS. Variants that predict the margin from scratch, and every variant that predicts
the market, must not be shown the market. In this panel that is exactly two columns: `impl` (the
FG-implied team total, whose own-minus-opp difference IS the posted spread) and `t60_total_point`.
Everything else in the 433-column stack is team form, ratings, rest, travel and availability. The
total is symmetric and cannot by itself move an antisymmetric target, but it is dropped anyway so
that "this model never saw a price" is a statement with no footnotes attached.

MONEYLINE, the same three ways: the win as 0/1, the de-vigged posted probability, and the posted
DECIMAL PRICE itself -- plus the one route the spread work makes available for free, converting the
margin model into a win probability through an as-of normal map. Predicting price rather than
probability is not a reparameterisation: squared error in price space weights a 14.0 longshot ~200x
harder than a 1.05 favourite, so it fits an entirely different part of the book.
"""
import importlib.util
import os
import warnings

import numpy as np
import pandas as pd
from scipy.stats import norm

warnings.filterwarnings("ignore")

ROOT = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(ROOT, "data", "parquet", "_nba_wide_cache.parquet")
PRED = os.path.join(ROOT, "data", "parquet", "_nba_targets_preds.parquet")
NULLS = 20
KS_SP = (1, 2, 3, 4, 5)          # points of disagreement with the posted spread
KS_ML = (2, 4, 6, 8, 10)         # percentage points of disagreement with the de-vigged price
# The market columns. `impl` is the line: own-row impl minus opp-row impl is exactly the spread.
MARKET = ("impl", "t60_total_point")


def _load(name, path):
    spec = importlib.util.spec_from_file_location(name, os.path.join(ROOT, path))
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


v2 = _load("v2", "nba_total_v2.py")
mk = _load("mk", "nba_markets.py")
pa = _load("pa", "nba_panel_all.py")


def to_game(P, p, G):
    """Panel prediction -> game-level own-minus-opp quantity, averaged over both perspectives.

    Averaging the home and away rows cancels the part of a fit that disagrees with itself about
    which team is which -- the fit is not constrained to be antisymmetric, so that disagreement is
    real and is pure noise.
    """
    t = P.assign(p=p)[["event_id", "team_row", "p"]]
    g = t.pivot(index="event_id", columns="team_row", values="p").reindex(G.index)
    return (g["home"] - g["away"]) / 2.0


def devig(dh, da):
    """Two-way de-vig by normalising the reciprocals. Returns the home probability."""
    ih, ia = 1.0 / dh, 1.0 / da
    return ih / (ih + ia)


def asof_sd(y, pred, dates, min_n=500):
    """Expanding out-of-sample sd of (actual - predicted), known strictly before each game.

    Needed to turn a predicted margin into a win probability without handing the mapping a number
    computed from the games it is about to price.
    """
    e = (y - pred).astype(float)
    o = np.argsort(dates.values, kind="stable")
    s = pd.Series(np.nan, index=y.index)
    ev = e.iloc[o]
    run = ev.expanding().std().shift(1)
    run[ev.expanding().count().shift(1) < min_n] = np.nan
    s.iloc[o] = run.values
    return s.bfill().fillna(e.std())


def ladder(L, d, yb, po, pu, nulls, ks, tag, unit):
    L += [f"| cut ({unit}) | bets | win% | base% | edge | ROI | null mean | null sd | z |",
          "|---|---|---|---|---|---|---|---|---|"]
    best = None
    for k in ks:
        g = pa.grade(d, yb, po, pu, k)
        if not g["n"]:
            continue
        ne = np.array([(lambda q: q["win"] - q["base"])(pa.grade(n, yb, po, pu, k))
                       for n in nulls], dtype=float)
        mu, sd = np.nanmean(ne), np.nanstd(ne, ddof=1)
        z = (g["win"] - g["base"] - mu) / sd if sd and sd > 0 else np.nan
        L.append(f"| ≥{k:g} | {g['n']:,} | {g['win']:.1f} | {g['base']:.1f} | "
                 f"**{g['win']-g['base']:+.1f}** | **{g['roi']:+.1f}** | {mu:+.2f} | {sd:.2f} "
                 f"| **{z:+.2f}** |")
        print(f"[{tag}] " + L[-1], flush=True)
        if best is None or g["roi"] > best[1]["roi"]:
            best = (k, g, z)
    L.append("")
    return L, best


def breakout(L, G, d, yb, po, pu, k, label):
    L += [f"### {label} broken out at the ≥{k:g} cut", ""]
    for col, lab in (("season", "season"), ("phase", "phase")):
        L += [f"| {lab} | bets | win% | base% | edge | ROI |", "|---|---|---|---|---|---|"]
        order = (("EARLY", "MID", "LATE", "POST") if col == "phase"
                 else sorted(G[col].dropna().unique()))
        for vv in order:
            g = pa.grade(d, yb, po, pu, k, mask=(G[col] == vv))
            if g["n"]:
                t = vv if col == "phase" else str(int(vv))
                L.append(f"| {t} | {g['n']:,} | {g['win']:.1f} | {g['base']:.1f} | "
                         f"**{g['win']-g['base']:+.1f}** | **{g['roi']:+.1f}** |")
                print(f"[{col}] " + L[-1], flush=True)
        L.append("")
    return L


def main():
    D = pd.read_parquet(CACHE).sort_values("date").reset_index(drop=True)
    D["date"] = pd.to_datetime(D["date"])
    assert D["event_id"].is_unique, "duplicate events in the cache; phantom drop did not run"
    P, fcols = pa.build_panel(D, pa.wide_stack(D))
    G = D.set_index("event_id").copy()
    sgn = np.where(P["team_row"] == "home", 1.0, -1.0)

    full = [c for c in fcols if pd.api.types.is_numeric_dtype(P[c])]
    noline = [c for c in full if c not in MARKET]
    print(f"[targets] {len(P):,} team-games | {len(full)} features with the market, "
          f"{len(noline)} without", flush=True)

    sp = G["t60_spread_home_point"].astype(float)
    dh = pd.Series(v2.to_dec(G["t60_ml_home_price"]), index=G.index)
    da = pd.Series(v2.to_dec(G["t60_ml_away_price"]), index=G.index)
    mp_home = devig(dh, da)

    # ---- targets, own perspective -----------------------------------------------------------
    y_resid = pd.Series(P["event_id"].map(G["y_fg_marg_resid"]).astype(float) * sgn, index=P.index)
    y_marg = pd.Series(P["event_id"].map(G["y_fg_margin"]).astype(float) * sgn, index=P.index)
    y_fair = pd.Series(P["event_id"].map(-sp).astype(float) * sgn, index=P.index)
    hw = pd.Series(np.where(G["y_fg_margin"] > 0, 1.0, 0.0), index=G.index)
    y_win = pd.Series(np.where(P["team_row"] == "home", P["event_id"].map(hw),
                               1.0 - P["event_id"].map(hw)), index=P.index)
    y_mprob = pd.Series(np.where(P["team_row"] == "home", P["event_id"].map(mp_home),
                                 1.0 - P["event_id"].map(mp_home)), index=P.index)
    y_price = pd.Series(np.where(P["team_row"] == "home", P["event_id"].map(dh),
                                 P["event_id"].map(da)), index=P.index)

    # ---- bet-rule inputs and the oracle -----------------------------------------------------
    yb_sp = pd.Series(np.where(G["y_fg_marg_resid"] > 0, 1.0,
                               np.where(G["y_fg_marg_resid"] < 0, 0.0, np.nan)), index=G.index)
    po_sp = pd.Series(v2.to_dec(G["t60_spread_home_price"]), index=G.index)
    pu_sp = pd.Series(v2.to_dec(G["t60_spread_away_price"]), index=G.index)
    yb_ml = hw.where(G["y_fg_margin"] != 0)

    # ORACLE, both markets. Feed the realised outcome into the very rule every variant is graded
    # by; a coherently-signed grader wins ~100%. This is the one line that stands between this file
    # and a repeat of the inverted-sign episode, and it is cheap enough to have no excuse.
    o_sp = pa.grade(G["y_fg_marg_resid"], yb_sp, po_sp, pu_sp, 0)
    o_ml = pa.grade(pd.Series(np.where(hw > 0, 1.0, -1.0), index=G.index), yb_ml, dh, da, 0)
    assert o_sp["win"] > 99.5, f"spread oracle {o_sp['win']:.1f}% -- sign inverted"
    assert o_ml["win"] > 99.5, f"moneyline oracle {o_ml['win']:.1f}% -- sign inverted"
    print(f"[targets] oracle spread {o_sp['win']:.1f}% | moneyline {o_ml['win']:.1f}% | "
          f"home covers {100*yb_sp.mean():.1f}% | home wins {100*yb_ml.mean():.1f}%", flush=True)

    # ---- walk-forward -----------------------------------------------------------------------
    rng = np.random.default_rng(20260801)
    SPEC = [("T1", "full", y_resid), ("T2", "full", y_marg),
            ("T3", "noline", y_marg), ("T4", "noline", y_fair),
            ("M1", "full", y_win), ("M2", "noline", y_mprob), ("M3", "noline", y_price)]

    if os.path.exists(PRED):
        C = pd.read_parquet(PRED)
        assert len(C) == len(P), "cached predictions do not match the panel; delete the file"
        preds = {t: [C[f"{t}_{i}"] for i in range(NULLS + 1)] for t, _, _ in SPEC}
        print("[targets] loaded cached predictions", flush=True)
    else:
        preds = {}
        for setname, cols in (("full", full), ("noline", noline)):
            names = [t for t, s, _ in SPEC if s == setname]
            ys, owner = [], []
            for t, s, y in SPEC:
                if s != setname:
                    continue
                ys += [y] + [pa.game_shuffle(P, y, rng) for _ in range(NULLS)]
                owner += [t] * (NULLS + 1)
            print(f"[targets] {setname}: walking {len(ys)} targets ({', '.join(names)}) "
                  f"over {len(cols)} features", flush=True)
            out = pa.ridge_multi(P[cols].astype(float), P["date"], ys)
            for t in names:
                preds[t] = [out[i] for i in range(len(owner)) if owner[i] == t]
        pd.DataFrame({f"{t}_{i}": preds[t][i] for t, _, _ in SPEC
                      for i in range(NULLS + 1)}).to_parquet(PRED)

    # A null that correlates with the target is not a null -- but the raw-quantity targets need
    # this asked carefully. `game_shuffle` moves both rows of a game together, so it PRESERVES the
    # home/away split, and a raw margin still averages about +2.7 on home rows after any shuffle.
    # A model that has learned only "home teams win by three" therefore correlates with its own
    # nulls at ~+0.07 without knowing a single thing about the games. That constant is not an
    # advantage -- it survives into d as a fixed offset and gets graded honestly at every rung --
    # so what has to be null is the GAME-SPECIFIC opinion: both sides centred within team_row.
    for t, _, y in SPEC:
        def spec(v):
            return v - v.groupby(P["team_row"]).transform("mean")
        nr = np.nanmean([spec(preds[t][i]).corr(spec(y)) for i in range(1, NULLS + 1)])
        print(f"[targets] {t}: oos corr {preds[t][0].corr(y):+.4f} "
              f"(game-specific {spec(preds[t][0]).corr(spec(y)):+.4f}) | null {nr:+.4f}", flush=True)
        assert abs(nr) < 0.02, f"{t} nulls carry game-specific signal ({nr:+.4f})"

    # ---- reduce every spread variant to the SAME quantity: model margin minus posted ---------
    def sp_edge(t, i):
        g = to_game(P, preds[t][i], G)
        return g if t == "T1" else g + sp           # residual targets are already the difference

    L = ["# NBA — what should the model predict?", "",
         "Every NBA model in this repo predicts a **residual**: the margin measured against the "
         "posted line, or a win as a 0/1. The other WagerProof models do not work that way — they "
         "predict the raw quantity, or they predict the **market itself** and bet the "
         "disagreement. Those are three different estimation problems sharing one bet rule, and "
         "they had never been compared here. This file compares them on identical rows, an "
         "identical rule, identical T-60 prices and the same 20 game-level null shuffles.", "",
         f"Frame: **{len(P):,} team-games from {len(G):,} games**, four seasons, on the repaired "
         f"outcome data (ESPN scores, Clippers home games restored, wrong-leg joins fixed). "
         f"Oracle passes at {o_sp['win']:.1f}% (spread) and {o_ml['win']:.1f}% (moneyline); home "
         f"covers {100*yb_sp.mean():.1f}% and wins {100*yb_ml.mean():.1f}%.", "",
         "## The spread, four ways", "",
         "All four are reduced to the same number before grading — **the model's margin minus the "
         "posted margin, in points** — so a `≥2` rung means the same thing in every table.", "",
         "| variant | target | sees the line? | bet rule |", "|---|---|---|---|",
         "| **T1** | margin **residual** vs the posted line (current route) | yes | bet the sign |",
         "| **T2** | **raw margin of victory** | yes | bet if predicted margin beats the line |",
         "| **T3** | **raw margin of victory** | **no** | bet if predicted margin beats the line |",
         "| **T4** | **the posted line itself** (a fair-line model) | **no** | bet if the fair line "
         "differs from the posted line |", ""]

    sp_res = {}
    for t, name in (("T1", "residual vs the line, market in the features (current route)"),
                    ("T2", "raw margin of victory, market in the features"),
                    ("T3", "raw margin of victory, market withheld"),
                    ("T4", "the posted line itself — a fair-line model, market withheld")):
        d = sp_edge(t, 0)
        nd = [sp_edge(t, i) for i in range(1, NULLS + 1)]
        L += [f"### {t} — {name}", "",
              f"Prediction spread: **{d.std():.2f} points** of disagreement with the posted line "
              f"(sd). Correlation with the realised residual: **{d.corr(G['y_fg_marg_resid']):+.4f}"
              f"**; with the realised margin: **{d.corr(G['y_fg_margin']):+.4f}**.", ""]
        L, best = ladder(L, d, yb_sp, po_sp, pu_sp, nd, KS_SP, t, "pts")
        sp_res[t] = (name, d, best)

    win_sp = max(sp_res, key=lambda t: (sp_res[t][2] or (0, dict(roi=-99), 0))[1]["roi"])
    nm, d, best = sp_res[win_sp]
    k = best[0]
    L += [f"## Best spread target: **{win_sp}** — {nm}", "",
          "Pooled numbers hide a signal that lives in one season or decays out, so the winner "
          "always runs alongside its own breakout. Every win% sits next to the base rate of "
          "**its own slice**.", ""]
    L = breakout(L, G, d, yb_sp, po_sp, pu_sp, k, win_sp)

    # Is the opinion about TEAMS or about PRICE? A margin model that only reproduces the market's
    # favourite/dog split has discovered the market, not the games.
    L += ["### which side, and is it just betting favourites", "",
          "Baseline for a side table is the LEAGUE rate for that same side — `grade`'s best-blind-"
          "side baseline is self-referential once you have conditioned on the side taken.", "",
          "| slice | bets | win% | base% | edge | ROI |", "|---|---|---|---|---|---|"]
    hf = G["t60_spread_home_point"] < 0
    for lab, g in (("home covers", pa.grade_side(d, yb_sp, po_sp, pu_sp, k, True)),
                   ("away covers", pa.grade_side(d, yb_sp, po_sp, pu_sp, k, False))):
        if g:
            L.append(f"| {lab} | {g['n']:,} | {g['win']:.1f} | {g['base']:.1f} | "
                     f"**{g['win']-g['base']:+.1f}** | **{g['roi']:+.1f}** |")
            print("[side] " + L[-1], flush=True)
    for lab, m in (("model on the market's favourite", ((d > 0) & hf) | ((d < 0) & ~hf)),
                   ("model on the market's dog", ((d > 0) & ~hf) | ((d < 0) & hf))):
        g = pa.grade(d, yb_sp, po_sp, pu_sp, k, mask=m)
        if g["n"]:
            L.append(f"| {lab} | {g['n']:,} | {g['win']:.1f} | {g['base']:.1f} | "
                     f"**{g['win']-g['base']:+.1f}** | **{g['roi']:+.1f}** |")
            print("[favdog] " + L[-1], flush=True)
    L.append("")

    # ---- how much history should the winning target train on? --------------------------------
    # The total's edge did not exist until the training window was made recent (pooled +0.3% ROI vs
    # +4.5% at a 180-day half-life), and the residual spread was swept in NBA_SPREAD_REDO. The RAW
    # MARGIN never has been, and there is no reason its memory should match either -- it is a much
    # less noisy target, which usually means it can afford to look further back.
    SW = os.path.join(ROOT, "data", "parquet", "_nba_targets_sweep.parquet")
    HALF_LIVES = [60, 90, 120, 180, 240, 365, None]
    if os.path.exists(SW):
        S = pd.read_parquet(SW)
    else:
        S = pd.DataFrame({str(h): pa.ridge_multi(P[full].astype(float), P["date"], [y_marg],
                                                 half_life=h)[0] for h in HALF_LIVES})
        S.to_parquet(SW)
    QS = (0.50, 0.75, 0.85, 0.90, 0.95)
    L += ["## How much history should it train on?", "",
          "The full-game total went from worthless to +4.5% ROI on recency weighting alone — "
          "pooled history was the worst of ten settings. The raw-margin target has never been "
          "swept.", "",
          "**Graded at fixed SELECTIVITY, not a fixed points cut.** A shorter half-life makes the "
          "model more volatile, so a fixed `≥5 points` rung selects 1,389 bets at a 60-day "
          "half-life and 297 at pooled — comparing those is comparing two different strategies, "
          "not two memories. Held at the same top-N% of games, the confound disappears. It also "
          "changes the answer: at a fixed points cut the sweep looked like a lone spike at 180, "
          "which is exactly the shape that should not be trusted; at fixed selectivity it is a "
          "broad hill.", "",
          "| half-life (days) | " + " | ".join(f"top {int(100*(1-q))}%" for q in QS) + " |",
          "|---|" + "---|" * len(QS)]
    for h in HALF_LIVES:
        d_ = to_game(P, S[str(h)], G) + sp
        a_ = d_[d_.notna() & yb_sp.notna()].abs()
        cells = [pa.grade(d_, yb_sp, po_sp, pu_sp, a_.quantile(q))["roi"] for q in QS]
        lab = "**None (pooled)**" if h is None else str(h)
        L.append(f"| {lab} | " + " | ".join(f"**{c:+.1f}**" for c in cells) + " |")
        print("[grid] " + L[-1], flush=True)
    L += ["", "ROI, in %. Two things read straight off it. **The recency law replicates**: pooled "
          "and 365-day are negative in every column, and every setting from 60 to 180 days is "
          "positive once the bets are selective. And **selectivity matters more than memory** — "
          "at the top 50% and top 25% of disagreements nothing works at any half-life, so the "
          "edge is entirely in the tail. The best single cell is one of 35; its neighbours run "
          "roughly +2 to +6, which is the range worth believing rather than the argmax.", ""]

    # ---- moneyline --------------------------------------------------------------------------
    L += ["## The moneyline, four ways", "",
          "Same treatment. Everything is reduced to **the model's home win probability minus the "
          "de-vigged posted probability, in percentage points**, and bet at the posted price — so "
          "unlike the spread, the payout varies with the side taken and ROI is the number that "
          "matters, not win%.", "",
          "| variant | target | sees the price? |", "|---|---|---|",
          "| **M1** | the win, as 0/1 (current route) | yes |",
          "| **M2** | the **de-vigged posted probability** | **no** |",
          "| **M3** | the **posted decimal price** | **no** |",
          "| **M4** | derived from T3's margin through an as-of normal map | **no** |",
          "| **M2d, M3d** | M2 and M3 **de-shrunk** — see below | **no** |", "",
          "**Why M2 and M3 need a correction before they can be judged.** A ridge shrinks its "
          "predictions toward the mean, and when the target IS a probability that shrinkage is not "
          "symmetric in its consequences: M2 regressed on the market has slope **0.827**, so it "
          "systematically prices favourites as weaker than the book does and underdogs as "
          "stronger. The bet rule then takes the dog on **73.5%** of its bets and **83.7%** at the "
          "widest cut. That is not an opinion about basketball, it is the estimator's variance "
          "penalty leaking into the side selection, and grading it would be grading the artefact. "
          "M2d and M3d rescale the model's log-odds dispersion to match the market's using an "
          "**expanding, strictly-prior** ratio, which removes the bias without telling the model "
          "anything it could not have known. M1 does not need this — its slope is 0.991 and it "
          "takes the dog on 53% of bets, because a residual target has nothing to shrink toward.",
          ""]

    def logit(p):
        p = np.clip(p, 1e-4, 1 - 1e-4)
        return np.log(p / (1 - p))

    def deshrink(ph, i):
        """Match the model's log-odds dispersion to the market's, using only prior games.

        The ridge's slope against the market is <1 by construction, which biases the SIDE the bet
        rule takes rather than just blurring the size. Rescaling in log-odds space around the
        market's own number removes exactly that bias and leaves the model's ranking untouched.
        The ratio is expanding and shifted, so a game is never rescaled using itself.
        """
        z, zm = logit(ph), logit(mp_home)
        e = pd.Series(z - zm, index=G.index)
        o = np.argsort(G["date"].values, kind="stable")
        ev = e.iloc[o]
        sd_m = pd.Series(logit(mp_home), index=G.index).iloc[o].expanding().std().shift(1)
        sd_e = ev.expanding().std().shift(1)
        # target dispersion: the market's, since a fair-price model should be as opinionated as
        # the thing it is trying to reproduce -- no more, and no less
        k_ = (sd_m / sd_e.replace(0, np.nan)).clip(1.0, 6.0)
        k_[ev.expanding().count().shift(1) < 500] = 1.0
        kk = pd.Series(np.nan, index=G.index)
        kk.iloc[o] = k_.values
        return pd.Series(1.0 / (1.0 + np.exp(-(zm + kk.fillna(1.0) * e))), index=G.index)

    def ml_edge(t, i):
        if t in ("M2d", "M3d"):
            return 100.0 * (deshrink(mp_home + ml_edge(t[:2], i) / 100.0, i) - mp_home)
        if t == "M3":
            # price -> probability, then renormalise the pair so the two sides sum to one. A raw
            # 1/pred does not: the fit has no idea it is predicting two halves of a book.
            g = P.assign(p=preds[t][i])[["event_id", "team_row", "p"]] \
                 .pivot(index="event_id", columns="team_row", values="p").reindex(G.index)
            ih, ia = 1.0 / g["home"].clip(lower=1.01), 1.0 / g["away"].clip(lower=1.01)
            ph = ih / (ih + ia)
        elif t == "M4":
            m = to_game(P, preds["T3"][i], G)
            ph = pd.Series(norm.cdf(m / asof_sd(G["y_fg_margin"], m, G["date"])), index=G.index)
        else:
            g = P.assign(p=preds[t][i])[["event_id", "team_row", "p"]] \
                 .pivot(index="event_id", columns="team_row", values="p").reindex(G.index)
            # home row predicts P(home wins), away row predicts P(away wins) -- average the two
            # readings of the same quantity rather than trusting either alone
            ph = (g["home"] + (1.0 - g["away"])) / 2.0
        return 100.0 * (ph - mp_home)

    ml_res = {}
    for t, name in (("M1", "the win as 0/1, market in the features (current route)"),
                    ("M2", "the de-vigged posted probability — a fair-price model"),
                    ("M3", "the posted decimal price itself"),
                    ("M4", "T3's margin pushed through an as-of normal map"),
                    ("M2d", "the de-vigged posted probability, de-shrunk"),
                    ("M3d", "the posted decimal price, de-shrunk")):
        d = ml_edge(t, 0)
        nd = [ml_edge(t, i) for i in range(1, NULLS + 1)]
        m0 = d.abs() >= KS_ML[0]
        dogp = 100 * float((((d[m0] > 0) & (mp_home[m0] < 0.5))
                            | ((d[m0] < 0) & (mp_home[m0] > 0.5))).mean())
        ph_ = mp_home + d / 100.0
        slope = np.polyfit(mp_home[ph_.notna()], ph_[ph_.notna()], 1)[0]
        L += [f"### {t} — {name}", "",
              f"Prediction spread: **{d.std():.2f} percentage points** of disagreement with the "
              f"de-vigged book (sd). Slope against the market **{slope:.3f}** (1.0 = unbiased); "
              f"takes the underdog on **{dogp:.1f}%** of its bets.", ""]
        L, best = ladder(L, d, yb_ml, dh, da, nd, KS_ML, t, "pct pts")
        ml_res[t] = (name, d, best)

    win_ml = max(ml_res, key=lambda t: (ml_res[t][2] or (0, dict(roi=-99), 0))[1]["roi"])
    nm, d, best = ml_res[win_ml]
    L += [f"## Best moneyline target: **{win_ml}** — {nm}", ""]
    L = breakout(L, G, d, yb_ml, dh, da, best[0], win_ml)

    with open(os.path.join(ROOT, "NBA_TARGETS.md"), "w") as f:
        f.write("\n".join(L) + "\n")
    print("wrote NBA_TARGETS.md", flush=True)


if __name__ == "__main__":
    main()
