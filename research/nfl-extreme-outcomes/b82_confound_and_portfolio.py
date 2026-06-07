"""
b82 — Confound check on Survivor #1 (cross-book total gap), then portfolio assembly.

CONFOUND HYPOTHESIS
  "Soft total > sharp total → bet UNDER at soft" might just be a dressed-up version of
  "bet UNDER at the highest book in the slate" — i.e., a pure outlier-fade trick. If the
  alleged edge is really just outlier-fade, then:
    (a) the strategy graded at CONSENSUS should be weaker than graded at soft (the soft
        line is conveniently higher = easier UNDER cover), and
    (b) a generic "UNDER at slate-max book" strategy without the sharp/soft framing should
        hit at similar rates.

PORTFOLIO
  After confound, combine the two surviving NFL CFB-replication signals:
    Survivor #1 (cross-book total gap) — microstructure
    Survivor #2 (both-teams-over-hot → UNDER at mid totals) — behavioral mean reversion
  Both target UNDER on totals. Independent mechanisms → can stack.
  Test on 2025 holdout: per-signal, joint when overlap, total portfolio ROI.
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

# Replicate b77 prep: per-book closing line, mapping teams
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
L(f"[load] {len(oh)} per-book closing rows merged with outcomes")

# Per-book sharpness ranking walk-forward (replicate b77)
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

# Build per-game consensus + soft/sharp totals for each test year, walk-forward
def build_year_frame(target_year):
    train = oh[oh.season < target_year]
    rk = rank_books_total(train)
    sharps = set(rk.head(3).book.tolist()); softs = set(rk.tail(3).book.tolist())
    tgt = oh[oh.season==target_year].copy()
    rows=[]
    for (sea,hm,aw), g in tgt.groupby(["season","home_ab","away_ab"]):
        s_in = g[g.book.isin(sharps)]; so_in = g[g.book.isin(softs)]
        all_in = g
        if s_in.empty or so_in.empty: continue
        rows.append({
            "season":sea,"home_ab":hm,"away_ab":aw,
            "sharp_total":s_in.total_point.mean(),
            "soft_total":so_in.total_point.mean(),
            "consensus_total":all_in.total_point.mean(),
            "slate_max_total":all_in.total_point.max(),
            "slate_min_total":all_in.total_point.min(),
            "actual_total":g.actual_total.iloc[0],
        })
    return pd.DataFrame(rows), rk

# ===========================================================================
# CONFOUND CHECK
# ===========================================================================
L(f"\n{'='*92}\nCONFOUND CHECK — is cross-book gap really 'fade outlier-high book'?\n{'='*92}")
for target_year in [2024, 2025]:
    df, rk = build_year_frame(target_year)
    df["gap"] = df.soft_total - df.sharp_total
    sub = df[df.gap >= 0.5].copy()
    if len(sub)<5: L(f"\n  {target_year}: no qualifying games"); continue

    # 1. ORIGINAL: bet UNDER at soft when soft>sharp
    sub["won_soft"] = (sub.actual_total < sub.soft_total).astype(float)
    sub.loc[sub.actual_total==sub.soft_total, "won_soft"] = np.nan
    # 2. CONSENSUS: same picks but graded at consensus (lower number, harder UNDER)
    sub["won_cons"] = (sub.actual_total < sub.consensus_total).astype(float)
    sub.loc[sub.actual_total==sub.consensus_total, "won_cons"] = np.nan
    # 3. SHARP: same picks graded at sharp (lowest of three reference points — hardest UNDER)
    sub["won_sharp"] = (sub.actual_total < sub.sharp_total).astype(float)
    sub.loc[sub.actual_total==sub.sharp_total, "won_sharp"] = np.nan

    L(f"\n  {target_year} (signal picks, n={len(sub)}):")
    for label, col in [("graded at SOFT (original)", "won_soft"),
                       ("graded at CONSENSUS", "won_cons"),
                       ("graded at SHARP", "won_sharp")]:
        w = sub[col].dropna(); n=len(w); k=int(w.sum())
        if n==0: continue
        lo,hi = wilson_ci(k,n)
        L(f"    {label:30s} n={n:3d} hit={k}/{n}={k/n*100:.1f}% CI[{lo*100:.0f},{hi*100:.0f}]")

    # 4. NAIVE outlier-fade: bet UNDER at slate-max book for EVERY game with notable spread
    df["slate_spread"] = df.slate_max_total - df.slate_min_total
    naive = df[df.slate_spread >= 0.5].copy()
    naive["won_max"] = (naive.actual_total < naive.slate_max_total).astype(float)
    naive.loc[naive.actual_total==naive.slate_max_total, "won_max"] = np.nan
    w = naive.won_max.dropna(); n=len(w); k=int(w.sum())
    lo,hi = wilson_ci(k,n)
    L(f"    NAIVE: UNDER at slate-max (any disagreement >=0.5) n={n:3d} hit={k/n*100:.1f}% CI[{lo*100:.0f},{hi*100:.0f}]")

    # 5. Test the inverse direction: when soft < sharp by gap, bet OVER at soft (lower number)
    over = df[df.gap <= -0.5].copy()
    over["won_over_soft"] = (over.actual_total > over.soft_total).astype(float)
    over.loc[over.actual_total==over.soft_total, "won_over_soft"] = np.nan
    over["won_over_cons"] = (over.actual_total > over.consensus_total).astype(float)
    over.loc[over.actual_total==over.consensus_total, "won_over_cons"] = np.nan
    w = over.won_over_soft.dropna(); n=len(w); k=int(w.sum())
    if n>=5:
        lo,hi=wilson_ci(k,n)
        L(f"    INVERSE: soft<sharp -> OVER at soft   n={n:3d} hit={k/n*100:.1f}% CI[{lo*100:.0f},{hi*100:.0f}]")
        w2 = over.won_over_cons.dropna()
        n2=len(w2); k2=int(w2.sum())
        L(f"    INVERSE: same picks graded at CONSENSUS n={n2:3d} hit={k2/n2*100:.1f}%")

L(f"\n  Reading: if SOFT and CONSENSUS hit rates are similar, the signal is real (not outlier-fade).")
L(f"  If SOFT hits high but CONSENSUS hits near 50%, the signal is just 'easier UNDER number'.")
L(f"  If NAIVE 'UNDER at slate-max' matches the signal hit rate, the gap isn't doing the work.")

# ===========================================================================
# PORTFOLIO ASSEMBLY — Survivor #1 + Survivor #2
# ===========================================================================
L(f"\n\n{'='*92}\nPORTFOLIO BACKTEST on 2025 holdout\n{'='*92}")

# Survivor #1 picks for 2025
df25, _ = build_year_frame(2025)
df25["gap"] = df25.soft_total - df25.sharp_total
s1 = df25[df25.gap>=0.5].copy()
s1["bet_line"] = s1.soft_total
s1["pick"] = "UNDER"
s1["won"] = (s1.actual_total < s1.bet_line).astype(float)
s1.loc[s1.actual_total==s1.bet_line, "won"] = np.nan
s1["source"] = "S1_cross_book"

# Also include the OVER inverse legs from S1
s1_over = df25[df25.gap<=-0.5].copy()
s1_over["bet_line"] = s1_over.soft_total
s1_over["pick"] = "OVER"
s1_over["won"] = (s1_over.actual_total > s1_over.bet_line).astype(float)
s1_over.loc[s1_over.actual_total==s1_over.bet_line, "won"] = np.nan
s1_over["source"] = "S1_cross_book_OVER"

# Survivor #2 picks for 2025: both teams' season-to-date over-rate >= 60%, total in mid band (42-46.5)
ma2 = ma.merge(od[["season","home_ab","away_ab","open_total"]], on=["season","home_ab","away_ab"], how="left")
ma2["total_line"] = ma2.open_total.fillna(ma2.ou_vegas_line)
ma2 = ma2.dropna(subset=["total_line","actual_total","week","season"]).copy()
ma2["went_over"] = (ma2.actual_total > ma2.total_line).astype(int)
ma2.loc[ma2.actual_total==ma2.total_line,"went_over"] = np.nan
# As-of over-rate per team
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

ma25 = ma2[ma2.season==2025].copy()
ma25 = ma25.merge(tg[["season","week","team","prior_or","prior_n"]].rename(
    columns={"team":"home_ab","prior_or":"h_or","prior_n":"h_n"}), on=["season","week","home_ab"], how="left")
ma25 = ma25.merge(tg[["season","week","team","prior_or","prior_n"]].rename(
    columns={"team":"away_ab","prior_or":"a_or","prior_n":"a_n"}), on=["season","week","away_ab"], how="left")
qual = ma25[(ma25.h_n>=3) & (ma25.a_n>=3) & (ma25.h_or>=0.6) & (ma25.a_or>=0.6) &
            (ma25.total_line>=42) & (ma25.total_line<=46.5)].copy()
qual["bet_line"] = qual.total_line
qual["pick"] = "UNDER"
qual["won"] = (qual.actual_total < qual.bet_line).astype(float)
qual.loc[qual.actual_total==qual.bet_line,"won"] = np.nan
qual["source"] = "S2_form_under_mid"

# Per-signal hit rates on 2025 holdout
def report(name, df):
    w = df.won.dropna(); n=len(w); k=int(w.sum())
    if n==0: L(f"  {name:32s} (no picks)"); return None
    lo,hi=wilson_ci(k,n); roi = (k*100/110-(n-k))/n*100
    L(f"  {name:32s} n={n:3d}  hit={k}/{n}={k/n*100:.1f}%  CI[{lo*100:.0f},{hi*100:.0f}]  ROI@-110={roi:+.1f}%")
    return (n,k,roi)

L(f"\nINDIVIDUAL signals on 2025:")
report("S1: cross-book gap, UNDER",   s1)
report("S1: cross-book gap, OVER",    s1_over)
report("S2: form OU mean-rev UNDER",  qual)

# Overlap: when both S1-UNDER and S2 fire on the same game
overlap = s1.merge(qual[["season","home_ab","away_ab","won"]].rename(columns={"won":"s2_won"}),
                   on=["season","home_ab","away_ab"], how="inner")
L(f"\nOVERLAP S1-UNDER & S2 (both fire on same game, both UNDER):")
if len(overlap)>0:
    overlap["both_won"] = ((overlap.won==1) & (overlap.s2_won==1)).astype(float)
    overlap.loc[overlap.won.isna() | overlap.s2_won.isna(), "both_won"] = np.nan
    n=overlap.both_won.dropna().shape[0]; k=int(overlap.both_won.dropna().sum())
    L(f"  n={n}  both_won={k}/{n}")
else:
    L(f"  (no overlap)")

# Combined portfolio (deduplicate same game, take the higher conviction signal)
all_picks = pd.concat([
    s1[["season","home_ab","away_ab","pick","bet_line","won","source"]],
    s1_over[["season","home_ab","away_ab","pick","bet_line","won","source"]],
    qual[["season","home_ab","away_ab","pick","bet_line","won","source"]],
], ignore_index=True)
# If same game appears twice with SAME pick, count once. If different picks (S1 says OVER, S2 says UNDER), skip (conflict).
dedup_rows=[]
for (sea,hm,aw), g in all_picks.groupby(["season","home_ab","away_ab"]):
    if g.pick.nunique()>1:
        # conflict — skip (one of those independent signals must be wrong)
        continue
    # If multiple sources agree, take first row (same pick); add a "conviction" count
    r = g.iloc[0].to_dict(); r["conviction"] = len(g); r["sources"] = ",".join(g.source.unique())
    dedup_rows.append(r)
port = pd.DataFrame(dedup_rows)
L(f"\nCOMBINED PORTFOLIO (dedup, conflicts dropped): {len(port)} picks")
L(f"  By conviction:")
for c in sorted(port.conviction.unique()):
    sub = port[port.conviction==c]
    w = sub.won.dropna(); n=len(w); k=int(w.sum())
    if n==0: continue
    lo,hi=wilson_ci(k,n); roi=(k*100/110-(n-k))/n*100
    L(f"    conv={c} (n={len(sub)}): hit={k}/{n}={k/n*100:.1f}% CI[{lo*100:.0f},{hi*100:.0f}] ROI={roi:+.1f}%")
w = port.won.dropna(); n=len(w); k=int(w.sum())
if n>0:
    lo,hi=wilson_ci(k,n); roi=(k*100/110-(n-k))/n*100
    L(f"  PORTFOLIO TOTAL: n={n} hit={k}/{n}={k/n*100:.1f}% CI[{lo*100:.0f},{hi*100:.0f}] ROI@-110={roi:+.1f}% units={(roi/100)*n:+.1f}")

# Per-week portfolio for sanity
L(f"\nPer-week sample:")
ma_keys = ma[["season","week","home_ab","away_ab"]].drop_duplicates()
port = port.merge(ma_keys, on=["season","home_ab","away_ab"], how="left")
for _,r in port.sort_values("week").iterrows():
    res = "WIN" if r.won==1 else "loss" if r.won==0 else "push"
    L(f"  W{int(r.week):2d}  {r.away_ab}@{r.home_ab}  {r.pick} {r.bet_line:.1f}  [{r.sources}] conv={r.conviction}  -> {res}")
