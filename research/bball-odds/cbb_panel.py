#!/usr/bin/env python3
"""Every CBB market off ONE row per team-game. The college port of `nba_panel_all.py`.

THE MISTAKE THIS REPLACES, and it is the same one the NBA had. `build_ncaab_features.py` writes one
row per game with every team stat present twice under `home_`/`away_` prefixes, and each market is
then fitted as its own regression. That is not a modelling choice, it is a bug:

  * "A team that plays fast scores more" is ONE relationship. The home fit learns it from the
    `home_` columns; the away fit relearns the identical thing from scratch in the `away_` columns.
    Two independent estimates of one effect, half the rows each.
  * Two independent estimates differ by chance, so the two sides print different edges with no
    basketball reason for the gap -- and reading that split as a finding is reading estimator
    variance. The NBA published exactly that mistake ("away team totals are the keeper") and had to
    retract it.
  * The fits are different functions, so home pred + away pred is not a coherent total and
    home pred - away pred is not a coherent spread. Seven markets were being treated as seven
    unrelated problems when six of them are arithmetic on ONE quantity: points scored by a team.

WHAT THIS DOES. Melt to a team-game panel -- `own_*`/`opp_*` by perspective, `is_home` as a feature
-- and fit exactly TWO models on it: full-game points scored by this team, and first-half points
scored by this team. Every market is then arithmetic on those two, with no further fitting:

    team total        own                    moneyline         P(own - opp > 0)
    full-game total   own + opp              full-game spread  own - opp
    first-half total  own_h1 + opp_h1        first-half spread own_h1 - opp_h1
    first-half ML     P(own_h1 - opp_h1 > 0)

THE ORIGINATOR RULE IS ABSOLUTE: no posted line and no price is ever a feature. The model produces
its own number and is then compared to the market, exactly as the NFL and CFB models are. `MARKET`
below is the exclusion list and `assert_originator()` now runs on BOTH the wide candidate list and
the panel's own `fcols`.

A BREACH THAT WAS FOUND AND CLOSED, recorded because the next person will be tempted to reopen it.
`build_panel` used to append `impl` -- the full-game-implied team total, `(total)/2 -+ (spread)/2` --
to `fcols`, and an earlier version of this docstring flatly denied that any line reached the input
side. Both were wrong. `assert_originator()` missed it because it only ever saw the WIDE candidate
list, which `impl` is not on: it is constructed inside `build_panel`. That is why the check now runs
twice.

The temptation: `predict-the-raw-quantity-not-the-residual` found on the NBA that predicting the raw
quantity WITH the line as a feature scored +3.9% ROI against -1.2% for a residual target, and
residual-target-plus-line spans the same space for a ridge. So the breach had an evidence-based
defence. It did not survive measurement -- `cbb_prune.py` gave `impl` its own drop-one row and
removing it moved the live conference rule +10.31% -> +10.66% with correlation +0.0438 -> +0.0434.
It was free, so the rule wins on both counts. **The target still nets out `impl`; only the input side
changed.**

WHY COLLEGE IS THE BETTER TEST BED. 23,031 games with prices against the NBA's 5,279 -- four times
the sample, so a rule that needs 800 bets to show itself has four times the room. College also
carries two markets the NBA archive simply does not have: a first-half MONEYLINE (82% of games over
three seasons) and four full seasons of full-game prices rather than three.

CONSTRUCTION NOTES, each one a bug avoided.

  * PAIR TOKENS ARE BOTH `h`/`a` AND `home`/`away` HERE. The NBA `classify()` only substitutes the
    single-letter token, so ported unchanged it would silently file every `home_kp_em` and
    `home_s2d_pace` as a game-level column -- unpaired, un-melted, and carrying home orientation
    into a perspective-neutral model. `classify()` below handles both.
  * `m1_margin_home` / `m1_covamt_home` are the previous meeting seen from the HOME side and have no
    `a_` partner to pair with, so they are forced antisymmetric by name. Missing this is the same
    class of bug as not flipping `_d`.
  * `_d` columns are home-minus-away differences and are SIGN-FLIPPED on the away row; `_sum`
    columns are symmetric and pass through. Both are asserted by a mirror check on a real game.
  * TRAINING ROWS DECAY WITH AGE. Seasons are not one league, and the NBA sweep found pooled
    training to be the WORST available setting in every market. College has never had a half-life
    swept at all -- `cbb_hl_sweep.py` does that, and HALF_LIFE here is whatever it returned, not a
    number inherited from the NBA.
  * MIN_TRAIN is one full season of team-games, so every market grades the same three seasons and
    the comparison between them is like-for-like. It also happens to line up with the data: 1H and
    team-total prices start in 2023-24, so the burn-in season is the one with no derived markets.
  * The two rows of a game share its context, so 46k rows is not 46k independent observations.
    Nulls permute whole GAMES, both rows together.
  * ORACLE CHECK on every market: feed the realised result into that market's own bet rule and it
    must grade ~100%. The college code had no such check anywhere, and a sign inversion of exactly
    this kind published three wrong NBA verdicts before it was caught.
"""
import importlib.util
import os
import re
import warnings

