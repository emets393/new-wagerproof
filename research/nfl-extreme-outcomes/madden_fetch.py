"""
Pull the CURRENT Madden ratings from EA's OFFICIAL ratings site (ea.com) and write season rows
into madden_ratings.parquet (the file forecast_harness.py actually reads) + madden_attributes.parquet.

SOURCE: https://www.ea.com/games/madden-nfl/ratings is a Next.js page whose data is server-rendered
and exposed via its `_next/data` JSON endpoint (the exact JSON the page renders), paginated 100/page,
with the fields the live harness needs: firstName/lastName, overallRating, team.label,
position.shortLabel, iteration. We scrape the current `buildId` from the page (it changes on every EA
deploy) then loop pages. EA's own site is the canonical, FIRST source of Madden 27 launch ratings —
the old ratings-api.ea.com/v2 is dead, and madden.tools lagged (served Madden 26 through Aug 2026).

ITERATION: "1-base" / "Launch Ratings" = the new game's launch set (Madden 27 = the 2026 season).
Idempotent: drop + re-append the target season. Physical attrs (speed/str/wt) are not needed by the
live harness (OVR + pos + team + name only), so madden_attributes gets OVR only, physical NaN.

Usage:  python3 madden_fetch.py [season]      # season defaults to 2026
"""
import os
import re
import sys
import json
import unicodedata
import numpy as np
import pandas as pd
import requests

DATA = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
SEASON = int(sys.argv[1]) if len(sys.argv) > 1 else 2026
RATINGS_PAGE = "https://www.ea.com/games/madden-nfl/ratings"
DATA_URL = ("https://www.ea.com/_next/data/{build}/games/madden-nfl/ratings.json"
            "?franchiseSlug=madden-nfl&page={page}")
UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126.0 Safari/537.36")
L = print

# EA already uses the legacy position taxonomy (QB/HB/WR/RE/LE/MLB/LOLB/ROLB/...); POS_MAP is kept
# defensively in case any scheme-style label appears so the harness position sets match unchanged.
POS_MAP = {"REDG": "RE", "LEDG": "LE", "REDGE": "RE", "LEDGE": "LE",
           "MIKE": "MLB", "WILL": "LOLB", "SAM": "ROLB"}
# EA labels teams by full name, which matches the parquet (2018-2025) EXCEPT the two NY teams.
TEAM_FIX = {"New York Giants": "NY Giants", "New York Jets": "NY Jets"}

