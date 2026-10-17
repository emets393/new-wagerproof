#!/usr/bin/env python3
"""NFL by kickoff slot — primetime, Sunday windows, standalone games. 2023-2026.

With four seasons pulled from Action Network (~1,050 graded games) there is finally
enough to ask slot questions with real power, which 2026 alone never had.

⛔ NFL ONLY. A CFB result is not evidence about any of this and vice versa.

## What a "slot" is

Taken from the payload, not guessed: `start_time` gives the ET kickoff and
`broadcast.network` names the carrier, so a standalone national game is identified by
BOTH its time and the fact that one network has it alone.

    TNF          Thursday
    Sun early    Sunday 13:00 ET
    Sun late     Sunday 16:00-16:30 ET
    SNF          Sunday 19:00+ ET
    MNF          Monday
    other        international morning kicks, Saturday, holidays

## What is asked, per slot

Four pre-registered outcomes: the crowd's spread side covers, the favourite covers, the
over hits, the crowd's totals side hits. Plus descriptives — ticket volume and how heavy
the crowd gets — because "primetime draws more public money onto favourites" is the
folk claim and it is worth checking whether it is even true before testing what it does.

## The null

⛔ Not 50%. Slots differ in line size, team quality and week composition, and a slate has
a fixed number of covers in it. So the null PERMUTES THE SLOT LABEL WITHIN (season, week),
keeping each week's games and results fixed and only moving which game sat in which
window. Every cell is then corrected against the BEST-OF-N across the whole family,
because 6 slots x 4 outcomes is 24 chances to find something.

★ This is the discipline the heavy-public fade failed. That one looked clean in sample —
monotone dose, stable weekly, passed a line-size control — and died on three prior
seasons. Everything here is scored across four seasons from the start, and any cell that
does not hold up season by season is noise regardless of its pooled number.

    python3 nfl_slots.py [--seasons 2023 2024 2025 2026]
"""
import argparse
import os

import numpy as np
import pandas as pd

import nfl_fade_oos as OOS
from nfl_fade_oos import week_payload, wilson

NPERM = 3000
RNG = np.random.default_rng(20261016)

SLOT_ORDER = ["TNF", "Sun early", "Sun late", "SNF", "MNF", "other"]


def slot_of(ts):
    """ET kickoff -> window label."""
    wd, h = ts.dayofweek, ts.hour          # Mon=0
    if wd == 3:
        return "TNF"
    if wd == 0:
        return "MNF"
    if wd == 6:
        if h < 12:
            return "other"                 # London / Germany morning kicks
        if h < 15:
            return "Sun early"
        if h < 18:
            return "Sun late"
        return "SNF"
    return "other"


def market_rows(g, which):
    ev = (((g.get("markets") or {}).get("15") or {}).get("event") or {})
    return ev.get(which) or []


def pct(o, kind):
    bi = (o or {}).get("bet_info") or {}
    return (bi.get(kind) or {}).get("percent")


def build(seasons):
    rows = []
    for season in seasons:
        for week in range(1, 19):
            try:
                d = week_payload(season, week)
            except Exception as e:
                print(f"  [{season} wk{week}] fetch failed ({type(e).__name__})")
                continue
            for g in d.get("games") or []:
                if g.get("status") != "complete" or not g.get("start_time"):
                    continue
                b = g.get("boxscore") or {}
                hp, ap = b.get("total_home_points"), b.get("total_away_points")
                if hp is None or ap is None:
                    continue
                sp = market_rows(g, "spread")
                hs = next((o for o in sp if o["side"] == "home"), None)
                aw = next((o for o in sp if o["side"] == "away"), None)
                if not hs or not aw or hs.get("value") is None:
                    continue
                tot = market_rows(g, "total")
                ov = next((o for o in tot if o["side"] == "over"), None)

                teams = {t["id"]: t for t in g.get("teams") or []}
                h_t, a_t = teams.get(g["home_team_id"]), teams.get(g["away_team_id"])
                ts = (pd.Timestamp(g["start_time"]).tz_convert("US/Eastern")
                      .tz_localize(None))
                rows.append(dict(
                    season=season, week=int(g["week"]), game_id=g["id"],
                    kick=ts, slot=slot_of(ts),
                    network=((g.get("broadcast") or {}).get("network") or "?"),
                    home_spread=float(hs["value"]),
                    total_line=float(ov["value"]) if ov and ov.get("value") is not None else np.nan,
                    tix_away=pct(aw, "tickets"), mny_away=pct(aw, "money"),
                    tix_over=pct(ov, "tickets") if ov else None,
                    mny_over=pct(ov, "money") if ov else None,
                    home_pts=int(hp), away_pts=int(ap), tickets=g.get("num_bets"),
                    divisional=bool(h_t and a_t
                                    and h_t.get("conference_type") == a_t.get("conference_type")
                                    and h_t.get("division_type") == a_t.get("division_type")),
                ))
    d = pd.DataFrame(rows)
    if d.empty:
        return d

    d["margin"] = d.home_pts - d.away_pts
    d["total_pts"] = d.home_pts + d.away_pts
    d["home_ats"] = d.margin + d.home_spread
    d["fav_away"] = d.home_spread > 0
    d["mag"] = d.home_spread.abs()

    # spread: crowd side and whether it covered (pushes dropped per-market, not globally)
    d["sp_ok"] = (d.home_ats != 0) & d.tix_away.notna() & (d.tix_away != 50)
    d["home_covered"] = d.home_ats > 0
    d["pub_away"] = d.tix_away > 50
    d["pub_pct"] = np.where(d.pub_away, d.tix_away, 100 - d.tix_away.astype(float))
    d["pub_covered"] = np.where(d.pub_away, ~d.home_covered, d.home_covered)
    d["fav_covered"] = np.where(d.fav_away, ~d.home_covered, d.home_covered)

    # totals
    d["ou_margin"] = d.total_pts - d.total_line
    d["ou_ok"] = d.ou_margin.notna() & (d.ou_margin != 0) & d.tix_over.notna() & (d.tix_over != 50)
    d["over_hit"] = d.ou_margin > 0
    d["pub_over"] = d.tix_over.astype(float) > 50
    d["ou_pub_pct"] = np.where(d.pub_over, d.tix_over.astype(float),
                               100 - d.tix_over.astype(float))
    d["ou_pub_won"] = np.where(d.pub_over, d.over_hit, ~d.over_hit)
    return d