import numpy as np
import pandas as pd
from scipy.stats import norm

warnings.filterwarnings("ignore")

ROOT = os.path.dirname(os.path.abspath(__file__))
PQ = os.path.join(ROOT, "data", "parquet")
PRED = os.path.join(PQ, "_cbb_panel_preds.parquet")
NULLS = 20
REFIT_DAYS = 21
MIN_TRAIN = 11000            # ~one full season of team-games (5,750 games x 2)
# Swept in CBB_HL_SWEEP.md rather than inherited from the NBA, and the answer INVERTS the NBA one:
# college wants LONG memory. Both models improve monotonically from 45 days out to a year, at all
# three selectivities. 360-odd teams playing ~31 games each starves a short window of history faster
# than regime drift can spoil a long one -- the opposite trade to 30 NBA teams playing 82, where
# pooled was the worst setting in every market.
# 365 is an interior point of the full-game plateau (240/365/545 agree; pooled collapses at the
# deepest cut, which is drift finally biting). 240 is the first-half interior peak.
HL_FG = 365.0
HL_H1 = 240.0

# Never features. Prices and posted lines break the originator rule; the rest are outcomes.
MARKET = {"open_total_point", "t60_total_point", "t60_total_over_price", "t60_total_under_price",
          "open_spread_home_point", "t60_spread_home_point", "t60_spread_home_price",
          "t60_spread_away_price"}
OUTCOME = {"home_score", "away_score", "home_h1", "away_h1", "total_actual", "h1_total_actual",
           "margin", "cover_amt"}
# ids, string keys, and two columns that are exact linear combinations of a pair we already melt
IDS = {"cbbd_id", "h_team_id", "a_team_id", "season_y", "cover_diff",
       "m1_margin_raw", "m1_cover_raw"}
# Home-oriented with no away partner, so `classify` cannot detect them structurally.
ANTI_BY_NAME = {"m1_margin_home", "m1_covamt_home"}


def _mod(name, path):
    spec = importlib.util.spec_from_file_location(name, os.path.join(ROOT, path))
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


nf = _mod("nf", "ncaab_frame.py")
bl = _mod("bl", "cbb_blocks.py")
pa = _mod("pa", "nba_panel_all.py")       # ridge_multi / asof_ratio / grade are sport-agnostic
to_dec = nf.to_dec


# --------------------------------------------------------------------------------------------
def classify(cols):
    """Sort wide columns into home/away pairs, symmetric, antisymmetric and game-level.

    College carries TWO pair conventions in the same table -- `h_pct_pace`/`a_pct_pace` from the
    style and flag joins, and `home_kp_em`/`away_kp_em` from the box and KenPom joins -- so the
    token substitution has to try both. The NBA version only knows the single-letter form; ported
    as-is it files 60-odd `home_*` columns as game-level and quietly breaks the melt.
    """
    have, tokens = set(cols), (("h", "a"), ("home", "away"))
    pairs, sym, anti, gl, seen = [], [], [], [], set()
    for c in cols:
        if c in seen:
            continue
        hit = False
        for lo, hi in tokens:
            t = c.split("_")
            pos = [i for i, x in enumerate(t) if x == lo]
            if len(pos) == 1:
                t2 = list(t)
                t2[pos[0]] = hi
                p = "_".join(t2)
                if p in have:
                    pairs.append((c, p))
                    seen.update((c, p))
                    hit = True
                    break
            pos = [i for i, x in enumerate(t) if x == hi]
            if len(pos) == 1:                       # partner of an already-recorded pair
                t2 = list(t)
                t2[pos[0]] = lo
                if "_".join(t2) in have:
                    seen.add(c)
                    hit = True
                    break
        if hit:
            continue
        last = c.split("_")[-1]
        if c in ANTI_BY_NAME or last == "d":
            anti.append(c)
        elif last == "sum":
            sym.append(c)
        else:
            gl.append(c)
        seen.add(c)
    return pairs, sym, anti, gl


