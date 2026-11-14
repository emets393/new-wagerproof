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
# Read-only anon key (public by design — same project as the slate tables + the CFB
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
    # "pregame" is special-cased in main(): weekly mode needs BOTH the completed-games
    # history (s2d features, streaks, early-season prior-year carryover all read it via
    # master.parquet, which build.py rebuilds from scratch) AND the upcoming slate rows.
    # v_nfl_slate_inputs alone is slate-only — caching just it would wipe 2018-25 history.
    "pregame":            ("v_nfl_pregame_features_full", "season,week"),
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


def fetch_table(table, select="*", order=None, page=1000, hdrs=None):
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
                r = requests.get(f"{SUPA}/{table}", headers=hdrs or HDRS, params=params, timeout=120)
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


# Local parquet name -> Supabase table, for artifacts the PROP CHAIN needs on a box with no
# warehouse. Separate from TABLES above because these are read on demand by
# gen_nfl_prop_player_pages.py, not pre-cached by main().
#
# ⛔ WHY THIS EXISTS. gen_nfl_prop_player_pages.py reads 13 local parquets. Render's disk is
# ephemeral and holds none of them, so on every scheduled run it died at the first
# read_parquet — and because render.yaml wrapped the step in `|| true`, the cron reported
# SUCCESS. nfl_prop_spotlight and fp_cards were therefore empty for every 2026 week except
# wk5, which was published by hand, and nothing alerted for five weeks. Columns verified
# equal-or-superset against each local parquet on 2026-10-15.
DB_BACKED = {
    "ngs_receiving":     ("nfl_ngs_receiving_raw", "season,week"),
    "ngs_rushing":       ("nfl_ngs_rushing_raw",   "season,week"),
    "ngs_passing":       ("nfl_ngs_passing_raw",   "season,week"),
    "nfl_def_scheme":    ("nfl_team_scheme",       None),
    "nfl_qb_vs_scheme":  ("nfl_qb_scheme_splits",  None),
    "nfl_rusher_vs_box": ("nfl_rusher_box_splits", None),
    "player_offense":    ("nfl_player_game_logs",  "season,week"),
}

# Supabase column name -> the local parquet's name, for a DB_BACKED table that stores the
# same stat under a different label. Callers index by the parquet's vocabulary, so renaming
# here keeps the swap invisible to them.
#
# ⚠ nfl_player_game_logs starts at 2024; player_offense.parquet carries 2018+. Both
# gen_nfl_prop_player_pages.py reads filter to `season == STAT_SEASON` or `season >= 2024`,
# so the shorter history is sufficient THERE — do not route a multi-season backtest through
# this fallback without checking the span it needs first.
DB_RENAME = {
    "player_offense": {"pass_attempts": "attempts", "pass_yds": "passing_yards",
                       "pass_tds": "passing_tds", "rush_yds": "rushing_yards",
                       "rush_tds": "rushing_tds", "rec_yds": "receiving_yards",
                       "rec_tds": "receiving_tds"},
}


def _service_hdrs():
    """Service-role headers, or None when no service key is reachable.

    ⛔ WHY: module-level KEY is the ANON key (see above). Of the DB_BACKED tables,
    nfl_ngs_* have RLS OFF so anon reads them, but nfl_team_scheme,
    nfl_qb_scheme_splits and nfl_rusher_box_splits have RLS ON with a single policy
    granted to `mcp_explorer` only. Anon therefore gets 200 with an EMPTY ARRAY, not an
    error — the exact failure shape that hides a broken pull. Service role bypasses RLS.
    """
    k = os.environ.get("SUPABASE_SERVICE_KEY")
    if not k:
        env = os.path.abspath(os.path.join(HERE, "..", "..", ".env.local"))
        try:
            for line in open(env):
                if line.startswith("SUPABASE_SERVICE_KEY="):
                    k = line.split("=", 1)[1].strip()
                    break
        except OSError:
            return None
    return {"apikey": k, "Authorization": f"Bearer {k}"} if k else None


