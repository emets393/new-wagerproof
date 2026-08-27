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


def main():
    if len(sys.argv) < 3:
        sys.exit("usage: covers_cfb_injuries.py <season> <week>")
    season, week = int(sys.argv[1]), int(sys.argv[2])
    df = parse(fetch_html())
    if df.empty:
        sys.exit("parsed 0 injury rows — covers markup changed?")
    df.insert(0, "season", season)
    df.insert(1, "week", week)
    out = ROOT / "data" / "injuries"
    out.mkdir(parents=True, exist_ok=True)
    path = out / f"cfb_injuries_{season}_w{week}.parquet"
    df.to_parquet(path)
    n_qb = int((df.pos == "QB").sum())
    print(f"{len(df)} injury rows ({df.team.nunique()} teams, {n_qb} QBs) -> {path.name}")
    print(df.status.value_counts().to_dict())


if __name__ == "__main__":
    main()
