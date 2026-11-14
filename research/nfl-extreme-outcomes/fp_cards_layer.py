#!/usr/bin/env python3
"""Read fp_prop_payload's parquet and hand one player's card blobs to the page generator.

The payload is the granular half of the prop pivot (owner 2026-10-06: "stats summarisations with
granular data to help users make their own assumptions"). It was only ever written to a parquet,
so nothing reached the database and the web props page had nothing to render — this is the bridge.

Lands in `nfl_prop_player_pages.fp_cards`, NOT inside the existing `research` column: both native
clients type `research` as a market-keyed map, so adding blob keys to it would break their
decoders.

⛔ These blobs are STATS, never a prediction. Each one is a rank plus a sample the reader can see,
and no field in here is a pick or a projection — see .claude/docs/20_player_prop_cards.md and the
prop-cards-narrative-not-prediction memory. The spotlight is the only surface that states a side.
"""
import json
import os
from pathlib import Path

import pandas as pd

HERE = Path(__file__).resolve().parent
DATA = HERE / "data"

# The payload's blob columns, in the order the card renders them. A blob missing from the parquet
# is simply absent from the row rather than null-filled: the client already has to handle a player
# whose warehouse coverage is thin (rookies, mid-season signings), and an empty dict reads to it as
# "measured, nothing there" which is a different and wrong claim.
BLOBS = ("baseline", "role", "efficiency", "matchup", "scheme", "playsheet", "coverage",
         "route_overall", "routes", "run_concept", "run_consistency", "throw_depth",
         "redzone", "situational", "trenches")

_CACHE = {}


def _payload_path(season, week):
    """Most specific file first, and the per-season one LAST.

    Three names coexist: `_{season}w{week}` from a manual single-week run, `_current` from the
    weekly Render job, and `_{season}` from a whole-season build. Order matters — the per-season
    file is typically the oldest on disk and may predate blobs the builder has since gained, so
    picking it first silently served a card missing coverage / route_overall / throw_depth /
    redzone / situational while reporting success.
    """
    for name in (f"fp_prop_payload_{season}w{week}.parquet",
                 "fp_prop_payload_current.parquet",
                 f"fp_prop_payload_{season}.parquet"):
        q = DATA / name
        if q.exists():
            return q
    return None


def _from_db(season, week):
    """Already-stored fp_cards for the week, so a rebuild on a box without the parquet keeps them."""
    import requests
    k = os.environ.get("SUPABASE_SERVICE_KEY")
    if not k:
        env = HERE / ".." / ".." / ".env.local"
        if env.exists():
            for ln in open(env):
                if ln.startswith("SUPABASE_SERVICE_KEY="):
                    k = ln.split("=", 1)[1].strip()
    if not k:
        return {}
    url = "https://jpxnjuwglavsjbgbasnl.supabase.co/rest/v1/nfl_prop_player_pages"
    hdr = {"apikey": k, "Authorization": f"Bearer {k}"}
    out, off = {}, 0
    while True:
        r = requests.get(f"{url}?season=eq.{season}&week=eq.{week}&fp_cards=not.is.null"
                         f"&select=player_id,fp_cards&limit=500&offset={off}", headers=hdr,
                         timeout=90)
        if r.status_code != 200:
            print(f"  [fp-cards] stored-card read failed ({r.status_code}): {r.text[:120]}")
            return out
        j = r.json()
        for row in j:
            if row.get("fp_cards"):
                out[str(row["player_id"])] = row["fp_cards"]
        if len(j) < 500:
            return out
        off += 500


