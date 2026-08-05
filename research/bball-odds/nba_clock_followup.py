#!/usr/bin/env python3
"""The four cells worth a second look from the clock sweep, graded on their actual side.

`nba_schedule_context.py` swept ~40 cells across two markets and reported everything from
the OVER / HOME / FAVOURITE side, which is the right way to read a sweep but the wrong way
to price a bet: the under has its own price and its own bootstrap, and -110 is not
symmetric once the book shades one side.

Four cells were consistent enough across four seasons to be worth pricing properly. All
four had a mechanism available before the number was seen, which is the only defence
against a 40-cell sweep manufacturing a 57% row:

  MATINEE UNDER      before 3pm ET the over hit 41.5% (n=118), and 38.9% on weekend
                     matinees (n=95, four seasons 46/35/35/38). Mechanism: a noon tip
                     means an 8am wake-up, a walkthrough instead of a shootaround, and
                     legs that have not loosened. Shooting is the first thing to go. If
                     the book posts a normal total for an abnormal morning, the under is
                     free. The measurement that decides it is whether the posted total
                     moves as much as the actual points do.
  FRIDAY PRIMETIME   over 56.0% on n=502, four seasons 55/52/61/57, p5 52.2. Weakest
                     OVER mechanism of the four -- a national-TV Friday is not obviously
                     a higher-scoring environment -- so this one leans hardest on
                     consistency and needs the total-level control most.
  SUNDAY UNDER       over 47.5% on n=745, four seasons 48/45/50/46. Sunday is the day
                     after Saturday, and the NBA schedules a lot of second-night-of-a-
                     back-to-back and afternoon games on it.
  MONDAY DOG         favourites cover only 46.3% on Mondays (n=717) and it is the most
                     season-consistent spread cell in the entire sweep: 45/48/46/45. No
                     mechanism was available in advance, which is exactly why it is
                     reported here as an open question rather than a signal.

THE CONTROL THAT MATTERS MOST for any time-of-day totals claim: does the book already
know? If matinee totals are posted 4 points lower AND matinee games score 4 points fewer,
there is no edge -- the effect is real and priced. The edge only exists in the gap between
how much the line moves and how much the scoring moves. That gap is measured directly
below, in points, before any win rate is quoted.
"""
import os
import warnings

import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "data", "parquet")
RNG = np.random.default_rng(41)
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


