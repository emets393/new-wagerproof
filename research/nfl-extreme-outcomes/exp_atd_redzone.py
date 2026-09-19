#!/usr/bin/env python3
"""ANYTIME TD — RED-ZONE PLAY CALLING, DEPTH USAGE, AND PER-PLAYER SITUATIONAL TENDENCY (owner, 2026-09-19).
Built from scratch with ZEROS AS ZEROS (FP omits the row when a count is 0; 91% of inside-5 snap cells are blank = the player
was not on the field inside the 5, not missing). Everything ENTERING (cumulative minus this game, K=4 prior-season seed).
Team, per week:   inside-20 / inside-10 / inside-5 snaps per game (trips), inside-5 pass rate (1 − inside-5 rush att / inside-5 snaps),
                  inside-10 and inside-20 pass rate (run-pass report), TDs per game
Opponent allowed: inside-5 rush attempts, rush TDs, end-zone targets, receiving TDs, inside-20 targets — per game
Player:           inside-20/10/5 snap share, inside-20/10/5 rush attempts + inside-5 rush share, inside-10/20 targets, end-zone
                  targets + share, red-zone TD conversion (TDs per inside-20 touch), TDs per game and share of team TDs, last-3 vs
                  season inside-5 snap share (role trend)
Then: (1) structure — scored rate vs implied by usage quintile / team play-calling / opponent, per position
      (2) situation cells, per season, ROI at the best price, with a paired placebo
      (3) per-player tendency by situation (pass-heavy vs run-heavy red-zone week, soft vs stout opponent, home/away, role up/down),
          strict per-season stability, then the forecast window (learn ≤2025 wk12 → 2025 wk13-22)"""
