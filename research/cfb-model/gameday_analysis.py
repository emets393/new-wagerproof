"""
College GameDay analysis. Parse gameday_raw.txt (regular-season FBS games), map team names to the DB, join to
model_games for spread/total/result/ranks/kick-time. Then: home vs away ATS cover, both-ranked vs one, night/day,
over/under, away-cover streaks, and first-GameDay-of-season factors. Trend lens (frequency + per-season), small n.
"""
import os, re
import numpy as np
import pandas as pd

HERE = os.path.dirname(os.path.abspath(__file__))
gm = pd.read_parquet(os.path.join(HERE, "data", "model_games.parquet"))
cfbd = sorted(set(gm.homeTeam) | set(gm.awayTeam), key=len, reverse=True)
ALIAS = {"Appalachian State": "App State"}
def to_db(s):
    s = re.sub(r"^\d+\s+", "", s.strip())                 # strip leading AP rank
    for a, b in ALIAS.items():
        if s.startswith(a): return b
    for t in cfbd:
        if s == t or s.startswith(t + " "): return t
    return None

rows = []; season = None
for ln in open(os.path.join(HERE, "data", "gameday", "gameday_raw.txt")):
    ln = ln.strip()
    m = re.match(r"^(\d{4}) season$", ln)
    if m: season = int(m.group(1)); continue
    if "|" not in ln: continue
    p = [x.strip() for x in ln.split("|")]
    if len(p) < 5: continue
    vis, host = to_db(p[1]), to_db(p[3])
    rows.append({"season": season, "show_date": p[0], "vis_raw": p[1], "host_raw": p[3], "vis": vis, "host": host})
G = pd.DataFrame(rows)
unmatched = G[G.vis.isna() | G.host.isna()]
if len(unmatched): print("UNMATCHED:", unmatched[["vis_raw", "host_raw"]].values.tolist())
G = G.dropna(subset=["vis", "host"])
G["show_dt"] = pd.to_datetime(G.show_date, errors="coerce")

# join by team-pair, then DEDUPE by date proximity — same pair can play twice in a season
# (e.g. 2024 Georgia-Texas wk8 + SEC CG); pair-only merge double-matches. Keep the game closest to the show date.
gm["pk"] = ["|".join(sorted([h, a])) for h, a in zip(gm.homeTeam, gm.awayTeam)]
G["pk"] = ["|".join(sorted([v, h])) for v, h in zip(G.vis, G.host)]
M = G[["season", "pk", "show_dt"]].merge(gm, on=["season", "pk"], how="inner")
M["dd"] = (pd.to_datetime(M.date, errors="coerce").dt.tz_localize(None) - M.show_dt).abs()
M = M.sort_values("dd").drop_duplicates(["season", "pk", "show_dt"], keep="first")
M = M[M.dd <= pd.Timedelta(days=3)]
print(f"\nGameDay games parsed: {len(G)} | matched to model_games: {len(M)} ({len(M)/len(G)*100:.0f}%)")
M = M[M.spread_close.notna() & M.actual_margin.notna()].copy()
M = M[(M.actual_margin + M.spread_close) != 0]
M["home_cover"] = (M.actual_margin + M.spread_close) > 0
M["over"] = M.actual_total > M.total_close
M["both_ranked"] = (M.home_self_rank_is == 1) & (M.away_self_rank_is == 1)
M["neutral"] = M.neutralSite.astype(bool)
TS = sorted(M.season.unique())
def ps(b, col): return "/".join(f"{100*b[col][b.season==s].mean():.0f}" if (b.season==s).sum()>=3 else "--" for s in TS)

print(f"graded GameDay games: {len(M)} | neutral-site: {M.neutral.sum()}\n")
print("=== HOME vs AWAY ATS (exclude neutral) ===")
nn = M[~M.neutral]
print(f"  HOME cover {100*nn.home_cover.mean():.1f}% ({nn.home_cover.sum()}-{len(nn)-nn.home_cover.sum()}) | AWAY cover {100*(1-nn.home_cover).mean():.1f}% | n={len(nn)}")
print(f"  per-season HOMEcov: [{ps(nn,'home_cover')}]")
print("\n=== BOTH RANKED vs ONE RANKED (home cover, non-neutral) ===")
print(f"  both ranked: HOME {100*nn[nn.both_ranked].home_cover.mean():.1f}% n={len(nn[nn.both_ranked])} | one ranked: HOME {100*nn[~nn.both_ranked].home_cover.mean():.1f}% n={len(nn[~nn.both_ranked])}")
print("\n=== NIGHT vs DAY (home cover + over) ===")
M["night"] = M.kick_hour_et >= 18
for lab, b in [("NIGHT(>=6pm)", M[M.night]), ("DAY(<6pm)", M[~M.night])]:
    print(f"  {lab:<12} HOMEcov {100*b.home_cover.mean():.1f}% | OVER {100*b.over.mean():.1f}% | n={len(b)}")
print("\n=== OVER/UNDER (all GameDay) ===")
ov = M[M.actual_total != M.total_close]
print(f"  OVER {100*ov.over.mean():.1f}% ({ov.over.sum()}-{len(ov)-ov.over.sum()}) n={len(ov)} | per-season [{ps(ov,'over')}]")
print("\n=== AWAY-COVER STREAKS (chronological) ===")
M2 = M.sort_values(["season", "week"]); aw = (1 - M2.home_cover).tolist()
mx = cur = 0
for x in aw:
    cur = cur + 1 if x == 1 else 0; mx = max(mx, cur)
runs = []; cur = 0
for x in aw:
    if x == 1: cur += 1
    else:
        if cur: runs.append(cur)
        cur = 0
if cur: runs.append(cur)
from collections import Counter
print(f"  longest away-cover streak: {mx} | streak-length counts: {dict(Counter(runs))}")
