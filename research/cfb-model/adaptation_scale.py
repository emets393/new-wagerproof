"""
IMPOSER vs ADAPTER at scale. Flexibility metric = how much a team varies its per-game style (run-rate + pace).
A. Build per-team-season flexibility.
B. RELIABILITY: how many games to classify a team? (first-K vs full-season corr; split-half).
C. COACH-DEPENDENCE: does flexibility persist year-over-year, and more so when the coach stays?
D. SCALED BET: does an ADAPTER team vs a FAST/EXPLOSIVE opponent -> total UNDER (pace suppressed)? as-of classified.
"""
import glob
import numpy as np
import pandas as pd
from scipy.stats import spearmanr

# ---- per-team-game style ----
box = pd.concat([pd.read_parquet(f) for f in glob.glob("data/cfbd/teamgame_box_*.parquet")], ignore_index=True)
box["run_rate"] = box.rush_att / (box.rush_att + box.pass_att)
box["sec_play"] = box.poss_secs / box.plays
box = box[box.run_rate.notna() & box.sec_play.notna() & (box.plays >= 30)]
# game order via games file (week)
gm = pd.read_parquet("data/model_games.parquet")

# ---- A. flexibility per team-season (std of run_rate & pace) ----
def flex_of(d):
    return pd.Series({"gp": len(d), "m_run": d.run_rate.mean(), "s_run": d.run_rate.std(),
                      "m_pace": d.sec_play.mean(), "s_pace": d.sec_play.std()})
ts = box.groupby(["season", "team"]).apply(flex_of).reset_index()
ts = ts[ts.gp >= 8].copy()
# combined flexibility z-score (within season)
for c in ["s_run", "s_pace"]:
    ts[f"z_{c}"] = ts.groupby("season")[c].transform(lambda x: (x - x.mean()) / x.std())
ts["flex"] = ts.z_s_run + ts.z_s_pace
print(f"team-seasons: {len(ts)} | flex = z(std run-rate) + z(std pace)")
print("most ADAPTER (high flex) 2025:", ", ".join(ts[ts.season==2025].sort_values("flex",ascending=False).head(5).team))
print("most IMPOSER (low flex) 2025:", ", ".join(ts[ts.season==2025].sort_values("flex").head(5).team))

# ---- B. reliability: first-K-games flex vs full-season flex ----
print("\n=== B. RELIABILITY: how many games to classify imposer/adapter? ===")
# need per-game order; use a within-(season,team) game index by date
box2 = box.merge(gm[["season","game_id","date"]], on=["season","game_id"], how="left").sort_values(["season","team","date"])
box2["gidx"] = box2.groupby(["season","team"]).cumcount()
def kflex(d, K):
    dd = d[d.gidx < K]
    if len(dd) < K: return np.nan, np.nan
    return dd.run_rate.std(), dd.sec_play.std()
print(f"  {'K games':>8}{'corr(run-flex K vs full)':>26}{'corr(pace-flex K vs full)':>26}")
full = ts.set_index(["season","team"])[["s_run","s_pace"]]
for K in [3,4,5,6,8]:
    rows=[]
    for (s,t),d in box2.groupby(["season","team"]):
        if (s,t) not in full.index or d.gidx.max()<10: continue
        kr,kp=kflex(d,K); rows.append((kr,kp,full.loc[(s,t),"s_run"],full.loc[(s,t),"s_pace"]))
    r=pd.DataFrame(rows,columns=["kr","kp","fr","fp"]).dropna()
    print(f"  {K:>8}{r.kr.corr(r.fr):>26.2f}{r.kp.corr(r.fp):>26.2f}  (n={len(r)})")
# split-half reliability (odd vs even games)
oe=[]
for (s,t),d in box2.groupby(["season","team"]):
    if len(d)<10: continue
    odd=d[d.gidx%2==1]; even=d[d.gidx%2==0]
    oe.append((odd.run_rate.std(),even.run_rate.std(),odd.sec_play.std(),even.sec_play.std()))
oe=pd.DataFrame(oe,columns=["or","er","op","ep"]).dropna()
rr=oe.or_.corr(oe.er) if hasattr(oe,'or_') else oe['or'].corr(oe['er'])
print(f"  split-half (odd vs even): run-flex r={oe['or'].corr(oe['er']):.2f}, pace-flex r={oe['op'].corr(oe['ep']):.2f}")

# ---- C. coach persistence ----
print("\n=== C. COACH-DEPENDENCE: flex persistence year-over-year, same coach vs change ===")
co = pd.read_parquet("data/cfbd/coaches.parquet")
co["g"] = co.wins + co.losses
prim = co.sort_values("g").drop_duplicates(["school","season"], keep="last")[["school","season","coach"]]
m = ts.merge(prim, left_on=["team","season"], right_on=["school","season"], how="left")
nxt = m[["team","season","flex","coach"]].copy(); nxt["season"] = nxt.season + 1
pair = m.merge(nxt, on=["team","season"], suffixes=("","_prev"))
pair = pair.dropna(subset=["flex","flex_prev","coach","coach_prev"])
pair["same_coach"] = pair.coach == pair.coach_prev
for lab, sub in [("SAME coach", pair[pair.same_coach]), ("coach CHANGED", pair[~pair.same_coach])]:
    if len(sub) >= 20:
        print(f"  {lab:<14} n={len(sub):<4} corr(flex_Y, flex_Y+1) = {sub.flex.corr(sub.flex_prev):.2f}")

# ---- D. scaled bet: ADAPTER vs FAST/EXPLOSIVE opp -> UNDER (as-of = prior-season flex) ----
print("\n=== D. SCALED BET: adapter (prior-yr flex) vs fast/explosive opp -> total UNDER? ===")
pri = ts[["season","team","flex"]].copy(); pri["season"] = pri.season + 1   # prior-season flex -> this season
G = gm[gm.total_close.notna() & gm.actual_total.notna()].copy()
G = G.merge(pri.rename(columns={"team":"homeTeam","flex":"h_flex"}), on=["season","homeTeam"], how="left")
G = G.merge(pri.rename(columns={"team":"awayTeam","flex":"a_flex"}), on=["season","awayTeam"], how="left")
# opponent explosiveness/pace as the "fast/explosive" trigger
ex = pd.concat([G.home_adj_explosiveness, G.away_adj_explosiveness]).quantile(0.6)
G["over"] = (G.actual_total > G.total_close)
G = G[G.actual_total != G.total_close]
TS=[2022,2023,2024,2025]
def per(b,w): return "/".join(f"{100*w[b.season==s].mean():.0f}" if (b.season==s).sum()>=8 else "--" for s in TS)
fq = pri.flex.quantile(0.66)
# home is adapter & away explosive -> under ; away adapter & home explosive -> under
for lab, m in [("ADAPTER team vs EXPLOSIVE opp", ((G.h_flex>=fq)&(G.away_adj_explosiveness>=ex))|((G.a_flex>=fq)&(G.home_adj_explosiveness>=ex))),
               ("IMPOSER team vs EXPLOSIVE opp (control)", ((G.h_flex<=-0)&(G.away_adj_explosiveness>=ex))|((G.a_flex<=-0)&(G.home_adj_explosiveness>=ex)))]:
    b=G[m & G.h_flex.notna() & G.a_flex.notna()]; w=~b.over; hold=b[b.season==2025]
    print(f"  {lab:<40} n={len(b):<4} UNDER {100*w.mean():4.1f}% | 2025 {100*(~hold.over).mean():.0f}%(n{len(hold)}) [{per(b,~b.over)}]")
