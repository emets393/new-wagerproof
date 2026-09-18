#!/usr/bin/env python3
"""(1) NARRATIVE DECOMPOSITION of big-edge games: which unit matchups built the model's line,
in plain language, with the result.  (2) BLEND AUDIT: how much does one week move a rating?"""
import io, contextlib, importlib.util as iu, numpy as np, pandas as pd
spec=iu.spec_from_file_location("pm","power_ratings_modulators.py"); PM=iu.module_from_spec(spec)
with contextlib.redirect_stdout(io.StringIO()): spec.loader.exec_module(PM)
Q,ridge,FINAL,G=PM.Q.copy(),PM.ridge,PM.FINAL,PM.G
PLAIN={"O_pass_ypa":"passing yards per attempt","O_pass_press":"pass protection (pressure allowed)","O_pass_sack":"sack avoidance",
 "O_ol_poe":"O-line pressure vs expected","O_run_ypa":"rushing yards per carry","O_run_ybc":"run blocking (yards before contact)",
 "O_run_yac":"back's yards after contact","O_run_succ":"rushing success rate","O_run_stuff":"avoiding stuffed runs",
 "O_rz20_plays":"red-zone trips","O_rz20_passrate":"red-zone pass tendency","O_epa_pass":"passing efficiency (EPA)",
 "O_epa_run":"rushing efficiency (EPA)","O_ppd":"points per drive","O_proe":"pass rate over expected",
 "D_pass_press":"pass rush pressure","D_pass_poe":"pass rush vs expected","D_dl_poe":"D-line pressure vs expected",
 "D_run_ypa":"run defense yards/carry","D_run_ybc":"run defense at the line","D_run_succ":"run defense success",
 "D_run_stuff":"stuffing runs","D_epa_pass":"pass defense (EPA)","D_epa_run":"run defense (EPA)","D_ppd":"points allowed per drive",
 "home":"home field","close_line":"market spread","total":"market total","mkt_pts":"market implied points",
 "p_inj_skill":"skill-position injuries (own)","opp_p_inj_skill":"opponent skill injuries"}
def plain(f):
    if f.startswith("opp_"): return "opponent's "+PLAIN.get(f[4:],f[4:])
    if f.startswith("mx_"): return "matchup: "+PLAIN.get("O_"+f[3:],f[3:])+" vs their defense"
    return PLAIN.get(f,f)
# ---------- fit the 2025 fold exactly as the model does ----------
tr=Q[Q.season<2025]; F=[c for c in FINAL if c in tr.columns and tr[c].std()>1e-9]
X=tr[F].values.astype(float); mu,sd=X.mean(0),X.std(0); sd[sd==0]=1
w=ridge((X-mu)/sd,tr.pts.values.astype(float),80.0)
te=Q[Q.season==2025].copy(); Z=(te[F].values.astype(float)-mu)/sd
C=pd.DataFrame(Z*w[:-1],columns=F,index=te.index)          # per-feature contribution to THIS team's predicted points
te["pred"]=C.sum(axis=1)+w[-1]
big=G[(G.season==2025)&(G.e.abs()>=4)].sort_values("e",key=abs,ascending=False)
print("="*100); print(f"1) NARRATIVE AUDIT — 2025 games where the power ratings were >= 4 pts off the opener ({len(big)} games)"); print("="*100)
MKT={"close_line","total","mkt_pts"}
for _,g in big.iterrows():
    h=te[(te.game_id==g.game_id)&(te.team==g.team)].index[0]; a=te[(te.game_id==g.game_id)&(te.team==g.opp)].index[0]
    contrib=(C.loc[h]-C.loc[a])                                   # contribution to HOME margin
    non_mkt=contrib.drop([c for c in contrib.index if c in MKT])
    top=non_mkt.abs().sort_values(ascending=False).head(4).index
    lean=g.team if g.e>0 else g.opp
    res="WON" if g.sp_won else "lost"; cover=g.margin+g.open_spread
    print(f"\n  wk{int(g.week):2d} {g.opp}@{g.team}: opener {g.team} {'-' if -g.open_spread>0 else '+'}{abs(g.open_spread):.1f} | model {g.team} {'-' if g.pm>0 else '+'}{abs(g.pm):.1f} | gap {g.e:+.1f} -> lean {lean} | {res} (home covered by {cover:+.0f})")
    print(f"       market anchor contributes {contrib[[c for c in contrib.index if c in MKT]].sum():+.1f}; the model's own view adds {non_mkt.sum():+.1f}, built from:")
    for f in top:
        v=contrib[f]; side=g.team if v>0 else g.opp
        print(f"         {v:+5.1f}  {plain(f):48s} (favors {side})")
