import pandas as pd, os
pd.set_option("display.max_columns", None); pd.set_option("display.width", 220)
DATA = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
load = lambda n: pd.read_parquet(os.path.join(DATA, f"{n}.parquet"))

for name in ["odds_hist", "betting_lines_2025", "team_mapping", "nflverse_games", "training_epa"]:
    df = load(name)
    print("="*90); print(f"{name}: {df.shape}"); print("="*90)
    for c in df.columns:
        ex = repr(df[c].dropna().iloc[0])[:30] if df[c].notna().any() else "NA"
        print(f"  {c:34s} {str(df[c].dtype):10s} nn={df[c].notna().sum():6d} ex={ex}")

print("\n--- odds_hist season/book ---")
oh = load("odds_hist")
print(oh["season"].value_counts().sort_index())
print("books:", sorted(oh["book"].dropna().unique())[:30])
print("sample rows:")
print(oh.sort_values("snap_ts").head(3).to_string())
print("\nteam name examples (odds):", sorted(oh["home_team"].dropna().unique())[:8])

print("\n--- betting_lines_2025 splits labels ---")
bl = load("betting_lines_2025")
for c in [c for c in bl.columns if "label" in c.lower() or "split" in c.lower()]:
    print(c, "->", bl[c].dropna().unique()[:8])

print("\n--- nflverse_games key cols sample (2024) ---")
ng = load("nflverse_games")
cols = [c for c in ["game_id","season","week","gameday","weekday","gametime","home_team","away_team",
        "home_qb_name","away_qb_name","home_coach","away_coach","home_rest","away_rest","div_game",
        "roof","surface","temp","wind","spread_line","total_line","result","total"] if c in ng.columns]
print("nflverse cols present:", [c for c in ["home_qb_name","away_qb_name","home_coach","away_coach","home_rest","away_rest","div_game","roof"] if c in ng.columns])
print(ng[ng.season==2024][cols].head(4).to_string())
print("\nnflverse team examples:", sorted(ng["home_team"].dropna().unique())[:8])
print("roof values:", ng["roof"].dropna().unique())