def build_frame():
    """Market spine (`ncaab_frame`) + feature table (`sides_table_ncaab`) + the unused blocks."""
    G = nf.load()
    S = pd.read_parquet(os.path.join(PQ, "sides_table_ncaab.parquet"))
    S, blocks = bl.attach(S)
    flagged = set(bl.leak_screen(S, blocks, strict=False))
    if flagged:
        S = S.drop(columns=[c for c in flagged if c in S.columns])
        print(f"[cbb] dropped {len(flagged)} leak-flagged columns", flush=True)

    ph = pd.read_parquet(os.path.join(PQ, "ncaab_playerreg_frame.parquet"),
                         columns=["event_id", "phase"])
    keep = [c for c in S.columns if c not in G.columns or c == "event_id"]
    D = G.merge(S[keep], on="event_id", how="inner").merge(ph, on="event_id", how="left")
    D["date"] = pd.to_datetime(D["date_et"])
    D = D.sort_values(["date", "event_id"]).drop_duplicates("event_id").reset_index(drop=True)

    bad = MARKET | OUTCOME | IDS
    feat = [c for c in S.columns
            if c in D.columns and c not in bad and not c.startswith(("y_", "open_", "t24_",
                                                                     "t4_", "t60_", "h1_", "tt_"))
            and pd.api.types.is_numeric_dtype(D[c]) and D[c].notna().mean() > 0.55]
    for c in ("conferenceGame", "neutralSite"):
        D[c] = D[c].astype(float)
        feat.append(c)
    assert_originator(feat)
    print(f"[cbb] frame {len(D):,} games | {len(feat)} candidate features "
          f"({sum(len(v) for v in blocks.values())} attached by cbb_blocks)", flush=True)
    return D, feat, blocks


def assert_originator(feat):
    """No posted line and no price may ever reach the model. This is the owner's standing rule."""
    pat = re.compile(r"(^|_)(open|t60|t24|t4)_|price|_spread_|_total_point|^tt_|^h1_(sp|ov|un|ml)")
    bad = [c for c in feat if pat.search(c)]
    assert not bad, f"market columns leaked into the feature list: {bad[:10]}"


