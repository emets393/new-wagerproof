#!/usr/bin/env python3
"""Round 2: go deep on the only family that showed anything, in the markets nobody tests.

Round 1 tested 152 pre-registered rules across nine families and the verdict was lopsided.
Eight families were flat or negative at the median -- recent form, form measured against
the line, regression deltas, power ratings vs the line, line movement, head-to-head,
streaks, early-season bias. One family had a positive median ROI and every survivor in it:
MOTIVATION. Teams whose incentives change behave differently and the market is slow to
reprice that; teams that are merely hot or cold do not and it is fully priced.

So round 2 spends its budget there instead of spreading thin again, and it spends it in
the markets that are least picked over. Full-game sides and totals are the most efficient
lines on the board. Team totals and first halves are not: no published NBA study uses
them, so nothing has been arbitraged away by people reading the same papers.

Registered before looking at any round-2 result. The null is re-run over this set, and the
honest bar accounts for round 1 too -- roughly 300 rules across both rounds.

    python3 nba_hunt_round2.py --perms 400
"""
import argparse
import os
import warnings

import numpy as np
import pandas as pd

from nba_hunt_sweep import build_markets
from nba_hunt_validate import PH, cell_stats, DISCOVER, VALIDATE

warnings.filterwarnings("ignore")
ROOT = os.path.dirname(os.path.abspath(__file__))
PQ = os.path.join(ROOT, "data", "parquet")


