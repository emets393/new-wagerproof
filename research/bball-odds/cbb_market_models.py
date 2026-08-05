#!/usr/bin/env python3
"""One model per BETTING MARKET, not one model for all seven.

THE MISTAKE THIS FILE EXISTS TO FIX. `cbb_panel.py` fits exactly two models -- full-game team
points and first-half team points -- on ONE shared feature list at ONE shared half-life, and then
derives all seven markets from them. Every market except the full-game spread has therefore been
graded on a model that was tuned for the full-game spread. Calling the total "a null" on that basis
is a statement about the spread's feature set, not about the total.

THE NBA ALREADY PROVED THE MARKETS WANT DIFFERENT INPUTS, ON THIS EXACT PANEL ARCHITECTURE:
  - [[nba-originator-spread-model]]: 188 features, rapm + pl_regr ONLY, everything else cut.
  - [[nba-originator-total-model]]: 612 features, cutting only raw box / rotation flags / travel --
    and its memory says in as many words "wants the OPPOSITE feature set to the spread (points
    diffuse, margin narrow) -- never inherit CORE".
  - [[nba-originator-first-half-models]]: 587 and 475 features, half-lives 120d and 90-120d, both
    SHORTER than the full-game total's 180d in the same sport.
Three markets, three feature sets, three half-lives, one panel. College got one of each.

WHAT IS AND IS NOT REFITTED. The panel layout is not under test -- one row per team-game, predict
that team's points, every market arithmetic on top -- because it is the thing that produced the
only edge college has ([[cbb-originator-panel-markets]]). What is under test is, per market:

    1. WHICH FEATURE FAMILIES the model that feeds it should carry.
    2. WHICH HALF-LIFE it should carry (stage `hl`).
    3. WHETHER IT SHOULD PREDICT THE RAW QUANTITY OR THE RESIDUAL against the implied team total
       (config `raw_target`). This is the open question from
       [[predict-the-raw-quantity-not-the-residual]] -- raw-with-line-as-feature beat
       residual-vs-line on the NBA, but the line cannot be a feature here, so the third
       combination -- raw target, NO line anywhere -- is the one college has never measured. The
       raw prediction is converted back to residual form (`pred - impl`) before grading, so it
       goes through the IDENTICAL `markets()` path and a difference can never be a grading
       difference.

GRADED AT FIXED SELECTIVITY, PER MARKET, ON THAT MARKET'S OWN ROWS. Fewer features means less
volatile predictions, so a fixed points cut would compare two strategies rather than two feature
sets ([[feature-pruning-drop-one-vs-solo]] rule 4). Every configuration bets the same top-N% of
that market's own disagreements.

READ THE AGGREGATE BEFORE THE RANKING. `CBB_PRUNE.md` found 13 of 17 drop-ones improving the live
rule, which is the dilution fingerprint, not a menu -- and one sigma of ROI noise is printed next
to every table here for exactly that reason (rule 9). A delta smaller than sigma is not a finding.

NO NULLS IN THIS FILE. Nulls price the search that found a result; this is a ranking. Whatever
configuration wins per market goes back through `cbb_panel.py`'s null grading before any number
from it is believed or written into a verdict.
"""
import argparse
import importlib.util
import os
import re
import warnings

import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")

ROOT = os.path.dirname(os.path.abspath(__file__))
PQ = os.path.join(ROOT, "data", "parquet")
QS = (0.20, 0.10)                # top 20% and top 10% of each market's own disagreements

# Half-life grid for stage `hl`. Spans the NBA's short settings (90-180d) through college's
# current 365d and out to 545d, so the SHAPE is readable rather than just the argmax.
HLS = (90.0, 120.0, 180.0, 240.0, 365.0, 545.0)

# Matched against the name with own_/opp_ stripped. ORDER MATTERS -- first hit wins.
# `market_anchor` is gone from the panel (see cbb_panel.build_panel) so it is not a family here.
FAMILIES = [
    ("kenpom",       r"^kp_"),
    ("heat",         r"^heat_"),                  # player shooting heat vs own baseline
    ("star",         r"^star_"),                  # star shot profile
    ("lineup",       r"^lup_"),                   # rotation shape / star dependence
    ("starters",     r"^stu_"),
    ("possession",   r"^poss_"),
    ("style_raw",    r"^sty_s_"),                 # raw style rates
    ("pctile",       r"^pct_"),                   # style percentiles (one copy; the dup was cut)
    ("adv",          r"^adv_"),
    ("form_l5",      r"^l5_"),                    # last-5 form
    ("season_s2d",   r"^s2d_"),                   # season to date
    ("availability", r"_out$|out_n$|^lowto_"),    # the injury/absence columns
    ("roster",       r"^(Hgt5|HgtEff|Exp|Bench|Continuity)$"),
    ("schedule",     r"^(rest_days|b2b|game_num|month)$"),
    ("context",      r"^(conferenceGame|neutralSite|nonconf|meet_no|is_home|style_adv|"
                     r"cover_streak)$"),
]

MKS = ["tt", "fg_total", "fg_spread", "fg_ml", "h1_total", "h1_spread", "h1_ml"]
FG_MKS = ["tt", "fg_total", "fg_spread", "fg_ml"]        # fed by the full-game points model
H1_MKS = ["h1_total", "h1_spread", "h1_ml"]              # fed by the first-half points model


def _mod(name, path):
    spec = importlib.util.spec_from_file_location(name, os.path.join(ROOT, path))
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


cp = _mod("cp", "cbb_panel.py")
pa = cp.pa


def famof(c):
    b = re.sub(r"^(own_|opp_)", "", c)
    for name, pat in FAMILIES:
        if re.search(pat, b):
            return name
    return "misc"


def sel(S, q, mask=None):
    """Grade the top-q share of THIS market's disagreements. Bet count held constant per market."""
    ok = S["d"].notna() & S["yb"].notna() & S["po"].notna() & S["pu"].notna()
    if mask is not None:
        ok = ok & mask
    if ok.sum() < 100:
        return dict(n=0, win=np.nan, base=np.nan, roi=np.nan)
    k = S["d"][ok].abs().quantile(1 - q)
    return cp.grade(S["d"], S["yb"], S["po"], S["pu"], k, mask=mask)


def roi_sigma(n, win=0.53, dec=1.909):
    """One sigma of ROI noise on n bets at roughly this win rate and price.

    Printed next to every table because a delta smaller than this is not a finding -- the lesson
    `CBB_PRUNE.md` had to learn after 13 of 17 families 'improved' the model.
    """
    if not n or n < 2:
        return np.nan
    return 100 * np.sqrt(win * (1 - win)) * dec / np.sqrt(n)


