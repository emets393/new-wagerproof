#!/usr/bin/env python3
"""RECEIVING YARDS / RECEPTIONS — the FOOTBALL-LOGIC chain (owner, 2026-09-19).
"High blitz / full boxes / pressure give the QB less time; with less time he throws to his FIRST READ; we know who the
first read is."  Also: "high wind" shortens the throw — the deep receiver loses, the short one keeps his volume.
Play level (nflverse pbp x FTN charting 2022-25: read_thrown, n_pass_rushers, n_defense_box, qb_hit):
  (A) does blitz / pressure / heavy box push the throw to the first read?  league rates per season
  (B) per QB, ENTERING: first-read rate overall and when blitzed (K-seeded); per RECEIVER, entering: his share of the
      team's first-read throws, and the first-read share of HIS targets; per OPPONENT entering: blitz rate, heavy-box
      rate on passes, QB-hit rate allowed
Receiver level (the priced frames data/_reception_yds_deep_frame.parquet, data/_receptions_deep_frame.parquet):
  (C) pre-registered cells, actual − line per season with mirrors:
      C1 first-read receiver x blitz-heavy opponent (mirror: first-read x low-blitz; non-first-read x blitz-heavy)
      C2 first-read receiver x pressure-heavy opponent      C3 first-read receiver x heavy-box-on-pass opponent
      C4 deep receiver (entering aDOT >= 12) x wind >= 15 (mirror: short receiver x wind; deep x calm)
      C5 his QB goes to the first read under blitz MORE than league x first-read receiver x blitz-heavy opponent
  (D) the model: line + frozen set + mechanism features, walk-forward 2024/2025, all-configs, at best book."""
import glob, itertools, sys, numpy as np, pandas as pd, warnings
warnings.filterwarnings("ignore"); num = lambda s: pd.to_numeric(s, errors="coerce")
from prop_engine import ridge
K = 4.0
# ================================================================= play panel
COLS = ["game_id","play_id","season","week","season_type","posteam","defteam","pass","qb_dropback","passer_player_name","receiver_player_name","air_yards","qb_hit","sack","complete_pass","yards_gained"]
pbp = pd.concat([pd.read_parquet(f, columns=COLS) for f in ["data/pbp_cache/_dl_2022.parquet"] + sorted(glob.glob("data/pbp_cache/pbp_202[345].parquet"))], ignore_index=True)
pbp = pbp[(pbp.season_type == "REG") & (pbp["pass"] == 1)].copy()
ftn = pd.concat([pd.read_parquet("data/ftn_charting.parquet"), pd.read_parquet("data/ftn_charting_2025.parquet")], ignore_index=True)
for x, y in (("nflverse_game_id","game_id"), ("nflverse_play_id","play_id")):
    if y in ftn.columns and x in ftn.columns: ftn[y] = ftn[y].fillna(ftn[x]); ftn = ftn.drop(columns=x)
    elif x in ftn.columns: ftn = ftn.rename(columns={x: y})
ftn["play_id"] = num(ftn.play_id); ftn = ftn[["game_id","play_id","read_thrown","n_pass_rushers","n_defense_box"]].drop_duplicates(["game_id","play_id"])
P = pbp.merge(ftn, on=["game_id","play_id"], how="inner"); P["rt"] = P.read_thrown.astype(str); P = P[P.rt != "0"].copy()   # '0' = sack / throwaway / no read charted (47% sacks)
P["first"] = (P.rt == "1").astype(float); P["blitz"] = (num(P.n_pass_rushers) >= 5).astype(float); P["heavy"] = (num(P.n_defense_box) >= 7).astype(float); P["hit"] = num(P.qb_hit).fillna(0).astype(float)
P["ay"] = num(P.air_yards); P["qb"] = P.passer_player_name; P["rcv"] = P.receiver_player_name; P["team"] = P.posteam; P["opp"] = P.defteam
print(f"play panel: {len(P)} charted dropbacks 2022-25 | first-read share {P['first'].mean():.3f} | blitz share {P.blitz.mean():.3f} | heavy-box-on-pass share {P.heavy.mean():.3f}")
print("\n(A) THE CHAIN, league-wide per season: first-read rate when blitzed vs not | when QB hit vs not | heavy box vs light | checkdown rate blitzed vs not")
for s, g in P.groupby("season"):
    print(f"  {s}: blitz {g[g.blitz==1]['first'].mean():.3f} vs {g[g.blitz==0]['first'].mean():.3f} | hit {g[g.hit==1]['first'].mean():.3f} vs {g[g.hit==0]['first'].mean():.3f} | heavy {g[g.heavy==1]['first'].mean():.3f} vs {g[g.heavy==0]['first'].mean():.3f} | checkdown {(g[g.blitz==1].rt=='CHK').mean():.3f} vs {(g[g.blitz==0].rt=='CHK').mean():.3f} | air yds on 1st read {g[g['first']==1].ay.mean():.1f} vs other {g[g['first']==0].ay.mean():.1f}")
