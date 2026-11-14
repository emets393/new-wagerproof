#!/usr/bin/env python3
"""NCAAB early-season calendar spots (owner direction 2026-10-28, step 3). Pre-stated cells, six seasons at the T-60 close.

  C1  three games in three days (November multi-team events): the team on its 3rd game in 3 days -> ATS (fade?), total (under?);
      vs an opponent with more rest; by bench depth (KenPom Bench) and experience
  C2  first conference game(s) after a SOFT non-conference schedule with a shiny record: non-conf opponent KenPom EM in the bottom
      quarter of the season AND non-conf win% >= .80 -> fade in conference games 1-3; the mirror (hard schedule, poor record) -> back
  C3  long December layoff (exam break, rest >= 8 days) -> first game back: ATS, total
  C4  first true road game of the season (all home/neutral before it) -> ATS
  C5  MTE championship / third-place game (the event's last day) -> total
Inputs: cbb_sit_panel (mte flag, rest, p_date, gnum, conf_game, nonconf, o_kp_em as-of, KenPom Bench/Exp), T-60 lines. Writes CALENDAR_SPOTS.txt.
"""
import os
import numpy as np
import pandas as pd

ROOT = os.path.dirname(os.path.abspath(__file__)); BB = os.path.join(ROOT, "..", "bball-odds", "data", "parquet")
rng = np.random.default_rng(5); out = open(os.path.join(ROOT, "CALENDAR_SPOTS.txt"), "w")
def P(*a):
    s = " ".join(str(x) for x in a); print(s); out.write(s + "\n"); out.flush()
cols = ["cbbd_id", "season", "date", "month", "teamId", "opponentId", "is_home", "neutral", "conf_game", "nonconf", "conf_tourney", "ncaa_t", "mte", "gnum", "rest", "p_date", "own_pts", "opp_pts", "spread", "total_line",
        "tot_resid", "ats_pts", "win", "spread_price", "own_kp_em", "o_kp_em", "o_rest_days", "own_rest_days", "h_Bench", "a_Bench", "h_Exp", "a_Exp", "tournament", "notes", "gameType"]
D = pd.read_parquet(f"{BB}/cbb_sit_panel.parquet", columns=cols)
F = pd.read_parquet(f"{BB}/ncaab_model_features.parquet", columns=["cbbd_id", "t60_total_under_price", "t60_total_over_price"]).drop_duplicates("cbbd_id")
D = D.merge(F, on="cbbd_id", how="left"); D = D[D.spread.notna() & D.total_line.notna()].copy()
D["season_end"] = D.season.str[:4].astype(int) + 1; D["date"] = pd.to_datetime(D.date); D = D.sort_values(["season_end", "teamId", "date"])
g = D.groupby(["season_end", "teamId"])
D["pp_date"] = g.date.shift(2); D["p_conf"] = g.conf_game.shift(1); D["conf_num"] = g.conf_game.cumsum()        # conf_num = how many conference games incl. this one
D["prior_road"] = g.apply(lambda x: ((x.is_home == 0) & (x.neutral == 0)).shift(1).fillna(False).cumsum()).reset_index(level=[0, 1], drop=True)
h = D.is_home == 1
D["own_bench"] = np.where(h, D.h_Bench, D.a_Bench); D["opp_bench"] = np.where(h, D.a_Bench, D.h_Bench); D["own_exp"] = np.where(h, D.h_Exp, D.a_Exp)
D["under"] = np.sign(-D.tot_resid); D["cover"] = np.sign(D.ats_pts); D["under_price"] = D.t60_total_under_price.fillna(1.91); D["over_price"] = D.t60_total_over_price.fillna(1.91)
D["key"] = D.season_end.astype(str) + "-" + D.month.astype(str); D["bs_b"] = pd.cut(-D.spread, [-60, -20, -15, -10, -5, 0, 5, 60])
base_over = D.groupby("bs_b").apply(lambda x: 100 * (x.under < 0).sum() / max((x.under != 0).sum(), 1))
# three in three: this game, the previous and the one before within a 2-day span (dates are ET calendar days)
D["three_in_three"] = ((D.date - D.pp_date).dt.days <= 2) & D.pp_date.notna()
D["two_in_two"] = ((D.date - pd.to_datetime(D.p_date)).dt.days <= 1) & D.p_date.notna()
# opponent's three-in-three from the opponent's own row
opp = D[["cbbd_id", "teamId", "three_in_three", "two_in_two", "rest"]].rename(columns={"teamId": "opponentId", "three_in_three": "o_three", "two_in_two": "o_two", "rest": "o_rest"})
D = D.merge(opp, on=["cbbd_id", "opponentId"], how="left")
# non-conference resume as of the first conference game: nonconf opponent EM mean and win%
nc = D[(D.nonconf == 1) & (D.conf_tourney != 1) & (D.ncaa_t != 1)].groupby(["season_end", "teamId"]).agg(nc_sos=("o_kp_em", "mean"), nc_wp=("win", "mean"), nc_n=("win", "size"), nc_ats=("ats_pts", "mean")).reset_index()
nc["sos_q"] = nc.groupby("season_end").nc_sos.rank(pct=True)
D = D.merge(nc, on=["season_end", "teamId"], how="left")
P(f"team-games {len(D):,}; MTE rows {int((D.mte==1).sum()):,}; three-in-three rows {int(D.three_in_three.sum()):,}; two-in-two {int(D.two_in_two.sum()):,}")


