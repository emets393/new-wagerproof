#!/usr/bin/env python3
"""Which feature families help the CBB team-points model, and which are dead weight?

THE OWNER ASKED FOR THIS DIRECTLY -- *"You need to prune the features to see which ones help or
hurt the new prediction... are you even using the injury data or the aggregated stats we've been
gathering or are you just putting dumbass shit like 3pt % by itself and expecting a better result"*
-- and it is the one major NBA method that had not been ported to college. The panel carries 269
features that went in as one undifferentiated block. Counted by family, **96 of them are style
percentiles and raw style rates**, and `ncaab-model-lab` already recorded on this exact sport that
raw box columns HURT while engineered cross-team constructions help. That finding was never applied
to the panel.

TWO THINGS THIS FILE IS LOOKING FOR THAT ARE NOT ORDINARY PRUNING.

  1. THE MARKET ANCHOR. `impl` -- the full-game-implied team total, `(total)/2 -+ (spread)/2` -- is
     in the feature list. `cbb_panel.py`'s own docstring claims "the model never sees a price, a
     spread or a total on the input side", and that claim is FALSE: `build_panel` appends `impl` to
     `fcols`, and `assert_originator()` never sees it because it is checked against the wide
     candidate list, not the panel's. The owner's standing rule is explicit -- betting lines are not
     supposed to be part of the model -- so this gets its own family and its own drop-one row rather
     than a paragraph of argument. If the model holds up without it, `impl` comes out permanently.
     If it does not, that is a decision to put in front of the owner, not one to bury.

     (For context on why it was ever there: `predict-the-raw-quantity-not-the-residual` found on the
     NBA that predicting the raw quantity WITH the line as a feature scored +3.9% while predicting
     the residual against the line scored -1.2%. Residual-target-plus-line-as-feature, which is what
     this panel does, spans the same space as raw-target-with-line for a ridge. So the construction
     is defensible on evidence and indefensible on the stated rule at the same time. Measure it.)

  2. A DUPLICATED FAMILY. `style_ncaab` reaches the panel twice -- once as the sides table's own
     `pct_*` percentiles and again as `cbb_blocks`' `sty_pct_*`. Same underlying quantity, two
     copies, 32 columns each. Ridge does not care about collinearity the way OLS does, but two
     copies of one family get twice the shrinkage budget of a family with one copy, which silently
     upweights style against everything else. Both copies get their own family so the drop-one can
     say whether either is carrying anything.

DROP-ONE AND SOLO ANSWER DIFFERENT QUESTIONS ([[feature-pruning-drop-one-vs-solo]]). A family that
is redundant with the rest of the stack looks fine SOLO and changes nothing when DROPPED. A family
that is actively harmful IMPROVES the model when dropped. **Only the drop-one column decides a cut;
solo only says whether the information exists at all.**

GRADED AT FIXED SELECTIVITY, and graded on the LIVE RULE. Fewer features means less volatile
predictions, so a fixed "≥1.5 points" cut would select different bet counts per config and compare
two strategies rather than two feature sets. Every config bets the same top-N%. And because the
verdict rule is the full-game spread INSIDE CONFERENCE PLAY, the conference-only columns are the
ones that decide -- a cut that helps the pooled number and hurts the live rule is not a cut.

NO NULLS HERE. Nulls price the search that found a result; this is a ranking, not a claim. Any
configuration that wins goes back through `cbb_panel.py`'s null grading before a number from it is
believed.

THE FIRST-HALF MODEL IS HELD FIXED at its cached predictions. Only the full-game model is refitted,
because the full-game spread is the only rule that survived `CBB_CONFIRM.md`; refitting both would
double a 40-minute run to answer a question about a market that is already a null.
"""
import importlib.util
import os
import re
import warnings

import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "CBB_PRUNE.md")
QS = (0.20, 0.10)                     # top 20% and top 10% of disagreements

