#!/usr/bin/env python3
"""Keep data/player_offense.parquet and data/games_enriched.parquet CURRENT for the live season.

Why: every props surface (nfl_slate_props recent form / L5 chips / recent-games bars, the
player pages' game log, the Outliers prop trends, live_props_frame) reads these two git-tracked
parquets, and they froze at 2025 on 2026-08-17. Result: every 2026 prop card shipped with empty
form (owner 2026-09-21: "bar graphs and last-5 chips wrong or not updated"). The DB game logs
were fine — the builders never read them.

Sources, in order:
  1. nflverse stats_player_week_{season}.parquet (published overnight after games) — replaces
     this season's rows wholesale.
  2. ESPN box scores for FINAL games nflverse does not have yet (same day) — added only for
     (player, week) pairs nflverse lacks, mapped to gsis ids via players_xwalk.
  3. nflverse games.csv for this season -> games_enriched rows (opponent map + played flag).

Usage: refresh_player_offense.py [SEASON]   (env NFL_SEASON / NFL_WEEK also honoured)
Runs at the top of run_nfl_week.sh, in grade_week.sh after the log ingest, and before
live_props.py on the 15-minute props cron. Never raises: a fetch failure keeps the file as is."""
import os, sys, pandas as pd, numpy as np

HERE = os.path.dirname(os.path.abspath(__file__)); DATA = os.path.join(HERE, "data")
NFLV = "https://github.com/nflverse/nflverse-data/releases/download"
COLS = ["player_id", "player_name", "position", "position_group", "season", "week", "season_type", "team",
        "carries", "rushing_yards", "rushing_tds", "targets", "receptions", "receiving_yards", "receiving_tds",
        "attempts", "passing_yards", "passing_tds", "fantasy_points_ppr", "anytime_td", "completions"]
INT = ["carries", "rushing_yards", "rushing_tds", "targets", "receptions", "receiving_yards", "receiving_tds",
       "attempts", "passing_yards", "passing_tds", "completions"]
POSGRP = {"QB": "QB", "RB": "RB", "FB": "RB", "WR": "WR", "TE": "TE"}


def season_week():
    if len(sys.argv) > 1: season = int(sys.argv[1]); week = int(sys.argv[2]) if len(sys.argv) > 2 else None
    else:
        season = int(os.environ.get("NFL_SEASON", 0)) or None; week = int(os.environ.get("NFL_WEEK", 0)) or None
    if season is None:
        import subprocess
        s, w = subprocess.check_output([sys.executable, os.path.join(HERE, "resolve_nfl_week.py")]).decode().split()
        season, week = int(s), int(w)
    return season, week


def nflverse_rows(season):
    df = pd.read_parquet(f"{NFLV}/stats_player/stats_player_week_{season}.parquet")
    out = pd.DataFrame({
        "player_id": df.player_id, "player_name": df.player_display_name, "position": df.position,
        "position_group": df.position.map(POSGRP).fillna(df.get("position_group", df.position)),
        "season": df.season, "week": df.week, "season_type": df.season_type, "team": df.team,
        "carries": df.carries, "rushing_yards": df.rushing_yards, "rushing_tds": df.rushing_tds, "targets": df.targets,
        "receptions": df.receptions, "receiving_yards": df.receiving_yards, "receiving_tds": df.receiving_tds,
        "attempts": df.attempts, "passing_yards": df.passing_yards, "passing_tds": df.passing_tds,
        "fantasy_points_ppr": df.get("fantasy_points_ppr", np.nan), "completions": df.completions})
    out["anytime_td"] = out.rushing_tds.fillna(0) + out.receiving_tds.fillna(0)
    return out


