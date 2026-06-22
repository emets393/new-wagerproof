"""
QB-availability edge test. Detect when a team starts a NON-established QB (backup/change),
and test whether the market underprices it: fade the backup team ATS, and UNDER the total.

established starter entering week W = QB with most cumulative attempts in weeks 1..W-1 (leak-safe).
backup_start = week-W primary passer != established starter (real change, both >= some attempts).
Bet/grade vs OPEN, 2021-2025, per-season.
NOTE: detection uses actual starter (post-game). Live betting needs the starter known pregame —
usually available in CFB (depth charts/injury news); the edge is the market being SLOW to price it.
"""
import os
import numpy as np
import pandas as pd

HERE = os.path.dirname(os.path.abspath(__file__))
qb = pd.read_parquet(os.path.join(HERE, "data", "cfbd", "qb_starts.parquet"))
qb = qb.sort_values(["team", "season", "week"])

# established starter entering each week: cumulative attempts by QB through prior weeks
def established(group):
    out = []
    cum = {}  # qb -> attempts so far (prior weeks)
    for _, r in group.iterrows():
        est = max(cum, key=cum.get) if cum else None
        out.append(est)
        cum[r["qb"]] = cum.get(r["qb"], 0) + r["att"]
    group = group.copy(); group["established"] = out
    return group
qb = qb.groupby(["team", "season"], group_keys=False).apply(established)
# cumulative attempts of the established starter (to require a real starter exists)
qb["is_backup_start"] = ((qb["established"].notna()) & (qb["qb"] != qb["established"])
                         & (qb["att"] >= 10)).astype(int)

gm = pd.read_parquet(os.path.join(HERE, "data", "model_games.parquet"))
df = gm[gm.spread_open.notna() & gm.actual_margin.notna() & (gm.season >= 2021)].copy()
df["home_cover"] = (df.actual_margin + df.spread_open) > 0
df["over"] = (df.actual_total > df.total_open).astype(int)
TS = [2021, 2022, 2023, 2024, 2025]
def roi(h, n): return (h * 0.909 - (n - h)) / n * 100 if n else 0.0

# merge backup flag for home & away
b = qb[["season", "week", "team", "is_backup_start"]]
for side in ["homeTeam", "awayTeam"]:
    df = df.merge(b.rename(columns={"team": side, "is_backup_start": f"{side[:4]}_bk"}),
                  on=["season", "week", side], how="left")
df["home_bk"] = df["home_bk"].fillna(0); df["away_bk"] = df["away_bk"].fillna(0)
df["either_bk"] = ((df.home_bk + df.away_bk) >= 1).astype(int)

print(f"games: {len(df)} | backup-start games: home {int(df.home_bk.sum())} away {int(df.away_bk.sum())} either {int(df.either_bk.sum())}")

# ATS: fade the backup team (bet its opponent)
print("\n=== ATS: FADE the backup-QB team (bet opponent) vs open ===")
def ats_fade_backup():
    # home backup -> bet away ; away backup -> bet home ; skip if both
    m = (df.home_bk == 1) ^ (df.away_bk == 1)
    b2 = df[m].copy()
    bet_home = b2.away_bk == 1  # fade the away backup => bet home
    hit = np.where(bet_home, b2.home_cover, ~b2.home_cover)
    n = len(b2); h = int(hit.sum())
    per = "/".join(f"{100*np.where(b2.away_bk[b2.season==s]==1, b2.home_cover[b2.season==s], ~b2.home_cover[b2.season==s]).mean():.0f}" if (b2.season==s).sum()>=8 else "--" for s in TS)
    print(f"  fade backup ATS: n={n} hit={100*h/n if n else 0:.1f}% roi={roi(h,n):+.1f}  [{per}]")
ats_fade_backup()

# TOTALS: backup -> under
print("\n=== TOTALS: UNDER when a backup QB starts (either team) vs open ===")
for label, m in [("either backup -> UNDER", df.either_bk == 1),
                 ("backup & open total>=50 -> UNDER", (df.either_bk == 1) & (df.total_open >= 50))]:
    bb = df[m.fillna(False)]; bb = bb[bb.actual_total != bb.total_open]
    n = len(bb); h = int((bb.over == 0).sum())
    per = "/".join(f"{100*(bb.over==0)[bb.season==s].mean():.0f}" if (bb.season==s).sum()>=6 else "--" for s in TS)
    print(f"  {label:<36} n={n:<4} under={100*h/n if n else 0:.1f}% roi={roi(h,n):+.1f}  [{per}]")