def fit_one(X, P, ycol, hl):
    """One walk-forward fit. Returns predictions in RESIDUAL form, whatever the target was.

    A raw-points target is converted back with `- impl` so that `markets()` -- which adds the
    implied team total back on -- receives the same quantity either way. Grading is therefore
    identical across target choices and any difference is a modelling difference.
    """
    raw = ycol.startswith("_raw")
    y = P[ycol]
    p = pa.ridge_multi(X, P["date"], [y], min_train=cp.MIN_TRAIN, refit_days=cp.REFIT_DAYS,
                       half_life=hl)[0]
    if raw:
        p = p - P["impl" if ycol == "_rawfg" else "_impl_h1"].astype(float)
    return p


def grade_all(P, G, fg, h1, conf_g, conf_p, tag, kind, k_fg, k_h1, hl_fg, hl_h1, check=False):
    """Every market, at fixed selectivity, pooled and conference-only."""
    mk = cp.markets(P, G, fg, h1)
    if check:
        cp.oracle_check(mk)
    out = []
    for key in MKS:
        S = mk[key]
        panel = S.get("level") == "panel"
        m = (conf_p if panel else conf_g.reindex(S["d"].index).fillna(False))
        r = dict(tag=tag, kind=kind, market=key, k=(k_h1 if key in H1_MKS else k_fg),
                 hl=(hl_h1 if key in H1_MKS else hl_fg))
        for q in QS:
            p = int(q * 100)
            a, b = sel(S, q), sel(S, q, mask=m)
            r |= {f"roi{p}": a["roi"], f"n{p}": a["n"], f"win{p}": a["win"], f"base{p}": a["base"],
                  f"croi{p}": b["roi"], f"cn{p}": b["n"], f"cwin{p}": b["win"],
                  f"cbase{p}": b["base"]}
        out.append(r)
    return out


# --------------------------------------------------------------------------------------------
def stage_ablate(P, G, fcols, conf_g, conf_p, do_solo):
    """Drop-one and solo, per family, scored on ALL SEVEN markets from the same pair of fits."""
    X = P[fcols].astype(float)
    fam = pd.Series({c: famof(c) for c in fcols})
    counts = fam.value_counts()
    print(f"[mm] {len(P):,} team-games | {len(fcols)} features in {len(counts)} families",
          flush=True)
    print(counts.to_string(), flush=True)

    rows, n = [], 0

    def run(tag, kind, use, ycols=("_yfg", "_yh1"), hls=(cp.HL_FG, cp.HL_H1), check=False):
        nonlocal n
        if len(use) < 3:
            return
        n += 1
        fg = fit_one(X[use], P, ycols[0], hls[0])
        h1 = fit_one(X[use], P, ycols[1], hls[1])
        rows.extend(grade_all(P, G, fg, h1, conf_g, conf_p, tag, kind, len(use), len(use),
                              hls[0], hls[1], check=check))
        d = {r["market"]: r["roi10"] for r in rows[-len(MKS):]}
        print(f"  [{n:2d}] {kind:9s} {tag:14s} k={len(use):3d}  " +
              "  ".join(f"{m.replace('fg_', '').replace('h1_', '1H'):7s}{d[m]:+6.2f}"
                        for m in MKS), flush=True)

    run("ALL", "base", fcols, check=True)
    # The target question, asked once on the full stack: raw team points with no line anywhere,
    # against the residual-vs-implied-total the panel has always used.
    run("raw_target", "target", fcols, ycols=("_rawfg", "_rawh1"))
    for name in counts.index:
        run(name, "drop-one", [c for c in fcols if fam[c] != name])
    if do_solo:
        for name in counts.index:
            run(name, "solo", [c for c in fcols if fam[c] == name])

    R = pd.DataFrame(rows)
    R.to_parquet(os.path.join(PQ, "_cbb_market_ablate.parquet"), index=False)
    write_ablate(R, counts)
    return R


def write_ablate(R, counts):
    L = ["# CBB — one model per market: which features does each market actually want?", "",
         "`cbb_market_models.py --stage ablate`. Every configuration is fitted ONCE and graded on "
         "ALL SEVEN markets, so the tables below are seven readings of the same 17 ablations — "
         "which is the whole point: a family that carries the spread and a family that carries the "
         "total do not have to be the same family, and on the NBA they were not.", "",
         "**Graded at fixed selectivity, per market.** Each configuration bets the same top-N% of "
         "*that market's own* disagreements, so a smaller feature set cannot win by making fewer, "
         "more extreme predictions.", "",
         "**σ is one sigma of ROI noise on the bet count in that column.** A delta smaller than σ "
         "is not a finding. This is printed because the first college prune had 13 of 17 families "
         "'improving' the model — the dilution fingerprint, not a menu.", "",
         "**No nulls here.** This is a ranking, not a claim; the winning configuration per market "
         "goes back through `cbb_panel.py`'s null grading before it is believed.", ""]

    B = R[R["kind"] == "base"].set_index("market")
    L += ["## Baseline — the single shared model, on every market", "",
          "This is the model `CBB_PANEL_ALL.md` grades: one feature set, one half-life, all seven "
          "markets. Everything below is measured against this row.", "",
          "| market | bets (top 10%) | win% | base% | ROI | σ |", "|---|---|---|---|---|---|"]
    for m in MKS:
        b = B.loc[m]
        L.append(f"| {m} | {int(b['n10']):,} | {b['win10']:.1f} | {b['base10']:.1f} | "
                 f"**{b['roi10']:+.2f}** | ±{roi_sigma(b['n10']):.2f} |")

    T = R[R["kind"] == "target"]
    if len(T):
        T = T.set_index("market")
        L += ["", "## The target question — raw team points, or the residual against the implied "
              "total?", "",
              "Neither variant sees a posted line as a FEATURE; they differ only in what the model "
              "is asked to predict. `predict-the-raw-quantity-not-the-residual` found on the NBA "
              "that raw-quantity-with-the-line-as-a-feature beat residual-vs-line — but the line "
              "cannot be a feature under the originator rule, so this third combination is the one "
              "college has never measured.", "",
              "| market | residual ROI | raw ROI | Δ | σ |", "|---|---|---|---|---|"]
        for m in MKS:
            b, t = B.loc[m], T.loc[m]
            L.append(f"| {m} | {b['roi10']:+.2f} | {t['roi10']:+.2f} | "
                     f"**{t['roi10']-b['roi10']:+.2f}** | ±{roi_sigma(b['n10']):.2f} |")

    for m in MKS:
        b = B.loc[m]
        sig = roi_sigma(b["n10"])
        L += ["", f"## {m}", "",
              f"Baseline {b['roi10']:+.2f}% on {int(b['n10']):,} bets (σ ±{sig:.2f}). "
              "**A positive Δ means cutting that family HELPS this market.**", "",
              "| family | cols | top 20% | Δ | top 10% | Δ | CONF top 10% | Δ |",
              "|---|---|---|---|---|---|---|---|"]
        D = R[(R["kind"] == "drop-one") & (R["market"] == m)].sort_values("roi10",
                                                                         ascending=False)
        for _, r in D.iterrows():
            L.append(f"| {r['tag']} | {counts[r['tag']]} | {r['roi20']:+.2f} | "
                     f"**{r['roi20']-b['roi20']:+.2f}** | {r['roi10']:+.2f} | "
                     f"**{r['roi10']-b['roi10']:+.2f}** | {r['croi10']:+.2f} | "
                     f"**{r['croi10']-b['croi10']:+.2f}** |")
        if len(D):
            dl = (D["roi10"] - b["roi10"])
            L += ["", f"Mean drop-one Δ **{dl.mean():+.2f}** (sd {dl.std():.2f}, "
                  f"{int((dl > 0).sum())} of {len(dl)} families improve the market when removed). "
                  "A mean well above zero with a scattered ranking is dilution — read it as "
                  "'this market carries too many features', not as a shopping list.", ""]
        S = R[(R["kind"] == "solo") & (R["market"] == m)].sort_values("roi10", ascending=False)
        if len(S):
            L += ["", f"### {m} — solo", "",
                  "Does the family carry this market by itself? Redundant families look fine here "
                  "and change nothing when dropped; load-bearing ones can look dead here.", "",
                  "| family | cols | top 10% | CONF top 10% |", "|---|---|---|---|"]
            for _, r in S.iterrows():
                L.append(f"| {r['tag']} | {counts[r['tag']]} | {r['roi10']:+.2f} | "
                         f"{r['croi10']:+.2f} |")

    p = os.path.join(ROOT, "CBB_MARKET_ABLATE.md")
    open(p, "w").write("\n".join(L) + "\n")
    print(f"wrote {os.path.basename(p)}", flush=True)


