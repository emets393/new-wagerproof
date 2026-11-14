#!/usr/bin/env python3
"""NFL moneylines inside ±220 — the competitive games. Tickets and money there.

⛔ NFL ONLY.

Why restrict to short prices. Every moneyline read in this directory has come back
"the crowd side wins a lot" and been worthless, because the ML crowd sits on favourites
and favourites win outright. At -400 that statement is arithmetic, not insight. Capping
the price at ±220 (about a 69/31 game) strips the chalk out and asks the only version of
the question that can carry information: in genuinely competitive games, does the crowd's
moneyline lean beat the price?

★ AND THE COMPARISON IS THE PRICE, NOT 50%. A flat break-even is meaningless on a
moneyline. Every cell here is scored against the VIG-FREE IMPLIED PROBABILITY of the
exact side being backed, computed per game from both prices, and ROI is settled at the
real price rather than -110. A crowd side winning 58% at an average no-vig 59% is
LOSING, and against a 50% yardstick it would look like an edge.

    python3 nfl_short_ml.py [--cap 220]
"""
import argparse
import os

import numpy as np
import pandas as pd

from nfl_fade_oos import week_payload, wilson

NPERM = 4000
RNG = np.random.default_rng(20261016)


# np.where evaluates BOTH branches, so the unused one divides by zero at o == -100 and
# warns. Harmless to the result, but a warning you learn to ignore is a warning that
# hides the next real one — so each branch is computed only where it applies.
def implied(odds):
    """American price -> implied probability WITH vig."""
    o = np.asarray(odds, float)
    out = np.empty_like(o)
    neg = o < 0
    out[neg] = -o[neg] / (-o[neg] + 100.0)
    out[~neg] = 100.0 / (o[~neg] + 100.0)
    return out


def payout(odds):
    """Units won per 1 unit staked on a winner at this American price."""
    o = np.asarray(odds, float)
    out = np.empty_like(o)
    neg = o < 0
    out[neg] = 100.0 / -o[neg]
    out[~neg] = o[~neg] / 100.0
    return out


def frame(seasons):
    rows = []
    for season in seasons:
        for week in range(1, 19):
            try:
                d = week_payload(season, week)
            except Exception:
                continue
            for g in d.get("games") or []:
                if g.get("status") != "complete":
                    continue
                b = g.get("boxscore") or {}
                hp, ap = b.get("total_home_points"), b.get("total_away_points")
                if hp is None or ap is None or hp == ap:
                    continue
                ev = (((g.get("markets") or {}).get("15") or {}).get("event") or {})
                ml = ev.get("moneyline") or []
                h = next((o for o in ml if o["side"] == "home"), None)
                a = next((o for o in ml if o["side"] == "away"), None)
                if not h or not a or h.get("odds") is None or a.get("odds") is None:
                    continue
                bi = (a.get("bet_info") or {})
                tix = (bi.get("tickets") or {}).get("percent")
                mny = (bi.get("money") or {}).get("percent")
                if tix is None:
                    continue
                rows.append(dict(season=season, week=int(g["week"]),
                                 ml_home=float(h["odds"]), ml_away=float(a["odds"]),
                                 tix_away=float(tix),
                                 mny_away=float(mny) if mny is not None else np.nan,
                                 home_pts=int(hp), away_pts=int(ap),
                                 tickets=g.get("num_bets")))
    d = pd.DataFrame(rows)
    if d.empty:
        return d

    d["home_won"] = d.home_pts > d.away_pts
    # vig-free probabilities from the pair
    ih, ia = implied(d.ml_home), implied(d.ml_away)
    tot = ih + ia
    d["nv_home"], d["nv_away"] = ih / tot, ia / tot
    d["vig"] = tot - 1.0

    d["pub_away"] = d.tix_away > 50
    d = d[d.tix_away != 50].reset_index(drop=True)
    d["pub_pct"] = np.where(d.pub_away, d.tix_away, 100 - d.tix_away)
    d["pub_won"] = np.where(d.pub_away, ~d.home_won, d.home_won)
    d["pub_odds"] = np.where(d.pub_away, d.ml_away, d.ml_home)
    d["pub_nv"] = np.where(d.pub_away, d.nv_away, d.nv_home)       # the yardstick
    d["fav_away"] = d.ml_away < d.ml_home
    d["pub_on_fav"] = d.pub_away == d.fav_away
    d["fav_odds"] = np.where(d.fav_away, d.ml_away, d.ml_home)
    d["short"] = d.fav_odds.abs() <= 220                           # set by --cap below
    return d


