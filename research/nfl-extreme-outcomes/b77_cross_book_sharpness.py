"""
b77 — Cross-book sharpness ranking (NFL replication of CFB Signal #1).

HYPOTHESIS (from CFB research)
  When a sharp book and a soft book disagree on a line, the sharp-book side wins. In CFB this
  hit 57-64% at the soft book's number.

NFL CAVEAT
  The NFL is the most efficient sportsbook market in the world — books typically agree within
  0.5 pts on big slates. We expect cross-book disagreement to be:
    (a) much rarer than CFB,
    (b) concentrated at less-watched books, and
    (c) potentially still actionable when it appears.

METHODOLOGY (walk-forward, no leak)
  1. Extract closing line per (season, home, away, book) — last snapshot before commence_time.
  2. Compute consensus closing line per game = mean across books with coverage.
  3. Per-book lean = book_close - consensus_close (positive = book disagrees by giving home more).
  4. Sharpness score per book per training year(s):
       sharp_score = correlation(lean_to_home, actual_margin)   where actual_margin = home_score-away_score
     Positive correlation means: when book gives home more, home actually does better. SHARP book.
     Negative correlation means: book's lean fades the outcome. SOFT book.
  5. Walk-forward: rank books on seasons < target, test soft-book-gap strategy on target.

FRAMEWORK COMPLIANCE
  - Walk-forward only (rule 1)
  - Per-season holdout (rule 2): rank 2023→test 2024, rank 2023+2024→test 2025
  - Signal source = closing lines from both books → grade vs CLOSING (rule 9)
  - Honest book ranking includes ALL data the prior season(s); doesn't peek at test year
"""
import os, sys, warnings
import numpy as np, pandas as pd
warnings.filterwarnings("ignore")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from stats_helpers import wilson_ci
DATA=os.path.join(os.path.dirname(os.path.abspath(__file__)),"data"); L=print

oh = pd.read_parquet(os.path.join(DATA,"odds_hist.parquet"))
ma = pd.read_parquet(os.path.join(DATA,"matchup_arch.parquet"))
oh["snap_ts"] = pd.to_datetime(oh.snap_ts); oh["commence_time"] = pd.to_datetime(oh.commence_time)
ma["actual_margin"] = ma.home_score - ma.away_score
ma["actual_total"]  = ma.home_score + ma.away_score
L(f"[load] odds_hist: {len(oh)} rows, matchup_arch: {len(ma)} rows")

# Books with full 3-season coverage (filter out partial-coverage books that would create gaps)
book_coverage = oh.groupby("book").season.nunique()
full_books = book_coverage[book_coverage>=3].index.tolist()
L(f"[books] {len(full_books)} books with 3-season coverage: {full_books}")

oh = oh[oh.book.isin(full_books)].copy()
# Only keep snapshots BEFORE kickoff
oh = oh[oh.snap_ts <= oh.commence_time].copy()
# Get the LATEST snapshot per (season, home, away, book) — the closing line at that book
oh = oh.sort_values("snap_ts").drop_duplicates(subset=["season","home_team","away_team","book"], keep="last")
L(f"[close] {len(oh)} per-game per-book closing rows")

# Team-name mapping (odds_hist uses long names like "Kansas City"; matchup uses abbrevs "KC")
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
oh["home_ab"] = oh.home_team.map(team_map)
oh["away_ab"] = oh.away_team.map(team_map)
unmapped = oh[oh.home_ab.isna() | oh.away_ab.isna()]
if len(unmapped)>0:
    L(f"[WARN] {len(unmapped)} unmapped team names: {sorted(set(unmapped.home_team) | set(unmapped.away_team))}")
oh = oh.dropna(subset=["home_ab","away_ab"])

# Merge actual outcomes
oh = oh.merge(ma[["season","home_ab","away_ab","actual_margin","actual_total"]],
              on=["season","home_ab","away_ab"], how="inner")
L(f"[merge] {len(oh)} rows after merging outcomes")