def build_panel(D, feat):
    """Two rows per game. Home row keeps orientation; away row swaps own/opp and flips `_d`."""
    pairs, sym, anti, gl = classify(feat)

    def key(c):
        return "_".join(x for x in c.split("_")
                        if x not in ("h", "a", "home", "away", "sum", "d"))

    paired = {key(h) for h, _ in pairs}
    sym = [c for c in sym if key(c) not in paired]
    anti = [c for c in anti if key(c) not in paired or c in ANTI_BY_NAME]
    print(f"[cbb] {len(pairs)} own/opp pairs | {len(sym)} symmetric | {len(anti)} antisymmetric "
          f"| {len(gl)} game-level (sum/diff twins of a pair dropped as collinear)", flush=True)

    half = pd.to_numeric(D["t60_total_point"], errors="coerce") / 2.0
    sp = pd.to_numeric(D["t60_spread_home_point"], errors="coerce")
    base = dict(
        event_id=D["event_id"], date=D["date"], season=D["season"], phase=D["phase"],
        # FG-implied team total: a 145 total with home -6 gives 75.5/69.5. It exists for all four
        # seasons, unlike the posted team total, which is why it anchors the TARGET while the
        # posted team total is only ever used for GRADING.
        impl=[half - sp / 2.0, half + sp / 2.0],
        pts=[D["home_score"], D["away_score"]],
        h1=[D["home_h1"], D["away_h1"]],
        line=[D["tt_h"], D["tt_a"]],
        po=[D["tt_h_ov"], D["tt_a_ov"]], pu=[D["tt_h_un"], D["tt_a_un"]],
    )

    rows = []
    for side in (0, 1):                                   # 0 = home perspective, 1 = away
        R = pd.DataFrame({k: (v[side] if isinstance(v, list) else v) for k, v in base.items()})
        R["is_home"] = 1 - side
        for h, a in pairs:
            nm = re.sub(r"(^|_)(h|home)(_|$)", r"\1\3", h).strip("_")
            R["own_" + nm] = D[a if side else h]
            R["opp_" + nm] = D[h if side else a]
        for c in sym:
            R[c] = D[c]
        for c in anti:
            R[c] = -D[c] if side else D[c]                # home-minus-away -> own-minus-opp
        for c in gl:
            R[c] = D[c]
        rows.append(R)

    P = pd.concat(rows, ignore_index=True)
    P["team_row"] = np.where(P["is_home"] == 1, "home", "away")

    # The melt is the whole point of this file, so prove it rather than trusting it.
    g = P[P["event_id"] == P["event_id"].iloc[0]]
    hr, ar = g[g.is_home == 1].iloc[0], g[g.is_home == 0].iloc[0]
    oc = [c for c in P.columns if c.startswith("own_")]
    for c in oc:
        o = "opp_" + c[4:]
        assert (pd.isna(hr[c]) and pd.isna(ar[o])) or np.isclose(hr[c], ar[o]), c
    for c in anti:
        assert (pd.isna(hr[c]) and pd.isna(ar[c])) or np.isclose(hr[c], -ar[c]), c
    print(f"[cbb] {len(P):,} team-games from {D['event_id'].nunique():,} games | mirror check "
          f"passed on {len(oc)} own/opp and {len(anti)} antisymmetric columns", flush=True)

    P = P.sort_values(["date", "event_id", "is_home"]).reset_index(drop=True)
    # `impl` IS NOT A FEATURE. It stays as a COLUMN because it anchors the target (`_yfg = pts -
    # impl`) and the grading, but it is the posted total and spread rotated, so putting it on the
    # input side put a betting line inside the model -- against the owner's standing originator
    # rule, and against this file's own docstring, which used to deny it happened. `cbb_prune.py`
    # measured the cost of removing it: the live conference rule went +10.31% -> +10.66% and the
    # model's correlation with the realised residual +0.0438 -> +0.0434. It was free.
    fcols = ([c for c in P.columns if c.startswith(("own_", "opp_"))] + sym + anti + gl
             + ["is_home"])
    fcols = [c for c in dict.fromkeys(fcols) if c in P.columns and c != "impl"
             and pd.api.types.is_numeric_dtype(P[c]) and P[c].notna().mean() > 0.55]
    assert_originator(fcols)      # checked on the PANEL's list now, not only the wide candidates
    return P, fcols


def load():
    """(P, G, fcols, blocks) — shared by the sweep, the prune and the gate scripts."""
    D, feat, blocks = build_frame()
    P, fcols = build_panel(D, feat)
    P["_yfg"] = P["pts"].astype(float) - P["impl"].astype(float)
    sh = pa.asof_ratio(P["h1"].astype(float), P["impl"].astype(float))
    P["_impl_h1"] = sh * P["impl"].astype(float)
    P["_yh1"] = P["h1"].astype(float) - P["_impl_h1"]
    print(f"[cbb] as-of first-half share converged to {sh.iloc[-1]:.4f} of the implied total",
          flush=True)
    G = D.set_index("event_id")
    return P, G, fcols, blocks


def fit(P, fcols, n_nulls=NULLS, hl_fg=HL_FG, hl_h1=HL_H1, seed=20260801, cache=None):
    """Walk both models forward. Nulls permute whole games so the pairing is preserved."""
    if cache and os.path.exists(cache):
        C = pd.read_parquet(cache)
        assert len(C) == len(P), "cached predictions do not match the current panel; delete it"
        print(f"[cbb] loaded cached predictions from {os.path.basename(cache)}", flush=True)
        return {t: [C[f"{t}_{i}"] for i in range(n_nulls + 1)] for t in ("fg", "h1")}

    rng = np.random.default_rng(seed)
    X = P[fcols].astype(float)
    preds = {}
    for tag, ycol, hl in (("fg", "_yfg", hl_fg), ("h1", "_yh1", hl_h1)):
        y = P[ycol]
        targets = [y] + [pa.game_shuffle(P, y, rng) for _ in range(n_nulls)]
        print(f"[cbb] {tag}: walking {len(targets)} targets over {len(fcols)} features", flush=True)
        preds[tag] = pa.ridge_multi(X, P["date"], targets, min_train=MIN_TRAIN,
                                    refit_days=REFIT_DAYS, half_life=hl)
        print(f"[cbb] {tag}: oos corr(pred, actual residual) {preds[tag][0].corr(y):+.4f} on "
              f"{int(preds[tag][0].notna().sum()):,} team-games", flush=True)
    if cache:
        pd.DataFrame({f"{t}_{i}": preds[t][i] for t in ("fg", "h1")
                      for i in range(n_nulls + 1)}).to_parquet(cache)
    return preds


