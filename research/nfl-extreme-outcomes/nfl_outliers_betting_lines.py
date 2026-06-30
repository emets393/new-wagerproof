"""Resolve best-book betting lines for pre-rendered Outliers trend cards."""
from __future__ import annotations

from collections import defaultdict
from pathlib import Path
from typing import Any

import dryrun_wk12_games as dg
from nfl_outliers_trend_engine import market_label

PICK_GROUP = {
    "spread": "spread",
    "moneyline": "moneyline",
    "total": "total",
    "team_total": "team_total",
    "h1_spread": "h1_spread",
    "h1_total": "h1_total",
}

DATA_DIR = Path(__file__).resolve().parent / "data"


def fmt_spread(v):
    if v is None:
        return None
    v = float(v)
    if v == int(v):
        iv = int(v)
        return f"+{iv}" if iv > 0 else str(iv)
    body = f"{v:.1f}"
    return f"+{body}" if v > 0 else body


def fmt_odds(v):
    if v is None:
        return None
    iv = int(round(float(v)))
    return f"+{iv}" if iv > 0 else str(iv)


def prob_to_american(prob):
    if prob is None or prob <= 0 or prob >= 1:
        return None
    if prob >= 0.5:
        return int(-100 * prob / (1 - prob))
    return int(100 * (1 - prob) / prob)


def book_line(bk, line, odds, label, book_meta, team_abbr=None, line_id=""):
    nm, logo = book_meta.get(bk, (None, None)) if bk else (None, None)
    return {
        "id": line_id,
        "label": label,
        "line_text": line,
        "odds_text": fmt_odds(odds),
        "book_name": nm,
        "book_logo_url": logo,
        "team_abbr": team_abbr,
    }


def index_picks(picks):
    idx = defaultdict(list)
    for p in picks:
        idx[(p["game_id"], p["card_group"])].append(p)
    return idx


def index_props(props):
    idx = {}
    for p in props:
        idx[(p["game_id"], p["player_id"], p["market"])] = p
    return idx


def index_props_books(season: int, week: int, data_dir: Path | None = None) -> dict[tuple[str, str], list[dict]]:
    """Per-book closing props from props_frame.parquet — keyed by (player_id, market)."""
    path = (data_dir or DATA_DIR) / "props_frame.parquet"
    if not path.exists():
        return {}
    import pandas as pd

    pf = pd.read_parquet(path)
    w = pf[(pf.season == season) & (pf.week == week)]
    idx: dict[tuple[str, str], list[dict]] = defaultdict(list)
    for _, r in w.iterrows():
        idx[(r.player_id, r.market)].append({
            "bookmaker": r.bookmaker,
            "close_line": None if pd.isna(r.close_line) else float(r.close_line),
            "close_over": None if pd.isna(r.close_over) else float(r.close_over),
            "close_under": None if pd.isna(r.close_under) else float(r.close_under),
        })
    return idx


def best_prop_pick(rows: list[dict], side: str) -> tuple[str | None, float | None, float | None]:
    """Best shop for a player prop side. Returns (book_key, line, american_odds)."""
    if not rows:
        return None, None, None
    if side == "yes":
        priced = [r for r in rows if r.get("close_over") is not None]
        if not priced:
            return None, None, None
        best = max(priced, key=lambda r: r["close_over"])
        return best["bookmaker"], None, best["close_over"]
    valid = [r for r in rows if r.get("close_line") is not None]
    if not valid:
        return None, None, None
    if side == "over":
        best_line = min(r["close_line"] for r in valid)
        cand = [r for r in valid if r["close_line"] == best_line]
        best = max(cand, key=lambda r: r.get("close_over") or -9999)
        return best["bookmaker"], best_line, best.get("close_over")
    # under — shop at the highest line, tie-break on price
    best_line = max(r["close_line"] for r in valid)
    cand = [r for r in valid if r["close_line"] == best_line]
    best = max(cand, key=lambda r: r.get("close_under") or -9999)
    return best["bookmaker"], best_line, best.get("close_under")


def card_for_resolution(row: dict[str, Any]) -> dict[str, Any]:
    """Normalize a DB row or engine card into the shape `resolve_betting_lines` expects."""
    return {
        "card_id": row["card_id"],
        "game_id": row["game_id"],
        "subject_kind": row["subject_kind"],
        "team_abbr": row.get("team_abbr"),
        "player_id": row.get("player_id"),
        "market_key": row["market_key"],
        "hit_side": row.get("trend_hit_side", row.get("hit_side", True)),
    }