def main():
    F = pd.read_parquet(f"{OUT}/nba_model_features.parquet")
    F = F[~F["game.id"].duplicated(keep=False)].copy()
    G = pd.read_parquet(f"{OUT}/bdl_games.parquet")[["id", "datetime"]].rename(
        columns={"id": "game.id"}).drop_duplicates("game.id")
    d = F.merge(G, on="game.id", how="left").reset_index(drop=True)
    d["date"] = pd.to_datetime(d["date"])
    tip = pd.to_datetime(d["datetime"], utc=True, errors="coerce").dt.tz_convert(
        "America/New_York")
    hour = tip.dt.hour.to_numpy(dtype=float)
    dow = tip.dt.day_name().to_numpy()
    seas = d["season"].astype(str).to_numpy()
    seasons = sorted(pd.unique(seas))

    y_t = d["y_fg_total"].to_numpy(dtype=float)
    y_m = d["y_fg_margin"].to_numpy(dtype=float)
    tp = d["open_total_point"].to_numpy(dtype=float)
    tp60 = d["t60_total_point"].to_numpy(dtype=float)
    sp = d["open_spread_home_point"].to_numpy(dtype=float)
    do, du = american_to_dec(d["open_total_over_price"]), \
        american_to_dec(d["open_total_under_price"])
    dh, da = american_to_dec(d["open_spread_home_price"]), \
        american_to_dec(d["open_spread_away_price"])
    live_t = (y_t != tp) & np.isfinite(tp) & np.isfinite(do) & np.isfinite(du) \
        & np.isfinite(hour)
    live_s = (y_m != -sp) & np.isfinite(sp) & np.isfinite(dh) & np.isfinite(da) \
        & np.isfinite(hour)
    under = (y_t < tp).astype(float)
    over = (y_t > tp).astype(float)
    dog_cov = np.where(sp < 0, (y_m < -sp).astype(float), (y_m > -sp).astype(float))
    dog_dec = np.where(sp < 0, da, dh)

    matinee = hour < 15
    wk_mat = matinee & np.isin(dow, ["Saturday", "Sunday"])

    L = ["# NBA clock findings — priced on the side actually bet", "",
         "Follow-up to the 40-cell sweep in `nba_schedule_context.py`. **A sweep that wide "
         "manufactures a 57% cell by construction**, so these four are here on four-season "
         "consistency plus a mechanism, and the mechanism is measured in points before any "
         "win rate is quoted.", ""]

    # ---- the measurement that decides the matinee claim -------------------------
    L += ["\n## Does the book already know about morning tips?\n",
          "If matinee totals are posted lower by exactly as much as matinee games score "
          "lower, the effect is real and fully priced and there is nothing to bet. The "
          "edge is the GAP between the two columns.", "",
          "| slot | n | mean posted total | mean actual total | actual − posted |",
          "|---|---|---|---|---|"]
    for lab, m in (("matinee (before 3pm ET)", live_t & matinee),
                   ("weekend matinee", live_t & wk_mat),
                   ("afternoon (3-6pm)", live_t & (hour >= 15) & (hour < 18)),
                   ("evening (6-8pm)", live_t & (hour >= 18) & (hour < 20)),
                   ("primetime (8-10pm)", live_t & (hour >= 20) & (hour < 22)),
                   ("late (10pm+)", live_t & (hour >= 22))):
        if m.sum() < 40:
            L.append(f"| {lab} | {int(m.sum())} | — | — | — |")
            continue
        L.append(f"| {lab} | {int(m.sum())} | {tp[m].mean():.1f} | {y_t[m].mean():.1f} | "
                 f"**{y_t[m].mean() - tp[m].mean():+.2f}** |")
    L += ["", "The all-games figure for `actual − posted` is "
          f"**{y_t[live_t].mean() - tp[live_t].mean():+.2f}** — that is the number every "
          "row above should be read against, not zero."]

    # ---- priced rows -------------------------------------------------------------
    def rows(title, note, base_mask, side_win, side_dec, base_lab, items):
        base = 100 * side_win[base_mask].mean()
        L.extend([f"\n## {title}\n", note, "",
                  f"**Baseline: {base_lab} = {base:.2f}%** on "
                  f"{int(base_mask.sum()):,} games. Breakeven at -110 is 52.4%.", "",
                  "| bet | n | win% | ROI | p5 | by season |",
                  "|---|---|---|---|---|---|"])
        for lab, m in items:
            k = base_mask & m
            if k.sum() < 40:
                L.append(f"| {lab} | {int(k.sum())} | — | — | — | — |")
                continue
            per = [f"{100*side_win[k & (seas == s)].mean():.0f}"
                   if (k & (seas == s)).sum() >= 15 else "-" for s in seasons]
            L.append(f"| {lab} | {int(k.sum())} | {100*side_win[k].mean():.1f} | "
                     f"{roi(side_win[k], side_dec[k]):+.2f} | "
                     f"{boot_p5(side_win[k]):.1f} | {'/'.join(per)} |")

    rows("Matinee UNDER, priced at the under",
         "Dose by tip hour. A real body-clock effect should strengthen the earlier the "
         "tip, not switch on at an arbitrary cutoff.",
         live_t, under, du, "under hits",
         [("all matinees (<3pm ET)", matinee),
          ("tip before 1pm", hour < 13),
          ("tip 1-2pm", (hour >= 13) & (hour < 15)),
          ("weekend matinee", wk_mat),
          ("Sunday matinee", matinee & (dow == "Sunday")),
          ("Saturday matinee", matinee & (dow == "Saturday")),
          ("weekday matinee", matinee & ~np.isin(dow, ["Saturday", "Sunday"])),
          ("under 4pm (looser cutoff, more sample)", hour < 16)])

    rows("Sunday and Monday UNDER",
         "Sunday follows the league's heaviest Saturday and carries afternoon tips.",
         live_t, under, du,
         "under hits",
         [("all Sunday", dow == "Sunday"),
          ("Sunday, evening or later", (dow == "Sunday") & (hour >= 18)),
          ("all Monday", dow == "Monday")])

    rows("Friday / Saturday primetime OVER",
         "The weakest mechanism of the four — a televised Friday is not obviously a "
         "higher-scoring environment — so this leans almost entirely on consistency.",
         live_t, over, do, "over hits",
         [("Friday primetime (8pm+)", (dow == "Friday") & (hour >= 20)),
          ("Saturday primetime (8pm+)", (dow == "Saturday") & (hour >= 20)),
          ("Fri or Sat primetime", np.isin(dow, ["Friday", "Saturday"]) & (hour >= 20)),
          ("late West Coast (10pm+)", hour >= 22)])

    rows("Monday DOG on the spread",
         "The most season-consistent spread cell in the sweep (favourites 45/48/46/45) "
         "and the one with NO mechanism proposed in advance. Reported as an open "
         "question, not a signal.",
         live_s, dog_cov, dog_dec, "dogs cover",
         [("Monday — any dog", dow == "Monday"),
          ("Monday — home dog", (dow == "Monday") & (sp > 0)),
          ("Monday — road dog", (dow == "Monday") & (sp < 0)),
          ("Tuesday — any dog (adjacent-day control)", dow == "Tuesday")])

    # ---- does it survive to the close? -------------------------------------------
    L += ["\n## Do these survive to the T-60 close?\n",
          "The house closing-line definition. A cell that only exists at the open needs "
          "the open; one that survives is bettable on a live feed.", "",
          "| bet | n at open | win% open | n at T-60 | win% T-60 |",
          "|---|---|---|---|---|"]
    du60 = american_to_dec(d["t60_total_under_price"])
    do60 = american_to_dec(d["t60_total_over_price"])
    live60 = (y_t != tp60) & np.isfinite(tp60) & np.isfinite(du60) & np.isfinite(hour)
    und60, ovr60 = (y_t < tp60).astype(float), (y_t > tp60).astype(float)
    for lab, m, w0, w60 in (
            ("matinee under", matinee, under, und60),
            ("weekend matinee under", wk_mat, under, und60),
            ("Sunday under", dow == "Sunday", under, und60),
            ("Fri/Sat primetime over",
             np.isin(dow, ["Friday", "Saturday"]) & (hour >= 20), over, ovr60)):
        k0, k6 = live_t & m, live60 & m
        if k0.sum() < 40:
            L.append(f"| {lab} | {int(k0.sum())} | — | — | — |")
            continue
        L.append(f"| {lab} | {int(k0.sum())} | {100*w0[k0].mean():.1f} | "
                 f"{int(k6.sum())} | {100*w60[k6].mean():.1f} |")

    path = os.path.join(ROOT, "NBA_CLOCK_BRIEF.md")
    with open(path, "w") as f:
        f.write("\n".join(L) + "\n")
    print("\n".join(L), flush=True)
    print(f"\nwrote {path}", flush=True)


if __name__ == "__main__":
    main()
