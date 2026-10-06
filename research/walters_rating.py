#!/usr/bin/env python3
"""Walters' power rating, built from scratch, scored head-to-head against the closing line.

WHY (owner, 2026-10-06). The first pass tested only the LAST step of his method — repricing an
edge in probability mass — bolted onto OUR model's number. That answered "does repricing fix a
bad number" (no), not "is his method better than ours" (untested). His actual edge was in
MAKING the number. This builds that.

The method, from the book:
  True Game Performance Level (TGPL) for a team in a game
      = its net score  +  the OPPONENT'S rating going in  -/+ home-field
  new rating = 0.90 * old rating + 0.10 * TGPL
  predicted margin (home) = home_rating - away_rating + HFA
HFA 2.0 is his stated number; it is also fitted here so the comparison is not hostage to it.

Strictly walk-forward: every game is predicted from ratings built only from EARLIER games, then
the ratings update. No training set, no features, no fitting to the result — which is the point.
Graded at the CLOSE, the hardest line to beat.

Usage: walters_rating.py [carryover] [alpha]
"""
import io, sys, warnings
import numpy as np, pandas as pd, requests
warnings.filterwarnings("ignore")
sys.path.insert(0, "/Users/chrishabib/Documents/new-wagerproof/research")
from point_value import edge_pct, _counts

CARRY = float(sys.argv[1]) if len(sys.argv) > 1 else 0.75   # rating kept across a season break
ALPHA = float(sys.argv[2]) if len(sys.argv) > 2 else 0.10   # the "10%" in 90/10

g = pd.read_csv(io.StringIO(requests.get(
    "https://github.com/nflverse/nfldata/raw/master/data/games.csv", timeout=120).text))
g = g[(g.season >= 2004) & g.result.notna() & g.spread_line.notna()].copy()
g = g.sort_values(["season", "week", "gameday"]).reset_index(drop=True)
# nflverse: result = home - away; spread_line is the HOME spread, positive = home favoured.
# Verified, not assumed: the correlation must be strongly positive or the sign is backwards.
corr = np.corrcoef(g.spread_line, g.result)[0, 1]
print(f"{len(g)} games 2004-2026 | corr(spread_line, result) = {corr:+.3f}  "
      f"-> spread_line is the market's implied HOME margin")
assert corr > 0.4, "sign convention wrong"
VALS = _counts(g.result.tolist())      # directional margin values, our own 2004+ log


def run(hfa, carry=CARRY, alpha=ALPHA, verbose=False):
    rate, seen, season = {}, {}, None
    rows = []
    for r in g.itertuples():
        if r.season != season:                       # season break: regress toward the mean
            rate = {k: v * carry for k, v in rate.items()}
            season = r.season
        h, a = r.home_team, r.away_team
        rh, ra = rate.get(h, 0.0), rate.get(a, 0.0)
        pred = rh - ra + hfa                         # our number for this game
        mkt = float(r.spread_line)                   # market's implied home margin
        act = float(r.result)
        # record the prediction BEFORE the update — nothing here has seen this result
        if seen.get(h, 0) >= 8 and seen.get(a, 0) >= 8:
            rows.append(dict(season=r.season, week=r.week, pred=pred, mkt=mkt, act=act,
                             pts=abs(pred - mkt), pct=edge_pct(pred, mkt, VALS),
                             side_home=pred > mkt, home_covered=(act - mkt) > 0,
                             push=abs(act - mkt) < 1e-9))
        # TGPL: net score plus the opponent's incoming rating, home field removed
        rate[h] = (1 - alpha) * rh + alpha * ((act) + ra - hfa)
        rate[a] = (1 - alpha) * ra + alpha * ((-act) + rh + hfa)
        seen[h] = seen.get(h, 0) + 1; seen[a] = seen.get(a, 0) + 1
    d = pd.DataFrame(rows)
    d = d[~d.push]
    d["won"] = d.side_home == d.home_covered
    return d


# --- fit HFA and the two hyperparameters on PREDICTION ERROR, never on the betting record ---
print("\n=== calibrating on MAE (prediction error), not on wins")
best = None
for hfa in (0.0, 1.0, 1.5, 2.0, 2.5, 3.0):
    d = run(hfa)
    mae = (d.pred - d.act).abs().mean()
    print(f"   HFA {hfa:>4}  MAE {mae:.3f}   (market {(d.mkt-d.act).abs().mean():.3f})")
    if best is None or mae < best[1]:
        best = (hfa, mae)
HFA = best[0]
print(f"   -> HFA = {HFA}")

d = run(HFA)
mae_m, mae_k = (d.pred - d.act).abs().mean(), (d.mkt - d.act).abs().mean()
print(f"\n{len(d)} graded games (both teams >=8 games of history), close-graded")
print(f"MAE  Walters rating {mae_m:.3f}   closing line {mae_k:.3f}   "
      f"-> {'BEATS' if mae_m < mae_k else 'LOSES TO'} the close by {abs(mae_m-mae_k):.3f} pts")
print(f"corr(our number, the close) = {np.corrcoef(d.pred, d.mkt)[0,1]:+.3f}")


def rec(s):
    if not len(s): return f"{'—':>34}"
    w = int(s.won.sum()); l = len(s) - w
    return f"{len(s):>6}{f'{w}-{l}':>12}{w/len(s)*100:>8.1f}%{(w*0.909-l)/len(s)*100:>+9.1f}%"


print(f"\n=== betting the Walters number against the close, gated by HIS mass floor")
print(f"{'gate':<26}{'n':>6}{'W-L':>12}{'hit':>8}{'ROI':>9}")
print(f"{'every game':<26}{rec(d)}")
for f_ in (2, 3, 4, 5, 5.5, 6, 7, 8, 10, 12):
    print(f"{f'mass >= {f_}%':<26}{rec(d[d.pct >= f_])}")

print(f"\n=== his floor (5.5%) by season — is it stable, or one lucky era?")
s = d[d.pct >= 5.5]
print(f"{'season':<8}{'n':>5}{'W-L':>10}{'hit':>8}   {'season':<8}{'n':>5}{'W-L':>10}{'hit':>8}")
yrs = sorted(d.season.unique()); half = (len(yrs) + 1) // 2
for i in range(half):
    out = ""
    for j in (i, i + half):
        if j >= len(yrs): break
        x = s[s.season == yrs[j]]; w = int(x.won.sum()); l = len(x) - w
        out += f"{int(yrs[j]):<8}{len(x):>5}{f'{w}-{l}':>10}{(w/len(x)*100 if len(x) else 0):>7.1f}%   "
    print(out)
pos = sum(1 for y in yrs if len(s[s.season == y]) and s[s.season == y].won.mean() > 0.5238)
print(f"\nseasons clearing the vig at his 5.5% floor: {pos} of {len(yrs)}")
d.to_csv("nfl-extreme-outcomes/out/walters_rating.csv", index=False)
print("-> nfl-extreme-outcomes/out/walters_rating.csv")
