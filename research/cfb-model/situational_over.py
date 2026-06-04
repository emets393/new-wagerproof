"""
Emotional-state + look-ahead situational spots and their effect on the TOTAL.
Bet direction tested both ways; grade vs OPEN, 2021-2025, FP-controlled, per-season + vs close.

Spots (per team, applied as "either team in the spot"):
  - off OT loss / close loss (<=3) / blowout loss / home loss to a ranked team
  - ranked team upset by an unranked team last week (embarrassment bounce-back)
  - look-ahead: current opp unranked but NEXT opp ranked (trap)
Plus week-1 (opener) and week-13 (rivalry week) checks.
"""
import os
import numpy as np
import pandas as pd

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "data", "cfbd")
YEARS = [2016, 2017, 2018, 2019, 2021, 2022, 2023, 2024, 2025]
TS = [2021, 2022, 2023, 2024, 2025]

# ranked lookup (AP, entering week)
rk = pd.read_parquet(os.path.join(DATA, "rankings_weekly.parquet")).rename(columns={"year": "season"})
rk = rk[rk.poll == "AP Top 25"]
ranked = set(zip(rk.season, rk.asof_week, rk.team))

# team-game sequence
rows = []
for y in YEARS:
    g = pd.read_parquet(os.path.join(DATA, f"games_{y}.parquet"))
    g = g[(g.seasonType == "regular") & g.homePoints.notna() & g.awayPoints.notna()]
    for _, r in g.iterrows():
        def _len(x):
            try:
                return len(x) if x is not None else 0
            except Exception:
                return 0
        ot = 1 if max(_len(r["homeLineScores"]), _len(r["awayLineScores"])) > 4 else 0
        for who, opp in (("home", "away"), ("away", "home")):
            rows.append({"season": y, "week": int(r["week"]), "team": r[f"{who}Team"], "opp": r[f"{opp}Team"],
                         "is_home": 1 if who == "home" else 0,
                         "pf": r[f"{who}Points"], "pa": r[f"{opp}Points"], "ot": ot})
tg = pd.DataFrame(rows)
tg["won"] = (tg.pf > tg.pa).astype(int)
tg["margin"] = tg.pf - tg.pa
tg["opp_ranked"] = [1 if (s, w, o) in ranked else 0 for s, w, o in zip(tg.season, tg.week, tg.opp)]
tg["self_ranked"] = [1 if (s, w, t) in ranked else 0 for s, w, t in zip(tg.season, tg.week, tg.team)]
tg = tg.sort_values(["team", "season", "week"])
gb = tg.groupby(["team", "season"], group_keys=False)
for col in ["won", "margin", "is_home", "ot", "opp_ranked", "self_ranked"]:
    tg[f"last_{col}"] = gb[col].shift(1)
tg["next_opp_ranked"] = gb["opp_ranked"].shift(-1)

# spot flags (entering current game)
tg["off_ot_loss"] = ((tg.last_ot == 1) & (tg.last_won == 0)).astype(int)
tg["off_close_loss"] = ((tg.last_won == 0) & (tg.last_margin >= -3)).astype(int)
tg["off_blowout_loss"] = (tg.last_margin <= -21).astype(int)
tg["off_home_loss_to_ranked"] = ((tg.last_is_home == 1) & (tg.last_won == 0) & (tg.last_opp_ranked == 1)).astype(int)
tg["off_ranked_upset"] = ((tg.last_self_ranked == 1) & (tg.last_won == 0) & (tg.last_opp_ranked == 0)).astype(int)
tg["lookahead_trap"] = ((tg.opp_ranked == 0) & (tg.next_opp_ranked == 1)).astype(int)
SPOTS = ["off_ot_loss", "off_close_loss", "off_blowout_loss", "off_home_loss_to_ranked",
         "off_ranked_upset", "lookahead_trap"]

# merge to model_games (either team in spot)
gm = pd.read_parquet(os.path.join(HERE, "data", "model_games.parquet"))
df = gm[gm.total_open.notna() & gm.actual_total.notna() & (gm.season >= 2021)].copy()
df = df[df.actual_total != df.total_open]
df["over"] = (df.actual_total > df.total_open).astype(int)
base = df.over.mean() * 100
sp = tg[["season", "week", "team"] + SPOTS]
for side in ["homeTeam", "awayTeam"]:
    m = sp.rename(columns={"team": side, **{s: f"{side[:4]}_{s}" for s in SPOTS}})
    df = df.merge(m, on=["season", "week", side], how="left")
for s in SPOTS:
    df[f"either_{s}"] = ((df[f"home_{s}"].fillna(0) + df[f"away_{s}"].fillna(0)) >= 1).astype(int)

def roi(h, n): return (h * 0.909 - (n - h)) / n * 100 if n else 0.0
def line(name, m):
    m = m.fillna(False) if m.dtype == bool else m.astype(bool)
    b = df[m]; n = len(b)
    if n < 25:
        print(f"  {name:<34} n={n}  (thin)"); return None
    h = int(b.over.sum()); bc = b[b.actual_total != b.total_close]; hc = int((bc.actual_total > bc.total_close).sum()); nc = len(bc)
    per = "/".join(f"{100*b.over[b.season==s].mean():.0f}" if (b.season==s).sum()>=8 else "--" for s in TS)
    print(f"  {name:<34} n={n:<4} over={100*h/n:4.1f}% roi={roi(h,n):+5.1f} vsClose={100*hc/nc if nc else 0:4.1f}  [{per}]")
    return abs(100*h/n - base)

print(f"base OVER {base:.1f}% (n={len(df)})\n=== EMOTIONAL / LOOK-AHEAD SPOTS (either team) ===")
devs = []
for s in SPOTS:
    d = line(s.replace("off_", "off ").replace("_", " "), df[f"either_{s}"] == 1)
    if d is not None: devs.append((s, d))
print("\n=== WEEK spots ===")
line("week 1 (opener)", df.week == 1)
line("week 13", df.week == 13)
line("week 1-2", df.week <= 2)
