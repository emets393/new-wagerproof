#!/usr/bin/env python3
"""Third pass: opener comparison on rows that HAVE an opener (the first pass counted NaN openers as non-overs), over ROI at the
T-60 over price, the big team's offense, and the reversed-height cell."""
import io, contextlib, numpy as np, pandas as pd
with contextlib.redirect_stdout(io.StringIO()):
    import size_defense_study as S
D = S.D; valid = S.valid
out = open("OVER_CHECKS2.txt", "w")
def P(*a):
    s = " ".join(str(x) for x in a); print(s); out.write(s + "\n"); out.flush()
F = pd.read_parquet(f"{S.BB}/cbb_sit_panel.parquet", columns=["cbbd_id", "is_home", "open_total"]).drop_duplicates(["cbbd_id", "is_home"])
D = D.merge(F, on=["cbbd_id", "is_home"], how="left")
D["over_price"] = D.t60_total_over_price.fillna(1.91)
T1 = S.T1.reindex(D.index, fill_value=False) if len(S.T1) != len(D) else S.T1.values
T1 = pd.Series(T1, index=D.index); T4 = T1 & (D.own_pct_p3_pct <= 0.5)
def show(nm, m):
    s = D[m & D.hgt_gap.notna()]; tot = s.own_pts + s.opp_pts
    w, l = int((s.under < 0).sum()), int((s.under > 0).sum())
    roi = 100 * (((s.over_price - 1) * (s.under < 0)).sum() - (s.under > 0).sum()) / max(w + l, 1)
    o = s[s.open_total.notna()]; to = o.own_pts + o.opp_pts
    ow, ol = int((to > o.open_total).sum()), int((to < o.open_total).sum())
    P(f"  {nm:<36} OVER at close {w}-{l} ({100*w/max(w+l,1):.1f}%, ROI at price {roi:+.1f}%) | vs OPENER {ow}-{ol} ({100*ow/max(ow+ol,1):.1f}%, n with opener {len(o)}) | close-open {(o.total_line-o.open_total).mean():+.2f} | open {o.open_total.mean():.1f} close {o.total_line.mean():.1f} actual {to.mean():.1f}")
P("=== OPENER, PRICE ===")
show("T1", T1); show("T4 (T1 & 3P% below median)", T4); show("all valid", valid)
P("\n=== THE BIG TEAM'S OFFENSE (KenPom AdjOE as of the game, tercile within season-month) inside T1 ===")
D["opp_oe_pct"] = D.groupby(["season_end", "month"]).opp_oe.rank(pct=True)
for lo, hi, nm in ((0, 1/3, "weak O"), (1/3, 2/3, "mid O"), (2/3, 1.01, "strong O")):
    m = T1 & D.opp_oe_pct.between(lo, hi); s = D[m]; w, l = int((s.under < 0).sum()), int((s.under > 0).sum())
    P(f"  big team {nm:<9} OVER {w}-{l} ({100*w/max(w+l,1):.1f}%) tot {s.tot_resid.mean():+.2f} big sprd {s.big_spread.mean():+.1f} small vs impl {s.own_vs_impl.mean():+.2f} big vs impl {s.opp_vs_impl.mean():+.2f} n={len(s)}")
P("\n=== SAME BIG DEFENSIVE OPPONENT, WE ARE THE TALLER TEAM (reversed height) ===")
for lo, hi, nm in ((-9, -2, "we are 2+ taller"), (-2, -1, "we are 1-2 taller"), (-1, 1, "even"), (1, 2, "they are 1-2 taller"), (2, 9, "they are 2+ taller")):
    m = valid & S.low3 & S.gd & D.hgt_gap.between(lo, hi, inclusive="left"); s = D[m]; w, l = int((s.under < 0).sum()), int((s.under > 0).sum())
    P(f"  3PA bottom quartile vs top-20% D, {nm:<20} OVER {w}-{l} ({100*w/max(w+l,1):.1f}%) tot {s.tot_resid.mean():+.2f} n={len(s)}")
P("\n=== FOULS / FREE THROWS: do these games have more free throws than the line expects? (box score, 2022-23 on) ===")
B = pd.read_parquet(f"{S.BB}/cbbd_team_box.parquet", columns=["gameId", "teamId", "teamStats.freeThrows.attempted", "opponentStats.freeThrows.attempted", "teamStats.fouls.total", "opponentStats.fouls.total", "pace", "teamStats.possessions", "teamStats.points.inPaint", "opponentStats.points.inPaint", "teamStats.threePointFieldGoals.attempted", "teamStats.fieldGoals.attempted"]).drop_duplicates(["gameId", "teamId"])
B.columns = ["cbbd_id", "teamId", "own_fta", "opp_fta", "own_fouls", "opp_fouls", "pace_g", "poss", "own_paint", "opp_paint", "own_3pa_g", "own_fga_g"]
P0 = pd.read_parquet(f"{S.BB}/cbb_sit_panel.parquet", columns=["cbbd_id", "is_home", "teamId"]).drop_duplicates(["cbbd_id", "is_home"])
D = D.merge(P0, on=["cbbd_id", "is_home"], how="left").merge(B, on=["cbbd_id", "teamId"], how="left")
for nm, m in (("T1", T1.reindex(D.index, fill_value=False)), ("T4", T4.reindex(D.index, fill_value=False)), ("all valid", valid.reindex(D.index, fill_value=False))):
    s = D[m & (D.season_end >= 2023) & D.own_fta.notna()]
    P(f"  {nm:<10} game pace {s.pace_g.mean():.1f} | FTA small {s.own_fta.mean():.1f} big {s.opp_fta.mean():.1f} | fouls small {s.own_fouls.mean():.1f} big {s.opp_fouls.mean():.1f} | paint pts small {s.own_paint.mean():.1f} big {s.opp_paint.mean():.1f} | small 3PA rate in the game {(s.own_3pa_g/s.own_fga_g).mean():.3f} | n={len(s)}")
out.close()
