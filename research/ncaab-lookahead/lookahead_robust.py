#!/usr/bin/env python3
"""Robustness for the one look-ahead read that showed up: a ranked (as of tonight) opponent is NEXT, within 3 days ->
the team covers TONIGHT (the market over-prices the letdown). Reuses the frame built in lookahead_study.py."""
import numpy as np
import pandas as pd
import importlib.util, sys, io, contextlib

spec = importlib.util.spec_from_file_location("ls", "lookahead_study.py")
ls = importlib.util.module_from_spec(spec)
with contextlib.redirect_stdout(io.StringIO()):
    spec.loader.exec_module(ls)
U, fmt, rec = ls.U, ls.fmt, ls.rec
RNG = np.random.default_rng(7)

soon = U.n_days <= 3
print("universe with the next game within 3 days:", int(soon.sum()), "| without any ranked opponent next:", fmt(U[soon & ~U.n_top25_opp]))
for lab, m in (("next opp top-25, within 3 days", soon & U.n_top25_opp), ("next opp top-10, within 3 days", soon & U.n_top10_opp),
               ("next opp top-5, within 3 days", soon & (U.n_o_rank_asof <= 5)), ("next opp 11-25, within 3 days", soon & U.n_o_rank_asof.between(11, 25)),
               ("next opp top-10, 4-7 days", (U.n_days.between(4, 7)) & U.n_top10_opp), ("next opp top-10, next day", (U.n_days == 1) & U.n_top10_opp),
               ("next opp top-10, 2 days", (U.n_days == 2) & U.n_top10_opp), ("next opp top-10, 3 days", (U.n_days == 3) & U.n_top10_opp)):
    s = U[m]
    print(f"  {lab:34s} {fmt(s):50s} by season " + "  ".join(f"{k} {int((x.ats_pts > 0).sum())}-{int((x.ats_pts < 0).sum())}" for k, x in s.groupby('season')))

C3 = U[soon & U.n_top10_opp]
print("\nC3 = next opponent top-10 (as of tonight), next game within 3 days:", fmt(C3))
print("  at the opener (ats_open not in frame) -- skipped; T-60 close only")
base = U[soon & ~U.n_top25_opp]
bands = pd.cut(U.spread, [-99, -15, -7, -3, 0, 3, 7, 99]); U["band"] = bands
print("  by spread band vs the within-3-days-no-lookahead baseline:")
exp_num = exp_den = 0
for b, sb in C3.groupby(U.band[C3.index], observed=True):
    bb = base[U.band[base.index] == b]
    print(f"     {str(b):12s} C3 {fmt(sb):45s} | baseline {fmt(bb)}")
    if len(bb):
        exp_num += rec(bb)[3] * len(sb); exp_den += len(sb)
print(f"  band-weighted expected from baseline {exp_num / exp_den:.1%} vs observed {rec(C3)[3]:.1%}")
for lab, m in (("tonight's opponent unranked", C3.o_ap_rank.isna()), ("tonight's opponent ranked", C3.o_ap_rank <= 25), ("team ranked tonight", C3.ap_rank <= 25),
               ("team unranked tonight", C3.ap_rank.isna()), ("favored", C3.spread < 0), ("dog", C3.spread > 0), ("home", C3.is_home == 1), ("road", (C3.is_home == 0) & (C3.neutral == 0)),
               ("conference game", C3.conf_game == 1), ("non-conference", C3.conf_game == 0), ("Nov-Dec", C3.month.isin([11, 12])), ("Jan-Mar", C3.month.isin([1, 2, 3]))):
    s = C3[m]
    if len(s) >= 30:
        print(f"     {lab:30s} {fmt(s)}")
pool = U[soon].copy(); obs = rec(C3)[3]; sims = []
for _ in range(1000):
    pool["flag"] = pool.groupby("date").n_top10_opp.transform(lambda s: RNG.permutation(s.values))
    sims.append(rec(pool[pool.flag])[3])
sims = np.array(sims)
print(f"  within-night permutation among teams with a game inside 3 days: null {sims.mean():.1%} ± {sims.std():.1%}, p = {(sims >= obs).mean():.3f}")
print("  contributors: " + "; ".join(f"{t} {int((x.ats_pts > 0).sum())}-{int((x.ats_pts < 0).sum())}" for t, x in sorted(C3.groupby('team'), key=lambda kv: -len(kv[1]))[:12]))
m = C3[C3.tot_resid.notna()]
print(f"  totals in C3: over {int((m.tot_resid > 0).sum())}-{int((m.tot_resid < 0).sum())}; first half {fmt(C3[C3.h1_ats_pts.notna() & (C3.h1_ats_pts != 0)], 'h1_ats_pts')}")
# the mirror from the opponent's side (tonight's opponent faces a team with a top-10 game inside 3 days)
print(f"  mirror -- opponents of C3 teams: {fmt(U[U.opp_la & (U.n_days.notna())])} (top-25 version; the frame carries opp_la only)")
