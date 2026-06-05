"""
SIGNAL CONDITIONING: take each validated signal and cross it with team stats / matchup conditions to find
sub-conditions that SHARPEN it. Stats are oriented to the BET TEAM (the side the signal tells us to back),
with opponent stats and matchup-mismatch terms too.

DANGER: signals x features x buckets = many cells -> multiple comparisons. Defense: per-season consistency
is printed for every hit; we only FLAG a sub-condition when the bucket lifts base by >=6 pts, n>=20, AND it's
directionally consistent in >=60% of the seasons that have >=5 games. Treat flags as HYPOTHESES to track.

Walk-forward preds (train<S). Signals graded ATS @ consensus close (consistent across signals).
"""
import os, glob
import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingRegressor

HERE = os.path.dirname(os.path.abspath(__file__))
gm = pd.read_parquet(os.path.join(HERE, "data", "model_games.parquet"))
EXCLUDE = {"game_id", "season", "date", "homeTeam", "awayTeam", "homeConference", "awayConference",
           "homePoints", "awayPoints", "venueId", "actual_total", "actual_margin",
           "spread_close", "spread_open", "total_close", "total_open"}
num = gm.select_dtypes(include=[np.number, "Int64", "boolean"])
FEATS = [c for c in num.columns if c not in EXCLUDE]
gm[FEATS] = gm[FEATS].apply(pd.to_numeric, errors="coerce")
TS = [2021, 2022, 2023, 2024, 2025]
def roi(w, n): return (w * 0.909 - (n - w)) / n * 100 if n else 0.0

# ---- walk-forward preds ----
parts = []
for S in TS:
    tr = gm[(gm.season < S) & gm.actual_margin.notna()]
    te = gm[(gm.season == S) & gm.spread_close.notna() & gm.actual_margin.notna()].copy()
    m = HistGradientBoostingRegressor(max_iter=300, learning_rate=0.05, max_depth=4, l2_regularization=1.0, random_state=0).fit(tr[FEATS], tr.actual_margin)
    te["pred"] = m.predict(te[FEATS]); parts.append(te)
A = pd.concat(parts)
A = A[(A.actual_margin + A.spread_close) != 0].copy()
A["edge_close"] = A.pred + A.spread_close
A["home_cover"] = (A.actual_margin + A.spread_close) > 0

# ---- line signals ----
import line_signals
ls = line_signals.build(sorted(set(gm.homeTeam) | set(gm.awayTeam)))
A = A.merge(ls, left_on=["season", "homeTeam", "awayTeam"], right_on=["season", "home", "away"], how="left")
A["conf"] = np.where(A.homeConference == A.awayConference, A.homeConference, "NON")

# ---- conditioning feature bases (have home_/away_ variants) ----
BASES = ["adj_epa", "adj_epa_allowed", "adj_passing_epa", "adj_passing_epa_allowed", "adj_rushing_epa",
         "adj_success", "adj_explosiveness", "adj_line_yards", "adj_line_yards_allowed", "def_havoc",
         "off_ppo", "off_start", "pace_off_plays", "elo", "talent", "days_rest"]
BIN = ["off_bye", "short_week", "self_rank_is"]   # binary bet-team flags

def orient(df, side_home):
    """Return dict of bet-team & opp & mismatch conditioning columns oriented to the bet side."""
    out = {}
    for b in BASES:
        h, a = df.get(f"home_{b}"), df.get(f"away_{b}")
        if h is None or a is None: continue
        out[f"bet_{b}"] = np.where(side_home, h, a)
        out[f"opp_{b}"] = np.where(side_home, a, h)
    for b in BIN:
        h, a = df.get(f"home_{b}"), df.get(f"away_{b}")
        if h is not None and a is not None:
            out[f"bet_{b}"] = np.where(side_home, h, a)
            out[f"opp_off_bye" if b == "off_bye" else f"opp_{b}"] = np.where(side_home, a, h)
    # mismatch terms
    if "bet_adj_epa" in out and "opp_adj_epa_allowed" in out:
        out["mm_off_vs_oppdef"] = out["bet_adj_epa"] - out["opp_adj_epa_allowed"]
    if "bet_adj_epa_allowed" in out and "opp_adj_epa" in out:
        out["mm_def_vs_oppoff"] = out["opp_adj_epa"] - out["bet_adj_epa_allowed"]  # higher = tougher opp off
    if "bet_adj_line_yards" in out and "opp_adj_line_yards_allowed" in out:
        out["mm_OL_vs_oppDL"] = out["bet_adj_line_yards"] - out["opp_adj_line_yards_allowed"]
    return out