def _cache(out, df):
    """Write a pulled frame to its parquet path so later steps in the same cron run reuse it.

    Always the FULL frame, never the caller's `columns` subset: the prop chain reads several
    of these twice with different column lists, and a truncated cache turns the second read
    into a KeyError. A read-only disk is fine — the frame is already in hand.
    """
    try:
        df.to_parquet(out, index=False)
    except Exception as e:
        print(f"  [local_or_db] could not cache {out}: {type(e).__name__}")


def local_or_db(name, columns=None):
    """Read data/<name>.parquet, or pull its Supabase source when the parquet is absent.

    Prefers the parquet so a box WITH the warehouse behaves exactly as before — this only
    changes what happens on a box without one, where the alternative is a crash. Writes the
    pull back to the parquet path so later steps in the same run reuse it.

    Raises FileNotFoundError naming the Supabase table when neither is available: a caller
    must fail loudly, never silently produce a page with the column missing.
    """
    out = os.path.join(DATA, f"{name}.parquet")
    if os.path.exists(out):
        return pd.read_parquet(out, columns=columns)
    # nflverse publishes some of these itself, so there is nothing to push to Supabase and
    # nothing to cache on this box: pull them from the source. FUNC_TABLES is defined below
    # (resolved at call time, not import time).
    if name in FUNC_TABLES:
        df = FUNC_TABLES[name]()
        print(f"  [local_or_db] {name}: parquet absent -> pulled {len(df):,} rows from nflverse")
        _cache(out, df)
        return df[list(columns)] if columns else df
    if name not in DB_BACKED:
        raise FileNotFoundError(
            f"{out} absent and {name} has no Supabase source — it derives from the local "
            f"scheme_plays/ftn_charting warehouse and must be pushed to Supabase to run here")
    table, order = DB_BACKED[name]
    df = fetch_table(table, order=order, hdrs=_service_hdrs())
    if len(df):
        df = df.rename(columns=DB_RENAME.get(name, {}))
    if len(df) == 0:
        # An RLS-hidden table returns 200 + [] rather than 403, so empty is never "fine".
        raise FileNotFoundError(
            f"{out} absent and Supabase {table} returned 0 rows — check the service key "
            f"and that RLS admits it (anon sees nothing on the scheme tables)")
    print(f"  [local_or_db] {name}: parquet absent -> pulled {len(df):,} rows from {table}")
    _cache(out, df)
    return df[list(columns)] if columns else df


def nflverse_games():
    """Schedule + results from nflverse (direct pull, not Supabase).

    Status-checked + retried: an unchecked GitHub error page used to parse into a
    frame with no home_score column and crash callers with a bare KeyError."""
    url = "https://github.com/nflverse/nfldata/raw/master/data/games.csv"
    for attempt in range(4):
        try:
            r = requests.get(url, timeout=120)
            r.raise_for_status()
            return pd.read_csv(io.StringIO(r.text))
        except Exception:
            if attempt == 3:
                raise
            time.sleep(3 * (attempt + 1))


