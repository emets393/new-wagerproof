"""DraftKings-SPECIFIC spread + total + (spread×ML) band calibration for CFB (NOT consensus). Companion to
dk_ml_bands.py. Five digs the owner's request implies:
  (A) SPREAD-PRICE juice   — when DK shades one side to -115/-120, does that side cover LESS (public-heavy)?
  (B) SPREAD-LINE buckets  — do favorites of certain sizes (-3, -7, -10, -14+) fail to cover? key numbers.
  (C) TOTAL-PRICE juice    — when DK juices over/under to -115/-120, does that side hit less?
  (D) TOTAL-LINE buckets   — do certain total ranges (low 40s, high 60s) systematically go over/under?
  (E) SPREAD × ML combined — does the ML price add info beyond the spread? (fav covers ATS conditioned on how
      steep its ML is — i.e. is a -7 fav that's ALSO -280 ML a different ATS animal than a -7 fav that's -240?)
Everything graded at the exact DK CLOSING number, 2021-25, per-season shown. Push on the spread = no bet.
ATS breakeven at -110 = 52.38%. DK only."""
import glob, numpy as np, pandas as pd, warnings
warnings.filterwarnings("ignore")

oh = pd.concat([pd.read_parquet(f) for f in sorted(glob.glob("data/odds_history/odds_20*.parquet"))], ignore_index=True)
dk = oh[(oh.book == "draftkings")].copy()
ct = pd.to_datetime(dk.commence_time, utc=True, errors="coerce")
dk["gseason"] = np.where(ct.dt.month >= 7, ct.dt.year, ct.dt.year - 1)
dk = dk[(dk.gseason >= 2021) & (dk.gseason <= 2025) & (dk.hrs_to_kick <= 24)]
dk = dk.sort_values("hrs_to_kick").groupby("game_id", as_index=False).first()   # closest-to-kick = close

mg = pd.read_parquet("data/model_games.parquet")
short = sorted(set(mg.homeTeam) | set(mg.awayTeam))
AL = {"Appalachian State Mountaineers": "App State", "Hawaii Rainbow Warriors": "Hawai'i",
      "UMass Minutemen": "Massachusetts", "San Jose State Spartans": "San José State",
      "Southern Miss Golden Eagles": "Southern Miss", "Southern Mississippi Golden Eagles": "Southern Miss"}
def tshort(o):
    if o in AL: return AL[o]
    c = [x for x in short if str(o).startswith(str(x) + " ") or o == x]; c.sort(key=len, reverse=True)
    return c[0] if c else None
dk["h"] = dk.home_team.map(tshort); dk["a"] = dk.away_team.map(tshort)
dk = dk.dropna(subset=["h", "a"])
res = mg[["season", "homeTeam", "awayTeam", "homePoints", "awayPoints"]].dropna(subset=["homePoints"])
dk = dk.merge(res, left_on=["gseason", "h", "a"], right_on=["season", "homeTeam", "awayTeam"], how="inner")
dk["margin"] = dk.homePoints - dk.awayPoints            # home minus away
dk["tot_pts"] = dk.homePoints + dk.awayPoints
print(f"DK games matched: {len(dk)}  (seasons {sorted(dk.gseason.unique())})")

def dec(price): return 1 + (100 / -price if price < 0 else price / 100)

# ============================================================================================
# ATS helper: build one row per SIDE for spread bets. cover = 1 win, 0 loss, drop pushes.
# home covers if margin + spread_home > 0 ; away covers if -(margin) + spread_away > 0
# ============================================================================================
def ats_rows(df):
    r = []
    for _, x in df.iterrows():
        if pd.notna(x.spread_home) and pd.notna(x.spread_home_price):
            m = x.margin + x.spread_home
            if m != 0: r.append({"season": x.gseason, "side": "home", "line": x.spread_home,
                                  "price": x.spread_home_price, "cover": int(m > 0), "fav": x.spread_home < 0})
        if pd.notna(x.spread_home) and pd.notna(x.spread_away_price):
            sa = -x.spread_home
            m = -x.margin + sa
            if m != 0: r.append({"season": x.gseason, "side": "away", "line": sa,
                                  "price": x.spread_away_price, "cover": int(m > 0), "fav": sa < 0})
    return pd.DataFrame(r)
ats = ats_rows(dk)
ats["profit"] = np.where(ats.cover == 1, ats.price.map(dec) - 1, -1.0)

def rep(lbl, d, base_col="cover"):
    if len(d) < 30: return f"  {lbl:22s} n={len(d):4d}  (thin)"
    hit, roi = d[base_col].mean() * 100, d.profit.mean() * 100
    by = d.groupby("season").profit.mean()
    return f"  {lbl:22s} n={len(d):4d}  cover {hit:5.1f}%  ROI {roi:+6.1f}  +yrs {(by>0).sum()}/{by.notna().sum()}"

# (A) SPREAD-PRICE juice — does a shaded (more-negative-priced) side cover less?
print("\n" + "=" * 94); print("(A) SPREAD-PRICE juice: cover rate by how DK priced THAT side (shaded = public-heavy?)"); print("=" * 94)
for lo, hi, lbl in [(-104, 1e9, "cheap  (-104..+)"), (-110, -104, "std   (-110..-105)"),
                    (-116, -110, "juiced(-116..-111)"), (-1e9, -116, "heavy (<= -117)")]:
    rep_d = ats[(ats.price > lo) & (ats.price <= hi)]
    print(rep(lbl, rep_d))

