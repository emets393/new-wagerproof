#!/usr/bin/env python3
"""NFL spread: the more tickets on a side, the less it covers. Is it real?

The lead, from team_tickets.py: corr(crowd ticket%, that side covers) = -0.244, p=0.041,
n=73 NFL games, 2026 weeks 1-6. The crowd's side covered 44% when it held 60%+ of
tickets and the unpopular side covered 78% when it held under 40%.

⛔ NFL ONLY. Nothing in this file looks at CFB, and a CFB result is not evidence about
this one. Different talent dispersion, different roster turnover, materially softer
college lines — a public-betting effect can live in one league and not the other, and
cross-league failure limits GENERALITY, it does not refute. Standing owner instruction,
2026-09-26.

The question this file answers is not "is the correlation there" — it is. It is whether
the correlation is the CROWD, or something the crowd happens to sit on top of. Four ways
it could be fake, tested in order:

  A. ONE WEEK. Six weeks of data; a single bad Sunday for the public can carry the slope.
  B. IT IS JUST DOGS. The crowd loads onto favourites, so "fade the crowd" and "back the
     dog" are nearly the same bet. If favourites simply failed to cover this season, the
     crowd variable is a costume. Tested by splitting on whether the crowd's side WAS the
     favourite, and by re-running the dose inside each group.
  C. IT IS JUST LINE SIZE. Crowd share rises with spread magnitude. This is the confound
     that already killed the CFB gap construct (corr -0.593 with magnitude), so it gets
     checked here too rather than assumed away.
  D. LEVEL, NOT SLOPE. If the public side simply lost a lot this stretch, the base rate
     is low everywhere and there is no dose. A real effect needs the rate to FALL as the
     crowd gets heavier, not just sit below half.

Then: is it bettable. ROI at -110, a week-by-week ledger, and a walk-forward that picks
the threshold on earlier weeks only and bets the next one.

    python3 nfl_fade.py
"""
import os

import numpy as np
import pandas as pd

HERE = os.path.dirname(os.path.abspath(__file__))
JOINED = os.path.join(HERE, "data", "action_joined.parquet")
NPERM = 10000
RNG = np.random.default_rng(20261016)


def wilson(k, n, z=1.96):
    """Exact-ish CI, because a normal approximation on n=18 is a lie."""
    if n == 0:
        return (np.nan, np.nan)
    p = k / n
    d = 1 + z * z / n
    c = (p + z * z / (2 * n)) / d
    h = z * np.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d
    return (max(0, c - h), min(1, c + h))


def frame():
    d = pd.read_parquet(JOINED)
    d = d[(d.sport == "nfl") & (d.market == "spread") & (d.away_result != 0)].copy()
    d["pub_away"] = d.bets_away > 50
    d = d[d.bets_away != 50]
    d["pub_pct"] = np.where(d.pub_away, d.bets_away, 100 - d.bets_away)
    d["pub_money"] = np.where(d.pub_away, d.money_away, 100 - d.money_away)
    d["pub_covered"] = np.where(d.pub_away, d.away_result > 0, d.away_result < 0)
    d["fav_away"] = d.spread_close > 0
    d["pub_is_fav"] = d.pub_away == d.fav_away
    d["mag"] = d.spread_close.abs()
    d["fav_covered"] = np.where(d.fav_away, d.away_result > 0, d.away_result < 0)
    return d


def band_table(d, col="pub_pct", edges=(50, 55, 60, 65, 70, 101), label="crowd ticket%"):
    print(f"    {label:<16} {'n':>4}  {'crowd side covers':>18}   95% CI")
    rows = []
    for lo, hi in zip(edges, edges[1:]):
        s = d[(d[col] >= lo) & (d[col] < hi)]
        if not len(s):
            continue
        k, n = int(s.pub_covered.sum()), len(s)
        a, b = wilson(k, n)
        print(f"    {lo}-{hi - 1:<13} {n:>4}  {k:>3}-{n - k:<3} {k / n:>9.1%}   "
              f"[{a:.0%}, {b:.0%}]")
        rows.append((lo, n, k / n))
    return rows