def player_stats_def():
    """Defensive weekly player stats from nflverse (no cfb_automation table exists for these).

    ⛔ The combined `player_stats/player_stats_def.parquet` is FROZEN AT 2024. It still
    serves 200 and 239,955 rows, so nothing errored — but build() does
    `m[c] = m[c].fillna(0)` on h_dpt / a_dpt, so the model's three defensive-production
    features (h_dpt, a_dpt, dprod_team_diff) were identically ZERO for every 2026 game.
    Silent, like the pregame-feed break: no null, no exception, just a dead feature.
    Caught 2026-10-02 by research/feature_drift_guard.py flagging sd_ratio 0.000.

    nflverse moved current seasons to the `stats_player` release
    (`stats_player_week_<season>.parquet`). Pull those per season and fall back to the
    frozen combined file for the older years it still covers.
    """
    import datetime
    now = datetime.datetime.now(datetime.timezone.utc)
    cur = now.year if now.month >= 3 else now.year - 1   # NFL season rolls in March
    base = pd.read_parquet(
        "https://github.com/nflverse/nflverse-data/releases/download/player_stats/player_stats_def.parquet")
    frames = [base]
    newest = int(pd.to_numeric(base.season, errors="coerce").max())
    for y in range(newest + 1, cur + 1):
        try:
            d = pd.read_parquet(
                f"https://github.com/nflverse/nflverse-data/releases/download/stats_player/stats_player_week_{y}.parquet")
            frames.append(d[[c for c in base.columns if c in d.columns]])
            print(f"  [player_stats_def] +{len(d)} rows for {y} from stats_player")
        except Exception as e:
            print(f"  [player_stats_def] {y} unavailable ({type(e).__name__}) — skipped")
    out = pd.concat(frames, ignore_index=True)
    # Loud, because a silently-2024 feed is exactly what this wrapper exists to prevent.
    if int(pd.to_numeric(out.season, errors="coerce").max()) < cur:
        print(f"  ⚠ [player_stats_def] newest season is {out.season.max()}, expected {cur} — "
              f"h_dpt/a_dpt/dprod_team_diff will be ZERO for the live slate")
    return out


def nflverse_players():
    """The nflverse player directory — ids plus `headshot`, which the prop pages render.

    Only reachable as a download: players_xwalk.parquet was a one-off pull of this release
    and has no Supabase table, so a box without the parquet had no way to get a headshot.
    Status-checked by pandas/pyarrow, which raises on a non-parquet error page."""
    for attempt in range(4):
        try:
            return pd.read_parquet(
                "https://github.com/nflverse/nflverse-data/releases/download/players/players.parquet")
        except Exception:
            if attempt == 3:
                raise
            time.sleep(3 * (attempt + 1))


# local name -> nflverse loader fn (pulled directly, not from Supabase). local_or_db()
# consults this FIRST, so these names need no Supabase table and no DDL.
FUNC_TABLES = {"nflverse_games": nflverse_games, "player_stats_def": player_stats_def,
               "players_xwalk": nflverse_players}


def main():
    for name, (source, order) in TABLES.items():
        out = os.path.join(DATA, f"{name}.parquet")
        if os.path.exists(out) and not FORCE:
            print(f"  skip {name:20s} cached ({len(pd.read_parquet(out))} rows)")
            continue
        try:
            df = fetch_table(source, order=order)
            if name == "pregame" and not TRAIN:
                # history + upcoming slate; slate rows win on collision (they carry live lines)
                slate = fetch_table("v_nfl_slate_inputs", order=order)
                # slate serves game_time as 'HH:MM:SS'; history stores HHMM ints (900 = 9:00)
                if slate["game_time"].dtype == object:
                    slate["game_time"] = (slate["game_time"].str.slice(0, 5)
                                          .str.replace(":", "", regex=False).astype("int64"))
                for c in df.columns:
                    if df[c].dtype != slate[c].dtype:
                        try:
                            slate[c] = slate[c].astype(df[c].dtype)
                        except (ValueError, TypeError):
                            # int history col + nulls in slate: promote both to float;
                            # anything non-numeric falls back to object (never mixed parquet)
                            if pd.api.types.is_numeric_dtype(df[c].dtype):
                                df[c] = df[c].astype("float64")
                                slate[c] = pd.to_numeric(slate[c], errors="coerce")
                            else:
                                df[c] = df[c].astype(object)
                                slate[c] = slate[c].astype(object)
                df = (pd.concat([df, slate], ignore_index=True)
                        .drop_duplicates("unique_id", keep="last"))
                source = f"{source} + v_nfl_slate_inputs ({len(slate)} slate rows)"
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