def fetch_cards(season, week):
    """{player_id: {blob: value}} for one slate, keyed by GSIS id.

    Keyed by gsis `player_id`, not FP's `playerPlayerId`, because that is what
    nfl_prop_player_pages is keyed on. The payload's crosswalk covers ~81-83% of its rows, so a
    player with no gsis id is dropped here — he has no page row to attach to anyway.
    """
    ck = (season, week)
    if ck in _CACHE:
        return _CACHE[ck]
    p = _payload_path(season, week)
    if p is None:
        # ⛔ WITHOUT THIS FALLBACK fp_cards SILENTLY EMPTIES ITSELF IN PRODUCTION. The payload is
        # built by nfl-prop-report-daily and the pages are rebuilt by nfl-live-props-hourly —
        # different Render services, so different ephemeral disks: the hourly job never sees the
        # parquet. It also DELETEs and reinserts the week's rows, so every hourly run would drop
        # the cards the daily run wrote. Re-reading the stored value makes the wipe harmless and
        # keeps the owner's "no posted line -> no card" rule intact, since a player who loses his
        # line simply gets no row to re-attach to.
        stored = _from_db(season, week)
        print(f"  [fp-cards] no payload parquet here — carried {len(stored)} players forward "
              f"from nfl_prop_player_pages" if stored else
              "  [fp-cards] no payload parquet and nothing stored yet — fp_cards empty. Run "
              "fp_prop_payload.py (FP_SUPABASE=1 on a Render clone).")
        _CACHE[ck] = stored
        return stored
    d = pd.read_parquet(p)
    for col in ("season", "week"):
        if col in d.columns:
            d[col] = pd.to_numeric(d[col], errors="coerce")
    d = d[(d.season == season) & (d.week == week)]
    if "player_id" not in d.columns:
        print(f"  [fp-cards] {p.name} has no player_id column (crosswalk did not run) — skipping")
        _CACHE[ck] = {}
        return {}
    d = d[d.player_id.notna()]
    have = [b for b in BLOBS if b in d.columns]
    missing = [b for b in BLOBS if b not in d.columns]
    out = {}
    for r in d.itertuples(index=False):
        cards = {}
        for b in have:
            v = _decode(getattr(r, b, None))
            if _nonempty(v):
                cards[b] = _plain(v)
        if cards:
            out[str(r.player_id)] = cards
    print(f"  [fp-cards] {len(out)} players from {p.name}"
          + (f" | blobs absent from the payload: {', '.join(missing)}" if missing else ""))
    _CACHE[ck] = out
    return out


def _decode(v):
    """Parquet stores each blob as a JSON STRING, so pass-through double-encodes it.

    Without this every value in fp_cards arrives at the client as a string it has to JSON.parse a
    second time, and an empty blob lands as the literal "{}" / "[]" rather than being omitted —
    which destroys the distinction the omission is there to make ("no coverage for this player"
    vs "measured, and there was nothing"). Caught 2026-10-07 before the frontend was written.
    """
    if isinstance(v, (str, bytes)):
        t = v.decode() if isinstance(v, bytes) else v
        t = t.strip()
        if not t:
            return None
        if t[0] in "[{":
            try:
                return json.loads(t)
            except (ValueError, TypeError):
                return v
    return v


def _nonempty(v):
    if v is None:
        return False
    if isinstance(v, (dict, list)):
        return len(v) > 0
    if isinstance(v, float) and pd.isna(v):
        return False
    return True


def _plain(v):
    """numpy / pandas scalars and arrays -> JSON-safe python, recursively.

    The payload is built with numpy dtypes throughout, and a bare np.float64 or np.ndarray makes
    PostgREST reject the whole 100-row batch with a terse serialisation error.
    """
    import numpy as np
    if isinstance(v, dict):
        return {str(k): _plain(x) for k, x in v.items()}
    if isinstance(v, (list, tuple, np.ndarray)):
        return [_plain(x) for x in v]
    if isinstance(v, (np.integer,)):
        return int(v)
    if isinstance(v, (np.floating,)):
        f = float(v)
        return None if pd.isna(f) else f
    if isinstance(v, (np.bool_,)):
        return bool(v)
    if isinstance(v, float) and pd.isna(v):
        return None
    return v


def cards_for_player(player_id, cards):
    """One page row's `fp_cards` value, or None when the player has no coverage."""
    return cards.get(str(player_id)) or None


if __name__ == "__main__":
    s = int(os.environ.get("NFL_SEASON", 2026))
    w = int(os.environ.get("NFL_WEEK", 5))
    c = fetch_cards(s, w)
    print(f"{len(c)} players with card blobs for {s} wk{w}")
    if c:
        pid = next(iter(c))
        print(f"  example {pid}: blobs = {sorted(c[pid])}")
        print(f"  json bytes for that player: {len(json.dumps(c[pid], default=str))}")
