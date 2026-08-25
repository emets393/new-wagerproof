"""Does the hammer index predict anything bettable? Big-favorite ATS + game-total
over rates by coach hammer tier. Lines = odds_game_frame.parquet (Odds API closes,
home perspective). Descriptive check graded vs the close — sign convention verified
in-script via the favs-cover base rate (~48-51% or the sign is wrong)."""
import os
import numpy as np, pandas as pd

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "..", "data")
SEASONS = [2021, 2022, 2023, 2024, 2025]

full = pd.read_csv(os.path.join(HERE, "out", "coach_blowout_full.csv"), index_col=0)
hi = full.hammer.quantile(0.75)
lo = full.hammer.quantile(0.25)
tier = {c: ("hammer" if h >= hi else "mercy" if h <= lo else "mid") for c, h in full.hammer.items()}

coach = pd.read_parquet(f"{DATA}/cfbd/coach_seasons.parquet")
coach = coach.sort_values("games", ascending=False).drop_duplicates(["year", "school"])
c_map = dict(zip(zip(coach.year, coach.school), coach.coach))

games = pd.concat([pd.read_parquet(f"{DATA}/cfbd/games_{y}.parquet") for y in SEASONS], ignore_index=True)
games = games[games.seasonType == "regular"][["season", "homeTeam", "awayTeam", "homePoints", "awayPoints", "week"]].rename(columns={"week": "cfbd_week"})
o = pd.read_parquet(f"{DATA}/odds_game_frame.parquet")
# odds frame game_id is the Odds-API event hash — join on CFBD team names instead
o = o[o.season.isin(SEASONS)].merge(games, left_on=["season", "home", "away"],
        right_on=["season", "homeTeam", "awayTeam"], how="inner").dropna(subset=["close_spread", "homePoints"])
o["margin"] = o.homePoints - o.awayPoints

# sign check: home favorites (close_spread < 0 under the assumed convention) should cover ~48-51%
hf = o[o.close_spread < 0]
cover_rate = ((hf.margin + hf.close_spread) > 0).mean()
print(f"sign check — home favs cover {cover_rate:.1%} (n={len(hf)}); sane range 46-52%")
assert 0.44 < cover_rate < 0.54, "spread sign convention wrong — stop"

o["fav_team"] = np.where(o.close_spread < 0, o.home, o.away)
o["fav_spread"] = -o.close_spread.abs()
o["fav_margin"] = np.where(o.close_spread < 0, o.margin, -o.margin)
o["fav_cover"] = np.sign(o.fav_margin + o.fav_spread)
o["fav_coach"] = [c_map.get((s, t)) for s, t in zip(o.season, o.fav_team)]
o["tier"] = o.fav_coach.map(tier)
o["total_pts"] = o.homePoints + o.awayPoints
o["went_over"] = np.sign(o.total_pts - o.close_total)

def report(sub, label):
    print(f"\n{label}")
    for t in ["hammer", "mid", "mercy"]:
        g = sub[sub.tier == t]
        gc = g[g.fav_cover != 0]
        ov = g.dropna(subset=["close_total"])
        ov = ov[ov.went_over != 0]
        if len(gc) == 0:
            continue
        print(f"  {t:7s} n={len(gc):4d}  fav covers {(gc.fav_cover > 0).mean():.1%}"
              f"   | over {((ov.went_over > 0).mean() if len(ov) else float('nan')):.1%} (n={len(ov)})")

big = o[o.fav_spread <= -14]
report(big, "FAV >= 14 (all season, close)")
report(big[big.cfbd_week <= 3], "FAV >= 14, weeks 1-3")
huge = o[o.fav_spread <= -21]
report(huge, "FAV >= 21 (all season)")
