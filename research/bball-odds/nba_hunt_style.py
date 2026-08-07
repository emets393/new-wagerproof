#!/usr/bin/env python3
"""Pre-registered hypotheses over the families nba_hunt_frame never had.

Two searches (308,860 marginal cells, 7.5M interaction cells) both transferred at zero.
The reason is sample size: a 100-game cell has an ROI sd near 10 points, so ranking cells
by their in-sample ROI ranks noise, and no threshold fixes that. What has worked in this
project is the opposite move -- state a mechanism first, test ONE cut, and demand that the
near-miss control be dead. That is how S9/S11/S12 were found.

So this file is a hypothesis list, not a sweep. Every rule below has a stated mechanism,
a direction fixed BEFORE looking, and where the story implies one, a control that must
come back flat. Families:

  R  shooting regression   hot/cold vs the team's OWN season norm (three-point %, opponent
                           three-point % allowed, free-throw %, eFG). The own-baseline
                           subtraction is the part that carried S10; league-mean versions
                           are registered alongside as the comparison
  P  pace and totals       pace sum vs the posted total -- a style-based fair total, which
                           is the totals analogue of "power ratings vs the line"
  M  matchup               terms that exist only as a PAIR: shooters vs a defence that
                           concedes threes, offensive glass vs defensive glass, turnovers
                           forced vs turnovers committed
  T  rotation and fatigue  minutes concentration crossed with schedule load -- a thin
                           rotation and a deep one should not respond to a back-to-back
                           the same way
  Q  quarter shape         slow starters and front-loaded teams, against the first half

Graded at the T-60 close, quoted against the SAME-SIDE rule in the SAME universe, broken
out per season, and placebo-tested against random cuts of the same size.

    python3 nba_hunt_style.py --perms 2000
"""
import argparse
import os
import warnings

import numpy as np
import pandas as pd

from nba_hunt_sweep import build_markets

warnings.filterwarnings("ignore")
ROOT = os.path.dirname(os.path.abspath(__file__))
PQ = os.path.join(ROOT, "data", "parquet")
RNG = np.random.default_rng(2026)

UNI = {
    "all":   lambda d: (d["postseason"] == 0).to_numpy(),
    "gp10":  lambda d: ((d["postseason"] == 0) & (d["min_gp"] >= 10)).to_numpy(),
    "gp25":  lambda d: ((d["postseason"] == 0) & (d["min_gp"] >= 25)).to_numpy(),
    "gp50":  lambda d: ((d["postseason"] == 0) & (d["min_gp"] >= 50)).to_numpy(),
    "early": lambda d: ((d["postseason"] == 0) & (d["min_gp"] < 25)).to_numpy(),
}


def cell(d, mask, uni, market, markets, min_n=70):
    y, price = markets[market]
    ok = np.isfinite(y) & np.isfinite(price)
    c, b = mask & uni & ok, uni & ok
    n = int(c.sum())
    if n < min_n or b.sum() < 200:
        return None
    prof = np.where(y > 0, price - 1.0, -1.0)
    roi, win = prof[c].mean(), y[c].mean()
    broi, bwin, sd = prof[b].mean(), y[b].mean(), prof[b].std()
    return {"n": n, "win": 100 * win, "base": 100 * bwin, "edge": 100 * (win - bwin),
            "roi": 100 * roi, "base_roi": 100 * broi,
            "z": (roi - broi) / (sd / np.sqrt(n))}


def seasons(d, mask, uni, market, markets):
    out = []
    for s in sorted(set(d["season"])):
        sm = (d["season"] == s).to_numpy()
        r = cell(d, mask & sm, uni & sm, market, markets, min_n=15)
        out.append(f"{r['roi']:+.0f}" if r else "  .")
    return "/".join(out), sum(1 for o in out if o.strip().startswith("+"))


def placebo(d, uni, market, markets, n_cell, roi_obs, trials):
    y, price = markets[market]
    ok = np.isfinite(y) & np.isfinite(price) & uni
    prof = np.where(y > 0, price - 1.0, -1.0)[ok]
    if len(prof) < n_cell * 2:
        return np.nan
    hits = 0
    for _ in range(trials):
        hits += (prof[RNG.choice(len(prof), n_cell, replace=False)].mean() * 100 >= roi_obs)
    return hits / trials


