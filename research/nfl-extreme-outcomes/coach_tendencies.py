#!/usr/bin/env python3
"""COACH TENDENCIES BY SITUATION (owner, 2026-09-19).  Head coach per game from nflverse schedules (2022-25 plays, 2026 coaches).
Play level: nflverse pbp (xpass / pass_oe on every snap) x FTN charting (motion, play action, screen, RPO, no-huddle, box, sneak).
IDENTITY (per coach, all plays):  pass rate over expected, early-down neutral pass rate, no-huddle, motion, play-action, screen, RPO,
                                  shotgun, 4th-down go rate in go range, red-zone pass rate inside 20 / 10 / 5, QB designed-run share
                                  at the goal line, lead-back share of inside-10 and inside-5 carries vs his share of all carries
                                  (does he ride the No. 1 back or sub the spell back at the goal line), RB / WR / TE target share in RZ
SITUATIONS: primetime, divisional, cold (≤40°F outdoors), windy (≥15 mph), home / away, favorite / underdog (spread ≥ 3), short rest
            (≤5 days), off a bye (≥13), vs top-10 / bottom-10 pass defense (EPA allowed, same season), vs blitz-heavy / man-heavy
            defenses (entering rates), leading 8+ / trailing 8+ / within 7, first half / second half, two-minute, 3rd-and-short (≤2),
            3rd-and-long (≥7), 4th-and-short (≤2, own 40 to opp 10), red zone inside 20 / 10 / 5, goal-to-go
For each coach x situation: his pass rate over expected and pass rate, vs his own baseline, vs what the league does in that situation
(so 'he gets MORE pass-happy in primetime than everyone else does' is explicit); per-season sign; STABLE = same sign every season with
60+ plays. Writes out/coach_profiles_2026.md, data/_coach_situations.parquet, data/_coach_identity.parquet.
Then the prop link: lead backs' anytime-TD hit vs implied by the coach's PRIOR-season inside-5 lead-back carry share."""
import glob, sys, numpy as np, pandas as pd, warnings, nfl_data_py as nfl
KEY = sys.argv[1] if len(sys.argv) > 1 else "hc"   # hc = head coach (nflverse), pc = offensive play-caller (data/play_callers.csv)
warnings.filterwarnings("ignore"); num = lambda s: pd.to_numeric(s, errors="coerce")
COLS = ["game_id","play_id","season","week","season_type","posteam","defteam","home_team","away_team","play_type","pass","rush","qb_dropback","qb_kneel","qb_spike","qb_scramble","down","ydstogo","yardline_100","goal_to_go","score_differential","game_seconds_remaining","half_seconds_remaining","xpass","pass_oe","shotgun","no_huddle","rusher_player_id","rusher_player_name","receiver_player_id","receiver_player_name","passer_player_id","fourth_down_converted","fourth_down_failed","punt_attempt","field_goal_attempt","epa","touchdown","td_team","wp","roof","temp","wind","spread_line","total_line","div_game","drive"]
pbp = pd.concat([pd.read_parquet(f, columns=COLS) for f in ["data/pbp_cache/_dl_2022.parquet"] + sorted(glob.glob("data/pbp_cache/pbp_202[345].parquet"))], ignore_index=True)
pbp = pbp[(pbp.season_type == "REG") & pbp.posteam.notna() & pbp.play_type.isin(["pass","run","punt","field_goal","qb_kneel","qb_spike","no_play"])].copy()
pbp = pbp[~pbp.play_type.isin(["no_play"])]; pbp["posteam"] = pbp.posteam.replace({"LAR":"LA"}); pbp["defteam"] = pbp.defteam.replace({"LAR":"LA"}); pbp["home_team"] = pbp.home_team.replace({"LAR":"LA"}); pbp["away_team"] = pbp.away_team.replace({"LAR":"LA"})
ftn = pd.concat([pd.read_parquet("data/ftn_charting.parquet"), pd.read_parquet("data/ftn_charting_2025.parquet")], ignore_index=True)
for x, y in (("nflverse_game_id","game_id"), ("nflverse_play_id","play_id")):
    if y in ftn.columns and x in ftn.columns: ftn[y] = ftn[y].fillna(ftn[x]); ftn = ftn.drop(columns=x)
    elif x in ftn.columns: ftn = ftn.rename(columns={x: y})
