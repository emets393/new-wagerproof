"""
Rivalry spots for TOTALS. Hardcoded major FBS rivalries (validated vs actual team names).
Tests: (1) the rivalry game itself over/under, (2) rival look-ahead (rival NEXT week),
(3) rival letdown (rival LAST week). Graded vs OPEN, 2021-2025, per-season + FP control.
"""
import os
import numpy as np
import pandas as pd

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "data", "cfbd")
YEARS = [2016, 2017, 2018, 2019, 2021, 2022, 2023, 2024, 2025]
TS = [2021, 2022, 2023, 2024, 2025]

RIVALRIES = [
    ("Alabama", "Auburn"), ("Ohio State", "Michigan"), ("Texas", "Oklahoma"), ("Army", "Navy"),
    ("USC", "Notre Dame"), ("USC", "UCLA"), ("Florida", "Georgia"), ("Florida", "Florida State"),
    ("Florida", "Miami"), ("Miami", "Florida State"), ("Georgia", "Georgia Tech"), ("Auburn", "Georgia"),
    ("Oklahoma", "Oklahoma State"), ("Texas", "Texas A&M"), ("Mississippi State", "Ole Miss"),
    ("LSU", "Texas A&M"), ("LSU", "Arkansas"), ("LSU", "Alabama"), ("Tennessee", "Vanderbilt"),
    ("Tennessee", "Kentucky"), ("Tennessee", "Alabama"), ("Clemson", "South Carolina"),
    ("North Carolina", "Duke"), ("NC State", "North Carolina"), ("Virginia", "Virginia Tech"),
    ("Pittsburgh", "West Virginia"), ("Penn State", "Ohio State"), ("Penn State", "Michigan State"),
    ("Michigan", "Michigan State"), ("Minnesota", "Wisconsin"), ("Wisconsin", "Iowa"),
    ("Iowa", "Iowa State"), ("Iowa", "Nebraska"), ("Nebraska", "Wisconsin"), ("Indiana", "Purdue"),
    ("Illinois", "Northwestern"), ("Kansas", "Kansas State"), ("Kansas", "Missouri"),
    ("Missouri", "Arkansas"), ("Oregon", "Oregon State"), ("Washington", "Washington State"),
    ("Oregon", "Washington"), ("Stanford", "California"), ("Colorado", "Colorado State"),
    ("Colorado", "Nebraska"), ("Colorado", "Utah"), ("Utah", "BYU"), ("BYU", "Utah State"),
    ("Utah", "Utah State"), ("Arizona", "Arizona State"), ("Cincinnati", "Louisville"),
    ("Louisville", "Kentucky"), ("Texas Tech", "Baylor"), ("Baylor", "TCU"), ("TCU", "SMU"),
    ("SMU", "Houston"), ("Houston", "Rice"), ("Fresno State", "San Diego State"),
    ("Fresno State", "Boise State"), ("Toledo", "Bowling Green"), ("Akron", "Kent State"),
    ("Miami (OH)", "Cincinnati"), ("Air Force", "Army"), ("Air Force", "Navy"),
    ("App State", "Georgia Southern"), ("Troy", "South Alabama"), ("Marshall", "Ohio"),
    ("Florida Atlantic", "FIU"), ("Texas A&M", "Arkansas"), ("West Virginia", "Virginia Tech"),
    ("Boston College", "Syracuse"), ("Maryland", "Penn State"), ("Rutgers", "Maryland"),
    ("Kentucky", "Louisville"), ("Notre Dame", "Stanford"), ("Washington", "Oregon"),
]

def main():
    gm = pd.read_parquet(os.path.join(HERE, "data", "model_games.parquet"))
    teams = set(gm.homeTeam) | set(gm.awayTeam)
    rivpairs = set()
    miss = set()
    for a, b in RIVALRIES:
        for t in (a, b):
            if t not in teams:
                miss.add(t)
        rivpairs.add(frozenset((a, b)))
    if miss:
        print(f"WARN unmatched names: {sorted(miss)}")
    print(f"rivalry pairs: {len(rivpairs)}")

    # team-game sequence to find rival next/last week
    rows = []
    for y in YEARS:
        g = pd.read_parquet(os.path.join(DATA, f"games_{y}.parquet"))
        g = g[(g.seasonType == "regular") & g.homePoints.notna() & g.awayPoints.notna()]
        for _, r in g.iterrows():
            for who, opp in (("home", "away"), ("away", "home")):
                rows.append({"season": y, "week": int(r["week"]), "team": r[f"{who}Team"], "opp": r[f"{opp}Team"]})
    tg = pd.DataFrame(rows)
    tg["is_riv"] = [frozenset((t, o)) in rivpairs for t, o in zip(tg.team, tg.opp)]
    tg = tg.sort_values(["team", "season", "week"]); gb = tg.groupby(["team", "season"], group_keys=False)
    tg["rival_last"] = gb["is_riv"].shift(1).fillna(False)
    tg["rival_next"] = gb["is_riv"].shift(-1).fillna(False)

    df = gm[gm.total_open.notna() & gm.actual_total.notna() & (gm.season >= 2021)].copy()
    df = df[df.actual_total != df.total_open]; df["over"] = (df.actual_total > df.total_open).astype(int)
    base = df.over.mean() * 100
    df["is_rivalry_game"] = [frozenset((h, a)) in rivpairs for h, a in zip(df.homeTeam, df.awayTeam)]
    sp = tg[["season", "week", "team", "rival_last", "rival_next"]]
    for side in ["homeTeam", "awayTeam"]:
        df = df.merge(sp.rename(columns={"team": side, "rival_last": f"{side[:4]}_rl", "rival_next": f"{side[:4]}_rn"}),
                      on=["season", "week", side], how="left")
    df["rival_next_week"] = (df["home_rn"].fillna(False) | df["away_rn"].fillna(False))
    df["rival_last_week"] = (df["home_rl"].fillna(False) | df["away_rl"].fillna(False))

    def roi(h, n): return (h * 0.909 - (n - h)) / n * 100 if n else 0.0
    print(f"base OVER {base:.1f}% (n={len(df)})")
    print(f"{'spot':>26}{'n':>5}{'over%':>7}{'roi':>7}{'avgTot':>8}{'line':>7}  per-season  lean")
    for name, m in [("rivalry GAME itself", df.is_rivalry_game),
                    ("rival NEXT week (lookahd)", df.rival_next_week),
                    ("rival LAST week (letdown)", df.rival_last_week)]:
        b = df[m]; n = len(b); h = int(b.over.sum())
        if n < 15:
            print(f"{name:>26}{n:>5}  (thin)"); continue
        per = "/".join(f"{100*b.over[b.season==s].mean():.0f}" if (b.season==s).sum()>=6 else "--" for s in TS)
        lean = "UNDER" if 100*h/n < base else "OVER"
        print(f"{name:>26}{n:>5}{100*h/n:>7.1f}{roi(h,n):>7.1f}{b.actual_total.mean():>8.1f}{b.total_open.mean():>7.1f}  [{per}] {lean}")


if __name__ == "__main__":
    main()
