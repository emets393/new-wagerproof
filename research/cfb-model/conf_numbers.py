"""
CONFERENCE-SPECIFIC number analysis. Do specific spread/total numbers behave differently in conference
matchups by conference (and home/away favorite split) vs the overall / non-conference baseline?
Graded @ consensus CLOSE, pushes excluded. Honesty: min-n floors + per-season check on standouts (guards
multiple-comparisons since conf x band x location = many cells).
"""
import os
import numpy as np
import pandas as pd

HERE = os.path.dirname(os.path.abspath(__file__))
gm = pd.read_parquet(os.path.join(HERE, "data", "model_games.parquet"))
SEASONS = sorted(gm.season.unique())
def roi(w, n): return (w * 0.909 - (n - w)) / n * 100 if n else 0.0

gm = gm[gm.spread_close.notna() & gm.actual_margin.notna()].copy()
gm["conf_game"] = gm.homeConference == gm.awayConference
gm["conf"] = np.where(gm.conf_game, gm.homeConference, "NON-CONF")
# favorite perspective
gm["fav_sp"] = -gm.spread_close.abs()
gm["fav_is_home"] = gm.spread_close < 0
gm["fav_margin"] = np.where(gm.fav_is_home, gm.actual_margin, -gm.actual_margin)
gm["ats"] = gm.fav_margin + gm.fav_sp           # >0 fav covers
gm["over_res"] = gm.actual_total - gm.total_close
SP = gm[gm.ats != 0].copy()                      # spread non-push
TOT = gm[gm.over_res != 0].copy()                # total non-push

CONFS = ["SEC", "Big Ten", "Big 12", "ACC", "Pac-12", "American Athletic",
         "Mountain West", "Mid-American", "Sun Belt", "Conference USA"]
BANDS = [("pk(<=2.5)", 0, 2.5), ("~3", 2.5, 3.5), ("3.5-6.5", 3.5, 6.5), ("~7", 6.5, 7.5),
         ("7.5-10", 7.5, 10.5), ("10.5-14", 10.5, 14.5), ("14.5+", 14.5, 99)]

def per_season(sub, win_mask):
    return "/".join(f"{100*win_mask[sub.season==s].mean():.0f}" if (sub.season==s).sum()>=8 else "--" for s in SEASONS)

print("="*86)
print("SPREAD: FAVORITE cover% by conference (conf games), home-fav vs away-fav  [@close, push excl]")
print("="*86)
print(f"  overall fav cover ALL games: {100*(SP.ats>0).mean():.1f}% (n={len(SP)})")
print(f"{'conf':<20}{'n':>5}{'favCov%':>8}{'  homeFav(n)':>16}{'  awayFav(n)':>16}")
for c in ["NON-CONF"] + CONFS:
    s = SP[SP.conf == c]
    if len(s) < 50: continue
    hf = s[s.fav_is_home]; af = s[~s.fav_is_home]
    print(f"{c:<20}{len(s):>5}{100*(s.ats>0).mean():>8.1f}"
          f"{f'{100*(hf.ats>0).mean():.1f}({len(hf)})':>16}{f'{100*(af.ats>0).mean():.1f}({len(af)})':>16}")

print("\n" + "="*86)
print("SPREAD: FAVORITE cover% by KEY-NUMBER BAND within each conference (n>=30 shown)")
print("="*86)
hdr = f"{'conf':<18}" + "".join(f"{b[0]:>11}" for b in BANDS)
print(hdr)
for c in ["NON-CONF"] + CONFS:
    s = SP[SP.conf == c]
    row = f"{c:<18}"
    for name, lo, hi in BANDS:
        b = s[(s.fav_sp.abs() > lo) & (s.fav_sp.abs() <= hi)]
        row += (f"{100*(b.ats>0).mean():.0f}({len(b)})".rjust(11)) if len(b) >= 30 else "--".rjust(11)
    print(row)

print("\n" + "="*86)
print("TOTALS: OVER% by conference (conf games), and by total band  [@close, push excl]")
print("="*86)
print(f"  overall OVER% ALL games: {100*(TOT.over_res>0).mean():.1f}% (n={len(TOT)})")
TBANDS = [("<45", 0, 45), ("45-52", 45, 52), ("52-59", 52, 59), ("59-66", 59, 66), ("66+", 66, 200)]
hdr = f"{'conf':<18}{'n':>5}{'OVER%':>7}  " + "".join(f"{b[0]:>11}" for b in TBANDS)
print(hdr)
for c in ["NON-CONF"] + CONFS:
    s = TOT[TOT.conf == c]
    if len(s) < 50: continue
    row = f"{c:<18}{len(s):>5}{100*(s.over_res>0).mean():>7.1f}  "
    for name, lo, hi in TBANDS:
        b = s[(s.total_close > lo) & (s.total_close <= hi)]
        row += (f"{100*(b.over_res>0).mean():.0f}({len(b)})".rjust(11)) if len(b) >= 30 else "--".rjust(11)
    print(row)

# ---- auto-flag strong standouts and validate per-season ----
print("\n" + "="*86)
print("STANDOUTS (|dev|>=6pts from 50 spread / from overall-over total, n>=60) + per-season")
print("="*86)
ov_base = 100*(TOT.over_res>0).mean()
for c in ["NON-CONF"] + CONFS:
    # spread bands by location
    for loc, lf in [("homeFav", True), ("awayFav", False)]:
        s = SP[(SP.conf == c) & (SP.fav_is_home == lf)]
        for name, lo, hi in BANDS:
            b = s[(s.fav_sp.abs() > lo) & (s.fav_sp.abs() <= hi)]
            if len(b) >= 60:
                cov = 100*(b.ats>0).mean()
                if abs(cov-50) >= 6:
                    print(f"  SPREAD {c} {loc} {name}: fav {cov:.1f}% n={len(b)} [{per_season(b, b.ats>0)}]")
    # totals bands
    for name, lo, hi in TBANDS:
        b = TOT[(TOT.conf == c) & (TOT.total_close > lo) & (TOT.total_close <= hi)]
        if len(b) >= 60:
            ov = 100*(b.over_res>0).mean()
            if abs(ov-ov_base) >= 6:
                print(f"  TOTAL  {c} {name}: over {ov:.1f}% (base {ov_base:.0f}) n={len(b)} [{per_season(b, b.over_res>0)}]")