# --------------------------------------------------------------------------------------------
def stage_hl(P, G, fcols, conf_g, conf_p):
    """Half-life per market, on the SHARED feature set — the second axis the panel never swept.

    Run after `ablate` so the two axes are read separately. College locked 365d/240d off a sweep
    that graded only the full-game spread; the NBA's three markets landed on 180d, 120d and 90-120d
    in the same sport, so there is no reason to expect one number to serve seven markets here.
    """
    X = P[fcols].astype(float)
    rows = []
    for hl in HLS:
        fg = fit_one(X, P, "_yfg", hl)
        h1 = fit_one(X, P, "_yh1", hl)
        rows.extend(grade_all(P, G, fg, h1, conf_g, conf_p, f"hl{int(hl)}", "hl", len(fcols),
                              len(fcols), hl, hl))
        d = {r["market"]: r["roi10"] for r in rows[-len(MKS):]}
        print(f"  hl={hl:5.0f}d  " + "  ".join(
            f"{m.replace('fg_', '').replace('h1_', '1H'):7s}{d[m]:+6.2f}" for m in MKS), flush=True)

    R = pd.DataFrame(rows)
    R.to_parquet(os.path.join(PQ, "_cbb_market_hl.parquet"), index=False)

    L = ["# CBB — half-life per market", "",
         "`cbb_market_models.py --stage hl`. One shared feature set, six half-lives, all seven "
         "markets graded at fixed selectivity. The panel locked 365d (full game) and 240d (first "
         "half) off a sweep that looked only at the full-game spread; the NBA's three markets "
         "landed on 180d, 120d and 90–120d within one sport, so a single number serving seven "
         "markets is an assumption, not a result.", "",
         "**Read the shape, not the argmax** — an interior plateau is a result, a lone spike is "
         "noise.", ""]
    for m in MKS:
        H = R[R["market"] == m].sort_values("hl")
        sig = roi_sigma(H["n10"].iloc[0]) if len(H) else np.nan
        L += ["", f"## {m}", "", f"σ ±{sig:.2f} on the top-10% column.", "",
              "| half-life | top 20% | top 10% | bets | win% | base% | CONF top 10% |",
              "|---|---|---|---|---|---|---|"]
        for _, r in H.iterrows():
            L.append(f"| {int(r['hl'])}d | {r['roi20']:+.2f} | **{r['roi10']:+.2f}** | "
                     f"{int(r['n10']):,} | {r['win10']:.1f} | {r['base10']:.1f} | "
                     f"{r['croi10']:+.2f} |")
    p = os.path.join(ROOT, "CBB_MARKET_HL.md")
    open(p, "w").write("\n".join(L) + "\n")
    print(f"wrote {os.path.basename(p)}", flush=True)
    return R


# --------------------------------------------------------------------------------------------
# THE PRE-REGISTERED CUT, fixed before any of it was graded with nulls.
#
# RULE, stated in advance and applied mechanically: **cut a family from a market's model iff its
# drop-one delta is positive on BOTH the top-20% and the top-10% column for that market.** Nothing
# is chosen by eye off the ranking, and no configuration was tried and discarded. This is the
# discipline `feature-pruning-drop-one-vs-solo` rule 5 asks for, and it exists because the single
# biggest failure mode here is reading a table whose one-sigma noise (±2.3% ROI) is larger than
# most of its deltas.
#
# WHAT THE RULE PRODUCED IS ITSELF THE FINDING: the markets do NOT want the same families.
# `possession` and `star` survive in every total-shaped market and are the most load-bearing
# families there, while `starters` and `lineup` are the most load-bearing in every margin-shaped
# market (spread, moneyline) and `possession` is CUT from the moneyline outright. That is the NBA's
# split -- diffuse scoring information for totals, narrow structural information for margins --
# reproduced independently in college.
CUTS = {
    "tt":        ["context"],
    "fg_total":  ["style_raw"],
    "fg_spread": ["form_l5", "heat", "season_s2d"],
    "fg_ml":     ["context", "form_l5", "pctile", "possession", "style_raw"],
    "h1_total":  ["adv", "season_s2d", "star"],
    "h1_spread": ["context", "schedule"],
    "h1_ml":     [],
}

# ONE half-life for every market, 365d, and that is a RESULT rather than an inheritance. The sweep
# (`CBB_MARKET_HL.md`) shows every market flat or rising through 365d, with the only two visible
# plateaus -- the full-game spread and the first-half total -- containing it in their interior. The
# NBA needed three different half-lives across three markets in one sport; college does not. It
# also moves the first-half models OFF 240d, which sat in a dip inside their own plateau.
HL_ALL = 365.0


