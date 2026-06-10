"""b88 step 0 — data inventory for the model-improvement deep dive."""
import pandas as pd, os
DATA = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
m = pd.read_parquet(os.path.join(DATA, "matchup.parquet"))
print("shape", m.shape, "seasons", sorted(m.season.unique()))
off = sorted(c for c in m.columns if c.startswith("home_off_"))
de  = sorted(c for c in m.columns if c.startswith("home_def_"))
other = sorted(c for c in m.columns if not c.startswith(("home_off_", "away_off_", "home_def_", "away_def_")))
print(f"\nOFF metrics ({len(off)}):")
for c in off: print("  ", c)
print(f"\nDEF metrics ({len(de)}):")
for c in de: print("  ", c)
print(f"\nOTHER ({len(other)}):")
for c in other: print("  ", c)
print("\nnull rates for off/def metrics by season:")
chk = [c for c in off[:3] + de[:3]]
print(m.groupby("season")[chk].apply(lambda d: d.isna().mean().round(2)))
