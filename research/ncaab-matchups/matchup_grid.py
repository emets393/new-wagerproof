#!/usr/bin/env python3
"""NCAAB matchup interactions, totals first (owner direction 2026-10-28, after the size-vs-defense over): the market prices TEAMS,
not the way two teams fit together. Pre-stated two-team cells graded at the T-60 close over six seasons, from the "own" team's row.

Cells (hypothesised direction stated before grading; both directions printed, the shuffle p is for the stated one):
  M1 turnovers   own turnover rate top quarter  x  opp forces turnovers top quarter          -> total ?, opp ATS
  M2 glass       own offensive rebounding top quarter  x  opp allows offensive boards top quarter -> OVER, own ATS
  M3 fouls       own free-throw rate top quarter  x  opp fouls a lot (d_ftr top quarter)     -> OVER
  M4 pace        own fast (top quarter)  x  opp slow (bottom quarter): who dictates; total by which side is favored
  M5 experience  KenPom Exp / Bench gap, by venue and month                                  -> own ATS
  M6 threes      own 3-heavy  x  opp takes threes away / gives them up                       -> UNDER / OVER
Each cell also split by the opponent's KenPom AdjDE quintile (the size result lived at the best defenses) and by season.
Inputs: cbb_sit_panel style percentiles (expanding mean of PRIOR games, ranked within season), KenPom height/Exp/Bench (season roster),
KenPom AdjDE/AdjOE as of the game (archive), T-60 lines and prices. Writes MATCHUP_GRID.txt.
"""
import os
import numpy as np
import pandas as pd

ROOT = os.path.dirname(os.path.abspath(__file__)); BB = os.path.join(ROOT, "..", "bball-odds", "data", "parquet")
rng = np.random.default_rng(11); out = open(os.path.join(ROOT, "MATCHUP_GRID.txt"), "w")
def P(*a):
    s = " ".join(str(x) for x in a); print(s); out.write(s + "\n"); out.flush()

style = ["pct_pace", "pct_p3a_rate", "pct_p3_pct", "pct_ftr", "pct_oreb", "pct_to_rate", "pct_paint_share", "pct_d_p3a_rate", "pct_d_paint100", "pct_d_ftr", "pct_d_efg", "pct_d_to_forced", "pct_d_oreb_allowed", "Exp", "Bench", "HgtEff"]
cols = ["cbbd_id", "season", "month", "is_home", "neutral", "conf_game", "conf_tourney", "ncaa_t", "own_pts", "opp_pts", "spread", "total_line", "tot_resid", "ats_pts", "win", "ml_price", "spread_price", "own_kp_em", "o_kp_em", "own_s2d_pace", "o_s2d_pace"] + [f"{s}_{c}" for s in ("h", "a") for c in style]
D = pd.read_parquet(f"{BB}/cbb_sit_panel.parquet", columns=cols)
F = pd.read_parquet(f"{BB}/ncaab_model_features.parquet", columns=["cbbd_id", "home_kp_de", "away_kp_de", "home_kp_oe", "away_kp_oe", "t60_total_under_price", "t60_total_over_price"]).drop_duplicates("cbbd_id")
B = pd.read_parquet(f"{BB}/cbbd_team_box.parquet", columns=["gameId", "teamId", "pace", "teamStats.possessions"]).drop_duplicates(["gameId", "teamId"]).rename(columns={"gameId": "cbbd_id", "pace": "game_pace", "teamStats.possessions": "game_poss"})
T = pd.read_parquet(f"{BB}/cbb_sit_panel.parquet", columns=["cbbd_id", "is_home", "teamId"]).drop_duplicates(["cbbd_id", "is_home"])
D = D.merge(F, on="cbbd_id", how="left").merge(T, on=["cbbd_id", "is_home"], how="left").merge(B, on=["cbbd_id", "teamId"], how="left")
D = D[D.total_line.notna() & D.spread.notna()].copy(); D["season_end"] = D.season.str[:4].astype(int) + 1
h = D.is_home == 1
for c in style:
    D[f"own_{c}"] = np.where(h, D[f"h_{c}"], D[f"a_{c}"]); D[f"opp_{c}"] = np.where(h, D[f"a_{c}"], D[f"h_{c}"])
