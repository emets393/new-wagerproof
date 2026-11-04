#!/usr/bin/env python3
"""Pull CFBD's OFFICIAL opponent-adjusted team metrics (/wepa/team/season).

WHY THIS EXISTS
  build_ratings.py computes our OWN opponent adjustment (12 plain iterations) because the
  adjusted numbers used to arrive only as a weekly emailed CSV. They don't -- CFBD serves
  them, and `/wepa/team/season` reproduces that CSV exactly: validated 2026-11-04 against
  training_data_2026_week10.csv at 744 of 744 values for epa (total/passing/rushing),
  epaAllowed, successRate and rushing.lineYards. The ONLY field that disagrees is
  `explosiveness` (CSV ~1.28 vs API ~0.95 -- a different normalisation), so that one is
  carried under its API definition and must not be compared across the two sources.

  Our replication is close but materially noisier. Measured 2026 week 9, 138 FBS teams:

      metric             corr   our sd   official sd
      adj_epa           0.938   0.1326   0.0747        <- ~1.8x over-dispersed
      adj_epa_allowed   0.931   0.1243   0.0723
      adj_passing_epa   0.864   0.2101   0.0826        <- ~2.5x
      adj_rushing_epa   0.895   0.1215   0.0531
      adj_success       0.963   0.0574   0.0407
      adj_line_yards    0.886   0.3303   0.1563

  CFBD shrinks toward the mean far harder than our un-regularised iteration does, so our
  ratings push teams with few or extreme games too far out. Typical error on adj_epa is
  0.134 against an official spread of 0.075 -- nearly two official SDs.

⛔ THE ENDPOINT HAS NO `week` PARAMETER. Every response is season-to-date AS OF THE MOMENT
  YOU CALL IT. That makes it correct for serving the upcoming week and USELESS as history:
  pulling 2019 today returns 2019's FINAL numbers, which leak if joined to a 2019 week-5
  game. So this writes an append-only SNAPSHOT keyed (season, thru_week, team) -- the same
  shape fetch_preseason_ratings.py uses for core_snapshots/core_asof -- and real as-of
  history accumulates one honest week at a time from the first run forward. Do NOT backfill
  prior weeks from this endpoint; build_ratings.py remains the only leak-safe source for
  weeks already played.

OUTPUTS
  data/cfbd/wepa_snapshots.parquet  append-only, one row per (season, thru_week, team, pull)
  data/cfbd/wepa_asof.parquet       latest pull per (season, thru_week, team) -- join target

USAGE
  python3 fetch_cfbd_wepa.py                 # current season, thru_week inferred
  python3 fetch_cfbd_wepa.py --season 2026 --thru-week 9
  python3 fetch_cfbd_wepa.py --seasons 2016-2026   # season-FINAL rows only (thru_week=99)
"""
import argparse
import datetime as dt
import os

import pandas as pd

import cfbd

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "data", "cfbd")

# API dotted path -> our column name. Deliberately mirrors build_ratings.py's adj_* naming so
# this frame is a drop-in comparison/replacement for team_ratings_asof.parquet.
FIELDS = {
    "epa.total": "adj_epa",
    "epa.passing": "adj_passing_epa",
    "epa.rushing": "adj_rushing_epa",
    "epaAllowed.total": "adj_epa_allowed",
    "epaAllowed.passing": "adj_passing_epa_allowed",
    "epaAllowed.rushing": "adj_rushing_epa_allowed",
    "successRate.total": "adj_success",
    "successRate.standardDowns": "adj_standard_down_success",
    "successRate.passingDowns": "adj_passing_down_success",
    "successRateAllowed.total": "adj_success_allowed",
    "successRateAllowed.standardDowns": "adj_standard_down_success_allowed",
    "successRateAllowed.passingDowns": "adj_passing_down_success_allowed",
    "rushing.lineYards": "adj_line_yards",
    "rushing.secondLevelYards": "adj_second_level_yards",
    "rushing.openFieldYards": "adj_open_field_yards",
    "rushing.highlightYards": "adj_highlight_yards",
    "rushingAllowed.lineYards": "adj_line_yards_allowed",
    "rushingAllowed.secondLevelYards": "adj_second_level_yards_allowed",
    "rushingAllowed.openFieldYards": "adj_open_field_yards_allowed",
    "rushingAllowed.highlightYards": "adj_highlight_yards_allowed",
    # API definition, NOT the emailed CSV's -- see the docstring.
    "explosiveness": "adj_explosiveness_api",
    "explosivenessAllowed": "adj_explosiveness_allowed_api",
}


def _flat(d, pre=""):
    out = {}
    for k, v in (d or {}).items():
        if isinstance(v, dict):
            out.update(_flat(v, pre + k + "."))
        elif isinstance(v, (int, float)) and not isinstance(v, bool):
            out[pre + k] = v
    return out