def rec(s): return int((s > 0).sum()), int((s < 0).sum())
def shuffle_p(mask, sgn, n=800):
    m = mask.values.astype(bool); s = sgn.values; ok = ~np.isnan(s); m, s, k = m[ok], s[ok], D.key.values[ok]; obs = s[m].sum()
    groups = {}
    for i, kk in enumerate(k): groups.setdefault(kk, []).append(i)
    groups = [(np.array(v), m[np.array(v)].sum()) for v in groups.values() if m[np.array(v)].sum() > 0]
    null = np.array([sum(s[rng.choice(idx, cnt, replace=False)].sum() for idx, cnt in groups) for _ in range(n)])
    return float((np.abs(null) >= abs(obs)).mean())
def cell(label, mask, p=False, per=False):
    s = D[mask]; n = len(s)
    if n < 60: P(f"  {label:<80} n={n} (thin)"); return
    uw, ul = rec(s.under); cw, cl = rec(s.cover)
    o_roi = 100 * (((s.over_price - 1) * (s.under < 0)).sum() - (s.under > 0).sum()) / max(uw + ul, 1); u_roi = 100 * (((s.under_price - 1) * (s.under > 0)).sum() - (s.under < 0).sum()) / max(uw + ul, 1)
    c_roi = 100 * (((s.spread_price.fillna(1.91) - 1) * (s.cover > 0)).sum() - (s.cover < 0).sum()) / max(cw + cl, 1)
    txt = f"  {label:<80} n={n:5d} | own ATS {cw}-{cl} ({100*cw/max(cw+cl,1):.1f}%, {c_roi:+.1f}%) | UNDER {uw}-{ul} ({100*uw/max(uw+ul,1):.1f}%, {u_roi:+.1f}%; over roi {o_roi:+.1f}%, spread-matched over {s.bs_b.map(base_over).astype(float).mean():.1f}%) tot {s.tot_resid.mean():+.2f} | own sprd {s.spread.mean():+.1f}"
    if p: txt += f" | p(ATS) {shuffle_p(mask, D.cover):.3f} p(total) {shuffle_p(mask, D.under):.3f}"
    P(txt)
    if per: P("      by season: " + " | ".join(f"{str(y)[2:]}: ATS {rec(x.cover)[0]}-{rec(x.cover)[1]} U {rec(x.under)[0]}-{rec(x.under)[1]}" for y, x in s.groupby("season_end")))


P("\n=== C1. THREE GAMES IN THREE DAYS (November events) ===")
t3 = D.three_in_three & (D.month == 11)
cell("C1 own on its 3rd game in 3 days (Nov)", t3, p=True, per=True)
cell("   ... opponent NOT on 3 in 3 (fresher)", t3 & (D.o_three != True)); cell("   ... opponent ALSO on 3 in 3", t3 & (D.o_three == True))
cell("   ... opponent rested 2+ days", t3 & (D.o_rest >= 2)); cell("   ... own favored", t3 & (D.spread < 0)); cell("   ... own underdog", t3 & (D.spread > 0))
cell("   ... own deep bench (Bench share >= opp + 5)", t3 & (D.own_bench - D.opp_bench >= 5)); cell("   ... own thin bench (<= opp - 5)", t3 & (D.own_bench - D.opp_bench <= -5))
cell("   ... own experienced (Exp >= 2.0 yrs)", t3 & (D.own_exp >= 2.0)); cell("   ... own young (Exp < 1.5)", t3 & (D.own_exp < 1.5))
cell("   control: 2nd game in 2 days (Nov), not 3 in 3", D.two_in_two & ~D.three_in_three & (D.month == 11))
cell("   control: MTE game, rested (rest >= 2)", (D.mte == 1) & (D.rest >= 2))
cell("   ... 3 in 3 at ANY month (conference tournaments included)", D.three_in_three, per=True)
cell("   ... 3 in 3 in March (conference tournament days 3)", D.three_in_three & (D.month == 3))

