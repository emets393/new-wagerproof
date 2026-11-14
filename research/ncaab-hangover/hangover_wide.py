#!/usr/bin/env python3
"""NCAAB hangover spots -- the WIDE pass (owner 2026-10-28). What happens the game AFTER a big win / a dramatic finish / a lucky result,
and does the gap between the games matter? Six seasons at the T-60 close, from the team's row; every trigger is about the PREVIOUS game.

Triggers (previous game, same season):
  H1 beat a ranked opponent (AP top-25 at tip) while unranked; beat a top-10
  H2 upset: won outright as a dog of 7+ / 10+
  H3 won a nationally televised game that was tight on the number (|spread| <= 3); won on a big-network game
  H4 'electric': upset win on national TV; beat a ranked team on national TV; won as a dog of 10+ on the road
  H5 rival proxy: beat a conference opponent from the same state
  H6 finishes: hit the game-winner (last score, <= 1s / <= 5s / <= 24s, shooter tied or trailing before it); gave one up; won / lost in OT;
     won / lost by 1-3 in regulation
  H7 luck (win probability): won with time-weighted WP < .5 (lucky winner); covered with WP < .5 (undeserved cover); lost with WP >= .6
     (deserved loser, the known back); blew a 15+ lead and lost; came back from 15+ and won
Splits for each: days of rest before the next game (<= 3 / 4-5 / 6+), next game home / away, favorite / dog, Nov-Dec / Jan+.
Outcomes: own ATS at the price, total over/under, moneyline ROI. Writes HANGOVER_WIDE.txt.
"""
import os
import numpy as np
import pandas as pd

ROOT = os.path.dirname(os.path.abspath(__file__)); BB = os.path.join(ROOT, "..", "bball-odds", "data", "parquet")
rng = np.random.default_rng(9); out = open(os.path.join(ROOT, "HANGOVER_WIDE.txt"), "w")
def P(*a):
    s = " ".join(str(x) for x in a); print(s); out.write(s + "\n"); out.flush()

cols = ["cbbd_id", "season", "date", "month", "teamId", "opponentId", "team", "opponent", "is_home", "neutral", "conf_game", "nonconf", "conf_tourney", "ncaa_t", "gnum", "rest",
        "own_pts", "opp_pts", "margin", "spread", "total_line", "tot_resid", "ats_pts", "win", "ml_price", "spread_price", "own_kp_em", "o_kp_em", "ap_rank", "o_ap_rank", "nat_tv", "big_tv", "went_ot", "state", "twa_wp", "own_flow"]
D = pd.read_parquet(f"{BB}/cbb_sit_panel.parquet", columns=cols)
F = pd.read_parquet(f"{BB}/ncaab_model_features.parquet", columns=["cbbd_id", "t60_total_under_price", "t60_total_over_price"]).drop_duplicates("cbbd_id")
FIN = pd.read_parquet(f"{BB}/cbb_sit_finish.parquet").rename(columns={"side_home": "is_home"})
D = D.merge(F, on="cbbd_id", how="left").merge(FIN, on=["cbbd_id", "is_home"], how="left")
D["season_end"] = D.season.str[:4].astype(int) + 1; D["date"] = pd.to_datetime(D.date); D = D.sort_values(["season_end", "teamId", "date"]).reset_index(drop=True)
home_state = D[D.is_home == 1].groupby("teamId").state.agg(lambda s: s.mode().iloc[0] if s.notna().any() else None).rename("home_state")
D = D.merge(home_state, on="teamId", how="left").merge(home_state.rename("o_home_state").rename_axis("opponentId"), on="opponentId", how="left")
D["same_state"] = D.home_state.notna() & (D.home_state == D.o_home_state)
D["bb_hit"] = (D.lw_mine == 1) & (D.lw_shooter_won == 1) & (D.lw_lead_before <= 0)
D["bb_gave"] = (D.lw_mine == 0) & (D.lw_shooter_won == 1) & (D.lw_lead_before <= 0)
g = D.groupby(["season_end", "teamId"], sort=False)
prev = ["win", "margin", "spread", "ats_pts", "o_ap_rank", "ap_rank", "nat_tv", "big_tv", "went_ot", "is_home", "neutral", "conf_game", "same_state", "bb_hit", "bb_gave", "lw_sec", "twa_wp", "own_flow", "max_lead", "lead_erased", "max_deficit", "deficit_erased", "date", "o_kp_em", "conf_tourney"]
for c in prev: D["p_" + c] = g[c].shift(1)
D["gap"] = (D.date - D.p_date).dt.days
D = D[D.spread.notna() & D.total_line.notna() & D.p_win.notna()].copy()
D["under"] = np.sign(-D.tot_resid); D["cover"] = np.sign(D.ats_pts); D["under_price"] = D.t60_total_under_price.fillna(1.91); D["over_price"] = D.t60_total_over_price.fillna(1.91)
D["key"] = D.season_end.astype(str) + "-" + D.month.astype(str); D["bs_b"] = pd.cut(-D.spread, [-60, -20, -15, -10, -5, 0, 5, 60])
base_over = D.groupby("bs_b").apply(lambda x: 100 * (x.under < 0).sum() / max((x.under != 0).sum(), 1))
D["gap_b"] = pd.cut(D.gap, [-1, 3, 5, 60], labels=["<=3 days", "4-5 days", "6+ days"])
P(f"team-games with a previous game {len(D):,}; twa coverage {D.p_twa_wp.notna().mean():.2f}; finish coverage {D.p_lw_sec.notna().mean():.2f}; gap dist {D.gap_b.value_counts().to_dict()}")