# (outcome label, mask column, outcome column)
OUTCOMES = [
    ("crowd's spread side covers", "sp_ok", "pub_covered"),
    ("favourite covers", "sp_ok", "fav_covered"),
    ("over hits", "ou_ok", "over_hit"),
    ("crowd's totals side hits", "ou_ok", "ou_pub_won"),
]


def rates(d, slot_vec):
    out = {}
    for lab, mask, col in OUTCOMES:
        for s in SLOT_ORDER:
            m = d[mask].values & (slot_vec == s)
            n = int(m.sum())
            out[(lab, s)] = (d[col].values[m].mean() if n else np.nan, n)
    return out


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--seasons", type=int, nargs="+",
                    default=[2023, 2024, 2025, 2026])
    a = ap.parse_args()

    d = build(a.seasons)
    print(f"{len(d)} completed NFL games, {min(a.seasons)}-{max(a.seasons)}  "
          f"(spread gradable {int(d.sp_ok.sum())}, totals {int(d.ou_ok.sum())})")
    hc = d[d.sp_ok].home_covered.mean()
    assert 0.40 < hc < 0.60, f"home cover {hc:.1%} — orientation is wrong"
    print(f"orientation guard: home covers {hc:.1%}\n")

    print("=" * 92)
    print("WHAT EACH SLOT LOOKS LIKE")
    print("=" * 92)
    print(f"  {'slot':<11}{'n':>5}{'med tickets':>13}{'med |spread|':>14}"
          f"{'crowd share':>13}{'crowd on fav':>14}{'divisional':>12}")
    for s in SLOT_ORDER:
        g = d[(d.slot == s) & d.sp_ok]
        if not len(g):
            continue
        onfav = (g.pub_away == g.fav_away).mean()
        print(f"  {s:<11}{len(g):>5}{g.tickets.median():>13,.0f}{g.mag.median():>14.1f}"
              f"{g.pub_pct.median():>12.0f}%{onfav:>13.0%}{g.divisional.mean():>11.0%}")

    print("\n" + "=" * 92)
    print("OUTCOMES BY SLOT — with a best-of-N correction across the whole table")
    print("=" * 92)

    obs = rates(d, d.slot.values)
    key = list(zip(d.season.values, d.week.values))
    uniq = {}
    for i, k in enumerate(key):
        uniq.setdefault(k, []).append(i)

    best_null = []
    cell_null = {k: [] for k in obs}
    slots = d.slot.values
    for _ in range(NPERM):
        sv = slots.copy()
        for idx in uniq.values():
            if len(idx) > 1:
                sv[idx] = RNG.permutation(sv[idx])
        r = rates(d, sv)
        devs = []
        for k, (v, n) in r.items():
            cell_null[k].append(v)
            if not np.isnan(v) and n >= 30:
                devs.append(abs(v - 0.5))
        best_null.append(max(devs) if devs else np.nan)
    best_null = np.array(best_null, float)
    best_null = best_null[~np.isnan(best_null)]

    found = []
    for lab, _m, _c in OUTCOMES:
        print(f"\n  {lab}")
        for s in SLOT_ORDER:
            v, n = obs[(lab, s)]
            if np.isnan(v) or n < 30:
                if n:
                    print(f"      {s:<11} {v:6.1%}  n={n:<4} (too thin to score)")
                continue
            col = np.array(cell_null[(lab, s)], float)
            col = col[~np.isnan(col)]
            p_cell = (np.abs(col - 0.5) >= abs(v - 0.5)).mean()
            p_fam = (best_null >= abs(v - 0.5)).mean()
            lo, hi = wilson(int(round(v * n)), n)
            flag = "  <-- SURVIVES FAMILY" if p_fam < 0.05 else ""
            print(f"      {s:<11} {v:6.1%}  n={n:<4} [{lo:.0%},{hi:.0%}]  "
                  f"p_cell={p_cell:.3f}  p_family={p_fam:.3f}{flag}")
            if p_fam < 0.05:
                found.append((lab, s, v, n))

    print("\n" + "-" * 92)
    print(f"  a random relabelling of slots puts its most extreme cell "
          f"{best_null.mean() * 100:.1f} ± {best_null.std() * 100:.1f} points off 50%")
    if not found:
        print("  NOTHING survives the family correction.")
    else:
        print("  SURVIVORS — now check they hold season by season, which is what the "
              "heavy-public\n  fade failed:")
        for lab, s, v, n in found:
            print(f"\n    {s} / {lab}: {v:.1%} (n={n})")
            mask = dict(OUTCOMES and {l: (m, c) for l, m, c in OUTCOMES})[lab]
            sub = d[(d.slot == s) & d[mask[0]]]
            for season, gg in sub.groupby("season"):
                k = int(gg[mask[1]].sum())
                print(f"      {season}: {k}-{len(gg) - k}  {k / len(gg):.1%}  (n={len(gg)})")
    print("-" * 92)


if __name__ == "__main__":
    main()