def stage_final(P, G, fcols, do_check=True):
    """Grade each market's PRE-REGISTERED model with the full null machinery.

    One fit per distinct feature set, 21 targets per fit (the real walk plus 20 game-level
    shuffles) sharing one factorisation. Every market then goes through `cbb_panel.report()` --
    the same ladder, season, phase and side treatment `CBB_PANEL_ALL.md` uses -- so a number here
    and a number there differ only by the feature set that produced it.

    THE Z BELOW STILL DOES NOT PAY FOR THE SEARCH. A null shuffle prices "is this model better
    than noise", not "was this feature set picked by looking at these rows". The cut was
    pre-registered from a rule rather than a scan, which limits the damage, but the honest read of
    any improvement over `CBB_PANEL_ALL.md` is the per-season row, not the pooled z.
    """
    fam = pd.Series({c: famof(c) for c in fcols})
    rng = np.random.default_rng(20260802)
    shared = cp.fit(P, fcols, cache=cp.PRED)           # the other horizon, held at the panel's own

    def walk(use, ycol):
        y = P[ycol]
        ys = [y] + [pa.game_shuffle(P, y, rng) for _ in range(cp.NULLS)]
        return pa.ridge_multi(P[use].astype(float), P["date"], ys, min_train=cp.MIN_TRAIN,
                              refit_days=cp.REFIT_DAYS, half_life=HL_ALL)

    L = ["# CBB — every market on its OWN model", "",
         "`cbb_market_models.py --stage final`. Each market is graded on a model fitted to a "
         "feature set chosen for THAT market by the pre-registered rule in the script, at a 365d "
         "half-life, with 20 game-level null shuffles re-measured at every rung. Everything else — "
         "the panel layout, the target, the grader, the oracle — is identical to "
         "`CBB_PANEL_ALL.md`, so the only difference between the two documents is which features "
         "each market's model carries.", "",
         "**The z does not pay for the search.** Nulls price 'better than noise', not 'this feature "
         "set was chosen by looking at these rows'. Read the per-season rows before the pooled z.",
         ""]

    cache = {}
    for m in cp.META:
        k = m["key"]
        use = [c for c in fcols if fam[c] not in CUTS[k]]
        ycol = "_yh1" if k in H1_MKS else "_yfg"
        key = (ycol, tuple(use))
        if key not in cache:
            print(f"[final] {k}: fitting {len(use)} features ({len(fcols)-len(use)} cut: "
                  f"{','.join(CUTS[k]) or 'none'})", flush=True)
            cache[key] = walk(use, ycol)
        pr = cache[key]

        def mkt(i):
            """Market dict from prediction i, with the OTHER horizon held at the panel's own walk."""
            if k in H1_MKS:
                return cp.markets(P, G, shared["fg"][0], pr[i], shared["fg"][0], pr[0])
            return cp.markets(P, G, pr[i], shared["h1"][0], pr[0], shared["h1"][0])

        real = mkt(0)
        if do_check:
            cp.oracle_check(real)
            do_check = False              # the grader's sign cannot vary with the feature set
        S = real[k]
        L += ["", f"*{len(use)} features — cut: {', '.join(CUTS[k]) if CUTS[k] else 'nothing'}.*",
              ""]
        L = cp.report(L, S, S["d"], [mkt(i)[k]["d"] for i in range(1, cp.NULLS + 1)],
                      S["yb"], S["po"], S["pu"], S["frame"])

    p = os.path.join(ROOT, "CBB_MARKET_FINAL.md")
    open(p, "w").write("\n".join(L) + "\n")
    print(f"wrote {os.path.basename(p)}", flush=True)


# --------------------------------------------------------------------------------------------
# THE AGGREGATE GATE — an amendment to the cut rule above, forced by the moneyline.
#
# The rule above cut five families from `fg_ml` and the market got WORSE. That is not bad luck; it
# is the rule reading the half of the ablation table that `feature-pruning-drop-one-vs-solo` rule 9
# says is unreadable. Every single `fg_ml` drop-one delta (−2.59 .. +2.15) sits inside that cell's
# one sigma of ±2.29, so the per-family ranking there is a re-roll of the dice — and the rule
# consulted it anyway, because it had no way to ask whether the market wanted cutting AT ALL.
#
# The readable statistic is the AGGREGATE: mean drop-one delta across families. Per market it is
#   tt −0.71 · fg_total −0.65 · fg_spread −0.64 · h1_ml −0.68 · fg_ml −0.11 · h1_total +0.46 ·
#   h1_spread +0.64
# and it says something the shared-model prune could not: **only the two first-half non-moneyline
# markets are over-parameterised.** The `CBB_PRUNE.md` dilution reading (mean +0.73, 13 of 17
# families improving) was measured in ONE cell of ONE shared model and does not generalise; five of
# the seven markets want their features kept.
#
# AMENDED RULE, applied uniformly to all seven and to nothing else: a market is cut only if its mean
# drop-one delta is positive; then the family rule above decides which families go.
GATE = {k: (v if k in ("h1_total", "h1_spread") else []) for k, v in CUTS.items()}


