"""Populate nfl_slate_games.assigned_referee for the slate.

Ref trends attach to a matchup via the assigned head referee, but the slate builder
doesn't carry it. For the slate we source assignments from nflverse (completed-game
referees). In production this should be replaced by the weekly NFL ref-assignment feed
(released ~Wednesday) — same target column.

Run AFTER the slate is built (it PATCHes existing rows). Idempotent.
Usage:  python3 backfill_slate_referees.py
"""
import io
import os
import sys
from pathlib import Path

import pandas as pd
import requests

ROOT = Path(__file__).resolve().parent
BASE_URL = "https://jpxnjuwglavsjbgbasnl.supabase.co/rest/v1"
SEASON = int(os.environ.get("NFL_SEASON", 2025))
WEEK = int(os.environ.get("NFL_WEEK", 12))
GAMES_CSV = "https://github.com/nflverse/nfldata/raw/master/data/games.csv"
NORM = {"LAR": "LA", "WSH": "WAS", "JAC": "JAX", "OAK": "LV", "SD": "LAC", "STL": "LA"}


def load_key():
    for line in (ROOT.parent.parent / ".env.local").read_text().splitlines():
        if line.startswith("SUPABASE_SERVICE_KEY="):
            return line.split("=", 1)[1].strip()
    sys.exit("SUPABASE_SERVICE_KEY not found in .env.local")


NICK_AB = {"Patriots": "NE", "Seahawks": "SEA", "49ers": "SF", "Rams": "LA", "Bears": "CHI",
           "Panthers": "CAR", "Buccaneers": "TB", "Bengals": "CIN", "Saints": "NO", "Lions": "DET",
           "Bills": "BUF", "Texans": "HOU", "Ravens": "BAL", "Colts": "IND", "Browns": "CLE",
           "Jaguars": "JAX", "Falcons": "ATL", "Steelers": "PIT", "Jets": "NYJ", "Titans": "TEN",
           "Cardinals": "ARI", "Chargers": "LAC", "Dolphins": "MIA", "Raiders": "LV",
           "Packers": "GB", "Vikings": "MIN", "Commanders": "WAS", "Eagles": "PHI",
           "Cowboys": "DAL", "Giants": "NYG", "Broncos": "DEN", "Chiefs": "KC"}


def fz_assignments():
    """PREGAME crew assignments from Football Zebras (posted ~Tuesday for the week).
    nflverse only carries referees for COMPLETED games, so without this the ref
    trends could never light up before kickoff (owner, 2026-09-08). Returns a
    frame shaped like the nflverse path (home_ab/away_ab/referee) or None."""
    import re
    import html as _html
    ua = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"}
    try:
        cat = requests.get("https://www.footballzebras.com/category/assignments/",
                           headers=ua, timeout=30).text
        m = re.search(rf'href="(https://www\.footballzebras\.com/\d{{4}}/\d{{2}}/'
                      rf'week-{WEEK}-referee-assignments-{SEASON}/?)"', cat)
        if not m:
            return None
        page = requests.get(m.group(1), headers=ua, timeout=30).text
        art = re.search(r"<article.*?</article>", page, re.S)
        txt = _html.unescape(re.sub(r"<[^>]+>", "\n", art.group(0) if art else page))
        lines = [l.strip() for l in txt.split("\n") if l.strip()]
        rows = []
        for i, l in enumerate(lines[:-1]):
            mm = re.match(r"^([A-Za-z49\s]+) at ([A-Za-z\s]+)$", l)
            if not mm:
                continue
            away, home = NICK_AB.get(mm.group(1).strip()), NICK_AB.get(mm.group(2).strip())
            ref = lines[i + 1].strip()
            if away and home and re.match(r"^[A-Z][a-z]+ [A-Z][A-Za-z'.-]+", ref):
                rows.append({"home_ab": home, "away_ab": away, "referee": ref})
        return pd.DataFrame(rows) if rows else None
    except Exception as e:
        print(f"[refs] footballzebras fetch failed ({e}) — falling back to nflverse")
        return None


def main():
    g = fz_assignments()
    if g is not None and len(g):
        print(f"[refs] {len(g)} pregame crew assignments from Football Zebras")
    else:
        g = pd.read_csv(io.StringIO(requests.get(GAMES_CSV, timeout=90).text))
        g = g[(g.season == SEASON) & (g.week == WEEK) & g.referee.notna()].copy()
        g["home_ab"] = g.home_team.replace(NORM)
        g["away_ab"] = g.away_team.replace(NORM)
    if not len(g):
        print(f"[refs] no referee assignments available for {SEASON} wk{WEEK} yet — skipping")
        return
    key = load_key()
    hdr = {"apikey": key, "Authorization": f"Bearer {key}",
           "Content-Type": "application/json", "Prefer": "return=minimal"}
    n = 0
    for r in g.itertuples():
        resp = requests.patch(
            f"{BASE_URL}/nfl_slate_games?season=eq.{SEASON}&week=eq.{WEEK}"
            f"&home_ab=eq.{r.home_ab}&away_ab=eq.{r.away_ab}",
            headers=hdr, json={"assigned_referee": r.referee}, timeout=60)
        if resp.status_code in (200, 204):
            n += 1
    print(f"[refs] set assigned_referee on {n}/{len(g)} games for {SEASON} wk{WEEK}")


if __name__ == "__main__":
    main()
