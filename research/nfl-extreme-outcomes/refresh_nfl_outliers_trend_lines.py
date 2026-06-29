"""Refresh betting lines on pre-rendered Outliers trend cards.

Trend stats are point-in-time (run once per week via gen_nfl_outliers_trend_cards.py).
Lines and best books move all week — run this whenever nfl_dryrun_games / nfl_dryrun_props
/ odds_hist are updated (e.g. after fetch + dryrun_wk12_games + dryrun_wk12_props).

Usage:  python3 refresh_nfl_outliers_trend_lines.py [--no-load]
"""
from __future__ import annotations

import argparse
import os
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd
import requests

import dryrun_wk12_games as dg
from gen_nfl_outliers_trend_cards import BATCH, BASE_URL, SEASON, WEEK, fetch_all, hdr, load_key
from nfl_outliers_betting_lines import (
    card_for_resolution,
    index_picks,
    index_props,
    index_props_books,
    resolve_betting_lines,
)

ROOT = Path(__file__).resolve().parent
DATA = ROOT / "data"


def load_books_for_slate(games):
    hp = pd.read_parquet(DATA / "h1m_preds.parquet")
    hp = hp[(hp.season == SEASON) & (hp.week == WEEK)]
    abbrs = {(g["home_ab"], g["away_ab"]) for g in games}
    hp = hp[hp.apply(lambda r: (r.home_ab, r.away_ab) in abbrs, axis=1)]
    if hp.empty:
        return {}
    books, _ = dg.load_books(hp)
    return books


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--no-load", action="store_true")
    args = ap.parse_args()

    key = load_key()
    h = {**hdr(key), "Content-Type": "application/json", "Prefer": "return=minimal"}

    cards = fetch_all(
        key, "nfl_outliers_trend_cards",
        f"season=eq.{SEASON}&week=eq.{WEEK}"
        f"&select=card_id,game_id,subject_kind,team_abbr,player_id,market_key,trend_hit_side,headshot_url",
    )
    if not cards:
        sys.exit(f"No cards for season={SEASON} week={WEEK} — run gen_nfl_outliers_trend_cards.py first")

    games = fetch_all(
        key, "nfl_dryrun_games",
        f"season=eq.{SEASON}&week=eq.{WEEK}&select=*",
    )
    picks = fetch_all(key, "nfl_dryrun_picks", f"season=eq.{SEASON}&week=eq.{WEEK}&select=*")
    props = fetch_all(
        key, "nfl_dryrun_props",
        f"season=eq.{SEASON}&week=eq.{WEEK}&select=game_id,player_id,market,close_line,"
        f"over_price,under_price,close_yes_prob,headshot_url",
    )

    games_by_id = {g["game_id"]: g for g in games}
    picks_idx = index_picks(picks)
    props_idx = index_props(props)
    props_books_idx = index_props_books(SEASON, WEEK, DATA)
    books = load_books_for_slate(games)
    book_meta = dg.book_meta()
    now = datetime.now(timezone.utc).isoformat()

    updates = []
    for row in cards:
        game = games_by_id.get(row["game_id"])
        if not game:
            continue
        card = card_for_resolution(row)
        lines, headshot = resolve_betting_lines(
            card, game, picks_idx, props_idx, books, book_meta, props_books_idx,
        )
        patch = {
            "card_id": row["card_id"],
            "betting_lines": lines,
            "betting_lines_updated_at": now,
            "headshot_url": headshot or row.get("headshot_url"),
        }
        updates.append(patch)

    with_lines = sum(1 for u in updates if u["betting_lines"])
    print(f"resolved lines for {with_lines}/{len(updates)} cards")

    if args.no_load:
        return

    def patch_one(patch: dict) -> None:
        cid = patch.pop("card_id")
        for attempt in range(3):
            try:
                resp = requests.patch(
                    f"{BASE_URL}/nfl_outliers_trend_cards?card_id=eq.{cid}",
                    headers=h, json=patch, timeout=60,
                )
                if resp.status_code in (200, 204):
                    return
                if attempt == 2:
                    raise RuntimeError(f"{cid}: {resp.status_code} {resp.text[:200]}")
            except requests.RequestException:
                if attempt == 2:
                    raise

    done = 0
    with ThreadPoolExecutor(max_workers=16) as pool:
        futures = [pool.submit(patch_one, dict(p)) for p in updates]
        for fut in as_completed(futures):
            fut.result()
            done += 1
            if done % 100 == 0 or done == len(updates):
                print(f"  patched {done}/{len(updates)}", end="\r")
    print(f"\nupdated betting_lines -> nfl_outliers_trend_cards ({now})")


if __name__ == "__main__":
    main()