def stage_gate(P, G, fcols):
    """Grade the pre-registered cut AGAINST the amended aggregate-gated cut, market by market.

    Neither configuration has a holdout — both were chosen off the same rows they are graded on —
    so a pooled ROI difference cannot settle this on its own. What can: whether a configuration's
    advantage shows up in EVERY season or only in the pool. That is why the season rows are printed
    next to the ladder for both configs rather than for the winner only.
    """
    fam = pd.Series({c: famof(c) for c in fcols})
    rng = np.random.default_rng(20260804)
    shared = cp.fit(P, fcols, cache=cp.PRED)
    cache = {}

    def walk(use, ycol):
        key = (ycol, tuple(use))
        if key not in cache:
            print(f"[gate] fitting {len(use)} features on {ycol}", flush=True)
            y = P[ycol]
            ys = [y] + [pa.game_shuffle(P, y, rng) for _ in range(cp.NULLS)]
            cache[key] = pa.ridge_multi(P[use].astype(float), P["date"], ys,
                                        min_train=cp.MIN_TRAIN, refit_days=cp.REFIT_DAYS,
                                        half_life=HL_ALL)
        return cache[key]

    L = ["# CBB — did the cut help, market by market?", "",
         "`cbb_market_models.py --stage gate`. Two configurations per market at a 365d half-life: "
         "**CUT** is the pre-registered family rule, **GATED** adds the aggregate check — only cut "
         "a market whose mean drop-one delta is positive, which is `h1_total` and `h1_spread` and "
         "nothing else. Where the two agree the market appears once.", "",
         "**Read the season rows, not the pooled ROI.** Both configurations were selected on these "
         "rows; only per-season consistency distinguishes a real improvement from a lucky one.", ""]

    for m in cp.META:
        k, ck = m["key"], m["claim"]
        ycol = "_yh1" if k in H1_MKS else "_yfg"
        cfgs = {"CUT": CUTS[k], "GATED": GATE[k]}
        same = sorted(cfgs["CUT"]) == sorted(cfgs["GATED"])
        L += ["", f"## {m['name']}", ""]
        if same:
            L += [f"Both configurations are identical here (cut: "
                  f"{', '.join(CUTS[k]) if CUTS[k] else 'nothing'}), so there is nothing to "
                  f"choose between.", ""]
            continue
        L += [f"| config | features | cut | bets | win% | base% | edge | ROI | z |",
              "|---|---|---|---|---|---|---|---|---|"]
        keep = {}
        for cname, cut in cfgs.items():
            use = [c for c in fcols if fam[c] not in cut]
            pr = walk(use, ycol)

            def mk(i):
                if k in H1_MKS:
                    return cp.markets(P, G, shared["fg"][0], pr[i], shared["fg"][0], pr[0])[k]
                return cp.markets(P, G, pr[i], shared["h1"][0], pr[0], shared["h1"][0])[k]

            S = mk(0)
            nd = [mk(i)["d"] for i in range(1, cp.NULLS + 1)]
            keep[cname] = (S, nd, len(use), cut)
            for kk in m["ks"]:
                g = cp.grade(S["d"], S["yb"], S["po"], S["pu"], kk)
                if not g["n"]:
                    continue
                ne = np.array([(lambda q: q["win"] - q["base"])(
                    cp.grade(x, S["yb"], S["po"], S["pu"], kk)) for x in nd], dtype=float)
                sg = np.nanstd(ne, ddof=1)
                z = (g["win"] - g["base"] - np.nanmean(ne)) / sg if sg > 0 else np.nan
                tag = (f"{cname} ≥{kk:g}" if kk != ck else f"**{cname} ≥{kk:g}**")
                L.append(f"| {tag} | {len(use)} | {', '.join(cut) or 'nothing'} | {g['n']:,} | "
                         f"{g['win']:.1f} | {g['base']:.1f} | {g['win']-g['base']:+.1f} | "
                         f"**{g['roi']:+.1f}** | **{z:+.2f}** |")
                print(f"[gate {k}] {cname} ≥{kk:g} n={g['n']} roi={g['roi']:+.1f} z={z:+.2f}",
                      flush=True)
        L += ["", f"### Per season at the {ck:g}-{m['unit']} cut — the tiebreak", "",
              "| config | season | bets | win% | base% | edge | ROI |", "|---|---|---|---|---|---|---|"]
        for cname, (S, _, _, _) in keep.items():
            for v in sorted(S["frame"]["season"].dropna().astype(str).unique()):
                g = cp.grade(S["d"], S["yb"], S["po"], S["pu"], ck,
                             mask=(S["frame"]["season"].astype(str) == v))
                if g["n"]:
                    L.append(f"| {cname} | {v} | {g['n']:,} | {g['win']:.1f} | {g['base']:.1f} | "
                             f"{g['win']-g['base']:+.1f} | **{g['roi']:+.1f}** |")
                    print(f"[gate {k}] {cname} {v} n={g['n']} roi={g['roi']:+.1f}", flush=True)
        L.append("")

    p = os.path.join(ROOT, "CBB_MARKET_GATE.md")
    open(p, "w").write("\n".join(L) + "\n")
    print(f"wrote {os.path.basename(p)}", flush=True)


def stage_product(P, G, fcols):
    """THE PRODUCT SCORECARD: how good is the prediction on EVERY game, not the bet on some of them.

    Owner rule, restated for college: *"we make predictions on every single game, that doesn't mean
    we bet every game. We just want to give users the best possible prediction for every game."*
    Same law as [[wagerproof-nfl-model-purpose]]. Every other stage in this file grades a filtered
    top-N% of disagreements, which measures a bet-selection strategy; nothing here filters anything.

    AND IT IS THE STRONGER TEST. ROI on 2,368 filtered bets could not separate the cut from the
    uncut spread model -- one sigma there is +-2.0% and the gap was 1.8. Mean absolute error across
    all 23,031 games has roughly twenty times the sample and no selection step at all, so if the
    two feature sets genuinely differ in predictive quality it shows up here or it is not there.

    THE NUMBER THAT MATTERS IS MAE AGAINST THE MARKET'S OWN MAE. The posted line is a forecast;
    scoring the model against it on every game is the only honest way to claim the prediction is
    worth showing. `NCAAB_MODEL_BRIEF2.md` has the previous college model at 9.11 against the
    market's 8.80 -- it lost. That is the bar.
    """
    fam = pd.Series({c: famof(c) for c in fcols})
    PT_MKS = ["tt", "fg_total", "fg_spread", "h1_total", "h1_spread"]
    cache = {}

    def walk(cut, ycol):
        use = [c for c in fcols if fam[c] not in cut]
        key = (ycol, tuple(use))
        if key not in cache:
            print(f"[product] fitting {len(use)} features on {ycol}", flush=True)
            cache[key] = pa.ridge_multi(P[use].astype(float), P["date"], [P[ycol]],
                                        min_train=cp.MIN_TRAIN, refit_days=cp.REFIT_DAYS,
                                        half_life=HL_ALL)[0]
        return cache[key], len(use)

    L = ["# CBB — the prediction on every game", "",
         "`cbb_market_models.py --stage product`. **Nothing here is filtered.** Every row covers "
         "every game the market is priced on, because the product is a number on every game and "
         "the bet is a layer on top of it.", "",
         "`model MAE` is the mean absolute error of the model's own forecast; `market MAE` is the "
         "same error for the posted line. **A model worth showing beats the second column.** The "
         "previous college model in `NCAAB_MODEL_BRIEF2.md` posted 9.11 against the market's 8.80 "
         "and did not.", "",
         "`win% all games` bets literally every game, no selectivity, purely as a calibration "
         "read — it is not a strategy.", ""]

    for cname, cut_fg, cut_h1 in (("UNCUT — the display model", [], []),
                                  ("CUT — spread-specific", CUTS["fg_spread"], CUTS["h1_spread"])):
        fg, nfg = walk(cut_fg, "_yfg")
        h1, nh1 = walk(cut_h1, "_yh1")
        mk = cp.markets(P, G, fg, h1, fg, h1)
        L += ["", f"## {cname}", "",
              f"Full-game model {nfg} features, first-half model {nh1} features, both at "
              f"{HL_ALL:g}d.", "",
              "| market | games | model MAE | market MAE | model better by | paired t | corr | "
              "win% all | base% |", "|---|---|---|---|---|---|---|---|---|"]
        for m in cp.META:
            k = m["key"]
            S = mk[k]
            d = pd.to_numeric(S["d"], errors="coerce")
            o = pd.to_numeric(S["oracle"], errors="coerce")
            ok = d.notna() & o.notna() & S["yb"].notna()
            g = cp.grade(S["d"], S["yb"], S["po"], S["pu"], 0)
            corr = d[ok].corr(o[ok])
            if k in PT_MKS:
                # PAIRED, per game: the model and the line forecast the SAME game, so the noise
                # that dominates both -- how the game actually went -- cancels. An unpaired
                # comparison of two ~9-point MAEs on 17k games could not resolve 0.02 either way.
                delta = (d[ok] - o[ok]).abs() - o[ok].abs()      # <0 => model beat the line
                mm, bm = (d[ok] - o[ok]).abs().mean(), o[ok].abs().mean()
                t = -delta.mean() / (delta.std(ddof=1) / np.sqrt(len(delta)))
                cells = f"{mm:.3f} | {bm:.3f} | **{bm-mm:+.3f}** | **{t:+.2f}** "
            else:
                cells = "— | — | — | — "               # a moneyline has no points error
            L.append(f"| {m['name']} | {int(ok.sum()):,} | {cells}| {corr:+.4f} | "
                     f"{g['win']:.1f} | {g['base']:.1f} |")
            print(f"[product] {cname[:5]} {k}: " + L[-1], flush=True)
        L += ["", "### By season — model MAE minus market MAE (negative = model beats the line)",
              "", "| market | " + " | ".join(sorted(G["season"].dropna().astype(str).unique()))
              + " |", "|---" * (1 + G["season"].nunique()) + "|"]
        for m in [x for x in cp.META if x["key"] in PT_MKS]:
            S = mk[m["key"]]
            d = pd.to_numeric(S["d"], errors="coerce")
            o = pd.to_numeric(S["oracle"], errors="coerce")
            sea = S["frame"]["season"].astype(str)
            cells = []
            for v in sorted(G["season"].dropna().astype(str).unique()):
                ok = d.notna() & o.notna() & (sea == v)
                cells.append(f"**{(d[ok]-o[ok]).abs().mean() - o[ok].abs().mean():+.3f}**"
                             if ok.sum() > 50 else "—")
            L.append(f"| {m['name']} | " + " | ".join(cells) + " |")
            print(f"[product] {cname[:5]} season {m['key']}: " + L[-1], flush=True)
        L.append("")

    p = os.path.join(ROOT, "CBB_PRODUCT.md")
    open(p, "w").write("\n".join(L) + "\n")
    print(f"wrote {os.path.basename(p)}", flush=True)


