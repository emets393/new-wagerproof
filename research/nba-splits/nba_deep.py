#!/usr/bin/env python3
"""NBA depth pass: day of week, tip time, line movement, and per-market structure.

⛔ NBA ONLY. An NFL or CFB result is not evidence about anything here and vice versa.

The first battery (nba_study.py) asked the standard questions. This asks the ones the
data can actually support with 3,976 games, and covers the biggest gap in that pass:
the frame has carried OPENING lines all along and nothing had looked at movement.

## Parts

  1. DAY OF WEEK — NBA plays all seven, so this is a real question here in a way it
     is not in football. Volume, crowd lean, and all three markets per day.
  2. TIP WINDOW — ET tip, from Sunday afternoons to 10:30pm West Coast late games.
  3. ★ LINE MOVEMENT and REVERSE LINE MOVEMENT — the classic sharp read, untested
     until now. Does the side the line moved TOWARD cover? And the RLM case: the line
     moves AGAINST the public's side, which is supposed to be the strongest signal
     in public-betting folklore.
  4. SPREAD STRUCTURE — line size, and whether the crowd misprices road favourites
     or home dogs specifically.
  5. TOTAL STRUCTURE — by level of the total.
  6. MONEYLINE STRUCTURE — by price band, scored against the VIG-FREE price, never 50%.

## Discipline

Every part is a family. The null permutes outcomes WITHIN SLATE DATE, so a night where
the league shot the lights out cannot create a signal, and each part is corrected
best-of-N across its own cells. Records are read FROM THE BET'S SIDE — a sub-50% cell
prints its fade, because a 28-48 is a 48-28.

⛔ Two traps already paid for in this directory, both live here:
  - A cell that survives a family correction can still be a single thin bin. Check bin
    sizes and slide the edges before believing it. The 15-20 divergence band survived at
    p=0.011 and was one 109-game bin.
  - Never score a moneyline against 50%. The ML crowd sits on favourites.

    python3 nba_deep.py
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

DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
WINDOWS = [("afternoon <7pm", 0, 19), ("7-7:59pm", 19, 20), ("8-9:59pm", 20, 22),
           ("10pm+ (west)", 22, 24)]


def wilson(k, n, z=1.96):
    if n == 0:
        return (np.nan, np.nan)
    p, d = k / n, 1 + z * z / n
    c = (p + z * z / (2 * n)) / d
    h = z * np.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d
    return (max(0, c - h), min(1, c + h))


def line(label, won, mask=None, ind=6, minn=60, flat=True):
    """Print a cell from the winning side. `flat` = -110 pricing."""
    w = won if mask is None else won[mask]
    n = len(w)
    if n < minn:
        print(" " * ind + f"{label:<34} (thin, n={n})")
        return None
    k = int(np.sum(w))
    rate = k / n
    # report the better side; a sub-50% cell is a winning fade
    if rate < 0.5:
        k, rate, label = n - k, 1 - rate, f"FADE {label}"
    lo, hi = wilson(k, n)
    roi = (k * 100 - (n - k) * 110) / (n * 110) if flat else np.nan
    star = " *" if lo > BREAK_EVEN else ""
    print(" " * ind + f"{label:<34} {k}-{n - k:<5} {rate:>6.1%}  [{lo:.0%},{hi:.0%}]"
          + (f"  roi {roi:+6.1%}" if flat else "") + f"  n={n}{star}")
    return dict(n=n, rate=rate, dev=abs(rate - 0.5))


def family(d, masks, base, flip_fn, label):
    """best-of-N across a part's cells; null permutes the outcome within slate date."""
    idx_by_day = {}
    for i, k in enumerate(d.slate_date.values):
        idx_by_day.setdefault(k, []).append(i)

    def best(ov):
        won = flip_fn(ov)
        devs = [abs(won[m].mean() - 0.5) for m in masks if m.sum() >= 60]
        return max(devs) if devs else np.nan

    obs = best(base)
    null = []
    for _ in range(NPERM):
        ov = base.copy()
        for ix in idx_by_day.values():
            if len(ix) > 1:
                ov[ix] = RNG.permutation(ov[ix])
        null.append(best(ov))
    null = np.array(null, float)
    null = null[~np.isnan(null)]
    p = (null >= obs).mean()
    print(f"      FAMILY [{label}]: best {obs * 100:.1f} pts off 50%; null "
          f"{null.mean() * 100:.1f} ± {null.std() * 100:.1f}  p={p:.3f}"
          f"  {'<-- SURVIVES' if p < 0.05 else '(noise)'}")


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


