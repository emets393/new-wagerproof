#!/usr/bin/env python3
"""Team luck, stage 2: gradients, composites, season phase, and the unpriced residual.

Stage 1 (nba_luck_sweep.py) hunted 352 individual cells and came back family-wise p=.17 with
a RATE control ranked 9th. That is the correct verdict for that question, but it is a weak
question: a top-cell hunt over univariate features is exactly the design the NCAAB work
already showed to be the wrong one ("COMBINE signals, don't univariate-screen").

Four better questions here.

1. GRADIENT. Regression to the mean is not a threshold effect, it is a slope. If teams that
   have been lucky are due to give it back, the luckier the team the LESS it should cover --
   monotonically, across the whole range, not in one bucket. So this reports raw home-cover%
   by decile of home-minus-away luck and tests the TREND, not the best decile. A trend test
   over 10 ordered bins is one test, not ten, and it cannot be gamed by picking a bucket.

2. COMPOSITE. Luck arrives in correlated pieces -- a team that shot over its head also won
   more close games and beat the spread. Averaging the z-scores of the whole family is both
   a stronger signal and ONE test instead of thirteen.

3. SEASON PHASE. The owner's standing instruction: stop pooling the season. Early-season
   trailing windows are a larger share of a team's known form and the market has less to go
   on; late season the rotation has turned over. Same composite, split three ways.

4. THE UNPRICED RESIDUAL. This is the question the sweep never asked. If the market already
   marks a lucky team up, betting raw luck is betting something already in the price. So the
   composite is regressed on the closing number itself and on the open-to-close move, and the
   RESIDUAL -- luck the market did not act on -- is tested. That residual is where an edge
   would have to live for it to be real.

CONTROLS run through identical machinery: a composite of shot RATES (three-point attempt
rate taken and allowed), which are style/skill and cannot regress the way percentages do. If
the rate composite shows the same gradient as the luck composite, this file is measuring
schedule or pace and none of it should be believed.
"""
import os
import warnings

import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")

from nba_out_isolate import to_dec
from nba_luck_sweep import MARKETS, load

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "data", "parquet")
RNG = np.random.default_rng(202)
N_PERM = 20000
NBIN = 10
MIN_BETS = 60

# Composites. Sign = direction in which the team has been LUCKY (due to give it back).
# Opponent-allowed percentages carry a MINUS: a team whose opponents shot the lights out
# against it has been UNLUCKY, and is due positive regression.
RESULTS_LUCK = {"pyth": +1, "close": +1, "margin": +1, "ats": +1}
SHOOT_LUCK = {"three_pct": +1, "ft_pct": +1, "efg": +1, "off_eff": +1,
              "three_pct_alwd": -1, "efg_alwd": -1, "def_eff": -1}
RATE_CTRL = {"three_rate": +1, "three_rate_alwd": -1}     # expected null

# For TOTALS the question is different: not "who was lucky" but "was recent SCORING
# inflated". Own-offence luck and opponent-shooting-allowed luck both push totals UP, so
# they share a sign here where they opposed above.
SHOOT_TOT = {"three_pct": +1, "ft_pct": +1, "efg": +1, "off_eff": +1,
             "three_pct_alwd": +1, "efg_alwd": +1, "def_eff": +1}

COMPOSITES = {
    "results luck": (RESULTS_LUCK, RESULTS_LUCK),      # (sides map, totals map)
    "shooting luck": (SHOOT_LUCK, SHOOT_TOT),
    "all luck": ({**RESULTS_LUCK, **SHOOT_LUCK}, {**RESULTS_LUCK, **SHOOT_TOT}),
    "RATE control": (RATE_CTRL, RATE_CTRL),
}


def zseason(s, season):
    """Z-score within season. Shooting environments drift year to year, and a composite
    built from raw units would let one high-variance season dominate the ranking."""
    s = pd.to_numeric(s, errors="coerce")
    g = s.groupby(season)
    return (s - g.transform("mean")) / g.transform("std").replace(0, np.nan)


