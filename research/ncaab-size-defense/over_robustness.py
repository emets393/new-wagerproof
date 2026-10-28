#!/usr/bin/env python3
"""Second pass: the thesis cell ran OVER, not under. Is that real? Spread-matched control, threshold grid, ladders, opener vs close,
first half vs second half, blowout share, per-season walk. Re-imports the study module (reruns it, ~1 min)."""
import io, contextlib, numpy as np, pandas as pd
with contextlib.redirect_stdout(io.StringIO()):
    import size_defense_study as S
D = S.D; valid = S.valid
out = open("OVER_ROBUSTNESS.txt", "w")
def P(*a):
    s = " ".join(str(x) for x in a); print(s); out.write(s + "\n"); out.flush()
def over(m):
    s = D[m & D.hgt_gap.notna()]; w, l = int((s.under < 0).sum()), int((s.under > 0).sum())
    return w, l, (100 * w / max(w + l, 1)), len(s)
def line(label, m, extra=""):
    w, l, pct, n = over(m); s = D[m & D.hgt_gap.notna()]
    P(f"  {label:<70} OVER {w}-{l} ({pct:.1f}%) tot {s.tot_resid.mean():+.2f} n={n}{extra}")

P("=== 1. SPREAD-MATCHED CONTROL: over rate expected from the big team's spread alone ===")
D["bs_b"] = pd.cut(D.big_spread, [-60, -20, -15, -10, -5, 0, 5, 60])
base = D[valid].groupby("bs_b").apply(lambda g: pd.Series(dict(over=100 * (g.under < 0).sum() / max(((g.under != 0)).sum(), 1), n=len(g))))
P(base.round(1).to_string())
for nm, m in (("T1", S.T1), ("T4 (T1 & 3P% below median)", S.T1 & S.cant), ("X1 placebo (3-heavy)", valid & (D.own_pct_p3a_rate >= 0.75) & S.big1 & S.gd)):
    s = D[m & D.hgt_gap.notna()]; exp = s.bs_b.map(base.over).astype(float).mean(); w, l, pct, n = over(m)
    P(f"  {nm:<34} over {pct:.1f}% vs spread-matched expectation {exp:.1f}%  -> excess {pct-exp:+.1f} pts  (n {n})")

P("\n=== 2. THRESHOLD GRID for the thesis cell (over %, n) -- stability under definition wobble ===")
for lo3 in (0.20, 0.25, 0.33):
    row = []
    for gap in (0.5, 1.0, 1.5, 2.0):
        for dq in (0.15, 0.20, 0.30):
            w, l, pct, n = over(valid & (D.own_pct_p3a_rate <= lo3) & (D.hgt_gap >= gap) & (D.opp_def_pct <= dq))
            row.append(f"g{gap:g}/d{dq:.2f}: {pct:.1f}% ({n})")
    P(f"  3PA<={lo3:.2f} | " + " | ".join(row))

P("\n=== 3. LADDERS INSIDE THE PAIRS ===")
P("-- own 3P% quintile inside (opp taller 1+ & top-20% D & 3PA bottom quartile)")
for q in D.p3pct_q.cat.categories: line(f"   3P% {q}", S.T1 & (D.p3pct_q == q))
P("-- own 3P% quintile inside (opp taller 1+ & top-20% D), ANY 3PA rate")
for q in D.p3pct_q.cat.categories: line(f"   3P% {q}", valid & S.big1 & S.gd & (D.p3pct_q == q))
P("-- height gap inside (3PA bottom quartile & top-20% D)")
for q in D.gap_b.cat.categories: line(f"   gap {q}", valid & S.low3 & S.gd & (D.gap_b == q))
P("-- opp defense quintile inside (3PA bottom quartile & opp taller 1+)")
for q in D.def_q.cat.categories: line(f"   D {q}", valid & S.low3 & S.big1 & (D.def_q == q))
P("-- opp defense quintile inside (3P% bottom 40% & opp taller 1+), any 3PA rate")
for q in D.def_q.cat.categories: line(f"   D {q}", valid & (D.own_pct_p3_pct <= 0.4) & S.big1 & (D.def_q == q))