def last_completed_week(season):
    """Highest FULLY-completed regular-season week, plus the partially-played week if any.

    "Highest week with any completed game" is the wrong label and it is an easy mistake:
    run on a Wednesday, CFBD already has 2 of week 10's 62 games final (the midweek MAC
    games), and the snapshot gets stamped thru_week=10 while containing almost none of
    week 10. Anything joining "metrics as of week 10" to week-10 games then shifts by one.

    So thru_week is the last week with NO unplayed games, and the in-progress week is
    recorded separately in partial_week. The join rule is therefore unambiguous:
    a snapshot with thru_week=W is safe to join to games in week > W.

    classification="fbs" is REQUIRED, not a tidy-up. Unfiltered, /games carries D2/D3 games
    (Erskine@Thomas, Hardin Simmons@Nelson) that CFBD never marks completed, so no week ever
    reaches 100% and a strict rule collapses to nonsense -- it returned thru_week=6 with
    "week 2 in progress" in November. Filtered to FBS, 2026 weeks 1-9 are exactly 100% and
    week 10 is 3.2%, so the strict rule is correct and needs no fudge factor.
    """
    try:
        games = cfbd.get("/games", year=season, seasonType="regular", classification="fbs")
    except Exception:
        return None, None
    done, total = {}, {}
    for g in games:
        w = g.get("week")
        if not w:
            continue
        total[w] = total.get(w, 0) + 1
        if g.get("completed") or g.get("status") == "completed":
            done[w] = done.get(w, 0) + 1
    full = [w for w in sorted(total) if done.get(w, 0) == total[w]]
    partial = [w for w in sorted(total) if 0 < done.get(w, 0) < total[w]]
    return (max(full) if full else None), (min(partial) if partial else None)


def season_over(season):
    """Is every game of this season in the past? Date-based ON PURPOSE.

    The obvious test -- "no game lacks a completed flag" -- is wrong for history: 2024 has a
    game CFBD never marked completed (a cancellation), so a flag-based check reported 2024
    "still in progress, week 5 unplayed" two years after it ended. Kickoff dates cannot go
    stale that way, so a season is final once nothing is left to kick.
    """
    try:
        games = cfbd.get("/games", year=season, seasonType="regular", classification="fbs")
    except Exception:
        return False
    now = dt.datetime.now(dt.timezone.utc)
    future = [g for g in games if g.get("startDate")
              and dt.datetime.fromisoformat(str(g["startDate"]).replace("Z", "+00:00")) > now]
    return not future


def pull(season, thru_week, partial_week=None):
    rows = cfbd.get("/wepa/team/season", year=season)
    now = dt.datetime.now(dt.timezone.utc)
    recs = []
    for r in rows:
        F = _flat(r)
        rec = {"season": int(r.get("year") or season), "thru_week": thru_week,
               "partial_week": partial_week,
               "team": r.get("team"), "conference": r.get("conference"),
               "team_id": r.get("teamId"), "pulled_at": now}
        for path, col in FIELDS.items():
            rec[col] = F.get(path)
        recs.append(rec)
    return pd.DataFrame(recs)


def write(df):
    os.makedirs(OUT, exist_ok=True)
    snap_p = os.path.join(OUT, "wepa_snapshots.parquet")
    snap = pd.concat([pd.read_parquet(snap_p), df], ignore_index=True) \
        if os.path.exists(snap_p) else df
    # Re-running the same week is normal (the cron fires 3x a day). Keep ONE row per as-of
    # week -- the newest pull. Including pulled_at in the key would retain every intra-week
    # pull, which adds ~400 rows/day of pure duplication: thru_week is fixed inside a week,
    # so the metrics cannot move between pulls.
    snap = (snap.sort_values("pulled_at")
                .drop_duplicates(["season", "thru_week", "team"], keep="last"))
    snap.to_parquet(snap_p, index=False)

    asof = (snap.sort_values("pulled_at")
                .drop_duplicates(["season", "thru_week", "team"], keep="last")
                .reset_index(drop=True))
    asof.to_parquet(os.path.join(OUT, "wepa_asof.parquet"), index=False)
    return snap, asof


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--season", type=int)
    ap.add_argument("--seasons", help="e.g. 2016-2026 -- writes season-FINAL rows (thru_week=99)")
    ap.add_argument("--thru-week", type=int)
    a = ap.parse_args()

    frames = []
    if a.seasons:
        lo, hi = (int(x) for x in a.seasons.split("-"))
        for y in range(lo, hi + 1):
            # thru_week=99 means "season complete" -- it exists so a final can never be
            # mistaken for an as-of week. Stamping an IN-PROGRESS season 99 would do exactly
            # the harm the sentinel prevents, so the current season is refused here and must
            # be pulled through the normal as-of path instead.
            if not season_over(y):
                print(f"  {y}: SKIPPED -- season still has unplayed games. "
                      f"Run without --seasons for an as-of snapshot.")
                continue
            d = pull(y, 99, None)
            print(f"  {y}: {len(d)} teams (season-final, thru_week=99)")
            frames.append(d)
    else:
        season = a.season or (dt.date.today().year if dt.date.today().month >= 7
                              else dt.date.today().year - 1)
        wk, partial = (a.thru_week, None) if a.thru_week is not None else last_completed_week(season)
        if wk is None:
            raise SystemExit(f"[wepa] no fully-completed {season} week yet and no --thru-week given")
        d = pull(season, wk, partial)
        print(f"  {season}: {len(d)} teams, thru_week={wk}"
              + (f" (week {partial} in progress, partially included)" if partial else ""))
        frames.append(d)

    if not frames:
        raise SystemExit("[wepa] nothing to write (every requested season was skipped)")
    df = pd.concat(frames, ignore_index=True)
    miss = [c for c in FIELDS.values() if df[c].isna().all()]
    if miss:
        print(f"[wepa] WARNING: all-null columns (endpoint shape may have changed): {miss}")
    snap, asof = write(df)
    print(f"[wepa] wrote {len(df)} rows -> wepa_snapshots.parquet ({len(snap)} total), "
          f"wepa_asof.parquet ({len(asof)} rows)")
    print(f"[wepa] adj_epa: mean={df.adj_epa.mean():+.4f} sd={df.adj_epa.std():.4f} "
          f"range {df.adj_epa.min():+.4f}..{df.adj_epa.max():+.4f}")


if __name__ == "__main__":
    main()
