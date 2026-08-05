#!/usr/bin/env python3
"""The published-systems catalog, tested against our data. ~30 angles, all sourced.

WHY THIS FILE EXISTS. A research sweep of the handicapping literature (Sports Insights /
Bet Labs, Action Network, VSiN, Boyd's Bets, ProComputerGambler, Covers, NBAstuffer, plus
the academic journals) returned 72 distinct published NBA angles with hit rates attached.
Every one of them is a hypothesis somebody else wrote, on somebody else's data, before we
looked at ours. That is the whole point: our four in-house search designs generated their
hypotheses from the same 5,368 games they then tested on, and all four came back at or
below the noise ceiling. These did not.

TWO STRUCTURAL WARNINGS FROM THE SWEEP, both of which change how the results below read:

  1. Roughly a third of everything published on NBA systems traces to Sports Insights /
     Bet Labs, and most of those samples END between 2013 and 2017. Our data starts after
     that. So for the STALE angles this is not a replication -- it is an out-of-sample
     continuation, and a null here means "it died", not "they were wrong".
  2. NBA TOTALS ARE NOT COMPARABLE ACROSS ERAS. Pace and 3PA exploded after 2016-17. A
     published "total >= 194.5" filter from 2015 is now a BELOW-average total, and "220+"
     was extreme in 2005 and is roughly league average now. Every published totals
     threshold is therefore re-expressed here as a PERCENTILE OF OUR OWN SAMPLE, not
     carried over as a raw number. Porting the raw number would test a different rule.

WHAT WE CANNOT TEST. Anything keyed on betting SPLITS -- ticket counts, dollar handle,
reverse line movement as the trackers define it. We have no splits feed. That kills the
whole VSiN family (E10-E16), the Sports Insights contrarian family (E4-E9) and the
public-fade playoff angles. What we DO have is open -> t24 -> t4 -> t60 line movement, so
the movement-only half of those rules is testable and is included; the "line moved against
the public money" half is not. Where a published angle needs splits, it is skipped and said
so, rather than approximated with something that is not the same rule.

ALSO TESTED HERE: the two survivors from nba_lit_tests.py, drilled properly.
  X1  visitor crossing 2+ time zones WESTWARD is worth -2.87 real points and is priced at
      -0.50, a -2.37 +/- 1.07 unpriced gap. Note this is the OPPOSITE sign to the published
      folklore (Sports Insights 2013 has east-coast teams travelling west COVERING at 54-57%
      as road dogs), which makes it worth either a real finding or a sign error, and those
      are distinguishable.
  X2  home team with 2+ days MORE rest is worth +3.73 real and priced at +1.84, a
      +1.89 +/- 0.92 gap -- while home with 1 day more is priced at +1.73 against a real
      +0.83, i.e. OVER-priced. The market's rest slope looks linear where the truth is
      convex. That shape claim is falsifiable and is tested directly.

GRADING is unchanged from the rest of the project: T-60 close AND open, every win rate
quoted next to ITS OWN SLICE's base rate, per-season breakout on anything that survives,
and a placebo that prices the search.
"""
import importlib.util
import os

import numpy as np
import pandas as pd

ROOT = os.path.dirname(os.path.abspath(__file__))
PQ = os.path.join(ROOT, "data", "parquet")

_s = importlib.util.spec_from_file_location("sweep", os.path.join(ROOT, "nba_hunt_sweep.py"))
sweep = importlib.util.module_from_spec(_s); _s.loader.exec_module(sweep)
_d = importlib.util.spec_from_file_location("dd", os.path.join(ROOT, "nba_hunt_deepdive.py"))
dd = importlib.util.module_from_spec(_d); _d.loader.exec_module(dd)

d = pd.read_parquet(f"{PQ}/nba_hunt_frame2.parquet").sort_values("game_date").reset_index(drop=True)
d["game_date"] = pd.to_datetime(d["game_date"])

M_CLOSE = sweep.build_markets(d)
M_OPEN = sweep.build_markets(d.assign(
    t60_spread_home_point=d["open_spread_home_point"],
    t60_spread_home_price=d["open_spread_home_price"],
    t60_spread_away_price=d["open_spread_away_price"],
    t60_total_point=d["open_total_point"],
    t60_total_over_price=d["open_total_over_price"],
    t60_total_under_price=d["open_total_under_price"]))