# Compute consensus per game (mean spread across books)
consensus = oh.groupby(["season","home_ab","away_ab"]).agg(
    cons_spread=("spread_home","mean"),
    cons_total=("total_point","mean"),
    n_books=("book","count")
).reset_index()
oh = oh.merge(consensus, on=["season","home_ab","away_ab"], how="left")
# Per-book lean: positive lean_to_home_spread = this book gives home a worse spread (less favored)
# than consensus. e.g., consensus -3, book -2.5 → lean=+0.5. Home covers -3 if margin>3, covers -2.5
# if margin>2.5 — the book is more bearish on home, but bets at the book's number bet HOME -2.5.
# So we want: when does book's lean predict outcome direction?
# Convention: spread_home is signed (negative = home favored). lean = book - consensus.
oh["spread_lean"] = oh.spread_home - oh.cons_spread
oh["total_lean"]  = oh.total_point - oh.cons_total

# ---------------------------------------------------------------------------
# Per-book sharpness ranking, walk-forward
# ---------------------------------------------------------------------------
def rank_books(train_df):
    """For each book in train_df, compute correlation between spread_lean and actual_margin.
    Positive corr = sharp (book's bearishness on home predicts home underperformance).
    Negative corr = soft (book's leans contradict outcomes).
    """
    rows=[]
    for book in train_df.book.unique():
        sub = train_df[train_df.book==book]
        if len(sub)<50: continue
        # corr of lean vs outcome — using actual_margin minus consensus-implied (i.e., extra outcome
        # over what consensus expected). A sharp book's lean correlates with this residual.
        sub = sub.copy()
        sub["margin_resid"] = sub.actual_margin - (-sub.cons_spread)
        c_s = sub[["spread_lean","margin_resid"]].corr().iloc[0,1]
        # Total sharpness similar: total_resid = actual_total - cons_total. If book sets total higher
        # than consensus and actual is higher, book is sharp on totals.
        sub["total_resid"] = sub.actual_total - sub.cons_total
        c_t = sub[["total_lean","total_resid"]].corr().iloc[0,1]
        rows.append({"book":book,"n":len(sub),"sharp_spread":c_s,"sharp_total":c_t,
                     "abs_lean_spread":sub.spread_lean.abs().mean(),
                     "abs_lean_total":sub.total_lean.abs().mean()})
    return pd.DataFrame(rows).sort_values("sharp_spread",ascending=False)

L(f"\n{'='*92}\nBOOK SHARPNESS RANKINGS (walk-forward)\n{'='*92}")
for target_year in [2024, 2025]:
    train = oh[oh.season < target_year]
    ranking = rank_books(train)
    L(f"\nRanked on seasons<{target_year}  (n_train_book_rows shown):")
    L(f"{'book':18s} {'n':>5s}  {'sharp_spread':>12s}  {'sharp_total':>11s}  {'avg|lean_s|':>11s}")
    for _,r in ranking.iterrows():
        L(f"  {r.book:18s} {int(r.n):5d}  {r.sharp_spread:+8.3f}      {r.sharp_total:+8.3f}      {r.abs_lean_spread:.3f}")

# ---------------------------------------------------------------------------
# Soft-book gap strategy backtest (walk-forward)
# ---------------------------------------------------------------------------
L(f"\n{'='*92}\nSOFT-BOOK GAP STRATEGY (sharp book disagrees with soft book → bet sharp side at soft #)\n{'='*92}")

# Per game per target year:
#   1. find sharpest and softest book (from prior years' ranking)
#   2. if they disagree on spread by >= threshold, bet the sharp-book direction at the soft-book line
#   3. grade vs the soft-book closing spread

def grade_gap(target_year, gap_thr, prev_year_ranking):
    sharp_book = prev_year_ranking.iloc[0].book
    soft_book  = prev_year_ranking.iloc[-1].book
    # Wide pool: also test using top-3 sharp vs bottom-3 soft
    sharps = set(prev_year_ranking.head(3).book.tolist())
    softs  = set(prev_year_ranking.tail(3).book.tolist())

    # Build per-game frame: spread per book, find sharp/soft pairs that disagree
    target = oh[oh.season==target_year]
    rows=[]
    for (sea,hm,aw), g in target.groupby(["season","home_ab","away_ab"]):
        sharps_in = g[g.book.isin(sharps)]; softs_in = g[g.book.isin(softs)]
        if sharps_in.empty or softs_in.empty: continue
        sharp_sp = sharps_in.spread_home.mean()   # avg of top-3 sharp books
        soft_sp  = softs_in.spread_home.mean()    # avg of bottom-3 soft books
        gap = soft_sp - sharp_sp                  # positive: soft gives home a worse spread than sharps
        if abs(gap) < gap_thr: continue
        actual_margin = g.actual_margin.iloc[0]
        # Sharps lean home (more favored) → bet HOME at soft # (soft's line is worse for home, better
        # for us). Sharps lean away → bet AWAY at soft #.
        if gap > 0:
            # Sharps say home should be MORE favored. Soft has home less favored. Bet HOME -soft_sp.
            home_pick = True
            line = soft_sp
            push = (actual_margin + line == 0)
            won = (actual_margin + line > 0)
        else:
            # Sharps say home should be LESS favored. Soft has home more favored. Bet AWAY +soft_sp.
            home_pick = False
            line = soft_sp
            push = (actual_margin + line == 0)
            won = (actual_margin + line < 0)
        rows.append({"season":sea,"home":hm,"away":aw,"sharp":sharp_sp,"soft":soft_sp,
                     "gap":gap,"home_pick":home_pick,"won":(np.nan if push else int(won))})
    return pd.DataFrame(rows)

