import pandas as pd, os, json
pd.set_option("display.max_columns", None); pd.set_option("display.width", 200)
DATA = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")


def load(n):
    return pd.read_parquet(os.path.join(DATA, f"{n}.parquet"))


pg = load("pregame")
print("="*80); print("PREGAME columns (249):"); print("="*80)
for i, c in enumerate(pg.columns):
    print(f"{i:3d} {c:42s} {str(pg[c].dtype):10s} nn={pg[c].notna().sum():4d} ex={repr(pg[c].dropna().iloc[0])[:28] if pg[c].notna().any() else 'NA'}")

print("\nseason counts:"); print(pg["season"].value_counts().sort_index())
print("\nweek range:", pg["week"].min(), pg["week"].max())
print("\nkey outcome cols sample:")
print(pg[["unique_id","season","week","home_team","away_team","home_score","away_score",
          "home_spread","away_spread","ou_vegas_line","favorite","favorite_covered",
          "home_away_spread_cover","ou_result","home_away_ml"]].head(8).to_string())