# Matched against the name with own_/opp_ stripped. ORDER MATTERS -- first hit wins, so the two
# style copies are separated before the generic percentile catch-all.
FAMILIES = [
    ("market_anchor", r"^impl$"),                  # the posted line, in the model. Under test.
    ("kenpom",        r"^kp_"),
    ("heat",          r"^heat_"),                  # player shooting heat vs own baseline
    ("star",          r"^star_"),                  # star shot profile
    ("lineup",        r"^lup_"),                   # rotation shape / star dependence
    ("starters",      r"^stu_"),
    ("possession",    r"^poss_"),
    ("style_pctile",  r"^sty_pct_"),               # copy 1 of style, as percentiles
    ("style_raw",     r"^sty_s_"),                 # copy 2 of style, as raw rates
    ("pctile",        r"^pct_"),                   # the sides table's own copy of the percentiles
    ("adv",           r"^adv_"),
    ("form_l5",       r"^l5_"),                    # last-5 form
    ("season_s2d",    r"^s2d_"),                   # season to date
    ("availability",  r"_out$|out_n$|^lowto_"),    # the injury/absence columns
    ("roster",        r"^(Hgt5|HgtEff|Exp|Bench|Continuity)$"),
    ("schedule",      r"^(rest_days|b2b|game_num|month)$"),
    ("context",       r"^(conferenceGame|neutralSite|nonconf|meet_no|is_home|style_adv|"
                      r"cover_streak)$"),
]


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
    """Grade the top-q share of disagreements. Bet count held constant across configurations."""
    ok = S["d"].notna() & S["yb"].notna() & S["po"].notna() & S["pu"].notna()
    if mask is not None:
        ok = ok & mask
    if ok.sum() < 100:
        return dict(n=0, win=np.nan, base=np.nan, roi=np.nan)
    k = S["d"][ok].abs().quantile(1 - q)
    return cp.grade(S["d"], S["yb"], S["po"], S["pu"], k, mask=mask)


def main():
    P, G, fcols, _ = cp.load()
    # The first-half model is a constant across every configuration below, so it is read from the
    # panel's own cache rather than refitted 37 times. Only column 0 (the real walk) is needed.
    h1 = cp.fit(P, fcols, cache=cp.PRED)["h1"][0]
    conf_g = pd.to_numeric(G["conferenceGame"], errors="coerce").fillna(0) > 0
    conf = P["event_id"].map(conf_g).fillna(False)          # panel-level, for the team total
    X = P[fcols].astype(float)

    fam = pd.Series({c: famof(c) for c in fcols})
    counts = fam.value_counts()
    print(f"[prune] {len(P):,} team-games | {len(fcols)} features in "
          f"{len(counts)} families", flush=True)
    print(counts.to_string(), flush=True)

    rows = []

    def record(tag, kind, use):
        if len(use) < 3:
            return None
        fg = pa.ridge_multi(X[use], P["date"], [P["_yfg"]], min_train=cp.MIN_TRAIN,
                            refit_days=cp.REFIT_DAYS, half_life=cp.HL_FG)[0]
        mk = cp.markets(P, G, fg, h1)
        if kind == "base":
            cp.oracle_check(mk)          # the grader's sign does not vary with the feature set
        S, T = mk["fg_spread"], mk["fg_total"]
        r = dict(tag=tag, kind=kind, k=len(use), corr=float(fg.corr(P["_yfg"])))
        for q in QS:
            p = int(q * 100)
            a = sel(S, q)
            # `S` is game-level and `conf_g` is indexed by event_id, so the mask reindexes onto the
            # market's own index rather than being broadcast from the panel.
            b = sel(S, q, mask=conf_g.reindex(S["d"].index).fillna(False))
            r |= {f"roi{p}": a["roi"], f"n{p}": a["n"], f"win{p}": a["win"], f"base{p}": a["base"],
                  f"croi{p}": b["roi"], f"cn{p}": b["n"], f"cwin{p}": b["win"],
                  f"cbase{p}": b["base"]}
        r["troi10"] = sel(T, 0.10)["roi"]
        r["ttroi10"] = sel(mk["tt"], 0.10, mask=conf)["roi"]
        rows.append(r)
        print(f"  {kind:9s} {tag:14s} k={len(use):3d}  corr {r['corr']:+.4f}  "
              f"spread top10% {r['roi10']:+6.2f}%  CONF top10% {r['croi10']:+6.2f}%", flush=True)
        return r

    record("ALL", "base", fcols)
    for name in counts.index:
        record(name, "drop-one", [c for c in fcols if fam[c] != name])
    for name in counts.index:
        record(name, "solo", [c for c in fcols if fam[c] == name])

    R = pd.DataFrame(rows)
    R.to_parquet(os.path.join(ROOT, "data", "parquet", "_cbb_prune.parquet"), index=False)
    write(R, counts)


