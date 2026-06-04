"""
'Trappy line' test: recent scoring FORM vs the posted total.
form_total = avg of both teams' recent GAME totals (pf+pa); gap = form_total - open_total.
gap >> 0 = teams scoring way more than the line (line looks too LOW -> over?).
gap << 0 = teams scoring way less than the line (line looks too HIGH -> under?).
Test FOLLOW vs FADE the gap (markets often overreact to recent scores). Grade vs OPEN, 2021-25.
Windows: last-3 (recent form) and season-to-date (scoring identity). All leak-safe (prior games only).
"""
import os
import numpy as np
import pandas as pd

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "data", "cfbd")
YEARS = [2016, 2017, 2018, 2019, 2021, 2022, 2023, 2024, 2025]
TS = [2021, 2022, 2023, 2024, 2025]

# team-game sequence with game total
rows = []
for y in YEARS:
    g = pd.read_parquet(os.path.join(DATA, f"games_{y}.parquet"))
    g = g[(g.seasonType == "regular") & g.homePoints.notna() & g.awayPoints.notna()]
    for _, r in g.iterrows():
        gt = r["homePoints"] + r["awayPoints"]
        for who in ("home", "away"):
            rows.append({"season": y, "week": int(r["week"]), "team": r[f"{who}Team"], "game_total": gt})
tg = pd.DataFrame(rows).sort_values(["team", "season", "week"])
gb = tg.groupby(["team", "season"], group_keys=False)
tg["last3_total"] = gb["game_total"].transform(lambda s: s.shift(1).rolling(3, min_periods=3).mean())
tg["s2d_total"] = gb["game_total"].transform(lambda s: s.shift(1).expanding(min_periods=2).mean())

gm = pd.read_parquet(os.path.join(HERE, "data", "model_games.parquet"))
df = gm[gm.total_open.notna() & gm.actual_total.notna() & (gm.season >= 2021)].copy()
df = df[df.actual_total != df.total_open]; df["over"] = (df.actual_total > df.total_open).astype(int)
for side in ["homeTeam", "awayTeam"]:
    df = df.merge(tg[["season", "week", "team", "last3_total", "s2d_total"]].rename(
        columns={"team": side, "last3_total": f"{side[:4]}_l3", "s2d_total": f"{side[:4]}_s2d"}),
        on=["season", "week", side], how="left")
df["form_l3"] = (df["home_l3"] + df["away_l3"]) / 2
df["form_s2d"] = (df["home_s2d"] + df["away_s2d"]) / 2
df["gap_l3"] = df["form_l3"] - df["total_open"]
df["gap_s2d"] = df["form_s2d"] - df["total_open"]

def roi(h, n): return (h * 0.909 - (n - h)) / n * 100 if n else 0.0
def over_at(mask):
    b = df[mask.fillna(False)]; n = len(b); h = int(b.over.sum())
    return n, (100*h/n if n else 0)

for win, gapcol in [("LAST-3", "gap_l3"), ("SEASON-TO-DATE", "gap_s2d")]:
    print(f"\n=== {win} form gap (form_total - open). over-rate by gap bin (vs open) ===")
    print(f"{'gap bin':>14}{'n':>6}{'over%':>8}{'FOLLOW hit%':>13}{'roi':>7}  per-season(over%)")
    g = df[gapcol]
    bins = [(-99, -10), (-10, -5), (-5, -2), (-2, 2), (2, 5), (5, 10), (10, 99)]
    for lo, hi in bins:
        m = (g >= lo) & (g < hi)
        b = df[m.fillna(False)]; n = len(b)
        if n < 30:
            continue
        ov = 100 * b.over.mean()
        # FOLLOW: bet over if gap>0 else under
        follow_hit = b.over if hi <= 0 is False else None
        if (lo + hi) / 2 > 0:   # positive gap -> follow=over
            fh = int(b.over.sum())
        else:                    # negative gap -> follow=under
            fh = int((b.over == 0).sum())
        per = "/".join(f"{100*b.over[b.season==s].mean():.0f}" if (b.season==s).sum()>=8 else "--" for s in TS)
        print(f"{f'[{lo},{hi})':>14}{n:>6}{ov:>8.1f}{100*fh/n:>13.1f}{roi(fh,n):>7.1f}  [{per}]")

# extreme trap conditions (both teams consistent + big gap)
print("\n=== EXTREME 'trappy' conditions (vs open) ===")
for name, m, follow in [
    ("L3 form >> line (gap>=8) -> OVER", df.gap_l3 >= 8, "over"),
    ("L3 form << line (gap<=-8) -> UNDER", df.gap_l3 <= -8, "under"),
    ("S2D form >> line (gap>=7) -> OVER", df.gap_s2d >= 7, "over"),
    ("S2D form << line (gap<=-7) -> UNDER", df.gap_s2d <= -7, "under"),
    ("both agree >>line (l3&s2d>=6) OVER", (df.gap_l3 >= 6) & (df.gap_s2d >= 6), "over"),
    ("both agree <<line (l3&s2d<=-6) UNDER", (df.gap_l3 <= -6) & (df.gap_s2d <= -6), "under"),
]:
    b = df[m.fillna(False)]; n = len(b)
    if n < 25:
        print(f"  {name:<40} n={n} (thin)"); continue
    hit = int(b.over.sum()) if follow == "over" else int((b.over == 0).sum())
    per = "/".join(f"{100*(b.over if follow=='over' else 1-b.over)[b.season==s].mean():.0f}" if (b.season==s).sum()>=6 else "--" for s in TS)
    print(f"  {name:<40} n={n:<4} FOLLOW {100*hit/n:4.1f}% roi={roi(hit,n):+5.1f}  [{per}]")
