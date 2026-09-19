#!/usr/bin/env python3
"""DEFENSIVE COORDINATOR TENDENCIES BY SITUATION (owner, 2026-09-19). DC per team-season from data/coaching_staff.csv (Wikipedia).
Play level (FTN charting on every dropback / run): blitz rate (5+ rushers), pressure-look rate (6+), heavy box (7+) on runs, light box (≤6),
two-high vs single-high is not in FTN — man/zone/two-high come from the weekly FP defense rates (entering) where available.
IDENTITY per DC: blitz rate, 6+ rushers, heavy-box rate on runs, stacked (8+) rate, plus league.
SITUATIONS: primetime, divisional, cold, windy, home/away, favorite/underdog, short rest, off bye, vs top-10 / bottom-10 offense (EPA),
leading 8+ / trailing 8+, second half, two-minute, 3rd-and-short, 3rd-and-long, inside the 20 / 10 / 5, goal-to-go.
For each DC x situation: his blitz rate vs his base vs the league's shift in that spot; per-season sign; STABLE = same sign every season
with 60+ plays and a 4-point relative gap. Writes out/dc_profiles_2026.md, data/_dc_identity.parquet, data/_dc_situations.parquet."""
import glob, numpy as np, pandas as pd, warnings, nfl_data_py as nfl
warnings.filterwarnings("ignore"); num = lambda s: pd.to_numeric(s, errors="coerce")
COLS = ["game_id","play_id","season","week","season_type","posteam","defteam","home_team","away_team","play_type","pass","rush","qb_dropback","qb_kneel","qb_spike","qb_scramble","down","ydstogo","yardline_100","goal_to_go","score_differential","game_seconds_remaining","half_seconds_remaining","epa","roof","temp","wind","spread_line","div_game"]
pbp = pd.concat([pd.read_parquet(f, columns=COLS) for f in ["data/pbp_cache/_dl_2022.parquet"] + sorted(glob.glob("data/pbp_cache/pbp_202[345].parquet"))], ignore_index=True)
pbp = pbp[(pbp.season_type == "REG") & pbp.defteam.notna() & pbp.play_type.isin(["pass","run"]) & (pbp.qb_kneel != 1) & (pbp.qb_spike != 1)].copy()
for c in ("posteam","defteam","home_team","away_team"): pbp[c] = pbp[c].replace({"LAR":"LA"})
ftn = pd.concat([pd.read_parquet("data/ftn_charting.parquet"), pd.read_parquet("data/ftn_charting_2025.parquet")], ignore_index=True)
for x, y in (("nflverse_game_id","game_id"), ("nflverse_play_id","play_id")):
    if y in ftn.columns and x in ftn.columns: ftn[y] = ftn[y].fillna(ftn[x]); ftn = ftn.drop(columns=x)
    elif x in ftn.columns: ftn = ftn.rename(columns={x: y})
