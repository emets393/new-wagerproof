#!/usr/bin/env python3
"""NBA public-betting splits: the standard battery, across four seasons.

⛔ NBA ONLY. An NFL or CFB result is not evidence about any of this and vice versa —
different markets, different liquidity, different public. Cross-league failure limits
GENERALITY, it does not refute.

Run fetch_nba.py first; this reads data/nba_splits.parquet.

## What is asked

  1. base rates — home cover, over rate, favourite cover, per season
  2. fade the crowd, by how lopsided it is, in all three markets
  3. ★ money% minus tickets% — the sharp-money read — for spreads and totals
  4. back-to-backs, because it is the canonical NBA situational variable and the
     question worth asking is whether the CROWD misprices it, not whether it matters

## The two constructs in part 3, kept apart

  FLIP   ticket majority one side, money majority the other. Unambiguous, rarer.
  TILT   money% exceeds tickets% on a side without crossing 50 — what a "67% of bets
         but 81% of money" headline actually describes. Much more common, more power.

★ The DOSE is the test that matters. A real sharp-money effect must get STRONGER as the
divergence widens. That single check killed both football versions: on NFL spreads and
totals alike the gap bands ran 47.8/50.7/44.7/55.7/51.0 and 50.8/49.3/46.6/58.3/54.1 —
a pop at 15-20 that falls back at 20+, in both markets. Noise, not a threshold.

## Null

Permutation WITHIN SLATE DATE: each night keeps its actual number of covers and only
which game carries which result moves. This absorbs night-to-night variation in how the
league shot, which a comparison against 50% does not. Every cell is corrected best-of-N
across its family.

★ Context for anything that looks good: on NFL this same data produced a heavy-public
spread fade that was monotone, stable week to week, and passed a line-size control at
n=22 — and died at 53.0% across three prior seasons. Assume any hit here is that until
the season ledger says otherwise.

    python3 nba_study.py
"""
import argparse
import os

import numpy as np
import pandas as pd

HERE = os.path.dirname(os.path.abspath(__file__))
PARQUET = os.path.join(HERE, "data", "nba_splits.parquet")
NPERM = 2000
RNG = np.random.default_rng(20261016)
BREAK_EVEN = 0.524


def wilson(k, n, z=1.96):
    if n == 0:
        return (np.nan, np.nan)
    p, d = k / n, 1 + z * z / n
    c = (p + z * z / (2 * n)) / d
    h = z * np.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d
    return (max(0, c - h), min(1, c + h))


def rec(mask, won):
    n = int(np.sum(mask))
    if not n:
        return None
    k = int(np.sum(won[mask]))
    lo, hi = wilson(k, n)
    return dict(k=k, n=n, rate=k / n, lo=lo, hi=hi,
                roi=(k * 100 - (n - k) * 110) / (n * 110))


def show(label, r, ind=4, minn=40):
    if not r or r["n"] < minn:
        print(" " * ind + f"{label:<42} " + (f"(thin, n={r['n']})" if r else "—"))
        return
    star = " *" if r["lo"] > BREAK_EVEN else ""
    print(" " * ind + f"{label:<42} {r['k']}-{r['n'] - r['k']:<5} {r['rate']:>6.1%}"
          f"  [{r['lo']:.0%},{r['hi']:.0%}]  roi {r['roi']:+6.1%}  n={r['n']}{star}")


def season_ledger(d, mask, won, label, ind=6):
    print(" " * ind + f"{label}, season by season:")
    for s in sorted(d.season.unique()):
        m = mask & (d.season.values == s)
        if m.sum() >= 25:
            k, n = int(won[m].sum()), int(m.sum())
            print(" " * (ind + 2) + f"{s}: {k}-{n - k}  {k / n:5.1%}  (n={n})")


def family_p(d, cell_masks, outcome_fn, base_outcome):
    """best-of-N permutation, shuffling the raw outcome within slate date."""
    key = d.slate_date.values
    uniq = {}
    for i, k in enumerate(key):
        uniq.setdefault(k, []).append(i)

    def best(ov):
        won = outcome_fn(ov)
        devs = [abs(won[m].mean() - 0.5) for m in cell_masks if m.sum() >= 40]
        return max(devs) if devs else np.nan

    obs = best(base_outcome)
    null = []
    for _ in range(NPERM):
        ov = base_outcome.copy()
        for idx in uniq.values():
            if len(idx) > 1:
                ov[idx] = RNG.permutation(ov[idx])
        null.append(best(ov))
    null = np.array(null, float)
    null = null[~np.isnan(null)]
    return obs, null.mean(), null.std(), (null >= obs).mean()