def espn_rows(season, weeks, have):
    """Final games ESPN has that nflverse does not yet: (player_id, week) not in `have`."""
    try:
        from espn_nfl_boxscores import load_week
    except Exception:
        return pd.DataFrame(columns=COLS)
    rows = []
    for wk in weeks:
        try:
            box, ev = load_week(season, wk)
        except Exception as e:
            print(f"  [espn] wk{wk} unavailable ({e})"); continue
        if not len(box): continue
        box = box.dropna(subset=["gsis_id"])
        box = box[~box.apply(lambda r: (r.gsis_id, wk) in have, axis=1)]
        for r in box.itertuples():
            rows.append(dict(player_id=r.gsis_id, player_name=r.player_name, position=None, position_group=None,
                             season=season, week=wk, season_type="REG", team=r.team,
                             carries=getattr(r, "player_rush_attempts", 0), rushing_yards=getattr(r, "player_rush_yds", 0),
                             rushing_tds=0, targets=getattr(r, "player_targets", 0), receptions=getattr(r, "player_receptions", 0),
                             receiving_yards=getattr(r, "player_reception_yds", 0), receiving_tds=0,
                             attempts=getattr(r, "player_pass_attempts", 0), passing_yards=getattr(r, "player_pass_yds", 0),
                             passing_tds=getattr(r, "player_pass_tds", 0), fantasy_points_ppr=np.nan,
                             anytime_td=getattr(r, "player_anytime_td", 0), completions=getattr(r, "player_pass_completions", 0)))
        print(f"  [espn] wk{wk}: {sum(1 for x in rows if x['week'] == wk)} player lines from final games nflverse lacks")
    return pd.DataFrame(rows, columns=COLS)


def refresh_player_offense(season, week):
    path = os.path.join(DATA, "player_offense.parquet")
    po = pd.read_parquet(path)
    try:
        new = nflverse_rows(season)
    except Exception as e:
        print(f"  [nflverse] stats_player_week_{season} unavailable ({e}) — keeping existing rows"); new = po[po.season == season][COLS].copy()
    have = set(zip(new.player_id, new.week))
    weeks = [w for w in ((week - 1, week) if week else ()) if w and w >= 1]
    extra = espn_rows(season, weeks, have)
    cur = pd.concat([new, extra], ignore_index=True) if len(extra) else new
    # ESPN rows carry no position; borrow the player's last known one
    pos = po[po.player_id.isin(cur.player_id)].sort_values(["season", "week"]).drop_duplicates("player_id", keep="last")[["player_id", "position", "position_group"]]
    cur = cur.merge(pos.rename(columns={"position": "_p", "position_group": "_pg"}), on="player_id", how="left")
    cur["position"] = cur.position.fillna(cur._p); cur["position_group"] = cur.position_group.fillna(cur._pg)
    cur = cur.drop(columns=["_p", "_pg"])
    for c in INT: cur[c] = pd.to_numeric(cur[c], errors="coerce").fillna(0).astype("int32")
    cur["anytime_td"] = pd.to_numeric(cur.anytime_td, errors="coerce").fillna(0).astype("int64")
    cur["season"] = cur.season.astype("int32"); cur["week"] = cur.week.astype("int32")
    out = pd.concat([po[po.season != season], cur[COLS]], ignore_index=True)
    out.to_parquet(path, index=False)
    print(f"player_offense: {season} rows {len(po[po.season == season])} -> {len(cur)} (weeks {sorted(cur.week.unique())}) | total {len(out)}")


def refresh_games(season):
    path = os.path.join(DATA, "games_enriched.parquet")
    ge = pd.read_parquet(path)
    try:
        g = pd.read_csv(f"{NFLV}/schedules/games.csv"); g = g[g.season == season].copy()
    except Exception as e:
        print(f"  [nflverse] games.csv unavailable ({e}) — keeping existing rows"); return
    ref = ge[ge.season == ge.season.max()]
    conf = {**dict(zip(ref.home_team, ref.home_conf)), **dict(zip(ref.away_team, ref.away_conf))}
    div = {**dict(zip(ref.home_team, ref.home_div)), **dict(zip(ref.away_team, ref.away_div))}
    g["home_conf"] = g.home_team.map(conf); g["away_conf"] = g.away_team.map(conf)
    g["home_div"] = g.home_team.map(div); g["away_div"] = g.away_team.map(div)
    g["played"] = g.home_score.notna(); g["elo_home"] = np.nan; g["elo_away"] = np.nan; g["p_home"] = np.nan
    g = g.reindex(columns=ge.columns)
    for c in ge.columns:
        try: g[c] = g[c].astype(ge[c].dtype)
        except Exception: pass
    out = pd.concat([ge[ge.season != season], g], ignore_index=True)
    out.to_parquet(path, index=False)
    print(f"games_enriched: {season} rows {int((ge.season == season).sum())} -> {len(g)} (played {int(g.played.sum())})")


if __name__ == "__main__":
    season, week = season_week()
    try: refresh_player_offense(season, week)
    except Exception as e: print(f"  [player_offense] refresh failed ({e}) — file unchanged")
    try: refresh_games(season)
    except Exception as e: print(f"  [games_enriched] refresh failed ({e}) — file unchanged")
