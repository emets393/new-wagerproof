#!/usr/bin/env python3
"""NBA full-game spread, rebuilt from scratch under the corrected sign convention.

WHY THIS EXISTS. Every spread number this repo published before 2026-08-01 was graded with an
inverted sign: `nba_panel.py` and `nba_panel_all.py` compared the model's margin FLIPPED INTO POSTED
CONVENTION against the posted line by SUBTRACTION, while the outcome column is a margin residual
built by ADDITION. Every derived spread bet went on the wrong side, and the resulting "-8.3% ROI,
anti-predictive, third construction to fail" verdict went into three documents. The sign is fixed and
both files now assert an oracle check, but a corrected grade of a model that was never tuned honestly
is not a rebuild. This is the rebuild.

WHAT "THE SAME TREATMENT AS THE TOTAL" MEANS, concretely. The full-game total went from worthless to
+4.5% ROI on four changes, none of them a new feature:

  1. one row per TEAM-GAME (own_/opp_/is_home), one model, market as a transform  -- NBA_PANEL_ALL.md
  2. the phantom-duplicate Odds API events dropped, 5,423 -> 5,108 games          -- build_nba_features
  3. the leak screen, so no column that saw the box score survives                -- nba_markets.leak
  4. RECENCY WEIGHTING. Training rows decay 0.5 ** (age_days / half_life). Pooled
     history graded +0.3% ROI and a 180-day half-life graded +4.5% on identical
     rows; infinite memory was the WORST of ten settings                          -- NBA_REGIME.md

Points 1-3 are inherited here by construction: this file builds its frame with `nba_panel_all`'s own
`build_panel` off the same phantom-dropped cache. Point 4 is the one that has to be re-asked rather
than assumed, because the spread is a different target and there is no reason its memory should match
the total's -- so the half-life is swept, not set.

THE SPREAD-SPECIFIC QUESTION. The total and the spread are the SUM and the DIFFERENCE of the same two
predicted team scores. A points model is free to put all of its skill in the sum: pace, rest,
altitude, referee crew and every other game-level condition move both teams the same way, which is
exactly what a total needs and exactly what a spread cannot use. Study 1 measures how the model's
accuracy splits across those two components before any variant is fitted, because if the
antisymmetric part is empty then no retuning of the points model can ever produce a spread and the
fix has to be a different target. Studies 2-4 then test three routes:

  A  derived      margin read off the points model -- the current route, kept as the baseline
  B  direct       margin residual as its own target, full feature stack
  C  direct-anti  margin residual on the ANTISYMMETRIC SUBSPACE only: every own/opp pair collapsed to
                  its difference, plus the already-antisymmetric columns and a home-field term. Half
                  the parameters, all of them structurally capable of moving the target, which for a
                  ridge is the difference between estimating a coefficient and estimating noise.

Everything is graded at the T-60 close against 20 GAME-LEVEL null shuffles, quoted next to its own
slice's base rate, and broken out per season and per phase -- pooled numbers hide a signal that
decays, so they never appear alone.
"""
import importlib.util
import os
import warnings

import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")

ROOT = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(ROOT, "data", "parquet", "_nba_wide_cache.parquet")
POINTS = os.path.join(ROOT, "data", "parquet", "_nba_panel_preds.parquet")
PRED = os.path.join(ROOT, "data", "parquet", "_nba_spread_redo.parquet")
NULLS = 20
KS = (1, 2, 3, 4, 5)
# Swept, not chosen. The total settled at 180 days; whether the margin wants the same memory is an
# open question and the answer is only believable if the sweep is a smooth hill rather than a spike.
HALF_LIVES = [60, 90, 120, 180, 240, 365, None]


def _load(name, path):
    spec = importlib.util.spec_from_file_location(name, os.path.join(ROOT, path))
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


v2 = _load("v2", "nba_total_v2.py")
mk = _load("mk", "nba_markets.py")
pa = _load("pa", "nba_panel_all.py")