def hypotheses_r2(d):
    H = []

    def add(key, fam, phase, mask, market, note=""):
        H.append({"key": key, "family": fam, "phase": phase,
                  "mask": np.asarray(mask), "market": market, "note": note})

    n = len(d)
    dead_h = ((d["st_h_eliminated"] > 0) | (d["st_h_tank"] > 0)).to_numpy()
    dead_a = ((d["st_a_eliminated"] > 0) | (d["st_a_tank"] > 0)).to_numpy()
    tank_h = (d["st_h_tank"] > 0).to_numpy()
    tank_a = (d["st_a_tank"] > 0).to_numpy()
    both = dead_h & dead_a
    home_fav = (d["t60_spread_home_point"] < 0).to_numpy()

    # --- M1 the quitting team's own scoring. S9 says a dead team stops competing on the
    # spread; if that is true it should be visible in ITS team total and in the
    # opponent's, and those two lines are priced far more loosely than the game total.
    add("m1_tank_h_tt_under", "teamtotal", "gp50", tank_h, "tt_home_under",
        "the team that has quit should score under its own posted number")
    add("m1_tank_h_tt_over", "teamtotal", "gp50", tank_h, "tt_home_over", "")
    add("m1_tank_h_opp_tt_over", "teamtotal", "gp50", tank_h, "tt_away_over",
        "quitting is a DEFENSIVE collapse -- the opponent is the cleaner expression")
    add("m1_tank_a_tt_under", "teamtotal", "gp50", tank_a, "tt_away_under", "")
    add("m1_tank_a_opp_tt_over", "teamtotal", "gp50", tank_a, "tt_home_over", "")
    add("m1_both_tt_home_over", "teamtotal", "gp50", both, "tt_home_over", "")
    add("m1_both_tt_away_over", "teamtotal", "gp50", both, "tt_away_over", "")
    add("m1_alive_vs_dead_tt", "teamtotal", "gp50", dead_a & ~dead_h, "tt_home_over",
        "the live team facing a dead one")
    add("m1_alive_vs_dead_tt_a", "teamtotal", "gp50", dead_h & ~dead_a, "tt_away_over", "")

    # --- M2 does quitting show up early in the game or only late? A team that has given
    # up should fade as the game goes on, which means the FIRST half is where it is least
    # visible. If the 1H edge matches the full-game edge the story is wrong.
    add("m2_dead_h_h1_fav", "half", "gp50", dead_h, "h1_spread_fav", "")
    add("m2_dead_h_h1_over", "half", "gp50", dead_h, "h1_total_over", "")
    add("m2_both_h1_over", "half", "gp50", both, "h1_total_over", "")
    add("m2_both_h1_under", "half", "gp50", both, "h1_total_under", "")
    add("m2_alive_h1_fav", "half", "gp50", (dead_h ^ dead_a), "h1_spread_fav",
        "exactly one side is done")

    # --- M3 the play-in bubble. The play-in was introduced in 2020-21 and turned the
    # 7th-10th seeds from meaningless into meaningful. st_playin_edge near zero means a
    # team is ON the bubble and every game is live -- the opposite of tanking, and a
    # motivation state that did not exist in any pre-2021 study.
    bub_h = d["st_h_playin_edge"].abs().to_numpy() <= 1.5
    bub_a = d["st_a_playin_edge"].abs().to_numpy() <= 1.5
    add("m3_bubble_home_back", "playin", "gp50", bub_h & ~bub_a, "fg_spread_home",
        "home is on the play-in bubble and the visitor is not")
    add("m3_bubble_away_back", "playin", "gp50", bub_a & ~bub_h, "fg_spread_away", "")
    add("m3_bubble_vs_dead", "playin", "gp50", bub_h & dead_a, "fg_spread_home",
        "a team fighting for the play-in against one that has quit")
    add("m3_bubble_vs_dead_a", "playin", "gp50", bub_a & dead_h, "fg_spread_away", "")
    add("m3_both_bubble_under", "playin", "gp50", bub_h & bub_a, "fg_total_under",
        "two desperate teams -> defence actually gets played")
    add("m3_both_bubble_over", "playin", "gp50", bub_h & bub_a, "fg_total_over", "")
    add("m3_bubble_home_ml", "playin", "gp50", bub_h & ~bub_a, "fg_ml_home", "")

    # --- M4 clinched-and-coasting. Distinct from tanking: a good team with the seed
    # locked rests starters, which is a different mechanism and a different market
    # response. Round 1 found clinched-home at 49.2%, so the effect, if any, is elsewhere.
    cl_h = (d["st_h_clinched"] == 1).to_numpy()
    cl_a = (d["st_a_clinched"] == 1).to_numpy()
    add("m4_clinched_home_dog", "clinch", "veryLate", cl_h & ~cl_a, "fg_spread_away", "")
    add("m4_clinched_away_fade", "clinch", "veryLate", cl_a & ~cl_h, "fg_spread_home", "")
    add("m4_clinched_over", "clinch", "veryLate", cl_h | cl_a, "fg_total_over",
        "bench units and no defence")
    add("m4_clinched_under", "clinch", "veryLate", cl_h | cl_a, "fg_total_under", "")
    add("m4_clinched_vs_bubble", "clinch", "veryLate", cl_h & bub_a, "fg_spread_away",
        "a locked-in team hosting one that is fighting for its life")
    add("m4_both_clinched_over", "clinch", "veryLate", cl_h & cl_a, "fg_total_over", "")

    # --- M5 how far gone. Round 1's gbr cut failed its mechanism control -- it worked
    # equally whether the FAVOURITE cared or not, which means it was never about
    # elimination pressure. Retested here as a pure depth-of-tank ladder on the binary
    # flag, where the story is "how long has this team been dead", not "how far back".
    gb6 = d["st_h_gb_6"].to_numpy()
    for lo, hi, nm in ((10, 20, "10to20"), (20, 99, "20plus")):
        add(f"m5_gb6_{nm}_fav", "depth", "gp50", (gb6 >= lo) & (gb6 < hi), "fg_spread_fav",
            f"home {lo}-{hi} games out of the 6 seed")
        add(f"m5_gb6_{nm}_over", "depth", "gp50", (gb6 >= lo) & (gb6 < hi), "fg_total_over", "")
    add("m5_tank_late_fav", "depth", "veryLate", tank_h, "fg_spread_fav", "")
    add("m5_tank_mid_fav", "depth", "mid", tank_h, "fg_spread_fav",
        "CONTROL: tanking flags before the trade deadline should be much weaker")
    add("m5_rank_bottom_fav", "depth", "gp50",
        (d["st_h_rank"] >= 13).to_numpy(), "fg_spread_fav", "")

    # --- M6 motivation crossed with schedule load. The cumulative-travel block is a
    # proven ingredient of the totals model but has never been tested as a RULE. The
    # conjunction is the hypothesis: a team that has quit and is also on the back end of a
    # road trip has two reasons not to compete, and only one of them is in the line.
    tired_h = (d["h_venues_7d"] >= 3).to_numpy()
    tired_a = (d["a_venues_7d"] >= 3).to_numpy()
    add("m6_dead_and_tired_fav", "load", "gp50", dead_h & tired_h, "fg_spread_fav", "")
    add("m6_dead_and_tired_over", "load", "gp50", dead_h & tired_h, "fg_total_over", "")
    add("m6_tired_only_fav", "load", "gp50", tired_h & ~dead_h, "fg_spread_fav",
        "CONTROL: load without the motivation story")
    add("m6_away_tired_home", "load", "all", tired_a, "fg_spread_home", "")
    add("m6_away_longtrip_over", "load", "all",
        (d["a_days_since_home"] >= 7).to_numpy(), "fg_total_over", "")
    add("m6_away_longtrip_home", "load", "all",
        (d["a_days_since_home"] >= 7).to_numpy(), "fg_spread_home", "")
    add("m6_away_longtrip_tt_under", "load", "all",
        (d["a_days_since_home"] >= 7).to_numpy(), "tt_away_under",
        "a team deep into a road trip should be the one that stops scoring")

    # --- M7 team totals as a market in their own right, outside the motivation story.
    # Almost nothing has been published here, so it is the least-arbitraged surface on
    # the board and worth a straight look.
    tt_h = d["c_tt_home_point"].to_numpy()
    tt_a = d["c_tt_away_point"].to_numpy()
    imp_gap_h = tt_h - (d["t60_total_point"].to_numpy() - d["t60_spread_home_point"].to_numpy()) / 2.0
    add("m7_tt_home_rich", "teamtotal", "all", imp_gap_h >= 1.5, "tt_home_under",
        "the team total sits above what the spread and game total jointly imply")
    add("m7_tt_home_cheap", "teamtotal", "all", imp_gap_h <= -1.5, "tt_home_over",
        "and the mirror -- a genuine cross-market arbitrage check")
    add("m7_tt_home_hi", "teamtotal", "all", tt_h >= np.nanquantile(tt_h, 0.85),
        "tt_home_under", "")
    add("m7_tt_away_hi", "teamtotal", "all", tt_a >= np.nanquantile(tt_a, 0.85),
        "tt_away_under", "")
    add("m7_tt_home_lo", "teamtotal", "all", tt_h <= np.nanquantile(tt_h, 0.15),
        "tt_home_over", "")
    add("m7_tt_away_lo", "teamtotal", "all", tt_a <= np.nanquantile(tt_a, 0.15),
        "tt_away_over", "")
    add("m7_bigdog_tt_over", "teamtotal", "all",
        (d["t60_spread_home_point"] >= 8).to_numpy(), "tt_home_over",
        "big home dogs -- garbage time cuts both ways and the market may over-fade them")
    add("m7_bigfav_tt_under", "teamtotal", "all",
        (d["t60_spread_home_point"] <= -8).to_numpy(), "tt_home_under",
        "a big favourite sits its starters in the fourth")
    add("m7_bigfav_opp_tt_over", "teamtotal", "all",
        (d["t60_spread_home_point"] <= -8).to_numpy(), "tt_away_over",
        "garbage time inflates the LOSING side's total, which is the classic mispricing")
    add("m7_bigfav_a_tt_over", "teamtotal", "all",
        (d["t60_spread_home_point"] >= 8).to_numpy(), "tt_away_over", "")

    # --- M8 first halves as a market in their own right. The 1H line is derived from the
    # full-game line rather than modelled, which is exactly where derived-market errors
    # live. Blowout risk does not scale linearly into the first half.
    absp = d["t60_spread_home_point"].abs().to_numpy()
    add("m8_bigline_h1_fav", "half", "all", absp >= 9, "h1_spread_fav",
        "the 1H spread is scaled off the full-game one, but a blowout builds late")
    add("m8_bigline_h1_dog", "half", "all", absp >= 9, "h1_spread_dog", "")
    add("m8_tight_h1_fav", "half", "all", absp <= 3, "h1_spread_fav", "")
    add("m8_bigline_h1_over", "half", "all", absp >= 9, "h1_total_over", "")
    h1_share = (d["c_h1_total_point"] / d["t60_total_point"]).to_numpy()
    add("m8_h1_share_hi", "half", "all", h1_share >= 0.505, "h1_total_under",
        "the 1H total is a bigger share of the game total than usual")
    add("m8_h1_share_lo", "half", "all", h1_share <= 0.487, "h1_total_over", "")
    add("m8_b2b_away_h1_under", "half", "all", (d["a_b2b"] == 1).to_numpy(),
        "h1_total_under", "")

    # --- M9 the trade deadline as a regime break. Rosters change, the market has to
    # reprice from scratch, and the tanking flags only become meaningful afterwards.
    dtd = d["st_days_to_deadline"].to_numpy()
    add("m9_postdl_dead_over", "deadline", "postdl", dead_h, "fg_total_over", "")
    add("m9_postdl_tank_fav", "deadline", "postdl", tank_h, "fg_spread_fav", "")
    add("m9_predl_tank_fav", "deadline", "all", tank_h & (dtd > 0), "fg_spread_fav",
        "CONTROL: the same flag BEFORE the deadline")
    add("m9_justafter_dl_over", "deadline", "all", (dtd <= 0) & (dtd >= -14),
        "fg_total_over", "the two weeks right after the deadline, new rotations")
    add("m9_justafter_dl_dog", "deadline", "all", (dtd <= 0) & (dtd >= -14),
        "fg_spread_dog", "")

    # --- M10 season fatigue. Not travel, calendar: the last two weeks are when rotations
    # stop resembling anything the ratings were fitted on.
    sf = d["st_h_season_frac"].to_numpy()
    add("m10_final2wk_over", "fatigue", "all", sf >= 0.94, "fg_total_over", "")
    add("m10_final2wk_under", "fatigue", "all", sf >= 0.94, "fg_total_under", "")
    add("m10_final2wk_dog", "fatigue", "all", sf >= 0.94, "fg_spread_dog", "")
    add("m10_final2wk_fav", "fatigue", "all", sf >= 0.94, "fg_spread_fav", "")
    add("m10_final2wk_h1_over", "fatigue", "all", sf >= 0.94, "h1_total_over", "")
    add("m10_final2wk_tt_over", "fatigue", "all", sf >= 0.94, "tt_home_over", "")
    return H


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--perms", type=int, default=400)
    ap.add_argument("--min-n", type=int, default=100)
    ap.add_argument("--seed", type=int, default=23)
    args = ap.parse_args()

    d = pd.read_parquet(os.path.join(PQ, "nba_hunt_frame.parquet"))
    d = d.sort_values("game_date").reset_index(drop=True)
    markets = build_markets(d)
    H = hypotheses_r2(d)
    print(f"games {len(d)}  round-2 hypotheses {len(H)}")
    season = d["season"].to_numpy()
    ph = {k: PH[k](d).to_numpy() for k in PH}

    rows = []
    for h in H:
        y, price = markets[h["market"]]
        st = cell_stats(h["mask"], ph[h["phase"]], y, price, args.min_n)
        if st is None:
            continue
        r = {"key": h["key"], "family": h["family"], "phase": h["phase"],
             "market": h["market"], "note": h["note"], **st}
        pos, seas = 0, []
        for s in sorted(set(season)):
            sm = (season == s)
            ss = cell_stats(h["mask"] & sm, ph[h["phase"]] & sm, y, price, 20)
            seas.append(f"{ss['roi']:+.0f}" if ss else "  .")
            if ss and ss["roi"] > 0:
                pos += 1
        r["seasons_pos"], r["by_season"] = pos, "/".join(seas)
        for tag, sm in (("disc", np.isin(season, DISCOVER)), ("val", np.isin(season, VALIDATE))):
            ss = cell_stats(h["mask"] & sm, ph[h["phase"]] & sm, y, price, 35)
            r[f"{tag}_roi"] = ss["roi"] if ss else np.nan
            r[f"{tag}_n"] = ss["n"] if ss else 0
        rows.append(r)
    res = pd.DataFrame(rows)

    rng = np.random.default_rng(args.seed)
    idx_by_season = [np.flatnonzero(season == s) for s in np.unique(season)]
    keep = [h for h in H if h["key"] in set(res["key"])]
    null_max = np.zeros(args.perms)
    for k in range(args.perms):
        perm = np.arange(len(d))
        for ix in idx_by_season:
            perm[ix] = rng.permutation(ix)
        best = -np.inf
        for h in keep:
            y, price = markets[h["market"]]
            st = cell_stats(h["mask"], ph[h["phase"]], y[perm], price[perm], args.min_n)
            if st and np.isfinite(st["z"]):
                best = max(best, st["z"])
        null_max[k] = best
        if (k + 1) % 100 == 0:
            print(f"  perm {k+1}/{args.perms} null best {np.median(null_max[:k+1]):.2f} med")
    thr = np.quantile(null_max, 0.95)
    # Round 1 tested 152 rules and this round tests ~90 more, so the honest family-wise
    # bar for anything found here is the bar for the COMBINED set, not for round 2 alone.
    # Round 1's null over 142 live cells put the 95th percentile at 3.01; a set roughly
    # 1.6x larger moves it a little higher, so 3.1 is quoted as the combined bar.
    print(f"\nround-2 null best-cell z over {len(keep)} cells: median "
          f"{np.median(null_max):.2f}, 95th {thr:.2f}, max {null_max.max():.2f}")
    print("combined-with-round-1 bar to quote: ~3.1")
    res["search_p"] = res["z"].apply(lambda v: float((null_max >= v).mean()))

    def tier(r):
        if r["z"] >= max(thr, 3.1):
            return "PROVEN"
        if r["z"] >= 2.0 and r["seasons_pos"] >= 3 and r["val_roi"] > 0 and r["val_n"] >= 50:
            return "TRACK"
        if r["z"] >= 1.6 and r["seasons_pos"] == 4 and r["val_roi"] > 0:
            return "WATCH"
        return "-"
    res["tier"] = res.apply(tier, axis=1)
    res = res.sort_values("z", ascending=False)
    res.to_csv(os.path.join(ROOT, "nba_hunt_round2.csv"), index=False)

    cols = ["key", "family", "phase", "market", "n", "win", "base_win", "edge", "roi",
            "base_roi", "z", "seasons_pos", "by_season", "disc_roi", "val_roi", "tier"]
    hits = res[res.tier != "-"]
    print(f"\n== survivors ({len(hits)} of {len(res)}) ==")
    print(hits[cols].to_string(index=False, float_format=lambda x: f"{x:7.2f}")
          if len(hits) else "  none")
    print("\n== top 30 by z ==")
    print(res.head(30)[cols].to_string(index=False, float_format=lambda x: f"{x:7.2f}"))
    print("\n== bottom 10 (the fades -- a strongly negative cell is a signal inverted) ==")
    print(res.tail(10)[cols].to_string(index=False, float_format=lambda x: f"{x:7.2f}"))
    print("\n== by family ==")
    print(res.groupby("family").agg(cells=("z", "size"), med_z=("z", "median"),
                                    max_z=("z", "max"), med_roi=("roi", "median"))
          .sort_values("max_z", ascending=False)
          .to_string(float_format=lambda x: f"{x:7.2f}"))


if __name__ == "__main__":
    main()