P("\n=== 4. WHERE DO THE EXTRA POINTS COME FROM? ===")
F = pd.read_parquet(f"{S.BB}/cbb_sit_panel.parquet", columns=["cbbd_id", "is_home", "open_total", "h1_total_actual", "h1_total_point", "own_h1", "opp_h1"]).drop_duplicates(["cbbd_id", "is_home"])
D2 = D.merge(F, on=["cbbd_id", "is_home"], how="left")
for nm, m in (("T1", S.T1), ("T4", S.T1 & S.cant), ("all valid", valid)):
    s = D2[m & D2.hgt_gap.notna()]
    tot = s.own_pts + s.opp_pts
    ov_open = 100 * (tot > s.open_total).sum() / max((tot != s.open_total).sum(), 1)
    move = (s.total_line - s.open_total).mean()
    h1 = s[s.h1_total_point.notna()]
    h1_over = 100 * (h1.h1_total_actual > h1.h1_total_point).sum() / max((h1.h1_total_actual != h1.h1_total_point).sum(), 1)
    h2_actual = (tot - s.h1_total_actual); h2_impl = s.total_line - s.h1_total_point
    blow = 100 * ((-s.margin) >= 15).mean()
    small_h1 = (s.own_h1 - s.own_impl / 2).mean(); small_h2 = ((s.own_pts - s.own_h1) - s.own_impl / 2).mean()
    P(f"  {nm:<10} over vs OPENER {ov_open:.1f}% | close moved {move:+.2f} from open | 1H over {h1_over:.1f}% (n {len(h1)}) | 2H actual-implied {(h2_actual - h2_impl).mean():+.2f} | big team wins by 15+: {blow:.0f}% "
      f"| small team vs half of implied: 1H {small_h1:+.2f}  2H {small_h2:+.2f}")

P("\n=== 5. T4 PER SEASON AND SPLITS (the stronger over cell) ===")
T4 = S.T1 & S.cant
for y in sorted(D.season_end.unique()):
    w, l, pct, n = over(T4 & (D.season_end == y)); P(f"  {y}: over {w}-{l} ({pct:.1f}%)")
line("T4 Nov-Dec", T4 & D.novdec); line("T4 Jan-Mar", T4 & D.janplus); line("T4 big team home", T4 & (D.is_home == 0) & (D.neutral == 0)); line("T4 big team away", T4 & (D.is_home == 1) & (D.neutral == 0))
line("T4 big fav 10+", T4 & (D.big_spread <= -10)); line("T4 big fav 0-10", T4 & D.big_spread.between(-10, 0)); line("T4 big is dog", T4 & (D.big_spread > 0))
P(f"  T4 shuffle p (over) {S.shuffle_p(T4 & D.hgt_gap.notna(), D.under):.3f}")
P("\n=== 6. THE SIMPLE VERSION: bad-shooting team (3P% bottom 40%) vs a top-20% defense, any height ===")
simple = valid & (D.own_pct_p3_pct <= 0.4) & S.gd
line("bad shooters vs top-20% D", simple); 
for y in sorted(D.season_end.unique()):
    w, l, pct, n = over(simple & (D.season_end == y)); P(f"    {y}: over {w}-{l} ({pct:.1f}%)")
s = D[simple & D.hgt_gap.notna()]; exp = s.bs_b.map(base.over).astype(float).mean(); P(f"  spread-matched expectation {exp:.1f}%  shuffle p {S.shuffle_p(simple & D.hgt_gap.notna(), D.under):.3f}")
line("  ... Nov-Dec", simple & D.novdec); line("  ... Jan-Mar", simple & D.janplus)
line("  placebo: GOOD shooters (3P% top 40%) vs top-20% D", valid & (D.own_pct_p3_pct >= 0.6) & S.gd)
line("  bad shooters vs WORST-40% D", valid & (D.own_pct_p3_pct <= 0.4) & (D.opp_def_pct >= 0.6))
out.close()
