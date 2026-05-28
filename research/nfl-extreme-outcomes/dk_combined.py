"""
COMBINE the number move + the juice move on DraftKings into one signal per game.
- Convert juice (price lean) into point-equivalents and add to the point move -> 'total implied
  move toward home' in points.
- Confirmation vs divergence: does the juice agree with the number move, and does agreement matter?
- Follow the combined move, bucketed by magnitude; per-season; ROI at the ACTUAL price paid.
Sign convention: home_spread<0 = home favored. pt_move<0 = number moved TOWARD home.
lean_move>0 = juice shifted TOWARD home (home side more expensive).
"""
import os, sys
import numpy as np
import pandas as pd
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from stats_helpers import wilson_ci
DATA = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
load = lambda n: pd.read_parquet(os.path.join(DATA, f"{n}.parquet"))
L = print
oh = load("odds_hist"); tm = load("team_mapping"); master = load("master")
name2ab = dict(zip(tm["team_name"], tm["Team Abbrev"]))
dk = oh[oh.book == "draftkings"].copy()
dk["snap_ts"] = pd.to_datetime(dk["snap_ts"], utc=True); dk["commence_time"] = pd.to_datetime(dk["commence_time"], utc=True)
dk = dk[dk["snap_ts"] < dk["commence_time"]]
dk["home_ab"] = dk["home_team"].map(name2ab); dk["away_ab"] = dk["away_team"].map(name2ab)
imp = lambda o: np.where(np.asarray(o, float) < 0, -np.asarray(o, float)/(-np.asarray(o, float)+100), 100/(np.asarray(o, float)+100.0001))
ap = lambda p: (100.0/-p) if p < 0 else (p/100.0)

key = ["season", "home_ab", "away_ab"]
rows = []
for k, gg in dk.groupby(key):
    gg = gg.sort_values("snap_ts"); op, cl = gg.iloc[0], gg.iloc[-1]
    rows.append(dict(zip(key, k)) | dict(
        open_pt=op["spread_home"], close_pt=cl["spread_home"],
        open_hp=op["spread_home_price"], open_ap=op["spread_away_price"],
        close_hp=cl["spread_home_price"], close_ap=cl["spread_away_price"]))
d = pd.DataFrame(rows).dropna(subset=["open_hp", "open_ap", "close_hp", "close_ap", "open_pt", "close_pt"])
d["open_lean"] = imp(d["open_hp"]) - imp(d["open_ap"]); d["close_lean"] = imp(d["close_hp"]) - imp(d["close_ap"])
d["pt_move"] = d["close_pt"] - d["open_pt"]                 # <0 toward home
d["lean_move"] = d["close_lean"] - d["open_lean"]           # >0 toward home
# juice -> points (lean 0.045 ~ half a point); combined move toward home in points
JPT = 11.0
d["toward_home_pts"] = (-d["pt_move"]) + JPT * d["lean_move"]
m = master[key + ["spread_diff", "home_spread"]]
g = d.merge(m, on=key, how="inner")
g["home_cover"] = np.where(g["spread_diff"] > 0, 1.0, np.where(g["spread_diff"] < 0, 0.0, np.nan))
g = g.dropna(subset=["home_cover"])
L(f"[n] DK games with outcome: {len(g)}")


def bet(label, sub, bet_home_bool, per_season=False):
    s = sub.copy()
    bh = np.asarray(bet_home_bool)
    won = np.where(bh, s["home_cover"].values, 1 - s["home_cover"].values)
    price = np.where(bh, s["close_hp"].values, s["close_ap"].values)
    n = len(won); k = int(won.sum())
    lo, hi = wilson_ci(k, n)
    prof = np.where(won == 1, [ap(p) for p in price], -1.0); roi = prof.sum()/n if n else np.nan
    flat = np.where(won == 1, 100/110, -1.0); roi110 = flat.sum()/n if n else np.nan
    L(f"  {label:46s} n={n:4d} cover%={ (k/n*100 if n else 0):5.1f} CI[{lo*100:4.1f},{hi*100:4.1f}] "
      f"ROI@actual={roi*100:+5.1f}% ROI@-110={roi110*100:+5.1f}%")
    if per_season:
        for yr in sorted(s["season"].unique()):
            ss = s[s["season"] == yr]; bb = bh[(s["season"] == yr).values]
            w = np.where(bb, ss["home_cover"].values, 1 - ss["home_cover"].values)
            nn = len(w); kk = int(w.sum()); l2, h2 = wilson_ci(kk, nn)
            f2 = np.where(w == 1, 100/110, -1.0)
            L(f"      {int(yr)}: n={nn:3d} cover%={ (kk/nn*100 if nn else 0):5.1f} ROI@-110={f2.sum()/nn*100:+5.1f}%")


