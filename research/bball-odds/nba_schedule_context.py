#!/usr/bin/env python3
"""Day of week, tip time, slate size, holidays. The free information nobody looked at.

This gap was the owner's catch, and it was a fair one: four seasons of NBA research in this
directory and not one script had opened the clock. Tip time and day of week are known weeks
in advance, cost nothing to obtain, and describe things a box-score model cannot see --
travel, rest quality, whether a game is the only one on television, whether players woke up
at 8am for a noon tip.

WHAT IS TESTED, on both sides of both main markets

  DAY OF WEEK      Mon-Sun. Not a hypothesis so much as the first thing to look at.
  TIP SLOT         matinee (before 3pm ET), afternoon, evening, primetime (8-9pm), late
                   (10pm+, i.e. West Coast). A noon tip is a genuinely different day for a
                   professional athlete than a 7:30 one.
  SLATE SIZE       how many NBA games that date. This is the best available proxy for
                   market attention: a 2-game Thursday is a national-TV night where every
                   sharp in the country is looking at both lines, and a 12-game Wednesday
                   is where a soft number can survive to tip. No broadcast column exists in
                   this warehouse, so slate size stands in for it.
  HOLIDAYS         Christmas Day and MLK Day — the two dates the league deliberately
                   showcases.

MULTIPLE COMPARISONS, STATED UP FRONT

This is a fishing expedition across roughly 40 cells on two markets. At 5% that buys two
false positives before anything real shows up, and a sweep this wide will ALWAYS produce a
57% cell. So nothing here gets believed on its win rate. The bar for carrying a finding
forward is all four of:

  1. positive in all four seasons,
  2. bootstrap p5 above breakeven,
  3. a mechanism that was plausible before the number was seen,
  4. survives cell-matching against the naive rule for that market.

Anything that clears fewer than four is reported as what it is -- a cell in a wide sweep --
and not as a signal. Baselines are stated per market because they are not 50%: home teams
cover at their own rate and totals go over at theirs, and a cell has to beat ITS market's
base rate, not a coin.
"""
import os
import warnings

import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "data", "parquet")
RNG = np.random.default_rng(31)
BOOT = 10_000


def american_to_dec(a):
    a = pd.to_numeric(a, errors="coerce").to_numpy(dtype=float)
    dec = np.where(a > 0, 1 + a / 100.0, 1 + 100.0 / np.abs(a))
    return np.where((a >= 1.01) & (a <= 40.0), a, dec)


def roi(win, dec):
    return 100 * (win * (dec - 1) - (1 - win)).mean()


def boot_p5(win):
    if len(win) < 30:
        return np.nan
    idx = RNG.integers(0, len(win), size=(BOOT, len(win)))
    return 100 * np.percentile(win[idx].mean(axis=1), 5)


def mlk(year):
    """Third Monday in January."""
    d = pd.Timestamp(f"{year}-01-01")
    first_mon = d + pd.Timedelta(days=(7 - d.dayofweek) % 7)
    return first_mon + pd.Timedelta(days=14)


