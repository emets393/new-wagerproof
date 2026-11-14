#!/usr/bin/env python3
"""KenPom FanMatch (ThrillScore + KenPom's pregame predictions) vs the T-60 market, six seasons.
1. Leak test: is the archived FanMatch prediction pregame? If it correlates with results MORE than the closing line does, it was recomputed.
2. KenPom vs market: predicted total vs market total, predicted margin vs spread -> over/under and ATS by disagreement band.
3. ThrillScore: pre-stated reads on totals (over?), favorites (fade the public's favorite in exciting games?), and ML.
Writes FANMATCH_RUN.txt."""
import os, numpy as np, pandas as pd, requests
PQ = "data/parquet"; out = open("FANMATCH_RUN.txt", "w")
def P(*a):
    s = " ".join(str(x) for x in a); print(s); out.write(s + "\n"); out.flush()
FM = pd.read_parquet(f"{PQ}/kenpom_fanmatch.parquet"); FM["date"] = pd.to_datetime(FM.DateOfGame)
sk = os.environ["SUPABASE_SERVICE_KEY"]
mp = pd.DataFrame(requests.get("https://jpxnjuwglavsjbgbasnl.supabase.co/rest/v1/ncaab_team_mapping?select=api_team_id,KenPom_Name", headers={"apikey": sk, "Authorization": f"Bearer {sk}"}).json())
k2id = dict(zip(mp.KenPom_Name, mp.api_team_id.astype(int)))
FM["home_id"] = FM.Home.map(k2id); FM["vis_id"] = FM.Visitor.map(k2id)
P(f"fanmatch {len(FM):,} games; unmapped names: {sorted(set(FM.Home[FM.home_id.isna()]) | set(FM.Visitor[FM.vis_id.isna()]))[:12]}")
FM = FM.dropna(subset=["home_id", "vis_id"]); FM["pair"] = FM.apply(lambda r: tuple(sorted((int(r.home_id), int(r.vis_id)))), axis=1)
FM["kp_total"] = FM.HomePred + FM.VisitorPred; FM["kp_home_margin"] = FM.HomePred - FM.VisitorPred
D = pd.read_parquet(f"{PQ}/cbb_sit_panel.parquet", columns=["cbbd_id", "season", "date", "teamId", "opponentId", "is_home", "neutral", "spread", "total_line", "tot_resid", "ats_pts", "margin", "own_pts", "opp_pts", "win", "ml_price", "spread_price", "month", "conf_game", "conf_tourney", "ncaa_t"])
D = D[D.is_home == 1].copy(); D["date"] = pd.to_datetime(D.date); D["pair"] = D.apply(lambda r: tuple(sorted((int(r.teamId), int(r.opponentId)))), axis=1)
D["season_end"] = D.season.str[:4].astype(int) + 1
F = pd.read_parquet(f"{PQ}/ncaab_model_features.parquet", columns=["cbbd_id", "t60_total_under_price", "t60_total_over_price"]).drop_duplicates("cbbd_id")
D = D.merge(F, on="cbbd_id", how="left")
# match on pair + date (ET date vs KenPom date; allow +-1 day for late tips)
M = D.merge(FM[["pair", "date", "Home", "Visitor", "home_id", "HomeRank", "VisitorRank", "HomePred", "VisitorPred", "HomeWP", "PredTempo", "ThrillScore", "kp_total", "kp_home_margin"]], on=["pair", "date"], how="left", suffixes=("", "_fm"))
miss = M.HomePred.isna()
alt = D[miss].copy(); alt["date"] = alt.date + pd.Timedelta(days=1)
M2 = alt.merge(FM[["pair", "date", "Home", "Visitor", "home_id", "HomeRank", "VisitorRank", "HomePred", "VisitorPred", "HomeWP", "PredTempo", "ThrillScore", "kp_total", "kp_home_margin"]], on=["pair", "date"], how="inner")
M = pd.concat([M[~miss], M2], ignore_index=True)
# orient KenPom's prediction to the panel's home team (FanMatch 'Home' may be the other side on neutral courts)
flip = M.home_id != M.teamId
M["kp_margin"] = np.where(flip, -M.kp_home_margin, M.kp_home_margin); M["kp_wp_home"] = np.where(flip, 100 - M.HomeWP, M.HomeWP)
M["mkt_margin"] = -M.spread
M["tot_edge"] = M.kp_total - M.total_line; M["sprd_edge"] = M.kp_margin - M.mkt_margin
M["under"] = np.sign(-M.tot_resid); M["home_cover"] = np.sign(M.ats_pts); M["over_price"] = M.t60_total_over_price.fillna(1.91); M["under_price"] = M.t60_total_under_price.fillna(1.91)
reg = (M.conf_tourney != 1) & (M.ncaa_t != 1)
P(f"matched {len(M):,} of {len(D):,} priced games ({100*len(M)/len(D):.1f}%); by season " + str(M.groupby("season_end").size().to_dict()))