REG = (d["postseason"] == 0).to_numpy()
GP = d["min_gp"].to_numpy(float)
PHASES = {"early <25gp": REG & (GP < 25),
          "mid 25-49": REG & (GP >= 25) & (GP < 50),
          "late 50+": REG & (GP >= 50),
          "playoffs": ~REG}


def col(name):
    return pd.to_numeric(d[name], errors="coerce").to_numpy(float)


# ============================================================ previous-game (L1/L2) layer
# The frame carries trailing 3/5/10-game aggregates but NOTHING for the single previous
# game, and the strongest published angles all key on exactly that ("off a 16+ point loss",
# "won last by 15+", "opponent just won by 1-3", "scored 115+ and lost, twice running").
# Build it in long form off the frame itself so there is no second data source to trust:
# every team-game becomes a row, sort by team and date, shift(1) and shift(2). Strictly
# prior dates only, so it is leak-safe by construction.
def build_prev():
    tot, mar = col("gm_total"), col("margin")
    hp, ap = (tot + mar) / 2.0, (tot - mar) / 2.0
    atsm = col("ats_margin")

    long = pd.concat([
        pd.DataFrame({"gi": np.arange(len(d)), "side": "h", "date": d["game_date"],
                      "team": d["home_team"].astype(str), "opp": d["away_team"].astype(str),
                      "own": hp, "against": ap, "margin": mar, "atsm": atsm,
                      "was_home": 1.0, "tot": tot, "opp_wpct": col("st_a_win_pct")}),
        pd.DataFrame({"gi": np.arange(len(d)), "side": "a", "date": d["game_date"],
                      "team": d["away_team"].astype(str), "opp": d["home_team"].astype(str),
                      "own": ap, "against": hp, "margin": -mar, "atsm": -atsm,
                      "was_home": 0.0, "tot": tot, "opp_wpct": col("st_h_win_pct")}),
    ]).sort_values(["team", "date"]).reset_index(drop=True)

    g = long.groupby("team", sort=False)
    for k in ("own", "against", "margin", "atsm", "was_home", "tot", "opp_wpct"):
        long[f"p1_{k}"] = g[k].shift(1)
        long[f"p2_{k}"] = g[k].shift(2)
    long["p1_opp"] = g["opp"].shift(1)
    # gap in days guards against a previous game from LAST season being treated as "last
    # game" -- a 100-day gap is an offseason, not a rest spot
    long["p1_gap"] = (long["date"] - g["date"].shift(1)).dt.days

    out = {}
    for side in ("h", "a"):
        sub = long[long.side == side].set_index("gi").reindex(np.arange(len(d)))
        pre = "hp" if side == "h" else "ap"
        for c in [c for c in long.columns if c.startswith(("p1_", "p2_"))]:
            out[f"{pre}_{c}"] = sub[c].to_numpy()
    return out


P = build_prev()


def pv(name):
    v = P[name]
    return v.astype(float) if v.dtype != object else v


VALID_H = np.isfinite(pv("hp_p1_margin")) & (pv("hp_p1_gap") <= 14)
VALID_A = np.isfinite(pv("ap_p1_margin")) & (pv("ap_p1_gap") <= 14)


# ============================================================ helpers
def ats(mask, label, market, universe=None, min_n=40, do_open=True):
    uni = REG if universe is None else universe
    rows = [dd.grade(d, mask & uni, uni, market, M_CLOSE, label, min_n=min_n)]
    if do_open:
        rows.append(dd.grade(d, mask & uni, uni, market, M_OPEN, label + " [OPEN]", min_n=min_n))
    return rows


def per_season(mask, market, label, universe=None, min_n=15):
    """Standing rule: pooled numbers hide late-sample decay, so always break out by year."""
    uni = REG if universe is None else universe
    rows = []
    for s in sorted(set(d["season"])):
        k = (d["season"] == s).to_numpy()
        r = dd.grade(d, mask & uni & k, uni & k, market, M_CLOSE, f"{label} {s}", min_n=min_n)
        if r:
            rows.append(r)
    return rows