# ================================================================= entering rates (counts -> K-seeded, cumulative minus this game; zero counts are ZERO)
def entering(df, key, n_c, c_c, kplays):
    x = df.copy(); g = x.groupby([key,"season"]); pri = g.agg(a=(c_c,"sum"), b=(n_c,"sum")); pri["r"] = pri.a / pri.b.replace(0, np.nan)
    p = pd.Series([pri.r.get((t, s - 1), np.nan) for t, s in zip(x[key], x.season)], index=x.index)
    cs = g[c_c].cumsum() - x[c_c]; cn = g[n_c].cumsum() - x[n_c]; v = (cs + kplays * p.fillna(0)) / (cn + kplays * p.notna()); v[(cn == 0) & p.isna()] = np.nan; return v
# QB: first-read rate overall / blitzed / not
QW = P.groupby(["qb","season","week"]).agg(n=("first","size"), f=("first","sum"), nb=("blitz","sum"), fb=("first", lambda s: 0.0), team=("team","first")).reset_index()
fb = P[P.blitz == 1].groupby(["qb","season","week"])["first"].sum().rename("fb"); QW = QW.drop(columns="fb").merge(fb, on=["qb","season","week"], how="left"); QW["fb"] = QW.fb.fillna(0)
QW["nnb"] = QW.n - QW.nb; QW["fnb"] = QW.f - QW.fb; QW = QW.sort_values(["qb","season","week"])
QW["qb_first"] = entering(QW, "qb", "n", "f", 60); QW["qb_first_blitz"] = entering(QW, "qb", "nb", "fb", 30); QW["qb_first_noblitz"] = entering(QW, "qb", "nnb", "fnb", 60); QW["qb_blitz_lift"] = QW.qb_first_blitz - QW.qb_first_noblitz
# team's primary QB entering a week = the passer with most dropbacks in the team's PREVIOUS game
TQ = P.groupby(["team","season","week","qb"]).size().rename("n").reset_index().sort_values(["team","season","week","n"]).groupby(["team","season","week"]).tail(1)[["team","season","week","qb"]]
TQ = TQ.sort_values(["team","season","week"]); TQ["qb_prev"] = TQ.groupby(["team","season"]).qb.shift(1); TQ["qb_prev"] = TQ.qb_prev.fillna(TQ.groupby("team").qb.shift(1))
# receiver: share of team first-read throws entering; first-read share of his own targets entering; targets
R1 = P[P.rcv.notna()].groupby(["rcv","team","season","week"]).agg(t=("first","size"), tf=("first","sum")).reset_index()
T1 = P.groupby(["team","season","week"]).agg(team_f=("first","sum")).reset_index(); R1 = R1.merge(T1, on=["team","season","week"], how="left").sort_values(["rcv","season","week"])
R1["rcv_first_share"] = entering(R1, "rcv", "team_f", "tf", 40); R1["rcv_first_rate"] = entering(R1, "rcv", "t", "tf", 20)
# opponent: blitz rate, heavy box on passes, QB-hit rate allowed, first-read rate FORCED (first-read share of throws against them)
DW = P.groupby(["opp","season","week"]).agg(n=("first","size"), b=("blitz","sum"), h=("heavy","sum"), q=("hit","sum"), f=("first","sum")).reset_index().sort_values(["opp","season","week"])
DW["opp_blitz"] = entering(DW, "opp", "n", "b", 100); DW["opp_heavy"] = entering(DW, "opp", "n", "h", 100); DW["opp_hit"] = entering(DW, "opp", "n", "q", 100); DW["opp_first_forced"] = entering(DW, "opp", "n", "f", 100)
LG = dict(blitz=DW.opp_blitz.mean(), heavy=DW.opp_heavy.mean(), hit=DW.opp_hit.mean(), qbl=QW.qb_blitz_lift.mean())
print(f"\n(B) entering rates built. league means: opp blitz {LG['blitz']:.3f}, heavy box on pass {LG['heavy']:.3f}, QB-hit allowed {LG['hit']:.3f}; QB blitz lift in first-read rate {LG['qbl']:+.3f} (sd {QW.qb_blitz_lift.std():.3f})")
# ================================================================= attach to the priced receiver frames
def build(stat):
    d = pd.read_parquet(f"data/_{stat}_deep_frame.parquet").copy(); d["team"] = d.team.replace({"LAR":"LA"}); d["opp"] = d.opp.replace({"LAR":"LA"})
    d = d.merge(R1[["rcv","team","season","week","rcv_first_share","rcv_first_rate"]].rename(columns={"rcv":"qb"}), on=["qb","team","season","week"], how="left")
    d = d.merge(TQ[["team","season","week","qb_prev"]], on=["team","season","week"], how="left").merge(QW[["qb","season","week","qb_first","qb_first_blitz","qb_first_noblitz","qb_blitz_lift"]].rename(columns={"qb":"qb_prev"}), on=["qb_prev","season","week"], how="left")
    d = d.merge(DW[["opp","season","week","opp_blitz","opp_heavy","opp_hit","opp_first_forced"]], on=["opp","season","week"], how="left")
    RV = pd.read_parquet("data/_targets_proj_frame.parquet"); RV["pid"] = RV.pid.astype(str); d["pid"] = d.pid.astype(str)
    d = d.merge(RV[["pid","season","week","e_first","e_adot","e_db"]].drop_duplicates(["pid","season","week"]), on=["pid","season","week"], how="left", suffixes=("", "_rv"))
    for c in ("e_adot","e_first","e_db"):
        if c + "_rv" in d.columns: d[c] = d[c].fillna(d[c + "_rv"]); d = d.drop(columns=c + "_rv")
    # the mechanism features: who he is x what the opponent forces x how his QB reacts
    d["ix_first_blitz"] = d.rcv_first_share * (d.opp_blitz - LG["blitz"]); d["ix_first_hit"] = d.rcv_first_share * (d.opp_hit - LG["hit"]); d["ix_first_heavy"] = d.rcv_first_share * (d.opp_heavy - LG["heavy"])
    d["ix_first_qb"] = d.rcv_first_share * d.qb_blitz_lift.fillna(0) * (d.opp_blitz - LG["blitz"]); d["ix_adot_wind"] = d.e_adot * d.wind; d["ix_first_forced"] = d.rcv_first_share * (d.opp_first_forced - DW.opp_first_forced.mean())
    d["exp_first_tgts"] = d.e_db.fillna(d.e_db.median()) * (d.qb_first.fillna(P["first"].mean()) + d.qb_blitz_lift.fillna(0) * (d.opp_blitz.fillna(LG["blitz"]) - LG["blitz"]) / max(LG["blitz"], 1e-6)) * d.rcv_first_share.fillna(0)
    d["res"] = d.actual - d.close_line; return d
