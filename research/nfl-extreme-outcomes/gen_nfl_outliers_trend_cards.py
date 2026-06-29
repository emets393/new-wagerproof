"""Generate render-ready Outliers trend cards into nfl_outliers_trend_cards.

Trend stats are point-in-time (through week N-1) and should run once per week.
Betting lines are snapshotted here too, but refresh_nfl_outliers_trend_lines.py
should re-run whenever odds/picks/props update during the week.

Usage:  python3 gen_nfl_outliers_trend_cards.py [--no-load] [--no-lines]
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd
import requests

import dryrun_wk12_games as dg
from nfl_outliers_betting_lines import index_picks, index_props, index_props_books, resolve_betting_lines
from nfl_outliers_trend_engine import build_all_cards

ROOT = Path(__file__).resolve().parent
DATA = ROOT / "data"
BASE_URL = "https://jpxnjuwglavsjbgbasnl.supabase.co/rest/v1"
SEASON = int(os.environ.get("NFL_SEASON", 2025))
WEEK = int(os.environ.get("NFL_WEEK", 12))
THROUGH_WEEK = WEEK - 1
BATCH = 200


def load_key():
    for line in (ROOT.parent.parent / ".env.local").read_text().splitlines():
        if line.startswith("SUPABASE_SERVICE_KEY="):
            return line.split("=", 1)[1].strip()
    sys.exit("SUPABASE_SERVICE_KEY not found in .env.local")


def hdr(key):
    return {"apikey": key, "Authorization": f"Bearer {key}"}


def fetch_all(key, table, params=""):
    rows, offset = [], 0
    while True:
        url = f"{BASE_URL}/{table}?{params}&limit=1000&offset={offset}" if params else (
            f"{BASE_URL}/{table}?limit=1000&offset={offset}")
        resp = requests.get(url, headers=hdr(key), timeout=120)
        resp.raise_for_status()
        chunk = resp.json()
        if not isinstance(chunk, list) or not chunk:
            break
        rows.extend(chunk)
        if len(chunk) < 1000:
            break
        offset += 1000
    return rows


def load_books_for_slate(games):
    hp = pd.read_parquet(DATA / "h1m_preds.parquet")
    hp = hp[(hp.season == SEASON) & (hp.week == WEEK)]
    abbrs = {(g["home_ab"], g["away_ab"]) for g in games}
    hp = hp[hp.apply(lambda r: (r.home_ab, r.away_ab) in abbrs, axis=1)]
    if hp.empty:
        return {}
    books, _ = dg.load_books(hp)
    return books


def to_db_row(card, lines_updated_at=None):
    return {
        "card_id": card["card_id"],
        "season": SEASON,
        "week": WEEK,
        "through_week": THROUGH_WEEK,
        "game_id": card["game_id"],
        "matchup_label": card["matchup_label"],
        "subject_kind": card["subject_kind"],
        "subject_name": card["subject_name"],
        "subject_detail": card.get("subject_detail"),
        "team_abbr": card.get("team_abbr"),
        "player_id": card.get("player_id"),
        "market_key": card["market_key"],
        "bet_type_label": card["bet_type_label"],
        "trend_value": card["trend_value"],
        "trend_sample_n": card["trend_sample_n"],
        "sort_rank": card["sort_rank"],
        "trend_hit_side": card["hit_side"],
        "headshot_url": card.get("headshot_url"),
        "rows": card["rows"],
        "betting_lines": card.get("betting_lines") or [],
        "betting_lines_updated_at": lines_updated_at,
        "is_player_overflow": False,
    }


def database_url():
    if os.environ.get("DATABASE_URL"):
        return os.environ["DATABASE_URL"]
    env = ROOT.parent.parent / ".env.local"
    if env.exists():
        for line in env.read_text().splitlines():
            if line.startswith("DATABASE_URL="):
                return line.split("=", 1)[1].strip()
    return None


def ensure_table(key):
    probe = requests.get(
        f"{BASE_URL}/nfl_outliers_trend_cards?limit=0",
        headers=hdr(key), timeout=30,
    )
    if probe.status_code == 200:
        return
    url = database_url()
    if not url:
        migration = ROOT.parent.parent / "supabase/migrations/20260622120000_nfl_outliers_trend_cards.sql"
        sys.exit(
            f"nfl_outliers_trend_cards table missing (HTTP {probe.status_code}). "
            f"Apply {migration} in the research Supabase SQL editor, or set DATABASE_URL "
            f"and re-run with --bootstrap."
        )
    try:
        import psycopg2
    except ImportError:
        sys.exit("psycopg2-binary required for --bootstrap (pip install psycopg2-binary)")
    ddl = (ROOT.parent.parent / "supabase/migrations/20260622120000_nfl_outliers_trend_cards.sql").read_text()
    conn = psycopg2.connect(url)
    conn.autocommit = True
    with conn.cursor() as cur:
        cur.execute(ddl)
    conn.close()
    print("bootstrapped nfl_outliers_trend_cards via DATABASE_URL")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--no-load", action="store_true")
    ap.add_argument("--no-lines", action="store_true",
                    help="Skip betting line resolution (run refresh_nfl_outliers_trend_lines.py later)")
    ap.add_argument("--bootstrap", action="store_true",
                    help="Create table via DATABASE_URL if missing")
    args = ap.parse_args()

    key = load_key()
    h = {**hdr(key), "Content-Type": "application/json", "Prefer": "return=minimal"}

    if args.bootstrap or not args.no_load:
        ensure_table(key)

    games = fetch_all(
        key, "nfl_dryrun_games",
        f"season=eq.{SEASON}&week=eq.{WEEK}&select=*&order=kickoff.asc",
    )
    if not games:
        sys.exit(f"No games for season={SEASON} week={WEEK}")

    team_abbrs = sorted({g["home_ab"] for g in games} | {g["away_ab"] for g in games})
    ref_names = sorted({g["assigned_referee"] for g in games if g.get("assigned_referee")})

    teams = fetch_all(
        key, "nfl_team_trends",
        f"season=eq.{SEASON}&through_week=eq.{THROUGH_WEEK}"
        f"&team_abbr=in.({','.join(team_abbrs)})"
        f"&select=team_abbr,team_name,splits,matchups",
    )
    coaches = fetch_all(
        key, "nfl_coach_trends",
        f"through_season=eq.{SEASON}&through_week=eq.{THROUGH_WEEK}"
        f"&last_season=eq.{SEASON}&current_team=in.({','.join(team_abbrs)})"
        f"&select=coach,current_team,career_games,last_season,splits,matchups,market_coverage",
    )
    refs = fetch_all(
        key, "nfl_referee_trends",
        f"through_season=eq.{SEASON}&through_week=eq.{THROUGH_WEEK}"
        f"&referee=in.({','.join(ref_names)})"
        f"&select=referee,career_games,splits,market_coverage",
    ) if ref_names else []
    players = fetch_all(
        key, "nfl_player_prop_trends",
        f"through_season=eq.{SEASON}&through_week=eq.{THROUGH_WEEK}"
        f"&current_team=in.({','.join(team_abbrs)})"
        f"&select=player_id,player_name,position,current_team,markets,coverage,splits,matchups",
    )

    print(f"slate: {len(games)} games | teams {len(teams)} coaches {len(coaches)} "
          f"refs {len(refs)} players {len(players)}")

    cards = build_all_cards(games, teams, coaches, refs, players)
    lines_updated_at = None
    attached = 0

    if not args.no_lines:
        picks = fetch_all(key, "nfl_dryrun_picks", f"season=eq.{SEASON}&week=eq.{WEEK}&select=*")
        props = fetch_all(
            key, "nfl_dryrun_props",
            f"season=eq.{SEASON}&week=eq.{WEEK}&select=game_id,player_id,market,close_line,"
            f"over_price,under_price,close_yes_prob,headshot_url",
        )
        games_by_id = {g["game_id"]: g for g in games}
        picks_idx = index_picks(picks)
        props_idx = index_props(props)
        props_books_idx = index_props_books(SEASON, WEEK)
        books = load_books_for_slate(games)
        book_meta = dg.book_meta()
        lines_updated_at = datetime.now(timezone.utc).isoformat()
        for card in cards:
            game = games_by_id[card["game_id"]]
            lines, headshot = resolve_betting_lines(
                card, game, picks_idx, props_idx, books, book_meta, props_books_idx,
            )
            card["betting_lines"] = lines
            if headshot:
                card["headshot_url"] = headshot
            if lines:
                attached += 1

        # Player trends without a posted prop/line aren't actionable — drop them.
        if not args.no_lines:
            before = len(cards)
            cards = [
                c for c in cards
                if c["subject_kind"] != "player" or c.get("betting_lines")
            ]
            dropped = before - len(cards)
            if dropped:
                print(f"dropped {dropped} player cards with no betting line")

    player_heads = sum(1 for c in cards if c.get("headshot_url"))
    print(f"{len(cards)} cards | betting lines on {attached} | player headshots {player_heads}")

    if args.no_load:
        sample = cards[0]
        print(json.dumps({k: sample[k] for k in sample if k != "rows"}, indent=2)[:800])
        return

    db_rows = [to_db_row(c, lines_updated_at) for c in cards]
    requests.delete(
        f"{BASE_URL}/nfl_outliers_trend_cards?season=eq.{SEASON}&week=eq.{WEEK}",
        headers=h, timeout=60,
    )
    for i in range(0, len(db_rows), BATCH):
        resp = requests.post(
            f"{BASE_URL}/nfl_outliers_trend_cards", headers=h,
            json=db_rows[i:i + BATCH], timeout=120,
        )
        if resp.status_code != 201:
            sys.exit(f"insert batch {i}: {resp.status_code} {resp.text[:400]}")
        print(f"  loaded {min(i + BATCH, len(db_rows))}/{len(db_rows)}", end="\r")
    print(f"\nloaded {len(db_rows)} rows -> nfl_outliers_trend_cards")


if __name__ == "__main__":
    main()