ftn["play_id"] = num(ftn.play_id); ftn = ftn[["game_id","play_id","n_pass_rushers","n_blitzers","n_defense_box"]].drop_duplicates(["game_id","play_id"])
P = pbp.merge(ftn, on=["game_id","play_id"], how="left"); P["rush_n"] = num(P.n_pass_rushers); P["box"] = num(P.n_defense_box)
P["blitz"] = (P.rush_n >= 5).where(P.rush_n.notna() & (P.qb_dropback == 1)); P["rush6"] = (P.rush_n >= 6).where(P.rush_n.notna() & (P.qb_dropback == 1)); P["heavy"] = (P.box >= 7).where(P.box.notna() & (P.play_type == "run")); P["stacked_box"] = (P.box >= 8).where(P.box.notna() & (P.play_type == "run")); P["light"] = (P.box <= 6).where(P.box.notna() & (P.play_type == "run"))
# DC per team-season
C = pd.read_csv("data/coaching_staff.csv"); C["team"] = C.team.replace({"LAR":"LA"}); C["dc"] = C.dc.fillna(C.head_coach).astype(str).str.replace(r"\s*\(.*\)", "", regex=True).str.strip()
P = P.merge(C[["season","team","dc"]].rename(columns={"team":"defteam","dc":"coach"}), on=["season","defteam"], how="left"); P = P[P.coach.notna() & (P.coach != "nan")].copy()
S = nfl.import_schedules(list(range(2022, 2027))); S["home_team"] = S.home_team.replace({"LAR":"LA"}); S["away_team"] = S.away_team.replace({"LAR":"LA"})
S["kick_h"] = num(S.gametime.astype(str).str.split(":").str[0]); S["primetime"] = ((S.kick_h >= 19) | S.weekday.isin(["Monday","Thursday"])).astype(float)
h = S[["season","week","home_team","primetime","home_rest"]].rename(columns={"home_team":"defteam","home_rest":"rest"}).assign(is_home=1.0); a = S[["season","week","away_team","primetime","away_rest"]].rename(columns={"away_team":"defteam","away_rest":"rest"}).assign(is_home=0.0)
P = P.merge(pd.concat([h, a]), on=["season","week","defteam"], how="left")
P["outdoors"] = P.roof.astype(str).str.lower().isin(["outdoors","open"]); P["cold"] = P.outdoors & (num(P.temp) <= 40); P["windy"] = P.outdoors & (num(P.wind) >= 15)
P["def_spread"] = np.where(P.defteam == P.home_team, num(P.spread_line), -num(P.spread_line)); P["fav"] = P.def_spread <= -3; P["dog"] = P.def_spread >= 3
P["short_rest"] = num(P.rest) <= 5; P["off_bye"] = num(P.rest) >= 13; P["div"] = num(P.div_game) == 1; P["primetime"] = P.primetime == 1; P["is_home_b"] = P.is_home == 1
oq = P.groupby(["season","posteam"]).epa.mean().rename("o_epa").reset_index(); oq["o_rank"] = oq.groupby("season").o_epa.rank(ascending=False); P = P.merge(oq[["season","posteam","o_rank"]], on=["season","posteam"], how="left"); P["vs_top10_off"] = P.o_rank <= 10; P["vs_bot10_off"] = P.o_rank >= 23
P["lead8"] = P.score_differential <= -8; P["trail8"] = P.score_differential >= 8   # from the DEFENSE's side: offense trailing by 8 = defense leading
P["h2"] = P.game_seconds_remaining <= 1800; P["two_min"] = P.half_seconds_remaining <= 120; P["third_short"] = (P.down == 3) & (P.ydstogo <= 2); P["third_long"] = (P.down == 3) & (P.ydstogo >= 7)
P["rz20"] = P.yardline_100 <= 20; P["rz10"] = P.yardline_100 <= 10; P["rz5"] = P.yardline_100 <= 5; P["gtg"] = P.goal_to_go == 1
def ident(x): return pd.Series(dict(plays=len(x), dropbacks=int((x.qb_dropback == 1).sum()), blitz=x.blitz.mean(), rush6=x.rush6.mean(), heavy_box=x.heavy.mean(), stacked=x.stacked_box.mean(), light_box=x.light.mean(), blitz_3rd_long=x[x.third_long].blitz.mean(), blitz_rz=x[x.rz20].blitz.mean(), blitz_two_min=x[x.two_min].blitz.mean(), heavy_rz=x[x.rz10].heavy.mean(), epa_allowed=x.epa.mean()))
ID = pd.concat([ident(x).rename(c) for c, x in P.groupby("coach")], axis=1).T; ID.index.name = "coach"; ID = ID.reset_index(); LG = ident(P)
SIT = {"primetime":"primetime","divisional":"div","cold (≤40°F outdoors)":"cold","windy (≥15 mph)":"windy","home":"is_home_b","favorite (−3 or more)":"fav","underdog (+3 or more)":"dog","short rest (≤5 days)":"short_rest","off a bye":"off_bye","vs top-10 offense":"vs_top10_off","vs bottom-10 offense":"vs_bot10_off","defense leading by 8+":"lead8","defense trailing by 8+":"trail8","second half":"h2","two-minute":"two_min","3rd-and-short (≤2)":"third_short","3rd-and-long (≥7)":"third_long","inside the 20":"rz20","inside the 10":"rz10","inside the 5":"rz5","goal-to-go":"gtg"}
D = P[P.qb_dropback == 1].copy(); base_c = D.groupby("coach").blitz.mean(); base_cs = D.groupby(["coach","season"]).blitz.mean(); lg_base = D.blitz.mean(); rows = []
for lab, col in SIT.items():
    m = D[col].fillna(False).astype(bool); lg_sit = D[m].blitz.mean() - lg_base
    for c, g in D[m].groupby("coach"):
        if len(g) < 100 or g.blitz.notna().sum() < 60: continue
        his = g.blitz.mean() - base_c[c]; seas = []
        for s, gg in g.groupby("season"):
            if gg.blitz.notna().sum() >= 60 and (c, s) in base_cs.index: seas.append((s, (gg.blitz.mean() - base_cs[(c, s)]) - (D[m & (D.season == s)].blitz.mean() - D[D.season == s].blitz.mean())))
        rel = his - lg_sit; stable = len(seas) >= 2 and len({np.sign(v) for _, v in seas}) == 1 and abs(rel) >= 0.04
        rows.append(dict(coach=c, situation=lab, dropbacks=len(g), blitz=g.blitz.mean(), lg_blitz=D[m].blitz.mean(), shift_vs_his_base=his, league_shift=lg_sit, relative=rel, seasons=" ".join(f"{s}:{100*v:+.0f}" for s, v in seas), stable=stable))