import numpy as np, pandas as pd, warnings
warnings.filterwarnings("ignore"); num = lambda s: pd.to_numeric(s, errors="coerce"); K = 4.0
from fp_hist import read_fp
import prop_engine as E
tk = lambda d: d.teamNickname.map(E.NICK).map(lambda a: E.AB_NV.get(a, a))
# ---------------------------------------------------------------- player-game base (everyone who played: snaps table)
sn = read_fp("player_offense-snaps"); sn = sn[sn.__season >= 2022].copy(); sn["team"] = tk(sn)
for k, c in (("p_in5","playerStatsInside5SnapsOffenseTotal"),("p_in10","playerStatsInside10SnapsOffenseTotal"),("p_in20","playerStatsInside20SnapsOffenseTotal"),("t_in5","teamStatsInside5SnapsOffenseTotal"),("t_in10","teamStatsInside10SnapsOffenseTotal"),("t_in20","teamStatsInside20SnapsOffenseTotal"),("p_snaps","playerStatsSnapsOffenseTotal"),("t_snaps","teamStatsSnapsOffenseTotal")): sn[k] = num(sn[c]).fillna(0)
P = sn[["playerPlayerId","playerPosition","team","__season","__week","p_in5","p_in10","p_in20","t_in5","t_in10","t_in20","p_snaps","t_snaps"]].rename(columns={"__season":"season","__week":"week","playerPosition":"pos"})
rb = read_fp("rushingBasic__player"); rb = rb[rb.__season >= 2022].copy()
for k, c in (("in5_att","playerStatsInside5RushingAttemptsTotal"),("in10_att","playerStatsInside10RushingAttemptsTotal"),("in20_att","playerStatsInside20RushingAttemptsTotal"),("in10_tgt","playerStatsInside10ReceivingTargetsTotal"),("in20_tgt","playerStatsInside20ReceivingTargetsTotal"),("ru_td","playerStatsRushingTouchdownsTotal"),("rc_td","playerStatsReceivingTouchdownsTotal")): rb[k] = num(rb[c]).fillna(0)
P = P.merge(rb[["playerPlayerId","__season","__week","in5_att","in10_att","in20_att","in10_tgt","in20_tgt","ru_td","rc_td"]].rename(columns={"__season":"season","__week":"week"}).drop_duplicates(["playerPlayerId","season","week"]), on=["playerPlayerId","season","week"], how="left")
ra = read_fp("player_receiving-advanced"); ra = ra[ra.__season >= 2022].copy(); ra["ez_tgt"] = num(ra.playerStatsReceivingTargetsInEndzone).fillna(0); ra["rc_td2"] = num(ra.playerStatsReceivingTouchdownsTotal).fillna(0)
P = P.merge(ra[["playerPlayerId","__season","__week","ez_tgt","rc_td2"]].rename(columns={"__season":"season","__week":"week"}).drop_duplicates(["playerPlayerId","season","week"]), on=["playerPlayerId","season","week"], how="left")
for c in ("in5_att","in10_att","in20_att","in10_tgt","in20_tgt","ru_td","rc_td","ez_tgt","rc_td2"): P[c] = P[c].fillna(0)
P["rc_td"] = P[["rc_td","rc_td2"]].max(axis=1); P["td"] = P.ru_td + P.rc_td; P["rz_touch"] = P.in20_att + P.in20_tgt
# ---------------------------------------------------------------- team-week and opponent-week
tr_ = read_fp("rushingAdvanced__team"); tr_["team"] = tk(tr_); tr_["t_in5_att"] = num(tr_.teamStatsInside5RushingAttemptsTotal).fillna(0); tr_["t_ru_td"] = num(tr_.teamStatsRushingTouchdownsTotal).fillna(0)
tc = read_fp("receivingAdvanced__team"); tc["team"] = tk(tc); tc["t_ez_tgt"] = num(tc.teamStatsReceivingTargetsInEndzone).fillna(0); tc["t_in20_tgt"] = num(tc.teamStatsInside20ReceivingTargetsTotal).fillna(0); tc["t_rc_td"] = num(tc.teamStatsReceivingTouchdownsTotal).fillna(0)
rp = pd.read_parquet("data/fpdata/flat/team_run-pass-report.parquet"); rp["team"] = tk(rp)
for b in ("Inside10","Inside20"): rp[f"t_pass_{b}"] = num(rp[f"{b}__teamStatsSnapsOffensePass"]).fillna(0); rp[f"t_plays_{b}"] = num(rp[f"{b}__teamStatsSnapsOffenseTotal"]).fillna(0)
T = tr_[["team","__season","__week","t_in5_att","t_ru_td"]].merge(tc[["team","__season","__week","t_ez_tgt","t_in20_tgt","t_rc_td"]], on=["team","__season","__week"], how="outer").merge(rp[["team","__season","__week","t_pass_Inside10","t_plays_Inside10","t_pass_Inside20","t_plays_Inside20"]], on=["team","__season","__week"], how="left")
T = T.merge(sn.groupby(["team","__season","__week"])[["t_in5","t_in10","t_in20","t_snaps"]].max().reset_index(), on=["team","__season","__week"], how="left").rename(columns={"__season":"season","__week":"week"}).drop_duplicates(["team","season","week"]).fillna(0); T["t_td"] = T.t_ru_td + T.t_rc_td
oR = read_fp("rushingAdvanced__opponent"); oR["team"] = tk(oR); oR["o_in5_att"] = num(oR.opponentStatsInside5RushingAttemptsTotal).fillna(0); oR["o_ru_td"] = num(oR.opponentStatsRushingTouchdownsTotal).fillna(0)
oC = read_fp("receivingAdvanced__opponent"); oC["team"] = tk(oC); oC["o_ez_tgt"] = num(oC.opponentStatsReceivingTargetsInEndzone).fillna(0); oC["o_rc_td"] = num(oC.opponentStatsReceivingTouchdownsTotal).fillna(0); oC["o_in20_tgt"] = num(oC.opponentStatsInside20ReceivingTargetsTotal).fillna(0)
O = oR[["team","__season","__week","o_in5_att","o_ru_td"]].merge(oC[["team","__season","__week","o_ez_tgt","o_rc_td","o_in20_tgt"]], on=["team","__season","__week"], how="outer").rename(columns={"__season":"season","__week":"week","team":"opp"}).drop_duplicates(["opp","season","week"]).fillna(0); O["o_td"] = O.o_ru_td + O.o_rc_td
# ---------------------------------------------------------------- entering means (K=4 prior-season seed), zeros included
def ent(df, key, cols, k=K):
    x = df.sort_values([key,"season","week"]).copy(); g = x.groupby([key,"season"]); pri = g[cols].mean().reset_index(); pri["season"] = pri.season + 1; pri = pri.rename(columns={c: "_p_" + c for c in cols})
    x = x.merge(pri, on=[key,"season"], how="left"); out = {}
    for c in cols:
        cs = x.groupby([key,"season"])[c].cumsum() - x[c]; cn = x.groupby([key,"season"]).cumcount(); p = x["_p_" + c]
        v = (cs + k * p.fillna(0)) / (cn + k * p.notna()); v[(cn == 0) & p.isna()] = np.nan; out["e_" + c] = v.values
        out["l3_" + c] = x.groupby([key,"season"])[c].transform(lambda s: s.shift(1).rolling(3, min_periods=2).mean()).values
    return pd.concat([x[[key,"season","week"]].reset_index(drop=True), pd.DataFrame(out)], axis=1)