D["opp_de"] = np.where(h, D.away_kp_de, D.home_kp_de); D["own_de"] = np.where(h, D.home_kp_de, D.away_kp_de)
D["opp_def_pct"] = D.groupby(["season_end", "month"]).opp_de.rank(pct=True)
D["def_q"] = pd.cut(D.opp_def_pct, [-0.01, 0.2, 0.4, 0.6, 0.8, 1.0], labels=["Q1 best D", "Q2", "Q3", "Q4", "Q5 worst D"])
D["under"] = np.sign(-D.tot_resid); D["cover"] = np.sign(D.ats_pts); D["under_price"] = D.t60_total_under_price.fillna(1.91); D["over_price"] = D.t60_total_over_price.fillna(1.91)
D["novdec"] = D.month.isin([11, 12]); D["march"] = D.month.isin([3]); D["key"] = D.season_end.astype(str) + "-" + D.month.astype(str)
D["bs_b"] = pd.cut(-D.spread, [-60, -20, -15, -10, -5, 0, 5, 60])
D["exp_gap"] = D.own_Exp - D.opp_Exp; D["bench_gap"] = D.own_Bench - D.opp_Bench
valid = D.own_pct_pace.notna() & D.opp_pct_pace.notna() & D.opp_def_pct.notna()
base_over = D[valid].groupby("bs_b").apply(lambda g: 100 * (g.under < 0).sum() / max((g.under != 0).sum(), 1))
P(f"team-games {len(D):,}; with style + AdjDE {int(valid.sum()):,}; base over {100*(D[valid].under<0).sum()/(D[valid].under!=0).sum():.1f}%, base own cover 50.0%")


def rec(s): return int((s > 0).sum()), int((s < 0).sum())
def shuffle_p(mask, sgn, n=800):
    m = mask.values.astype(bool); s = sgn.values; ok = ~np.isnan(s); m, s, k = m[ok], s[ok], D.key.values[ok]; obs = s[m].sum()
    groups = {}
    for i, kk in enumerate(k): groups.setdefault(kk, []).append(i)
    groups = [(np.array(v), m[np.array(v)].sum()) for v in groups.values() if m[np.array(v)].sum() > 0]
    null = np.array([sum(s[rng.choice(idx, cnt, replace=False)].sum() for idx, cnt in groups) for _ in range(n)])
    return float((np.abs(null) >= abs(obs)).mean())


def cell(label, mask, tot_dir=None, side_dir=None, p=False, per=False):
    s = D[mask & valid]; n = len(s)
    if n < 80: P(f"  {label:<78} n={n} (thin)"); return
    uw, ul = rec(s.under); cw, cl = rec(s.cover)
    o_roi = 100 * (((s.over_price - 1) * (s.under < 0)).sum() - (s.under > 0).sum()) / max(uw + ul, 1); u_roi = 100 * (((s.under_price - 1) * (s.under > 0)).sum() - (s.under < 0).sum()) / max(uw + ul, 1)
    exp_over = s.bs_b.map(base_over).astype(float).mean()
    txt = f"  {label:<78} n={n:5d} | OVER {ul}-{uw} ({100*ul/max(uw+ul,1):.1f}%, {o_roi:+.1f}%; spread-matched {exp_over:.1f}%) UNDER roi {u_roi:+.1f}% tot {s.tot_resid.mean():+.2f} | own ATS {cw}-{cl} ({100*cw/max(cw+cl,1):.1f}%) | line {s.total_line.mean():.1f} own sprd {s.spread.mean():+.1f}"
    if p:
        if tot_dir: txt += f" | p({tot_dir}) {shuffle_p(mask & valid, D.under if tot_dir == 'under' else -D.under):.3f}"
        if side_dir: txt += f" | p(own ATS) {shuffle_p(mask & valid, D.cover):.3f}"
    P(txt)
    if per:
        P("      by season: " + " | ".join(f"{str(y)[2:]}: O {rec(g.under)[1]}-{rec(g.under)[0]} ATS {rec(g.cover)[0]}-{rec(g.cover)[1]}" for y, g in s.groupby("season_end")))


def by_def(label, mask):
    for q in D.def_q.cat.categories: cell(f"    {label} | opp D {q}", mask & (D.def_q == q))


hi = lambda c: D[c] >= 0.75; lo = lambda c: D[c] <= 0.25  # noqa: E731

P("\n=== M1. TURNOVERS: turnover-prone offense vs a defense that forces them ===")
m1 = hi("own_pct_to_rate") & hi("opp_pct_d_to_forced")
cell("M1 own TO rate top quarter & opp forces TOs top quarter", m1, "under", "cover", p=True, per=True)
cell("   control: own TO rate top quarter, opp forces TOs BOTTOM quarter", hi("own_pct_to_rate") & lo("opp_pct_d_to_forced"))
cell("   control: own TO rate BOTTOM quarter (ball-secure) & opp forces TOs top quarter", lo("own_pct_to_rate") & hi("opp_pct_d_to_forced"))
by_def("M1", m1)
P("  -- dose: own TO-rate quintile inside opp forces TOs top quarter")
for q in range(5): cell(f"     own TO rate quintile {q+1}", D.own_pct_to_rate.between(q / 5, (q + 1) / 5) & hi("opp_pct_d_to_forced"))

