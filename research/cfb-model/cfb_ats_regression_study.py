"""Prior-year ATS record -> next-year ATS (owner question 2026-08-11).
Dimensions: bad/good prior ATS, close-loss profile, coach continuity, returning
production, schedule relief. Panel = one row per TEAM-GAME (panel law), ATS vs the
consensus close. Next-year performance shown overall AND weeks 1-3, per-season where
it matters. Baseline ~50 by construction (every game has a cover and a non-cover)."""
import numpy as np, pandas as pd, warnings
warnings.filterwarnings("ignore")

gm = pd.concat([pd.read_parquet("data/model_games_hist.parquet"),
                pd.read_parquet("data/model_games.parquet")], ignore_index=True)
gm = gm.drop_duplicates(["season","week","homeTeam","awayTeam"], keep="first")
gm = gm[gm.actual_margin.notna() & gm.spread_close.notna()]

# explode: one row per team-game
rows = []
for _, r in gm.iterrows():
    for side in ("home","away"):
        team = r.homeTeam if side=="home" else r.awayTeam
        opp  = r.awayTeam if side=="home" else r.homeTeam
        marg = r.actual_margin if side=="home" else -r.actual_margin
        spr  = r.spread_close if side=="home" else -r.spread_close
        rows.append(dict(season=int(r.season), week=int(r.week), team=team, opp=opp,
                         margin=marg, ats_margin=marg + spr))
tg = pd.DataFrame(rows)
tg["cover"] = np.where(tg.ats_margin==0, np.nan, (tg.ats_margin>0).astype(float))

# team-season aggregates
agg = tg.groupby(["season","team"]).agg(
    n=("cover","count"), ats=("cover","mean"),
    avg_ats_m=("ats_margin","mean"), avg_su_m=("margin","mean"),
    close_su_losses=("margin", lambda s: ((s<0)&(s>=-8)).sum()),
    su_losses=("margin", lambda s: (s<0).sum())).reset_index()
agg = agg[agg.n >= 8]
agg["close_loss_share"] = agg.close_su_losses / agg.su_losses.clip(lower=1)

# SOS from end-of-season Elo of opponents
el = pd.read_parquet("data/cfbd/elo_weekly.parquet")
eos = el.sort_values("asof_week").groupby(["year","team"]).elo.last().rename("elo")
tg2 = tg.merge(eos.rename_axis(["season","opp"]).reset_index().rename(columns={"elo":"opp_elo"}),
               on=["season","opp"], how="left")
sos = tg2.groupby(["season","team"]).opp_elo.mean().rename("sos").reset_index()
agg = agg.merge(sos, on=["season","team"], how="left")

# coach continuity
cs = pd.read_parquet("data/cfbd/coach_seasons.parquet")
cs = cs.sort_values("games", ascending=False).drop_duplicates(["year","school"])
hc = cs.set_index(["year","school"]).coach
agg["hc"] = [hc.get((s, t)) for s, t in zip(agg.season, agg.team)]

# returning production entering NEXT season
rs = pd.read_parquet("data/roster_scores.parquet")[["season","team","ret_prod","ret_share"]]

# next-year join
nxt = agg[["season","team","ats","n","sos","hc"]].copy()
nxt["season"] = nxt.season - 1   # align: row Y-1 joined to Y
pan = agg.merge(nxt, on=["season","team"], suffixes=("","_next"), how="inner")
pan = pan.rename(columns={"ats_next":"next_ats","n_next":"next_n","sos_next":"next_sos","hc_next":"next_hc"})
pan["same_hc"] = (pan.hc == pan.next_hc) & pan.hc.notna()
pan["sos_relief"] = pan.sos - pan.next_sos     # >0 = next schedule EASIER
rs2 = rs.copy(); rs2["join_season"] = rs2.season - 1
pan = pan.merge(rs2.rename(columns={"season":"rp_season"})[["join_season","team","ret_prod","ret_share"]],
                left_on=["season","team"], right_on=["join_season","team"], how="left")

# wk1-3 next-year ATS
early = tg[tg.week<=3].groupby(["season","team"]).cover.mean().rename("early_ats").reset_index()
early["season"] = early.season - 1
pan = pan.merge(early, on=["season","team"], how="left").rename(columns={"early_ats":"next_early_ats"})

pan = pan[pan.next_n >= 8]
print(f"panel: {len(pan)} team-season pairs, {pan.season.min()}->{pan.season.max()+1}")

def cell(mask, name):
    d = pan[mask]
    if len(d) < 10: print(f"{name:52s} n={len(d)} (thin)"); return
    e = d[d.next_early_ats.notna()]
    print(f"{name:52s} n={len(d):4d}  next ATS {100*d.next_ats.mean():.1f}%  | wk1-3 {100*e.next_early_ats.mean():.1f}%")

print("\n=== 1. PRIOR-YEAR ATS BUCKET -> NEXT YEAR ===")
for lo, hi in ((0,.35),(.35,.45),(.45,.55),(.55,.65),(.65,1.01)):
    cell((pan.ats>=lo)&(pan.ats<hi), f"prior ATS {int(lo*100)}-{int(hi*100)}%")

print("\n=== 2. BAD ATS (<40%), SPLIT BY HOW THEY LOST ===")
bad = pan.ats < .40
cell(bad & (pan.close_loss_share >= .5), "bad ATS + >=50% of SU losses within 8 (stayed close)")
cell(bad & (pan.close_loss_share < .5),  "bad ATS + blown out (close-loss share <50%)")
cell(bad & (pan.avg_ats_m > -4.5), "bad ATS + small avg ATS miss (>-4.5)")
cell(bad & (pan.avg_ats_m <= -4.5), "bad ATS + big avg ATS miss (<=-4.5)")