def part_divergence(d, which):
    """money% minus tickets%, for one market."""
    if which == "spread":
        s = d[d.sp_ok].copy()
        tix, mny = s.tix_away.values, s.mny_away.values
        a_won = (~s.home_covered).values            # away side 'wins' = away covered
    else:
        s = d[d.ou_ok].copy()
        tix, mny = s.tix_over.values, s.mny_over.values
        a_won = s.over_hit.values
    ok = ~np.isnan(tix) & ~np.isnan(mny)
    s, tix, mny, a_won = s[ok], tix[ok], mny[ok], a_won[ok]

    gap = mny - tix
    money_a = gap > 0
    money_won = np.where(money_a, a_won, ~a_won)
    flip = ((tix > 50) & (mny < 50)) | ((tix < 50) & (mny > 50))
    flip_money_won = np.where(mny > 50, a_won, ~a_won)
    crowd_pct = np.where(tix > 50, tix, 100 - tix)

    print(f"\n  --- {which.upper()} divergence  (n={len(s)}) ---")
    print(f"      flips in {flip.mean():.1%} of games; median |gap| {np.median(np.abs(gap)):.0f} pts")
    print(f"      corr(signed gap, away/over wins) = {np.corrcoef(gap, a_won.astype(float))[0, 1]:+.3f}")
    masks = []
    for lo, hi in [(0, 5), (5, 10), (10, 15), (15, 20), (20, 101)]:
        m = (np.abs(gap) >= lo) & (np.abs(gap) < hi)
        masks.append(m)
        show(f"TILT back money, gap {lo}-{hi if hi < 101 else '+'}", rec(m, money_won), ind=6)
    show("FLIP back money", rec(flip, flip_money_won), ind=6)
    show("FLIP back tickets", rec(flip, ~flip_money_won), ind=6)
    show("back money, all games", rec(np.ones(len(s), bool), money_won), ind=6)
    masks += [flip, np.ones(len(s), bool)]

    def outcome_fn(ov):
        return np.where(money_a, ov, ~ov)

    obs, mu, sd, p = family_p(s, masks, outcome_fn, a_won)
    print(f"      FAMILY: best cell {obs * 100:.1f} pts off 50%; "
          f"within-night null {mu * 100:.1f} ± {sd * 100:.1f}   p={p:.3f}"
          f"   {'<-- SURVIVES' if p < 0.05 else '(noise)'}")
    season_ledger(s, flip, flip_money_won, "FLIP back money")
    return s, flip, flip_money_won


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.parse_args()

    d = pd.read_parquet(PARQUET)
    print(f"NBA splits: {len(d)} completed games, seasons "
          f"{sorted(d.season.unique())} (END-year labels)\n")

    print("=" * 96)
    print("1. BASE RATES")
    print("=" * 96)
    print(f"    {'season':<9}{'games':>7}{'home cover':>13}{'over':>9}"
          f"{'fav cover':>12}{'med tickets':>14}{'crowd share':>13}")
    for s, g in d.groupby("season"):
        sp, ou = g[g.sp_ok], g[g.ou_ok]
        print(f"    {s:<9}{len(g):>7}{sp.home_covered.mean():>12.1%}"
              f"{ou.over_hit.mean():>9.1%}{sp.fav_covered.mean():>12.1%}"
              f"{g.tickets.median():>14,.0f}{sp.pub_pct.median():>12.0f}%")
    sp = d[d.sp_ok]
    print(f"    {'ALL':<9}{len(d):>7}{sp.home_covered.mean():>12.1%}"
          f"{d[d.ou_ok].over_hit.mean():>9.1%}{sp.fav_covered.mean():>12.1%}")
    print(f"\n    the crowd is on the favourite in "
          f"{(sp.pub_away == sp.fav_away).mean():.1%} of games; "
          f"on the OVER in {(d[d.ou_ok].tix_over > 50).mean():.1%}")

    print("\n" + "=" * 96)
    print("2. FADE THE CROWD, by how lopsided it is")
    print(f"    (break-even {BREAK_EVEN:.1%}; * = 95% lower bound clears it)")
    print("=" * 96)
    for label, sub, pctcol, woncol in (
            ("SPREAD — crowd side covers", d[d.sp_ok], "pub_pct", "pub_covered"),
            ("TOTAL  — crowd side hits", d[d.ou_ok], "ou_pub_pct", "ou_pub_won")):
        print(f"\n  --- {label}  (n={len(sub)}) ---")
        won = sub[woncol].values
        masks = []
        for lo, hi in [(50, 55), (55, 60), (60, 65), (65, 70), (70, 80), (80, 101)]:
            m = ((sub[pctcol] >= lo) & (sub[pctcol] < hi)).values
            masks.append(m)
            show(f"crowd {lo}-{hi - 1}%", rec(m, won), ind=6)
        r = np.corrcoef(sub[pctcol], won.astype(float))[0, 1]
        print(f"      continuous corr(crowd%, crowd side wins) = {r:+.3f}")
        if woncol == "pub_covered":
            fn = lambda ov: np.where(sub.pub_away.values, ~ov, ov)   # ov = home_covered
            base = sub.home_covered.values
        else:
            fn = lambda ov: np.where(sub.pub_over.values, ov, ~ov)
            base = sub.over_hit.values
        obs, mu, sd, p = family_p(sub, masks, fn, base)
        print(f"      FAMILY: best cell {obs * 100:.1f} pts off 50%; null "
              f"{mu * 100:.1f} ± {sd * 100:.1f}   p={p:.3f}"
              f"   {'<-- SURVIVES' if p < 0.05 else '(noise)'}")

    ml = d[d.ml_ok]
    print(f"\n  --- MONEYLINE — crowd side wins outright  (n={len(ml)}) ---")
    print(f"      {ml.ml_pub_won.mean():.1%}  ⚠ not an edge by itself: the ML crowd sits "
          f"on favourites,\n      so this mostly restates that favourites win.")

    print("\n" + "=" * 96)
    print("3. ★ MONEY% MINUS TICKETS% — the sharp-money read")
    print("=" * 96)
    for which in ("spread", "total"):
        part_divergence(d, which)

    print("\n" + "=" * 96)
    print("4. BACK-TO-BACKS — does the CROWD misprice them?")
    print("=" * 96)
    # a team is on a B2B if it played the previous calendar day
    played = {}
    for _, r in d.iterrows():
        for t in (r.home_abbr, r.away_abbr):
            played.setdefault(t, set()).add(r.slate_date.normalize())
    prev = pd.Timedelta(days=1)
    d = d.assign(
        home_b2b=[r.slate_date.normalize() - prev in played.get(r.home_abbr, set())
                  for _, r in d.iterrows()],
        away_b2b=[r.slate_date.normalize() - prev in played.get(r.away_abbr, set())
                  for _, r in d.iterrows()])
    sp = d[d.sp_ok].copy()
    sp["only_home_b2b"] = sp.home_b2b & ~sp.away_b2b
    sp["only_away_b2b"] = sp.away_b2b & ~sp.home_b2b
    print(f"    home on a B2B in {sp.home_b2b.mean():.1%} of games, away in "
          f"{sp.away_b2b.mean():.1%}")
    show("rested side covers (one team on a B2B)",
         rec((sp.only_home_b2b | sp.only_away_b2b).values,
             np.where(sp.only_home_b2b, ~sp.home_covered, sp.home_covered)))
    show("crowd side covers when a B2B is involved",
         rec((sp.home_b2b | sp.away_b2b).values, sp.pub_covered.values))
    ou = d[d.ou_ok]
    show("over hits when either team is on a B2B",
         rec((ou.home_b2b | ou.away_b2b).values, ou.over_hit.values))
    show("over hits, no B2B", rec((~ou.home_b2b & ~ou.away_b2b).values, ou.over_hit.values))

    print("\n" + "=" * 96)
    print("5. ★ SHORT MONEYLINES — the competitive games, and the FLIP fade")
    print("=" * 96)
    short_ml(d, cap=220.0)

    print("\n⛔ Read the FAMILY line and the season ledger before believing any cell.")
    print("⛔ And read every record from the BET'S side: a 28-48 is a 48-28 fade.")