def antisym_frame(D, P):
    """Collapse the panel onto the subspace that can actually move an antisymmetric target.

    own_x/opp_x become a single dif_x = own_x - opp_x. The already-antisymmetric columns carry over
    untouched (build_panel has flipped their sign on the away row). is_home becomes +/-1 so that it,
    too, is antisymmetric -- as a 0/1 it would be a constant offset the fit cannot use here.
    Symmetric and game-level columns are dropped: they are identical on both rows of a game, so they
    are structurally incapable of predicting a quantity that changes sign between those rows.
    """
    feat = [c for c in pa.wide_stack(D) if c in D.columns
            and pd.api.types.is_numeric_dtype(D[c])]
    _, _, anti, _ = pa.classify(feat)
    out = {}
    for c in P.columns:
        if c.startswith("own_"):
            o = "opp_" + c[4:]
            if o in P.columns:
                out["dif_" + c[4:]] = P[c] - P[o]
    for c in anti:
        if c in P.columns:
            out[c] = P[c]
    out["hfa"] = 2 * P["is_home"] - 1
    out["mkt_marg"] = P["_mktmarg"]
    F = pd.DataFrame(out, index=P.index)
    return F, [c for c in F.columns if F[c].notna().mean() > 0.60]


def to_game(P, p_panel, G):
    """Antisymmetrised game-level margin residual: (home row - away row) / 2.

    Averaging the two perspectives is the right estimator even when the fit is not exactly
    antisymmetric -- for variant C it is exact and the halving is a no-op, for B it cancels the part
    of the prediction that disagrees with itself about which team is which.
    """
    t = P.assign(p=p_panel)[["event_id", "team_row", "p"]]
    g = t.pivot(index="event_id", columns="team_row", values="p").reindex(G.index)
    return (g["home"] - g["away"]) / 2.0


def derived(P, p_points, G):
    """Variant A: margin residual read off the POINTS model, in the corrected orientation.

    Built the same way as the outcome it is graded against -- predicted margin PLUS the posted line,
    matching `y_fg_marg_resid = y_fg_margin + t60_spread_home_point`. Writing it any other way is
    precisely the bug this rebuild exists to undo.
    """
    t = P.assign(p=P["impl"] + p_points)[["event_id", "team_row", "p"]]
    g = t.pivot(index="event_id", columns="team_row", values="p").reindex(G.index)
    return (g["home"] - g["away"]) + G["t60_spread_home_point"]


