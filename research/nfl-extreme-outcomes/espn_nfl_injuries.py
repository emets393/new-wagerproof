"""ESPN pregame injury feed -> nfl_injuries_raw (CFB Supabase), current (season, week).

WHY ESPN: the nflverse injuries file is a post-week archive (one snapshot, rewritten Monday
morning after the games), and the Tuesday GitHub cron that mirrored it into nfl_injuries_raw
is disabled and broken anyway. Everything downstream — the props builder's report/practice
status, prop_rank's Out/Doubtful exclusion, the agents' prop shortlist, the regression
report's injury family — needs FRIDAY designations and SUNDAY inactives, i.e. a feed that
moves before kickoff. ESPN's injuries endpoint carries official designations (Out / Doubtful /
Questionable / IR), game-day inactives, and the practice note, updated continuously, no key.

Schema is unchanged (player_id = nflverse gsis_id via the committed players crosswalk), so
no consumer changes. Upsert on the table's (season, week, team, player_id) unique key.

Week gating: Out / IR rows persist regardless of date (they stay out until ESPN updates the
row); Questionable / Doubtful are game-week designations and are only kept when dated inside
the current week's window; Active rows are written with a NULL designation so a cleared
player overwrites last run's Questionable.

Usage: python3 espn_nfl_injuries.py            (auto-resolves season/week from the nflverse schedule)
       NFL_SEASON=2026 NFL_WEEK=2 python3 espn_nfl_injuries.py
"""
import io
import os
import re
import sys
from datetime import datetime, timedelta, timezone

import pandas as pd
import requests

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "data")
ESPN_URL = "https://site.api.espn.com/apis/site/v2/sports/football/nfl/injuries"
SCHED_URL = "https://github.com/nflverse/nfldata/raw/master/data/games.csv"
SUPA = "https://jpxnjuwglavsjbgbasnl.supabase.co/rest/v1/nfl_injuries_raw"
TABLE_KEY = "season,week,team,player_id"
# ESPN -> nflverse abbreviations (only two differ)
TEAM_MAP = {"WSH": "WAS", "LAR": "LA"}
STATUS_MAP = {"Out": "Out", "Doubtful": "Doubtful", "Questionable": "Questionable",
              "Injured Reserve": "Out", "Active": None}


def service_key():
    for fn in (os.path.join(HERE, "..", "..", ".env.local"), os.path.join(HERE, "..", "..", ".env")):
        if os.path.exists(fn):
            for line in open(fn):
                if line.startswith("SUPABASE_SERVICE_KEY="):
                    return line.split("=", 1)[1].strip()
    return os.environ.get("SUPABASE_SERVICE_KEY")


def resolve_week():
    """Same rule as resolve_nfl_week.py (first REG week with a game still to kick off), pulled
    live so this runs before fetch.py has cached the schedule. Returns season, week,
    window_start (UTC) = 6 days before the week's first kickoff date."""
    if os.environ.get("NFL_SEASON") and os.environ.get("NFL_WEEK"):
        season, week = int(os.environ["NFL_SEASON"]), int(os.environ["NFL_WEEK"])
        g = pd.read_csv(io.StringIO(requests.get(SCHED_URL, timeout=120).text))
    else:
        g = pd.read_csv(io.StringIO(requests.get(SCHED_URL, timeout=120).text))
        g = g[g.game_type == "REG"]
        season = int(g.season.max())
        s = g[g.season == season]
        from resolve_nfl_week import open_games   # same kickoff-aware rule as the runner
        open_weeks = open_games(s)["week"]
        week = int(open_weeks.min()) if len(open_weeks) else int(s.week.max())
    wk = g[(g.season == season) & (g.week == week) & (g.game_type == "REG")]
    first = pd.to_datetime(wk.gameday).min()
    window_start = (first - timedelta(days=6)).to_pydatetime().replace(tzinfo=timezone.utc)
    return season, week, window_start


def practice_status(text):
    t = (text or "").lower()
    if re.search(r"did not (practice|participate)|didn't practice|dnp\b|no practice|sat out (of )?practice", t):
        return "Did Not Participate In Practice"
    if re.search(r"limited (participant|practice|in practice)|limited\b.*practice", t):
        return "Limited Participation in Practice"
    if re.search(r"full (participant|practice|in practice)|practiced (fully|in full)|full participation", t):
        return "Full Participation in Practice"
    return None


PLAYERS_URL = "https://github.com/nflverse/nflverse-data/releases/download/players/players.parquet"