for target_year in [2024, 2025]:
    train = oh[oh.season < target_year]
    ranking = rank_books(train)
    L(f"\nTest year {target_year}  (sharp top-3: {list(ranking.head(3).book)}  soft bottom-3: {list(ranking.tail(3).book)})")
    for thr in [0.5, 1.0, 1.5, 2.0]:
        df = grade_gap(target_year, thr, ranking)
        if len(df)==0 or "won" not in df.columns:
            L(f"  gap>={thr}:  no qualifying games"); continue
        won = df.won.dropna(); n=len(won); k=int(won.sum())
        if n<5: L(f"  gap>={thr}:  n={n} (too thin)"); continue
        lo,hi=wilson_ci(k,n); roi=(k*100/110-(n-k))/n*100
        L(f"  gap>={thr}:  n={n:3d}  hit={k}/{n}={k/n*100:.1f}%  CI[{lo*100:.0f},{hi*100:.0f}]  ROI@-110={roi:+.1f}%")

# Same for totals
L(f"\n{'='*92}\nSOFT-BOOK GAP — TOTALS (sharp side at soft total)\n{'='*92}")
def grade_gap_total(target_year, gap_thr, prev_year_ranking):
    sharps = set(prev_year_ranking.sort_values("sharp_total",ascending=False).head(3).book)
    softs  = set(prev_year_ranking.sort_values("sharp_total",ascending=False).tail(3).book)
    target = oh[oh.season==target_year]
    rows=[]
    for (sea,hm,aw), g in target.groupby(["season","home_ab","away_ab"]):
        s_in = g[g.book.isin(sharps)]; so_in = g[g.book.isin(softs)]
        if s_in.empty or so_in.empty: continue
        sharp_t = s_in.total_point.mean(); soft_t = so_in.total_point.mean()
        gap = soft_t - sharp_t   # positive: soft has higher total than sharp
        if abs(gap) < gap_thr: continue
        actual_total = g.actual_total.iloc[0]
        if gap > 0:
            # Soft has total HIGHER than sharp consensus. Sharp says total is lower. Bet UNDER at soft.
            line = soft_t
            push = (actual_total == line)
            won  = (actual_total < line)
        else:
            line = soft_t
            push = (actual_total == line)
            won  = (actual_total > line)
        rows.append({"season":sea,"won":(np.nan if push else int(won))})
    return pd.DataFrame(rows)

for target_year in [2024, 2025]:
    train = oh[oh.season < target_year]
    ranking = rank_books(train)
    L(f"\nTest year {target_year}:")
    for thr in [0.5, 1.0, 1.5]:
        df = grade_gap_total(target_year, thr, ranking)
        if len(df)==0 or "won" not in df.columns:
            L(f"  total_gap>={thr}:  no qualifying games"); continue
        won = df.won.dropna(); n=len(won); k=int(won.sum())
        if n<5: L(f"  total_gap>={thr}:  n={n} (too thin)"); continue
        lo,hi=wilson_ci(k,n); roi=(k*100/110-(n-k))/n*100
        L(f"  total_gap>={thr}:  n={n:3d}  hit={k}/{n}={k/n*100:.1f}%  CI[{lo*100:.0f},{hi*100:.0f}]  ROI@-110={roi:+.1f}%")

L(f"\n{'-'*92}\nNotes for next pass:")
L(f"  - If NFL cross-book disagreement is too rare or doesn't predict outcomes, fall back to")
L(f"    consensus-only and document this as a negative result (signal #1 dead in NFL).")
L(f"  - Otherwise: stack with sides_model in b78 (CFB signal #2).")