def stage_bands(P, G, fcols):
    """IS THE MODEL MORE RIGHT WHERE IT DISAGREES MOST? The bridge from product to bet.

    The whole operation rests on a claim nobody has tested directly: predict every game, then bet
    only the games where the model is far from the line, because that is where it is most right.
    The evidence for it so far is a rising ROI ladder -- and a ROI ladder can rise on selection
    alone, since every rung is a subset of the rows the configuration was chosen on.

    MAE settles it without any of that. Each game lands in exactly ONE band by how far the model
    sits from the line, nothing is filtered away, and inside each band the model's error and the
    line's error are compared on the same games. If the model's advantage GROWS with the band, the
    bet rule is mechanically justified. If it is flat while ROI climbs, the ladder is selection.

    THE HONEST FAILURE MODE TO WATCH FOR: the top band could beat the line on MAE simply because
    the line is worse there (a wide band is often a game the market finds hard). That is why the
    market's own MAE is printed per band -- if it rises with the band, part of the model's apparent
    gain is the market getting harder, not the model getting better.
    """
    fam = pd.Series({c: famof(c) for c in fcols})
    use = [c for c in fcols if fam[c] not in CUTS["fg_spread"]]
    useh = [c for c in fcols if fam[c] not in CUTS["h1_spread"]]
    print(f"[bands] fitting {len(use)} / {len(useh)} features", flush=True)
    fg = pa.ridge_multi(P[use].astype(float), P["date"], [P["_yfg"]], min_train=cp.MIN_TRAIN,
                        refit_days=cp.REFIT_DAYS, half_life=HL_ALL)[0]
    h1 = pa.ridge_multi(P[useh].astype(float), P["date"], [P["_yh1"]], min_train=cp.MIN_TRAIN,
                        refit_days=cp.REFIT_DAYS, half_life=HL_ALL)[0]
    mk = cp.markets(P, G, fg, h1, fg, h1)

    BANDS = [(0, 0.5), (0.5, 1), (1, 1.5), (1.5, 2), (2, 3), (3, 4), (4, 99)]
    L = ["# CBB — is the model more right where it disagrees more?", "",
         "`cbb_market_models.py --stage bands`. Every game sits in exactly one band by "
         "|model − line|. **Nothing is filtered and no band is a subset of another**, so unlike "
         "the ROI ladder these rows cannot inherit each other's selection.", "",
         "`model better by` is the market's mean absolute error minus the model's, inside that "
         "band, paired per game. **Positive means the model beat the line on those games.** The "
         "claim under the whole bet rule is that this column RISES down the table.", "",
         "Watch `market MAE` too: if it rises with the band, the market is finding those games "
         "harder and part of any gain is the market getting worse rather than the model better.",
         ""]
    for m in [x for x in cp.META if x["key"] in ("fg_spread", "fg_total", "tt", "h1_spread")]:
        S = mk[m["key"]]
        d = pd.to_numeric(S["d"], errors="coerce")
        o = pd.to_numeric(S["oracle"], errors="coerce")
        base = d.notna() & o.notna() & S["yb"].notna()
        L += ["", f"## {m['name']}", "",
              f"| band (|model − line|, {m['unit']}) | games | model MAE | market MAE | "
              "model better by | paired t | win% | ROI |",
              "|---|---|---|---|---|---|---|---|"]
        for lo, hi in BANDS:
            ok = base & (d.abs() >= lo) & (d.abs() < hi)
            if ok.sum() < 100:
                continue
            delta = (d[ok] - o[ok]).abs() - o[ok].abs()
            t = -delta.mean() / (delta.std(ddof=1) / np.sqrt(len(delta)))
            side = d[ok] > 0
            win = np.where(side, S["yb"][ok], 1 - S["yb"][ok])
            dec = np.where(side, pd.to_numeric(S["po"], errors="coerce")[ok],
                           pd.to_numeric(S["pu"], errors="coerce")[ok])
            roi = 100 * np.nanmean(win * (dec - 1) - (1 - win))
            lab = f"{lo:g}–{hi:g}" if hi < 99 else f"{lo:g}+"
            L.append(f"| {lab} | {int(ok.sum()):,} | {(d[ok]-o[ok]).abs().mean():.3f} | "
                     f"{o[ok].abs().mean():.3f} | **{-delta.mean():+.3f}** | **{t:+.2f}** | "
                     f"{100*np.nanmean(win):.1f} | **{roi:+.1f}** |")
            print(f"[bands {m['key']}] " + L[-1], flush=True)
        L.append("")
    p = os.path.join(ROOT, "CBB_BANDS.md")
    open(p, "w").write("\n".join(L) + "\n")
    print(f"wrote {os.path.basename(p)}", flush=True)