P("\n=== C2. FIRST CONFERENCE GAMES AFTER THE NON-CONFERENCE RESUME ===")
first = D.conf_game == 1
for k_lo, k_hi, nm in ((1, 1, "conference game 1"), (1, 3, "conference games 1-3"), (1, 5, "conference games 1-5")):
    f = first & D.conf_num.between(k_lo, k_hi) & (D.conf_tourney != 1) & (D.nc_n >= 6)
    cell(f"C2 SOFT non-conf (opp EM bottom quarter) & non-conf win% >= .80: {nm}", f & (D.sos_q <= .25) & (D.nc_wp >= .8), p=(k_hi == 3), per=(k_hi == 3))
    cell(f"   ... & undefeated in non-conference: {nm}", f & (D.sos_q <= .25) & (D.nc_wp >= .999))
    cell(f"   HARD non-conf (opp EM top quarter) & non-conf win% <= .50: {nm}", f & (D.sos_q >= .75) & (D.nc_wp <= .5), p=(k_hi == 3), per=(k_hi == 3))
    cell(f"   control: soft schedule, mediocre record (win% .5-.7): {nm}", f & (D.sos_q <= .25) & D.nc_wp.between(.5, .7))
    cell(f"   control: hard schedule, good record (>= .7): {nm}", f & (D.sos_q >= .75) & (D.nc_wp >= .7))
f3 = first & D.conf_num.between(1, 3) & (D.conf_tourney != 1) & (D.nc_n >= 6)
cell("   soft+shiny, games 1-3, as FAVORITE", f3 & (D.sos_q <= .25) & (D.nc_wp >= .8) & (D.spread < 0)); cell("   soft+shiny, games 1-3, as DOG", f3 & (D.sos_q <= .25) & (D.nc_wp >= .8) & (D.spread > 0))
cell("   soft+shiny, games 1-3, on the ROAD", f3 & (D.sos_q <= .25) & (D.nc_wp >= .8) & (D.is_home == 0)); cell("   soft+shiny, games 1-3, at HOME", f3 & (D.sos_q <= .25) & (D.nc_wp >= .8) & (D.is_home == 1))
cell("   soft+shiny AND covered in non-conf (ATS margin >= +3/g)", f3 & (D.sos_q <= .25) & (D.nc_wp >= .8) & (D.nc_ats >= 3)); cell("   soft+shiny but did NOT cover in non-conf (<= 0)", f3 & (D.sos_q <= .25) & (D.nc_wp >= .8) & (D.nc_ats <= 0))
P("  -- dose: non-conf SOS quintile x win% >= .8, conference games 1-3, own ATS")
for q in range(5): cell(f"     SOS quintile {q+1} (1 = softest)", f3 & D.sos_q.between(q / 5, (q + 1) / 5) & (D.nc_wp >= .8))

P("\n=== C3. LONG DECEMBER LAYOFF (exam break) -> FIRST GAME BACK ===")
lay = (D.rest >= 8) & (D.month == 12)
cell("C3 own off 8+ days in December", lay, p=True, per=True)
cell("   ... 10+ days", (D.rest >= 10) & (D.month == 12)); cell("   ... opponent NOT off 8+ (rest <= 4)", lay & (D.o_rest <= 4)); cell("   ... both teams off 8+", lay & (D.o_rest >= 8))
cell("   ... own favored", lay & (D.spread < 0)); cell("   ... own dog", lay & (D.spread > 0)); cell("   ... power-conference? (KenPom EM > +10)", lay & (D.own_kp_em > 10)); cell("   ... weak team (EM < -5)", lay & (D.own_kp_em < -5))
cell("   control: 5-7 days off in December", D.rest.between(5, 7) & (D.month == 12))
cell("   long layoff in January-February (8+)", (D.rest >= 8) & D.month.isin([1, 2]))

P("\n=== C4. FIRST TRUE ROAD GAME OF THE SEASON ===")
road = (D.is_home == 0) & (D.neutral == 0)
fr = road & (D.prior_road == 0) & (D.gnum >= 3)
cell("C4 own's first true road game, after 3+ home/neutral games", fr, p=True, per=True)
cell("   ... after 5+ games at home/neutral", road & (D.prior_road == 0) & (D.gnum >= 5)); cell("   ... own favored", fr & (D.spread < 0)); cell("   ... own dog", fr & (D.spread > 0))
cell("   ... young team (Exp < 1.5)", fr & (D.own_exp < 1.5)); cell("   ... experienced (Exp >= 2)", fr & (D.own_exp >= 2.0)); cell("   ... non-conference", fr & (D.nonconf == 1)); cell("   ... it is a conference game", fr & (D.conf_game == 1))
cell("   control: own's 2nd-4th road game", road & D.prior_road.between(1, 3) & (D.month.isin([11, 12])))

P("\n=== C5. MTE FINAL DAY (championship / consolation) ===")
evt = D[(D.mte == 1)].copy()
last_day = evt.groupby(["season_end", "tournament"]).date.transform("max") if evt.tournament.notna().any() else None
D["mte_last"] = False
if last_day is not None:
    D.loc[evt.index, "mte_last"] = (evt.date == last_day) & evt.tournament.notna()
cell("C5 MTE last day, all games", D.mte_last, p=True, per=True)
cell("   ... both teams on 3 in 3", D.mte_last & D.three_in_three & (D.o_three == True)); cell("   ... MTE first day", (D.mte == 1) & ~D.mte_last & (D.rest >= 3))
out.close()