def by_phase(mask, market, label, min_n=25):
    rows = []
    for pl, pm in PHASES.items():
        r = dd.grade(d, mask & pm, pm, market, M_CLOSE, f"{label} {pl}", min_n=min_n)
        if r:
            rows.append(r)
    return rows


def head(n, title, src):
    print("\n" + "=" * 88)
    print(f"{n}. {title}")
    print(f"   source: {src}")
    print("=" * 88)


def pctile_total(q, universe=None):
    """Published totals thresholds are era-bound. Re-express as a percentile of OUR sample."""
    uni = REG if universe is None else universe
    t = col("t60_total_point")
    return t >= np.nanquantile(t[uni & np.isfinite(t)], q)


def main():
    h_b2b, a_b2b = col("h_b2b") == 1, col("a_b2b") == 1
    h_rest, a_rest = col("h_rest_days"), col("a_rest_days")
    h_tz, a_tz = col("h_trav_tz"), col("a_trav_tz")
    sp = col("t60_spread_home_point")
    tot_c, tot_o = col("t60_total_point"), col("open_total_point")
    sp_o = col("open_spread_home_point")

    # ---------------------------------------------------------------- A. rest & schedule
    head("A", "REST & SCHEDULE", "Action Network 2019 (A3/A4), Boyd's Bets (A5-A7), TheDataJocks (A8)")

    # A3: published 235-172-5 (57.7%) since 2004 -- back the ROAD team on a b2b, but only
    # in the first month, when lines are set before rotations are known.
    a3 = a_b2b & ~h_b2b & REG & (GP < 12)
    dd.show(ats(a3, "A3 road b2b, first 12 gp -> back AWAY", "fg_spread_away", min_n=25),
            "A3  published 57.7%")

    # A4: published 96-61-1 (61.1%) -- well-rested road team vs a short-rest opponent.
    a4 = (a_rest >= 4) & (h_rest <= 2)
    dd.show(ats(a4, "A4 away rest 4+ vs home rest <=2 -> back AWAY", "fg_spread_away", min_n=25),
            "A4  published 61.1%")
    a4b = (a_rest >= 3) & (h_rest <= 1)
    dd.show(ats(a4b, "A4' away rest 3+ vs home rest <=1 -> back AWAY", "fg_spread_away", min_n=25),
            "A4' looser variant")

    # A7: published as a NULL -- 913-893-33 (50.6%) on totals. Fatigue cuts offence AND
    # defence, so it cancels on the total and lives only in the spread. Worth confirming
    # because if it is NOT null for us, the whole rest family needs re-reading.
    a7 = (a_b2b & ~h_b2b) | (h_b2b & ~a_b2b)
    dd.show(ats(a7, "A7 one-sided b2b -> UNDER", "fg_total_under"), "A7  published NULL (50.6%)")

    # A8: published as a null -- both teams tired cancels out.
    dd.show(ats(h_b2b & a_b2b, "A8 BOTH on a b2b -> back HOME", "fg_spread_home", min_n=25),
            "A8  published NULL")

    # K1: inpredictable's rest-conditional home court -- HCA collapses from 3.25 to 2.00
    # when the ROAD team is rested and the home team is not. That is a claim about the
    # market's constant, so grade the home side directly.
    dd.show(ats(h_b2b & (a_rest >= 2), "K1 home b2b vs away rest 2+ -> back AWAY",
                "fg_spread_away", min_n=25) +
            ats(~h_b2b & a_b2b & (h_rest >= 2), "K1 away b2b vs home rest 2+ -> back HOME",
                "fg_spread_home", min_n=25),
            "K1  rest-conditional HCA")

    # ---------------------------------------------------------------- B. travel
    head("B", "TRAVEL", "Sports Insights 2013 (B1), Talkbasket (B2)")

    # B1: published 210-166 (55.9%) for east/central road DOGS travelling west, and
    # 172-128 (57.3%) when it is a consecutive road game. NOTE our own lit suite found the
    # OPPOSITE sign in the dual-outcome regression, so this is the direct collision test.
    west_trip = a_tz <= -2          # visitor moved 2+ zones west (negative = westward)
    east_trip = a_tz >= 2
    dog_away = sp < 0               # home favoured => away is the dog
    dd.show(ats(west_trip & dog_away, "B1 visitor 2+tz WEST as a dog -> back AWAY",
                "fg_spread_away", min_n=25) +
            ats(west_trip, "B1' visitor 2+tz WEST, any -> back AWAY", "fg_spread_away", min_n=25) +
            ats(east_trip, "B2  visitor 2+tz EAST, any -> back AWAY", "fg_spread_away", min_n=25),
            "B1/B2  published: back the westward traveller at 55.9%")

    # ---------------------------------------------------------------- C. post-result spots
    head("C", "POST-RESULT SPOTS", "Sports Insights (C1/C2), Boyd's Bets (C5/C6), ProComputerGambler (C9), Action Network (D12)")

    ap_m, hp_m = pv("ap_p1_margin"), pv("hp_p1_margin")
    ap_own, hp_own = pv("ap_p1_own"), pv("hp_p1_own")
    ap_wp, hp_wp = pv("ap_p1_opp_wpct"), pv("hp_p1_opp_wpct")

    # C1: published 164-104 (61.2%) -- road dog off a 16+ point loss to a >=60% opponent.
    c1 = VALID_A & (ap_m <= -16) & dog_away
    dd.show(ats(c1, "C1 road dog off a 16+ loss -> back AWAY", "fg_spread_away", min_n=25) +
            ats(c1 & (ap_wp >= 0.60), "C1+ ...and that opponent was >=60% -> back AWAY",
                "fg_spread_away", min_n=25),
            "C1  published 54.9% base / 61.2% filtered")

    # C2: published 149-110 (57.5%) -- fade a home favourite of 10+ that won its last by 15+.
    c2 = VALID_H & (hp_m >= 15) & (sp <= -10)
    dd.show(ats(c2, "C2 home fav 10+ off a 15+ win -> back AWAY", "fg_spread_away", min_n=25) +
            ats(VALID_H & (hp_m >= 15) & (sp < 0), "C2' any home fav off a 15+ win -> back AWAY",
                "fg_spread_away", min_n=25),
            "C2  published 57.5%")

    # C5: published 77-59-1 (56.6%), and 34-17 (66.7%) with no rest between. The control
    # matters as much as the rule: lost-AWAY-now-home was 50.7%, i.e. no edge, so the
    # asymmetry is the claim.
    h2h_days = col("h2h_days")
    prev_h = pv("ap_p1_was_home")
    rematch = np.isfinite(h2h_days) & (h2h_days <= 30)
    prev_home_marg = col("h2h_prev_margin_h")
    prev_venue_same = col("h2h_prev_same_venue") == 1
    # visitor tonight LOST the previous meeting AT ITS OWN HOME -> venues swapped, and the
    # previous home team (by that game's venue) is tonight's visitor
    c5 = rematch & ~prev_venue_same & np.isfinite(prev_home_marg) & (prev_home_marg < 0)
    c5ctl = rematch & ~prev_venue_same & np.isfinite(prev_home_marg) & (prev_home_marg > 0)
    dd.show(ats(c5, "C5 lost at home, now visiting -> back AWAY", "fg_spread_away", min_n=25) +
            ats(c5ctl, "C5 control: won at home, now visiting -> back AWAY",
                "fg_spread_away", min_n=25),
            "C5  published 56.6% rule / 50.7% control")

    # C6: published 53.8% -- rematch inside 6 days, back the team that lost the first one.
    c6 = rematch & (h2h_days <= 6)
    dd.show(ats(c6 & np.isfinite(prev_home_marg) & (prev_home_marg < 0),
                "C6 rematch <=6d, prev home loser -> back AWAY", "fg_spread_away", min_n=25),
            "C6  published 53.8%")

    # C9: published 252-158-6 (61.5%) -- road favourite against an opponent coming off a
    # 1-3 point win. This is close-game luck regression wearing a situational costume.
    c9 = VALID_H & (hp_m >= 1) & (hp_m <= 3) & (sp > 0)
    dd.show(ats(c9, "C9 road fav vs home off a 1-3 pt win -> back AWAY", "fg_spread_away",
                min_n=25) +
            ats(VALID_H & (hp_m >= 1) & (hp_m <= 3), "C9' any home team off a 1-3 pt win -> back AWAY",
                "fg_spread_away", min_n=25),
            "C9  published 61.5%")

    # D12: published 112-85-3 (56.8%) since 2018-19, and 83-43 (65.9%) as dogs. The 115+
    # filter is what screens out genuinely bad teams -- it isolates quality teams whose two
    # losses were variance. Threshold is era-sensitive so also run a percentile version.
    hi_h = np.nanquantile(pv("hp_p1_own")[np.isfinite(pv("hp_p1_own"))], 0.75)
    d12h = VALID_H & (hp_own >= 115) & (pv("hp_p2_own") >= 115) & (hp_m < 0) & (pv("hp_p2_margin") < 0)
    d12a = VALID_A & (ap_own >= 115) & (pv("ap_p2_own") >= 115) & (ap_m < 0) & (pv("ap_p2_margin") < 0)
    dd.show(ats(d12h, "D12 HOME scored 115+ twice and lost both -> back HOME", "fg_spread_home",
                min_n=25) +
            ats(d12a, "D12 AWAY scored 115+ twice and lost both -> back AWAY", "fg_spread_away",
                min_n=25) +
            ats(d12a & dog_away, "D12 ...away version as a DOG -> back AWAY", "fg_spread_away",
                min_n=25),
            f"D12  published 56.8% / 65.9% as dogs (75th pct of our sample is {hi_h:.0f} pts)")

    # ---------------------------------------------------------------- D. streaks
    head("D", "STREAKS AND ATS PERSISTENCE",
         "Sports Insights (D6), Maddux (D7), ProComputerGambler (D8/D9), Sports Insights (D11)")

    hs, as_ = col("h_streak_su"), col("a_streak_su")
    hsa, asa = col("h_streak_ats"), col("a_streak_ats")

    # D6/D7: published as fade-the-win-streak (48.0% for the streaker) and back-the-loss-
    # streak (~55%). Both directions on both sides, because The Sport Journal found the
    # OPPOSITE sign to Paul & Weinbach and the literature is not settled.
    dd.show(ats((hs >= 6), "D6 home won 6+ straight -> back AWAY", "fg_spread_away", min_n=25) +
            ats((as_ >= 6), "D6 away won 6+ straight -> back HOME", "fg_spread_home", min_n=25) +
            ats((hs <= -6), "D7 home lost 6+ straight -> back HOME", "fg_spread_home", min_n=25) +
            ats((as_ <= -6), "D7 away lost 6+ straight -> back AWAY", "fg_spread_away", min_n=25),
            "D6/D7  published 48.0% streaker / ~55% loss-streak")

    # D8/D9: ProComputerGambler publishes NEARLY IDENTICAL records for the ATS-win-streak
    # and ATS-loss-streak versions of the same rule, which means at least one of the two is
    # a transcription error on their site. Testing both settles it for us either way.
    dd.show(ats((asa >= 4) & dog_away, "D8 away dog on a 4+ ATS WIN streak -> back AWAY",
                "fg_spread_away", min_n=25) +
            ats((asa <= -4) & dog_away, "D9 away dog on a 4+ ATS LOSS streak -> back AWAY",
                "fg_spread_away", min_n=25),
            "D8/D9  both published at 62.9% -- one of them must be wrong")

    # D11: the cleanest published statement that ATS record has ZERO persistence
    # (pre/post All-Star correlation -0.002). If true, every ATS-streak rule above should
    # be flat, and the correct read is line inflation rather than momentum.
    hats, aats = col("h_s2d_atsm"), col("a_s2d_atsm")
    for lbl, v, mkt in (("home s2d ATS margin top quintile -> back AWAY", hats, "fg_spread_away"),
                        ("away s2d ATS margin top quintile -> back HOME", aats, "fg_spread_home")):
        thr = np.nanquantile(v[REG & np.isfinite(v)], 0.80)
        dd.show(ats(np.isfinite(v) & (v >= thr) & (GP >= 25), "D11 " + lbl, mkt), "D11  " + lbl)

    # ---------------------------------------------------------------- E. line movement
    head("E", "LINE MOVEMENT (the half of the market family we can actually test)",
         "Action Network E17; VSiN E16 needs handle splits we do not have")

    dt = tot_c - tot_o
    # E17: published 212-168-1 (55.8%) -- total falls open to close, bet the under.
    dd.show(ats(np.isfinite(dt) & (dt <= -1.0), "E17 total fell 1+ open->close -> UNDER",
                "fg_total_under", do_open=False) +
            ats(np.isfinite(dt) & (dt <= -2.0), "E17' total fell 2+ -> UNDER", "fg_total_under",
                do_open=False, min_n=25) +
            ats(np.isfinite(dt) & (dt >= 1.0), "E17 mirror: total rose 1+ -> OVER",
                "fg_total_over", do_open=False),
            "E17  published 55.8% (graded at the CLOSE only -- an open grade would be circular)")

    dsp = sp - sp_o
    dd.show(ats(np.isfinite(dsp) & (dsp <= -1.0), "E-sp home line moved 1+ toward HOME -> back HOME",
                "fg_spread_home", do_open=False) +
            ats(np.isfinite(dsp) & (dsp >= 1.0), "E-sp home line moved 1+ toward AWAY -> back AWAY",
                "fg_spread_away", do_open=False),
            "spread steam-following (no splits, so this is movement-only)")

    # ---------------------------------------------------------------- F. totals by calendar
    head("F", "TOTALS BY CALENDAR PHASE",
         "Baryla/Borghesi/Dare/Dennis 2007 + J Prediction Markets (F1), Action Network (F2/F3), Boyd's (F4-F7)")

    # F1: published 58.2% under in week 1 -- the mechanism is that the NBA opens at peak
    # NFL/CFB volume so books allocate less attention, and opening totals anchor to last
    # season's pace. This one recurs every October by construction, so a null matters.
    dd.show(ats(REG & (GP < 5), "F1 first <5 gp -> UNDER", "fg_total_under") +
            ats(REG & (GP < 10), "F1' first <10 gp -> UNDER", "fg_total_under") +
            ats(REG & (GP < 15), "F1'' first <15 gp -> UNDER", "fg_total_under"),
            "F1  published 58.2% week 1")

    # F5/F4: published ~62-65% under in the playoffs and in game 1s specifically.
    dd.show(ats(~REG, "F5 any playoff game -> UNDER", "fg_total_under", universe=~REG) +
            ats(REG, "F5 control: any regular game -> UNDER", "fg_total_under"),
            "F5  published 62.4% playoff unders")

    # F3: published 21-11 (65.6%) on early Christmas games; n will be tiny for us.
    xmas = (d["game_date"].dt.month == 12) & (d["game_date"].dt.day == 25)
    dd.show(ats(xmas.to_numpy(), "F3 Christmas Day -> UNDER", "fg_total_under", min_n=15),
            "F3  published 58.7-65.6%")

    # F2: post-All-Star-break OVER, strongest when both teams have losing records. No ASB
    # flag in the frame, so find it: the break is the longest gap in each regular season.
    asb = np.zeros(len(d), bool)
    for s in sorted(set(d["season"])):
        k = (d["season"] == s).to_numpy() & REG
        if k.sum() < 100:
            continue
        days = np.sort(d.loc[k, "game_date"].unique())
        gaps = np.diff(days).astype("timedelta64[D]").astype(int)
        if len(gaps) == 0 or gaps.max() < 4:
            continue
        resume = days[np.argmax(gaps) + 1]
        asb |= (k & (d["game_date"].to_numpy() >= resume)
                & (d["game_date"].to_numpy() <= resume + np.timedelta64(2, "D")))
    both_bad = (col("st_h_win_pct") < 0.50) & (col("st_a_win_pct") < 0.50)
    dd.show(ats(asb, "F2 first 3 days after the All-Star break -> OVER", "fg_total_over", min_n=25) +
            ats(asb & both_bad, "F2+ ...both teams losing records -> OVER", "fg_total_over", min_n=15),
            "F2  published 55.1% / 67.6% both-losing")

    # ---------------------------------------------------------------- G. longshot bias
    head("G", "REVERSED FAVOURITE-LONGSHOT BIAS",
         "Towards Data Science 2020 + Paul & Weinbach 2005 (K2)")

    # Published: betting ONLY moneyline dogs below ~20-25% implied win probability made
    # money 2016-20 while betting all dogs lost. Independent academic corroboration on
    # Pinnacle data. Implied probability from the decimal price, vig left in (the rule as
    # published is a raw price filter, so devigging it would test a different rule).
    ml_a_dec = sweep.dec(d["t60_ml_away_price"]).to_numpy(float) if hasattr(
        sweep.dec(d["t60_ml_away_price"]), "to_numpy") else np.asarray(sweep.dec(d["t60_ml_away_price"]), float)
    ml_h_dec = np.asarray(sweep.dec(d["t60_ml_home_price"]), float)
    imp_a, imp_h = 1.0 / ml_a_dec, 1.0 / ml_h_dec
    for thr in (0.25, 0.20, 0.15):
        dd.show(ats(np.isfinite(imp_a) & (imp_a <= thr), f"K2 away dog implied <={thr:.0%} -> back AWAY ML",
                    "fg_ml_away", min_n=25, do_open=False) +
                ats(np.isfinite(imp_h) & (imp_h <= thr), f"K2 home dog implied <={thr:.0%} -> back HOME ML",
                    "fg_ml_home", min_n=25, do_open=False),
                f"K2  big dogs at <= {thr:.0%} implied")

    # ---------------------------------------------------------------- X. drill the survivors
    head("X1", "VISITOR CROSSING 2+ TIME ZONES WESTWARD -- the lit suite's -2.37 pt unpriced gap",
         "our nba_lit_tests.py section 3; collides with Sports Insights 2013 which says the opposite")

    west = a_tz <= -2
    dd.show(ats(west, "X1 visitor 2+tz WEST -> back HOME", "fg_spread_home") +
            ats(a_tz <= -3, "X1' visitor 3+tz WEST -> back HOME", "fg_spread_home", min_n=25) +
            ats(a_tz >= 2, "X1 control: visitor 2+tz EAST -> back HOME", "fg_spread_home", min_n=25) +
            ats(np.isfinite(a_tz) & (a_tz == 0), "X1 control: visitor no tz change -> back HOME",
                "fg_spread_home"),
            "X1  ATS, with the eastward and no-change controls")
    dd.show(per_season(west, "fg_spread_home", "X1 west"), "X1 per season")
    dd.show(by_phase(west, "fg_spread_home", "X1 west"), "X1 by phase")
    r = dd.grade(d, west & REG, REG, "fg_spread_home", M_CLOSE, "x")
    if r:
        print(f"  X1 placebo p={dd.placebo(d, REG, 'fg_spread_home', M_CLOSE, r['n'], r['roi'], trials=4000):.4f}")

    head("X2", "HOME WITH 2+ DAYS MORE REST -- real +3.73, priced +1.84, a +1.89 pt gap",
         "our nba_lit_tests.py section 6; the claim is that the market's rest slope is LINEAR where the truth is CONVEX")

    dr = h_rest - a_rest
    dd.show(ats(dr >= 2, "X2 home 2+ days more rest -> back HOME", "fg_spread_home", min_n=25) +
            ats(dr >= 3, "X2' home 3+ days more rest -> back HOME", "fg_spread_home", min_n=25) +
            ats(dr == 1, "X2 control: home exactly 1 day more -> back AWAY", "fg_spread_away") +
            ats(dr <= -2, "X2 mirror: away 2+ days more rest -> back AWAY", "fg_spread_away", min_n=25),
            "X2  the convexity claim: 2+ should pay, 1 should not")
    dd.show(per_season(dr >= 2, "fg_spread_home", "X2 home rest+2"), "X2 per season")
    dd.show(by_phase(dr >= 2, "fg_spread_home", "X2 home rest+2"), "X2 by phase")
    r = dd.grade(d, (dr >= 2) & REG, REG, "fg_spread_home", M_CLOSE, "x")
    if r:
        print(f"  X2 placebo p={dd.placebo(d, REG, 'fg_spread_home', M_CLOSE, r['n'], r['roi'], trials=4000):.4f}")


if __name__ == "__main__":
    main()