# --------------------------------------------------------------------------------------------
# grading
# --------------------------------------------------------------------------------------------
def grade(pred, yb, po, pu, k, mask=None, min_n=25):
    """Bet when the model disagrees with the line by at least k units (points, or % for a ML)."""
    ok = pred.notna() & yb.notna() & po.notna() & pu.notna()
    if mask is not None:
        ok = ok & mask
    m = ok & (pred.abs() >= k)
    if m.sum() < min_n:
        return dict(n=0, win=np.nan, base=np.nan, roi=np.nan)
    side = pred[m] > 0
    win = np.where(side, yb[m], 1 - yb[m])
    dec = np.where(side, po[m], pu[m])
    return dict(n=int(m.sum()), win=100 * win.mean(),
                base=100 * max(yb[m].mean(), 1 - yb[m].mean()),
                roi=100 * (win * (dec - 1) - (1 - win)).mean())


def grade_side(pred, yb, po, pu, k, over):
    """One fixed side against the LEAGUE rate for that same side.

    `grade`'s base is the best blind side inside its own rows, which is self-referential once you
    have conditioned on the side the model took -- it prints +0.0 on every row of a side table.
    """
    m = pred.notna() & yb.notna() & ((pred > 0) if over else (pred < 0)) & (pred.abs() >= k)
    if m.sum() < 25:
        return None
    win = yb[m] if over else (1 - yb[m])
    dec = (po if over else pu)[m]
    lg = yb.dropna()
    return dict(n=int(m.sum()), win=100 * win.mean(),
                base=100 * (lg.mean() if over else 1 - lg.mean()),
                roi=100 * (win * (dec - 1) - (1 - win)).mean())


def row(g, tag, extra=""):
    return (f"| {tag} | {g['n']:,} | {g['win']:.1f} | {g['base']:.1f} | "
            f"**{g['win']-g['base']:+.1f}** | {g['roi']:+.1f} |{extra}")


def report(L, M, d, nd, yb, po, pu, frame):
    """One market: ladder with a null re-measured at each rung, then season, phase and side."""
    L += [f"## {M['name']}", "", M["note"], "",
          f"Bet when the model and the market differ by at least k {M['unit']}.", "",
          f"| cut ({M['unit']}) | bets | win% | base% | edge | ROI | null mean | null sd | z |",
          "|---|---|---|---|---|---|---|---|---|"]
    for k in M["ks"]:
        g = grade(d, yb, po, pu, k)
        if not g["n"]:
            continue
        ne = np.array([(lambda q: q["win"] - q["base"])(grade(x, yb, po, pu, k)) for x in nd],
                      dtype=float)
        mu, sg = np.nanmean(ne), np.nanstd(ne, ddof=1)
        z = (g["win"] - g["base"] - mu) / sg if sg > 0 else np.nan
        L.append(row(g, f"≥{k:g}", f" {mu:+.2f} | {sg:.2f} | **{z:+.2f}** |"))
        print(f"[{M['key']}] " + L[-1], flush=True)
    ck = M["claim"]
    L.append("")

    for col, lab in (("season", "season"), ("phase", "phase")):
        L += [f"### {M['name']} — by {lab}, at the {ck:g}-{M['unit']} cut", "",
              "Pooled numbers hide a signal that decays, so this always runs alongside them.", "",
              f"| {lab} | bets | win% | base% | edge | ROI |", "|---|---|---|---|---|---|"]
        order = (["NONCONF", "MTE", "CONF_EARLY", "CONF_LATE", "CONF_TOURN", "NCAAT", "POST_OTHER"]
                 if col == "phase" else sorted(frame[col].dropna().astype(str).unique()))
        for v in order:
            g = grade(d, yb, po, pu, ck, mask=(frame[col].astype(str) == v))
            if g["n"]:
                L.append(row(g, v))
                print(f"[{M['key']}] " + L[-1], flush=True)
        L.append("")

    L += [f"### {M['name']} — which side, at the {ck:g}-{M['unit']} cut", "",
          "Baseline is the league rate for that same side, not the majority side inside the cell.",
          "", "| model side | bets | win% | league same-side% | edge | ROI |",
          "|---|---|---|---|---|---|"]
    for lab, over in ((M["over"], True), (M["under"], False)):
        g = grade_side(d, yb, po, pu, ck, over)
        if g:
            L.append(row(g, lab))
            print(f"[{M['key']}] " + L[-1], flush=True)
    L.append("")
    return L