L("\n"+"="*96); L("[A] CONFIRMATION vs DIVERGENCE (number moved >=0.5 pt)"); L("="*96)
moved = g[g["pt_move"].abs() >= 0.5].copy()
moved["num_toward_home"] = moved["pt_move"] < 0
moved["juice_toward_home"] = moved["lean_move"] > 0.005
moved["juice_toward_away"] = moved["lean_move"] < -0.005
moved["confirm"] = ((moved["num_toward_home"]) & (moved["juice_toward_home"])) | \
                   ((~moved["num_toward_home"]) & (moved["juice_toward_away"]))
moved["diverge"] = ((moved["num_toward_home"]) & (moved["juice_toward_away"])) | \
                   ((~moved["num_toward_home"]) & (moved["juice_toward_home"]))
moved["juice_flat"] = (moved["lean_move"].abs() <= 0.005)
L(f"  of {len(moved)} games with a number move: confirm={int(moved['confirm'].sum())} "
  f"diverge={int(moved['diverge'].sum())} juice-flat={int(moved['juice_flat'].sum())}")
L("\n  -- follow the NUMBER move, split by what the juice did --")
bet("number move + juice CONFIRMS  -> follow #", moved[moved["confirm"]], moved[moved["confirm"]]["num_toward_home"], per_season=True)
bet("number move + juice DIVERGES  -> follow #", moved[moved["diverge"]], moved[moved["diverge"]]["num_toward_home"], per_season=True)
bet("number move + juice FLAT      -> follow #", moved[moved["juice_flat"]], moved[moved["juice_flat"]]["num_toward_home"])
L("\n  -- in DIVERGENCE games, who is right: the number or the juice? --")
div = moved[moved["diverge"]]
bet("divergence: TRUST THE JUICE side", div, div["juice_toward_home"])
bet("divergence: TRUST THE NUMBER side", div, div["num_toward_home"])

L("\n"+"="*96); L("[B] TOTAL IMPLIED MOVE (number + juice-in-points) — follow the combined move"); L("="*96)
for lo_thr, hi_thr in [(0.5, 99), (1.0, 99), (1.5, 99), (2.0, 99)]:
    sub = g[g["toward_home_pts"].abs() >= lo_thr]
    bet(f"|combined move|>={lo_thr} pt: follow combined", sub, sub["toward_home_pts"] > 0)
L("\n  per-season, |combined move|>=1.0 pt:")
bet("|combined|>=1.0: follow", g[g["toward_home_pts"].abs() >= 1.0], (g[g["toward_home_pts"].abs() >= 1.0]["toward_home_pts"] > 0), per_season=True)
L("\n  -- FADE the combined move (contrarian) --")
sub = g[g["toward_home_pts"].abs() >= 1.0]
bet("|combined|>=1.0: FADE combined", sub, ~(sub["toward_home_pts"] > 0))

L("\n"+"="*96); L("[C] BIG CONFIRMED STEAM — number moved >=1 AND juice confirms, follow"); L("="*96)
big = g[(g["pt_move"].abs() >= 1.0)].copy()
big["num_toward_home"] = big["pt_move"] < 0
big["confirm"] = ((big["num_toward_home"]) & (big["lean_move"] > 0.005)) | ((~big["num_toward_home"]) & (big["lean_move"] < -0.005))
bet("BIG number move (>=1) + juice confirms", big[big["confirm"]], big[big["confirm"]]["num_toward_home"], per_season=True)

L("\n"+"="*96); L("[D] sanity: does combined move correlate with cover at all?"); L("="*96)
gg = g.copy(); gg["home_cov"] = gg["home_cover"]
L(f"  corr(toward_home_pts, home_cover) = {np.corrcoef(gg['toward_home_pts'], gg['home_cov'])[0,1]:+.3f} (n={len(gg)})")
L(f"  corr(-pt_move, home_cover)        = {np.corrcoef(-gg['pt_move'], gg['home_cov'])[0,1]:+.3f}")
L(f"  corr(lean_move, home_cover)       = {np.corrcoef(gg['lean_move'], gg['home_cov'])[0,1]:+.3f}")
