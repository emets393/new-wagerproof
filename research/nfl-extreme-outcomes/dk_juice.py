"""
DraftKings-only line movement with attention to the JUICE (spread price), not just the number.
Hypothesis: when a book juices one side (e.g. home -3 moves -110 -> -120 while the number holds),
that is 'hidden' line movement toward that side -> it should cover. Also test closing juice
asymmetry, juice movement as a leading indicator of point movement, and the totals analogue.
ROI is computed at the ACTUAL price you'd pay (juice matters), plus flat-110 hit for direction.
"""
import os, sys
import numpy as np
import pandas as pd
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from stats_helpers import wilson_ci, bet_summary, fmt

DATA = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
load = lambda n: pd.read_parquet(os.path.join(DATA, f"{n}.parquet"))
L = print

oh = load("odds_hist"); tm = load("team_mapping"); master = load("master")
name2ab = dict(zip(tm["team_name"], tm["Team Abbrev"]))

dk = oh[oh.book == "draftkings"].copy()
dk["snap_ts"] = pd.to_datetime(dk["snap_ts"], utc=True)
dk["commence_time"] = pd.to_datetime(dk["commence_time"], utc=True)
dk = dk[dk["snap_ts"] < dk["commence_time"]]                       # pregame only
dk["home_ab"] = dk["home_team"].map(name2ab); dk["away_ab"] = dk["away_team"].map(name2ab)


def imp(o):
    o = np.asarray(o, float)
    return np.where(o < 0, -o / (-o + 100.0), 100.0 / (o + 100.0))


def american_profit(price):
    """profit per 1u staked on a win at this American price."""
    p = float(price)
    return (100.0 / -p) if p < 0 else (p / 100.0)


key = ["season", "home_ab", "away_ab"]
rows = []
for k, g in dk.groupby(key):
    g = g.sort_values("snap_ts")
    op, cl = g.iloc[0], g.iloc[-1]
    rec = dict(zip(key, k))
    rec.update(
        n_snaps=len(g),
        open_pt=op["spread_home"], close_pt=cl["spread_home"],
        open_hp=op["spread_home_price"], close_hp=cl["spread_home_price"],
        open_ap=op["spread_away_price"], close_ap=cl["spread_away_price"],
        open_tot=op["total_point"], close_tot=cl["total_point"],
        open_op=op["total_over_price"], close_op=cl["total_over_price"],
        open_up=op["total_under_price"], close_up=cl["total_under_price"],
    )
    rows.append(rec)
d = pd.DataFrame(rows).dropna(subset=["close_hp", "close_ap", "open_hp", "open_ap"])

# price lean toward home = implied(home price) - implied(away price); >0 means home is the juiced side
d["open_lean"] = imp(d["open_hp"]) - imp(d["open_ap"])
d["close_lean"] = imp(d["close_hp"]) - imp(d["close_ap"])
d["lean_move"] = d["close_lean"] - d["open_lean"]      # >0: juice shifted toward home
d["pt_move"] = d["close_pt"] - d["open_pt"]            # >0: home number got worse (toward dog)
# 'cents' juice gap for interpretability: how much more expensive is the home side, in cents
d["close_juice_cents_home"] = (-d["close_hp"]) - (-d["close_ap"])  # e.g. home -120, away -100 -> +20

m = master[key + ["spread_diff", "total_diff", "home_spread", "ou_vegas_line"]].copy()
g = d.merge(m, on=key, how="inner")
L(f"[merge] DK games joined to master: {len(g)}  seasons={sorted(g['season'].unique())}")
# validate: close point ~ stored home_spread
agree = (g["close_pt"] - g["home_spread"]).abs()
L(f"[validate] DK close point vs stored home_spread: |diff| median={agree.median():.2f} within1={ (agree<=1).mean()*100:.0f}%")

g["home_cover"] = np.where(g["spread_diff"] > 0, 1.0, np.where(g["spread_diff"] < 0, 0.0, np.nan))


def roi_at_price(side_won, prices):
    """side_won: 1/0 array; prices: American price paid. Returns roi, units, n, hit."""
    sw = np.asarray(side_won, float); pr = np.asarray(prices, float)
    ok = ~np.isnan(sw)
    sw, pr = sw[ok], pr[ok]
    prof = np.where(sw == 1, np.array([american_profit(p) for p in pr]), -1.0)
    n = len(sw)
    return (prof.sum() / n if n else np.nan, prof.sum(), n, sw.mean() if n else np.nan)


def report_side_bet(label, mask, bet_home, price_home, price_away):
    """bet_home: bool array (True=bet home, False=bet away) over masked rows."""
    sub = g[mask].copy()
    bh = bet_home[mask.values] if hasattr(bet_home, "values") else bet_home[mask.to_numpy()]
    won = np.where(bh, sub["home_cover"], 1 - sub["home_cover"])
    price = np.where(bh, sub[price_home], sub[price_away])
    roi, units, n, hit = roi_at_price(won, price)
    # flat -110 hit + CI for direction
    wseries = pd.Series(won, index=sub.index).dropna()
    k = int((wseries == 1).sum()); nn = int(wseries.isin([0, 1]).sum())
    lo, hi = wilson_ci(k, nn)
    L(f"  {label:42s} n={nn:4d} cover%={hit*100:5.1f} CI[{lo*100:4.1f},{hi*100:4.1f}] "
      f"ROI@actual={roi*100:+5.1f}% (flat-110 edge={ (hit-0.524)*100:+.1f}pp)")