P("\n=== M2. GLASS: offensive-rebounding team vs a defense that gives up boards ===")
m2 = hi("own_pct_oreb") & hi("opp_pct_d_oreb_allowed")
cell("M2 own OREB top quarter & opp allows OREB top quarter", m2, "over", "cover", p=True, per=True)
cell("   control: own OREB top quarter & opp allows OREB BOTTOM quarter (good D-glass)", hi("own_pct_oreb") & lo("opp_pct_d_oreb_allowed"))
cell("   M2 & own taller by 1+ (HgtEff)", m2 & (D.own_HgtEff - D.opp_HgtEff >= 1))
cell("   M2 & own as underdog", m2 & (D.spread > 0)); cell("   M2 & own as favorite", m2 & (D.spread < 0))
by_def("M2", m2)
P("  -- dose: own OREB quintile inside opp allows OREB top quarter")
for q in range(5): cell(f"     own OREB quintile {q+1}", D.own_pct_oreb.between(q / 5, (q + 1) / 5) & hi("opp_pct_d_oreb_allowed"))

P("\n=== M3. FOULS: gets-to-the-line offense vs a defense that fouls ===")
m3 = hi("own_pct_ftr") & hi("opp_pct_d_ftr")
cell("M3 own FT rate top quarter & opp fouls (d_ftr) top quarter", m3, "over", None, p=True, per=True)
cell("   control: own FT rate top quarter & opp does NOT foul (bottom quarter)", hi("own_pct_ftr") & lo("opp_pct_d_ftr"))
cell("   control: own FT rate BOTTOM quarter & opp fouls top quarter", lo("own_pct_ftr") & hi("opp_pct_d_ftr"))
cell("   BOTH teams get to the line & BOTH foul (all four top half)", (D.own_pct_ftr >= .5) & (D.opp_pct_ftr >= .5) & (D.own_pct_d_ftr >= .5) & (D.opp_pct_d_ftr >= .5))
by_def("M3", m3)
P("  -- dose: own FT-rate quintile inside opp fouls top quarter")
for q in range(5): cell(f"     own FT rate quintile {q+1}", D.own_pct_ftr.between(q / 5, (q + 1) / 5) & hi("opp_pct_d_ftr"))

P("\n=== M4. PACE MISMATCH: fast team vs slow team -- who dictates, and does the total know? ===")
m4 = hi("own_pct_pace") & lo("opp_pct_pace")   # own = the FAST team
s = D[m4 & valid & D.game_pace.notna()]
mid = (s.own_s2d_pace + s.o_s2d_pace) / 2
P(f"  fast (own) vs slow (opp): n {len(s)}; realised pace {s.game_pace.mean():.1f} vs midpoint of the two season paces {mid.mean():.1f} (fast team {s.own_s2d_pace.mean():.1f}, slow {s.o_s2d_pace.mean():.1f})")
for nm, mm in (("fast team favored", s.spread < 0), ("slow team favored", s.spread > 0)):
    g = s[mm]; P(f"    {nm:<18} n {len(g)}: realised pace {g.game_pace.mean():.1f} vs midpoint {((g.own_s2d_pace + g.o_s2d_pace)/2).mean():.1f}  -> the {'favorite' if (g.game_pace - (g.own_s2d_pace + g.o_s2d_pace)/2).mean() * (1 if nm.startswith('fast') else -1) > 0 else 'underdog'} dictates by {abs((g.game_pace - (g.own_s2d_pace + g.o_s2d_pace)/2).mean()):.1f} poss")
cell("M4 fast vs slow, all", m4, None, None, per=True)
cell("   fast team FAVORED", m4 & (D.spread < 0), "over", "cover", p=True); cell("   fast team favored by 10+", m4 & (D.spread <= -10))
cell("   slow team FAVORED", m4 & (D.spread > 0), "under", None, p=True); cell("   slow team favored by 10+", m4 & (D.spread >= 10))
cell("   fast vs slow, slow team is top-20% D", m4 & (D.opp_def_pct <= .2)); cell("   fast vs slow, slow team is bottom-half D", m4 & (D.opp_def_pct > .5))
cell("   control: fast vs fast (both top quarter)", hi("own_pct_pace") & hi("opp_pct_pace")); cell("   control: slow vs slow (both bottom quarter)", lo("own_pct_pace") & lo("opp_pct_pace"))