PC = ["p_in5","p_in10","p_in20","p_snaps","in5_att","in10_att","in20_att","in10_tgt","in20_tgt","ez_tgt","td","rz_touch"]
EP = ent(P, "playerPlayerId", PC); TC = ["t_in5_att","t_ru_td","t_ez_tgt","t_in20_tgt","t_rc_td","t_pass_Inside10","t_plays_Inside10","t_pass_Inside20","t_plays_Inside20","t_in5","t_in10","t_in20","t_td","t_snaps"]; ET = ent(T, "team", TC); OC = ["o_in5_att","o_ru_td","o_ez_tgt","o_rc_td","o_in20_tgt","o_td"]; EO = ent(O, "opp", OC)
EP["e_rz_conv"] = EP.e_td / EP.e_rz_touch.replace(0, np.nan)
ET["e_t_in5_pass"] = 1 - ET.e_t_in5_att / ET.e_t_in5.replace(0, np.nan); ET["e_t_in10_pass"] = ET.e_t_pass_Inside10 / ET.e_t_plays_Inside10.replace(0, np.nan); ET["e_t_in20_pass"] = ET.e_t_pass_Inside20 / ET.e_t_plays_Inside20.replace(0, np.nan)
# ---------------------------------------------------------------- join to the priced frame
D = pd.read_parquet("data/_atd_full_frame.parquet"); D = D[D.playerPlayerId.notna()].copy(); D["playerPlayerId"] = D.playerPlayerId.astype(str); EP["playerPlayerId"] = EP.playerPlayerId.astype(str)   # FP ids are hex strings
D = D.drop(columns=[c for c in D.columns if c in EP.columns and c not in ("playerPlayerId","season","week")], errors="ignore")
D = D.merge(EP, on=["playerPlayerId","season","week"], how="left").merge(ET, on=["team","season","week"], how="left").merge(EO, on=["opp","season","week"], how="left")
print(f"  join coverage: player usage {D.e_p_in5.notna().mean():.0%} | team play-calling {D.e_t_in5_pass.notna().mean():.0%} | opponent {D.e_o_td.notna().mean():.0%} of {len(D)} rows")
D["e_in5_snap_sh"] = D.e_p_in5 / D.e_t_in5.replace(0, np.nan); D["e_in10_snap_sh"] = D.e_p_in10 / D.e_t_in10.replace(0, np.nan); D["e_in20_snap_sh"] = D.e_p_in20 / D.e_t_in20.replace(0, np.nan); D["l3_in5_snap_sh"] = D.l3_p_in5 / D.l3_t_in5.replace(0, np.nan); D["e_snap_sh"] = D.e_p_snaps / D.e_t_snaps.replace(0, np.nan)
D["e_in5_att_sh"] = D.e_in5_att / D.e_t_in5_att.replace(0, np.nan); D["e_ez_sh"] = D.e_ez_tgt / D.e_t_ez_tgt.replace(0, np.nan); D["e_in20_tgt_sh"] = D.e_in20_tgt / D.e_t_in20_tgt.replace(0, np.nan); D["e_td_sh"] = D.e_td / D.e_t_td.replace(0, np.nan)
D["role_trend"] = D.l3_in5_snap_sh - D.e_in5_snap_sh; D["res"] = D.scored - D.p_best
D = D[D.e_in5_snap_sh.notna() & D.e_t_in5_pass.notna() & D.e_o_td.notna()].copy()
roi = lambda x: 100 * (x.scored * x.pay - (1 - x.scored)).mean() if len(x) else np.nan
print(f"frame: {len(D)} priced player-games 2023-25 with red-zone usage, team play-calling, opponent allowed | scored {D.scored.mean():.3f} implied {D.p_best.mean():.3f}")
print("league inside-5 pass rate (team-week entering) median {:.2f} | inside-10 {:.2f} | inside-20 {:.2f}".format(D.e_t_in5_pass.median(), D.e_t_in10_pass.median(), D.e_t_in20_pass.median()))
# ---------------------------------------------------------------- (1) structure
print("\n" + "=" * 140); print("(1) STRUCTURE — scored rate / implied / ROI at best price / n, by usage quintile (within position) and by team play-calling"); print("=" * 140)
def by(lab, col, pos=None, q=5):
    x = D if pos is None else D[D.position.isin(pos)]; x = x[x[col].notna()]
    try: b = pd.qcut(x[col].rank(method="first"), q, labels=False)
    except Exception: return
    t = x.groupby(b).agg(lo=(col,"min"), hi=(col,"max"), hit=("scored","mean"), imp=("p_best","mean"), n=("scored","size")); r = x.groupby(b).apply(roi)
    print(f"  {lab:46s} " + " | ".join(f"[{t.loc[i,'lo']:.2f}-{t.loc[i,'hi']:.2f}] {100*t.loc[i,'hit']:4.1f}% vs {100*t.loc[i,'imp']:4.1f}% ROI {r.loc[i]:+5.1f}% n={int(t.loc[i,'n']):4d}" for i in t.index))