ftn["play_id"] = num(ftn.play_id); FT = ["is_motion","is_play_action","is_screen_pass","is_rpo","is_no_huddle","is_qb_sneak","n_defense_box"]
ftn = ftn[["game_id","play_id"] + FT].drop_duplicates(["game_id","play_id"])
for c in FT[:-1]: ftn[c] = ftn[c].astype(str).str.lower().isin(["true","1"]).astype(float)
P = pbp.merge(ftn, on=["game_id","play_id"], how="left")
# ---------------------------------------------------------------- coaches, game context
S = nfl.import_schedules(list(range(2022, 2027))); S["home_team"] = S.home_team.replace({"LAR":"LA"}); S["away_team"] = S.away_team.replace({"LAR":"LA"})
S["kick_h"] = num(S.gametime.astype(str).str.split(":").str[0]); S["primetime"] = ((S.kick_h >= 19) | S.weekday.isin(["Monday","Thursday"])).astype(float)
h = S[["season","week","home_team","home_coach","away_coach","primetime","home_rest","away_rest"]].rename(columns={"home_team":"posteam","home_coach":"coach","away_coach":"opp_coach","home_rest":"rest","away_rest":"opp_rest"}).assign(is_home=1.0)
a = S[["season","week","away_team","away_coach","home_coach","primetime","away_rest","home_rest"]].rename(columns={"away_team":"posteam","away_coach":"coach","home_coach":"opp_coach","away_rest":"rest","home_rest":"opp_rest"}).assign(is_home=0.0)
G = pd.concat([h, a])
if KEY == "pc":
    PC = pd.read_csv("data/play_callers.csv"); PC["team"] = PC.team.replace({"LAR":"LA"}); G = G.merge(PC[["season","team","play_caller"]].rename(columns={"team":"posteam"}), on=["season","posteam"], how="left"); G["coach"] = G.play_caller.fillna(G.coach); G = G.drop(columns="play_caller")
P = P.merge(G, on=["season","week","posteam"], how="left"); P = P[P.coach.notna()].copy()
P["outdoors"] = P.roof.astype(str).str.lower().isin(["outdoors","open"]); P["cold"] = P.outdoors & (num(P.temp) <= 40); P["windy"] = P.outdoors & (num(P.wind) >= 15)
P["team_spread"] = np.where(P.posteam == P.home_team, num(P.spread_line), -num(P.spread_line)); P["fav"] = P.team_spread <= -3; P["dog"] = P.team_spread >= 3   # nflverse spread_line = home line
P["short_rest"] = num(P.rest) <= 5; P["off_bye"] = num(P.rest) >= 13; P["div"] = num(P.div_game) == 1; P["primetime"] = P.primetime == 1
# opponent pass defense (same-season EPA allowed per dropback rank) and entering blitz / man rates
dq = P[P.qb_dropback == 1].groupby(["season","defteam"]).epa.mean().rename("d_pass_epa").reset_index(); dq["d_rank"] = dq.groupby("season").d_pass_epa.rank(); P = P.merge(dq[["season","defteam","d_rank"]], on=["season","defteam"], how="left")
P["vs_top10_passD"] = P.d_rank <= 10; P["vs_bot10_passD"] = P.d_rank >= 23
try:
    Q = pd.read_parquet("data/_completions_deep_frame.parquet")[["opp","season","week","opp_rate_blitz","opp_rate_man"]].drop_duplicates(["opp","season","week"]).rename(columns={"opp":"defteam"}); P = P.merge(Q, on=["defteam","season","week"], how="left")
    P["vs_blitz_heavy"] = P.opp_rate_blitz >= Q.opp_rate_blitz.quantile(2/3); P["vs_man_heavy"] = P.opp_rate_man >= Q.opp_rate_man.quantile(2/3)