def score(label, sub, ind=4, minn=25):
    """Win rate vs the no-vig yardstick, plus ROI at the real price."""
    n = len(sub)
    if n < minn:
        print(" " * ind + f"{label:<44} (thin, n={n})")
        return None
    k = int(sub.pub_won.sum())
    rate = k / n
    exp = sub.pub_nv.mean()
    lo, hi = wilson(k, n)
    units = np.where(sub.pub_won, payout(sub.pub_odds), -1.0).sum()
    roi = units / n
    edge = rate - exp
    print(" " * ind + f"{label:<44} {k}-{n - k:<5} {rate:>6.1%}  vs no-vig {exp:>5.1%}"
          f"  edge {edge:+5.1%}  roi {roi:+6.1%}  [{lo:.0%},{hi:.0%}]  n={n}")

    # ⛔ A cell that loses to its price is a WINNING FADE of the same size, and the fade
    # is the bet. Reporting only the named side once buried a 48-28 as "worse than dead".
    # Records are read from the BET'S side. On a moneyline the fade must be re-priced —
    # the other side's odds and its own no-vig number, never 100% minus this one's roi.
    if edge < 0:
        other = np.where(sub.pub_away, sub.ml_home, sub.ml_away)
        other_nv = 1.0 - sub.pub_nv
        fw = ~sub.pub_won
        k2 = int(fw.sum())
        u2 = np.where(fw, payout(other), -1.0).sum()
        lo2, hi2 = wilson(k2, n)
        print(" " * ind + f"{'  ^ FADE IT: ' + label:<44} {k2}-{n - k2:<5} "
              f"{k2 / n:>6.1%}  vs no-vig {other_nv.mean():>5.1%}  "
              f"edge {k2 / n - other_nv.mean():+5.1%}  roi {u2 / n:+6.1%}  "
              f"[{lo2:.0%},{hi2:.0%}]  n={n}")
    return dict(n=n, rate=rate, exp=exp, edge=edge, roi=roi)


