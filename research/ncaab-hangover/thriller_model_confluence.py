#!/usr/bin/env python3
"""Does it matter when the ORIGINATOR MODEL agrees with the home-thriller letdown signal? Walk-forward model predictions (research
_cbb_panel_preds_6s.parquet, aligned to cbb_panel_hist.parquet: fg_0 = out-of-sample predicted points residual per team-game) -> per game
model edge toward the HOME team = pred_home - pred_away (points vs the closing line). Signal = previous game a true home game with KenPom
thrill >= 60, >= 4 days ago, tonight a regular-season home game -> bet the visitor. Writes THRILLER_MODEL_CONFLUENCE.txt."""
import io, contextlib, numpy as np, pandas as pd
with contextlib.redirect_stdout(io.StringIO()):
    import thriller_next as T
H = T.H; D = T.D; rec = H.rec; BB = H.BB
out = open("THRILLER_MODEL_CONFLUENCE.txt", "w")
def P(*a):
    s = " ".join(str(x) for x in a); print(s); out.write(s + "\n"); out.flush()
PH = pd.read_parquet(f"{BB}/cbb_panel_hist.parquet", columns=["cbbd_id", "is_home", "date"])
PH["pred"] = pd.read_parquet(f"{BB}/_cbb_panel_preds_6s.parquet", columns=["fg_0"]).fg_0.values
PH = PH.dropna(subset=["pred", "cbbd_id"]); PH["cbbd_id"] = PH.cbbd_id.astype(int)
hp = PH[PH.is_home == 1][["cbbd_id", "pred"]].rename(columns={"pred": "pred_home"}); ap = PH[PH.is_home == 0][["cbbd_id", "pred"]].rename(columns={"pred": "pred_away"})
E = hp.merge(ap, on="cbbd_id"); E["model_home_edge"] = E.pred_home - E.pred_away
D = D.merge(E[["cbbd_id", "model_home_edge"]], on="cbbd_id", how="left")
# D is the team's row; the signal is defined from the HOME team's row (is_home == 1) -> model edge toward the home team is as stored
reg = (D.conf_tourney != 1) & (D.ncaa_t != 1) & (D.p_conf_tourney != 1)
sig = (D.p_is_home == 1) & (D.p_neutral == 0) & (D.is_home == 1) & (D.neutral == 0) & reg & (D.p_thrill >= 60) & (D.gap >= 4)
S = D[sig].copy(); S["vis_cover"] = -S.cover            # the bet is the visitor
P(f"signal games: {len(S)}; with a model prediction: {int(S.model_home_edge.notna().sum())} (the model needs ~a month of each season to start)")
def line(label, m):
    s = S[m]; w, l = rec(s.vis_cover)
    if len(s) < 15: P(f"  {label:<70} n={len(s)} (thin)"); return
    roi = 100 * (((s.spread_price.fillna(1.91) - 1) * (s.vis_cover > 0)).sum() - (s.vis_cover < 0).sum()) / max(w + l, 1)
    per = " ".join(f"{str(y)[2:]}:{rec(g.vis_cover)[0]}-{rec(g.vis_cover)[1]}" for y, g in s.groupby("season_end"))
    P(f"  {label:<70} VISITOR {w}-{l} ({100*w/max(w+l,1):.1f}%, {roi:+.1f}%) n={len(s)} | model edge toward home {s.model_home_edge.mean():+.2f} | {per}")
P("\n=== THE SIGNAL x THE MODEL'S SIDE (model edge toward the home team, points vs the line) ===")
line("signal, all (with a model prediction)", S.model_home_edge.notna())
line("model AGREES: leans visitor (home edge < 0)", S.model_home_edge < 0)
line("   ... leans visitor by 1.5+ (the production bet band starts here)", S.model_home_edge <= -1.5)
line("   ... leans visitor by 1.5 to 4 (model would BET the visitor)", S.model_home_edge.between(-4, -1.5))
line("   ... leans visitor by 0 to 1.5 (model agrees but would not bet)", S.model_home_edge.between(-1.5, 0, inclusive="left"))
line("model DISAGREES: leans home (home edge > 0)", S.model_home_edge > 0)
line("   ... leans home by 0 to 1.5", S.model_home_edge.between(0, 1.5))
line("   ... leans home by 1.5+ (model would bet the HOME team)", S.model_home_edge >= 1.5)
P("\n=== DOSE: model edge toward the visitor, in bins ===")
for lo, hi in ((-99, -4), (-4, -2.5), (-2.5, -1.5), (-1.5, -0.5), (-0.5, 0.5), (0.5, 1.5), (1.5, 2.5), (2.5, 99)):
    line(f"   home edge {lo} .. {hi}", S.model_home_edge.between(lo, hi, inclusive="left"))
P("\n=== THE MODEL'S OWN RECORD ON THESE GAMES (sanity: the model betting its side in its band) ===")
band = S.model_home_edge.abs().between(1.5, 4); s = S[band]; side = np.sign(s.model_home_edge) * s.cover; w, l = rec(side)
P(f"  model band bets inside the signal games: {w}-{l} ({100*w/max(w+l,1):.1f}%) n={len(s)}")
# and league-wide base for the model's band, same seasons, home rows only
A = D[(D.is_home == 1) & reg & D.model_home_edge.abs().between(1.5, 4)]; side = np.sign(A.model_home_edge) * A.cover; w, l = rec(side)
P(f"  model band bets league-wide (home rows): {w}-{l} ({100*w/max(w+l,1):.1f}%) n={len(A)}")
out.close()