SUFFIX = re.compile(r"\b(jr|sr|ii|iii|iv|v)\b")
def norm(s):
    """Name normalizer — identical to b16_madden_parse.norm (must match the crosswalk keys)."""
    if not isinstance(s, str):
        return ""
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().lower()
    s = SUFFIX.sub("", s)
    s = re.sub(r"[^a-z ]", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def _find_items(obj):
    """Locate the players array (list of dicts carrying overallRating) anywhere in the JSON."""
    found = [None]
    def walk(o, d=0):
        if found[0] is not None or d > 9 or o is None:
            return
        if isinstance(o, list):
            if o and isinstance(o[0], dict) and o[0].get("overallRating") is not None:
                found[0] = o
                return
            for x in o:
                walk(x, d + 1)
        elif isinstance(o, dict):
            for v in o.values():
                walk(v, d + 1)
    walk(obj)
    return found[0] or []


def fetch_players():
    """Return a DataFrame [season, mname, team, pos, ovr, nname] for all rostered players (FA excluded)."""
    sess = requests.Session()
    sess.headers.update({"User-Agent": UA, "Accept": "application/json"})
    page0 = sess.get(RATINGS_PAGE, headers={"Accept": "text/html"}, timeout=40)
    page0.raise_for_status()
    bm = re.search(r'"buildId":"([^"]+)"', page0.text)
    if not bm:
        sys.exit("ea.com: buildId not found (site structure changed)")
    build = bm.group(1)

    rows, iters, seen = [], set(), set()
    for page in range(1, 41):                       # 41 = safety cap (~2.4k players / 100 per page)
        r = sess.get(DATA_URL.format(build=build, page=page), timeout=40)
        if r.status_code != 200:
            break
        items = _find_items(r.json())
        new_ids = [it.get("id") for it in items if it.get("id") not in seen]
        if not items or not new_ids:                # empty page or nothing new -> done
            break
        for it in items:
            if it.get("id") in seen:
                continue
            seen.add(it.get("id"))
            team, pos, ovr = it.get("team"), it.get("position"), it.get("overallRating")
            if not team or ovr is None:             # free agents (null team) are not roster talent
                continue
            label = TEAM_FIX.get(team.get("label"), team.get("label"))
            ps = (pos or {}).get("shortLabel")
            name = f"{it.get('firstName','')} {it.get('lastName','')}".strip()
            if not label or not ps or not name:
                continue
            iters.add(((it.get("iteration") or {}).get("label")))
            rows.append({"season": SEASON, "mname": name, "team": label,
                         "pos": POS_MAP.get(ps, ps), "ovr": float(ovr)})
    L(f"[source] ea.com Madden ratings | iteration(s): {sorted(x for x in iters if x)} | build {build}")
    df = pd.DataFrame(rows)
    df["nname"] = df.mname.map(norm)
    df = df[df.nname != ""].drop_duplicates(["nname", "team", "pos"]).reset_index(drop=True)
    L(f"[fetch] {len(df)} rostered players across {df.team.nunique()} teams; "
      f"OVR {df.ovr.min():.0f}-{df.ovr.max():.0f}, median {df.ovr.median():.0f}")
    return df


def crosswalk(mad):
    """Attach gsis_id via players_xwalk (b16 logic): normalized name + active-season window."""
    px = pd.read_parquet(os.path.join(DATA, "players_xwalk.parquet"))
    px["n_disp"] = px.display_name.map(norm)
    px["n_fl"] = (px.first_name.astype(str) + " " + px.last_name.astype(str)).map(norm)
    px["n_fb"] = (px.football_name.astype(str) + " " + px.last_name.astype(str)).map(norm)
    px["rk"] = pd.to_numeric(px.rookie_season, errors="coerce").fillna(1990)
    px["ls"] = pd.to_numeric(px.last_season, errors="coerce").fillna(2030)
    look = {}
    for _, r in px.iterrows():
        for key in {r.n_disp, r.n_fl, r.n_fb}:
            if key:
                look.setdefault(key, []).append((r.gsis_id, r.rk, r.ls))

    def match_row(nname, season):
        cands = look.get(nname)
        if not cands:
            return ("none", None)
        active = [c for c in cands if c[1] - 1 <= season <= c[2] + 1]
        pool = active if active else cands
        gids = {c[0] for c in pool}
        if len(gids) == 1:
            return ("matched", pool[0][0])
        return ("ambiguous", None)

    res = mad.apply(lambda r: match_row(r.nname, r.season), axis=1, result_type="expand")
    mad["status"] = res[0]
    mad["gsis_id"] = res[1]
    return mad


def upsert(path, new, extra_cols=None):
    """Drop existing rows for SEASON, append new, write back. Adds any missing extra_cols as NaN."""
    if extra_cols:
        for c in extra_cols:
            if c not in new.columns:
                new[c] = np.nan
    if os.path.exists(path):
        old = pd.read_parquet(path)
        new = new.reindex(columns=old.columns)          # align schema/order exactly
        combined = pd.concat([old[old.season != SEASON], new], ignore_index=True)
    else:
        combined = new
    combined.to_parquet(path, index=False)
    return combined


def main():
    mad = fetch_players()
    mad = crosswalk(mad)

    tab = mad.status.value_counts().to_dict()
    hi = mad[mad.ovr >= 75]
    L(f"[crosswalk] {tab}  |  matched {(mad.status=='matched').mean()*100:.1f}% overall, "
      f"{(hi.status=='matched').mean()*100:.1f}% of starter-caliber (OVR>=75, n={len(hi)})")

    # madden_ratings.parquet (harness reads this): season, mname, team, pos, ovr, nname, status, gsis_id
    ratings = mad[["season", "mname", "team", "pos", "ovr", "nname", "status", "gsis_id"]].copy()
    r_all = upsert(os.path.join(DATA, "madden_ratings.parquet"), ratings)
    L(f"[save] madden_ratings.parquet -> {len(r_all)} rows, seasons {sorted(r_all.season.unique())}")

    # madden_attributes.parquet: same OVR/pos/team, physical attrs NaN (unused by live harness).
    attrs = mad.rename(columns={"mname": "name"})[["season", "name", "team", "pos", "ovr"]].copy()
    a_all = upsert(os.path.join(DATA, "madden_attributes.parquet"), attrs,
                   extra_cols=["ht", "wt", "speed", "acceleration", "agility",
                               "strength", "awareness", "jumping", "catching"])
    L(f"[save] madden_attributes.parquet -> {len(a_all)} rows "
      f"(season {SEASON}: OVR only; physical attrs NaN — not used by the live harness)")


if __name__ == "__main__":
    main()
