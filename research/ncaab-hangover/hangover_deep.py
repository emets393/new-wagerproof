#!/usr/bin/env python3
"""Deep pass: the game after an UNRANKED team beats an AP top-25 team runs the opposite of a hangover (back 54.2%). Robustness: opener,
line move, margin of the win, rank of the victim, own quality, venue of the win, first ranked scalp of the season, the ranked loser's bounce-back,
the upset-dog family, and the rest gap."""
import io, contextlib, numpy as np, pandas as pd
with contextlib.redirect_stdout(io.StringIO()):
    import hangover_wide as H
D, cell, rec, splits = H.D, H.cell, H.rec, H.splits
out = open("HANGOVER_DEEP.txt", "w")
def P(*a):
    s = " ".join(str(x) for x in a); print(s); out.write(s + "\n"); out.flush()
H.P = P
BB = H.BB
A = pd.read_parquet(f"{BB}/cbb_sit_panel.parquet", columns=["cbbd_id", "teamId", "ats_open_pts", "open_spread"]).drop_duplicates(["cbbd_id", "teamId"])
D = D.merge(A, on=["cbbd_id", "teamId"], how="left"); H.D = D
g = D.groupby(["season_end", "teamId"], sort=False)
D["scalps_before"] = g.apply(lambda x: ((x.p_win == 1) & (x.p_o_ap_rank <= 25) & x.p_ap_rank.isna()).cumsum().shift(1).fillna(0)).reset_index(level=[0, 1], drop=True) if False else 0
# simpler: count of prior ranked scalps this season = cumulative count of (beat ranked while unranked) before the previous game
sc = ((D.win == 1) & (D.o_ap_rank <= 25) & D.ap_rank.isna()).astype(int)
D["scalps_todate"] = sc.groupby([D.season_end, D.teamId]).cumsum() - sc
D["p_scalps_before"] = g.scalps_todate.shift(1)
reg = (D.conf_tourney != 1) & (D.ncaa_t != 1) & (D.p_conf_tourney != 1)
h1 = (D.p_win == 1) & (D.p_o_ap_rank <= 25) & D.p_ap_rank.isna() & reg
P("=== 1. THE CELL AND ITS CONTROLS ===")
cell("H1 unranked beat AP top-25 -> next game (back)", h1, p=True, per=True)
s = D[h1]; ow, ol = rec(s.ats_open_pts); P(f"  vs the OPENER: {ow}-{ol} ({100*ow/(ow+ol):.1f}%) | line moved toward them by {(s.spread - s.open_spread).mean():+.2f} (negative = market shaded TOWARD the team) | avg spread {s.spread.mean():+.1f} opener {s.open_spread.mean():+.1f}")
cell("   control: unranked LOST to AP top-25 -> next game", (D.p_win == 0) & (D.p_o_ap_rank <= 25) & D.p_ap_rank.isna() & reg, p=True)
cell("   control: unranked beat an UNRANKED team -> next game", (D.p_win == 1) & D.p_o_ap_rank.isna() & D.p_ap_rank.isna() & reg)
cell("   the ranked LOSER's next game (ranked team lost to an unranked team)", (D.p_win == 0) & D.p_ap_rank.notna() & D.p_o_ap_rank.isna() & reg, p=True, per=True)
cell("   ranked team lost to a ranked team -> next", (D.p_win == 0) & D.p_ap_rank.notna() & D.p_o_ap_rank.notna() & reg)
P("\n=== 2. DOSE / SHAPE ===")
for lo, hi, nm in ((1, 5, "top 5"), (6, 10, "6-10"), (11, 15, "11-15"), (16, 25, "16-25")): cell(f"   victim ranked {nm}", h1 & D.p_o_ap_rank.between(lo, hi))
cell("   won by 1-5", h1 & D.p_margin.between(1, 5)); cell("   won by 6-12", h1 & D.p_margin.between(6, 12)); cell("   won by 13+", h1 & (D.p_margin >= 13))
cell("   won as a dog of 7+", h1 & (D.p_spread >= 7)); cell("   won as a dog of 0.5-6.5", h1 & D.p_spread.between(0.5, 6.5)); cell("   won as the favorite", h1 & (D.p_spread < 0))
cell("   the win was at HOME", h1 & (D.p_is_home == 1) & (D.p_neutral == 0)); cell("   the win was on the ROAD", h1 & (D.p_is_home == 0) & (D.p_neutral == 0)); cell("   the win was NEUTRAL", h1 & (D.p_neutral == 1))
cell("   first ranked scalp of the season", h1 & (D.p_scalps_before == 0), p=True, per=True); cell("   already had a ranked scalp this season", h1 & (D.p_scalps_before >= 1))
cell("   own KenPom EM > +10 (good team, just unranked)", h1 & (D.own_kp_em > 10)); cell("   own EM 0..10", h1 & D.own_kp_em.between(0, 10)); cell("   own EM < 0", h1 & (D.own_kp_em < 0))
cell("   non-conference win", h1 & (D.p_conf_game == 0)); cell("   conference win", h1 & (D.p_conf_game == 1))
cell("   Nov-Dec", h1 & D.month.isin([11, 12])); cell("   Jan-Feb", h1 & D.month.isin([1, 2])); cell("   March", h1 & (D.month == 3))
P("\n=== 3. NEXT GAME CONTEXT ===")
cell("   next vs a ranked opponent", h1 & D.o_ap_rank.notna()); cell("   next vs an unranked opponent", h1 & D.o_ap_rank.isna(), p=True, per=True)
cell("   next at home", h1 & (D.is_home == 1) & (D.neutral == 0)); cell("   next on the road", h1 & (D.is_home == 0) & (D.neutral == 0))
cell("   next as favorite", h1 & (D.spread < 0)); cell("   next as dog", h1 & (D.spread > 0)); cell("   next as dog of 5+", h1 & (D.spread >= 5))
for gb in ["<=3 days", "4-5 days", "6+ days"]: cell(f"   gap {gb}", h1 & (D.gap_b == gb))
cell("   gap 4+ days", h1 & (D.gap >= 4), p=True, per=True); cell("   gap 4+ days, next vs unranked", h1 & (D.gap >= 4) & D.o_ap_rank.isna())
P("\n=== 4. THE UPSET-DOG FAMILY (won outright as a dog), same checks ===")
for lo, nm in ((7, "7+"), (10, "10+"), (14, "14+")):
    m = (D.p_win == 1) & (D.p_spread >= lo) & reg; cell(f"won as a dog of {nm} -> next (back)", m, p=True, per=True)
    s = D[m]; ow, ol = rec(s.ats_open_pts); P(f"      vs opener {ow}-{ol} ({100*ow/(ow+ol):.1f}%), line move {(s.spread - s.open_spread).mean():+.2f}")
m10 = (D.p_win == 1) & (D.p_spread >= 10) & reg
cell("   dog 10+ win, next as dog again", m10 & (D.spread > 0)); cell("   dog 10+ win, next as favorite", m10 & (D.spread < 0)); cell("   dog 10+ win, next on the road", m10 & (D.is_home == 0) & (D.neutral == 0)); cell("   dog 10+ win, next at home", m10 & (D.is_home == 1))
cell("   dog 10+ win, gap 4+", m10 & (D.gap >= 4)); cell("   dog 10+ win, gap <= 3", m10 & (D.gap <= 3))
cell("   UNION: beat ranked while unranked OR won as a 10+ dog", (h1 | m10), p=True, per=True)
cell("   control: the FAVORITE that lost to a 10+ dog -> next game", (D.p_win == 0) & (D.p_spread <= -10) & reg, p=True, per=True)
out.close()
