"""Add a `completions` column to player_offense.parquet from nflverse.

player_offense.parquet was a direct nflverse weekly-offense pull that dropped
`completions` (it kept `attempts` = pass attempts but not the completions counterpart).
The pass_completions prop market needs the actual to grade, so backfill it here by
merging nflverse stats_player_week completions on (season, week, player_id).
Read-most / single-write: rewrites player_offense.parquet in place with completions added.
"""
import pandas as pd
from pathlib import Path

DATA = Path(__file__).resolve().parent / "data"
SRC = "https://github.com/nflverse/nflverse-data/releases/download/stats_player/stats_player_week_{s}.parquet"


def main():
    po = pd.read_parquet(DATA / "player_offense.parquet")
    if "completions" in po.columns:
        print("[skip] completions already present")
        return
    seasons = sorted(po.season.unique())
    comp = []
    for s in seasons:
        try:
            df = pd.read_parquet(SRC.format(s=int(s)))
        except Exception as e:
            print(f"  [!] {s}: {e}")
            continue
        df = df[df.season == s][["season", "week", "player_id", "completions"]]
        comp.append(df)
        print(f"  {s}: {len(df)} nflverse rows")
    c = pd.concat(comp, ignore_index=True).drop_duplicates(["season", "week", "player_id"])
    c["completions"] = pd.to_numeric(c.completions, errors="coerce")
    out = po.merge(c, on=["season", "week", "player_id"], how="left")
    matched = out.completions.notna().sum()
    print(f"\nplayer_offense rows: {len(out)}  completions matched: {matched} ({matched/len(out)*100:.1f}%)")
    # QBs should virtually all match; skill players legitimately have 0/NaN completions
    qb = out[out.position == "QB"]
    print(f"QB rows: {len(qb)}  QB completions matched: {qb.completions.notna().sum()}")
    out.to_parquet(DATA / "player_offense.parquet", index=False)
    print("[written] data/player_offense.parquet")


if __name__ == "__main__":
    main()