def rec(s): return int((s > 0).sum()), int((s < 0).sum())
def shuffle_p(mask, sgn, n=600):
    m = mask.values.astype(bool); s = sgn.values; ok = ~np.isnan(s); m, s, k = m[ok], s[ok], D.key.values[ok]; obs = s[m].sum()
    groups = {}
    for i, kk in enumerate(k): groups.setdefault(kk, []).append(i)
    groups = [(np.array(v), m[np.array(v)].sum()) for v in groups.values() if m[np.array(v)].sum() > 0]
    null = np.array([sum(s[rng.choice(idx, cnt, replace=False)].sum() for idx, cnt in groups) for _ in range(n)])
    return float((np.abs(null) >= abs(obs)).mean())
def cell(label, mask, p=False, per=False):
    s = D[mask]; n = len(s)
    if n < 60: P(f"  {label:<74} n={n} (thin)"); return
    cw, cl = rec(s.cover); uw, ul = rec(s.under)
    c_roi = 100 * (((s.spread_price.fillna(1.91) - 1) * (s.cover > 0)).sum() - (s.cover < 0).sum()) / max(cw + cl, 1)
    o_roi = 100 * (((s.over_price - 1) * (s.under < 0)).sum() - (s.under > 0).sum()) / max(uw + ul, 1)
    ml = s[s.ml_price.notna()]; m_roi = 100 * np.where(ml.win == 1, ml.ml_price - 1, -1).mean() if len(ml) > 30 else np.nan
    txt = (f"  {label:<74} n={n:5d} | own ATS {cw}-{cl} ({100*cw/max(cw+cl,1):.1f}%, {c_roi:+.1f}%) | OVER {ul}-{uw} ({100*ul/max(uw+ul,1):.1f}%, {o_roi:+.1f}%; sm {s.bs_b.map(base_over).astype(float).mean():.1f}%) tot {s.tot_resid.mean():+.2f} "
           f"| ML roi {m_roi:+.1f}% | sprd {s.spread.mean():+.1f}")
    if p: txt += f" | p(ATS) {shuffle_p(mask, D.cover):.3f} p(tot) {shuffle_p(mask, D.under):.3f}"
    P(txt)
    if per: P("      by season: " + " | ".join(f"{str(y)[2:]}: ATS {rec(x.cover)[0]}-{rec(x.cover)[1]} O {rec(x.under)[1]}-{rec(x.under)[0]}" for y, x in s.groupby("season_end")))