def stage_decomp(P, G, fcols):
    """Two confounds the gate run exposed, each separated into its own 2x2.

    (A) THE FIRST-HALF MARKETS MOVED TWO THINGS AT ONCE. `h1_total` went +3.4% -> +5.3% and
        `h1_spread` +2.4% -> +5.0%, but BOTH the feature set and the half-life changed (240d ->
        365d) between those numbers, so neither improvement is attributable yet. 2x2 it.

    (B) THE CONFERENCE RESTRICTION MAY BE AN ARTEFACT OF THE CUT. `--stage confirm` retired it on
        the CUT spread model, where non-conference reads +5.9% at >=2. On the UNCUT model that same
        slice was +0.3%. If the restriction only dies under a cut that the gate run could not
        separate from no-cut at matched bet count, then it does not die. This grades the identical
        slices on the uncut model so the two sit side by side.

    Bet counts are NOT matched across configurations here and that is the standing trap
    (`feature-pruning-drop-one-vs-solo` rule 4): fewer features means less volatile predictions and
    fewer bets clearing a fixed points cut, so a fixed rung compares two STRATEGIES. Every table
    below prints n, and a ROI gap that comes with a large n gap is read against the neighbouring
    rung of the other configuration, not taken at face value.
    """
    fam = pd.Series({c: famof(c) for c in fcols})
    rng = np.random.default_rng(20260805)
    shared = cp.fit(P, fcols, cache=cp.PRED)
    cache = {}

    def walk(use, ycol, hl):
        key = (ycol, hl, tuple(use))
        if key not in cache:
            print(f"[decomp] fitting {len(use)} features on {ycol} at {hl:g}d", flush=True)
            y = P[ycol]
            ys = [y] + [pa.game_shuffle(P, y, rng) for _ in range(cp.NULLS)]
            cache[key] = pa.ridge_multi(P[use].astype(float), P["date"], ys,
                                        min_train=cp.MIN_TRAIN, refit_days=cp.REFIT_DAYS,
                                        half_life=hl)
        return cache[key]

    L = ["# CBB — separating the two confounds", "",
         "`cbb_market_models.py --stage decomp`. Part A splits the first-half improvement into its "
         "feature-set half and its half-life half. Part B asks whether the conference restriction "
         "dies on the UNCUT spread model too, or only under a cut the gate run could not separate "
         "from no-cut at matched bet count.", "",
         "**n is printed everywhere on purpose.** A configuration with fewer features makes less "
         "volatile predictions and so places fewer bets at a fixed points cut; a ROI gap that "
         "arrives with a big bet-count gap is a strategy difference, not a feature-set one.", ""]

    # ---- Part A: first-half, cut x half-life -------------------------------------------------
    L += ["", "## A. The first-half markets — was it the cut or the memory?", ""]
    for m in [x for x in cp.META if x["key"] in ("h1_total", "h1_spread")]:
        k, ck = m["key"], m["claim"]
        L += ["", f"### {m['name']}", "",
              "| features | half-life | cut | bets | win% | base% | edge | ROI | z |",
              "|---|---|---|---|---|---|---|---|---|"]
        cells = {}
        for cname, cut in (("CUT", CUTS[k]), ("ALL", [])):
            use = [c for c in fcols if fam[c] not in cut]
            for hl in (240.0, 365.0):
                pr = walk(use, "_yh1", hl)
                mk = lambda i: cp.markets(P, G, shared["fg"][0], pr[i],
                                          shared["fg"][0], pr[0])[k]
                S = mk(0)
                nd = [mk(i)["d"] for i in range(1, cp.NULLS + 1)]
                g = cp.grade(S["d"], S["yb"], S["po"], S["pu"], ck)
                ne = np.array([(lambda q: q["win"] - q["base"])(
                    cp.grade(x, S["yb"], S["po"], S["pu"], ck)) for x in nd], dtype=float)
                sg = np.nanstd(ne, ddof=1)
                z = (g["win"] - g["base"] - np.nanmean(ne)) / sg if sg > 0 else np.nan
                L.append(f"| {len(use)} | {hl:g}d | {', '.join(cut) or 'nothing'} | {g['n']:,} | "
                         f"{g['win']:.1f} | {g['base']:.1f} | {g['win']-g['base']:+.1f} | "
                         f"**{g['roi']:+.1f}** | **{z:+.2f}** |")
                print(f"[decomp {k}] {cname} {hl:g}d n={g['n']} roi={g['roi']:+.1f} z={z:+.2f}",
                      flush=True)
                cells[(cname, hl)] = (S, g)
        L += ["", f"| config | season | bets | win% | base% | edge | ROI |",
              "|---|---|---|---|---|---|---|"]
        for (cname, hl), (S, _) in cells.items():
            for v in sorted(S["frame"]["season"].dropna().astype(str).unique()):
                g = cp.grade(S["d"], S["yb"], S["po"], S["pu"], ck,
                             mask=(S["frame"]["season"].astype(str) == v))
                if g["n"]:
                    L.append(f"| {cname} {hl:g}d | {v} | {g['n']:,} | {g['win']:.1f} | "
                             f"{g['base']:.1f} | {g['win']-g['base']:+.1f} | "
                             f"**{g['roi']:+.1f}** |")
        L.append("")

    # ---- Part B: conference restriction on the UNCUT spread model -----------------------------
    L += ["", "## B. Does non-conference come alive without the cut?", "",
          "The same three slices `CBB_MARKET_CONFIRM.md` graded on the 164-feature CUT spread "
          "model, graded again on the 236-feature UNCUT one. If non-conference is only alive "
          "under the cut, and the cut is not separable from no-cut, the restriction stays.", ""]
    conf = pd.to_numeric(G["conferenceGame"], errors="coerce").fillna(0) > 0
    for cname, cut in (("UNCUT (236)", []), ("CUT (164)", CUTS["fg_spread"])):
        use = [c for c in fcols if fam[c] not in cut]
        pr = walk(use, "_yfg", HL_ALL)
        D = [cp.markets(P, G, pr[i], shared["h1"][0], pr[0], shared["h1"][0])["fg_spread"]
             for i in range(cp.NULLS + 1)]
        S = D[0]
        cm = conf.reindex(S["d"].index).fillna(False)
        L += ["", f"### {cname}", "",
              "| cut | slice | bets | win% | base% | edge | ROI | z |",
              "|---|---|---|---|---|---|---|---|"]
        for kk in (1.5, 2, 3):
            for lab, msk in (("all games", None), ("CONFERENCE", cm), ("non-conference", ~cm)):
                g = cp.grade(S["d"], S["yb"], S["po"], S["pu"], kk, mask=msk)
                if not g["n"]:
                    continue
                ne = np.array([(lambda q: q["win"] - q["base"])(
                    cp.grade(x["d"], S["yb"], S["po"], S["pu"], kk, mask=msk))
                    for x in D[1:]], dtype=float)
                sg = np.nanstd(ne, ddof=1)
                z = (g["win"] - g["base"] - np.nanmean(ne)) / sg if sg > 0 else np.nan
                L.append(f"| ≥{kk:g} | {lab} | {g['n']:,} | {g['win']:.1f} | {g['base']:.1f} | "
                         f"{g['win']-g['base']:+.1f} | **{g['roi']:+.1f}** | **{z:+.2f}** |")
                print(f"[decomp B] {cname} ≥{kk:g} {lab} n={g['n']} roi={g['roi']:+.1f} "
                      f"z={z:+.2f}", flush=True)
        L.append("")

    p = os.path.join(ROOT, "CBB_MARKET_DECOMP.md")
    open(p, "w").write("\n".join(L) + "\n")
    print(f"wrote {os.path.basename(p)}", flush=True)


