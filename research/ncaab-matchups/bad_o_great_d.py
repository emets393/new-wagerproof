#!/usr/bin/env python3
"""Follow-up to the grid: the 'bad offense meets great defense -> OVER' family (M7a/M7b/M7e, and the size signal). Is it one thing?
AdjOE x AdjDE quintile grid on the total, overlap with the size cell, the two side leans (glass + taller; deep-bench fade) per season."""
import io, contextlib, numpy as np, pandas as pd
with contextlib.redirect_stdout(io.StringIO()):
    import matchup_grid as M
D, valid, cell, P, rec = M.D, M.valid, M.cell, M.P, M.rec
import builtins
out = open("BAD_O_GREAT_D.txt", "w")
def P(*a):
    s = " ".join(str(x) for x in a); print(s); out.write(s + "\n"); out.flush()
M.P = P
h = D.is_home == 1
D["own_oe"] = np.where(h, D.home_kp_oe, D.away_kp_oe); D["opp_oe"] = np.where(h, D.away_kp_oe, D.home_kp_oe)
D["own_oe_pct"] = D.groupby(["season_end", "month"]).own_oe.rank(pct=True)          # 0 = worst offense
D["oe_q"] = pd.cut(D.own_oe_pct, [-0.01, 0.2, 0.4, 0.6, 0.8, 1.0], labels=["O Q1 worst", "O Q2", "O Q3", "O Q4", "O Q5 best"])
P("=== 1. OWN AdjOE quintile x OPP AdjDE quintile -> OVER % (n), six seasons, from the offense's row (each game appears from both sides) ===")
g = D[valid & D.oe_q.notna() & D.def_q.notna()]
hdr = "  {:<12}".format("") + "".join(f"{q:>22}" for q in D.def_q.cat.categories); P(hdr)
for oq in D.oe_q.cat.categories:
    row = []
    for dq in D.def_q.cat.categories:
        s = g[(g.oe_q == oq) & (g.def_q == dq)]; uw, ul = rec(s.under); row.append(f"{100*ul/max(uw+ul,1):5.1f}% ({len(s):5d})")
    P("  {:<12}".format(oq) + "".join(f"{r:>22}" for r in row))
P("  spread-matched expectation for the corner (worst O vs best D): see cell below")
m7e = valid & (D.own_oe_pct <= .2) & (D.opp_def_pct <= .2)
cell("worst-20% offense vs best-20% defense (M7e)", m7e, "over", None, p=True, per=True)
cell("   ... worst-10% offense vs best-10% defense", valid & (D.own_oe_pct <= .1) & (D.opp_def_pct <= .1), "over", None, p=True)
cell("   ... worst-30% vs best-30%", valid & (D.own_oe_pct <= .3) & (D.opp_def_pct <= .3), "over", None, p=True)
cell("   ... Nov-Dec", m7e & D.novdec); cell("   ... Jan+", m7e & ~D.novdec); cell("   ... non-conference", m7e & (D.conf_game == 0)); cell("   ... conference", m7e & (D.conf_game == 1))
cell("   ... bad O at home", m7e & (D.is_home == 1) & (D.neutral == 0)); cell("   ... bad O on the road", m7e & (D.is_home == 0) & (D.neutral == 0))
cell("   ... total line < 135", m7e & (D.total_line < 135)); cell("   ... total 135-145", m7e & D.total_line.between(135, 145)); cell("   ... total > 145", m7e & (D.total_line > 145))
cell("   ... big team favored by 20+", m7e & (D.spread >= 20)); cell("   ... favored 10-20", m7e & D.spread.between(10, 20)); cell("   ... favored < 10", m7e & (D.spread < 10))
P("\n=== 2. OVERLAP with the size signal (3PA bottom quarter & 3P% below median & opp +1in & opp top-20% D) ===")
size = valid & (D.own_pct_p3a_rate <= .25) & (D.own_pct_p3_pct <= .5) & (D.opp_HgtEff - D.own_HgtEff >= 1) & (D.opp_def_pct <= .2)
cell("size signal", size, "over", None, per=True)
cell("   size signal AND bad-O-vs-great-D", size & m7e); cell("   size signal, NOT bad-O (offense above the 20th pct)", size & ~(D.own_oe_pct <= .2))
cell("   bad-O-vs-great-D, NOT size", m7e & ~size)
cell("   union (either)", size | m7e, "over", None, p=True, per=True)
P("\n=== 3. THE TWO SIDE LEANS, per season ===")
m2h = valid & (D.own_pct_oreb >= .75) & (D.opp_pct_d_oreb_allowed >= .75) & (D.own_HgtEff - D.opp_HgtEff >= 1)
cell("glass: own OREB top quarter & opp allows OREB top quarter & own taller by 1+", m2h, None, "cover", p=True, per=True)
cell("   ... own taller by 0.5+", valid & (D.own_pct_oreb >= .75) & (D.opp_pct_d_oreb_allowed >= .75) & (D.own_HgtEff - D.opp_HgtEff >= .5), None, "cover", p=True, per=True)
cell("   ... own taller by 2+", valid & (D.own_pct_oreb >= .75) & (D.opp_pct_d_oreb_allowed >= .75) & (D.own_HgtEff - D.opp_HgtEff >= 2))
cell("   ... glass cell, own SHORTER (gap <= -1)", valid & (D.own_pct_oreb >= .75) & (D.opp_pct_d_oreb_allowed >= .75) & (D.own_HgtEff - D.opp_HgtEff <= -1))
cell("   control: own OREB top quarter & own taller 1+ & opp D-glass GOOD (bottom quarter)", valid & (D.own_pct_oreb >= .75) & (D.opp_pct_d_oreb_allowed <= .25) & (D.own_HgtEff - D.opp_HgtEff >= 1))
bench = valid & (D.bench_gap >= 10)
cell("bench: own bench share 10+ pts higher than opp -> FADE own (own ATS shown)", bench, None, "cover", p=True, per=True)
cell("   ... gap 15+", valid & (D.bench_gap >= 15), None, "cover", p=True, per=True); cell("   ... gap 5-10", valid & D.bench_gap.between(5, 10))
cell("   ... own is the favorite", bench & (D.spread < 0)); cell("   ... own is the dog", bench & (D.spread > 0)); cell("   ... Nov-Dec", bench & D.novdec); cell("   ... Jan+", bench & ~D.novdec)
P(f"  bench-share correlates with: KenPom EM r={np.corrcoef(D[valid].own_Bench, D[valid].own_kp_em)[0,1]:+.2f}; spread r={np.corrcoef(D[valid].own_Bench, D[valid].spread)[0,1]:+.2f}  (is 'deep bench' just 'bad team'?)")
cell("   ... bench gap 10+ with KenPom EM within 5 of the opponent (matched quality)", bench & ((D.own_kp_em - D.o_kp_em).abs() <= 5), None, "cover", p=True)
out.close()
