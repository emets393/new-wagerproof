#!/usr/bin/env python3
"""The one thing that survived stage 2: shooting luck on TOTALS. Pressure-test it properly.

Stage 2 produced one clean asymmetry. On SIDES the rate control -- three-point attempt rate
taken and allowed, which is style and cannot regress the way a percentage does -- ranked
ABOVE every luck composite. That is a null. On TOTALS the same control went to -1.0 edge and
-4.7% ROI while shooting luck held +3.0 with all four seasons positive. A signal that
separates from its own control in one market and not the other is worth one more round; a
signal that beats nothing but a coin flip is not.

The mechanism is the MLB one and it is the owner's own framing: if both teams have recently
been finishing shots above their own sustainable rates, their recent scoring overstates them,
the total is set off inflated form, and the correction lands on the UNDER.

Three ways to break it, all of which a real effect should survive:

  DOSE     tighten the selection from the top 50% down to the top 10%. Regression to the
           mean is a dose-response phenomenon -- more extreme luck, larger correction. A
           flat or non-monotone ladder means the tail is not special and the pooled number
           is an artifact of sample size, not selection.
  CONTROL  the rate composite re-run at every rung of the same ladder. If it climbs too,
           the ladder is measuring pace or schedule.
  DIRECTION the OVER side of the same rule. If unders win only because unders win in this
           sample, backing overs on the unlucky tail will not work, and the asymmetry
           exposes it.

Then walk-forward: thresholds from strictly prior seasons, applied blind. Nothing here counts
until it clears that, because every number above was computed on all four seasons at once.
"""
import os
import warnings

import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")

from nba_out_isolate import to_dec
from nba_luck_sweep import MARKETS, load
from nba_luck_stage2 import COMPOSITES, build_composites

ROOT = os.path.dirname(os.path.abspath(__file__))
RNG = np.random.default_rng(303)
N_PERM = 20000
FRACS = (0.50, 0.33, 0.20, 0.10)
TOTAL_MARKETS = ("FG total", "1H total")


def grade(G, sig, mkt, m, flip=False):
    """Grade a mask. flip=True backs the OVER on the same tail -- the direction control."""
    ycol, ppos, pneg, _ = MARKETS[mkt]
    y = pd.to_numeric(G[ycol], errors="coerce").to_numpy(float)
    dp = np.asarray(to_dec(G[ppos]), dtype=float)
    dn = np.asarray(to_dec(G[pneg]), dtype=float)
    s = pd.to_numeric(sig, errors="coerce").to_numpy(float)
    side = np.sign(s) if flip else -np.sign(s)
    win = np.where(side[m] > 0, y[m] > 0, y[m] < 0)
    dec = np.where(side[m] > 0, dp[m], dn[m])
    roi = np.where(win, dec - 1.0, -1.0).mean()
    base = max((y[m] > 0).mean(), (y[m] < 0).mean())
    nul = RNG.binomial(len(win), base, N_PERM) / len(win)
    seas = G["season"].astype(str).to_numpy()[m]
    per = " ".join(f"{t[-2:]}:{100*win[seas == t].mean():.0f}"
                   for t in sorted(set(seas)) if (seas == t).sum() >= 25)
    return dict(n=int(m.sum()), win=100 * win.mean(), base=100 * base,
                edge=100 * (win.mean() - base), roi=100 * roi, per=per,
                p=float((nul >= win.mean()).mean()))


def usable(G, sig, mkt):
    ycol, ppos, pneg, _ = MARKETS[mkt]
    y = pd.to_numeric(G[ycol], errors="coerce").to_numpy(float)
    dp = np.asarray(to_dec(G[ppos]), dtype=float)
    dn = np.asarray(to_dec(G[pneg]), dtype=float)
    s = pd.to_numeric(sig, errors="coerce").to_numpy(float)
    return np.isfinite(y) & (y != 0) & np.isfinite(dp) & np.isfinite(dn) & np.isfinite(s) & (s != 0)


def ladder(G, C, L):
    L += ["## 1. The dose ladder — does the correction grow with the luck?", "",
          "Top X% by |combined shooting luck|; the lucky tail is bet UNDER, the unlucky tail "
          "OVER. `edge` is against this slice's own baseline, `p` is the chance that baseline "
          "throws this win rate at this bet count.", "",
          "| composite | market | top % | n | win % | base % | edge | ROI % | p | by season |",
          "|---|---|---|---|---|---|---|---|---|---|"]
    for name in ("shooting luck", "all luck", "RATE control"):
        key = "s::" + name
        for mkt in TOTAL_MARKETS:
            ok = usable(G, C[key], mkt)
            s = pd.to_numeric(C[key], errors="coerce").to_numpy(float)
            for f in FRACS:
                thr = np.nanquantile(np.abs(s[ok]), 1 - f)
                m = ok & (np.abs(s) >= thr)
                if m.sum() < 60:
                    continue
                r = grade(G, C[key], mkt, m)
                L.append(f"| {name} | {mkt} | {int(f*100)} | {r['n']} | {r['win']:.1f} | "
                         f"{r['base']:.1f} | **{r['edge']:+.1f}** | {r['roi']:+.1f} | "
                         f"{r['p']:.3f} | {r['per']} |")
        L.append("")


