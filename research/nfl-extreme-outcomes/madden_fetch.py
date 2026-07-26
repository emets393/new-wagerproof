"""
Pull the CURRENT Madden ratings DB from madden.tools and write season rows into
madden_ratings.parquet (the file forecast_harness.py actually reads) + madden_attributes.parquet.

WHY madden.tools: EA's old ratings-api.ea.com/v2 is dead (generic 500 for every slug,
incl. historical ones with data). madden.tools is a Next.js site that embeds the FULL
current roster (3,162 players, all 32 teams + free agents) in one __NEXT_DATA__ blob, with
exactly the fields the live harness needs: name, team, position, overall. The detailed
physical attributes (speed/strength/wt) are NOT carried in the list view — but the harness
doesn't use them (they only fed the b19/b23 attribute-matchup research, which backtested as
priced/null). So OVR + pos + team + name is the complete live requirement.

SEASON semantics: run pre-launch (now, July 2026) and madden.tools serves the final Madden
NFL 26 roster (2025-season game, "Super Bowl" iteration) = the best veteran-talent baseline
for 2026 until Madden 27 ships (Aug 13, 2026). 2026 rookies + offseason roster moves are NOT
reflected yet. Re-run after Aug 13 and madden.tools will serve Madden 27 -> real 2026 launch
ratings overwrite this baseline (idempotent: we drop+re-append the target season).

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
URL = "https://madden.tools/players"
UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126.0 Safari/537.36")
L = print

# madden.tools uses scheme-specific position labels; map them to the legacy taxonomy
# already in madden_ratings.parquet (2018-2025) so the harness position sets match unchanged.
POS_MAP = {"REDGE": "RE", "LEDGE": "LE", "MIKE": "MLB", "WILL": "LOLB", "SAM": "ROLB"}

SUFFIX = re.compile(r"\b(jr|sr|ii|iii|iv|v)\b")
def norm(s):
    """Name normalizer — identical to b16_madden_parse.norm (must match the crosswalk keys)."""
    if not isinstance(s, str):
        return ""
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().lower()
    s = SUFFIX.sub("", s)
    s = re.sub(r"[^a-z ]", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def fetch_players():
    """Return a DataFrame [mname, team, pos, ovr] for all rostered players (FA excluded)."""
    r = requests.get(URL, headers={"User-Agent": UA, "Accept": "text/html"}, timeout=40)
    r.raise_for_status()
    m = re.search(r'<script id="__NEXT_DATA__"[^>]*>(.*?)</script>', r.text, re.S)
    if not m:
        sys.exit("madden.tools: __NEXT_DATA__ not found (site structure changed)")
    d = json.loads(m.group(1))
    pp = d["props"]["pageProps"]
    it = pp.get("currentIteration", {})
    L(f"[source] madden.tools iteration: {it.get('label')} ({it.get('release_date')}), "
      f"total players reported {pp.get('totalPlayersCount')}")
    rows = []
    for t in pp["teamPlayerData"]:
        team = t["team"]
        nick = team.get("name")
        if team.get("acronym") == "FA":          # free agents have no NFL team -> not roster talent
            continue
        for pos, players in t["playersByPosition"].items():
            legacy_pos = POS_MAP.get(pos, pos)
            for p in players:
                name = f"{p.get('first_name','')} {p.get('last_name','')}".strip()
                ovr = p.get("rating_overall")
                if not name or ovr is None:
                    continue
                rows.append({"season": SEASON, "mname": name, "team": nick,
                             "pos": legacy_pos, "ovr": float(ovr)})
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