def build_composites(G, w=10, variant=""):
    """One column per composite, at both the differential (sides) and sum (totals) level."""
    out = {}
    for name, (m_side, m_tot) in COMPOSITES.items():
        for kind, mp in (("d", m_side), ("s", m_tot)):
            parts = []
            for base, sign in mp.items():
                # the _c (competitive-minutes) variant only exists for the shooting families
                col = f"{kind}_luck{w}_{base}{variant}"
                if col not in G.columns:
                    col = f"{kind}_luck{w}_{base}"
                if col not in G.columns:
                    continue
                parts.append(sign * zseason(G[col], G["season"]))
            if parts:
                out[f"{kind}::{name}"] = pd.concat(parts, axis=1).mean(axis=1)
    return pd.DataFrame(out, index=G.index)


def trend_p(bins, win, n_perm=N_PERM):
    """Is the win rate SLOPED across the ordered bins?

    Pearson correlation between bin index and outcome, with the null built by shuffling
    outcomes. This is one test over the whole gradient -- unlike 'best decile', it cannot be
    inflated by looking at ten bins and reporting the extreme one.
    """
    ok = np.isfinite(bins) & np.isfinite(win)
    b, w = bins[ok].astype(float), win[ok].astype(float)
    if len(b) < 200 or b.std() == 0 or w.std() == 0:
        return np.nan, np.nan
    obs = np.corrcoef(b, w)[0, 1]
    nul = np.array([np.corrcoef(b, RNG.permutation(w))[0, 1] for _ in range(400)])
    return obs, float((np.abs(nul) >= abs(obs)).mean())


def gradient(G, sig, mkt, L):
    """Raw cover/over rate by decile of the signal. No baseline gymnastics: for a spread the
    number IS the cover rate, and a 50% line is the honest reference."""
    ycol, ppos, pneg, fam = MARKETS[mkt]
    y = pd.to_numeric(G[ycol], errors="coerce").to_numpy(dtype=float)
    s = pd.to_numeric(sig, errors="coerce").to_numpy(dtype=float)
    ok = np.isfinite(y) & (y != 0) & np.isfinite(s)
    if ok.sum() < 500:
        return None
    yy, ss = y[ok], s[ok]
    bins = pd.qcut(ss, NBIN, labels=False, duplicates="drop")
    pos = (yy > 0).astype(float)          # home covers / game goes over
    r, p = trend_p(np.asarray(bins, dtype=float), pos)
    rates = [100 * pos[bins == b].mean() for b in range(int(np.nanmax(bins)) + 1)]
    L.append(f"| {mkt} | " + " ".join(f"{v:.0f}" for v in rates) +
             f" | {r:+.3f} | {p:.3f} | {len(yy):,} |")
    return r, p


def bet(G, sig, mkt, frac, mask=None, label=""):
    """Fold the signal over: bet against the extreme tails. Returns a row dict or None."""
    ycol, ppos, pneg, fam = MARKETS[mkt]
    y = pd.to_numeric(G[ycol], errors="coerce").to_numpy(dtype=float)
    # to_dec returns a Series for American-odds columns but a bare ndarray for ones already
    # in decimal, so coerce rather than assuming either.
    dp = np.asarray(to_dec(G[ppos]), dtype=float)
    dn = np.asarray(to_dec(G[pneg]), dtype=float)
    s = pd.to_numeric(sig, errors="coerce").to_numpy(dtype=float)
    ok = np.isfinite(y) & (y != 0) & np.isfinite(dp) & np.isfinite(dn) & np.isfinite(s)
    if mask is not None:
        ok &= mask
    if ok.sum() < 200:
        return None
    thr = np.nanquantile(np.abs(s[ok]), 1 - frac)
    m = ok & (np.abs(s) >= thr) & (s != 0)
    if m.sum() < MIN_BETS:
        return None
    side = -np.sign(s[m])                       # fade the lucky side / the inflated total
    win = np.where(side > 0, y[m] > 0, y[m] < 0)
    dec = np.where(side > 0, dp[m], dn[m])
    roi = np.where(win, dec - 1.0, -1.0).mean()
    base = max((y[m] > 0).mean(), (y[m] < 0).mean())
    # season is a label like "2022-23", not a number -- coercing it to float silently
    # blanks the whole per-season column, which is the one place a pooled number can hide
    # a dead year.
    seas = G["season"].astype(str).to_numpy()[m]
    per = " ".join(f"{t[-2:]}:{100*win[seas == t].mean():.0f}"
                   for t in sorted(set(seas)) if (seas == t).sum() >= 25)
    return dict(label=label, market=mkt, n=int(m.sum()), win=100 * win.mean(),
                base=100 * base, edge=100 * (win.mean() - base), roi=100 * roi, per=per)