def q(d, col, lo=None, hi=None, uni=None):
    """Threshold a column by quantile INSIDE the universe, so 'top 20%' means top 20% of
    the games the rule can actually fire on, not of the whole file."""
    v = d[col].to_numpy(float)
    sub = v[uni & np.isfinite(v)] if uni is not None else v[np.isfinite(v)]
    m = np.isfinite(v)
    if hi is not None:
        m &= v >= np.quantile(sub, hi)
    if lo is not None:
        m &= v <= np.quantile(sub, lo)
    return m


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--perms", type=int, default=2000)
    ap.add_argument("--out", default="nba_hunt_style.csv")
    a = ap.parse_args()

    d = (pd.read_parquet(os.path.join(PQ, "nba_hunt_frame2.parquet"))
           .sort_values("game_date").reset_index(drop=True))
    M = build_markets(d)
    U = {k: f(d) for k, f in UNI.items()}

    H = []

    def add(name, fam, uni, mask, market, why, control=None):
        H.append({"name": name, "fam": fam, "uni": uni, "mask": np.asarray(mask, bool),
                  "market": market, "why": why, "control": control})

    g25, g10, allr = U["gp25"], U["gp10"], U["all"]

    # ---------------------------------------------------------------- R: regression
    # Three-point percentage is the noisiest thing a team does and the most likely to be
    # extrapolated by a bettor watching the last week. Own-baseline, because a 38% team at
    # 44% is hot and a 33% team at 39% is not the same event.
    for w in (3, 5, 10):
        hot_h = q(d, f"hr_own{w}_p3_pct", hi=0.80, uni=g25)
        hot_a = q(d, f"ar_own{w}_p3_pct", hi=0.80, uni=g25)
        cold_h = q(d, f"hr_own{w}_p3_pct", lo=0.20, uni=g25)
        add(f"R_hot3_h_fade_l{w}", "regress", "gp25", hot_h, "fg_spread_away",
            "home team shooting over its own head from three -> fade it")
        add(f"R_hot3_a_fade_l{w}", "regress", "gp25", hot_a, "fg_spread_home",
            "away team shooting over its own head -> fade it")
        add(f"R_cold3_h_back_l{w}", "regress", "gp25", cold_h, "fg_spread_home",
            "home team ice cold from three vs its own norm -> back it")
        add(f"R_both_hot3_under_l{w}", "regress", "gp25", hot_h & hot_a, "fg_total_under",
            "both teams hot from three -> both regress -> under")
        add(f"R_both_cold3_over_l{w}", "regress", "gp25",
            cold_h & q(d, f"ar_own{w}_p3_pct", lo=0.20, uni=g25), "fg_total_over",
            "both teams cold from three -> both regress -> over")
        # CONTROL: the league-mean version of the same thing. If the own-baseline story is
        # right this should be visibly weaker, the way it was for S10.
        add(f"R_hot3_h_fade_LGCTRL_l{w}", "regress", "gp25",
            q(d, f"hr_lg{w}_p3_pct", hi=0.80, uni=g25), "fg_spread_away",
            "CONTROL: league-mean baseline instead of the team's own")

        # A defence has little control over opponent three-point percentage, so a team that
        # has been holding opponents to a low number has mostly been lucky, and its recent
        # results overstate it.
        luck_h = q(d, f"hr_own{w}_p3_pct_alwd", lo=0.20, uni=g25)
        luck_a = q(d, f"ar_own{w}_p3_pct_alwd", lo=0.20, uni=g25)
        add(f"R_luckyD_h_fade_l{w}", "regress", "gp25", luck_h, "fg_spread_away",
            "home defence has been getting a lucky opponent three-point number -> fade")
        add(f"R_luckyD_a_fade_l{w}", "regress", "gp25", luck_a, "fg_spread_home",
            "away defence riding a lucky opponent three-point number -> fade")
        add(f"R_bothluckyD_over_l{w}", "regress", "gp25", luck_h & luck_a,
            "fg_total_over", "both defences have been lucky -> both regress -> over")
        # the conjunction: hot offence AND lucky defence is the same team twice over
        add(f"R_hot_and_lucky_h_l{w}", "regress", "gp25", hot_h & luck_h,
            "fg_spread_away", "home team hot AND lucky -> the strongest fade")
        add(f"R_efg_hot_h_l{w}", "regress", "gp25",
            q(d, f"hr_own{w}_efg", hi=0.80, uni=g25), "fg_spread_away",
            "home eFG above its own norm -> fade")
        add(f"R_efgD_lucky_h_l{w}", "regress", "gp25",
            q(d, f"hr_own{w}_efg_alwd", lo=0.20, uni=g25), "fg_spread_away",
            "home eFG allowed below its own norm -> fade")

    # a hot team the market has also made a favourite is the doubled-up version
    fav_h = (d["t60_spread_home_point"] < 0).to_numpy()
    add("R_hot3_h_fav_fade", "regress", "gp25",
        q(d, "hr_own5_p3_pct", hi=0.80, uni=g25) & fav_h, "fg_spread_away",
        "hot home team the market has also priced up -> fade")
    add("R_cold3_h_dog_back", "regress", "gp25",
        q(d, "hr_own5_p3_pct", lo=0.20, uni=g25) & ~fav_h, "fg_spread_home",
        "cold home dog -> back")

    # ------------------------------------------------------------------- P: pace/totals
    # A style-implied total: pace times efficiency, compared with the number on the board.
    # This is the totals analogue of 'power ratings vs the line', which the first hunt only
    # tested with a broken column.
    for w in (5, 10):
        pace = d[f"m_l{w}_pace_sum"].to_numpy(float) / 2.0
        eff = ((d[f"hb_l{w}_off_eff"] + d[f"ab_l{w}_off_eff"]).to_numpy(float)
               + (d[f"hb_l{w}_def_eff"] + d[f"ab_l{w}_def_eff"]).to_numpy(float)) / 4.0
        imp = 2.0 * pace * eff / 100.0
        gap = imp - d["t60_total_point"].to_numpy(float)
        d[f"styl_total_gap_l{w}"] = gap
        add(f"P_styl_over_l{w}", "pace", "gp25",
            q(d, f"styl_total_gap_l{w}", hi=0.85, uni=g25), "fg_total_over",
            "style-implied total well above the posted number -> over")
        add(f"P_styl_under_l{w}", "pace", "gp25",
            q(d, f"styl_total_gap_l{w}", lo=0.15, uni=g25), "fg_total_under",
            "style-implied total well below the posted number -> under")
        add(f"P_fastpair_over_l{w}", "pace", "gp25",
            q(d, f"m_l{w}_pace_sum", hi=0.85, uni=g25), "fg_total_over",
            "two fast teams -> over")
        add(f"P_slowpair_under_l{w}", "pace", "gp25",
            q(d, f"m_l{w}_pace_sum", lo=0.15, uni=g25), "fg_total_under",
            "two slow teams -> under")
        add(f"P_pacegap_under_l{w}", "pace", "gp25",
            q(d, f"m_l{w}_pace_gap", hi=0.85, uni=g25), "fg_total_under",
            "big pace mismatch -- the slower team dictates -> under")
        add(f"P_3rate_over_l{w}", "pace", "gp25",
            q(d, f"m_l{w}_3rate_sum", hi=0.85, uni=g25), "fg_total_over",
            "two high-volume three-point teams -> over")

    # ------------------------------------------------------------------- M: matchup
    for w in (5, 10):
        add(f"M_h3_vs_ad_l{w}", "matchup", "gp25",
            q(d, f"m_l{w}_h3_vs_ad", hi=0.85, uni=g25), "tt_home_over",
            "home shooters into a defence that concedes threes -> home team total over")
        add(f"M_a3_vs_hd_l{w}", "matchup", "gp25",
            q(d, f"m_l{w}_a3_vs_hd", hi=0.85, uni=g25), "tt_away_over",
            "away shooters into a defence that concedes threes -> away team total over")
        add(f"M_glass_over_l{w}", "matchup", "gp25",
            q(d, f"m_l{w}_horb_vs_adrb", hi=0.85, uni=g25)
            & q(d, f"m_l{w}_aorb_vs_hdrb", hi=0.60, uni=g25), "fg_total_over",
            "both teams can crash the offensive glass -> second chances -> over")
        add(f"M_htov_edge_l{w}", "matchup", "gp25",
            q(d, f"m_l{w}_h_tov_edge", hi=0.85, uni=g25), "fg_spread_home",
            "home team faces a defence that does not force turnovers -> back home")
        add(f"M_atov_edge_l{w}", "matchup", "gp25",
            q(d, f"m_l{w}_a_tov_edge", hi=0.85, uni=g25), "fg_spread_away",
            "away team gets the turnover matchup -> back away")

    # -------------------------------------------------------------- T: rotation/fatigue
    # A team that runs everything through a short rotation should be the one that a
    # compressed schedule actually hurts.
    b2b_h, b2b_a = (d["h_b2b"] > 0).to_numpy(), (d["a_b2b"] > 0).to_numpy()
    for w in (5, 10):
        thin_h = q(d, f"hb_l{w}_hhi", hi=0.75, uni=g25)
        thin_a = q(d, f"ab_l{w}_hhi", hi=0.75, uni=g25)
        deep_h = q(d, f"hb_l{w}_hhi", lo=0.25, uni=g25)
        add(f"T_thin_b2b_h_fade_l{w}", "rotation", "gp25", thin_h & b2b_h,
            "fg_spread_away", "thin home rotation on no rest -> fade the home team")
        add(f"T_thin_b2b_a_fade_l{w}", "rotation", "gp25", thin_a & b2b_a,
            "fg_spread_home", "thin away rotation on no rest -> fade the away team")
        add(f"T_thin_b2b_h_CTRL_l{w}", "rotation", "gp25", deep_h & b2b_h,
            "fg_spread_away",
            "CONTROL: deep rotation on no rest -- must be flat if depth is the story")
        add(f"T_thin_load_h_l{w}", "rotation", "gp50",
            thin_h & (d["h_venues_7d"] >= 2).to_numpy(), "fg_spread_away",
            "thin rotation on the road grind -> fade")
        add(f"T_thin_fast_under_l{w}", "rotation", "gp25",
            thin_h & thin_a & q(d, f"m_l{w}_pace_sum", hi=0.60, uni=g25),
            "fg_total_under", "two thin rotations in a fast game -> legs go -> under")
        add(f"T_shortbench_h_l{w}", "rotation", "gp25",
            q(d, f"hb_l{w}_n_played", lo=0.25, uni=g25) & b2b_h, "fg_spread_away",
            "few players used, no rest -> fade")

    # --------------------------------------------------------------------- Q: quarter
    for w in (5, 10):
        add(f"Q_slowstart_h_l{w}", "shape", "gp25",
            q(d, f"hb_l{w}_q1_share", lo=0.20, uni=g25), "h1_spread_away",
            "home team habitually starts slow -> fade it in the first half")
        add(f"Q_frontload_over_l{w}", "shape", "gp25",
            q(d, f"hb_l{w}_h1_share", hi=0.80, uni=g25)
            & q(d, f"ab_l{w}_h1_share", hi=0.60, uni=g25), "h1_total_over",
            "two front-loaded teams -> first half over")
        add(f"Q_fastfinish_h_l{w}", "shape", "gp25",
            q(d, f"hb_l{w}_q4_share", hi=0.80, uni=g25), "fg_spread_home",
            "home team does its damage late -> back it to the close")

    # -------------------------------------------------------------------- run them all
    print(f"{len(H)} pre-registered rules "
          f"({len(set(h['fam'] for h in H))} families)\n", flush=True)
    rows = []
    for h in H:
        u = U[h["uni"]]
        r = cell(d, h["mask"], u, h["market"], M)
        if not r:
            continue
        sl, npos = seasons(d, h["mask"], u, h["market"], M)
        rows.append({"name": h["name"], "fam": h["fam"], "uni": h["uni"],
                     "market": h["market"], **r, "seasons": sl, "npos": npos,
                     "why": h["why"]})
    R = pd.DataFrame(rows)

    # The family-wise bar for THIS run only. It is not the bar for the project -- the
    # sweeps already spent an enormous amount of multiplicity -- but these rules are
    # pre-registered, so the honest correction is over these rules, not over 7.5M cells.
    print(f"{len(R)} rules met the size floor. Bar for {len(R)} pre-registered rules "
          f"~ z {1.96 + 0.45 * np.log(max(len(R), 2)):.2f}\n", flush=True)

    cc = ["name", "fam", "market", "n", "win", "base", "edge", "roi", "z", "seasons", "npos"]
    print("-- everything, by z")
    print(R.sort_values("z", ascending=False)[cc].to_string(
        index=False, float_format=lambda x: f"{x:7.2f}"))

    print("\n-- family summary (the honest read: which families are alive at all)")
    fs = R.groupby("fam").agg(rules=("z", "size"), med_roi=("roi", "median"),
                              max_z=("z", "max"), med_z=("z", "median"))
    print(fs.to_string(float_format=lambda x: f"{x:7.2f}"))

    # Placebo only for things worth the compute.
    cand = R[(R["z"] >= 2.0) & (R["npos"] >= 3)].sort_values("z", ascending=False)
    print(f"\n-- placebo for the {len(cand)} rules at z>=2.0 with 3+ positive seasons")
    for _, r in cand.iterrows():
        h = next(x for x in H if x["name"] == r["name"])
        p = placebo(d, U[h["uni"]], h["market"], M, int(r["n"]), r["roi"], a.perms)
        print(f"  {r['name']:28s} n={int(r['n']):4d} {r['win']:5.1f}% vs {r['base']:5.1f}% "
              f"roi {r['roi']:+6.2f} z={r['z']:4.2f} seasons {r['seasons']:20s} p={p:.4f}")
        print(f"      {r['why']}")

    R.to_csv(os.path.join(ROOT, a.out), index=False)
    print(f"\n-> {a.out}")


if __name__ == "__main__":
    main()