def splits(label, mask):
    for gb in ["<=3 days", "4-5 days", "6+ days"]: cell(f"   {label} | gap {gb}", mask & (D.gap_b == gb))
    cell(f"   {label} | next at home", mask & (D.is_home == 1)); cell(f"   {label} | next on the road", mask & (D.is_home == 0) & (D.neutral == 0))
    cell(f"   {label} | next as favorite", mask & (D.spread < 0)); cell(f"   {label} | next as dog", mask & (D.spread > 0))
    cell(f"   {label} | Nov-Dec", mask & D.month.isin([11, 12])); cell(f"   {label} | Jan+", mask & ~D.month.isin([11, 12]))

reg = (D.conf_tourney != 1) & (D.ncaa_t != 1) & (D.p_conf_tourney != 1)
W = (D.p_win == 1) & reg
P("\n=== REFERENCE ===")
cell("any game after a WIN", W); cell("any game after a LOSS", (D.p_win == 0) & reg)
for gb in ["<=3 days", "4-5 days", "6+ days"]: cell(f"   after a win | gap {gb}", W & (D.gap_b == gb))

P("\n=== H1. BEAT A RANKED OPPONENT ===")
h1 = W & (D.p_o_ap_rank <= 25) & D.p_ap_rank.isna()
cell("H1 unranked team beat an AP top-25 team", h1, p=True, per=True); splits("H1", h1)
cell("H1b unranked team beat a TOP-10 team", W & (D.p_o_ap_rank <= 10) & D.p_ap_rank.isna(), p=True); splits("H1b", W & (D.p_o_ap_rank <= 10) & D.p_ap_rank.isna())
cell("H1c ranked team beat a ranked team", W & (D.p_o_ap_rank <= 25) & D.p_ap_rank.notna(), p=True)

P("\n=== H2. UPSET WIN (won outright as a dog) ===")
for lo, nm in ((7, "7+"), (10, "10+"), (14, "14+")):
    m = W & (D.p_spread >= lo); cell(f"H2 won as a dog of {nm}", m, p=True, per=(lo == 7))
splits("H2 dog 7+", W & (D.p_spread >= 7))
cell("H2 control: won as a dog of 1-6", W & D.p_spread.between(0.5, 6.5)); cell("H2 control: won as a favorite of 7+", W & (D.p_spread <= -7))

P("\n=== H3. WON A NATIONALLY TELEVISED GAME ===")
h3 = W & (D.p_nat_tv == 1) & (D.p_spread.abs() <= 3)
cell("H3 won a national-TV game with |spread| <= 3", h3, p=True, per=True); splits("H3", h3)
cell("H3b won a BIG-network game (big_tv), any spread", W & (D.p_big_tv == 1), p=True); cell("H3c won any national-TV game", W & (D.p_nat_tv == 1), p=True)
cell("H3 control: won a non-TV game with |spread| <= 3", W & (D.p_nat_tv == 0) & (D.p_spread.abs() <= 3))

P("\n=== H4. ELECTRIC WINS ===")
cell("H4a upset (dog 7+) on national TV", W & (D.p_spread >= 7) & (D.p_nat_tv == 1), p=True, per=True); splits("H4a", W & (D.p_spread >= 7) & (D.p_nat_tv == 1))
cell("H4b beat a ranked team on national TV", W & (D.p_o_ap_rank <= 25) & (D.p_nat_tv == 1), p=True); splits("H4b", W & (D.p_o_ap_rank <= 25) & (D.p_nat_tv == 1))
cell("H4c won as a 10+ dog ON THE ROAD", W & (D.p_spread >= 10) & (D.p_is_home == 0) & (D.p_neutral == 0), p=True)
cell("H4d beat a ranked team AT HOME (court storm)", W & (D.p_o_ap_rank <= 25) & D.p_ap_rank.isna() & (D.p_is_home == 1), p=True, per=True); splits("H4d", W & (D.p_o_ap_rank <= 25) & D.p_ap_rank.isna() & (D.p_is_home == 1))

P("\n=== H5. RIVAL PROXY: beat a same-state conference opponent ===")
h5 = W & (D.p_conf_game == 1) & (D.p_same_state == True)
cell("H5 beat a same-state conference rival", h5, p=True, per=True); splits("H5", h5)
cell("H5 control: beat an out-of-state conference opponent", W & (D.p_conf_game == 1) & (D.p_same_state == False))

