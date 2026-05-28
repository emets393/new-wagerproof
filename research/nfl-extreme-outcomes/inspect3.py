import pandas as pd, os
pd.set_option("display.max_columns", None); pd.set_option("display.width", 220); pd.set_option("display.max_rows", 60)
DATA = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
load = lambda n: pd.read_parquet(os.path.join(DATA, f"{n}.parquet"))

pg = load("pregame"); tm = load("team_mapping")

print("=== team_mapping full ===")
print(tm[["Team Abbrev","city_and_name","team_name","vsin_team_name"]].to_string())

print("\n=== pregame distinct home_team names (33?) ===")
names = sorted(set(pg["home_team"].unique()) | set(pg["away_team"].unique()))
print(len(names), names)

print("\n=== pregame names NOT in team_mapping.team_name ===")
mapnames = set(tm["team_name"])
print("missing from mapping team_name:", [n for n in names if n not in mapnames])

print("\n=== total_points == home+away ? ===")
chk = (pg["total_points"] == (pg["home_score"]+pg["away_score"]))
print("matches:", chk.sum(), "/", len(pg), " mismatch rows:", (~chk).sum())

print("\n=== week distribution ===")
print(pg["week"].value_counts().sort_index())

print("\n=== Week 22 (Super Bowl) rows ===")
sb = pg[pg["week"]==22][["unique_id","season","home_team","away_team","home_score","away_score","favorite"]]
print(sb.to_string())

print("\n=== Any 'LA Chargers' / 'LA Rams' rows by season ===")
for nm in ["LA Chargers","LA Rams","Los Angeles","LA"]:
    sub = pg[(pg["home_team"]==nm)|(pg["away_team"]==nm)]
    print(f"  {nm!r}: {len(sub)} rows, seasons={sorted(sub['season'].unique())}")

print("\n=== nflverse abbrev set vs mapping ===")
ng = load("nflverse_games")
ng_ab = sorted(set(ng["home_team"]) | set(ng["away_team"]))
print("nflverse abbrevs:", ng_ab)
print("mapping abbrevs:", sorted(tm["Team Abbrev"]))