def implied(o):
    o = np.asarray(o, float)
    out = np.empty_like(o)
    neg = o < 0
    out[neg] = -o[neg] / (-o[neg] + 100.0)
    out[~neg] = 100.0 / (o[~neg] + 100.0)
    return out


def payout(o):
    o = np.asarray(o, float)
    out = np.empty_like(o)
    neg = o < 0
    out[neg] = 100.0 / -o[neg]
    out[~neg] = o[~neg] / 100.0
    return out


def ml_score(label, sub, ind=6, minn=40):
    """Win rate vs the VIG-FREE price of the side backed, plus roi at the real price.

    ⛔ Never score a moneyline against 50%. The ML crowd sits on favourites, so a rate
    alone restates that favourites win. And always print the FADE of a losing cell —
    a 28-48 is a 48-28, which is how the NFL version of this nearly got missed.
    """
    n = len(sub)
    if n < minn:
        print(" " * ind + f"{label:<44} (thin, n={n})")
        return
    k = int(sub.pub_won.sum())
    rate, exp = k / n, sub.pub_nv.mean()
    roi = np.where(sub.pub_won, payout(sub.pub_odds), -1.0).sum() / n
    lo, hi = wilson(k, n)
    print(" " * ind + f"{label:<44} {k}-{n - k:<5} {rate:>6.1%}  vs no-vig {exp:>5.1%}"
          f"  edge {rate - exp:+5.1%}  roi {roi:+6.1%}  [{lo:.0%},{hi:.0%}]  n={n}")
    if rate - exp < 0:
        other = np.where(sub.pub_away, sub.ml_home, sub.ml_away)
        onv = 1.0 - sub.pub_nv
        fw = ~sub.pub_won
        k2 = int(fw.sum())
        r2 = np.where(fw, payout(other), -1.0).sum() / n
        lo2, hi2 = wilson(k2, n)
        print(" " * ind + f"{'  ^ FADE IT: ' + label:<44} {k2}-{n - k2:<5} {k2 / n:>6.1%}"
              f"  vs no-vig {onv.mean():>5.1%}  edge {k2 / n - onv.mean():+5.1%}"
              f"  roi {r2:+6.1%}  [{lo2:.0%},{hi2:.0%}]  n={n}")