L("\n"+"="*94); L("DK SPREAD JUICE — descriptive"); L("="*94)
L(f"  close juice |home cents| distribution: "
  f"{g['close_juice_cents_home'].abs().quantile([.5,.75,.9,.99]).round(0).to_dict()}")
L(f"  games where number NEVER moved (pt_move==0): {(g['pt_move']==0).sum()} "
  f"({(g['pt_move']==0).mean()*100:.0f}%)")
L(f"  corr(early lean_move, pt_move) — does juice lead the number? "
  f"{np.corrcoef(g['lean_move'], g['pt_move'])[0,1]:+.3f}")

L("\n"+"="*94); L("[1] CLOSING JUICE ASYMMETRY — back the more-juiced (expensive) side"); L("="*94)
for thr in [0.0, 0.02, 0.04, 0.06]:
    mask = (g["close_lean"].abs() >= thr)
    bet_home = (g["close_lean"] > 0)        # home is more expensive -> back home
    report_side_bet(f"|close_lean|>={thr:.2f}: back juiced side", mask, bet_home, "close_hp", "close_ap")

L("\n  per-season (back juiced side, |close_lean|>=0.02):")
for s in sorted(g["season"].unique()):
    mask = (g["season"] == s) & (g["close_lean"].abs() >= 0.02)
    report_side_bet(f"  {int(s)}", mask, (g["close_lean"] > 0), "close_hp", "close_ap")

L("\n"+"="*94); L("[2] JUICE MOVEMENT — back the side whose juice INCREASED open->close"); L("="*94)
for thr in [0.0, 0.02, 0.04]:
    mask = (g["lean_move"].abs() >= thr)
    report_side_bet(f"|lean_move|>={thr:.2f}: back juiced-up side", mask, (g["lean_move"] > 0), "close_hp", "close_ap")
L("\n  per-season (back juiced-up side, |lean_move|>=0.02):")
for s in sorted(g["season"].unique()):
    mask = (g["season"] == s) & (g["lean_move"].abs() >= 0.02)
    report_side_bet(f"  {int(s)}", mask, (g["lean_move"] > 0), "close_hp", "close_ap")

L("\n"+"="*94); L("[3] HIDDEN MOVEMENT — number held (pt_move==0) but juice moved"); L("="*94)
for thr in [0.0, 0.015, 0.03]:
    mask = (g["pt_move"] == 0) & (g["lean_move"].abs() >= thr)
    report_side_bet(f"pt held & |lean_move|>={thr:.3f}: back juiced-up side", mask, (g["lean_move"] > 0), "close_hp", "close_ap")

L("\n"+"="*94); L("[4] POINT MOVE (DK) — back the side the NUMBER moved toward (steam baseline)"); L("="*94)
for thr in [0.5, 1.0]:
    mask = (g["pt_move"].abs() >= thr)
    # pt_move>0 => home number worse => money/steam on AWAY (line moved toward away). back away.
    report_side_bet(f"|pt_move|>={thr}: follow the number", mask, (g["pt_move"] < 0), "close_hp", "close_ap")

L("\n"+"="*94); L("[5] TOTALS JUICE — back the side (over/under) whose price got juiced"); L("="*94)
g["open_tlean"] = imp(g["open_op"]) - imp(g["open_up"])     # >0: OVER is more expensive
g["close_tlean"] = imp(g["close_op"]) - imp(g["close_up"])
g["tlean_move"] = g["close_tlean"] - g["open_tlean"]
g["over_win"] = np.where(g["total_diff"] > 0, 1.0, np.where(g["total_diff"] < 0, 0.0, np.nan))
def report_tot(label, mask, bet_over):
    sub = g[mask]
    bo = bet_over[mask.to_numpy()]
    won = np.where(bo, sub["over_win"], 1 - sub["over_win"])
    price = np.where(bo, sub["close_op"], sub["close_up"])
    roi, units, n, hit = roi_at_price(won, price)
    ws = pd.Series(won, index=sub.index).dropna(); k=int((ws==1).sum()); nn=int(ws.isin([0,1]).sum())
    lo,hi=wilson_ci(k,nn)
    L(f"  {label:42s} n={nn:4d} hit%={hit*100:5.1f} CI[{lo*100:4.1f},{hi*100:4.1f}] ROI@actual={roi*100:+5.1f}%")
for thr in [0.0, 0.02, 0.04]:
    report_tot(f"|close total lean|>={thr:.2f}: back juiced O/U side",
               (g["close_tlean"].abs() >= thr), (g["close_tlean"] > 0))
report_tot("totals juice MOVED toward a side (|move|>=0.02)",
           (g["tlean_move"].abs() >= 0.02), (g["tlean_move"] > 0))
