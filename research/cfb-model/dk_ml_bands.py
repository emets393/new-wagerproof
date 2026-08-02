"""DraftKings-SPECIFIC full-game moneyline calibration for CFB (NOT consensus). For each DK closing ML band,
does the side hit ABOVE or BELOW its DK-implied probability, and what's the flat-bet ROI? Favorites and
underdogs analyzed separately, fine bands, per-season. 2021-25. Grade = did the team win outright, priced at
the exact DK number. This is the MLB-style 'certain odds bands don't hit / dogs overperform' dig for CFB."""
import glob, numpy as np, pandas as pd, warnings
warnings.filterwarnings("ignore")

# DK closing ML per game (closest-to-kick snapshot with a captured close)
oh = pd.concat([pd.read_parquet(f) for f in sorted(glob.glob("data/odds_history/odds_20*.parquet"))], ignore_index=True)
dk = oh[(oh.book == "draftkings") & oh.home_ml.notna() & oh.away_ml.notna()].copy()
# NOTE: the `season` column is mislabeled (all 2026 — fetch stamp). Derive the real CFB season from commence_time.
ct = pd.to_datetime(dk.commence_time, utc=True, errors="coerce")
dk["gseason"] = np.where(ct.dt.month >= 7, ct.dt.year, ct.dt.year - 1)
dk = dk[(dk.gseason >= 2021) & (dk.gseason <= 2025)]
dk = dk[dk.hrs_to_kick <= 24]                                  # a real pre-kick close (drop far-out futures)
dk = dk.sort_values("hrs_to_kick").groupby("game_id", as_index=False).first()   # closest to kickoff = close

# team-name bridge: DK full names -> model_games short names
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
dk["home_won"] = (dk.homePoints > dk.awayPoints).astype(int)
print(f"DK games matched w/ results: {len(dk)}  (seasons {sorted(dk.gseason.unique())})")

# one row per SIDE (favorite + underdog) with its DK ML + win
def dec(ml): return 1 + (100 / -ml if ml < 0 else ml / 100)
def implied(ml): return (-ml) / (-ml + 100) if ml < 0 else 100 / (ml + 100)
rows = []
for _, r in dk.iterrows():
    for ml, won in [(r.home_ml, r.home_won), (r.away_ml, 1 - r.home_won)]:
        rows.append({"season": r.gseason, "ml": ml, "won": won, "dec": dec(ml), "imp": implied(ml)})
s = pd.DataFrame(rows)
s["profit"] = np.where(s.won == 1, s.dec - 1, -1)

# ── favorite bands (negative ML) ──
FAV = [(-120, -110), (-140, -120), (-165, -140), (-200, -165), (-250, -200), (-350, -250), (-600, -350), (-1e9, -600)]
DOG = [(100, 120), (120, 140), (140, 165), (165, 200), (200, 250), (250, 350), (350, 600), (600, 1e9)]
def band(lbl, lo, hi):
    d = s[(s.ml > lo) & (s.ml <= hi)] if lo < hi and hi <= 0 else s[(s.ml >= lo) & (s.ml < hi)]
    if len(d) < 30: return f"  {lbl:14s} n={len(d):4d} (thin)"
    win, imp, roi = d.won.mean(), d.imp.mean(), d.profit.mean() * 100
    by = d.groupby("season").profit.mean()
    edge = (win - imp) * 100
    return (f"  {lbl:14s} n={len(d):4d}  win {win*100:5.1f}%  vs implied {imp*100:5.1f}%  ({edge:+4.1f}pp)  "
            f"ROI {roi:+6.1f}  +seasons {(by>0).sum()}/{by.notna().sum()}")

print("\n" + "=" * 96); print("FAVORITES by DK closing ML band  (win% vs DK-implied%, flat-bet ROI on the FAVORITE)"); print("=" * 96)
for lo, hi in FAV: print(band(f"{int(hi)}..{int(lo) if lo>-1e8 else '−∞'}", lo, hi))
print("\n" + "=" * 96); print("UNDERDOGS by DK closing ML band  (flat-bet ROI on the DOG)"); print("=" * 96)
for lo, hi in DOG: print(band(f"+{int(lo)}..{int(hi) if hi<1e8 else '∞'}", lo, hi))

# favorite-longshot check: overall fav vs dog ROI
print("\n" + "=" * 96); print("OVERALL (DK close): favorites vs underdogs"); print("=" * 96)
for lbl, d in [("all favorites", s[s.ml < 0]), ("all underdogs", s[s.ml > 0])]:
    by = d.groupby("season").profit.mean()
    print(f"  {lbl:14s} n={len(d):5d}  win {d.won.mean()*100:5.1f}%  ROI {d.profit.mean()*100:+6.1f}  +seasons {(by>0).sum()}/{by.notna().sum()}")
s.to_parquet("data/dk_ml_sides.parquet", index=False)
