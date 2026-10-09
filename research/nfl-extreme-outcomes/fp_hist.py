"""Fantasy Points table loader that survives a fresh Render clone.

fp_pull.py's consolidate() rebuilds data/fpdata/<tool>__<scope>.parquet from the raw cells on the
job's OWN disk, so on Render a table holds only the weeks that job pulled (this season). The
prior season lives in data/fpdata_hist/ — git-tracked copies of the tables the weekly report
builders need (nfl_matchup_facts.py, nfl_prop_narratives.py, player_chain.py). read_fp() merges
hist + current, the freshly pulled cell winning on overlap, so the same code runs identically on a
laptop with full history and on Render with hist + this season.

Adding a table to a builder: copy it into data/fpdata_hist (same relative path, flat/ included)
and `git add -f` it — research/.gitignore excludes *.parquet by default."""
import os
import pandas as pd

HERE = os.path.dirname(os.path.abspath(__file__))
KEYS = ("__season", "__week", "playerPlayerId", "teamNickname", "teamTeamId", "gameGameId")


# Tables whose CURRENT-season rows arrive from fp_pull under a different file name than the
# historical copy. fp_pull's consolidate() writes `<tool>__<scope>.parquet` (camelCase); a few
# tracked hist tables came from an older hyphenated export. Without the alias the hist copy is
# the only source on Render and silently freezes as the season goes on — and when the hist copy
# is also missing the builder just dies (score_props_week, 2026-09-22). Verified before adding:
# the two files' stat values are identical on every overlapping (player, week).
# ⛔ Only ONE alias was ever filled in, so the other nine tables score_props_week reads did
# exactly what the paragraph above warns about: froze at 2026 week 1 for the whole season. The
# prop model's "this season to date" term was week 1 alone at weight 1/(4+1) instead of weeks
# 1-3 at 3/(4+3) — wrong content AND wrong weight — and nfl_prop_narratives inherited it.
# Verified per the rule above before adding: on 2026 wk1, the only week in both sources, the
# hist and tool copies agree on 464 matched player-games with max |diff| = 0.0000. The tool
# file carries fewer rows (consolidate drops the empty-stat roster players the flat export
# kept) and a few extra context columns, none of which the scorer reads.
ALIAS = {
    "player_receiving-separation-by-alignment": "receivingSeparationByAlignment__player",
    "player_receiving-advanced":                "receivingAdvanced__player",
    "player_rushing-advanced":                  "rushingAdvanced__player",
    "player_rushing-bell-cow":                  "rushingBellCow__player",
    "player_passing-advanced":                  "passingAdvanced__player",
    "team_run-pass-report":                     "runPassReport__team",
    "team_defense_rushing-advanced":            "rushingAdvanced__opponent",
    "team_defense_coverage-matrix":             "coverageMatrix__opponent",
    "team_defense_passing-advanced":            "passingAdvanced__opponent",
    "team_defense_receiving-advanced":          "receivingAdvanced__opponent",
}


# ---------------------------------------------------------------- Supabase as a merge source
# fp_prop_payload.py needs the FULL warehouse — the route tree, coverage shells, alignment splits
# and throw-depth bands all live in each row's `bucket` dict — and a Render clone holds only the
# weeks that job pulled, so the payload built there was silently degraded on a fraction of the
# season. Owner decision 2026-10-07: build it from Supabase so it runs anywhere.
#
# The buckets were ALREADY being loaded: `bucket` matches no IDENT_PREFIX in fp_load.to_row, so it
# has always passed through into the `stats` jsonb. All six split tables are present with full
# 2021+ history. Nothing needed loading — only this read path, which was parquet-only.
#
# Opt-in via FP_SUPABASE=1 so a laptop with complete parquets behaves exactly as before and only
# Render pays the fetch. Merged at LOWEST priority, so a freshly pulled local cell still wins.


