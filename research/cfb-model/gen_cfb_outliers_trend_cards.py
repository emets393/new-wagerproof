"""Generate render-ready CFB Outliers trend cards into cfb_outliers_trend_cards.

Trend stats are point-in-time (through week N-1). Betting lines come from cfb_dryrun_picks.

Usage:  python3 gen_cfb_outliers_trend_cards.py [--no-load] [--no-lines]
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

import requests

import dry_common as C
from cfb_odds_shop import load_odds_shop
from cfb_outliers_betting_lines import index_picks, resolve_betting_lines
from cfb_outliers_trend_engine import build_all_cards

ROOT = Path(__file__).resolve().parent
BASE_URL = f"{C.URL}/rest/v1"
BATCH = 200


def fetch_all(table, params=""):
    rows, offset = [], 0
    while True:
        url = f"{BASE_URL}/{table}?{params}&limit=1000&offset={offset}" if params else (
            f"{BASE_URL}/{table}?limit=1000&offset={offset}")
        resp = requests.get(url, headers=C.H, timeout=120)
        resp.raise_for_status()
        chunk = resp.json()
        if not isinstance(chunk, list) or not chunk:
            break
        rows.extend(chunk)
        if len(chunk) < 1000:
            break
        offset += 1000
    return rows


def abbr_map():
    _, _, abbr = C.team_maps()
    return abbr


def normalize_games(games, abbrs):
    out = []
    for g in games:
        home = g["home_team"]
        away = g["away_team"]
        row = dict(g)
        row["game_id"] = str(g["game_id"])
        row["home_ab"] = abbrs.get(home) or home
        row["away_ab"] = abbrs.get(away) or away
        row["matchup_label"] = f"{away} @ {home}"
        out.append(row)
    return out


def to_db_row(card, season, week, through_week, lines_updated_at=None):
    return {
        "card_id": card["card_id"],
        "season": season,
        "week": week,
        "through_week": through_week,
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


def ensure_table():
    probe = requests.get(f"{BASE_URL}/cfb_outliers_trend_cards?limit=0", headers=C.H, timeout=30)
    if probe.status_code == 200:
        return
    migration = ROOT.parent.parent / "supabase/migrations/20260622130000_cfb_outliers_trend_cards.sql"
    sys.exit(
        f"cfb_outliers_trend_cards table missing (HTTP {probe.status_code}). "
        f"Apply {migration} in the Supabase SQL editor, then re-run."
    )


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--no-load", action="store_true")
    ap.add_argument("--no-lines", action="store_true")
    args = ap.parse_args()

    if not args.no_load:
        ensure_table()

    SEASON, WEEK = C.season_week()
    THROUGH_WEEK = WEEK - 1
    abbrs = abbr_map()

    games = fetch_all(
        "cfb_dryrun_games",
        f"season=eq.{SEASON}&week=eq.{WEEK}&select=*&order=kickoff.asc",
    )
    if not games:
        sys.exit(f"No games for season={SEASON} week={WEEK}")

    games = normalize_games(games, abbrs)
    team_names = {g["home_team"] for g in games} | {g["away_team"] for g in games}

    all_teams = fetch_all(
        "cfb_team_trends",
        f"season=eq.{SEASON}&through_week=eq.{THROUGH_WEEK}&select=team_name,splits,matchups",
    )
    teams = [t for t in all_teams if t.get("team_name") in team_names]

    all_coaches = fetch_all(
        "cfb_coach_trends",
        f"through_season=eq.{SEASON}&through_week=eq.{THROUGH_WEEK}"
        f"&last_season=eq.{SEASON}"
        f"&select=coach,current_team,career_games,last_season,splits,matchups,market_coverage",
    )
    coaches = [c for c in all_coaches if c.get("current_team") in team_names]

    print(f"slate: {len(games)} games | teams {len(teams)} coaches {len(coaches)}")

    cards = build_all_cards(games, teams, coaches)
    lines_updated_at = None
    attached = 0

    if not args.no_lines:
        picks = fetch_all("cfb_dryrun_picks", f"season=eq.{SEASON}&week=eq.{WEEK}&select=*")
        games_by_id = {str(g["game_id"]): g for g in games}
        picks_idx = index_picks(picks)
        odds_shop = load_odds_shop(SEASON, WEEK, games)
        lines_updated_at = datetime.now(timezone.utc).isoformat()
        for card in cards:
            game = games_by_id[str(card["game_id"])]
            card["betting_lines"] = resolve_betting_lines(card, game, picks_idx, odds_shop)
            if card["betting_lines"]:
                attached += 1

    print(f"{len(cards)} cards | betting lines on {attached}")

    if args.no_load:
        sample = cards[0] if cards else {}
        print(json.dumps({k: sample[k] for k in sample if k != "rows"}, indent=2)[:800])
        return

    db_rows = [to_db_row(c, SEASON, WEEK, THROUGH_WEEK, lines_updated_at) for c in cards]
    requests.delete(
        f"{BASE_URL}/cfb_outliers_trend_cards?season=eq.{SEASON}&week=eq.{WEEK}",
        headers=C.H, timeout=60,
    )
    for i in range(0, len(db_rows), BATCH):
        resp = requests.post(
            f"{BASE_URL}/cfb_outliers_trend_cards", headers=C.H,
            json=db_rows[i:i + BATCH], timeout=120,
        )
        if resp.status_code != 201:
            sys.exit(f"insert batch {i}: {resp.status_code} {resp.text[:400]}")
        print(f"  loaded {min(i + BATCH, len(db_rows))}/{len(db_rows)}", end="\r")
    print(f"\nloaded {len(db_rows)} rows -> cfb_outliers_trend_cards")


if __name__ == "__main__":
    main()
