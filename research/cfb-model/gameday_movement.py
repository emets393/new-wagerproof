"""
College GameDay LINE MOVEMENT analysis. GameDay = peak public attention -> public inflates the marquee favorite
and the over -> FADE the move / bet the under. Matches GameDay games (gameday_raw.txt) to movement_windows
(2021-25 only). Promising + mechanism-backed but small n (~55-94) -> track live, sample grows ~13 games/yr.
"""
import os, re
import numpy as np
import pandas as pd

HERE = os.path.dirname(os.path.abspath(__file__))
gm = pd.read_parquet(os.path.join(HERE, "data", "model_games.parquet"))
mw = pd.read_parquet(os.path.join(HERE, "data", "movement_windows.parquet"))
cfbd = sorted(set(gm.homeTeam) | set(gm.awayTeam), key=len, reverse=True)
ALIAS = {"Appalachian State": "App State"}
def to_db(s):
    s = re.sub(r"^\d+\s+", "", s.strip())
    for a, b in ALIAS.items():
        if s.startswith(a): return b
    for t in cfbd:
        if s == t or s.startswith(t + " "): return t
    return None

rows = []; season = None
for ln in open(os.path.join(HERE, "data", "gameday", "gameday_raw.txt")):
    ln = ln.strip(); m = re.match(r"^(\d{4}) season$", ln)
    if m: season = int(m.group(1)); continue
    if "|" not in ln: continue
    p = [x.strip() for x in ln.split("|")]
    if len(p) < 5: continue
    v, h = to_db(p[1]), to_db(p[3])
    if v and h: rows.append({"season": season, "pk": "|".join(sorted([v, h]))})
G = pd.DataFrame(rows)
mw["pk"] = ["|".join(sorted([h, a])) for h, a in zip(mw.home, mw.away)]
M = G.merge(mw, on=["season", "pk"], how="inner").dropna(subset=["sp_open", "sp_close", "actual_margin"])
M = M[(M.actual_margin + M.sp_close) != 0]
M["home_cover"] = (M.actual_margin + M.sp_close) > 0
M["sp_move"] = M.sp_close - M.sp_open       # <0 = line moved toward HOME
M["tot_move"] = M.tot_close - M.tot_open
M["over"] = M.actual_total > M.tot_close
print(f"GameDay games with movement (2021-25): {len(M)} | mean |spread move| {M.sp_move.abs().mean():.2f}")

print("\n=== SPREAD: FADE the line move (public-hype fade) ===")
moved = M[M.sp_move.abs() >= 0.5]
follow = pd.concat([moved[moved.sp_move < 0].home_cover, 1 - moved[moved.sp_move > 0].home_cover])
print(f"  follow-move {100*follow.mean():.1f}% | FADE-move {100*(1-follow.mean()):.1f}% (n={len(follow)})")
ta = moved[moved.sp_move > 0]
print(f"  line moved toward AWAY (n={len(ta)}): away covered {100*(1-ta.home_cover).mean():.1f}% -> fade hard (bet home)")
for lo, hi in [(0.5, 1), (1, 2), (2, 99)]:
    b = M[(M.sp_move.abs() >= lo) & (M.sp_move.abs() < hi)]
    if len(b) >= 8:
        fol = np.where(b.sp_move < 0, b.home_cover, 1 - b.home_cover)
        print(f"  move {lo}-{hi}: n={len(b)} fade-move covers {100*(1-fol.mean()):.1f}%")

print("\n=== TOTALS: GameDay -> UNDER (public over-bias) ===")
tm = M.dropna(subset=["tot_open", "tot_close"]); tm = tm[tm.actual_total != tm.tot_close]
up = tm[tm.tot_move >= 1]; dn = tm[tm.tot_move <= -1]
print(f"  overall over% {100*tm.over.mean():.1f}% (UNDER {100*(1-tm.over).mean():.1f}%) n={len(tm)}")
print(f"  total moved UP (n={len(up)}): over {100*up.over.mean():.1f}% (fade-up -> under {100*(1-up.over).mean():.1f}%)")
print(f"  total moved DOWN (n={len(dn)}): under {100*(1-dn.over).mean():.1f}%")