except Exception: P["vs_blitz_heavy"] = False; P["vs_man_heavy"] = False
# game state
P["lead8"] = P.score_differential >= 8; P["trail8"] = P.score_differential <= -8; P["close7"] = P.score_differential.abs() <= 7; P["h1"] = P.game_seconds_remaining > 1800; P["h2"] = ~P.h1
P["two_min"] = (P.half_seconds_remaining <= 120); P["third_short"] = (P.down == 3) & (P.ydstogo <= 2); P["third_long"] = (P.down == 3) & (P.ydstogo >= 7); P["early_neutral"] = P.down.isin([1, 2]) & P.close7 & P.h1
P["rz20"] = P.yardline_100 <= 20; P["rz10"] = P.yardline_100 <= 10; P["rz5"] = P.yardline_100 <= 5; P["gtg"] = P.goal_to_go == 1
P["fourth_go_range"] = (P.down == 4) & (P.ydstogo <= 2) & (P.yardline_100 <= 60) & (P.yardline_100 >= 10)
P["went"] = P.play_type.isin(["pass","run"]).astype(float); P["is_play"] = P.play_type.isin(["pass","run"]) & (P.qb_kneel != 1) & (P.qb_spike != 1)
# ---------------------------------------------------------------- RB1 vs spell back at the goal line
W = pd.read_parquet("data/player_team_weeks.parquet"); pos = W.drop_duplicates("player_id")[["player_id","position"]].set_index("player_id").position
R = P[(P.play_type == "run") & (P.qb_scramble != 1) & P.rusher_player_id.notna()].copy(); R["rpos"] = R.rusher_player_id.map(pos); R["is_qb_run"] = R.rpos == "QB"
RB = R[R.rpos == "RB"].sort_values(["posteam","season","week"]); car = RB.groupby(["posteam","season","week","rusher_player_id"]).size().rename("c").reset_index().sort_values(["posteam","season","rusher_player_id","week"])
car["cum"] = car.groupby(["posteam","season","rusher_player_id"]).c.cumsum() - car.c   # carries ENTERING the week
lead = car.sort_values(["posteam","season","week","cum"]).groupby(["posteam","season","week"]).tail(1)[["posteam","season","week","rusher_player_id","cum"]].rename(columns={"rusher_player_id":"rb1","cum":"rb1_cum"})
lead = lead[lead.rb1_cum >= 15]; RB = RB.merge(lead, on=["posteam","season","week"], how="inner"); RB["is_rb1"] = RB.rusher_player_id == RB.rb1
# ---------------------------------------------------------------- identity per coach (and per coach-season for stability)
def ident(x, r):
    pl = x[x.is_play]; d = dict(plays=len(pl), proe=pl.pass_oe.mean(), pass_rate=pl["pass"].mean(), early_neutral_pass=pl[pl.early_neutral]["pass"].mean(), early_neutral_proe=pl[pl.early_neutral].pass_oe.mean(),
        no_huddle=pl.is_no_huddle.mean(), motion=pl.is_motion.mean(), play_action=pl[pl["pass"] == 1].is_play_action.mean(), screen=pl[pl["pass"] == 1].is_screen_pass.mean(), rpo=pl.is_rpo.mean(), shotgun=pl.shotgun.mean(),
        fourth_go=x[x.fourth_go_range].went.mean(), n_fourth=int(x.fourth_go_range.sum()), rz20_pass=pl[pl.rz20]["pass"].mean(), rz10_pass=pl[pl.rz10]["pass"].mean(), rz5_pass=pl[pl.rz5]["pass"].mean(), rz20_proe=pl[pl.rz20].pass_oe.mean(), rz5_proe=pl[pl.rz5].pass_oe.mean())
    rr = r; d.update(rb1_share_all=rr.is_rb1.mean() if len(rr) else np.nan, rb1_share_in10=rr[rr.rz10].is_rb1.mean() if rr.rz10.sum() >= 10 else np.nan, rb1_share_in5=rr[rr.rz5].is_rb1.mean() if rr.rz5.sum() >= 8 else np.nan, n_in5_rb_carries=int(rr.rz5.sum()))
    q = R[(R.coach == x.coach.iloc[0]) & R.rz5] if "coach" in R.columns else None; d.update(qb_run_share_in5=q.is_qb_run.mean() if q is not None and len(q) >= 8 else np.nan)
    t = pl[pl.rz20 & (pl["pass"] == 1) & pl.receiver_player_id.notna()].copy(); t["tpos"] = t.receiver_player_id.map(pos)
    d.update(rz_tgt_rb=(t.tpos == "RB").mean() if len(t) else np.nan, rz_tgt_wr=(t.tpos == "WR").mean() if len(t) else np.nan, rz_tgt_te=(t.tpos == "TE").mean() if len(t) else np.nan); return pd.Series(d)