by("RB inside-5 snap share", "e_in5_snap_sh", ["RB"]); by("RB inside-5 rush share", "e_in5_att_sh", ["RB"]); by("RB inside-10 rush att / game", "e_in10_att", ["RB"]); by("RB inside-20 targets / game", "e_in20_tgt", ["RB"]); by("RB red-zone TD conversion (TD per RZ touch)", "e_rz_conv", ["RB"])
by("WR inside-20 snap share", "e_in20_snap_sh", ["WR"]); by("WR end-zone target share", "e_ez_sh", ["WR"]); by("WR inside-10 targets / game", "e_in10_tgt", ["WR"]); by("WR red-zone TD conversion", "e_rz_conv", ["WR"])
by("TE inside-10 snap share", "e_in10_snap_sh", ["TE"]); by("TE end-zone target share", "e_ez_sh", ["TE"]); by("TE inside-10 targets / game", "e_in10_tgt", ["TE"])
by("share of his TEAM's TDs (entering), all", "e_td_sh"); by("role trend (last-3 minus season inside-5 snap share)", "role_trend", q=5)
print("  team play-calling:"); by("team inside-5 PASS rate → RBs", "e_t_in5_pass", ["RB"], 3); by("team inside-5 PASS rate → WR/TE", "e_t_in5_pass", ["WR","TE"], 3); by("team inside-10 PASS rate → RBs", "e_t_in10_pass", ["RB"], 3); by("team inside-10 PASS rate → WR/TE", "e_t_in10_pass", ["WR","TE"], 3)
by("team inside-20 snaps / game (trips) → all", "e_t_in20", None, 3); by("team TDs / game → all", "e_t_td", None, 3)
print("  opponent allowed:"); by("opp TDs allowed / game → all", "e_o_td", None, 3); by("opp inside-5 rush att allowed → RBs", "e_o_in5_att", ["RB"], 3); by("opp end-zone targets allowed → WR/TE", "e_o_ez_tgt", ["WR","TE"], 3)
# ---------------------------------------------------------------- (2) situation cells
print("\n" + "=" * 140); print("(2) SITUATION CELLS — hit vs implied, ROI at best price, per season (hit%/n); placebo = same players, same counts, random other games ×200"); print("=" * 140)
def tercile(col, mask=None):
    x = D if mask is None else D[mask]; return x[col].quantile([1/3, 2/3]).values