MECH = ["rcv_first_share","rcv_first_rate","qb_first","qb_first_blitz","qb_blitz_lift","opp_blitz","opp_heavy","opp_hit","opp_first_forced","ix_first_blitz","ix_first_hit","ix_first_heavy","ix_first_qb","ix_adot_wind","ix_first_forced","exp_first_tgts"]
def cells(d, stat):
    print("\n" + "=" * 120); print(f"(C) PRE-REGISTERED CELLS — {stat}: actual − line (mean / median / over% / n) per season. Terciles are within-season."); print("=" * 120)
    d = d[d.rcv_first_share.notna() & d.opp_blitz.notna()].copy()
    for c in ("opp_blitz","opp_hit","opp_heavy","rcv_first_share","qb_blitz_lift"): d[c + "_t"] = d.groupby("season")[c].transform(lambda s: pd.qcut(s.rank(method="first"), 3, labels=False))
    d["FR"] = d.rcv_first_share_t == 2; d["nFR"] = d.rcv_first_share_t == 0; d["deep"] = d.e_adot >= 12; d["short"] = d.e_adot < 8; d["windy"] = d.wind >= 15; d["calm"] = d.wind < 8
    CELLS = [("C1 first-read x blitz-heavy opp", d.FR & (d.opp_blitz_t == 2)), ("   mirror: first-read x low-blitz opp", d.FR & (d.opp_blitz_t == 0)), ("   mirror: NON-first-read x blitz-heavy", d.nFR & (d.opp_blitz_t == 2)),
             ("C2 first-read x pressure-heavy opp", d.FR & (d.opp_hit_t == 2)), ("   mirror: NON-first-read x pressure-heavy", d.nFR & (d.opp_hit_t == 2)),
             ("C3 first-read x heavy-box opp", d.FR & (d.opp_heavy_t == 2)), ("   mirror: NON-first-read x heavy-box", d.nFR & (d.opp_heavy_t == 2)),
             ("C4 deep receiver x wind 15+", d.deep & d.windy), ("   mirror: short receiver x wind 15+", d.short & d.windy), ("   mirror: deep receiver x calm", d.deep & d.calm),
             ("C5 QB blitz-lift high x first-read x blitz-heavy", (d.qb_blitz_lift_t == 2) & d.FR & (d.opp_blitz_t == 2)), ("   mirror: QB blitz-lift LOW x first-read x blitz-heavy", (d.qb_blitz_lift_t == 0) & d.FR & (d.opp_blitz_t == 2)),
             ("C6 first-read x opp forces first read (top tercile)", d.FR & (d.groupby('season').opp_first_forced.transform(lambda s: pd.qcut(s.rank(method='first'), 3, labels=False)) == 2))]
    for lab, m in CELLS:
        out = []
        for s in (2023, 2024, 2025):
            x = d[m & (d.season == s)]; out.append(f"{s}: {x.res.mean():+5.2f} / {x.res.median():+4.1f} / {100*(x.actual > x.close_line).mean():4.1f}% n={len(x):3d}" if len(x) else f"{s}: —")
        print(f"  {lab:52s} " + " | ".join(out))
    allr = d.res; print(f"  {'league (all rows)':52s} " + " | ".join(f"{s}: {d[d.season==s].res.mean():+5.2f} / {d[d.season==s].res.median():+4.1f} / {100*(d[d.season==s].actual > d[d.season==s].close_line).mean():4.1f}% n={int((d.season==s).sum()):3d}" for s in (2023, 2024, 2025)))
    # continuous: correlation of each mechanism feature with the residual, per season
    print("  correlation with actual − line, per season: " + " | ".join(f"{c}: " + "/".join(f"{np.corrcoef(d[d.season==s][c].fillna(0), d[d.season==s].res)[0,1]:+.2f}" for s in (2023, 2024, 2025)) for c in ("ix_first_blitz","ix_first_hit","ix_first_heavy","ix_first_qb","ix_adot_wind","exp_first_tgts","rcv_first_share")))