def resolve_betting_lines(card, game, picks_idx, props_idx, books, book_meta, props_books_idx=None):
    market = card["market_key"]
    kind = card["subject_kind"]
    hit = card["hit_side"]
    team = card.get("team_abbr")
    gid = card["game_id"]
    home, away = game["home_ab"], game["away_ab"]
    lines = []
    bdf = books.get((home, away))
    props_books_idx = props_books_idx or {}

    if kind == "player":
        prop = props_idx.get((gid, card["player_id"], market))
        if not prop:
            return lines, None
        headshot = prop.get("headshot_url")
        book_rows = props_books_idx.get((card["player_id"], market), [])
        if market == "player_anytime_td":
            bbk, _, bod = best_prop_pick(book_rows, "yes")
            odds = bod if bod is not None else prob_to_american(prop.get("close_yes_prob"))
            lines.append(book_line(
                bbk, "Yes", odds, "Anytime TD", book_meta, team,
                f"{card['card_id']}-yes",
            ))
            return lines, headshot
        close = prop.get("close_line")
        if close is None:
            return lines, headshot
        side = "over" if hit else "under"
        bbk, bln, bod = best_prop_pick(book_rows, side)
        line_val = bln if bln is not None else close
        fallback_odds = prop.get("over_price") if hit else prop.get("under_price")
        odds = bod if bod is not None else fallback_odds
        label = "Over" if hit else "Under"
        lines.append(book_line(
            bbk, f"{label} {line_val:g}", odds, label, book_meta, team,
            f"{card['card_id']}-{side}",
        ))
        return lines, headshot

    pick_rows = picks_idx.get((gid, PICK_GROUP.get(market)), []) if market in PICK_GROUP else []

    def pick_for(side=None, bet_type=None):
        for p in pick_rows:
            if bet_type and p.get("bet_type") != bet_type:
                continue
            if side and p.get("pick_side") != side:
                continue
            return p
        return None

    if market in ("spread", "h1_spread"):
        if kind == "referee":
            side = "HOME" if hit else "AWAY"
            team = home if side == "HOME" else away
        else:
            side = "HOME" if team == home else "AWAY"
        bp_kind = "spread" if market == "spread" else "h1_spread"
        if bdf is not None:
            bbk, bln, bod = dg.best_pick(bdf, bp_kind, side.lower())
            if bln is not None:
                lines.append(book_line(
                    bbk, fmt_spread(bln), bod, market_label(market), book_meta, team,
                    f"{card['card_id']}-line",
                ))
        else:
            p = pick_for(side)
            if p and p.get("best_line") is not None:
                lines.append(book_line(
                    p.get("best_book"), fmt_spread(p["best_line"]), p.get("best_odds"),
                    market_label(market), book_meta, team, f"{card['card_id']}-line",
                ))

    elif market == "moneyline":
        if kind == "referee":
            side = "HOME" if hit else "AWAY"
            ab = home if side == "HOME" else away
        else:
            side = "HOME" if team == home else "AWAY"
            ab = team
        team_name = game.get("home_team") if side == "HOME" else game.get("away_team")
        if bdf is not None:
            bbk, _, bod = dg.best_pick(bdf, "ml", side.lower())
            lines.append(book_line(
                bbk, f"{team_name or ab} ML", bod, "Moneyline", book_meta, ab,
                f"{card['card_id']}-ml",
            ))
        else:
            p = pick_for(side)
            if p:
                lines.append(book_line(
                    p.get("best_book"), p.get("pick_label") or f"{ab} ML", p.get("best_odds"),
                    "Moneyline", book_meta, ab, f"{card['card_id']}-ml",
                ))

    elif market in ("total", "h1_total"):
        bp_kind = "total" if market == "total" else "h1_total"
        for side, label in (("OVER", "Over"), ("UNDER", "Under")):
            if bdf is not None:
                bbk, bln, bod = dg.best_pick(bdf, bp_kind, side.lower())
                if bln is not None:
                    lines.append(book_line(
                        bbk, f"{label} {bln:g}", bod, label, book_meta, None,
                        f"{card['card_id']}-{side.lower()}",
                    ))
            else:
                p = pick_for(side)
                if p and p.get("best_line") is not None:
                    lines.append(book_line(
                        p.get("best_book"), f"{label} {p['best_line']:g}", p.get("best_odds"),
                        label, book_meta, None, f"{card['card_id']}-{side.lower()}",
                    ))

    elif market == "team_total":
        is_home = team == home
        bt = "team_total_home" if is_home else "team_total_away"
        tt_line = game.get("tt_home_close") if is_home else game.get("tt_away_close")
        opx = game.get("tt_home_over_price") if is_home else game.get("tt_away_over_price")
        upx = game.get("tt_home_under_price") if is_home else game.get("tt_away_under_price")
        tt_picks = picks_idx.get((gid, "team_total"), [])
        for side, label, px in (("OVER", "Over", opx), ("UNDER", "Under", upx)):
            p = next((x for x in tt_picks if x.get("bet_type") == bt and x.get("pick_side") == side), None)
            if bdf is not None:
                side_key = ("home" if is_home else "away") + "_" + side.lower()
                bbk, bln, bod = dg.best_pick(bdf, "tt", side_key)
                line_val = bln if bln is not None else tt_line
                if line_val is not None:
                    lines.append(book_line(
                        bbk, f"{label} {line_val:g}", bod or px, label, book_meta, team,
                        f"{card['card_id']}-{side.lower()}",
                    ))
            elif p:
                line_val = p.get("best_line") or tt_line
                if line_val is not None:
                    lines.append(book_line(
                        p.get("best_book"), f"{label} {line_val:g}", p.get("best_odds") or px,
                        label, book_meta, team, f"{card['card_id']}-{side.lower()}",
                    ))
            elif tt_line is not None:
                lines.append(book_line(
                    None, f"{label} {tt_line:g}", px, label, book_meta, team,
                    f"{card['card_id']}-{side.lower()}",
                ))

    return lines, None
