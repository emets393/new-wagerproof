"""
b83 — Line-reversal veto on Survivors #1 and #2 (CFB Signal #8).

CFB FINDING
  A late reversal contradicting the pick dropped its hit rate to 40% (useful as a veto).

NFL TEST
  For each Survivor pick:
    UNDER pick: if total_move > 0 (line moved UP from open to close = market is buying overs), veto
    OVER pick:  if total_move < 0 (line moved DOWN = market buying unders), veto
  Compare hit rate WITH and WITHOUT veto on 2024+2025 portfolio.

OUTCOME
  If the veto improves hit rate materially (5pp+), wire it into the harness. If it kills volume
  without improving rate, skip.
"""
import os, sys, warnings
import numpy as np, pandas as pd
warnings.filterwarnings("ignore")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from stats_helpers import wilson_ci
DATA=os.path.join(os.path.dirname(os.path.abspath(__file__)),"data"); L=print

oh = pd.read_parquet(os.path.join(DATA,"odds_hist.parquet"))
ma = pd.read_parquet(os.path.join(DATA,"matchup_arch.parquet"))
od = pd.read_parquet(os.path.join(DATA,"odds_consensus.parquet"))
oh["snap_ts"] = pd.to_datetime(oh.snap_ts); oh["commence_time"] = pd.to_datetime(oh.commence_time)
ma["actual_margin"] = ma.home_score - ma.away_score
ma["actual_total"]  = ma.home_score + ma.away_score

# Re-build the cross-book infra
book_coverage = oh.groupby("book").season.nunique()
full_books = book_coverage[book_coverage>=3].index.tolist()
oh = oh[oh.book.isin(full_books) & (oh.snap_ts <= oh.commence_time)].copy()
oh = oh.sort_values("snap_ts").drop_duplicates(subset=["season","home_team","away_team","book"], keep="last")
team_map = {
    "Arizona":"ARI","Atlanta":"ATL","Baltimore":"BAL","Buffalo":"BUF","Carolina":"CAR","Chicago":"CHI",
    "Cincinnati":"CIN","Cleveland":"CLE","Dallas":"DAL","Denver":"DEN","Detroit":"DET","Green Bay":"GB",
    "Houston":"HOU","Indianapolis":"IND","Jacksonville":"JAX","Kansas City":"KC","Las Vegas":"LV",
    "Los Angeles Chargers":"LAC","Los Angeles Rams":"LAR","LA Chargers":"LAC","LA Rams":"LAR",
    "Miami":"MIA","Minnesota":"MIN","New England":"NE","New Orleans":"NO",
    "New York Giants":"NYG","New York Jets":"NYJ","NY Giants":"NYG","NY Jets":"NYJ",
    "Philadelphia":"PHI","Pittsburgh":"PIT","San Francisco":"SF","Seattle":"SEA","Tampa Bay":"TB",
    "Tennessee":"TEN","Washington":"WAS"
}
oh["home_ab"] = oh.home_team.map(team_map); oh["away_ab"] = oh.away_team.map(team_map)
oh = oh.dropna(subset=["home_ab","away_ab"]).merge(
    ma[["season","home_ab","away_ab","actual_margin","actual_total"]],
    on=["season","home_ab","away_ab"], how="inner")

def rank_books_total(train_df):
    rows=[]
    cons = train_df.groupby(["season","home_ab","away_ab"]).total_point.mean().rename("cons_total").reset_index()
    train_df = train_df.merge(cons, on=["season","home_ab","away_ab"])
    for book in train_df.book.unique():
        sub = train_df[train_df.book==book]
        if len(sub)<50: continue
        sub = sub.copy()
        sub["lean"]  = sub.total_point - sub.cons_total
        sub["resid"] = sub.actual_total - sub.cons_total
        c = sub[["lean","resid"]].corr().iloc[0,1]
        rows.append({"book":book,"n":len(sub),"sharp_total":c})
    return pd.DataFrame(rows).sort_values("sharp_total",ascending=False)