ID = pd.concat([ident(x, RB[RB.coach == c]).rename(c) for c, x in P.groupby("coach")], axis=1).T; ID.index.name = "coach"; ID = ID.reset_index()
IDS = pd.concat([ident(x, RB[(RB.coach == c) & (RB.season == s)]).rename((c, s)) for (c, s), x in P.groupby(["coach","season"]) if len(x) >= 300], axis=1).T; IDS.index = pd.MultiIndex.from_tuples(IDS.index, names=["coach","season"]); IDS = IDS.reset_index()
LG = ident(P, RB)
# ---------------------------------------------------------------- situations
SIT = {"primetime": "primetime", "divisional": "div", "cold (≤40°F outdoors)": "cold", "windy (≥15 mph)": "windy", "home": "is_home", "favorite (−3 or more)": "fav", "underdog (+3 or more)": "dog", "short rest (≤5 days)": "short_rest", "off a bye": "off_bye",
       "vs top-10 pass defense": "vs_top10_passD", "vs bottom-10 pass defense": "vs_bot10_passD", "vs blitz-heavy defense": "vs_blitz_heavy", "vs man-heavy defense": "vs_man_heavy", "leading by 8+": "lead8", "trailing by 8+": "trail8", "second half": "h2", "two-minute": "two_min",
       "3rd-and-short (≤2)": "third_short", "3rd-and-long (≥7)": "third_long", "inside the 20": "rz20", "inside the 10": "rz10", "inside the 5": "rz5", "goal-to-go": "gtg"}
P["is_home_b"] = P.is_home == 1; SIT = {k: ("is_home_b" if v == "is_home" else v) for k, v in SIT.items()}
pl = P[P.is_play].copy(); base_c = pl.groupby("coach").pass_oe.mean(); base_cs = pl.groupby(["coach","season"]).pass_oe.mean(); lg_base = pl.pass_oe.mean()
rows = []
for lab, col in SIT.items():
    m = pl[col].fillna(False).astype(bool); lg_sit = pl[m].pass_oe.mean() - lg_base; lg_pr = pl[m]["pass"].mean()
    for c, g in pl[m].groupby("coach"):
        if len(g) < 100: continue
        his = g.pass_oe.mean() - base_c[c]; seas = []
        for s, gg in g.groupby("season"):
            if len(gg) >= 60 and (c, s) in base_cs.index: seas.append((s, (gg.pass_oe.mean() - base_cs[(c, s)]) - (pl[m & (pl.season == s)].pass_oe.mean() - pl[pl.season == s].pass_oe.mean())))
        rel = his - lg_sit; stable = len(seas) >= 2 and len({np.sign(v) for _, v in seas}) == 1 and abs(rel) >= 3
        rows.append(dict(coach=c, situation=lab, plays=len(g), pass_rate=g["pass"].mean(), lg_pass_rate=lg_pr, proe=g.pass_oe.mean(), shift_vs_his_base=his, league_shift=lg_sit, relative=rel, seasons=" ".join(f"{s}:{v:+.0f}" for s, v in seas), stable=stable, motion=g.is_motion.mean(), play_action=g[g["pass"]==1].is_play_action.mean(), no_huddle=g.is_no_huddle.mean()))