# --------------------------------------------------------------------------------------------
# market construction — ONE definition, shared by the report, the sweep, the prune and the gate
# --------------------------------------------------------------------------------------------
META = [
    dict(key="tt", name="Team total", unit="pts", ks=(1, 2, 3, 4, 5, 6), claim=3, level="panel",
         over="model says OVER", under="model says UNDER",
         note="One model, both perspectives, graded at PANEL level — a team total IS the team "
              "row, so unlike every other market there is no reduction to one number per game. "
              "**Read this market through `derived-market-gating-law`**: on the NBA it paid "
              "+13.1% inside games the full-game total model already bet and −12.1% in games "
              "neither parent touched. `cbb_tt_gate.py` runs that split here."),
    dict(key="fg_total", name="Full-game total", unit="pts", ks=(1, 2, 3, 4, 5, 6, 8), claim=4,
         over="model says OVER", under="model says UNDER",
         note="Sum of the two team predictions against the posted total."),
    dict(key="fg_spread", name="Full-game spread", unit="pts", ks=(1, 2, 3, 4, 5, 6, 8), claim=2,
         over="model says HOME", under="model says AWAY",
         note="Difference of the two team predictions against the posted spread. "
              "`NCAAB_MODEL_BRIEF2.md` reports the previous college spread model at a "
              "validation MAE of 9.11 against the market's 8.80 — it did not beat the line. "
              "This is the first attempt from a consistent per-team points model."),
    dict(key="fg_ml", name="Moneyline", unit="%", ks=(1, 2, 3, 5, 7, 10), claim=3,
         over="model says HOME", under="model says AWAY",
         note="The margin model turned into a win probability with its own as-of error scale, "
              "against the devigged market price. **Read ROI here, not edge.** `base%` is the "
              "best blind side inside the bet cell, which on a moneyline is always the "
              "favourite, so any model that takes dogs scores a large negative edge whether or "
              "not it makes money — and the null lands there too, which lets z go positive on "
              "a losing model."),
    dict(key="h1_total", name="First-half total", unit="pts", ks=(0.75, 1, 1.5, 2, 3, 4), claim=2,
         over="model says OVER", under="model says UNDER",
         note="First-half points per team, summed, against the posted first-half total. "
              "First-half lines are about half the size of full-game ones, so the cuts scale "
              "down to match."),
    dict(key="h1_spread", name="First-half spread", unit="pts", ks=(0.75, 1, 1.5, 2, 3, 4),
         claim=1.5, over="model says HOME", under="model says AWAY",
         note="Difference of the first-half team predictions against the posted first-half "
              "spread."),
    dict(key="h1_ml", name="First-half moneyline", unit="%", ks=(1, 2, 3, 5, 7, 10), claim=3,
         over="model says HOME", under="model says AWAY",
         note="**A market the NBA archive cannot grade at all** — there is no NBA first-half "
              "moneyline in it. College has one on 82% of games across three seasons. Halves "
              "tie far more often than games do, and a tie is a push here, so the bet count "
              "runs below the first-half spread. Same warning as the full-game moneyline: read "
              "ROI, not edge."),
]