def main():
    F = pd.read_parquet(f"{OUT}/nba_model_features.parquet")
    F = F[~F["game.id"].duplicated(keep=False)].copy()
    G = pd.read_parquet(f"{OUT}/bdl_games.parquet")[["id", "datetime"]].rename(
        columns={"id": "game.id"}).drop_duplicates("game.id")
    S = pd.read_parquet(f"{OUT}/nba_standings_feats.parquet")
    d = F.merge(G, on="game.id", how="left").merge(
        S, on="game.id", how="left").reset_index(drop=True)

    tip = pd.to_datetime(d["datetime"], utc=True, errors="coerce").dt.tz_convert(
        "America/New_York")
    d["date"] = pd.to_datetime(d["date"])
    hour = tip.dt.hour.to_numpy(dtype=float)
    dow = tip.dt.day_name().to_numpy()
    # slate size is counted off the calendar date, not the tip timestamp: a 10:30pm ET
    # West Coast game belongs to that night's slate, and its UTC date is the next day
    slate = d.groupby("date")["game.id"].transform("size").to_numpy(dtype=float)
    md = tip.dt.strftime("%m-%d").to_numpy()
    is_xmas = md == "12-25"
    is_mlk = np.array([t is not pd.NaT and t.normalize() == mlk(t.year)
                       for t in tip], dtype=bool)

    # --- markets ---------------------------------------------------------------
    y_m = d["y_fg_margin"].to_numpy(dtype=float)
    y_t = d["y_fg_total"].to_numpy(dtype=float)
    sp = d["open_spread_home_point"].to_numpy(dtype=float)
    tp = d["open_total_point"].to_numpy(dtype=float)
    dh, da = american_to_dec(d["open_spread_home_price"]), \
        american_to_dec(d["open_spread_away_price"])
    do, du = american_to_dec(d["open_total_over_price"]), \
        american_to_dec(d["open_total_under_price"])
    live_s = (y_m != -sp) & np.isfinite(sp) & np.isfinite(dh) & np.isfinite(da) \
        & np.isfinite(hour)
    live_t = (y_t != tp) & np.isfinite(tp) & np.isfinite(do) & np.isfinite(du) \
        & np.isfinite(hour)
    home_cov = (y_m > -sp).astype(float)
    fav_home = sp < 0
    fav_cov = np.where(fav_home, home_cov, 1 - home_cov)
    over = (y_t > tp).astype(float)
    seasons = sorted(d["season"].astype(str).unique())
    seas = d["season"].astype(str).to_numpy()

    edges = np.array([0, 2.5, 5.5, 8.5, 12.5, 99.0])
    bs = np.digitize(np.abs(sp), edges[1:-1])
    tedges = np.array([0, 215, 224, 232, 400.0])
    bt = np.digitize(tp, tedges[1:-1])

    L = ["# NBA schedule context — day of week, tip time, slate size, holidays", "",
         "Free information, known weeks ahead, never previously examined in this "
         "programme. **This is a wide sweep — roughly 40 cells across two markets — so a "
         "57% cell is the EXPECTED output of noise, not a finding.** Nothing here is "
         "carried forward on its win rate alone; the bar is all four seasons positive, "
         "bootstrap p5 above breakeven, a mechanism, and survival against cell-matching.",
         ""]

    def table(title, note, mask_base, side_win, side_dec, buck, base_lab, rows):
        base = 100 * side_win[mask_base].mean()
        L.extend([f"\n## {title}\n", note, "",
                  f"**Baseline: {base_lab} = {base:.2f}%** on "
                  f"{int(mask_base.sum()):,} games. Breakeven at -110 is 52.4%.", "",
                  "| cell | n | win% | vs base | ROI | delta cell | p5 | by season |",
                  "|---|---|---|---|---|---|---|---|"])
        for lab, m in rows:
            k = mask_base & m
            if k.sum() < 60:
                L.append(f"| {lab} | {int(k.sum())} | — | — | — | — | — | — |")
                continue
            tot = wsum = 0.0
            for j in np.unique(buck[k]):
                w = (buck[k] == j).sum()
                pool = mask_base & (buck == j)
                if pool.sum() < 40:
                    continue
                tot += w * roi(side_win[pool], side_dec[pool])
                wsum += w
            dc = roi(side_win[k], side_dec[k]) - (tot / wsum if wsum else np.nan)
            per = []
            for s in seasons:
                j = k & (seas == s)
                per.append(f"{100*side_win[j].mean():.0f}" if j.sum() >= 20 else "-")
            L.append(f"| {lab} | {int(k.sum())} | {100*side_win[k].mean():.1f} | "
                     f"**{100*side_win[k].mean() - base:+.1f}** | "
                     f"{roi(side_win[k], side_dec[k]):+.2f} | {dc:+.2f} | "
                     f"{boot_p5(side_win[k]):.1f} | {'/'.join(per)} |")

    DOW = [(w, dow == w) for w in ("Monday", "Tuesday", "Wednesday", "Thursday",
                                   "Friday", "Saturday", "Sunday")]
    SLOT = [("matinee (before 3pm ET)", hour < 15),
            ("afternoon (3-6pm)", (hour >= 15) & (hour < 18)),
            ("early evening (6-8pm)", (hour >= 18) & (hour < 20)),
            ("primetime (8-10pm)", (hour >= 20) & (hour < 22)),
            ("late (10pm+, West Coast)", hour >= 22)]
    SLATE = [("tiny slate (1-3 games) — national TV night", slate <= 3),
             ("small slate (4-5)", (slate >= 4) & (slate <= 5)),
             ("mid slate (6-8)", (slate >= 6) & (slate <= 8)),
             ("big slate (9+) — attention spread thin", slate >= 9)]
    HOL = [("Christmas Day", is_xmas), ("MLK Day", is_mlk),
           ("weekend (Sat/Sun)", np.isin(dow, ["Saturday", "Sunday"])),
           ("weekday (Mon-Fri)", ~np.isin(dow, ["Saturday", "Sunday"]))]
    COMBO = [("Friday primetime", (dow == "Friday") & (hour >= 20)),
             ("Saturday primetime", (dow == "Saturday") & (hour >= 20)),
             ("Sunday matinee", (dow == "Sunday") & (hour < 15)),
             ("Sunday primetime", (dow == "Sunday") & (hour >= 20)),
             ("weekend matinee (Sat or Sun, before 3pm)",
              np.isin(dow, ["Saturday", "Sunday"]) & (hour < 15)),
             ("weekday matinee (rare — MLK, holidays)",
              ~np.isin(dow, ["Saturday", "Sunday"]) & (hour < 15))]

    for mk, (lw, sw, sd, bk, bl) in {
            "SPREAD — backing the HOME team": (live_s, home_cov,
                                               np.where(True, dh, dh), bs,
                                               "home covers"),
            "SPREAD — backing the FAVOURITE": (live_s, fav_cov,
                                               np.where(fav_home, dh, da), bs,
                                               "favourite covers"),
            "TOTAL — backing the OVER": (live_t, over, do, bt, "over hits"),
    }.items():
        for gname, rows in (("by day of week", DOW), ("by tip slot", SLOT),
                            ("by slate size", SLATE), ("holidays and weekends", HOL),
                            ("day x slot combinations", COMBO)):
            table(f"{mk} — {gname}",
                  "Cell-matched against the same market across all games in the "
                  "matching line-size buckets.", lw, sw, sd, bk, bl, rows)

    # --- mechanism test for S9 -------------------------------------------------
    L += ["\n## Mechanism check: does the dead-home-team edge depend on attention?\n",
          "S9 (late season, home team eliminated or tanking, back the favourite) is a "
          "62.3% rule. If it exists because a soft number survives to tip, it should be "
          "BIGGER on crowded slates where no one is looking and smaller on national-TV "
          "nights. This is a real prediction with a direction, made before the split.", "",
          "| cell | n | win% | ROI | by season |", "|---|---|---|---|---|"]
    gp = np.minimum(d["st_h_gp"].to_numpy(dtype=float),
                    d["st_a_gp"].to_numpy(dtype=float))
    post = d["game.postseason"].to_numpy(dtype=float) > 0
    dead_h = ((d["st_h_eliminated"].to_numpy(dtype=float) > 0)
              | (d["st_h_tank"].to_numpy(dtype=float) > 0))
    sel = live_s & (~post) & (gp >= 50) & dead_h
    fdec = np.where(fav_home, dh, da)
    for lab, m in (("S9 on a big slate (9+ games)", sel & (slate >= 9)),
                   ("S9 on a mid slate (6-8)", sel & (slate >= 6) & (slate <= 8)),
                   ("S9 on a small slate (<=5)", sel & (slate <= 5)),
                   ("S9 in primetime (8pm+)", sel & (hour >= 20)),
                   ("S9 not in primetime", sel & (hour < 20))):
        if m.sum() < 40:
            L.append(f"| {lab} | {int(m.sum())} | — | — | — |")
            continue
        per = [f"{100*fav_cov[m & (seas == s)].mean():.0f}"
               if (m & (seas == s)).sum() >= 15 else "-" for s in seasons]
        L.append(f"| {lab} | {int(m.sum())} | {100*fav_cov[m].mean():.1f} | "
                 f"{roi(fav_cov[m], fdec[m]):+.2f} | {'/'.join(per)} |")

    path = os.path.join(ROOT, "NBA_SCHEDULE_CONTEXT_BRIEF.md")
    with open(path, "w") as f:
        f.write("\n".join(L) + "\n")
    print("\n".join(L), flush=True)
    print(f"\nwrote {path}", flush=True)


if __name__ == "__main__":
    main()