P("\n=== 1. LEAK TEST: correlation with the RESULT. If KenPom's archived prediction beats the closing line, it is not pregame. ===")
for y, g in M.groupby("season_end"):
    P(f"  {y}: corr(actual margin, KenPom pred) {np.corrcoef(g.margin, g.kp_margin)[0,1]:.3f} | corr(actual margin, market) {np.corrcoef(g.margin, g.mkt_margin)[0,1]:.3f} | "
      f"corr(actual total, KenPom) {np.corrcoef(g.own_pts + g.opp_pts, g.kp_total)[0,1]:.3f} | corr(actual total, market) {np.corrcoef(g.own_pts + g.opp_pts, g.total_line)[0,1]:.3f} | KenPom vs market margin corr {np.corrcoef(g.kp_margin, g.mkt_margin)[0,1]:.3f}")
P(f"  mean abs error, margin: KenPom {np.abs(M.margin - M.kp_margin).mean():.2f} vs market {np.abs(M.margin - M.mkt_margin).mean():.2f} | total: KenPom {np.abs(M.own_pts + M.opp_pts - M.kp_total).mean():.2f} vs market {np.abs(M.own_pts + M.opp_pts - M.total_line).mean():.2f}")

def rec(s): return int((s > 0).sum()), int((s < 0).sum())
def tot_cell(label, mask, side):
    s = M[mask]; w, l = rec(side * s.under) if side else (0, 0)
    pr = s.under_price if side > 0 else s.over_price
    roi = 100 * (((pr - 1) * (side * s.under > 0)).sum() - (side * s.under < 0).sum()) / max(w + l, 1)
    per = " ".join(f"{str(y)[2:]}:{rec(side*g.under)[0]}-{rec(side*g.under)[1]}" for y, g in s.groupby("season_end"))
    P(f"  {label:<66} {'UNDER' if side>0 else 'OVER '} {w}-{l} ({100*w/max(w+l,1):.1f}%, {roi:+.1f}%) n={len(s)} tot {s.tot_resid.mean():+.2f} | {per}")
def ats_cell(label, mask, side_col):
    s = M[mask]; sg = s[side_col]; w, l = rec(sg)
    roi = 100 * (((s.spread_price.fillna(1.91) - 1) * (sg > 0)).sum() - (sg < 0).sum()) / max(w + l, 1)
    per = " ".join(f"{str(y)[2:]}:{rec(g[side_col])[0]}-{rec(g[side_col])[1]}" for y, g in s.groupby("season_end"))
    P(f"  {label:<66} {w}-{l} ({100*w/max(w+l,1):.1f}%, {roi:+.1f}%) n={len(s)} | {per}")

P("\n=== 2. KENPOM vs MARKET on the TOTAL (bet KenPom's side) ===")
for lo, hi in ((0, 2), (2, 4), (4, 6), (6, 9), (9, 99)):
    tot_cell(f"KenPom total ABOVE market by {lo}-{hi}", reg & M.tot_edge.between(lo, hi, inclusive="left") & (M.tot_edge > 0), -1)
