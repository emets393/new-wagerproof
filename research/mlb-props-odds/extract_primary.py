import numpy as np, pandas as pd
from pathlib import Path
P = Path("data/parquet/consensus.parquet")
df = pd.read_parquet(P)
def a2d(a):
    a = pd.to_numeric(a, errors="coerce").astype("float64"); return np.where(a>=0,1+a/100.0,1+100.0/np.abs(a))
df["bal"] = np.abs(a2d(df.over_odds)-a2d(df.under_odds))
# primary = most balanced two-way line per (event, market, player); require both sides priced
d = df[df.over_odds.notna() & df.under_odds.notna()].copy()
d = d.sort_values("bal").groupby(["odds_event_id","market","player_name"], sort=False).head(1)
d["official_date"] = pd.to_datetime(d.commence_time, utc=True).dt.tz_convert("America/New_York").dt.date.astype(str)
out = d[["season","odds_event_id","official_date","home_team","away_team","market","player_name",
         "is_pitcher","line","n_books","over_odds","under_odds","best_over_odds","best_under_odds"]]
out.to_parquet("data/parquet/primary.parquet", index=False)
print("primary rows", len(out), "events", out.odds_event_id.nunique(), "markets", out.market.nunique())
print(out.market.value_counts().to_string())
