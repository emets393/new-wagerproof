"""
Conference-specific totals analysis + day-of-week (MACtion).
Historical view: 2016-2025 vs CLOSE (longer sample). Bettable view: 2021-2025 vs OPEN.
"""
import os
import numpy as np
import pandas as pd

HERE = os.path.dirname(os.path.abspath(__file__))
gm = pd.read_parquet(os.path.join(HERE, "data", "model_games.parquet"))
gm["dow"] = pd.to_datetime(gm["date"], utc=True, errors="coerce").dt.dayofweek  # 0=Mon..6=Sun
DOW = {0: "Mon", 1: "Tue", 2: "Wed", 3: "Thu", 4: "Fri", 5: "Sat", 6: "Sun"}
def roi(h, n): return (h * 0.909 - (n - h)) / n * 100 if n else 0.0

# historical (close, 2016-25) and bettable (open, 2021-25)
H = gm[gm["total_close"].notna() & gm["actual_total"].notna()].copy()
H = H[H["actual_total"] != H["total_close"]]; H["over"] = (H["actual_total"] > H["total_close"]).astype(int)
O = gm[gm["total_open"].notna() & gm["actual_total"].notna() & (gm["season"] >= 2021)].copy()
O = O[O["actual_total"] != O["total_open"]]; O["over"] = (O["actual_total"] > O["total_open"]).astype(int)
print(f"hist(vs close 2016-25) base over {100*H.over.mean():.1f}% n={len(H)} | bettable(vs open 2021-25) base {100*O.over.mean():.1f}% n={len(O)}")

# ---- 1) DAY OF WEEK (MACtion) ----
print("\n=== DAY OF WEEK (vs close, 2016-25) ===")
for d in [1, 2, 3, 4, 5]:
    b = H[H["dow"] == d]; n = len(b)
    if n >= 30:
        print(f"  {DOW[d]:<4} n={n:<4} over={100*b.over.mean():4.1f}% avgTot={b.actual_total.mean():4.1f} line={b.total_close.mean():4.1f}")
# weekday (Tue-Thu) late season
wd = H[(H["dow"].isin([1, 2, 3])) & (H["week"] >= 9)]
print(f"  Tue-Thu & wk>=9 (MACtion): n={len(wd)} over={100*wd.over.mean():.1f}% avgTot={wd.actual_total.mean():.1f}")
mac_wd = wd[(wd.homeConference == "Mid-American") | (wd.awayConference == "Mid-American")]
print(f"  MAC Tue-Thu wk>=9:         n={len(mac_wd)} over={100*mac_wd.over.mean():.1f}% avgTot={mac_wd.actual_total.mean():.1f}")

# ---- 2) INTRA-CONFERENCE games by conference (both teams same conf) ----
print("\n=== INTRA-CONFERENCE over-rate (both teams same conf) ===")
print(f"{'conference':<20}{'histN':>7}{'histOv%':>9}{'avgTot':>8}{'openN':>7}{'openOv%':>9}")
intra_H = H[H.homeConference == H.awayConference]
intra_O = O[O.homeConference == O.awayConference]
for conf in sorted(intra_H.homeConference.dropna().unique()):
    bh = intra_H[intra_H.homeConference == conf]
    if len(bh) < 60:
        continue
    bo = intra_O[intra_O.homeConference == conf]
    ov_o = f"{100*bo.over.mean():.1f}" if len(bo) >= 40 else "  --"
    print(f"{conf:<20}{len(bh):>7}{100*bh.over.mean():>8.1f}{bh.actual_total.mean():>8.1f}{len(bo):>7}{ov_o:>9}")

# ---- 3) bettable conference spots vs OPEN, per-season ----
print("\n=== INTRA-CONF vs OPEN (2021-25), bettable, per-season ===")
TS = [2021, 2022, 2023, 2024, 2025]
for conf in sorted(intra_O.homeConference.dropna().unique()):
    b = intra_O[intra_O.homeConference == conf]; n = len(b)
    if n < 60:
        continue
    h = int(b.over.sum()); per = "/".join(f"{100*b.over[b.season==s].mean():.0f}" if (b.season==s).sum()>=8 else "--" for s in TS)
    flag = " <<" if abs(100*h/n - 48) >= 4 else ""
    print(f"  {conf:<20} n={n:<4} over={100*h/n:4.1f}% roi={roi(h,n):+5.1f}  [{per}]{flag}")
