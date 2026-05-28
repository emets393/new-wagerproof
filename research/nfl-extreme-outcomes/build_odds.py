"""
Build per-game OPEN/CLOSE consensus + line movement from nfl_historical_odds (2023-25).
Consensus = median across books of each book's earliest (open) / latest-pre-kick (close) snap.
Movement = close - open. Validate close consensus reproduces master's stored closing line.
Also fold in 2025 sharp/public splits from nfl_betting_lines.
"""
import os
import numpy as np
import pandas as pd

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "data")
load = lambda n: pd.read_parquet(os.path.join(DATA, f"{n}.parquet"))


def vig_ok(p_home, p_away):
    """implied prob sum within [1.00, 1.12]; prices in American."""
    def imp(o):
        return np.where(o < 0, -o / (-o + 100), 100 / (o + 100))
    s = imp(p_home) + imp(p_away)
    return (s >= 1.00) & (s <= 1.12)


def main():
    oh = load("odds_hist").copy()
    tm = load("team_mapping")
    master = load("master")

    # odds team names -> abbrev. Odds uses city names == our team_name mostly; verify.
    name2ab = dict(zip(tm["team_name"], tm["Team Abbrev"]))
    odds_names = sorted(set(oh["home_team"]) | set(oh["away_team"]))
    missing = [n for n in odds_names if n not in name2ab]
    print("[odds] team names not in mapping.team_name:", missing)
    # try city_and_name and vsin fallbacks for any missing
    extra = {}
    for n in missing:
        hit = tm[tm["city_and_name"] == n]
        if len(hit):
            extra[n] = hit["Team Abbrev"].iloc[0]
    name2ab.update(extra)
    print("[odds] resolved extras:", extra)

    oh["home_ab"] = oh["home_team"].map(name2ab)
    oh["away_ab"] = oh["away_team"].map(name2ab)
    print("[odds] still unmapped rows:", oh[["home_ab", "away_ab"]].isna().any(axis=1).sum())

    oh["snap_ts"] = pd.to_datetime(oh["snap_ts"], utc=True, errors="coerce")
    oh["commence_time"] = pd.to_datetime(oh["commence_time"], utc=True, errors="coerce")
    # enforce pregame-only
    pre = oh[oh["snap_ts"] < oh["commence_time"]].copy()
    print(f"[odds] pregame snaps: {len(pre)}/{len(oh)}")

    gkey = ["season", "home_ab", "away_ab"]

    def consensus(group_df, which):
        """which='open' -> each book's earliest snap; 'close' -> latest. Median across books."""
        idx = (group_df.groupby("book")["snap_ts"].idxmin() if which == "open"
               else group_df.groupby("book")["snap_ts"].idxmax())
        per_book = group_df.loc[idx]
        return per_book

    rows = []
    for key, g in pre.groupby(gkey):
        op = consensus(g, "open")
        cl = consensus(g, "close")
        rec = dict(zip(gkey, key))
        rec["n_books"] = g["book"].nunique()
        rec["n_snaps"] = len(g)
        rec["open_ts"] = g["snap_ts"].min()
        rec["close_ts"] = g["snap_ts"].max()
        rec["commence_time"] = g["commence_time"].iloc[0]
        # spread (home), total, ml home/away: median across books
        rec["open_spread"] = op["spread_home"].median()
        rec["close_spread"] = cl["spread_home"].median()
        rec["open_total"] = op["total_point"].median()
        rec["close_total"] = cl["total_point"].median()
        rec["open_ml_home"] = op["ml_home"].median()
        rec["close_ml_home"] = cl["ml_home"].median()
        rec["open_ml_away"] = op["ml_away"].median()
        rec["close_ml_away"] = cl["ml_away"].median()
        rows.append(rec)
    od = pd.DataFrame(rows)
    od["spread_move"] = od["close_spread"] - od["open_spread"]      # >0 = home line rose (toward dog)
    od["total_move"] = od["close_total"] - od["open_total"]         # >0 = total moved up
    od["ml_home_move"] = od["close_ml_home"] - od["open_ml_home"]
    print(f"[odds] aggregated games: {len(od)}  (per season: "
          f"{od['season'].value_counts().sort_index().to_dict()})")

    # collisions (same season+home+away more than once)?
    dup = od[od.duplicated(gkey, keep=False)]
    print("[odds] duplicate game keys:", len(dup))

    # ---- validate close consensus vs master stored lines ----
    mm = master[gkey + ["home_spread", "ou_vegas_line", "spread_diff", "total_diff",
                        "spread_miss", "total_miss"]].merge(od, on=gkey, how="inner")
    sp_d = (mm["close_spread"] - mm["home_spread"]).abs()
    to_d = (mm["close_total"] - mm["ou_vegas_line"]).abs()
    print(f"\n[validate odds<->master] n={len(mm)}")
    print(f"  close_spread vs home_spread: |diff| mean={sp_d.mean():.3f} median={sp_d.median():.3f} "
          f"within0.5={ (sp_d<=0.5).mean()*100:.1f}% within1={ (sp_d<=1).mean()*100:.1f}%")
    print(f"  close_total vs ou_vegas_line: |diff| mean={to_d.mean():.3f} median={to_d.median():.3f} "
          f"within0.5={ (to_d<=0.5).mean()*100:.1f}% within1={ (to_d<=1).mean()*100:.1f}%")

    od.to_parquet(os.path.join(DATA, "odds_consensus.parquet"), index=False)
    print(f"[saved] odds_consensus: {od.shape}")

    # ---- 2025 splits ----
    bl = load("betting_lines_2025").copy()
    # training_key = home+away+season+week ; map to our team names via team_name
    bl["home_ab"] = bl["home_team"].map(name2ab)
    bl["away_ab"] = bl["away_team"].map(name2ab)
    print("\n[splits] unmapped:", bl[["home_ab", "away_ab"]].isna().any(axis=1).sum())
    # one row per game? dedupe by (season,home,away) keeping latest as_of_ts (closest to kick)
    bl["as_of_ts"] = pd.to_datetime(bl["as_of_ts"], utc=True, errors="coerce")
    bl = bl.sort_values("as_of_ts").drop_duplicates(["season_year", "home_ab", "away_ab"], keep="last")
    keep = ["season_year", "week", "home_ab", "away_ab", "home_spread_handle", "home_spread_bets",
            "away_spread_handle", "away_spread_bets", "over_handle", "over_bets", "under_handle",
            "under_bets", "home_ml_handle", "home_ml_bets", "away_ml_handle", "away_ml_bets",
            "spread_splits_label", "total_splits_label", "ml_splits_label"]
    bl = bl[keep].rename(columns={"season_year": "season"})
    bl.to_parquet(os.path.join(DATA, "splits_2025.parquet"), index=False)
    print(f"[saved] splits_2025: {bl.shape} (games: {bl[['home_ab','away_ab']].drop_duplicates().shape[0]})")
    print("  spread_splits_label values:", bl["spread_splits_label"].value_counts().to_dict())


if __name__ == "__main__":
    main()