P("\n=== M5. EXPERIENCE AND BENCH (KenPom Exp = years, Bench = minutes share) ===")
for g_lo, nm in ((1.0, "own 1+ year more experienced"), (1.5, "own 1.5+ years more experienced")):
    m = D.exp_gap >= g_lo
    cell(f"M5 {nm}", m, None, "cover", p=True, per=True)
    cell(f"   ... on the ROAD", m & (D.is_home == 0) & (D.neutral == 0)); cell(f"   ... at HOME", m & (D.is_home == 1) & (D.neutral == 0)); cell(f"   ... NEUTRAL", m & (D.neutral == 1))
    cell(f"   ... Nov-Dec", m & D.novdec); cell(f"   ... March", m & D.march); cell(f"   ... conference tournament", m & (D.conf_tourney == 1)); cell(f"   ... NCAA tournament", m & (D.ncaa_t == 1))
    cell(f"   ... as underdog", m & (D.spread > 0)); cell(f"   ... as underdog of 7+", m & (D.spread >= 7)); cell(f"   ... as favorite", m & (D.spread < 0))
cell("M5 own far LESS experienced (gap <= -1.5), as favorite", (D.exp_gap <= -1.5) & (D.spread < 0)); cell("   ... as favorite of 10+", (D.exp_gap <= -1.5) & (D.spread <= -10))
P("  -- dose: experience gap bins, own ATS and total")
for lo_, hi_ in ((-9, -1.5), (-1.5, -0.5), (-0.5, 0.5), (0.5, 1.5), (1.5, 9)): cell(f"     exp gap {lo_}..{hi_}", D.exp_gap.between(lo_, hi_, inclusive="left"))
cell("M5b deep bench vs thin bench (bench gap >= 10 pts of minutes share)", D.bench_gap >= 10, None, "cover", p=True)
cell("   ... in the second game of a back-to-back / 3 games in 3 days (not available: skipped)", D.cbbd_id < 0)
cell("   ... March", (D.bench_gap >= 10) & D.march); cell("   ... fast game expected (both top-half pace)", (D.bench_gap >= 10) & (D.own_pct_pace >= .5) & (D.opp_pct_pace >= .5))

P("\n=== M6. THREES: 3-heavy offense vs a defense that takes threes away / gives them up ===")
cell("M6a own 3PA rate top quarter & opp allows FEW threes (d_p3a_rate bottom quarter)", hi("own_pct_p3a_rate") & lo("opp_pct_d_p3a_rate"), "under", "cover", p=True, per=True)
cell("M6b own 3PA rate top quarter & opp allows MANY threes (top quarter)", hi("own_pct_p3a_rate") & hi("opp_pct_d_p3a_rate"), "over", "cover", p=True, per=True)
cell("   M6a & own shoots it WELL (3P% top half)", hi("own_pct_p3a_rate") & lo("opp_pct_d_p3a_rate") & (D.own_pct_p3_pct >= .5)); cell("   M6b & own shoots it WELL", hi("own_pct_p3a_rate") & hi("opp_pct_d_p3a_rate") & (D.own_pct_p3_pct >= .5))
by_def("M6a", hi("own_pct_p3a_rate") & lo("opp_pct_d_p3a_rate")); by_def("M6b", hi("own_pct_p3a_rate") & hi("opp_pct_d_p3a_rate"))

P("\n=== M7. THE SIZE RESULT'S COUSINS: other 'bad offense meets great defense' pairings on the total ===")
cell("M7a own 3P% bottom quarter & opp eFG allowed bottom quarter (elite shot D)", lo("own_pct_p3_pct") & lo("opp_pct_d_efg"), "over", None, p=True, per=True)
cell("M7b own TO rate top quarter & opp top-20% AdjDE", hi("own_pct_to_rate") & (D.opp_def_pct <= .2), "over", None, p=True)
cell("M7c own paint share top quarter & opp paint D bottom quarter (rim protection), 2022-23 on", hi("own_pct_paint_share") & lo("opp_pct_d_paint100") & (D.season_end >= 2023), "over", None, p=True, per=True)
cell("M7d own OREB top quarter & opp top-20% AdjDE", hi("own_pct_oreb") & (D.opp_def_pct <= .2), "over", None, p=True)
cell("M7e own offense bottom-20% (KenPom AdjOE pct) & opp top-20% AdjDE, any style", (D.groupby(['season_end','month']).apply(lambda g: g) is not None) & (np.where(h, D.home_kp_oe, D.away_kp_oe) <= D.groupby(['season_end','month'])[['home_kp_oe']].transform(lambda s: s.quantile(.2)).home_kp_oe) & (D.opp_def_pct <= .2), "over", None, p=True, per=True)
out.close()