SITS = pd.DataFrame(rows); sfx = "_pc" if KEY == "pc" else ""; SITS.to_parquet(f"data/_coach_situations{sfx}.parquet", index=False); ID.to_parquet(f"data/_coach_identity{sfx}.parquet", index=False); IDS.to_parquet(f"data/_coach_identity_by_season{sfx}.parquet", index=False)
# ---------------------------------------------------------------- sheets for 2026 head coaches
S26 = S[S.season == 2026]; C26 = pd.concat([S26[["home_team","home_coach"]].rename(columns={"home_team":"team","home_coach":"coach"}), S26[["away_team","away_coach"]].rename(columns={"away_team":"team","away_coach":"coach"})]).drop_duplicates("team").sort_values("team")
if KEY == "pc": C26 = pd.read_csv("data/play_callers.csv").query("season == 2026")[["team","play_caller"]].rename(columns={"play_caller":"coach"}).sort_values("team")
pct = lambda v: f"{100*v:.0f}%" if pd.notna(v) else "—"; pp = lambda v: f"{v:+.1f}" if pd.notna(v) else "—"
md = [f"# {'Offensive play-caller' if KEY == 'pc' else 'Head-coach'} tendencies, 2026 — play-calling identity and how it shifts by situation\n", f"Plays 2022-25 (regular season). 'Pass rate over expected' = how much more (or less) often he throws than the league would in the same down / distance / field / score / clock spot, in points. League: PROE {LG.proe:+.1f}, early-down neutral pass {pct(LG.early_neutral_pass)}, inside-20 pass {pct(LG.rz20_pass)}, inside-5 pass {pct(LG.rz5_pass)}, lead back carries all/inside-10/inside-5 {pct(LG.rb1_share_all)}/{pct(LG.rb1_share_in10)}/{pct(LG.rb1_share_in5)}, 4th-and-short go {pct(LG.fourth_go)}. A situational tendency is listed only when he shifts in the same direction relative to the league in every season with 60+ plays, by 3+ points.\n"]
for r in C26.itertuples():
    i = ID[ID.coach == r.coach]
    if not len(i): md.append(f"## {r.team} — {r.coach}\n- No plays on record 2022-25 (first-year head coach).\n"); continue
    i = i.iloc[0]; md.append(f"## {r.team} — {r.coach} ({int(i.plays)} plays 2022-25)")
    md.append(f"- **Identity:** pass rate over expected {pp(i.proe)} (early downs, neutral: {pp(i.early_neutral_proe)}, pass {pct(i.early_neutral_pass)}); motion {pct(i.motion)}, play-action {pct(i.play_action)} of passes, screens {pct(i.screen)}, RPO {pct(i.rpo)}, no-huddle {pct(i.no_huddle)}, shotgun {pct(i.shotgun)}; 4th-and-short in go range: goes {pct(i.fourth_go)} (n={int(i.n_fourth)}).")
    md.append(f"- **Red zone:** pass rate inside the 20 {pct(i.rz20_pass)} / inside the 10 {pct(i.rz10_pass)} / inside the 5 {pct(i.rz5_pass)} (league {pct(LG.rz20_pass)} / {pct(LG.rz10_pass)} / {pct(LG.rz5_pass)}); PROE inside the 5 {pp(i.rz5_proe)}. RZ targets go RB {pct(i.rz_tgt_rb)} / WR {pct(i.rz_tgt_wr)} / TE {pct(i.rz_tgt_te)}.")
    md.append(f"- **Goal-line back:** the lead back gets {pct(i.rb1_share_all)} of all RB carries, {pct(i.rb1_share_in10)} inside the 10, {pct(i.rb1_share_in5)} inside the 5 ({int(i.n_in5_rb_carries)} RB carries inside the 5); QB designed runs are {pct(i.qb_run_share_in5)} of inside-5 runs. " + ("**Rides the No. 1 back at the goal line.**" if pd.notna(i.rb1_share_in5) and i.rb1_share_in5 - i.rb1_share_all >= 0.08 else "**Spreads goal-line carries / subs the spell back.**" if pd.notna(i.rb1_share_in5) and i.rb1_share_in5 - i.rb1_share_all <= -0.08 else "Same split at the goal line as everywhere else."))
    t = SITS[(SITS.coach == r.coach) & SITS.stable].sort_values("relative", key=abs, ascending=False)
    if len(t): md.append("- **Shifts by situation (relative to how the league shifts, every season):**"); [md.append(f"  - {x.situation}: pass rate {pct(x.pass_rate)} (league {pct(x.lg_pass_rate)}); PROE moves {pp(x.shift_vs_his_base)} vs his base while the league moves {pp(x.league_shift)} → {pp(x.relative)} more {'pass' if x.relative > 0 else 'run'}-heavy than the league in this spot; by season {x.seasons}; n={x.plays}") for x in t.itertuples()]
    else: md.append("- No situational shift holds every season — he calls it the same way everywhere.")
    md.append("")