rng = np.random.default_rng(0)
def cell(lab, m, placebo=True):
    x = D[m]
    if len(x) < 30: print(f"  {lab:60s} n={len(x)}"); return
    line = f"  {lab:60s} n={len(x):4d} hit {100*x.scored.mean():5.1f}% vs {100*x.p_best.mean():5.1f}% ROI {roi(x):+6.1f}% | " + " | ".join(f"{s}: {100*x[x.season==s].scored.mean():4.1f}%/{int((x.season==s).sum()):3d}" if (x.season==s).sum() else f"{s}: —" for s in (2023,2024,2025))
    if placebo:
        pool = D[~m & D.player_id.isin(x.player_id.unique())]; n_by = x.groupby("player_id").size(); sims = []
        for _ in range(200):
            pick = pool.groupby("player_id", group_keys=False).apply(lambda g: g.sample(min(len(g), int(n_by.get(g.name, 0))), random_state=int(rng.integers(1e9))) if n_by.get(g.name, 0) else g.iloc[0:0]); sims.append(roi(pick))
        line += f" | placebo ROI {np.mean(sims):+.1f} ± {np.std(sims):.1f}"
    print(line)
RB = D.position == "RB"; WRTE = D.position.isin(["WR","TE"]); TE = D.position == "TE"; WR = D.position == "WR"
p5 = tercile("e_t_in5_pass"); p10 = tercile("e_t_in10_pass"); od = tercile("e_o_td"); trips = tercile("e_t_in20")
GL = RB & (D.e_in5_att_sh >= 0.5); EZ = WRTE & (D.e_ez_sh >= D[WRTE].e_ez_sh.quantile(2/3))
cell("C1 goal-line back (≥50% inside-5 rushes) × RUN-heavy inside 5", GL & (D.e_t_in5_pass <= p5[0])); cell("C2 goal-line back × PASS-heavy inside 5", GL & (D.e_t_in5_pass >= p5[1])); cell("   goal-line back, any team", GL, False)
cell("C3 WR/TE top-tercile end-zone target share × PASS-heavy inside 5", EZ & (D.e_t_in5_pass >= p5[1])); cell("   same × RUN-heavy inside 5", EZ & (D.e_t_in5_pass <= p5[0])); cell("   top end-zone share, any team", EZ, False)
cell("C4 TE top-tercile inside-10 targets/game", TE & (D.e_in10_tgt >= D[TE].e_in10_tgt.quantile(2/3))); cell("C5 RB on the field inside 5 (snap share ≥.5) but <30% of the rushes", RB & (D.e_in5_snap_sh >= 0.5) & (D.e_in5_att_sh < 0.3))
cell("C6 role RISING (last-3 inside-5 snap share ≥ season + .15)", D.role_trend >= 0.15); cell("   role FALLING (≤ season − .15)", D.role_trend <= -0.15)
cell("C7 goal-line back × opponent allows most TDs (top tercile)", GL & (D.e_o_td >= od[1])); cell("   goal-line back × stingiest opponent", GL & (D.e_o_td <= od[0]))
cell("C8 top RZ role (≥40% of team TDs entering) × team trips top tercile", (D.e_td_sh >= 0.4) & (D.e_t_in20 >= trips[1])); cell("   ≥40% of team TDs, any", D.e_td_sh >= 0.4, False)
cell("C9 goal-line back × team inside-10 PASS-heavy × opponent soft", GL & (D.e_t_in10_pass >= p10[1]) & (D.e_o_td >= od[1])); cell("C10 end-zone WR/TE × opponent allows most end-zone targets", EZ & (D.e_o_ez_tgt >= tercile("e_o_ez_tgt")[1]))
# ---------------------------------------------------------------- (3) per-player situational tendency
print("\n" + "=" * 140); print("(3) PER-PLAYER TENDENCY BY SITUATION — residual (scored − implied) in the situation minus outside it; STABLE = same sign every season with 5+ games in each half"); print("=" * 140)
SIT = {"pass-heavy RZ week": lambda g: g.e_t_in5_pass >= g.e_t_in5_pass.median(), "soft opponent": lambda g: g.e_o_td >= g.e_o_td.median(), "home": lambda g: g.is_home.astype(bool), "role up": lambda g: g.e_in5_snap_sh >= g.e_in5_snap_sh.median(), "high-trip team week": lambda g: g.e_t_in20 >= g.e_t_in20.median()}
rows = []
for pid, g in D.groupby("player_id"):
    if len(g) < 25: continue
    for sit, fn in SIT.items():
        m = fn(g); a, b = g[m], g[~m]
        if len(a) < 8 or len(b) < 8: continue
        diff = a.res.mean() - b.res.mean(); seas = []
        for s, gg in g.groupby("season"):
            mm = fn(g).loc[gg.index]; aa, bb = gg[mm], gg[~mm]
            if len(aa) >= 5 and len(bb) >= 5: seas.append(aa.res.mean() - bb.res.mean())
        stable = len(seas) >= 2 and len({np.sign(v) for v in seas}) == 1
        rows.append(dict(player=g.player_name.iloc[0], pos=g.position.iloc[0], games=len(g), situation=sit, n_in=len(a), hit_in=100*a.scored.mean(), imp_in=100*a.p_best.mean(), roi_in=roi(a), hit_out=100*b.scored.mean(), imp_out=100*b.p_best.mean(), diff=100*diff, seasons=" ".join(f"{100*v:+.0f}" for v in seas), stable=stable))