def build_year_frame(target_year):
    train = oh[oh.season < target_year]
    rk = rank_books_total(train)
    sharps = set(rk.head(3).book.tolist()); softs = set(rk.tail(3).book.tolist())
    tgt = oh[oh.season==target_year].copy()
    rows=[]
    for (sea,hm,aw), g in tgt.groupby(["season","home_ab","away_ab"]):
        s_in = g[g.book.isin(sharps)]; so_in = g[g.book.isin(softs)]
        if s_in.empty or so_in.empty: continue
        rows.append({"season":sea,"home_ab":hm,"away_ab":aw,
                     "sharp_total":s_in.total_point.mean(),
                     "soft_total":so_in.total_point.mean(),
                     "actual_total":g.actual_total.iloc[0]})
    return pd.DataFrame(rows)

# Build S1 picks for 2024 + 2025
s1_picks=[]
for Y in [2024,2025]:
    df = build_year_frame(Y); df["gap"] = df.soft_total - df.sharp_total
    u = df[df.gap>=0.5].copy()
    u["pick"]="UNDER"; u["bet_line"]=u.soft_total
    u["won"]=(u.actual_total<u.bet_line).astype(float); u.loc[u.actual_total==u.bet_line,"won"]=np.nan
    o = df[df.gap<=-0.5].copy()
    o["pick"]="OVER"; o["bet_line"]=o.soft_total
    o["won"]=(o.actual_total>o.bet_line).astype(float); o.loc[o.actual_total==o.bet_line,"won"]=np.nan
    s1_picks.append(u); s1_picks.append(o)
S1 = pd.concat(s1_picks, ignore_index=True)
L(f"[S1] {len(S1)} picks across 2024+2025")

# Attach line movement from odds_consensus
S1 = S1.merge(od[["season","home_ab","away_ab","open_total","close_total","total_move"]],
              on=["season","home_ab","away_ab"], how="left")
L(f"[S1] {S1.total_move.notna().sum()}/{len(S1)} have total_move")

# Build S2 picks for 2024 + 2025
ma2 = ma.merge(od[["season","home_ab","away_ab","open_total","close_total","total_move"]],
               on=["season","home_ab","away_ab"], how="left")
ma2["total_line"] = ma2.open_total.fillna(ma2.ou_vegas_line)
ma2 = ma2.dropna(subset=["total_line","actual_total","week","season"]).copy()
ma2["went_over"] = (ma2.actual_total > ma2.total_line).astype(int)
ma2.loc[ma2.actual_total==ma2.total_line,"went_over"] = np.nan
hr = ma2[["season","week","home_ab","went_over"]].rename(columns={"home_ab":"team"})
ar = ma2[["season","week","away_ab","went_over"]].rename(columns={"away_ab":"team"})
tg = pd.concat([hr,ar], ignore_index=True).sort_values(["season","team","week"])
def asof(group):
    group = group.sort_values("week")
    cn = group.went_over.expanding().count().shift(1)
    co = group.went_over.expanding().sum().shift(1)
    group["prior_n"] = cn; group["prior_or"] = co/cn
    return group
tg = tg.groupby(["season","team"], group_keys=False).apply(asof)

s2_picks=[]
for Y in [2024,2025]:
    m_y = ma2[ma2.season==Y].copy()
    m_y = m_y.merge(tg[["season","week","team","prior_or","prior_n"]].rename(
        columns={"team":"home_ab","prior_or":"h_or","prior_n":"h_n"}), on=["season","week","home_ab"], how="left")
    m_y = m_y.merge(tg[["season","week","team","prior_or","prior_n"]].rename(
        columns={"team":"away_ab","prior_or":"a_or","prior_n":"a_n"}), on=["season","week","away_ab"], how="left")
    q = m_y[(m_y.h_n>=3) & (m_y.a_n>=3) & (m_y.h_or>=0.6) & (m_y.a_or>=0.6) &
            (m_y.total_line>=42) & (m_y.total_line<=46.5)].copy()
    q["pick"]="UNDER"; q["bet_line"]=q.total_line
    q["won"]=(q.actual_total<q.bet_line).astype(float); q.loc[q.actual_total==q.bet_line,"won"]=np.nan
    s2_picks.append(q)