def _supabase_frame(table):
    """fp_data rows for one `<tool>__<scope>` table, reshaped back to the parquet's columns."""
    import requests
    key = os.environ.get("SUPABASE_SERVICE_KEY")
    if not key:
        env = os.path.join(HERE, "..", "..", ".env.local")
        if os.path.exists(env):
            for ln in open(env):
                if ln.startswith("SUPABASE_SERVICE_KEY="):
                    key = ln.split("=", 1)[1].strip()
    if not key or "__" not in table:
        return None
    tool, scope = table.rsplit("__", 1)
    url = "https://jpxnjuwglavsjbgbasnl.supabase.co/rest/v1/fp_data"
    hdr = {"apikey": key, "Authorization": f"Bearer {key}"}
    q = f"tool=eq.{tool}&scope=eq.{scope}"
    # read inside the call, not at import: a module-level constant cannot be set by a caller that
    # has already imported this module, which is exactly how the first test of this silently
    # fetched all four seasons while asking for one.
    seasons = os.environ.get("FP_SEASONS", "")     # e.g. "2025,2026"; blank = all
    if seasons:
        q += "&season=in.(" + ",".join(x.strip() for x in seasons.split(",") if x.strip()) + ")"
    rows, off = [], 0
    while True:
        r = requests.get(f"{url}?{q}&limit=1000&offset={off}", headers=hdr, timeout=120)
        if r.status_code != 200:
            print(f"  ! fp_data {table} {r.status_code}: {r.text[:120]}")
            return None
        j = r.json()
        rows += j
        if len(j) < 1000:
            break
        off += 1000
    if not rows:
        return None
    d = pd.DataFrame(rows)
    st = pd.json_normalize(d.stats.apply(lambda x: x if isinstance(x, dict) else {}), max_level=0)
    out = pd.concat([d.drop(columns=["stats"]), st], axis=1)
    # Put back the identity columns the builders read. fp_load folds nickname into team_name as
    # "<Location> <Nickname>"; every NFL nickname is one word, so the last token recovers it.
    out = out.rename(columns={"season": "gameSeason", "week": "gameWeek",
                              "game_id": "gameGameId", "opponent": "opponentAbbreviation",
                              "position": "playerPosition", "is_home": "teamIsHomeTeam"})
    out["playerPlayerId" if scope == "player" else "teamTeamId"] = out.entity_id
    nm = out.team_name.fillna("")
    out["teamNickname"] = nm.str.rsplit(" ", n=1).str[-1].replace("", None)
    out["teamAbbreviation"] = out.get("team")
    out["__season"], out["__week"] = out.gameSeason, out.gameWeek
    return out.drop(columns=[c for c in ("id", "loaded_at", "tool", "scope", "entity_id",
                                         "entity_name", "team", "team_name", "pulled_at")
                             if c in out.columns])


def read_fp(table, flat=False):
    parts = []
    names = [table] + ([ALIAS[table]] if table in ALIAS and not flat else [])
    # lowest priority, so a freshly pulled local cell still wins on overlap
    if os.environ.get("FP_SUPABASE") == "1" and not flat:
        for name in names:
            sb = _supabase_frame(name)
            if sb is not None:
                parts.append(sb)
                break
    for base in ("data/fpdata_hist", "data/fpdata"):
        for name in names:
            p = os.path.join(HERE, base, "flat" if flat else "", name + ".parquet")
            if os.path.exists(p):
                parts.append(pd.read_parquet(p))
    if not parts:
        raise FileNotFoundError(f"{table}.parquet not in data/fpdata or data/fpdata_hist")
    d = pd.concat(parts, ignore_index=True)
    keys = [c for c in KEYS if c in d.columns]
    d = d.drop_duplicates(subset=keys, keep="last") if keys else d
    _warn_if_stale(table, d)
    return d


def freshness(d):
    """(latest season, latest week in it) for a table read by read_fp, or (None, None)."""
    if "__season" not in d.columns or "__week" not in d.columns or not len(d):
        return None, None
    s = pd.to_numeric(d["__season"], errors="coerce")
    if not s.notna().any():
        return None, None
    smax = int(s.max())
    w = pd.to_numeric(d.loc[s == smax, "__week"], errors="coerce")
    return smax, (int(w.max()) if w.notna().any() else None)


def expected_week():
    """Last completed NFL week, from fp_pull's own resolver. None if it can't be determined."""
    try:
        from fp_pull import current_season_week
        return current_season_week()
    except Exception:
        return None, None


def _warn_if_stale(table, d, _seen=set()):
    """Shout when a table does not reach the last completed week.

    This is the whole reason the week-1 freeze ran for three weeks undetected: every
    consumer read a table that silently stopped in September, and nothing compared it to
    the calendar. No exception — a stale table still beats no report — but it has to be
    impossible to miss in the job log, and `scripts: grep -c '\\[fp-stale\\]'` makes it
    alertable.
    """
    s_now, wk_done = expected_week()
    if s_now is None or table in _seen:
        return
    season, week = freshness(d)
    if season is None:
        return
    if season < s_now or (week is not None and week < wk_done):
        _seen.add(table)
        print(f"  ⛔ [fp-stale] {table}: newest row is {season} wk{week}, expected {s_now} "
              f"wk{wk_done} — aggregates built on this are behind by "
              f"{(wk_done - week) if (season == s_now and week is not None) else 'a full season'} "
              f"week(s). Run fp_pull.py --tools <tool> --seasons {s_now} --weeks 1-18.")
