"""STEAM TIMING on the densified 2021-22 archive — PRE-REGISTERED before results.

Context: the live core_total_edge ladder upgrades on TOTAL steam toward the model
(close-open >= 0.5 -> T2 1u, >= 1.5 -> T1 1.5u, >= 2.5 DECAYS — never chase). That dig
only saw open->close. The 2026-08-17 densification (Sat-AM fill-ins) gives window
resolution: open->h72 (early week), h72->h24, h24->h6 (the newly filled overnight/
morning window), h6->close (late gameday).

Question: for games where the production core formula has |edge| >= 4 vs the CLOSE,
does WHEN the toward-model steam arrived change the close-graded hit rate?
Hypotheses registered:
  H1: late steam (h24->close) is a sharper confirm than early steam (open->h72) —
      late money is the informed money.
  H2: the >= 2.5 total-move decay is driven by EARLY movers (fully-moved by h24),
      not by late steam.
Grade: at the consensus close (the ladder's grade_line), -110. Weeks 5-15 to match the
original dig; seasons 2021-2025. Rematch-ambiguous (season,home,away) pairs dropped.
Baselines: each cell vs the edge>=4-no-steam control from the SAME frame.
"""
import numpy as np
import pandas as pd

D = "data"
B_OFF, B_DEF, B0 = 0.2285, 0.2547, 53.95


def main():
    mw = pd.read_parquet(f"{D}/movement_windows.parquet")
    mw = mw.drop_duplicates(["season", "home", "away"], keep=False)
    gm = pd.read_parquet(f"{D}/model_games.parquet")[["season", "week", "homeTeam", "awayTeam"]] \
        .rename(columns={"homeTeam": "home", "awayTeam": "away"}).drop_duplicates(["season", "home", "away"], keep=False)
    w = mw.merge(gm, on=["season", "home", "away"], how="inner")
    w = w[(w.week >= 5) & (w.week <= 15)].copy()

    core = pd.read_parquet(f"{D}/cfbd/core_asof.parquet").set_index(["season", "thru_week", "team"])

    def hat(r):
        try:
            ho = core.loc[(r.season, r.week - 1, r.home)]
            aw = core.loc[(r.season, r.week - 1, r.away)]
        except KeyError:
            return np.nan
        return B_OFF * (ho.off + aw.off) + B_DEF * (ho.dfn + aw.dfn) + B0

    w["edge"] = w.apply(hat, axis=1) - w.tot_close
    w = w[w.edge.abs() >= 4].dropna(subset=["actual_total", "tot_close"]).copy()
    w = w[w.actual_total != w.tot_close]
    sgn = np.sign(w.edge)          # +1 model says OVER, -1 UNDER
    # toward-model movement per window (positive = line moved toward the model side)
    for name, a, b in [("early", "tot_open", "tot_h72"), ("mid", "tot_h72", "tot_h24"),
                       ("morning", "tot_h24", "tot_h6"), ("late", "tot_h6", "tot_close"),
                       ("full", "tot_open", "tot_close")]:
        w[f"st_{name}"] = (w[b] - w[a]) * sgn
    w["win"] = np.where(sgn > 0, w.actual_total > w.tot_close, w.actual_total < w.tot_close)
    print(f"frame: {len(w)} edge>=4 decided bets, seasons {sorted(w.season.unique())}, "
          f"h6 coverage {w.tot_h6.notna().mean()*100:.0f}%")

    def cell(name, mask):
        s = w[mask]
        if len(s) < 25:
            print(f"  {name:46s} n={len(s)} (<25 skip)")
            return
        hit = s.win.mean() * 100
        roi = np.mean(np.where(s.win, 100 / 110, -1.0)) * 100
        per = " ".join(f"{y}:{s[s.season == y].win.mean()*100:.0f}%({(s.season == y).sum()})"
                       for y in (2021, 2022, 2023, 2024, 2025) if (s.season == y).sum() > 0)
        print(f"  {name:46s} n={len(s):4d} hit={hit:5.1f}% ROI={roi:+6.1f}% [{per}]")

    print("\n=== ladder reproduction (full open->close steam) ===")
    cell("edge>=4, no steam (<0.5 toward)", w.st_full < 0.5)
    cell("edge>=4, steam 0.5-1.5 (T2 def)", (w.st_full >= 0.5) & (w.st_full < 1.5))
    cell("edge>=4, steam 1.5-2.5 (T1 def)", (w.st_full >= 1.5) & (w.st_full < 2.5))
    cell("edge>=4, steam >=2.5 (decay zone)", w.st_full >= 2.5)

    print("\n=== H1: timing of the steam (total toward-move >=0.5 in that window) ===")
    hv = w.tot_h6.notna()
    cell("early steam only (open->h72, later flat)", (w.st_early >= 0.5) & (w.st_mid.abs() < 0.5) & hv & (w.st_morning.abs() < 0.5) & (w.st_late.abs() < 0.5))
    cell("mid steam (h72->h24)", (w.st_mid >= 0.5) & hv)
    cell("MORNING steam (h24->h6, densified window)", (w.st_morning >= 0.5) & hv)
    cell("LATE steam (h6->close)", (w.st_late >= 0.5) & hv)
    cell("late+morning steam (h24->close >=0.5)", ((w.st_morning + w.st_late) >= 0.5) & hv)
    cell("control: no steam any window", (w.st_early < 0.5) & (w.st_mid < 0.5) & (w.st_morning < 0.5) & (w.st_late < 0.5) & hv)

    print("\n=== H2: decay zone (full >=2.5) split by arrival ===")
    dz = w.st_full >= 2.5
    early_done = (w.tot_h24 - w.tot_open) * np.sign(w.edge) >= 2.0
    cell("decay zone, fully moved BY h24", dz & early_done & hv)
    cell("decay zone, still moving after h24", dz & ~early_done & hv)


if __name__ == "__main__":
    main()
