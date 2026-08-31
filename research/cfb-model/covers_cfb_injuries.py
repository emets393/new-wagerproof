"""Scrape covers.com CFB injuries -> data/injuries/cfb_injuries_{season}_w{week}.parquet

ONE page, all ~130 FBS teams, grouped by team (chosen over teamrankings'
per-matchup URLs — see memory cfb-qb-injury-trigger). Contract consumed by
qb_availability.py: season, week, team ("School Mascot"), school, mascot,
player, pos, status, detail, reported.

covers abbreviates first names ("C. Harrell") — downstream matching handles it.
Dependency-free parsing (regex only). Usage: python3 covers_cfb_injuries.py <season> <week>
"""
import html as _html
import re
import sys
from pathlib import Path

import pandas as pd
import requests

ROOT = Path(__file__).resolve().parent
URL = "https://www.covers.com/sport/football/ncaaf/injuries"
UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126.0 Safari/537.36")


def fetch_html() -> str:
    r = requests.get(URL, headers={"User-Agent": UA}, timeout=45)
    r.raise_for_status()
    return r.text


def parse(html: str) -> pd.DataFrame:
    rows = []
    # Team sections open with the team-name block; player rows follow until the
    # next team block. Split on the teamName div to scope rows to teams.
    chunks = re.split(r'covers-CoversMatchups-teamName', html)[1:]
    for chunk in chunks:
        m = re.search(r'>\s*([^<>]+?)<br><span>([^<>]*)</span>', chunk)
        if not m:
            continue
        school = " ".join(m.group(1).split())
        mascot = " ".join(m.group(2).split())
        for pm in re.finditer(
            r"player-link'>\s*(.*?)\s*</span>.*?<td>([A-Z]{1,4})</td>\s*"
            r"<td><b>([^<]+)</b>(?:<br>\(\s*([^)]*)\))?",
            chunk, re.S,
        ):
            player = _html.unescape(" ".join(pm.group(1).split()))
            pos = pm.group(2)
            status_full = pm.group(3).strip()
            status, _, detail = (p.strip() for p in status_full.partition("-"))
            rows.append(dict(school=school, mascot=mascot, team=f"{school} {mascot}".strip(),
                             player=player, pos=pos, status=status, detail=detail,
                             reported=" ".join((pm.group(4) or "").split())))
    return pd.DataFrame(rows)


def load_supabase(df: pd.DataFrame, season: int, week: int) -> None:
    """Publish to cfb_injuries (CFB Supabase) — MCP-connector users query it via
    query_sports_database. Wipe-and-insert per (season, week)."""
    key = None
    for fn in (ROOT.parent.parent / ".env.local", ROOT.parent.parent / ".env"):
        if fn.exists():
            for line in fn.read_text().splitlines():
                if line.startswith("SUPABASE_SERVICE_KEY="):
                    key = line.split("=", 1)[1].strip()
    if not key:
        print("  [supabase] no service key — parquet only")
        return
    base = "https://jpxnjuwglavsjbgbasnl.supabase.co/rest/v1/cfb_injuries"
    hdr = {"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json"}
    requests.delete(f"{base}?season=eq.{season}&week=eq.{week}", headers=hdr, timeout=60)
    recs = df.to_dict("records")
    for i in range(0, len(recs), 500):
        r = requests.post(base, headers=hdr, json=recs[i:i + 500], timeout=60)
        if r.status_code != 201:
            print(f"  [supabase] insert failed: {r.status_code} {r.text[:200]}")
            return
    print(f"  [supabase] {len(recs)} rows -> cfb_injuries ({season} w{week})")


def main():
    if len(sys.argv) < 3:
        sys.exit("usage: covers_cfb_injuries.py <season> <week>")
    season, week = int(sys.argv[1]), int(sys.argv[2])
    df = parse(fetch_html())
    if df.empty:
        sys.exit("parsed 0 injury rows — covers markup changed?")
    df.insert(0, "season", season)
    df.insert(1, "week", week)
    # CFBD-canonical team resolved at load (same philosophy as venue resolution:
    # consumers join clean; get_game_detail attaches injuries on this column).
    try:
        import qb_availability as QA
        cfbd_teams = set(pd.read_parquet(ROOT / "data" / "cfbd" / "qb_starts.parquet").team)
        df["cfbd_team"] = [QA.map_team(t, cfbd_teams) for t in df.team]
        n_un = int(df.cfbd_team.isna().sum())
        if n_un:
            print(f"  [cfbd_team] {n_un} rows unmapped (FCS/nonstandard names)")
    except Exception as e:
        print(f"  [cfbd_team] mapping skipped: {e}")
        df["cfbd_team"] = None
    # Covers' school name IS the CFBD-style name for FBS teams, so it backstops
    # whenever the parquet-based mapper is unavailable (Render clones lack
    # data/cfbd/) or leaves a row unmapped. NULL here silently drops every
    # injury from the regression report and get_game_detail.
    df["cfbd_team"] = df["cfbd_team"].fillna(df["school"])
    out = ROOT / "data" / "injuries"
    out.mkdir(parents=True, exist_ok=True)
    path = out / f"cfb_injuries_{season}_w{week}.parquet"
    df.to_parquet(path)
    n_qb = int((df.pos == "QB").sum())
    print(f"{len(df)} injury rows ({df.team.nunique()} teams, {n_qb} QBs) -> {path.name}")
    print(df.status.value_counts().to_dict())
    load_supabase(df, season, week)


if __name__ == "__main__":
    main()