def load_players():
    """Live nflverse players file (espn_id -> gsis_id). The committed players_xwalk.parquet
    goes stale within a season: 2026 rookies carried esb-style ids in its gsis_id column
    while the props tables key them by their real gsis id, so the join silently missed
    every rookie. Cache 12h; fall back to the committed file only if the download fails."""
    cols = ["gsis_id", "espn_id", "display_name", "latest_team", "position"]
    live = os.path.join(DATA, "players_live.parquet")
    fresh = os.path.exists(live) and (datetime.now().timestamp() - os.path.getmtime(live)) < 12 * 3600
    if not fresh:
        try:
            r = requests.get(PLAYERS_URL, timeout=120); r.raise_for_status()
            open(live, "wb").write(r.content)
        except Exception as e:
            print(f"[espn-injuries] players download failed ({e}) — using committed crosswalk")
    src = live if os.path.exists(live) else os.path.join(DATA, "players_xwalk.parquet")
    xw = pd.read_parquet(src, columns=cols)
    # only real gsis ids are join keys downstream; anything else is an nflverse placeholder
    return xw[xw.gsis_id.fillna("").str.startswith("00-")]


def espn_id(athlete):
    blob = " ".join(l.get("href", "") for l in athlete.get("links", [])) + " " + str((athlete.get("headshot") or {}).get("href", ""))
    m = re.search(r"/id/(\d+)", blob) or re.search(r"/(\d+)\.png", blob)
    return m.group(1) if m else None


def main():
    season, week, window_start = resolve_week()
    print(f"[espn-injuries] season={season} week={week} window_start={window_start:%Y-%m-%d}")
    # ESPN 403s browser user agents on this endpoint; the default python-requests UA is accepted
    feed = requests.get(ESPN_URL, timeout=60)
    feed.raise_for_status()
    xw = load_players()
    by_espn = (xw[xw.espn_id.notna()].assign(espn_id=lambda d: d.espn_id.astype(str).str.replace(r"\.0$", "", regex=True))
               .drop_duplicates("espn_id").set_index("espn_id").gsis_id)
    by_name_team = xw.drop_duplicates(["display_name", "latest_team"]).set_index(["display_name", "latest_team"]).gsis_id
    name_counts = xw.display_name.value_counts()
    by_name = xw[xw.display_name.map(name_counts) == 1].set_index("display_name").gsis_id

    rows, n_feed, matched = [], 0, {"espn": 0, "name_team": 0, "name": 0, "none": 0}
    for team_blk in feed.json().get("injuries", []):
        for inj in team_blk.get("injuries", []):
            n_feed += 1
            a = inj.get("athlete", {})
            tm = (a.get("team") or {}).get("abbreviation") or ""
            tm = TEAM_MAP.get(tm, tm)
            status = inj.get("status")
            if status not in STATUS_MAP or not tm:
                continue
            report = STATUS_MAP[status]
            dt = pd.to_datetime(inj.get("date"), utc=True, errors="coerce")
            # game-week designations only count inside this week's window
            if report in ("Questionable", "Doubtful") and (pd.isna(dt) or dt < window_start):
                continue
            eid = espn_id(a)
            name = a.get("displayName")
            pid = by_espn.get(eid) if eid else None
            if pid is not None:
                matched["espn"] += 1
            elif (name, tm) in by_name_team.index:
                pid = by_name_team[(name, tm)]; matched["name_team"] += 1
            elif name in by_name.index:
                pid = by_name[name]; matched["name"] += 1
            else:
                pid = f"espn:{eid or name}"; matched["none"] += 1
            details = inj.get("details") or {}
            comment = inj.get("shortComment") or inj.get("longComment") or ""
            rows.append(dict(season=season, week=week, team=tm, player_id=pid, player_name=name,
                             position=(a.get("position") or {}).get("abbreviation"),
                             report_status=report, practice_status=practice_status(comment),
                             body_part=details.get("type") if details.get("type") not in (None, "Not Specified") else None,
                             date_modified=None if pd.isna(dt) else dt.isoformat()))
    df = pd.DataFrame(rows)
    if df.empty:
        print("[espn-injuries] no rows parsed — leaving table untouched"); return
    # one row per key: newest ESPN entry wins
    df = df.sort_values("date_modified").drop_duplicates(["season", "week", "team", "player_id"], keep="last")
    print(f"[espn-injuries] feed rows={n_feed} kept={len(df)} teams={df.team.nunique()} "
          f"| status {df.report_status.fillna('none').value_counts().to_dict()} | id match {matched}")

    key = service_key()
    if not key:
        print("[espn-injuries] no SUPABASE_SERVICE_KEY — dry run"); return
    hdr = {"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json",
           "Prefer": "resolution=merge-duplicates,return=minimal"}
    recs = df.astype(object).where(df.notna(), None).to_dict("records")
    for i in range(0, len(recs), 500):
        r = requests.post(f"{SUPA}?on_conflict={TABLE_KEY}", headers=hdr, json=recs[i:i + 500], timeout=60)
        if r.status_code not in (200, 201):
            sys.exit(f"[espn-injuries] upsert failed: {r.status_code} {r.text[:300]}")
    print(f"[espn-injuries] upserted {len(recs)} rows -> nfl_injuries_raw ({season} w{week})")


if __name__ == "__main__":
    main()