def direction(G, C, L):
    L += ["## 2. Direction control — back the OVER on the same games", "",
          "Same selection, opposite side. Unders and overs are near-mirror bets, so this is "
          "close to arithmetic; it is here to catch a sample where unders simply won.", "",
          "| market | top % | betting UNDER-side ROI | betting OVER-side ROI |",
          "|---|---|---|---|"]
    key = "s::shooting luck"
    for mkt in TOTAL_MARKETS:
        ok = usable(G, C[key], mkt)
        s = pd.to_numeric(C[key], errors="coerce").to_numpy(float)
        for f in (0.33, 0.20):
            thr = np.nanquantile(np.abs(s[ok]), 1 - f)
            m = ok & (np.abs(s) >= thr)
            a, b = grade(G, C[key], mkt, m), grade(G, C[key], mkt, m, flip=True)
            L.append(f"| {mkt} | {int(f*100)} | {a['roi']:+.1f} | {b['roi']:+.1f} |")
    L.append("")


def walkforward(G, C, L):
    """Thresholds from strictly prior seasons. This is the only number that counts."""
    L += ["## 3. Walk-forward — thresholds from prior seasons only", "",
          "For each test season the cut is the quantile of |luck| computed on earlier seasons "
          "ONLY and applied blind. Every number above used all four seasons at once; this one "
          "does not, and it is the only one that can be called a result.", "",
          "| composite | market | top % | OOS n | win % | base % | edge | ROI % | by season |",
          "|---|---|---|---|---|---|---|---|---|"]
    seasons = sorted(G["season"].astype(str).unique())
    for name in ("shooting luck", "RATE control"):
        key = "s::" + name
        s = pd.to_numeric(C[key], errors="coerce").to_numpy(float)
        for mkt in TOTAL_MARKETS:
            ok = usable(G, C[key], mkt)
            for f in (0.33, 0.20):
                m = np.zeros(len(G), bool)
                sea = G["season"].astype(str).to_numpy()
                for i, ts in enumerate(seasons):
                    if i == 0:
                        continue
                    tr = ok & np.isin(sea, seasons[:i])
                    if tr.sum() < 300:
                        continue
                    thr = np.nanquantile(np.abs(s[tr]), 1 - f)
                    m |= ok & (sea == ts) & (np.abs(s) >= thr)
                if m.sum() < 60:
                    continue
                r = grade(G, C[key], mkt, m)
                L.append(f"| {name} | {mkt} | {int(f*100)} | {r['n']} | {r['win']:.1f} | "
                         f"{r['base']:.1f} | **{r['edge']:+.1f}** | {r['roi']:+.1f} | "
                         f"{r['per']} |")
    L.append("")


def phase_wf(G, C, L, phase):
    L += ["## 4. Walk-forward, late season only", "",
          "Stage 2 put the FG-total edge at its largest with both teams 55+ games in. Same "
          "prior-seasons-only cut, restricted to that phase.", "",
          "| composite | market | top % | OOS n | win % | base % | edge | ROI % | by season |",
          "|---|---|---|---|---|---|---|---|---|"]
    seasons = sorted(G["season"].astype(str).unique())
    late = (phase == "late").to_numpy()
    for name in ("shooting luck", "RATE control"):
        key = "s::" + name
        s = pd.to_numeric(C[key], errors="coerce").to_numpy(float)
        for mkt in TOTAL_MARKETS:
            ok = usable(G, C[key], mkt) & late
            for f in (0.50, 0.33):
                m = np.zeros(len(G), bool)
                sea = G["season"].astype(str).to_numpy()
                for i, ts in enumerate(seasons):
                    if i == 0:
                        continue
                    tr = ok & np.isin(sea, seasons[:i])
                    if tr.sum() < 200:
                        continue
                    thr = np.nanquantile(np.abs(s[tr]), 1 - f)
                    m |= ok & (sea == ts) & (np.abs(s) >= thr)
                if m.sum() < 60:
                    continue
                r = grade(G, C[key], mkt, m)
                L.append(f"| {name} | {mkt} | {int(f*100)} | {r['n']} | {r['win']:.1f} | "
                         f"{r['base']:.1f} | **{r['edge']:+.1f}** | {r['roi']:+.1f} | "
                         f"{r['per']} |")
    L.append("")


def main():
    G = load()
    T = pd.read_parquet(os.path.join(ROOT, "data", "parquet", "nba_team_luck.parquet"))
    T["is_home"] = (pd.to_numeric(T["team_id"], errors="coerce")
                    == pd.to_numeric(T["home_team_id"], errors="coerce"))
    T = T.sort_values(["season", "team_id", "commence_time"])
    T["gp"] = T.groupby(["season", "team_id"]).cumcount()
    gp = T.pivot_table(index="event_id", columns="is_home", values="gp", aggfunc="first")
    gp.columns = ["a_gp", "h_gp"]
    G = G.merge(gp.reset_index(), on="event_id", how="left")
    phase = pd.cut(G[["a_gp", "h_gp"]].min(axis=1), [-1, 24, 54, 999],
                   labels=["early", "mid", "late"])

    C = build_composites(G, w=10)
    L = ["# NBA shooting-luck UNDER — the one stage-2 survivor, stress-tested", "",
         f"{len(G):,} games, 10-game trailing window. The rule: both teams' recent finishing "
         "measured against THEIR OWN expanding baselines, summed. High = both have been "
         "shooting over their heads = play the under.", ""]
    ladder(G, C, L)
    direction(G, C, L)
    walkforward(G, C, L)
    phase_wf(G, C, L, phase)

    path = os.path.join(ROOT, "NBA_LUCK_TOTALS_BRIEF.md")
    with open(path, "w") as f:
        f.write("\n".join(L) + "\n")
    print("\n".join(L))
    print(f"\nwrote {path}", flush=True)


if __name__ == "__main__":
    main()