def write(R, counts):
    b = R[R["kind"] == "base"].iloc[0]
    L = ["# CBB — pruning the team-points model", "",
         "`cbb_prune.py`. Family-level ablation of the full-game team-points model, graded through "
         "the same `cbb_panel.markets()` as every other document here. **Graded at fixed "
         "selectivity** — each configuration bets the same top-N% of disagreements, so a smaller "
         "feature set cannot win by simply making fewer, more extreme predictions.", "",
         "**The conference columns are the ones that decide.** The only rule that survived "
         "`CBB_CONFIRM.md` is the full-game spread inside conference play, so a cut that helps the "
         "pooled number and hurts the live rule is not a cut.", "",
         f"Baseline: **{int(b['k'])} features**, corr with the realised residual {b['corr']:+.4f}, "
         f"spread **{b['roi10']:+.2f}%** ROI on the top 10% of all disagreements and "
         f"**{b['croi10']:+.2f}%** on the top 10% inside conference play.", "",
         "## Drop-one — does the model improve without this family?", "",
         "**A positive delta means cutting the family HELPS.** This column decides what gets "
         "removed; `solo` below only says whether the information exists at all.", "",
         "| family | cols | spread top 20% | Δ | spread top 10% | Δ | CONF top 10% | Δ | corr |",
         "|---|---|---|---|---|---|---|---|---|"]
    D = R[R["kind"] == "drop-one"].sort_values("croi10", ascending=False)
    for _, r in D.iterrows():
        L.append(f"| {r['tag']} | {counts[r['tag']]} | {r['roi20']:+.2f} | "
                 f"**{r['roi20']-b['roi20']:+.2f}** | {r['roi10']:+.2f} | "
                 f"**{r['roi10']-b['roi10']:+.2f}** | {r['croi10']:+.2f} | "
                 f"**{r['croi10']-b['croi10']:+.2f}** | {r['corr']:+.4f} |")
    L += ["", "## Solo — does the family carry anything by itself?", "",
          "A family can look fine here and still be worth cutting: that is what redundancy looks "
          "like. It can also look dead here and be load-bearing in combination.", "",
          "| family | cols | spread top 10% | CONF top 10% | corr |", "|---|---|---|---|---|"]
    for _, r in R[R["kind"] == "solo"].sort_values("croi10", ascending=False).iterrows():
        L.append(f"| {r['tag']} | {counts[r['tag']]} | {r['roi10']:+.2f} | {r['croi10']:+.2f} | "
                 f"{r['corr']:+.4f} |")
    ma = D[D["tag"] == "market_anchor"]
    if len(ma):
        m = ma.iloc[0]
        L += ["", "## The market anchor", "",
              f"`impl` is the full-game-implied team total — the posted total and spread, rotated. "
              f"It was in the feature list while `cbb_panel.py`'s docstring claimed the model never "
              f"sees a line on the input side. Removing it moves the live conference rule from "
              f"**{b['croi10']:+.2f}%** to **{m['croi10']:+.2f}%** "
              f"({m['croi10']-b['croi10']:+.2f}) and the model's correlation with the realised "
              f"residual from {b['corr']:+.4f} to {m['corr']:+.4f}.", ""]
    open(OUT, "w").write("\n".join(L) + "\n")
    print("\n".join(L), flush=True)
    print(f"wrote {os.path.basename(OUT)}", flush=True)


if __name__ == "__main__":
    main()