open(f"out/{'playcaller' if KEY == 'pc' else 'coach'}_profiles_2026.md", "w").write("\n".join(md))
pd.set_option("display.width", 250); print(f"coaches with plays 2022-25: {ID.shape[0]} | 2026 head coaches: {C26.shape[0]} | coach-situation pairs {len(SITS)}, stable {int(SITS.stable.sum())}")
print("\nIDENTITY — 2026 head coaches (sorted by pass rate over expected):"); j = C26.merge(ID, on="coach", how="left").sort_values("proe", ascending=False)
print(j[["team","coach","plays","proe","early_neutral_pass","motion","play_action","no_huddle","fourth_go","rz20_pass","rz5_pass","rb1_share_all","rb1_share_in10","rb1_share_in5","qb_run_share_in5","rz_tgt_rb","rz_tgt_te"]].round(2).to_string(index=False))
print("\nSTABLE situational shifts, biggest first (relative = his PROE shift in the spot minus the league's shift):"); print(SITS[SITS.stable].sort_values("relative", key=abs, ascending=False).head(40)[["coach","situation","plays","pass_rate","lg_pass_rate","shift_vs_his_base","league_shift","relative","seasons"]].round(2).to_string(index=False))
print("\nwrote out/coach_profiles_2026.md, data/_coach_identity.parquet, data/_coach_situations.parquet")
# ---------------------------------------------------------------- prop link: lead back ATD vs implied by the coach's PRIOR-season inside-5 lead-back share
try:
    A = pd.read_parquet("data/_atd_redzone_frame.parquet"); A = A.merge(G[["season","week","posteam","coach"]].rename(columns={"posteam":"team"}), on=["season","week","team"], how="left")
    prior = IDS[["coach","season","rb1_share_in5","rb1_share_all"]].copy(); prior["season"] = prior.season + 1; prior["conc"] = prior.rb1_share_in5 - prior.rb1_share_all; A = A.merge(prior[["coach","season","rb1_share_in5","conc"]], on=["coach","season"], how="left")
    lead_rb = A[(A.position == "RB")].sort_values("e_in5_att_sh", ascending=False).groupby(["team","season","week"]).head(1); lead_rb = lead_rb[lead_rb.rb1_share_in5.notna()]
    roi = lambda x: 100 * (x.scored * x.pay - (1 - x.scored)).mean() if len(x) else np.nan
    print("\nPROP LINK — the team's lead back (top entering inside-5 rush share) anytime TD, by the coach's PRIOR-season lead-back share of inside-5 carries:")
    for b, g in lead_rb.groupby(pd.qcut(lead_rb.rb1_share_in5, 3, labels=["spreads it","middle","rides RB1"])): print(f"  {str(b):12s} n={len(g):4d} hit {100*g.scored.mean():5.1f}% vs implied {100*g.p_best.mean():5.1f}% ROI {roi(g):+6.1f}% | " + " | ".join(f"{s}: {100*g[g.season==s].scored.mean():4.1f}% vs {100*g[g.season==s].p_best.mean():4.1f}% n={int((g.season==s).sum())}" for s in (2024, 2025) if (g.season==s).sum()))
    sp = A[(A.position == "RB") & A.rb1_share_in5.notna()].sort_values("e_in5_att_sh", ascending=False).groupby(["team","season","week"]).nth(1)
    print("  the SPELL back (2nd in entering inside-5 rush share), same split:")
    for b, g in sp.groupby(pd.qcut(sp.rb1_share_in5, 3, labels=["spreads it","middle","rides RB1"])): print(f"  {str(b):12s} n={len(g):4d} hit {100*g.scored.mean():5.1f}% vs implied {100*g.p_best.mean():5.1f}% ROI {roi(g):+6.1f}%")
except Exception as e: print("prop link skipped:", e)
