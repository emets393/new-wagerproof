"""
Build the master analysis dataset from the cached sources.
- Patch the LA Rams/Chargers Super Bowl mislabel (surgical, by unique_id).
- Compute target metrics (spread_diff/miss, total_diff/miss, direction).
- Validate that stored cover/ou/ml flags reproduce from closing line + score.
- Merge nflverse (QB starters, coach, rest, div_game, roof, gametime/primetime).
- Build backup-QB flag from each team-season's modal starter.
Outputs data/master.parquet and prints a validation report.
"""
import os
import numpy as np
import pandas as pd

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "data")
load = lambda n: pd.read_parquet(os.path.join(DATA, f"{n}.parquet"))


def main():
    pg = load("pregame").copy()
    tm = load("team_mapping")
    ng = load("nflverse_games")

    # ---- 1. Patch SB mislabel (surgical: only the two real LA Rams Super Bowls) ----
    patch = {
        "LA ChargersNew England201821": ("home_team", "LA Rams"),  # SB LIII, Rams=home
        "CincinnatiLA Chargers202122": ("away_team", "LA Rams"),   # SB LVI, Rams=away
    }
    for uid, (col, val) in patch.items():
        m = pg["unique_id"] == uid
        assert m.sum() == 1, f"patch target {uid} not unique ({m.sum()})"
        before = pg.loc[m, col].iloc[0]
        pg.loc[m, col] = val
        print(f"[patch] {uid}: {col} {before!r} -> {val!r}")

    # ---- 2. team name -> our abbrev ----
    name2ab = dict(zip(tm["team_name"], tm["Team Abbrev"]))
    pg["home_ab"] = pg["home_team"].map(name2ab)
    pg["away_ab"] = pg["away_team"].map(name2ab)
    assert pg["home_ab"].notna().all() and pg["away_ab"].notna().all(), "unmapped team name"

    # ---- 3. Target metrics ----
    pg["actual_margin"] = pg["home_score"] - pg["away_score"]      # home - away
    pg["actual_total"] = pg["home_score"] + pg["away_score"]
    pg["spread_diff"] = pg["actual_margin"] + pg["home_spread"]    # >0 home beat number
    pg["spread_miss"] = pg["spread_diff"].abs()
    pg["total_diff"] = pg["actual_total"] - pg["ou_vegas_line"]    # >0 OVER
    pg["total_miss"] = pg["total_diff"].abs()
    pg["home_fav"] = (pg["home_spread"] < 0).astype(int)
    pg["fav_margin"] = np.where(pg["home_fav"] == 1, pg["actual_margin"], -pg["actual_margin"])
    # spread_diff signed from favorite's perspective: did favorite beat the number?
    pg["fav_spread_diff"] = np.where(pg["home_fav"] == 1, pg["spread_diff"], -pg["spread_diff"])
    # direction tag for extreme spread misses
    pg["upset_outright"] = (pg["fav_margin"] < 0).astype(int)     # favorite lost SU

    # ---- 4. Validate stored flags reproduce from line + score ----
    rec_cover = np.where(pg["spread_diff"] > 0, 1, np.where(pg["spread_diff"] < 0, 0, -1))  # -1 push
    rec_ou = np.where(pg["total_diff"] > 0, 1, np.where(pg["total_diff"] < 0, 0, -1))
    rec_ml = np.where(pg["actual_margin"] > 0, 1, np.where(pg["actual_margin"] < 0, 0, -1))
    rec_fav_cov = np.where(pg["fav_spread_diff"] > 0, 1, np.where(pg["fav_spread_diff"] < 0, 0, -1))

    def agree(stored, rec, name):
        nonpush = rec != -1
        a = (pg.loc[nonpush, stored].values == rec[nonpush]).mean()
        print(f"  {name:24s} agree={a*100:6.2f}%  (n_nonpush={nonpush.sum()}, pushes={(~nonpush).sum()})")
        return a

    print("\n[validate] stored flags vs reconstruction from closing line + score:")
    agree("home_away_spread_cover", rec_cover, "home_away_spread_cover")
    agree("ou_result", rec_ou, "ou_result")
    agree("home_away_ml", rec_ml, "home_away_ml")
    agree("favorite_covered", rec_fav_cov, "favorite_covered")

    # ---- 5. Merge nflverse ----
    nv_ab = {"LA": "LAR", "SD": "LAC", "STL": "LAR", "OAK": "OAK", "LV": "LV"}  # only LA matters in window
    ng = ng[ng["season"].between(2018, 2025)].copy()
    ng["home_ab"] = ng["home_team"].replace(nv_ab)
    ng["away_ab"] = ng["away_team"].replace(nv_ab)
    nvcols = ["season", "week", "home_ab", "away_ab", "home_qb_name", "away_qb_name",
              "home_coach", "away_coach", "home_rest", "away_rest", "div_game", "roof",
              "gametime", "weekday", "surface", "temp", "wind", "spread_line", "total_line",
              "game_type"]
    nv = ng[nvcols].rename(columns={"surface": "nv_surface", "temp": "nv_temp", "wind": "nv_wind",
                                    "spread_line": "nv_spread_line", "total_line": "nv_total_line"})
    m = pg.merge(nv, on=["season", "week", "home_ab", "away_ab"], how="left", indicator=True)
    print(f"\n[merge] nflverse join: matched {(m['_merge']=='both').sum()}/{len(m)} "
          f"({(m['_merge']=='both').mean()*100:.1f}%)")
    unmatched = m[m["_merge"] != "both"][["unique_id", "season", "week", "home_ab", "away_ab"]]
    if len(unmatched):
        print("  unmatched rows:\n", unmatched.to_string())
    m = m.drop(columns=["_merge"])

    # cross-check: nflverse spread_line is POSITIVE when home favored -> equals -home_spread
    both = m.dropna(subset=["nv_spread_line"])
    sp_agree = (np.sign(both["nv_spread_line"]) == np.sign(-both["home_spread"])).mean()
    diff = (both["nv_spread_line"] - (-both["home_spread"])).abs()
    print(f"[xcheck] nflverse spread sign agrees with our home_spread: {sp_agree*100:.1f}%; "
          f"|line diff| mean={diff.mean():.2f}, median={diff.median():.2f}, >1pt={ (diff>1).mean()*100:.1f}%")

    # ---- 6. Primetime / situational from nflverse gametime (ET) ----
    def hour(t):
        try:
            return int(str(t).split(":")[0])
        except Exception:
            return np.nan
    m["kick_hour_et"] = m["gametime"].map(hour)
    m["primetime"] = (m["kick_hour_et"] >= 19).astype("Int64")
    m["is_thu"] = (m["weekday"] == "Thursday").astype("Int64")
    m["is_mon"] = (m["weekday"] == "Monday").astype("Int64")
    m["is_sun"] = (m["weekday"] == "Sunday").astype("Int64")
    m["dome_closed"] = m["roof"].isin(["dome", "closed"]).astype("Int64")

    # ---- 7. Backup QB via modal starter per team-season (from nflverse starter names) ----
    # Build long table of (season, team_ab, qb_name) then modal starter per team-season.
    h = m[["season", "home_ab", "home_qb_name", "week"]].rename(
        columns={"home_ab": "team_ab", "home_qb_name": "qb"})
    a = m[["season", "away_ab", "away_qb_name", "week"]].rename(
        columns={"away_ab": "team_ab", "away_qb_name": "qb"})
    long = pd.concat([h, a], ignore_index=True).dropna(subset=["qb"])
    modal = (long.groupby(["season", "team_ab", "qb"]).size()
             .reset_index(name="n")
             .sort_values(["season", "team_ab", "n"], ascending=[True, True, False])
             .drop_duplicates(["season", "team_ab"])[["season", "team_ab", "qb"]]
             .rename(columns={"qb": "modal_qb"}))
    mh = modal.rename(columns={"team_ab": "home_ab", "modal_qb": "home_modal_qb"})
    ma = modal.rename(columns={"team_ab": "away_ab", "modal_qb": "away_modal_qb"})
    m = m.merge(mh, on=["season", "home_ab"], how="left").merge(ma, on=["season", "away_ab"], how="left")
    m["home_backup_qb"] = ((m["home_qb_name"].notna()) &
                           (m["home_qb_name"] != m["home_modal_qb"])).astype("Int64")
    m["away_backup_qb"] = ((m["away_qb_name"].notna()) &
                           (m["away_qb_name"] != m["away_modal_qb"])).astype("Int64")
    m["any_backup_qb"] = ((m["home_backup_qb"] == 1) | (m["away_backup_qb"] == 1)).astype("Int64")
    print(f"\n[backup] games with a backup starter (clean def): {int((m['any_backup_qb']==1).sum())} "
          f"({(m['any_backup_qb']==1).mean()*100:.1f}%)  vs qb_out_or_doubtful flag: "
          f"{int(((m['home_qb_out_or_doubtful']==1)|(m['away_qb_out_or_doubtful']==1)).sum())}")

    # ---- weather coalesce (prefer view, fall back to nflverse) ----
    m["wind_mph"] = m["wind_speed"].where(m["wind_speed"].notna(), m["nv_wind"])
    m["temp_f"] = m["temperature"].where(m["temperature"].notna(), m["nv_temp"])

    out = os.path.join(DATA, "master.parquet")
    m.to_parquet(out, index=False)
    print(f"\n[saved] master: {m.shape} -> {out}")
    print("extreme-outcome quick counts:")
    print(f"  spread_miss>=21 blow-ups: {(m['spread_miss']>=21).sum()} "
          f"({(m['spread_miss']>=21).mean()*100:.1f}%)")
    print(f"  total_diff>=21 (big over): {(m['total_diff']>=21).sum()};  "
          f"total_diff<=-21 (big under): {(m['total_diff']<=-21).sum()}")
    print(f"  total_miss>=21: {(m['total_miss']>=21).sum()} ({(m['total_miss']>=21).mean()*100:.1f}%)")
    print(f"  spread_diff mean={m['spread_diff'].mean():.3f} (cover bias), "
          f"total_diff mean={m['total_diff'].mean():.3f} (over bias)")


if __name__ == "__main__":
    main()