def residualize(sig, X):
    """Strip out everything the market already knows. Returns luck the price did not act on."""
    s = pd.to_numeric(sig, errors="coerce").to_numpy(dtype=float)
    A = np.column_stack([pd.to_numeric(X[c], errors="coerce").to_numpy(float) for c in X])
    ok = np.isfinite(s) & np.isfinite(A).all(axis=1)
    out = np.full(len(s), np.nan)
    if ok.sum() < 300:
        return out
    A1 = np.column_stack([np.ones(ok.sum()), A[ok]])
    beta, *_ = np.linalg.lstsq(A1, s[ok], rcond=None)
    out[ok] = s[ok] - A1 @ beta
    return out


def main():
    G = load()
    # Games played WITHIN the season -- the season-phase variable. Not cnt_margin: that is
    # the expanding count over the team's whole history in the panel (max 388 across four
    # seasons), so using it would file 90% of games as "late" and the phase split would be
    # a split in name only.
    T = pd.read_parquet(f"{OUT}/nba_team_luck.parquet")
    T["is_home"] = (pd.to_numeric(T["team_id"], errors="coerce")
                    == pd.to_numeric(T["home_team_id"], errors="coerce"))
    T = T.sort_values(["season", "team_id", "commence_time"])
    T["gp"] = T.groupby(["season", "team_id"]).cumcount()
    gp = T.pivot_table(index="event_id", columns="is_home", values="gp", aggfunc="first")
    gp.columns = ["a_gp", "h_gp"]
    G = G.merge(gp.reset_index(), on="event_id", how="left")
    G["min_gp"] = G[["a_gp", "h_gp"]].min(axis=1)
    phase = pd.cut(G["min_gp"], [-1, 24, 54, 999], labels=["early", "mid", "late"])

    C = build_composites(G, w=10)
    C5 = build_composites(G, w=5)

    L = ["# NBA team luck — stage 2: gradients, composites, phase, unpriced residual", "",
         f"{len(G):,} games. Composites are season-z-scored averages of the whole luck "
         "family, not single features. Positive = the HOME team (or, for totals, BOTH teams) "
         "has been lucky and is due to give it back.", ""]

    # ---------- 1. gradients ----------
    L += ["## 1. The gradient test — does covering DECLINE as luck rises?", "",
          "Raw home-cover% (or over%) by decile of the composite, lucky-est on the right. A "
          "real regression effect slopes DOWN across all ten. `r` is the correlation between "
          "decile and outcome; `p` permutes outcomes 400x. One test per row, not ten.", "",
          "IGNORE THE MONEYLINE ROW. Its outcome is the raw margin with no line subtracted, "
          "so a rising gradient there says only that teams which have been winning keep "
          "winning — true, fully priced, and not a signal. Every other row is graded against "
          "an actual number, which is what makes a slope meaningful.", ""]
    for name in COMPOSITES:
        L += [f"### {name} (10-game window)", "",
              "| market | decile 1 → 10 cover/over % | r | p | n |",
              "|---|---|---|---|---|"]
        for mkt, (_, _, _, fam) in MARKETS.items():
            key = ("s::" if fam == "tot" else "d::") + name
            if key in C:
                gradient(G, C[key], mkt, L)
        L.append("")
    print("\n".join(L[-40:]), flush=True)

    # ---------- 2. betting the tails, by window ----------
    L += ["## 2. Betting the tails (fade the lucky side)", "",
          "| composite | w | market | n | win % | base % | edge | ROI % | by season |",
          "|---|---|---|---|---|---|---|---|---|"]
    rows = []
    for w, CC in ((10, C), (5, C5)):
        for name in COMPOSITES:
            for mkt, (_, _, _, fam) in MARKETS.items():
                key = ("s::" if fam == "tot" else "d::") + name
                if key not in CC:
                    continue
                r = bet(G, CC[key], mkt, 0.33, label=f"{name}|w{w}")
                if r:
                    r["w"] = w
                    rows.append(r)
    for r in sorted(rows, key=lambda x: -x["edge"])[:24]:
        L.append(f"| {r['label'].split('|')[0]} | {r['w']} | {r['market']} | {r['n']} | "
                 f"{r['win']:.1f} | {r['base']:.1f} | **{r['edge']:+.1f}** | {r['roi']:+.1f} "
                 f"| {r['per']} |")
    L.append("")
    print("\n".join(L[-26:]), flush=True)

    # ---------- 3. season phase ----------
    L += ["## 3. Season phase — the owner's standing instruction, stop pooling", "",
          "`early` = both teams under 25 games played, `mid` 25-54, `late` 55+. Same "
          "composite, same fade rule, split three ways.", "",
          "| composite | market | phase | n | win % | base % | edge | ROI % | by season |",
          "|---|---|---|---|---|---|---|---|---|"]
    prows = []
    for name in COMPOSITES:
        for mkt, (_, _, _, fam) in MARKETS.items():
            key = ("s::" if fam == "tot" else "d::") + name
            if key not in C:
                continue
            for ph in ("early", "mid", "late"):
                r = bet(G, C[key], mkt, 0.33, mask=(phase == ph).to_numpy(), label=name)
                if r:
                    r["phase"] = ph
                    prows.append(r)
    for r in sorted(prows, key=lambda x: -x["edge"])[:24]:
        L.append(f"| {r['label']} | {r['market']} | {r['phase']} | {r['n']} | {r['win']:.1f} "
                 f"| {r['base']:.1f} | **{r['edge']:+.1f}** | {r['roi']:+.1f} | {r['per']} |")
    L.append("")
    print("\n".join(L[-26:]), flush=True)

    # ---------- 4. the unpriced residual ----------
    L += ["## 4. Luck the market did NOT price", "",
          "The composite regressed on the closing number and the open→close move, then the "
          "residual bet. If raw luck ever looked live only because lucky teams are good "
          "teams, this row is where it dies; if the market genuinely under-adjusts, this is "
          "where the edge concentrates.", "",
          "| composite | market | n | win % | base % | edge | ROI % | by season |",
          "|---|---|---|---|---|---|---|---|"]
    G["mv_sp"] = (pd.to_numeric(G["t60_spread_home_point"], errors="coerce")
                  - pd.to_numeric(G["open_spread_home_point"], errors="coerce"))
    G["mv_tot"] = (pd.to_numeric(G["t60_total_point"], errors="coerce")
                   - pd.to_numeric(G["open_total_point"], errors="coerce"))
    Xs = G[["t60_spread_home_point", "mv_sp"]]
    Xt = G[["t60_total_point", "mv_tot"]]
    rrows = []
    for name in COMPOSITES:
        for mkt, (_, _, _, fam) in MARKETS.items():
            key = ("s::" if fam == "tot" else "d::") + name
            if key not in C:
                continue
            res = residualize(C[key], Xt if fam != "side" else Xs)
            r = bet(G, pd.Series(res, index=G.index), mkt, 0.33, label=name)
            if r:
                rrows.append(r)
    for r in sorted(rrows, key=lambda x: -x["edge"])[:20]:
        L.append(f"| {r['label']} | {r['market']} | {r['n']} | {r['win']:.1f} | "
                 f"{r['base']:.1f} | **{r['edge']:+.1f}** | {r['roi']:+.1f} | {r['per']} |")
    L.append("")

    path = os.path.join(ROOT, "NBA_LUCK_STAGE2_BRIEF.md")
    with open(path, "w") as f:
        f.write("\n".join(L) + "\n")
    print("\n".join(L[-22:]), flush=True)
    print(f"\nwrote {path}", flush=True)


if __name__ == "__main__":
    main()