def markets(P, G, fg, h1, fg0=None, h10=None, verbose=False):
    """Every market as (d, yb, po, pu) from ONE pair of team-points predictions.

    `d` is model-minus-market in that market's own units, `yb` is 1 when the positive side won.
    Every study grades through this function, so a difference between two of them can never be a
    difference in how a bet was scored.

    `fg0`/`h10` are the REAL predictions and set ONLY the moneyline's as-of error scale. A null walk
    must not be allowed to rescale its own confidence — that would let the null buy back the very
    calibration the real model had to earn.
    """
    fg0 = fg if fg0 is None else fg0
    h10 = h1 if h10 is None else h10

    def to_game(p_panel, implcol):
        t = P.assign(pred=P[implcol].astype(float) + p_panel)[["event_id", "team_row", "pred"]]
        return t.pivot(index="event_id", columns="team_row", values="pred").reindex(G.index)

    gp = {"fg": to_game(fg, "impl"), "h1": to_game(h1, "_impl_h1")}
    g0 = {"fg": to_game(fg0, "impl"), "h1": to_game(h10, "_impl_h1")}

    def q(tag, kind):
        """total -> sum of the team predictions; spread -> predicted MARGIN, home perspective.

        The spread deliberately does NOT flip into posted convention. Flipping it and then
        subtracting the posted line inverted every NBA spread bet for weeks; the outcome column is
        `y_sp_t60 = margin + t60_spread_home_point`, so the graded quantity is built the SAME way.
        """
        h, a = gp[tag]["home"], gp[tag]["away"]
        return (h + a) if kind == "tot" else (h - a)

    def ml(tag, ycol, hp, ap, lo, hi, price):
        """Margin model + its own as-of error scale -> win probability, minus the devigged price.

        Nothing from the future sets today's confidence: the error sd is an expanding window
        shifted by one. Devig is proportional.
        """
        err = pd.to_numeric(G[ycol], errors="coerce") - (g0[tag]["home"] - g0[tag]["away"])
        sig = err.expanding().std().shift(1).bfill().clip(lower=lo, upper=hi)
        mh, ma = 1 / price(hp), 1 / price(ap)
        pm = pd.Series(mh / (mh + ma), index=G.index)
        if verbose:
            print(f"[cbb] {tag} moneyline: as-of margin error sd converged to {sig.iloc[-1]:.2f} "
                  f"pts", flush=True)
        return 100 * (pd.Series(norm.cdf((gp[tag]["home"] - gp[tag]["away"]) / sig),
                                index=G.index) - pm)

    num = lambda c: pd.to_numeric(G[c], errors="coerce")
    bin_ = lambda s: pd.Series(np.where(s > 0, 1.0, np.where(s < 0, 0.0, np.nan)), index=s.index)
    dec = lambda c: pd.Series(to_dec(G[c]), index=G.index)
    already = lambda c: pd.to_numeric(G[c], errors="coerce")   # h1/tt prices are already decimal
    marg = num("home_score") - num("away_score")
    h1marg = num("home_h1") - num("away_h1")
    G["_marg"], G["_h1marg"] = marg, h1marg

    line = pd.to_numeric(P["line"], errors="coerce")
    out = {
        "tt": dict(frame=P, d=fg + (P["impl"].astype(float) - line),
                   oracle=P["pts"].astype(float) - line,
                   yb=bin_(P["pts"].astype(float) - line),
                   po=pd.to_numeric(P["po"], errors="coerce"),
                   pu=pd.to_numeric(P["pu"], errors="coerce")),
        "fg_total": dict(d=q("fg", "tot") - num("t60_total_point"), oracle=G["y_tot_t60"],
                         po=dec("t60_total_over_price"), pu=dec("t60_total_under_price")),
        "fg_spread": dict(d=q("fg", "sp") + num("t60_spread_home_point"), oracle=G["y_sp_t60"],
                          po=dec("t60_spread_home_price"), pu=dec("t60_spread_away_price")),
        "fg_ml": dict(d=ml("fg", "_marg", "t60_ml_home_price", "t60_ml_away_price", 8, 22, dec),
                      oracle=marg, po=dec("t60_ml_home_price"), pu=dec("t60_ml_away_price")),
        "h1_total": dict(d=q("h1", "tot") - num("h1_total"), oracle=G["y_h1_tot"],
                         po=already("h1_ov"), pu=already("h1_un")),
        "h1_spread": dict(d=q("h1", "sp") + num("h1_spread"), oracle=G["y_h1_sp"],
                          po=already("h1_sp_h"), pu=already("h1_sp_a")),
        "h1_ml": dict(d=ml("h1", "_h1marg", "h1_ml_h", "h1_ml_a", 5, 15, already),
                      oracle=h1marg, po=already("h1_ml_h"), pu=already("h1_ml_a")),
    }
    for m in META:
        S = out[m["key"]]
        S.update({k: v for k, v in m.items()})
        S.setdefault("frame", G)
        S.setdefault("yb", bin_(pd.to_numeric(S["oracle"], errors="coerce")))
    return out