SITS = pd.DataFrame(rows); SITS.to_parquet("data/_dc_situations.parquet", index=False); ID.to_parquet("data/_dc_identity.parquet", index=False)
C26 = C[C.season == 2026][["team","dc"]].rename(columns={"dc":"coach"}).sort_values("team"); pct = lambda v: f"{100*v:.0f}%" if pd.notna(v) else "—"; pp = lambda v: f"{100*v:+.0f}" if pd.notna(v) else "—"
md = ["# Defensive-coordinator tendencies, 2026 — pressure and box identity and how it shifts by situation\n", f"Plays 2022-25. Blitz = 5+ pass rushers on a dropback (FTN charting); heavy box = 7+ in the box on a run. League: blitz {pct(LG.blitz)}, 6+ rushers {pct(LG.rush6)}, heavy box {pct(LG.heavy_box)}, stacked (8+) {pct(LG.stacked)}, blitz on 3rd-and-long {pct(LG.blitz_3rd_long)}, blitz in the red zone {pct(LG.blitz_rz)}. A situational tendency is listed only when he shifts in the same direction relative to the league in every season with 60+ charted dropbacks, by 4+ points.\n"]
for r in C26.itertuples():
    i = ID[ID.coach == r.coach]
    if not len(i) or str(r.coach) in ("nan", "None"): md.append(f"## {r.team} — {r.coach}\n- No plays on record as a coordinator 2022-25.\n"); continue
    i = i.iloc[0]; md.append(f"## {r.team} — {r.coach} ({int(i.dropbacks)} charted dropbacks 2022-25)")
    md.append(f"- **Identity:** blitz {pct(i.blitz)} (league {pct(LG.blitz)}), 6+ rushers {pct(i.rush6)}; heavy box on runs {pct(i.heavy_box)} (league {pct(LG.heavy_box)}), stacked {pct(i.stacked)}, light box {pct(i.light_box)}; blitz on 3rd-and-long {pct(i.blitz_3rd_long)}, in the red zone {pct(i.blitz_rz)}, in two-minute {pct(i.blitz_two_min)}; heavy box inside the 10 {pct(i.heavy_rz)}. EPA allowed per play {i.epa_allowed:+.3f} (league {LG.epa_allowed:+.3f}).")
    t = SITS[(SITS.coach == r.coach) & SITS.stable].sort_values("relative", key=abs, ascending=False)
    if len(t): md.append("- **Blitz-rate shifts by situation (relative to the league's shift, every season):**"); [md.append(f"  - {x.situation}: blitzes {pct(x.blitz)} (league {pct(x.lg_blitz)}); {pp(x.shift_vs_his_base)} pts vs his base while the league moves {pp(x.league_shift)} → {pp(x.relative)} pts more {'blitz' if x.relative > 0 else 'coverage'}-heavy than the league here; by season {x.seasons}; n={x.dropbacks}") for x in t.itertuples()]
    else: md.append("- No situational blitz shift holds every season.")
    md.append("")
open("out/dc_profiles_2026.md", "w").write("\n".join(md)); pd.set_option("display.width", 240)
print(f"DCs with plays: {ID.shape[0]} | 2026 DCs: {C26.shape[0]} | pairs {len(SITS)} stable {int(SITS.stable.sum())}")
j = C26.merge(ID, on="coach", how="left").sort_values("blitz", ascending=False); print(j[["team","coach","dropbacks","blitz","rush6","heavy_box","stacked","blitz_3rd_long","blitz_rz","blitz_two_min","epa_allowed"]].round(3).to_string(index=False))
print("\nSTABLE blitz shifts, biggest first:"); print(SITS[SITS.stable].sort_values("relative", key=abs, ascending=False).head(30)[["coach","situation","dropbacks","blitz","lg_blitz","relative","seasons"]].round(3).to_string(index=False))