print(f"\n  record on these {len(big)}: {big.sp_won.sum()}-{(~big.sp_won).sum()}")
# ---- where did the gap come from: the CLOSE moving off the opener (injury news the model inherits
# through its market anchor) or the model disagreeing with the close itself?
big=big.copy(); big["mv"]=(-big.close_line)-(-big.open_spread); big["own"]=big.pm-(-big.close_line)
print("\n  GAP SPLIT — gap vs opener = (close − open) + (model − close):")
print(f"  {'game':10s} {'open':>6s} {'close':>6s} {'model':>6s} | {'moved':>6s} {'own':>6s}  {'result'}")
for _,g in big.iterrows():
    print(f"  wk{int(g.week):2d} {g.opp}@{g.team:4s} {-g.open_spread:+6.1f} {-g.close_line:+6.1f} {g.pm:+6.1f} | {g.mv:+6.1f} {g.own:+6.1f}  {'WON' if g.sp_won else 'lost'}")
for lab,m in (("model disagrees with CLOSE by >=2 in the lean's direction", np.sign(big.own)==np.sign(big.e)),
              ("gap is mostly line movement (own view <2 or against the lean)", ~((np.sign(big.own)==np.sign(big.e))&(big.own.abs()>=2)))):
    mm = m & (big.own.abs()>=2) if lab.startswith("model") else m
    d=big[mm]; print(f"    {lab:62s} {d.sp_won.sum()}-{(~d.sp_won).sum()}")
G25=G[G.season==2025].copy(); G25["own"]=G25.pm-(-G25.close_line)
d=G25[(G25.e.abs()>=2)&(np.sign(G25.own)==np.sign(G25.e))&(G25.own.abs()>=2)&~G25.sp_push]
print(f"    ALL 2025 plays (|gap|>=2) where the model ALSO beats the close by >=2 the same way: {100*d.sp_won.mean():.1f}% n={len(d)}")
d=G25[(G25.e.abs()>=2)&~((np.sign(G25.own)==np.sign(G25.e))&(G25.own.abs()>=2))&~G25.sp_push]
print(f"    ALL 2025 plays (|gap|>=2) where the gap is mostly the close moving:                 {100*d.sp_won.mean():.1f}% n={len(d)}")
# ---------- 2. BLEND AUDIT ----------
print("\n"+"="*100); print("2) BLEND AUDIT — how much weight does the CURRENT season carry, by week?"); print("="*100)
K=4.0
print("  FP unit ratings (entering() with K=4 prior seeding): current-season weight = n/(K+n)")
print("   "+"  ".join(f"wk{wk}:{100*(wk-1)/(K+wk-1):.0f}%" for wk in range(1,10)))
tw=pd.read_parquet("data/team_week.parquet"); tw=tw[tw.season.isin([2024,2025])]
c="off_pts_per_drive_s2d"
print(f"\n  production team_week `{c}` — is it seeded or raw season-to-date?")
# if raw s2d, week-2 value == week-1 game value exactly; if seeded, it's shrunk toward prior
wk1=tw[tw.week==1].set_index(["season","team"])[c]; wk2=tw[tw.week==2].set_index(["season","team"])[c]
j=pd.concat([wk1.rename("w1"),wk2.rename("w2")],axis=1).dropna()
print(f"    corr(week-1 value, week-2 value) = {j.w1.corr(j.w2):+.3f}   (1.00 => week 2 is pure week-1 data; lower => blended/seeded)")
print(f"    week-1 value sd across teams: {wk1.std():.3f} | week-9 value sd: {tw[tw.week==9].set_index(['season','team'])[c].std():.3f}")
print(f"    week-1 values present for all teams: {wk1.notna().mean():.0%} -> {'seeded from prior (no games played yet)' if wk1.notna().mean()>.9 else 'raw'}")
# worked example: a team that blew up in week 1
ex=Q[(Q.season==2025)&(Q.week<=3)][["team","week","pts","O_ppd","O_pass_ypa","O_epa_pass"]].sort_values(["team","week"])
top1=Q[(Q.season==2025)&(Q.week==1)].nlargest(1,"pts").team.iloc[0]
print(f"\n  worked example — {top1} scored the most points in week 1 2025 ({int(Q[(Q.season==2025)&(Q.week==1)&(Q.team==top1)].pts.iloc[0])}):")
print(ex[ex.team==top1].to_string(index=False))
print("    (O_pass_ypa / O_epa_pass are the ENTERING-week values the model used; watch how little they move after one game)")