S2 = pd.concat(s2_picks, ignore_index=True)
L(f"[S2] {len(S2)} picks across 2024+2025")
L(f"[S2] {S2.total_move.notna().sum()}/{len(S2)} have total_move")

def report(name, df, drop_pushes=True):
    w = df.won.dropna() if drop_pushes else df.won
    n=len(w); k=int(w.sum())
    if n==0: L(f"  {name:34s} n=0"); return
    lo,hi=wilson_ci(k,n); roi=(k*100/110-(n-k))/n*100
    L(f"  {name:34s} n={n:3d}  hit={k}/{n}={k/n*100:5.1f}%  CI[{lo*100:.0f},{hi*100:.0f}]  ROI@-110={roi:+5.1f}%")

# Define veto: late line move CONTRADICTS the pick
# UNDER pick: total_move > 0 (line went UP, market bought overs) → reversal contradicts under → VETO
# OVER pick:  total_move < 0 → VETO
S1["contradicts"] = ((S1.pick=="UNDER") & (S1.total_move>0)) | ((S1.pick=="OVER") & (S1.total_move<0))
S2["contradicts"] = ((S2.pick=="UNDER") & (S2.total_move>0))

L(f"\n{'='*92}\nLINE-REVERSAL VETO EFFECT — Survivor #1 (cross-book gap)\n{'='*92}")
report("S1 ALL picks (no veto)", S1)
report("S1 WHERE move agrees/neutral", S1[~S1.contradicts])
report("S1 WHERE late move CONTRADICTS", S1[S1.contradicts])
L(f"\n  By pick direction:")
for direction in ["UNDER","OVER"]:
    sub = S1[S1.pick==direction]
    L(f"  -- {direction} legs --")
    report(f"     ALL (no veto)", sub)
    report(f"     move neutral/agrees", sub[~sub.contradicts])
    report(f"     move CONTRADICTS", sub[sub.contradicts])

L(f"\n{'='*92}\nLINE-REVERSAL VETO EFFECT — Survivor #2 (form mean-rev UNDER)\n{'='*92}")
report("S2 ALL picks (no veto)", S2)
report("S2 WHERE move neutral/agrees", S2[~S2.contradicts])
report("S2 WHERE late move CONTRADICTS", S2[S2.contradicts])

# Combined portfolio WITH veto applied
all_picks_no_veto = pd.concat([
    S1[["season","home_ab","away_ab","pick","won","contradicts"]],
    S2[["season","home_ab","away_ab","pick","won","contradicts"]]], ignore_index=True)
all_picks_no_veto = all_picks_no_veto.drop_duplicates(subset=["season","home_ab","away_ab","pick"])

L(f"\n{'='*92}\nPORTFOLIO WITH VETO — 2024+2025 (dedup, conflicts dropped)\n{'='*92}")
report("Portfolio ALL picks", all_picks_no_veto)
report("Portfolio AFTER VETO", all_picks_no_veto[~all_picks_no_veto.contradicts])
report("Portfolio VETOED only", all_picks_no_veto[all_picks_no_veto.contradicts])

# Per-year for the veto-applied portfolio
L(f"\n  Per year AFTER VETO:")
for Y in [2024,2025]:
    sub = all_picks_no_veto[(all_picks_no_veto.season==Y) & ~all_picks_no_veto.contradicts]
    report(f"  {Y}", sub)

L(f"\n{'-'*92}\nVerdict pending — does the veto lift hit rate ≥5pp?")