def perm_p(sub, nperm=NPERM):
    """Is the crowd side beating its own price by more than chance?

    Null: keep each game's result and price, shuffle WHICH SIDE the crowd is on within
    (season, week). That asks whether the crowd's lean carries information, holding the
    slate's actual outcomes fixed.
    """
    if len(sub) < 25:
        return np.nan, np.nan, np.nan
    obs = sub.pub_won.mean() - sub.pub_nv.mean()
    away = sub.pub_away.values.copy()
    hw, nva, nvh = sub.home_won.values, sub.nv_away.values, sub.nv_home.values
    wk = list(zip(sub.season.values, sub.week.values))
    uniq = {}
    for i, k in enumerate(wk):
        uniq.setdefault(k, []).append(i)
    null = []
    for _ in range(nperm):
        a = away.copy()
        for idx in uniq.values():
            if len(idx) > 1:
                a[idx] = RNG.permutation(a[idx])
        won = np.where(a, ~hw, hw)
        nv = np.where(a, nva, nvh)
        null.append(won.mean() - nv.mean())
    null = np.array(null)
    return obs, null.std(), (np.abs(null) >= abs(obs)).mean()


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--cap", type=float, default=220.0)
    ap.add_argument("--seasons", type=int, nargs="+", default=[2023, 2024, 2025, 2026])
    a = ap.parse_args()

    d = frame(a.seasons)
    d["short"] = d.fav_odds.abs() <= a.cap
    print(f"NFL moneylines {min(a.seasons)}-{max(a.seasons)}: {len(d)} decided games "
          f"(no pushes on an ML)")
    print(f"median vig {d.vig.median():.2%}\n")

    print("=" * 104)
    print(f"THE CUT — favourite priced inside ±{a.cap:.0f}")
    print("=" * 104)
    print(f"    short games: {int(d.short.sum())} of {len(d)} ({d.short.mean():.0%})")
    print(f"    crowd is on the favourite in {d[d.short].pub_on_fav.mean():.0%} of short "
          f"games vs {d[~d.short].pub_on_fav.mean():.0%} of the rest")
    print(f"    median crowd share  short {d[d.short].pub_pct.median():.0f}%   "
          f"long {d[~d.short].pub_pct.median():.0f}%\n")

    print("    scored against the VIG-FREE price of the side backed, not 50%:")
    score("ALL games — back the crowd's ML side", d)
    score(f"SHORT (fav >= -{a.cap:.0f}) — back the crowd", d[d.short])
    score(f"LONG  (fav <  -{a.cap:.0f}) — back the crowd", d[~d.short])
    # No hand-rolled "fade" row here — score() prints the fade of any cell that loses to
    # its price, correctly re-priced at the other side's odds. A hand-swapped row fed
    # back through that logic double-fades itself and prints a nonsense roi.
    s = d[d.short]
    obs, sd, p = perm_p(s)
    print(f"\n    permutation on the short cut: edge {obs:+.1%}, null sd {sd:.1%}, "
          f"p={p:.3f}  {'<-- LOOK' if p < 0.05 else '(noise)'}")

    print("\n" + "=" * 104)
    print(f"INSIDE THE SHORT CUT — by how lopsided the crowd is")
    print("=" * 104)
    for lo, hi in [(50, 55), (55, 60), (60, 65), (65, 70), (70, 101)]:
        score(f"crowd {lo}-{hi - 1}%", s[(s.pub_pct >= lo) & (s.pub_pct < hi)], ind=4)

    print("\n" + "=" * 104)
    print("INSIDE THE SHORT CUT — dog vs favourite, and money vs tickets")
    print("=" * 104)
    score("crowd on the FAVOURITE", s[s.pub_on_fav])
    score("crowd on the DOG", s[~s.pub_on_fav])
    sm = s.dropna(subset=["mny_away"])
    gap = (sm.mny_away - sm.tix_away)
    flip = ((sm.tix_away > 50) & (sm.mny_away < 50)) | ((sm.tix_away < 50) & (sm.mny_away > 50))
    mon_away = sm.mny_away > 50
    mflip = sm.assign(pub_away=mon_away,
                      pub_won=np.where(mon_away, ~sm.home_won, sm.home_won),
                      pub_odds=np.where(mon_away, sm.ml_away, sm.ml_home),
                      pub_nv=np.where(mon_away, sm.nv_away, sm.nv_home))
    score("FLIP — back the money side", mflip[flip.values])
    for lo, hi in [(0, 10), (10, 20), (20, 101)]:
        m = (gap.abs() >= lo) & (gap.abs() < hi)
        score(f"TILT back money, gap {lo}-{hi if hi < 101 else '+'}", mflip[m.values])

    print("\n" + "=" * 104)
    print("SEASON LEDGER — the short cut, back the crowd")
    print("=" * 104)
    for season, g in s.groupby("season"):
        score(f"{season}", g, minn=15)

    print("\n⛔ A moneyline cell beats nothing unless it beats the no-vig column next to "
          "it.\n   Rate alone is the blind-favourite trap this file exists to avoid.")


if __name__ == "__main__":
    main()