print("\n=== 3. BAD ATS x COACH CONTINUITY ===")
cell(bad & pan.same_hc, "bad ATS + SAME head coach next year")
cell(bad & ~pan.same_hc, "bad ATS + NEW head coach next year")

print("\n=== 4. BAD ATS x RETURNING PRODUCTION (2018+ rosters) ===")
rp = pan.ret_prod.notna()
med = pan[rp].ret_prod.median()
cell(bad & rp & (pan.ret_prod >= med), "bad ATS + HIGH returning production")
cell(bad & rp & (pan.ret_prod < med),  "bad ATS + LOW returning production")

print("\n=== 5. BAD ATS x SCHEDULE RELIEF (next-year SOS easier) ===")
sr = pan.sos_relief.notna()
cell(bad & sr & (pan.sos_relief > 15), "bad ATS + schedule EASES >15 Elo")
cell(bad & sr & (pan.sos_relief.abs() <= 15), "bad ATS + schedule similar")
cell(bad & sr & (pan.sos_relief < -15), "bad ATS + schedule HARDER >15 Elo")

print("\n=== 6. THE INVERSE: GOOD ATS (>60%) ===")
good = pan.ats > .60
cell(good, "good ATS overall")
cell(good & pan.same_hc, "good ATS + same HC")
cell(good & sr & (pan.sos_relief < -15), "good ATS + schedule HARDER next year")

print("\n=== 7. BEST COMBO CELLS, per-season (bad ATS + stayed close + same HC) ===")
combo = bad & (pan.close_loss_share >= .5) & pan.same_hc
d = pan[combo]
for y, g in d.groupby("season"):
    e = g[g.next_early_ats.notna()]
    print(f"  {y}->{y+1}: n={len(g):3d}  next {100*g.next_ats.mean():.1f}%  wk1-3 {100*e.next_early_ats.mean():.1f}%")


print("\n=== 5b. LEAK-SAFE SCHEDULE RELIEF (next-year opponents' PRIOR-year Elo — knowable in August) ===")
tg3 = tg.copy(); tg3["prior_season"] = tg3.season - 1
tg3 = tg3.merge(eos.rename_axis(["prior_season","opp"]).reset_index().rename(columns={"elo":"opp_prior_elo"}),
                on=["prior_season","opp"], how="left")
sos_ls = tg3.groupby(["season","team"]).opp_prior_elo.mean().rename("sos_ls").reset_index()
sos_ls_next = sos_ls.copy(); sos_ls_next["season"] = sos_ls_next.season - 1
pan2 = pan.merge(sos_ls_next.rename(columns={"sos_ls":"next_sos_ls"}), on=["season","team"], how="left")
pan2 = pan2.merge(sos_ls, on=["season","team"], how="left")
pan2["relief_ls"] = pan2.sos_ls - pan2.next_sos_ls
badm = pan2.ats < .40
def cell2(mask, name):
    d = pan2[mask]
    e = d[d.next_early_ats.notna()]
    print(f"{name:52s} n={len(d):4d}  next ATS {100*d.next_ats.mean():.1f}%  | wk1-3 {100*e.next_early_ats.mean():.1f}%")
srm = pan2.relief_ls.notna()
cell2(badm & srm & (pan2.relief_ls > 15), "bad ATS + schedule EASES >15 (leak-safe)")
cell2(badm & srm & (pan2.relief_ls.abs() <= 15), "bad ATS + similar (leak-safe)")
cell2(badm & srm & (pan2.relief_ls < -15), "bad ATS + HARDER (leak-safe)")
print("\nper-season, bad ATS + eases >15 (leak-safe), wk1-3:")
d = pan2[badm & srm & (pan2.relief_ls > 15)]
for y, g in d.groupby("season"):
    e = g[g.next_early_ats.notna()]
    print(f"  {y}->{y+1}: teams={len(g):3d}  wk1-3 {100*e.next_early_ats.mean():.1f}%  full {100*g.next_ats.mean():.1f}%")
print("\ncombo cells:")
rpm = pan2.ret_prod.notna(); med2 = pan2[rpm].ret_prod.median()
cell2(badm & srm & (pan2.relief_ls > 15) & rpm & (pan2.ret_prod >= med2), "  bad+eases + HIGH returning production")
cell2(badm & srm & (pan2.relief_ls > 15) & pan2.same_hc, "  bad+eases + same head coach")


print("\nper-season, bad ATS + schedule HARDER (leak-safe) — the FADE side, wk1-3:")
d = pan2[badm & srm & (pan2.relief_ls < -15)]
for y, g in d.groupby("season"):
    e = g[g.next_early_ats.notna()]
    print(f"  {y}->{y+1}: teams={len(g):3d}  wk1-3 {100*e.next_early_ats.mean():.1f}%  full {100*g.next_ats.mean():.1f}%")
print("\nnew-HC x bad ATS per-season (the 42.6% early cell), wk1-3:")
d = pan[(pan.ats<.40) & ~pan.same_hc]
for y, g in d.groupby("season"):
    e = g[g.next_early_ats.notna()]
    print(f"  {y}->{y+1}: teams={len(g):3d}  wk1-3 {100*e.next_early_ats.mean():.1f}%")
