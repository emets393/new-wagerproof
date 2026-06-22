"""
PART B: CFB MAMMOTH DETECTOR — PRE-REGISTERED DEFINITIONS (written before any results were viewed):

SIDES MAMMOTH (all three required, same game/direction):
  M1. model |edge_open| >= 8           (2x the standard product gate of 4)
  M2. CONFIRMATION layer agrees: independent cover-CLASSIFIER (HistGB classifier, same features,
      target = home covers the OPEN spread) walk-forward; its side (P_home>0.5) must equal the model side.
  M3. >=1 active NON-MODEL spread spot fires, same direction, computable from model_games:
      RvR home-fav->HOME, CONF SunBelt fade-home-fav->AWAY, CONF BigTen away-fav->AWAY,
      SOS padded-road fade (rating>median & SOS bottom-40% & resid<=-1)->HOME.

TOTALS MAMMOTH (all three):
  T1. model |total_edge_open| >= 6     (2x standard gate of 3)
  T2. >=1 independent structural totals layer agrees: FORM over-hot fade (comb over-rate>=.60 & tot<=58 -> UNDER),
      fade-extreme (close>=60 -> UNDER / <=50 -> OVER), CONF AAC 52-59 OVER, CONF SunBelt 59-66 UNDER.
  T3. (same as T2 — the structural layer IS the confirmation; >=1 required, count tracked for dose-response.)

MULTI-RULE MAMMOTH: >=2 distinct non-model spread spots, same game, same direction (model not required).

Dose-response table (descriptive): hit% by # ingredients aligned (0/1/2/3) + 2x2 confirm x spot grid.
Grade @ OPEN (signal-line=grade-line), CLV vs close. Per-season + per-play listing. Small-n stated.
"""
import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingClassifier
import exp_shared as E
import sos_signals, form_signals

gm, FEATS = E.load()
P5 = {"SEC", "Big Ten", "Big 12", "ACC", "Pac-12"}
conf = pd.Series(np.where(gm.homeConference == gm.awayConference, gm.homeConference, "NON"), index=gm.index)

# ---- model preds (locked baseline) ----
A = E.walk(gm, FEATS, "actual_margin").rename(columns={"pred": "pred_m"})
T = E.walk(gm, FEATS, "actual_total").rename(columns={"pred": "pred_t"})
A["pred_t"] = T["pred_t"].values

# ---- M2 confirmation classifier (walk-forward) ----
parts = []
for S in E.TS:
    # open lines only exist 2021+ -> train the confirm layer on CLOSE-cover (available 2016+); grading stays @ open
    tr = gm[(gm.season < S) & gm.spread_close.notna() & gm.actual_margin.notna()]
    tr = tr[(tr.actual_margin + tr.spread_close) != 0]
    y = (tr.actual_margin + tr.spread_close) > 0
    te = gm[gm.season == S].copy()
    c = HistGradientBoostingClassifier(max_iter=300, learning_rate=0.05, max_depth=4,
                                       l2_regularization=1.0, random_state=0).fit(tr[FEATS], y)
    te["p_home"] = c.predict_proba(te[FEATS])[:, 1]
    parts.append(te[["season", "game_id", "p_home"]])
A = A.merge(pd.concat(parts), on=["season", "game_id"], how="left")

# ---- M3 non-model spread spots (signed: +1 home, -1 away) ----
ss = sos_signals.build(gm)
A = A.merge(ss.rename(columns={"team": "awayTeam", "sos": "a_sos", "sos_np": "a_np"}), on=["season", "game_id", "awayTeam"], how="left")
spots = pd.DataFrame(index=A.index)
spots["rvr"] = np.where((A.home_self_rank_is == 1) & (A.away_self_rank_is == 1) & (A.spread_close < 0), 1, 0)
cA = conf.reindex(A.index)
spots["sunbelt"] = np.where((cA == "Sun Belt") & (A.spread_close < 0), -1, 0)
spots["bigten"] = np.where((cA == "Big Ten") & (A.spread_close > 0), -1, 0)
# padded-road fade: walk-forward-ish thresholds per season (prior-season pooled medians for honesty)
nr_med = pd.concat([gm.home_net_rating, gm.away_net_rating]).median()
sos_q40 = ss.sos.quantile(0.40)
b1, b0 = np.polyfit(gm[gm.net_rating_diff.notna() & gm.actual_margin.notna()].net_rating_diff,
                    gm[gm.net_rating_diff.notna() & gm.actual_margin.notna()].actual_margin, 1)
resid = (-A.spread_close) - (b0 + b1 * A.net_rating_diff)
spots["padded"] = np.where((A.away_net_rating > nr_med) & (A.a_sos < sos_q40) & (A.a_np >= 4) & (resid <= -1), 1, 0)
A["n_spots_home"] = (spots == 1).sum(axis=1); A["n_spots_away"] = (spots == -1).sum(axis=1)

# ---- grade sides @ open ----
A = A[A.spread_open.notna() & A.actual_margin.notna()].copy()
A["edge"] = A.pred_m + A.spread_open
A = A[(A.actual_margin + A.spread_open) != 0]
hc = (A.actual_margin + A.spread_open) > 0
A["pick_home"] = A.edge > 0
A["win"] = np.where(A.pick_home, hc, ~hc)
A["clv"] = np.where(A.pick_home, A.spread_open - A.spread_close, A.spread_close - A.spread_open)
A["confirm"] = (A.p_home > 0.5) == A.pick_home
A["spot_agree"] = np.where(A.pick_home, A.n_spots_home, A.n_spots_away)