def main():
    argparse.ArgumentParser(description=__doc__,
                            formatter_class=argparse.RawDescriptionHelpFormatter).parse_args()
    d = pd.read_parquet(PARQUET)
    # tip time in ET; start_time is UTC
    d["tip_et"] = pd.to_datetime(d.tip_utc, utc=True).dt.tz_convert("US/Eastern").dt.tz_localize(None)
    d["dow"] = d.tip_et.dt.dayofweek
    d["hour"] = d.tip_et.dt.hour
    sp = d[d.sp_ok].reset_index(drop=True)
    ou = d[d.ou_ok].reset_index(drop=True)
    print(f"NBA depth pass: {len(d)} games  (spread {len(sp)}, totals {len(ou)})\n")

    # ---------- 1. DAY OF WEEK ----------
    print("=" * 94)
    print("1. DAY OF WEEK")
    print("=" * 94)
    print(f"  {'day':<6}{'games':>7}{'med tix':>10}{'crowd%':>9}{'home cover':>12}"
          f"{'over':>8}{'crowd covers':>14}{'crowd tot hits':>16}")
    for i, nm in enumerate(DAYS):
        g, t = sp[sp.dow == i], ou[ou.dow == i]
        if not len(g):
            continue
        print(f"  {nm:<6}{len(g):>7}{g.tickets.median():>10,.0f}{g.pub_pct.median():>8.0f}%"
              f"{g.home_covered.mean():>12.1%}{t.over_hit.mean():>8.1%}"
              f"{g.pub_covered.mean():>14.1%}{t.ou_pub_won.mean():>16.1%}")
    print()
    masks = [(sp.dow == i).values for i in range(7)]
    for i, nm in enumerate(DAYS):
        line(f"{nm} — crowd's spread side", sp.pub_covered.values, masks[i])
    family(sp, masks, sp.home_covered.values,
           lambda ov: np.where(sp.pub_away.values, ~ov, ov), "dow spread")
    print()
    om = [(ou.dow == i).values for i in range(7)]
    for i, nm in enumerate(DAYS):
        line(f"{nm} — over", ou.over_hit.values, om[i])
    family(ou, om, ou.over_hit.values, lambda ov: ov, "dow over")

    # ---------- 2. TIP WINDOW ----------
    print("\n" + "=" * 94)
    print("2. TIP WINDOW (ET)")
    print("=" * 94)
    print(f"  {'window':<16}{'games':>7}{'med tix':>10}{'crowd%':>9}{'home cover':>12}"
          f"{'over':>8}{'crowd covers':>14}")
    sw, ow = [], []
    for nm, lo, hi in WINDOWS:
        g = sp[(sp.hour >= lo) & (sp.hour < hi)]
        t = ou[(ou.hour >= lo) & (ou.hour < hi)]
        sw.append(((sp.hour >= lo) & (sp.hour < hi)).values)
        ow.append(((ou.hour >= lo) & (ou.hour < hi)).values)
        if len(g):
            print(f"  {nm:<16}{len(g):>7}{g.tickets.median():>10,.0f}"
                  f"{g.pub_pct.median():>8.0f}%{g.home_covered.mean():>12.1%}"
                  f"{t.over_hit.mean():>8.1%}{g.pub_covered.mean():>14.1%}")
    print()
    for (nm, _l, _h), m in zip(WINDOWS, sw):
        line(f"{nm} — crowd's spread side", sp.pub_covered.values, m)
    family(sp, sw, sp.home_covered.values,
           lambda ov: np.where(sp.pub_away.values, ~ov, ov), "tip spread")
    print()
    for (nm, _l, _h), m in zip(WINDOWS, ow):
        line(f"{nm} — over", ou.over_hit.values, m)
    family(ou, ow, ou.over_hit.values, lambda ov: ov, "tip over")

    # ---------- 3. LINE MOVEMENT + RLM ----------
    print("\n" + "=" * 94)
    print("3. ★ LINE MOVEMENT and REVERSE LINE MOVEMENT")
    print("=" * 94)
    s = sp[sp.home_spread_open.notna()].reset_index(drop=True)
    # home-perspective: more negative = home favoured harder, so move<0 = toward HOME
    s["move"] = s.home_spread - s.home_spread_open
    s["moved_home"] = s.move < 0
    s["moved_away"] = s.move > 0
    s["still"] = s.move == 0
    print(f"    {len(s)} games with an opener; line moved in "
          f"{(~s.still).mean():.0%}, median |move| {s.move.abs().median():.1f}")
    print(f"    crowd on away in {s.pub_away.mean():.0%}; "
          f"line moved toward the crowd in "
          f"{((s.pub_away & s.moved_away) | (~s.pub_away & s.moved_home)).mean():.0%} "
          f"of moved games")
    print()
    mv = s[~s.still].reset_index(drop=True)
    line("back the side the line moved TOWARD",
         np.where(mv.moved_home.values, mv.home_covered.values, (~mv.home_covered).values))
    # RLM: line moves against the public's side
    rlm = ((mv.pub_away & mv.moved_home) | (~mv.pub_away & mv.moved_away)).values
    print(f"      RLM (line moves AGAINST the crowd) in {rlm.mean():.0%} of moved games")
    line("RLM — back the LINE (fade the crowd)",
         np.where(mv.moved_home.values, mv.home_covered.values, (~mv.home_covered).values),
         rlm)
    line("line WITH the crowd — back them",
         mv.pub_covered.values, ~rlm)
    print("\n      RLM by size of the move:")
    rl_masks = []
    for lo, hi in [(0.5, 1.5), (1.5, 2.5), (2.5, 4.0), (4.0, 99)]:
        m = rlm & (mv.move.abs() >= lo).values & (mv.move.abs() < hi).values
        rl_masks.append(m)
        line(f"  RLM move {lo}-{hi if hi < 99 else '+'}",
             np.where(mv.moved_home.values, mv.home_covered.values,
                      (~mv.home_covered).values), m)
    print("\n      RLM by how heavy the crowd is:")
    for lo, hi in [(50, 60), (60, 70), (70, 101)]:
        m = rlm & (mv.pub_pct >= lo).values & (mv.pub_pct < hi).values
        rl_masks.append(m)
        line(f"  RLM crowd {lo}-{hi - 1}%",
             np.where(mv.moved_home.values, mv.home_covered.values,
                      (~mv.home_covered).values), m)
    family(mv, rl_masks + [rlm], mv.home_covered.values,
           lambda ov: np.where(mv.moved_home.values, ov, ~ov), "RLM")

    # totals RLM
    t = ou[ou.total_open.notna()].reset_index(drop=True)
    t["tmove"] = t.total_line - t.total_open
    tm = t[t.tmove != 0].reset_index(drop=True)
    trlm = ((tm.pub_over & (tm.tmove < 0)) | (~tm.pub_over & (tm.tmove > 0))).values
    print(f"\n      TOTALS: {len(tm)} games with a moved total; RLM in {trlm.mean():.0%}")
    line("total moved UP — over", tm.over_hit.values, (tm.tmove > 0).values)
    line("total moved DOWN — under", (~tm.over_hit).values, (tm.tmove < 0).values)
    line("totals RLM — back the LINE",
         np.where(tm.tmove.values > 0, tm.over_hit.values, (~tm.over_hit).values), trlm)

    # ---------- 4. SPREAD STRUCTURE ----------
    print("\n" + "=" * 94)
    print("4. SPREAD STRUCTURE")
    print("=" * 94)
    sm = []
    for lo, hi in [(0, 3), (3, 6), (6, 9), (9, 12), (12, 99)]:
        m = ((sp.mag >= lo) & (sp.mag < hi)).values
        sm.append(m)
        line(f"|spread| {lo}-{hi if hi < 99 else '+'} — crowd's side",
             sp.pub_covered.values, m)
    road_fav = (sp.fav_away & sp.pub_away).values
    home_dog = ((~sp.fav_away) & sp.pub_away).values
    print()
    line("crowd on a ROAD favourite", sp.pub_covered.values, road_fav)
    line("crowd on a HOME favourite", sp.pub_covered.values,
         ((~sp.fav_away) & ~sp.pub_away).values)
    line("crowd on a ROAD dog", sp.pub_covered.values,
         ((~sp.fav_away) & sp.pub_away).values)
    line("crowd on a HOME dog", sp.pub_covered.values, (sp.fav_away & ~sp.pub_away).values)
    family(sp, sm + [road_fav, home_dog], sp.home_covered.values,
           lambda ov: np.where(sp.pub_away.values, ~ov, ov), "spread structure")

    # ---------- 5. TOTAL STRUCTURE ----------
    print("\n" + "=" * 94)
    print("5. TOTAL STRUCTURE")
    print("=" * 94)
    tmk = []
    for lo, hi in [(0, 215), (215, 225), (225, 232), (232, 240), (240, 999)]:
        m = ((ou.total_line >= lo) & (ou.total_line < hi)).values
        tmk.append(m)
        line(f"total {lo}-{hi if hi < 999 else '+'} — over", ou.over_hit.values, m)
    family(ou, tmk, ou.over_hit.values, lambda ov: ov, "total structure")

    # ---------- 6. MONEYLINE STRUCTURE ----------
    print("\n" + "=" * 94)
    print("6. MONEYLINE STRUCTURE — scored vs the VIG-FREE price, never 50%")
    print("=" * 94)
    m = d[d.ml_ok & d.ml_home.notna() & d.ml_away.notna()].copy()
    ih, ia = implied(m.ml_home), implied(m.ml_away)
    tot = ih + ia
    m["nv_home"], m["nv_away"] = ih / tot, ia / tot
    m["pub_away"] = m.tix_ml_away > 50
    m["pub_won"] = np.where(m.pub_away, ~m.home_won, m.home_won)
    m["pub_odds"] = np.where(m.pub_away, m.ml_away, m.ml_home)
    m["pub_nv"] = np.where(m.pub_away, m.nv_away, m.nv_home)
    m["fav_odds"] = np.minimum(m.ml_home, m.ml_away)
    print(f"  {'price band':<22}{'n':>6}{'crowd wins':>12}{'no-vig':>9}{'edge':>8}{'roi':>9}")
    for lo, hi, nm in [(100, 130, "pick'em to -130"), (130, 170, "-130 to -170"),
                       (170, 220, "-170 to -220"), (220, 320, "-220 to -320"),
                       (320, 10000, "-320 or longer")]:
        g = m[(m.fav_odds.abs() >= lo) & (m.fav_odds.abs() < hi)]
        if len(g) < 60:
            continue
        rate, exp = g.pub_won.mean(), g.pub_nv.mean()
        roi = np.where(g.pub_won, payout(g.pub_odds), -1.0).sum() / len(g)
        print(f"  {nm:<22}{len(g):>6}{rate:>12.1%}{exp:>9.1%}{rate - exp:>+8.1%}{roi:>+9.1%}")
    print("\n  crowd on the DOG, by the dog's price:")
    dog = m[m.pub_away != (m.ml_away < m.ml_home)]
    for lo, hi, nm in [(100, 150, "+100 to +150"), (150, 220, "+150 to +220"),
                       (220, 400, "+220 to +400"), (400, 10000, "+400 or longer")]:
        g = dog[(dog.pub_odds >= lo) & (dog.pub_odds < hi)]
        if len(g) < 60:
            continue
        rate, exp = g.pub_won.mean(), g.pub_nv.mean()
        roi = np.where(g.pub_won, payout(g.pub_odds), -1.0).sum() / len(g)
        print(f"  {nm:<22}{len(g):>6}{rate:>12.1%}{exp:>9.1%}{rate - exp:>+8.1%}{roi:>+9.1%}")

    print("\n⛔ A surviving family is a lead, not a finding. Slide the bin edges and "
          "check the\n   bin is not the thinnest one before believing it.")


if __name__ == "__main__":
    main()