P("\n=== H6. DRAMATIC FINISHES ===")
for sec, nm in ((1.0, "<= 1.0s (true buzzer beater)"), (5.0, "<= 5s"), (24.0, "<= 24s")):
    cell(f"H6 HIT the game-winner {nm}", (D.p_bb_hit == True) & (D.p_lw_sec <= sec) & (D.p_win == 1) & reg, p=(sec == 5.0), per=(sec == 5.0))
    cell(f"H6 GAVE UP the game-winner {nm}", (D.p_bb_gave == True) & (D.p_lw_sec <= sec) & (D.p_win == 0) & reg, p=(sec == 5.0), per=(sec == 5.0))
splits("H6 hit <= 5s", (D.p_bb_hit == True) & (D.p_lw_sec <= 5) & (D.p_win == 1) & reg)
cell("H6 won in OT", (D.p_went_ot == 1) & (D.p_win == 1) & reg, p=True, per=True); splits("OT win", (D.p_went_ot == 1) & (D.p_win == 1) & reg)
cell("H6 lost in OT", (D.p_went_ot == 1) & (D.p_win == 0) & reg, p=True, per=True)
cell("H6 won by 1-3 in regulation", (D.p_went_ot != 1) & D.p_margin.between(1, 3) & reg, p=True); cell("H6 lost by 1-3 in regulation", (D.p_went_ot != 1) & D.p_margin.between(-3, -1) & reg, p=True)
cell("H6 won by 20+", (D.p_margin >= 20) & reg, p=True); cell("H6 lost by 20+", (D.p_margin <= -20) & reg, p=True)

P("\n=== H7. LUCK (win probability over regulation) ===")
lucky = (D.p_win == 1) & (D.p_twa_wp < 0.5) & (D.p_went_ot != 1) & reg
cell("H7 LUCKY WIN: won in regulation with time-weighted WP < .5", lucky, p=True, per=True); splits("H7 lucky win", lucky)
cell("H7 very lucky: WP < .35 and won", (D.p_win == 1) & (D.p_twa_wp < 0.35) & reg, p=True)
cell("H7 undeserved COVER: covered with WP < .5", (D.p_ats_pts > 0) & (D.p_twa_wp < 0.5) & reg, p=True, per=True); splits("H7 undeserved cover", (D.p_ats_pts > 0) & (D.p_twa_wp < 0.5) & reg)
cell("H7 lucky win AND undeserved cover", (D.p_win == 1) & (D.p_ats_pts > 0) & (D.p_twa_wp < 0.5) & reg, p=True)
cell("H7 deserved LOSS: lost in regulation with WP >= .6 (known back)", (D.p_win == 0) & (D.p_twa_wp >= 0.6) & (D.p_went_ot != 1) & reg, p=True, per=True); splits("H7 deserved loss", (D.p_win == 0) & (D.p_twa_wp >= 0.6) & (D.p_went_ot != 1) & reg)
cell("H7 blew a 15+ lead and LOST", (D.p_lead_erased == True) & (D.p_max_lead >= 15) & (D.p_win == 0) & reg, p=True); cell("H7 came back from 15+ and WON", (D.p_deficit_erased == True) & (D.p_max_deficit >= 15) & (D.p_win == 1) & reg, p=True)
cell("H7 control: deserved win (WP >= .6, won)", (D.p_win == 1) & (D.p_twa_wp >= 0.6) & reg)
P("\n=== THE OWNER'S COMBINATION: big win, then 4-5+ days off ===")
big = W & ((D.p_spread >= 7) | (D.p_o_ap_rank <= 25) | ((D.p_nat_tv == 1) & (D.p_spread.abs() <= 3)))
cell("any 'big win' (upset 7+, beat ranked, or tight national-TV win)", big, p=True, per=True); splits("big win", big)
cell("big win, then 4+ days off", big & (D.gap >= 4), p=True, per=True); cell("big win, then 6+ days off", big & (D.gap >= 6), p=True)
cell("big win, then <= 2 days off", big & (D.gap <= 2))
out.close()