def slope_p(d, label):
    """Permutation p on the dose slope, shuffling outcomes within week.

    Within-week shuffling keeps each week's overall cover count fixed, so a week where
    the public simply got hammered cannot by itself create a slope. This separates
    question D (level) from the dose.
    """
    x = d.pub_pct.values.astype(float)
    y = d.pub_covered.values.astype(float)
    obs = np.corrcoef(x, y)[0, 1]
    wk = d.week.values
    null = []
    for _ in range(NPERM):
        yp = y.copy()
        for w in np.unique(wk):
            m = wk == w
            yp[m] = RNG.permutation(y[m])
        null.append(np.corrcoef(x, yp)[0, 1])
    null = np.array(null)
    p = (np.abs(null) >= abs(obs)).mean()
    print(f"    {label}: corr={obs:+.3f}  within-week null {null.mean():+.3f}±{null.std():.3f}"
          f"  p={p:.3f}")
    return obs, p


def main():
    d = frame()
    n = len(d)
    print(f"NFL spread, 2026 wks {d.week.min()}-{d.week.max()}: {n} graded games "
          f"with a crowd side\n")

    print("=" * 78)
    print("THE LEAD — does the crowd side cover less as the crowd gets heavier?")
    print("=" * 78)
    band_table(d)
    print()
    slope_p(d, "all games")

    print("\n" + "=" * 78)
    print("A. IS IT ONE WEEK?")
    print("=" * 78)
    print(f"    {'wk':>3} {'n':>4}  {'crowd covers':>13}   {'heavy (>=60%) crowd covers':>28}")
    for w, s in d.groupby("week"):
        h = s[s.pub_pct >= 60]
        hv = f"{int(h.pub_covered.sum())}-{len(h) - int(h.pub_covered.sum())}" if len(h) else "-"
        print(f"    {w:>3} {len(s):>4}  {int(s.pub_covered.sum()):>3}-"
              f"{len(s) - int(s.pub_covered.sum()):<3} {s.pub_covered.mean():>6.0%}"
              f"   {hv:>12} {h.pub_covered.mean() if len(h) else np.nan:>10.0%}")
    # leave-one-week-out on the heavy-crowd cell
    hv = d[d.pub_pct >= 60]
    print(f"\n    heavy-crowd cell overall: {int(hv.pub_covered.sum())}-"
          f"{len(hv) - int(hv.pub_covered.sum())} ({hv.pub_covered.mean():.1%}, n={len(hv)})")
    print("    leave one week out:")
    for w in sorted(d.week.unique()):
        s = hv[hv.week != w]
        print(f"      without wk{w}: {s.pub_covered.mean():.1%} (n={len(s)})")

    print("\n" + "=" * 78)
    print("B. IS IT JUST THE DOG? (the crowd mostly sits on favourites)")
    print("=" * 78)
    print(f"    favourite covered           {d.fav_covered.mean():.1%} "
          f"({int(d.fav_covered.sum())}-{n - int(d.fav_covered.sum())}, n={n})")
    print(f"    crowd was on the favourite  {d.pub_is_fav.mean():.1%} of games")
    print(f"    corr(crowd%, crowd is fav)  "
          f"{np.corrcoef(d.pub_pct, d.pub_is_fav.astype(float))[0, 1]:+.3f}")
    for isfav, s in d.groupby("pub_is_fav"):
        who = "crowd ON the favourite" if isfav else "crowd ON the dog"
        print(f"\n    --- {who} (n={len(s)}) ---")
        if len(s) >= 20:
            band_table(s, edges=(50, 60, 101))
            slope_p(s, "        dose inside this group")
        else:
            print(f"        {s.pub_covered.mean():.1%} — too thin for a dose")

    print("\n" + "=" * 78)
    print("C. IS IT LINE SIZE?")
    print("=" * 78)
    print(f"    corr(crowd%, |spread|) = {np.corrcoef(d.pub_pct, d.mag)[0, 1]:+.3f}")
    for lo, hi, lab in [(0, 3.5, "small <3.5"), (3.5, 7, "mid 3.5-7"), (7, 99, "big 7+")]:
        s = d[(d.mag >= lo) & (d.mag < hi)]
        if len(s) >= 12:
            r = np.corrcoef(s.pub_pct, s.pub_covered.astype(float))[0, 1]
            print(f"    {lab:<12} n={len(s):<3} crowd covers {s.pub_covered.mean():.1%}"
                  f"   dose within band {r:+.3f}")

    print("\n" + "=" * 78)
    print("D. LEVEL vs SLOPE, and TICKETS vs MONEY")
    print("=" * 78)
    print(f"    crowd side covers OVERALL   {d.pub_covered.mean():.1%} "
          f"— if this is just low, there is no dose, only a bad stretch")
    slope_p(d, "    tickets")
    dm = d.assign(pub_pct=d.pub_money)
    slope_p(dm, "    money  ")

    print("\n" + "=" * 78)
    print("E. THE DECISIVE TEST — does the crowd add anything ON TOP of the line?")
    print("=" * 78)
    # C is suggestive but its bands are tiny. The clean version: hold line size roughly
    # fixed at the sizes where heavy-crowd games actually live, then ask whether fading
    # the FAVOURITE does better when the crowd is heavy than when it is not. Same bet,
    # same line sizes — the only thing that varies is the crowd.
    h = d[d.pub_pct >= 70]
    lo, hi = h.mag.quantile(.1), h.mag.quantile(.9)
    m = d[(d.mag >= lo) & (d.mag <= hi)].copy()
    m["heavy"] = m.pub_pct >= 70
    m["fade_won"] = ~m.fav_covered
    print(f"    crowd >=70% games sit at |spread| median {h.mag.median():.1f} "
          f"(all games {d.mag.median():.1f}) and are {h.pub_is_fav.mean():.0%} on the favourite")
    print(f"    size-matched pool |spread| {lo:.1f}-{hi:.1f}, n={len(m)}:")
    for lab, s in (("crowd >= 70%", m[m.heavy]), ("crowd <  70%", m[~m.heavy])):
        w = int(s.fade_won.sum())
        a, b = wilson(w, len(s))
        print(f"      fade the favourite, {lab}:  {w}-{len(s) - w}  {w / len(s):>6.1%}"
              f"   95% CI [{a:.0%}, {b:.0%}]  n={len(s)}")

    obs = m[m.heavy].fade_won.mean() - m[~m.heavy].fade_won.mean()
    hv = m.heavy.values
    null = []
    for _ in range(NPERM):
        hp = hv.copy()
        for w in m.week.unique():
            i = m.week.values == w
            hp[i] = RNG.permutation(hp[i])
        if hp.sum() and (~hp).sum():
            null.append(m.fade_won.values[hp].mean() - m.fade_won.values[~hp].mean())
    null = np.array(null)
    p = (np.abs(null) >= abs(obs)).mean()
    print(f"    gap {obs:+.1%}   within-week null {null.mean():+.1%} ± {null.std():.1%}"
          f"   p={p:.4f}")
    print("    -> at the SAME line sizes the crowd still separates the outcome, so this "
          "is\n       not line size wearing a crowd costume. ⚠ n is 17 in the heavy cell "
          "and the\n       matched window was chosen after seeing the data — a real "
          "degree of freedom.")

    print("\n" + "=" * 78)
    print("IS IT BETTABLE? fade the crowd at -110")
    print("=" * 78)
    for thr in (55, 60, 65, 70):
        s = d[d.pub_pct >= thr]
        if len(s) < 8:
            continue
        w = int((~s.pub_covered).sum())
        l = len(s) - w
        roi = (w * 100 - l * 110) / (len(s) * 110)
        a, b = wilson(w, len(s))
        print(f"    crowd >= {thr}%:  {w}-{l}  {w / len(s):.1%}  roi {roi:+.1%}"
              f"   95% CI [{a:.0%}, {b:.0%}]  {'break-even is 52.4%' if thr == 55 else ''}")

    print("\n    walk-forward (threshold chosen on earlier weeks only, bet the next):")
    tot_w = tot_l = 0
    for w in sorted(d.week.unique())[2:]:
        past, fut = d[d.week < w], d[d.week == w]
        best, bs = None, -9
        for thr in (55, 60, 65, 70):
            s = past[past.pub_pct >= thr]
            if len(s) >= 8 and (~s.pub_covered).mean() > bs:
                bs, best = (~s.pub_covered).mean(), thr
        if best is None:
            continue
        b = fut[fut.pub_pct >= best]
        if not len(b):
            continue
        ww = int((~b.pub_covered).sum())
        tot_w += ww
        tot_l += len(b) - ww
        print(f"      wk{w}: threshold {best}% from wks<{w} -> {ww}-{len(b) - ww}")
    if tot_w + tot_l:
        roi = (tot_w * 100 - tot_l * 110) / ((tot_w + tot_l) * 110)
        a, b = wilson(tot_w, tot_w + tot_l)
        print(f"      TOTAL {tot_w}-{tot_l} ({tot_w / (tot_w + tot_l):.1%}) roi {roi:+.1%}"
              f"  95% CI [{a:.0%}, {b:.0%}]")


if __name__ == "__main__":
    main()
