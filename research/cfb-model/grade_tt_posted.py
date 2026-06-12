"""
Grade the TEAM-TOTAL models vs POSTED team-total lines (event-odds archive, close snap T-2h).
Posted main line per (game, team, book) = Over point with price closest to -110; consensus = median across
books; line-shop = best book for the bet side (UNDER -> highest posted, OVER -> lowest posted).
Triggers identical to locked defs (team_total_signals): anchored pred <= line-3 -> UNDER; unanchored pred >=
line+6 -> OVER. Walk-forward (train<season). Grade vs the POSTED number (signal-line = grade-line).
Reference: same triggers vs CONTRIVED line (what we had before) for an apples comparison.
"""
import numpy as np
import pandas as pd
import team_total_signals as TT
import exp_shared as E

gm = pd.read_parquet("data/model_games.parquet")
cfbd = sorted(set(gm.homeTeam) | set(gm.awayTeam))
AL = {"Appalachian State Mountaineers": "App State", "Hawaii Rainbow Warriors": "Hawai'i",
      "UMass Minutemen": "Massachusetts", "San Jose State Spartans": "San José State",
      "Southern Miss Golden Eagles": "Southern Miss"}
def tdb(o):
    if pd.isna(o): return None
    if o in AL: return AL[o]
    c = [x for x in cfbd if o.startswith(x + " ") or o == x]; c.sort(key=len, reverse=True)
    return c[0] if c else None

# posted close TT main lines
P = pd.concat([pd.read_parquet(f"data/event_odds/events_{y}.parquet") for y in [2023, 2024, 2025]])
P = P[(P.market == "team_totals") & (P.snap_tag == "h2") & (P.name == "Over")].copy()
P["team"] = P.description.map(tdb)
P = P.dropna(subset=["team", "point"])
P["vig"] = (P.price + 110).abs()
P = P.sort_values("vig").drop_duplicates(["season", "game_id", "team", "book"], keep="first")
cons = P.groupby(["season", "game_id", "team"]).agg(
    posted=("point", "median"), nbooks=("book", "nunique"),
    best_under=("point", "max"), best_over=("point", "min")).reset_index()

# model preds (walk-forward) + actual pts
rows = []
for y in [2023, 2024, 2025]:
    t = TT.build(gm, y)
    t["pred_anch"] = t.implied + t.anch_edge
    t["pred_fund"] = t.implied + t.fund_edge
    rows.append(t)
M = pd.concat(rows).merge(cons, on=["season", "game_id", "team"], how="inner")
print(f"team-games with model + posted line: {len(M)} (avg books {M.nbooks.mean():.1f})")
print(f"posted vs contrived: corr {M.posted.corr(M.implied):.3f}, mean|diff| {(M.posted-M.implied).abs().mean():.2f}\n")

def grade(label, mask, line, side):
    b = M[mask].copy(); L = line[mask]
    b = b[b.pts.notna() & L.notna()]; L = L.loc[b.index]
    b = b[b.pts != L]; L = L.loc[b.index]
    win = (b.pts < L) if side == "U" else (b.pts > L)
    n = len(b); w = int(win.sum()); lo, hi = E.wilson(w, n)
    per = "/".join(f"{100*win[b.season==s].mean():.0f}({(b.season==s).sum()})" for s in [2023, 2024, 2025] if (b.season==s).sum())
    roi = (w*0.909-(n-w))/n*100 if n else 0
    print(f"  {label:<44} n={n:<4} hit {100*w/n if n else 0:5.1f}% CI[{lo:.0f},{hi:.0f}] roi{roi:+6.1f} [{per}]")

print("=== UNDER (anchored model) ===")
grade("vs CONTRIVED (reference, old grading)", M.pred_anch <= M.implied - 3, M.implied, "U")
grade("vs POSTED consensus, pred<=posted-3", M.pred_anch <= M.posted - 3, M.posted, "U")
grade("vs POSTED best line (shop), pred<=best-3", M.pred_anch <= M.best_under - 3, M.best_under, "U")
print("\n=== OVER (unanchored model) ===")
grade("vs CONTRIVED (reference)", M.pred_fund >= M.implied + 6, M.implied, "O")
grade("vs POSTED consensus, pred>=posted+6", M.pred_fund >= M.posted + 6, M.posted, "O")
grade("vs POSTED best line (shop), pred>=best+6", M.pred_fund >= M.best_over + 6, M.best_over, "O")
print("\n=== BONUS: posted-vs-contrived gap alone (is the posting itself mispriced?) ===")
grade("posted >= contrived+2 -> UNDER @ posted", M.posted >= M.implied + 2, M.posted, "U")
grade("posted <= contrived-2 -> OVER @ posted", M.posted <= M.implied - 2, M.posted, "O")
