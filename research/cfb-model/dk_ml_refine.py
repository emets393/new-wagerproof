"""Refinement pass on the DK-specific CFB moneyline study (reads data/dk_ml_sides.parquet is NOT enough — it
dropped home/away, so rebuild sides here WITH location). Three digs the user's request implies:
  (1) home vs away split of every band (favorite-longshot bias often lives on one side of the field),
  (2) finer 10-cent bands to test whether the interesting cells are MONOTONE (durable) or one-off (vig/noise),
  (3) the +140..165 dog dip that sits between two overperforming dog bands — real, or a scan artifact?
Everything graded at the exact DK closing number, 2021-25, per-season shown. DK only, never consensus."""
import glob, numpy as np, pandas as pd, warnings
warnings.filterwarnings("ignore")

oh = pd.concat([pd.read_parquet(f) for f in sorted(glob.glob("data/odds_history/odds_20*.parquet"))], ignore_index=True)
dk = oh[(oh.book == "draftkings") & oh.home_ml.notna() & oh.away_ml.notna()].copy()
ct = pd.to_datetime(dk.commence_time, utc=True, errors="coerce")
dk["gseason"] = np.where(ct.dt.month >= 7, ct.dt.year, ct.dt.year - 1)
dk = dk[(dk.gseason >= 2021) & (dk.gseason <= 2025) & (dk.hrs_to_kick <= 24)]
dk = dk.sort_values("hrs_to_kick").groupby("game_id", as_index=False).first()

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

def dec(ml): return 1 + (100 / -ml if ml < 0 else ml / 100)
def implied(ml): return (-ml) / (-ml + 100) if ml < 0 else 100 / (ml + 100)
rows = []
for _, r in dk.iterrows():
    rows.append({"season": r.gseason, "ml": r.home_ml, "won": r.home_won, "hoa": "home"})
    rows.append({"season": r.gseason, "ml": r.away_ml, "won": 1 - r.home_won, "hoa": "away"})
s = pd.DataFrame(rows)
s["dec"] = s.ml.map(dec); s["imp"] = s.ml.map(implied)
s["profit"] = np.where(s.won == 1, s.dec - 1, -1.0)

def line(lbl, d):
    if len(d) < 25: return f"  {lbl:20s} n={len(d):4d}  (thin)"
    win, imp, roi = d.won.mean(), d.imp.mean(), d.profit.mean() * 100
    by = d.groupby("season").profit.mean()
    return (f"  {lbl:20s} n={len(d):4d}  win {win*100:5.1f}% vs imp {imp*100:5.1f}% ({(win-imp)*100:+4.1f}pp) "
            f"ROI {roi:+6.1f}  +yrs {(by>0).sum()}/{by.notna().sum()}")

def cell(lo, hi):  # ml in (lo, hi]  works for neg and pos since we pass ordered bounds
    return s[(s.ml > lo) & (s.ml <= hi)]

print(f"DK sides: {len(s)} ({len(dk)} games, 2021-25)\n")

# (1) home vs away split — dog value bands + the whole favorite ladder
print("=" * 92); print("(1) HOME vs AWAY — dog value bands"); print("=" * 92)
for lbl, lo, hi in [("+120..140", 120, 140), ("+140..165", 140, 165), ("+165..200", 165, 200)]:
    b = cell(lo, hi)
    print(f" {lbl}")
    print(line("   home dog", b[b["hoa"] == "home"]))
    print(line("   away dog", b[b["hoa"] == "away"]))

print("\n" + "=" * 92); print("(1b) HOME vs AWAY — favorite bands that underperformed most"); print("=" * 92)
for lbl, lo, hi in [("-140..-120", -140, -120), ("-165..-140", -165, -140), ("-250..-200", -250, -200)]:
    b = cell(lo, hi)
    print(f" {lbl}")
    print(line("   home fav", b[b["hoa"] == "home"]))
    print(line("   away fav", b[b["hoa"] == "away"]))

# (2) finer 10-cent sweep across the dog ladder to test monotonicity
print("\n" + "=" * 92); print("(2) FINE 10-cent DOG sweep (is the value monotone or one-off?)"); print("=" * 92)
edges = [100, 110, 120, 130, 140, 150, 160, 170, 180, 190, 200, 225, 250, 300, 350]
for lo, hi in zip(edges[:-1], edges[1:]):
    print(line(f"+{lo}..{hi}", cell(lo, hi)))

print("\n" + "=" * 92); print("(2b) FINE 10-cent FAVORITE sweep"); print("=" * 92)
fedges = [-110, -120, -130, -140, -150, -160, -175, -200, -225, -250, -300, -350, -450, -600]
for hi, lo in zip(fedges[:-1], fedges[1:]):  # lo<hi, both negative
    print(line(f"{lo}..{hi}", cell(lo, hi)))

# (3) the +140..165 dip vs its neighbors, per season, to judge if it's structural
print("\n" + "=" * 92); print("(3) +140..165 dog dip — per-season win% (is the dip in every year or one crash?)"); print("=" * 92)
for lbl, lo, hi in [("+120..140", 120, 140), ("+140..165", 140, 165), ("+165..200", 165, 200)]:
    b = cell(lo, hi)
    g = b.groupby("season").agg(n=("won", "size"), win=("won", "mean"), roi=("profit", "mean"))
    yrs = "  ".join(f"{int(y)}:{r.win*100:.0f}%({int(r.n)})" for y, r in g.iterrows())
    print(f" {lbl:12s} {yrs}")