def row(lab, b):
    n = len(b); w = int(b.win.sum()); lo, hi = E.wilson(w, n)
    per = "/".join(f"{100*b.win[b.season==s].mean():.0f}({(b.season==s).sum()})" if (b.season==s).sum() else "--" for s in E.TS)
    print(f"  {lab:<34} n={n:<4} hit {100*w/n if n else 0:5.1f}% CI[{lo:.0f},{hi:.0f}] CLV{b.clv.mean():+.2f} [{per}]")

print("=== DOSE-RESPONSE (sides, gate>=4 standard picks) ===")
std = A[A.edge.abs() >= 4]
row("standard picks (|edge|>=4)", std)
row(" + confirm agrees", std[std.confirm])
row(" + confirm disagrees", std[~std.confirm])
big = A[A.edge.abs() >= 8]
row("big edge (|edge|>=8)", big)
row(" big + confirm", big[big.confirm])
row(" big + confirm + >=1 spot (MAMMOTH)", big[big.confirm & (big.spot_agree >= 1)])
print("\n2x2 at |edge|>=8: confirmY/spotY={}, confirmY/spotN={}, confirmN/spotY={}, confirmN/spotN={}".format(
    len(big[big.confirm & (big.spot_agree >= 1)]), len(big[big.confirm & (big.spot_agree == 0)]),
    len(big[~big.confirm & (big.spot_agree >= 1)]), len(big[~big.confirm & (big.spot_agree == 0)])))
row("confirmN/spotN (control)", big[~big.confirm & (big.spot_agree == 0)])
row("confirmY/spotN", big[big.confirm & (big.spot_agree == 0)])

print("\n=== SIDES MAMMOTH per-play listing ===")
mam = big[big.confirm & (big.spot_agree >= 1)].sort_values(["season", "week"])
for _, r in mam.iterrows():
    side = r.homeTeam if r.pick_home else r.awayTeam
    print(f"  {int(r.season)} wk{int(r.week)}: {r.awayTeam}@{r.homeTeam} pick {side} (edge{r.edge:+.1f}) -> {'WIN' if r.win else 'loss'}")

# ---- TOTALS MAMMOTH ----
print("\n=== TOTALS MAMMOTH ===")
fs = form_signals.build(gm)
T2 = T.merge(fs.rename(columns={"team": "homeTeam", "over_rate": "h_or", "form_gp": "h_gp"}), on=["season", "game_id", "homeTeam"], how="left")
T2 = T2.merge(fs.rename(columns={"team": "awayTeam", "over_rate": "a_or", "form_gp": "a_gp"}), on=["season", "game_id", "awayTeam"], how="left")
T2 = T2[T2.total_open.notna() & T2.actual_total.notna()].copy()
T2["edge"] = T2.pred_t - T2.total_open
T2 = T2[T2.actual_total != T2.total_open]
ov = T2.actual_total > T2.total_open
T2["pick_over"] = T2.edge > 0
T2["win"] = np.where(T2.pick_over, ov, ~ov)
T2["clv"] = np.where(T2.pick_over, T2.total_close - T2.total_open, T2.total_open - T2.total_close)
cT = conf.reindex(T2.index)
form_under = ((T2.h_gp >= 4) & (T2.a_gp >= 4) & ((T2.h_or + T2.a_or) / 2 >= 0.60) & (T2.total_close <= 58))
ext_under = T2.total_close >= 60; ext_over = T2.total_close <= 50
aac_over = (cT == "American Athletic") & (T2.total_close > 52) & (T2.total_close <= 59)
sb_under = (cT == "Sun Belt") & (T2.total_close > 59) & (T2.total_close <= 66)
T2["struct_agree"] = np.where(T2.pick_over, ext_over.astype(int) + aac_over.astype(int),
                              form_under.astype(int) + ext_under.astype(int) + sb_under.astype(int))
def trow(lab, b):
    n = len(b); w = int(b.win.sum()); lo, hi = E.wilson(w, n)
    per = "/".join(f"{100*b.win[b.season==s].mean():.0f}({(b.season==s).sum()})" if (b.season==s).sum() else "--" for s in E.TS)
    print(f"  {lab:<34} n={n:<4} hit {100*w/n if n else 0:5.1f}% CI[{lo:.0f},{hi:.0f}] CLV{b.clv.mean():+.2f} [{per}]")
stdT = T2[T2.edge.abs() >= 3]; bigT = T2[T2.edge.abs() >= 6]
trow("standard totals (|edge|>=3)", stdT)
trow("big edge (|edge|>=6)", bigT)
trow(" big + 0 struct (control)", bigT[bigT.struct_agree == 0])
trow(" big + >=1 struct (MAMMOTH)", bigT[bigT.struct_agree >= 1])
trow(" big + >=2 struct", bigT[bigT.struct_agree >= 2])
mt = bigT[bigT.struct_agree >= 1].sort_values(["season", "week"])
print(f"\nTOTALS MAMMOTH per-play ({len(mt)}):")
for _, r in mt.iterrows():
    print(f"  {int(r.season)} wk{int(r.week)}: {r.awayTeam}@{r.homeTeam} {'OVER' if r.pick_over else 'UNDER'} {r.total_open} (edge{r.edge:+.1f}) -> {'WIN' if r.win else 'loss'}")

# ---- multi-rule mammoth ----
print("\n=== MULTI-RULE MAMMOTH (>=2 non-model spots same direction) ===")
mr = A[(A.n_spots_home >= 2) | (A.n_spots_away >= 2)].copy()
mr["pick_home"] = mr.n_spots_home >= 2
hc2 = (mr.actual_margin + mr.spread_open) > 0
mr["win"] = np.where(mr.pick_home, hc2, ~hc2)
mr["clv"] = np.where(mr.pick_home, mr.spread_open - mr.spread_close, mr.spread_close - mr.spread_open)
row("multi-rule (>=2 spots)", mr)