def ladder(L, d, yb, po, pu, nulls, tag):
    L += ["| cut (pts) | bets | win% | base% | edge | ROI | null mean | null sd | z |",
          "|---|---|---|---|---|---|---|---|---|"]
    best = None
    for k in KS:
        g = pa.grade(d, yb, po, pu, k)
        if not g["n"]:
            continue
        ne = np.array([pa.grade(n, yb, po, pu, k)["win"] - pa.grade(n, yb, po, pu, k)["base"]
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


def main():
    D = pd.read_parquet(CACHE).sort_values("date").reset_index(drop=True)
    D["date"] = pd.to_datetime(D["date"])
    assert D["event_id"].is_unique, "duplicate events in the cache; phantom drop did not run"
    P, fcols = pa.build_panel(D, pa.wide_stack(D))
    G = D.set_index("event_id").copy()
    print(f"[redo] {len(P):,} team-games from {len(G):,} games", flush=True)

    # Own-perspective market margin and the residual against it. Home row keeps y_fg_marg_resid,
    # away row takes its negative -- that sign flip is the entire structural prior being tested.
    sgn = np.where(P["team_row"] == "home", 1.0, -1.0)
    P["_mktmarg"] = -P["event_id"].map(G["t60_spread_home_point"]).astype(float) * sgn
    P["_ymarg"] = P["event_id"].map(G["y_fg_marg_resid"]).astype(float) * sgn
    P["_yfg"] = P["pts"] - P["impl"]

    yb = pd.Series(np.where(G["y_fg_marg_resid"] > 0, 1.0,
                            np.where(G["y_fg_marg_resid"] < 0, 0.0, np.nan)), index=G.index)
    po = pd.Series(v2.to_dec(G["t60_spread_home_price"]), index=G.index)
    pu = pd.Series(v2.to_dec(G["t60_spread_away_price"]), index=G.index)

    # ORACLE. Feed the realised margin residual into the same bet rule every variant below is graded
    # by; a coherently-signed grader must then win ~100%. One line, and it is the only thing standing
    # between this rebuild and a repeat of the bug that made it necessary.
    orc = pa.grade(G["y_fg_marg_resid"], yb, po, pu, 0)
    assert orc["win"] > 99.5, (f"oracle grades {orc['win']:.1f}%, not ~100% -- the sign is inverted "
                               f"again")
    # A second, model-free guard: an inverted frame cannot show favourites covering ~50%.
    fav_cov = np.where(G["t60_spread_home_point"] < 0, yb, 1 - yb)
    print(f"[redo] oracle {orc['win']:.1f}% on {orc['n']:,} graded games | "
          f"favourites cover {100*np.nanmean(fav_cov):.1f}% | home covers {100*yb.mean():.1f}%",
          flush=True)

    cols_full = [c for c in fcols if c not in mk.leak(P, fcols, "_ymarg", "_mktmarg")]
    A, acols = antisym_frame(D, P)
    acols = [c for c in acols if c not in mk.leak(A.assign(_ymarg=P["_ymarg"]), acols,
                                                 "_ymarg", "mkt_marg")]
    print(f"[redo] {len(cols_full)} features (full stack) | {len(acols)} features "
          f"(antisymmetric subspace)", flush=True)

    # ---- Study 1: where does the points model's skill actually live? -----------------------
    C = pd.read_parquet(POINTS)
    assert len(C) == len(P), "cached points predictions do not match the panel; refit them"
    pts_pred = C["fg_0"]
    pv = P.assign(p=pts_pred, y=P["_yfg"])[["event_id", "team_row", "p", "y"]]
    gp = pv.pivot(index="event_id", columns="team_row", values="p")
    gy = pv.pivot(index="event_id", columns="team_row", values="y")
    sym_p, anti_p = gp["home"] + gp["away"], gp["home"] - gp["away"]
    sym_y, anti_y = gy["home"] + gy["away"], gy["home"] - gy["away"]
    r_sym, r_anti = sym_p.corr(sym_y), anti_p.corr(anti_y)
    sd_sym, sd_anti = sym_p.std(), anti_p.std()

    L = ["# NBA full-game spread — rebuilt under the corrected sign", "",
         "Every spread number published before 2026-08-01 was graded with an inverted sign "
         "(`-(pred_home − pred_away) − line` against an outcome built as `margin + line`), so every "
         "bet went on the wrong side. The sign is fixed and asserted. This is the rebuild that "
         "correction earns: the same four things that took the full-game total from worthless to "
         "+4.5% ROI — team-game panel, phantom events dropped, leak screen, and a **swept** recency "
         "half-life — applied to the margin, plus the question of whether the margin should be its "
         "own target at all.", "",
         f"Frame: **{len(P):,} team-games from {len(G):,} games**, four seasons, graded at the T-60 "
         f"close. Oracle check passes at {orc['win']:.1f}%; favourites cover "
         f"{100*np.nanmean(fav_cov):.1f}% and home teams cover {100*yb.mean():.1f}%, both of which "
         "are impossible under an inversion.", "",
         "## Study 1 — how the points model's skill splits", "",
         "The total and the spread are the SUM and the DIFFERENCE of the same two predicted team "
         "scores. Split each game's pair of predicted residuals into the part that moves both teams "
         "together (their sum — this *is* the total) and the part that separates them (their "
         "difference — this *is* the margin), then correlate each against the matching actual. "
         "This is measured before any variant is fitted, so it is a diagnosis and not a "
         "rationalisation of whatever comes out below.", "",
         "| component | what it is | sd of the prediction | corr with actual |",
         "|---|---|---|---|",
         f"| symmetric (home + away) | the game total | {sd_sym:.2f} pts | **{r_sym:+.4f}** |",
         f"| antisymmetric (home − away) | the margin | {sd_anti:.2f} pts | **{r_anti:+.4f}** |", "",
         f"The points model spreads **{sd_anti:.2f} points** of opinion across the margin against "
         f"**{sd_sym:.2f}** across the total, correlating **{r_anti:+.4f}** and **{r_sym:+.4f}** "
         "respectively.", ""]
    print(f"[decomp] symmetric corr {r_sym:+.4f} (sd {sd_sym:.2f}) | "
          f"antisymmetric corr {r_anti:+.4f} (sd {sd_anti:.2f})", flush=True)

    # ---- Studies 2-3: derived vs direct vs direct-on-the-antisymmetric-subspace -------------
    rng = np.random.default_rng(20260801)
    y = P["_ymarg"]
    targets = [y] + [pa.game_shuffle(P, y, rng) for _ in range(NULLS)]

    if os.path.exists(PRED):
        Cc = pd.read_parquet(PRED)
        assert len(Cc) == len(P), "cached direct predictions do not match the panel; delete it"
        preds = {v: [Cc[f"{v}_{i}"] for i in range(NULLS + 1)] for v in ("B", "C")}
        sweep = {v: {str(h): Cc[f"sw{v}{h}"] for h in HALF_LIVES} for v in ("B", "C")}
        print("[redo] loaded cached predictions", flush=True)
    else:
        preds, sweep = {}, {"B": {}, "C": {}}
        print(f"[redo] B: walking {len(targets)} targets over {len(cols_full)} features", flush=True)
        preds["B"] = pa.ridge_multi(P[cols_full].astype(float), P["date"], targets)
        print(f"[redo] C: walking {len(targets)} targets over {len(acols)} features", flush=True)
        preds["C"] = pa.ridge_multi(A[acols].astype(float), P["date"], targets)
        # The sweep runs on BOTH direct variants. A's memory is inherited from the points model and
        # cannot be re-swept here without refitting it, which is a separate job.
        for h in HALF_LIVES:
            print(f"[redo] sweep half-life {h}", flush=True)
            sweep["B"][str(h)] = pa.ridge_multi(P[cols_full].astype(float), P["date"], [y],
                                                half_life=h)[0]
            sweep["C"][str(h)] = pa.ridge_multi(A[acols].astype(float), P["date"], [y],
                                                half_life=h)[0]
        out = {f"{v}_{i}": preds[v][i] for v in ("B", "C") for i in range(NULLS + 1)}
        out.update({f"sw{v}{h}": sweep[v][str(h)] for v in ("B", "C") for h in HALF_LIVES})
        pd.DataFrame(out).to_parquet(PRED)

    for v in ("B", "C"):
        r = preds[v][0].corr(y)
        nr = np.nanmean([preds[v][i].corr(y) for i in range(1, NULLS + 1)])
        print(f"[redo] {v}: oos corr {r:+.4f} | mean null corr {nr:+.4f}", flush=True)
        assert abs(nr) < 0.02, f"{v} nulls correlate with the target ({nr:+.4f})"

    dA = derived(P, pts_pred, G)
    nA = [derived(P, C[f"fg_{i}"], G) for i in range(1, NULLS + 1)]

    L += ["## Study 2 — three routes to a margin", "",
          "Same panel, same rows, same T-60 close, same 20 game-level shuffles re-measured at every "
          "rung. Variant A is the current derived route in its corrected orientation, kept as the "
          "baseline so the rebuild is scored against what it replaces rather than against zero.", ""]

    results = {}
    for tag, name, d, nulls in (
        ("A", "derived from the points model (current route, corrected sign)", dA, nA),
        ("B", "direct margin target, full feature stack",
         to_game(P, preds["B"][0], G),
         [to_game(P, preds["B"][i], G) for i in range(1, NULLS + 1)]),
        ("C", "direct margin target, antisymmetric subspace",
         to_game(P, preds["C"][0], G),
         [to_game(P, preds["C"][i], G) for i in range(1, NULLS + 1)]),
    ):
        L += [f"### {tag} — {name}", ""]
        L, best = ladder(L, d, yb, po, pu, nulls, tag)
        results[tag] = (name, d, best)

    # ---- Study 3: the half-life sweep, on both direct variants ------------------------------
    L += ["## Study 3 — how much history to train on", "",
          "The total's edge did not exist until the training window was made recent: pooled history "
          "graded +0.3% ROI and a 180-day half-life graded +4.5% on identical rows. Whether the "
          "margin wants the same memory is a separate question, so it is swept rather than "
          "inherited. **Read the shape, not the argmax** — a smooth hill with a broad top means the "
          "preference is real; a single spiking cell is a selection this table has not paid for.",
          "", "| half-life (days) | B bets | B win% | B ROI | C bets | C win% | C ROI |",
          "|---|---|---|---|---|---|---|"]
    swk = 2
    for h in HALF_LIVES:
        gb = pa.grade(to_game(P, sweep["B"][str(h)], G), yb, po, pu, swk)
        gc = pa.grade(to_game(P, sweep["C"][str(h)], G), yb, po, pu, swk)
        lab = "**None (pooled)**" if h is None else str(h)
        L.append(f"| {lab} | {gb['n']:,} | {gb['win']:.1f} | **{gb['roi']:+.1f}** | "
                 f"{gc['n']:,} | {gc['win']:.1f} | **{gc['roi']:+.1f}** |")
        print("[sweep] " + L[-1], flush=True)
    L.append("")

    # ---- Study 4: the winner, broken out ----------------------------------------------------
    win = max(results, key=lambda t: (results[t][2] or (0, dict(roi=-99), 0))[1]["roi"])
    name, d, best = results[win]
    k = best[0]
    L += [f"## Study 4 — {win} ({name}) broken out at the ≥{k:g}-point cut", "",
          "Pooled numbers hide a signal that decays or that lives in one season, so these always run "
          "alongside the ladder. Every win% is next to the base rate of ITS OWN slice.", ""]
    for col, lab in (("season", "season"), ("phase", "phase")):
        L += [f"### by {lab}", "", f"| {lab} | bets | win% | base% | edge | ROI |",
              "|---|---|---|---|---|---|"]
        order = (("EARLY", "MID", "LATE", "POST") if col == "phase"
                 else sorted(G[col].dropna().unique()))
        for vv in order:
            g = pa.grade(d, yb, po, pu, k, mask=(G[col] == vv))
            if g["n"]:
                tagv = vv if col == "phase" else str(int(vv))
                L.append(f"| {tagv} | {g['n']:,} | {g['win']:.1f} | {g['base']:.1f} | "
                         f"**{g['win']-g['base']:+.1f}** | **{g['roi']:+.1f}** |")
                print(f"[{col}] " + L[-1], flush=True)
        L.append("")

    L += ["### which side", "",
          "Baseline is the league rate for that same side, not the majority side inside the cell — "
          "the latter is self-referential once you have conditioned on the side the model took.", "",
          "| model side | bets | win% | league same-side% | edge | ROI |", "|---|---|---|---|---|---|"]
    for lab, over in (("home covers", True), ("away covers", False)):
        g = pa.grade_side(d, yb, po, pu, k, over)
        if g:
            L.append(f"| {lab} | {g['n']:,} | {g['win']:.1f} | {g['base']:.1f} | "
                     f"**{g['win']-g['base']:+.1f}** | **{g['roi']:+.1f}** |")
            print("[side] " + L[-1], flush=True)
    L.append("")

    # ---- Study 5: does the model add anything on top of the market's own favourite/dog split?
    L += ["### favourites vs dogs", "",
          "A margin model that only reproduces the market's favourite/dog split is not a model. "
          "Splitting the same cut by which side the market made the favourite says whether the "
          "opinion is about teams or about price.", "",
          "| market side taken | bets | win% | base% | edge | ROI |", "|---|---|---|---|---|---|"]
    hf = G["t60_spread_home_point"] < 0
    for lab, m in (("model on the favourite", ((d > 0) & hf) | ((d < 0) & ~hf)),
                   ("model on the dog", ((d > 0) & ~hf) | ((d < 0) & hf))):
        g = pa.grade(d, yb, po, pu, k, mask=m)
        if g["n"]:
            L.append(f"| {lab} | {g['n']:,} | {g['win']:.1f} | {g['base']:.1f} | "
                     f"**{g['win']-g['base']:+.1f}** | **{g['roi']:+.1f}** |")
            print("[favdog] " + L[-1], flush=True)
    L.append("")

    with open(os.path.join(ROOT, "NBA_SPREAD_REDO.md"), "w") as f:
        f.write("\n".join(L) + "\n")
    print("wrote NBA_SPREAD_REDO.md", flush=True)


if __name__ == "__main__":
    main()