def stage_confirm(P, G, fcols):
    """Does the CONFERENCE-ONLY restriction still belong on the spread rule?

    It was imposed when non-conference graded +0.3% on the shared model. On the spread's own
    feature set non-conference reads +5.8%, which would retire the restriction -- so it gets the
    same treatment the restriction itself got in `CBB_CONFIRM.md`: nulls firing the identical rule,
    and the slice compared against nulls allowed to pick their own best slice from the same menu.
    A conference/non-conference menu of two inflates the winner on noise alone and that has to be
    paid for in both directions.
    """
    fam = pd.Series({c: famof(c) for c in fcols})
    use = [c for c in fcols if fam[c] not in CUTS["fg_spread"]]
    rng = np.random.default_rng(20260803)
    y = P["_yfg"]
    ys = [y] + [pa.game_shuffle(P, y, rng) for _ in range(cp.NULLS)]
    print(f"[confirm] spread model on {len(use)} features", flush=True)
    pr = pa.ridge_multi(P[use].astype(float), P["date"], ys, min_train=cp.MIN_TRAIN,
                        refit_days=cp.REFIT_DAYS, half_life=HL_ALL)
    sh = cp.fit(P, fcols, cache=cp.PRED)
    D = [cp.markets(P, G, pr[i], sh["h1"][0], pr[0], sh["h1"][0])["fg_spread"]
         for i in range(cp.NULLS + 1)]
    S = D[0]
    conf = pd.to_numeric(G["conferenceGame"], errors="coerce").fillna(0) > 0
    conf = conf.reindex(S["d"].index).fillna(False)

    L = ["# CBB — is the conference-only restriction still needed?", "",
         "`cbb_market_models.py --stage confirm`. The restriction was imposed because "
         "non-conference graded +0.3% on the SHARED feature set. This asks the same question of "
         "the spread's OWN feature set. Nulls are the same 20 game-level shuffles, re-measured "
         "inside each slice.", ""]
    for k in (1.5, 2, 2.5, 3):
        L += ["", f"## Cut ≥{k:g} points", "",
              "| slice | bets | win% | base% | edge | ROI | null mean | null sd | z |",
              "|---|---|---|---|---|---|---|---|---|"]
        cells = {}
        for lab, m in (("all games", None), ("CONFERENCE", conf), ("non-conference", ~conf)):
            g = cp.grade(S["d"], S["yb"], S["po"], S["pu"], k, mask=m)
            if not g["n"]:
                continue
            ne = np.array([(lambda q: q["win"] - q["base"])(
                cp.grade(x["d"], S["yb"], S["po"], S["pu"], k, mask=m)) for x in D[1:]], dtype=float)
            mu, sg = np.nanmean(ne), np.nanstd(ne, ddof=1)
            z = (g["win"] - g["base"] - mu) / sg if sg > 0 else np.nan
            cells[lab] = (g, ne)
            L.append(cp.row(g, lab, f" {mu:+.2f} | {sg:.2f} | **{z:+.2f}** |"))
            print(f"[confirm ≥{k:g}] " + L[-1], flush=True)
        # Selection-paid: the winner of a two-slice menu, against nulls allowed the same menu.
        if "CONFERENCE" in cells and "non-conference" in cells:
            real = {lab: c[0]["win"] - c[0]["base"] for lab, c in cells.items() if lab != "all games"}
            best = max(real, key=real.get)
            nb = np.nanmax(np.vstack([cells["CONFERENCE"][1], cells["non-conference"][1]]), axis=0)
            zz = (real[best] - np.nanmean(nb)) / np.nanstd(nb, ddof=1)
            L += ["", f"**Selection-paid.** Best slice is **{best}** at {real[best]:+.1f} edge. "
                  f"Nulls allowed the best of the same two slices averaged {np.nanmean(nb):+.2f} "
                  f"(sd {np.nanstd(nb, ddof=1):.2f}), so the winner clears its own menu by "
                  f"**z {zz:+.2f}**.", ""]
            print(f"[confirm ≥{k:g}] selection-paid best={best} z={zz:+.2f}", flush=True)
    p = os.path.join(ROOT, "CBB_MARKET_CONFIRM.md")
    open(p, "w").write("\n".join(L) + "\n")
    print(f"wrote {os.path.basename(p)}", flush=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--stage", choices=["ablate", "hl", "final", "confirm", "gate", "decomp", "product", "bands", "both"],
                    default="ablate")
    ap.add_argument("--no-solo", action="store_true")
    a = ap.parse_args()

    P, G, fcols, _ = cp.load()
    # Raw-quantity targets, for the target-choice test. Same missingness as their residual twins.
    P["_rawfg"] = P["pts"].astype(float)
    P["_rawh1"] = P["h1"].astype(float)
    P.loc[P["_yfg"].isna(), "_rawfg"] = np.nan
    P.loc[P["_yh1"].isna(), "_rawh1"] = np.nan

    conf_g = pd.to_numeric(G["conferenceGame"], errors="coerce").fillna(0) > 0
    conf_p = P["event_id"].map(conf_g).fillna(False)

    if a.stage in ("ablate", "both"):
        stage_ablate(P, G, fcols, conf_g, conf_p, not a.no_solo)
    if a.stage in ("hl", "both"):
        stage_hl(P, G, fcols, conf_g, conf_p)
    if a.stage == "final":
        stage_final(P, G, fcols)
    if a.stage == "confirm":
        stage_confirm(P, G, fcols)
    if a.stage == "gate":
        stage_gate(P, G, fcols)
    if a.stage == "decomp":
        stage_decomp(P, G, fcols)
    if a.stage == "product":
        stage_product(P, G, fcols)
    if a.stage == "bands":
        stage_bands(P, G, fcols)


if __name__ == "__main__":
    main()