def condition(name, sub, side_home, win):
    """sub: qualifying games; side_home: bool array (bet home?); win: ATS win bool. Sweep conditions."""
    base = 100 * win.mean(); n0 = len(sub)
    print(f"\n{'='*86}\n{name}: n={n0} base hit {base:.1f}% (graded @ close)\n{'='*86}")
    cols = orient(sub, side_home)
    flags = []
    win = pd.Series(np.asarray(win), index=sub.index)
    for cname, vals in cols.items():
        v = pd.Series(pd.to_numeric(vals, errors="coerce"), index=sub.index)
        if v.notna().sum() < 30: continue
        if cname.startswith("bet_off_bye") or cname.startswith("opp_off_bye") or "short_week" in cname or "self_rank_is" in cname:
            buckets = [("=1", v == 1), ("=0", v == 0)]
        else:
            q1, q2 = v.quantile(1/3), v.quantile(2/3)
            buckets = [("LOW", v <= q1), ("HIGH", v >= q2)]
        for blab, bm in buckets:
            bm = bm.fillna(False); b = sub[bm]; w = win[bm]
            n = len(b)
            if n < 20: continue
            h = 100 * w.mean()
            seasons = [(s, w[b.season == s]) for s in TS if (b.season == s).sum() >= 5]
            cons = np.mean([wx.mean() > 0.5 for _, wx in seasons]) if seasons else 0
            per = "/".join(f"{100*w[b.season==s].mean():.0f}" if (b.season==s).sum() >= 5 else "--" for s in TS)
            if h - base >= 6 and n >= 20 and cons >= 0.6:
                flags.append((cname, blab, n, h, cons, per))
    flags.sort(key=lambda x: -x[3])
    if not flags:
        print("  (no sub-condition cleared the bar)")
    for cname, blab, n, h, cons, per in flags:
        print(f"  + {cname:<22}{blab:<5} n={n:<4} hit {h:4.1f}% (+{h-base:.1f}) seas-consist {cons:.0%} [{per}]")

# ================= SIGNALS =================
# 1. SOFT-BOOK GAP standalone: bet sharp side
g = A[A.soft_gap.abs() >= 0.5].copy()
sh = (g.soft_gap < 0).values
win = np.where(sh, g.home_cover, ~g.home_cover)
condition("SOFT-BOOK GAP>=0.5 (bet sharp side)", g, sh, win)

# 2. STACK: model+gap agree, |edge_close|>=2
st = A[(A.edge_close.abs() >= 2) & (A.soft_gap.abs() >= 0.5)].copy()
mh = (st.edge_close > 0).values; gh = (st.soft_gap < 0).values
st = st[mh == gh].copy()                      # agree
sh = (st.edge_close > 0).values
win = np.where(sh, st.home_cover, ~st.home_cover)
condition("STACK model+gap agree (bet model side)", st, sh, win)

# 3. KEY dog +2.5/3/3.5 (take the dog)
k = A[A.dk_sp_close.isin([2.5, 3.0, 3.5, -2.5, -3.0, -3.5])].copy()
sh = (k.dk_sp_close > 0).values               # home dog -> bet home
win = np.where(sh, k.home_cover, ~k.home_cover)
condition("KEY dog +2.5/3/3.5 (take dog)", k, sh, win)

# 4. Model PREMIUM-ish: |edge_open|>=8 region using edge_close>=6 as proxy, bet model side
pm = A[A.edge_close.abs() >= 6].copy()
sh = (pm.edge_close > 0).values
win = np.where(sh, pm.home_cover, ~pm.home_cover)
condition("MODEL high-edge |edge_close|>=6 (bet model side)", pm, sh, win)
