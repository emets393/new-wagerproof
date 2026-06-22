"""
Supabase data-pull layer for the NFL extreme-outcomes harness.

Mirrors research/cfb-model/fetch_supabase.py. The forecast harness imports
`fetch_table` from here to pull the LEGACY cover-prob live:

    from fetch import fetch_table
    leg = fetch_table("nfl_predictions_epa",
                      select="unique_id,home_away_spread_cover_prob,as_of_ts")

That column (nfl_predictions_epa.home_away_spread_cover_prob) is the *only* legacy
dependency of the new model — it powers the legacy_primetime / legacy_fade signals
(see forecast_harness.load_legacy + .claude/docs/agents/14_SEASON_2026_PIPELINE_READINESS.md).
Keep the legacy NFL cron alive in-season so this table stays populated, or those two
signals silently disable (the harness catches the empty pull and prints a warning).

Run:  python3 fetch.py            (cache the tables below to data/*.parquet)
      python3 fetch.py --force    (re-pull everything)
"""
import io
import os
import sys
import time
import requests
import pandas as pd

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "data")
os.makedirs(DATA, exist_ok=True)

SUPA = "https://jpxnjuwglavsjbgbasnl.supabase.co/rest/v1"
# Read-only anon key (public by design — same project as the dryrun tables + the CFB
# research pull). Overridable via env so a service key can be injected in production.
KEY = os.environ.get(
    "CFB_SUPABASE_ANON_KEY",
    ("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impw"
     "eG5qdXdnbGF2c2piZ2Jhc25sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2OTc4NjEsImV4cCI6MjA2ODI3Mzg2MX0"
     ".BjOHMysQh3wST-_UR6bJxHngRThlAmOOx4FfSVKRzWo"),
)
HDRS = {"apikey": KEY, "Authorization": f"Bearer {KEY}"}

FORCE = "--force" in sys.argv
# Default run = weekly SCORING (reads the upcoming-slate view). --train reads the
# completed-games frame for the once-a-season .pkl fit. Only the "pregame" source differs.
TRAIN = "--train" in sys.argv

# Local cache name -> (source table/view, order column). The build chain (build.py,
# build_odds.py, build_matchup.py) reads these by their LOCAL names, so the keys here
# must match exactly. team_week == nfl_pregame_advanced_team_week verbatim (exact 39-col
# match) — the cfb_automation pregame cron produces it weekly. nfl_predictions_epa is NOT
# cached here: the harness pulls it live via fetch_table() for the legacy_* signals.
TABLES = {
    "pregame":            ("v_nfl_pregame_features_full" if TRAIN else "v_nfl_slate_inputs", "season,week"),
    "team_week":          ("nfl_pregame_advanced_team_week",  "season,week"),
    "training_epa":       ("nfl_training_data_epa",           None),
    "team_mapping":       ("nfl_team_mapping",                None),
    "odds_hist":          ("nfl_historical_odds",             "snap_ts"),
    "betting_lines_2025": ("nfl_betting_lines",               None),
    # Per-player feeds (cfb_automation pregame cron writes these raw tables; columns
    # verified identical to the historical parquets — same exact-match pattern as team_week).
    "injuries_raw":       ("nfl_injuries_raw",                "season,week"),
    "ngs_receiving":      ("nfl_ngs_receiving_raw",           "season,week"),
    "ngs_passing":        ("nfl_ngs_passing_raw",             "season,week"),
    "ngs_rushing":        ("nfl_ngs_rushing_raw",             "season,week"),
    "signal_performance": ("signal_performance",              None),
    # nflverse_games + player_stats_def come from nflverse directly (not Supabase) —
    # ported below as nflverse_games() / player_stats_def() pulls.
}


def fetch_table(table, select="*", order=None, page=1000):
    """Paginated PostgREST pull -> DataFrame.

    Raises after 4 failed attempts; callers that treat the table as optional
    (e.g. load_legacy) wrap this in try/except. An empty table returns an empty
    DataFrame (callers check len == 0).
    """
    rows, offset = [], 0
    while True:
        params = {"select": select, "limit": page, "offset": offset}
        if order:
            params["order"] = order
        for attempt in range(4):
            try:
                r = requests.get(f"{SUPA}/{table}", headers=HDRS, params=params, timeout=120)
                r.raise_for_status()
                break
            except Exception:
                if attempt == 3:
                    raise
                time.sleep(1.5 * (attempt + 1))
        batch = r.json()
        rows.extend(batch)
        if len(batch) < page:
            break
        offset += page
    return pd.DataFrame(rows)


def nflverse_games():
    """Schedule + results from nflverse (direct pull, not Supabase)."""
    r = requests.get("https://github.com/nflverse/nfldata/raw/master/data/games.csv", timeout=120)
    return pd.read_csv(io.StringIO(r.text))


def player_stats_def():
    """Defensive weekly player stats from nflverse (no cfb_automation table exists for these).
    NOTE: validate column parity vs the historical player_stats_def.parquet before Week 1."""
    return pd.read_parquet(
        "https://github.com/nflverse/nflverse-data/releases/download/player_stats/player_stats_def.parquet")


# local name -> nflverse loader fn (pulled directly, not from Supabase)
FUNC_TABLES = {"nflverse_games": nflverse_games, "player_stats_def": player_stats_def}


def main():
    for name, (source, order) in TABLES.items():
        out = os.path.join(DATA, f"{name}.parquet")
        if os.path.exists(out) and not FORCE:
            print(f"  skip {name:20s} cached ({len(pd.read_parquet(out))} rows)")
            continue
        try:
            df = fetch_table(source, order=order)
            df.to_parquet(out, index=False)
            print(f"  ok   {name:20s} {len(df):6d} rows  <- {source}")
        except Exception as e:
            print(f"  FAIL {name:20s} {e}")
    for name, loader in FUNC_TABLES.items():
        out = os.path.join(DATA, f"{name}.parquet")
        if os.path.exists(out) and not FORCE:
            print(f"  skip {name:20s} cached ({len(pd.read_parquet(out))} rows)")
            continue
        try:
            df = loader()
            df.to_parquet(out, index=False)
            print(f"  ok   {name:20s} {len(df):6d} rows  <- nflverse")
        except Exception as e:
            print(f"  FAIL {name:20s} {e}")


if __name__ == "__main__":
    main()