for lo, hi in ((0, 2), (2, 4), (4, 6), (6, 9), (9, 99)):
    tot_cell(f"KenPom total BELOW market by {lo}-{hi}", reg & (-M.tot_edge).between(lo, hi, inclusive="left") & (M.tot_edge < 0), +1)
P("\n=== 2b. KENPOM vs MARKET on the SPREAD (bet KenPom's side; shown as record of KenPom's side) ===")
M["kp_side"] = np.sign(M.sprd_edge) * M.home_cover
for lo, hi in ((0, 1.5), (1.5, 3), (3, 5), (5, 8), (8, 99)):
    ats_cell(f"KenPom margin differs from market by {lo}-{hi}", reg & M.sprd_edge.abs().between(lo, hi, inclusive="left") & (M.sprd_edge != 0), "kp_side")

P("\n=== 3. THRILL SCORE (KenPom's pregame excitement: closeness x quality x tempo), deciles within season ===")
M["thrill_d"] = M.groupby("season_end").ThrillScore.transform(lambda s: pd.qcut(s.rank(method="first"), 10, labels=False) + 1)
M["fav_cover"] = np.where(M.spread < 0, M.home_cover, -M.home_cover); M["fav_cover"] = np.where(M.spread == 0, 0, M.fav_cover)
M["dog_win"] = np.where(M.spread > 0, M.win, 1 - M.win); M["dog_ml"] = np.where(M.spread > 0, M.ml_price, np.nan)
hdr = f"  {'decile':<8}{'n':>7}{'over %':>9}{'tot vs line':>13}{'fav ATS %':>11}{'avg |spread|':>14}{'line':>8}{'thrill':>8}"; P(hdr)
for d, g in M[reg].groupby("thrill_d"):
    uw, ul = rec(g.under); fw, fl = rec(g.fav_cover)
    P(f"  {int(d):<8}{len(g):>7}{100*ul/max(uw+ul,1):>9.1f}{g.tot_resid.mean():>+13.2f}{100*fw/max(fw+fl,1):>11.1f}{g.spread.abs().mean():>14.1f}{g.total_line.mean():>8.1f}{g.ThrillScore.mean():>8.1f}")
tot_cell("top-decile thrill -> total", reg & (M.thrill_d == 10), -1); tot_cell("bottom-decile thrill -> total", reg & (M.thrill_d == 1), +1)
ats_cell("top-decile thrill: FAVORITE ATS", reg & (M.thrill_d == 10), "fav_cover"); ats_cell("bottom-decile thrill: FAVORITE ATS", reg & (M.thrill_d == 1), "fav_cover")
ats_cell("top-decile thrill & |spread| <= 3: HOME ATS", reg & (M.thrill_d == 10) & (M.spread.abs() <= 3), "home_cover")
ats_cell("thrill >= 70 (the showcase games): FAVORITE ATS", reg & (M.ThrillScore >= 70), "fav_cover"); tot_cell("thrill >= 70 -> total", reg & (M.ThrillScore >= 70), -1)
ats_cell("thrill >= 70, conference game: HOME ATS", reg & (M.ThrillScore >= 70) & (M.conf_game == 1), "home_cover")
P("\n=== 4. KENPOM WIN PROBABILITY vs the MONEYLINE (dog side) ===")
M["mkt_home_p"] = np.where(M.spread < 0, 1 / M.ml_price, 1 - 1 / M.ml_price)   # rough: panel ml_price is the home row's price
M["kp_minus_mkt_home"] = M.kp_wp_home / 100 - M.mkt_home_p
for lo, hi in ((0.03, 0.06), (0.06, 0.10), (0.10, 1)):
    s = M[reg & M.kp_minus_mkt_home.between(lo, hi)]; w = int(s.win.sum()); l = int((s.win == 0).sum()); roi = 100 * np.where(s.win == 1, s.ml_price - 1, -1).mean()
    P(f"  KenPom likes HOME {lo:.0%}-{hi:.0%} more than the market: home ML {w}-{l} ({100*w/max(w+l,1):.1f}%, ROI {roi:+.1f}%) n={len(s)}")
out.close()