def short_ml(d, cap=220.0):
    m = d[d.ml_ok & d.ml_home.notna() & d.ml_away.notna()].copy()
    ih, ia = implied(m.ml_home), implied(m.ml_away)
    tot = ih + ia
    m["nv_home"], m["nv_away"] = ih / tot, ia / tot
    m["pub_away"] = m.tix_ml_away > 50
    m["pub_won"] = np.where(m.pub_away, ~m.home_won, m.home_won)
    m["pub_odds"] = np.where(m.pub_away, m.ml_away, m.ml_home)
    m["pub_nv"] = np.where(m.pub_away, m.nv_away, m.nv_home)
    m["pub_pct"] = np.where(m.pub_away, m.tix_ml_away, 100 - m.tix_ml_away)
    m["fav_odds"] = np.minimum(m.ml_home, m.ml_away)
    m["short"] = m.fav_odds.abs() <= cap
    print(f"    median vig {np.median(tot - 1):.2%};  short games "
          f"{int(m.short.sum())} of {len(m)} ({m.short.mean():.0%})\n")
    ml_score("ALL — back the crowd's ML side", m)
    ml_score(f"SHORT (fav >= -{cap:.0f}) — back the crowd", m[m.short])
    ml_score(f"LONG  (fav <  -{cap:.0f}) — back the crowd", m[~m.short])

    s = m[m.short].dropna(subset=["mny_ml_away"])
    flip = (((s.tix_ml_away > 50) & (s.mny_ml_away < 50))
            | ((s.tix_ml_away < 50) & (s.mny_ml_away > 50)))
    mon = s.mny_ml_away > 50
    fm = s.assign(pub_away=mon, pub_won=np.where(mon, ~s.home_won, s.home_won),
                  pub_odds=np.where(mon, s.ml_away, s.ml_home),
                  pub_nv=np.where(mon, s.nv_away, s.nv_home))
    print(f"\n    ★ the NFL standout, tested here: flips occur in {flip.mean():.1%} "
          f"of short games")
    ml_score("SHORT FLIP — back the money side", fm[flip.values])
    f = fm[flip.values]
    if len(f) >= 40:
        print("      season ledger (fade the money side):")
        for ss in sorted(f.season.unique()):
            g = f[f.season == ss]
            k = int((~g.pub_won).sum())
            other = np.where(g.pub_away, g.ml_home, g.ml_away)
            r = np.where(~g.pub_won, payout(other), -1.0).sum() / len(g)
            print(f"        {ss}: {k}-{len(g) - k}  {k / len(g):5.1%}  roi {r:+6.1%}"
                  f"  (n={len(g)})")
        # ⛔ correct null: a random side per game. NOT a within-stratum shuffle — on the
        # NFL version most strata held one game, the shuffle was near-identity, and it
        # manufactured a fake baseline that hid a real edge.
        hw, nva, nvh = f.home_won.values, f.nv_away.values, f.nv_home.values
        fade_away = ~f.pub_away.values
        obs = (np.where(fade_away, ~hw, hw).mean()
               - np.where(fade_away, nva, nvh).mean())
        null = np.array([(lambda a: np.where(a, ~hw, hw).mean()
                          - np.where(a, nva, nvh).mean())(RNG.random(len(f)) < 0.5)
                         for _ in range(20000)])
        print(f"      fade edge {obs:+.1%} vs random-side null {null.mean():+.1%} ± "
              f"{null.std():.1%}   p={(np.abs(null) >= abs(obs)).mean():.4f}")


if __name__ == "__main__":
    main()