# (B) SPREAD-LINE buckets — favorites of certain sizes; ATS cover. Analyze the FAVORITE side only (line<0).
print("\n" + "=" * 94); print("(B) FAVORITE spread-size buckets (does the fav COVER? key-number zones)"); print("=" * 94)
fav = ats[ats.fav].copy(); fav["absL"] = fav.line.abs()
FB = [(0, 3), (3, 3.5), (3.5, 6.5), (6.5, 7.5), (7.5, 10.5), (10.5, 14.5), (14.5, 21.5), (21.5, 100)]
for lo, hi in FB:
    d = fav[(fav.absL > lo) & (fav.absL <= hi)]
    print(rep(f"fav -{lo}..-{hi}", d))
print("  -- underdog side (getting the points):")
dog = ats[~ats.fav].copy(); dog["absL"] = dog.line.abs()
for lo, hi in [(0, 3), (3, 7), (7, 10.5), (10.5, 14.5), (14.5, 21.5), (21.5, 100)]:
    d = dog[(dog.absL > lo) & (dog.absL <= hi)]
    print(rep(f"dog +{lo}..+{hi}", d))

# (C) TOTAL-PRICE juice — over/under hit rate by how DK priced that side
print("\n" + "=" * 94); print("(C) TOTAL-PRICE juice: over/under hit by DK's price on THAT side"); print("=" * 94)
tr = []
for _, x in dk.iterrows():
    if pd.isna(x.total) or pd.isna(x.tot_pts) or x.tot_pts == x.total: continue
    if pd.notna(x.over_price):  tr.append({"season": x.gseason, "sd": "over",  "price": x.over_price,  "hit": int(x.tot_pts > x.total), "total": x.total})
    if pd.notna(x.under_price): tr.append({"season": x.gseason, "sd": "under", "price": x.under_price, "hit": int(x.tot_pts < x.total), "total": x.total})
tot = pd.DataFrame(tr); tot["profit"] = np.where(tot.hit == 1, tot.price.map(dec) - 1, -1.0)
for lo, hi, lbl in [(-104, 1e9, "cheap  (-104..+)"), (-110, -104, "std   (-110..-105)"),
                    (-116, -110, "juiced(-116..-111)"), (-1e9, -116, "heavy (<= -117)")]:
    d = tot[(tot.price > lo) & (tot.price <= hi)]
    print(rep(lbl, d, "hit"))
print("  -- OVER vs UNDER overall (public over-bias?):")
for sd in ["over", "under"]:
    print(rep(f"all {sd}s", tot[tot.sd == sd], "hit"))

# (D) TOTAL-LINE buckets — do certain total ranges go over/under? (bet the UNDER, report under-hit)
print("\n" + "=" * 94); print("(D) TOTAL-LINE buckets: UNDER hit-rate by posted total (are high/low totals biased?)"); print("=" * 94)
un = tot[tot.sd == "under"].copy()
for lo, hi in [(0, 44), (44, 48), (48, 52), (52, 56), (56, 60), (60, 200)]:
    d = un[(un.total > lo) & (un.total <= hi)]
    print(rep(f"total {lo}..{hi} UNDER", d, "hit"))

# (E) SPREAD × ML combined — for FAVORITES, does a steeper ML (relative to spread) predict ATS cover?
# For each fav game, compute the ML-implied margin vs the actual spread; bucket the "extra juice".
print("\n" + "=" * 94); print("(E) SPREAD × ML: favorite ATS cover, split by whether its ML is STEEP or SHORT for that spread"); print("=" * 94)
comb = []
for _, x in dk.iterrows():
    if pd.isna(x.spread_home) or x.spread_home == 0 or pd.isna(x.home_ml) or pd.isna(x.away_ml): continue
    # favorite = negative spread side
    if x.spread_home < 0:
        fline, fml, fmarg = x.spread_home, x.home_ml, x.margin
    else:
        fline, fml, fmarg = -x.spread_home, x.away_ml, -x.margin
    if fml >= 0: continue                          # want an actual ML favorite
    cov = fmarg + fline
    if cov == 0: continue
    impp = (-fml) / (-fml + 100)                   # ML-implied win prob of the fav
    comb.append({"season": x.gseason, "absL": abs(fline), "fml": fml, "impp": impp,
                 "cover": int(cov > 0), "price": x.spread_home_price if x.spread_home < 0 else x.spread_away_price})
cb = pd.DataFrame(comb); cb["profit"] = np.where(cb.cover == 1, cb.price.fillna(-110).map(dec) - 1, -1.0)
# within each spread bucket, is a HIGH ML-implied prob (steep price) a better/worse ATS cover?
print("  For favorites, split each spread bucket by ML-implied win prob (steep vs short ML):")
for lo, hi in [(2.5, 4.5), (4.5, 7.5), (7.5, 11), (11, 17.5), (17.5, 100)]:
    b = cb[(cb.absL > lo) & (cb.absL <= hi)]
    if len(b) < 60:
        print(f"  spread -{lo}..-{hi:>4}: n={len(b)} (thin)"); continue
    med = b.impp.median()
    steep, shortp = b[b.impp >= med], b[b.impp < med]
    print(f"  spread -{lo}..-{hi:<4} (median ML-impl {med*100:.0f}%):")
    print(rep("    steep ML (>=med)", steep))
    print(rep("    short ML (<med)", shortp))

ats.to_parquet("data/dk_ats_sides.parquet", index=False)
tot.to_parquet("data/dk_total_sides.parquet", index=False)
print("\nsaved data/dk_ats_sides.parquet + data/dk_total_sides.parquet")