def fit(tr, te, F, lam=200):
    Fk = [c for c in F if tr[c].std() > 1e-9]; X = tr[Fk].values.astype(float); mu, sd = X.mean(0), X.std(0); sd[sd == 0] = 1; w = ridge((X - mu) / sd, tr.actual.values.astype(float), lam); return np.hstack([(te[Fk].values.astype(float) - mu) / sd, np.ones((len(te), 1))]) @ w
def gbest(x, pred, thr):
    e = pred - x.close_line.values; sel = (np.abs(e) >= thr) & x.bo_line.notna().values; x = x[sel]; e = e[sel]
    if not len(x): return np.nan, 0, np.nan
    over = e > 0; line = np.where(over, x.bo_line, x.bu_line); pay = np.where(over, x.bo_dec, x.bu_dec); won = np.where(over, x.actual > line, x.actual < line); push = x.actual.values == line
    p = np.where(push, 0, np.where(won, pay, -1.0)); return (won[~push].mean() if (~push).sum() else np.nan), int((~push).sum()), p.mean()
def model(d, stat, SC, base):
    print("\n" + "=" * 120); print(f"(D) THE MODEL — {stat}: line + frozen set, then + mechanism features; walk-forward, bet ≥ {SC} at best book"); print("=" * 120)
    F0 = [c for c in base if c in d.columns]; d[MECH] = d[MECH].apply(lambda s: s.fillna(s.median())).fillna(0)
    for name, F in (("frozen set", F0), ("frozen + mechanism", F0 + MECH), ("line + mechanism only", ["close_line","l5","szn"] + MECH), ("line + first-read x blitz/hit/heavy", ["close_line","l5","szn","rcv_first_share","ix_first_blitz","ix_first_hit","ix_first_heavy","ix_first_qb","exp_first_tgts"]), ("line + aDOT x wind", ["close_line","l5","szn","e_adot","ix_adot_wind"])):
        out = []
        for yr in (2024, 2025):
            tr, te = d[d.season < yr], d[d.season == yr]; pred = fit(tr, te, F); out.append(f"{yr}: MAE {np.abs(pred - te.actual).mean():5.2f} | " + " ".join(f"≥{t:g}: {100*gbest(te, pred, t)[0] if gbest(te, pred, t)[1] else np.nan:4.1f}%/{gbest(te, pred, t)[1]:3d} {100*gbest(te, pred, t)[2] if gbest(te, pred, t)[1] else np.nan:+5.1f}%" for t in (SC * 0.7, SC, SC * 1.5)))
        print(f"  {name:38s} " + " | ".join(out))
    res = []
    for lam, thr in itertools.product((60, 200, 600), (SC * 0.7, SC, SC * 1.5)):
        r = {}
        for yr in (2024, 2025): tr, te = d[d.season < yr], d[d.season == yr]; w, n, roi = gbest(te, fit(tr, te, F0 + MECH, lam), thr); r[yr] = roi if n >= 30 else np.nan
        res.append(r)
    R = pd.DataFrame(res).dropna(); print(f"  all-configs frozen + mechanism: 2024 {100*(R[2024]>0).mean():3.0f}% profitable (median {100*R[2024].median():+5.1f}%) | 2025 {100*(R[2025]>0).mean():3.0f}% (median {100*R[2025].median():+5.1f}%) | both {100*((R[2024]>0)&(R[2025]>0)).mean():3.0f}%")
    # the mechanism as a SIDE rule on top of the frozen model: frozen says over AND first-read x blitz says over
    for yr in (2024, 2025):
        tr, te = d[d.season < yr], d[d.season == yr].copy(); te["p0"] = fit(tr, te, F0); te["pm"] = fit(tr, te, F0 + MECH); agree = (np.sign(te.p0 - te.close_line) == np.sign(te.pm - te.close_line)) & ((te.pm - te.close_line).abs() >= SC) & ((te.p0 - te.close_line).abs() >= SC * 0.7)
        w, n, roi = gbest(te[agree], te[agree].pm.values, 0); print(f"  agreement (frozen ≥{SC*0.7:g} and mechanism ≥{SC:g}, same side) {yr}: {100*w if n else np.nan:.1f}%/{n} {100*roi if n else np.nan:+.1f}%")
import io, contextlib
src = open("exp_prop_injury_context.py").read().split('print("\\n" + "=" * 130)')[0]; ns = {}
with contextlib.redirect_stdout(io.StringIO()): exec(compile(src, "ic", "exec"), ns)
PE = ns["PE"]
for stat, SC in (("reception_yds", 12.0), ("receptions", 0.7)):
    d = build(stat); print(f"\n{'#' * 120}\n{stat}: {len(d)} priced lines | first-read share coverage {d.rcv_first_share.notna().mean():.0%} | QB tendencies {d.qb_first.notna().mean():.0%} | opp {d.opp_blitz.notna().mean():.0%}")
    print("  top entering first-read shares 2025 (who the first read IS): " + ", ".join(f"{r.qb} {r.rcv_first_share:.2f}" for r in d[d.season == 2025].sort_values("week").groupby("qb").tail(1).nlargest(12, "rcv_first_share").itertuples()))
    cells(d, stat); model(d, stat, SC, PE.NARROW_RECV); d.to_parquet(f"data/_{stat}_mech_frame.parquet", index=False)