R = pd.DataFrame(rows); pd.set_option("display.width", 240)
print(f"  player-situation pairs: {len(R)} | stable-sign: {int(R.stable.sum())} ({100*R.stable.mean():.0f}%; a coin with two seasons gives 50%, three 25%) | stable & positive: {int((R.stable & (R['diff'] > 0)).sum())}")
S = R[R.stable & (R["diff"] > 0) & (R.roi_in > 0)].sort_values("diff", ascending=False); print("  STABLE POSITIVE situational reads (he scores more than priced in this situation, every season, and it pays at the best price):"); print(S.head(30).round(1).to_string(index=False))
# forecast: learn ≤ 2025 wk12, apply the stable positive reads to 2025 wk13-22
print("\n  FORECAST — reads learned on games ≤ 2025 wk12 (same rules), applied to 2025 wk13-22: bet YES when the player's stable positive situation is ON")
tr = D[(D.season < 2025) | ((D.season == 2025) & (D.week <= 12))]; te = D[(D.season == 2025) & (D.week > 12)].copy(); reads = {}
for pid, g in tr.groupby("player_id"):
    if len(g) < 25: continue
    for sit, fn in SIT.items():
        m = fn(g); a, b = g[m], g[~m]
        if len(a) < 8 or len(b) < 8: continue
        seas = []
        for s, gg in g.groupby("season"):
            mm = fn(g).loc[gg.index]; aa, bb = gg[mm], gg[~mm]
            if len(aa) >= 5 and len(bb) >= 5: seas.append(aa.res.mean() - bb.res.mean())
        if len(seas) >= 2 and all(v > 0 for v in seas) and a.res.mean() > 0.03 and roi(a) > 0: reads.setdefault(pid, []).append((sit, fn, g))
bets = []
for r in te.itertuples():
    for sit, fn, g in reads.get(r.player_id, []):
        thr = {"pass-heavy RZ week": g.e_t_in5_pass.median(), "soft opponent": g.e_o_td.median(), "home": None, "role up": g.e_in5_snap_sh.median(), "high-trip team week": g.e_t_in20.median()}[sit]
        on = (r.e_t_in5_pass >= thr) if sit == "pass-heavy RZ week" else (r.e_o_td >= thr) if sit == "soft opponent" else bool(r.is_home) if sit == "home" else (r.e_in5_snap_sh >= thr) if sit == "role up" else (r.e_t_in20 >= thr)
        if on: bets.append(dict(player=r.player_name, situation=sit, week=r.week, scored=r.scored, p=r.p_best, pay=r.pay)); break
Bt = pd.DataFrame(bets)
if len(Bt): print(f"  bets: {len(Bt)} | hit {100*Bt.scored.mean():.1f}% vs implied {100*Bt.p.mean():.1f}% | ROI {100*(Bt.scored*Bt.pay-(1-Bt.scored)).mean():+.1f}% | players {Bt.player.nunique()}"); print(Bt.groupby("situation").agg(n=("scored","size"), hit=("scored","mean"), imp=("p","mean")).round(3).to_string())
else: print("  no reads survived the rules on the learn window")
D.to_parquet("data/_atd_redzone_frame.parquet", index=False); R.to_parquet("data/_atd_player_situations.parquet", index=False)