def oracle_check(mk):
    """Feed the realised result into each market's own bet rule; it must grade ~100%.

    The cheapest guard against a sign inversion, and the reason it exists: the NBA spreads were
    graded with the model's number in POSTED convention while the outcome column is a margin
    RESIDUAL, so every spread bet was placed on the wrong side and the market read -8.3% ROI instead
    of -0.7%. The college code had no such check anywhere before this.
    """
    for k, S in mk.items():
        o = grade(pd.to_numeric(S["oracle"], errors="coerce"), S["yb"], S["po"], S["pu"], 0)
        print(f"[oracle] {k:10s} perfect-foresight win% {o['win']:.1f} on n={o['n']:,}", flush=True)
        assert o["win"] > 99.5, (f"{k}: feeding the actual result into its own d() grades "
                                 f"{o['win']:.1f}%, not ~100% — d and yb disagree on sign")


# --------------------------------------------------------------------------------------------
def main():
    P, G, fcols, _ = load()
    preds = fit(P, fcols, cache=PRED)

    nr = np.nanmean([preds["fg"][i].corr(P["_yfg"]) for i in range(1, NULLS + 1)])
    print(f"[cbb] mean null corr {nr:+.4f} (must be ~0)", flush=True)
    assert abs(nr) < 0.02, f"null walks correlate with the real target ({nr:+.4f})"

    real = markets(P, G, preds["fg"][0], preds["h1"][0], verbose=True)
    oracle_check(real)
    nulls = [markets(P, G, preds["fg"][i], preds["h1"][i], preds["fg"][0], preds["h1"][0])
             for i in range(1, NULLS + 1)]

    # This file is REGENERATED wholesale on every run, so anything hand-written here is destroyed.
    # The verdict lives in CBB_VERDICT.md, which no script writes. Keep this pointer at the top.
    L = ["# CBB — every market from one team-game model", "",
         "> **The verdict is in `CBB_VERDICT.md`** — what to bet, what died, and why. This file is "
         "regenerated by `cbb_panel.py` on every run; do not hand-edit it.", "",
         f"**{len(P):,} team-game rows from {G.index.nunique():,} games, four seasons.** Two "
         "models: points scored by a team over the full game, and over the first half. Every "
         "market below is arithmetic on those two — the team total is `own`, the total is "
         "`own + opp`, the spread is `own - opp`, the moneyline is `P(own - opp > 0)`. No market "
         "gets its own fit, and **no model sees a posted line or a price**.", "",
         "This replaces a set of independent per-market regressions on one row per game, which "
         "estimated the same relationship separately for home and away. It also wires in the "
         "player-level blocks that were built for college and never used — heat, star shot "
         "profiles, rotation shape, possession efficiency — see `cbb_blocks.py`.", "",
         f"Training uses one full season of team-games as burn-in, so every market grades the same "
         f"seasons. Nulls are {NULLS} game-level shuffles per model, re-measured at each rung; a z "
         f"below about +2 is noise. Half-lives are {HL_FG:.0f}d (full game) and {HL_H1:.0f}d "
         f"(first half), swept in `CBB_HL_SWEEP.md`.", "",
         f"Out-of-sample correlation with the actual residual: "
         f"**{preds['fg'][0].corr(P['_yfg']):+.4f}** full game, "
         f"**{preds['h1'][0].corr(P['_yh1']):+.4f}** first half.", ""]

    for m in META:
        k = m["key"]
        S = real[k]
        L = report(L, S, S["d"], [n[k]["d"] for n in nulls],
                   S["yb"], S["po"], S["pu"], S["frame"])

    with open(os.path.join(ROOT, "CBB_PANEL_ALL.md"), "w") as f:
        f.write("\n".join(L) + "\n")
    print("wrote CBB_PANEL_ALL.md", flush=True)


if __name__ == "__main__":
    main()
