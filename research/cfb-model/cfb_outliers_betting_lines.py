"""Resolve betting lines for pre-rendered CFB Outliers trend cards from cfb_dryrun_picks + odds shop."""
from __future__ import annotations

from collections import defaultdict
from typing import Any

from cfb_odds_shop import CFBOddsShop, book_meta
from cfb_outliers_trend_engine import market_label

PICK_GROUP = {
    "spread": "spread",
    "moneyline": "moneyline",
    "total": "total",
    "team_total": "team_total",
    "h1_spread": "h1_spread",
    "h1_total": "h1_total",
}


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


def book_line(bk_name, bk_logo, line, odds, label, team_key=None, line_id=""):
    return {
        "id": line_id,
        "label": label,
        "line_text": line,
        "odds_text": fmt_odds(odds),
        "book_name": bk_name,
        "book_logo_url": bk_logo,
        "team_abbr": team_key,
    }


def index_picks(picks):
    idx = defaultdict(list)
    for p in picks:
        idx[(str(p["game_id"]), p["card_group"])].append(p)
    return idx


def pick_for(pick_rows, *, side=None, bet_type=None):
    for p in pick_rows:
        if bet_type and p.get("bet_type") != bet_type:
            continue
        if side and p.get("pick_side") != side:
            continue
        return p
    return None


def line_from_pick(p, label, team_key=None, line_id=""):
    if not p:
        return None
    if p.get("card_group") in ("spread", "h1_spread"):
        if p.get("best_line") is None:
            return None
        line_val = p["best_line"]
        line_text = fmt_spread(line_val)
    elif p.get("card_group") == "moneyline":
        if p.get("best_odds") is None:
            return None
        line_text = p.get("pick_label") or "ML"
    else:
        if p.get("best_line") is None:
            return None
        line_text = f"{label} {p['best_line']:g}"
    return book_line(
        p.get("best_book_name"),
        p.get("best_book_logo"),
        line_text,
        p.get("best_odds") or -110,
        label,
        team_key,
        line_id,
    )


def _gid_int(game_id) -> int:
    return int(game_id)


def _team_side(team: str | None, home: str, away: str) -> str:
    return "HOME" if team == home else "AWAY"


def _spread_close(game: dict, team: str | None, market: str) -> float | None:
    key = "fg_spread_close" if market == "spread" else "h1_spread_close"
    close = game.get(key)
    if close is None or team is None:
        return None
    val = float(close)
    return val if team == game["home_team"] else -val


def _ml_close(game: dict, team: str | None) -> float | None:
    if team is None:
        return None
    key = "fg_ml_home_close" if team == game["home_team"] else "fg_ml_away_close"
    val = game.get(key)
    return float(val) if val is not None else None


def _tt_close(game: dict, team: str | None) -> float | None:
    if team is None:
        return None
    key = "tt_home_close" if team == game["home_team"] else "tt_away_close"
    val = game.get(key)
    return float(val) if val is not None else None


def _shop_line(shop: CFBOddsShop | None, gid: int, market: str, side: str, team: str | None):
    if shop is None:
        return None
    if market in ("spread", "h1_spread"):
        fn = shop.best_h1_spread if market == "h1_spread" else shop.best_spread
        hit = fn(gid, side)
        if not hit:
            return None
        bk_name, bk_logo = book_meta(hit[2])
        return book_line(bk_name, bk_logo, fmt_spread(hit[0]), hit[1], market_label(market), team, "")
    if market == "moneyline":
        hit = shop.best_ml(gid, side)
        if not hit:
            return None
        bk_name, bk_logo = book_meta(hit[1])
        label = f"{team} ML" if team else "ML"
        return book_line(bk_name, bk_logo, label, hit[0], "Moneyline", team, "")
    if market in ("total", "h1_total"):
        fn = shop.best_h1_total if market == "h1_total" else shop.best_total
        hit = fn(gid, side)
        if not hit:
            return None
        bk_name, bk_logo = book_meta(hit[2])
        label = "Over" if side == "OVER" else "Under"
        return book_line(bk_name, bk_logo, f"{label} {hit[0]:g}", hit[1], label, None, "")
    if market == "team_total":
        hit = shop.best_tt(gid, team, side)
        if not hit:
            return None
        bk_name, bk_logo = book_meta(hit[2])
        label = "Over" if side == "OVER" else "Under"
        return book_line(bk_name, bk_logo, f"{label} {hit[0]:g}", hit[1], label, team, "")
    return None


def resolve_betting_lines(
    card: dict[str, Any],
    game: dict[str, Any],
    picks_idx,
    odds_shop: CFBOddsShop | None = None,
):
    market = card["market_key"]
    kind = card["subject_kind"]
    hit = card["hit_side"]
    team = card.get("team_abbr")
    gid = _gid_int(card["game_id"])
    home, away = game["home_team"], game["away_team"]
    side = _team_side(team, home, away)
    lines = []

    pick_rows = picks_idx.get((str(card["game_id"]), PICK_GROUP.get(market)), []) if market in PICK_GROUP else []

    if market in ("spread", "h1_spread"):
        if kind == "coach" or kind == "team":
            pick_side = side
        else:
            pick_side = "HOME" if hit else "AWAY"
        p = pick_for(pick_rows, side=pick_side)
        if ln := line_from_pick(p, market_label(market), team, f"{card['card_id']}-line"):
            lines.append({**ln, "id": f"{card['card_id']}-line"})
        elif ln := _shop_line(odds_shop, gid, market, side, team):
            lines.append({**ln, "id": f"{card['card_id']}-line"})
        elif (close := _spread_close(game, team, market)) is not None:
            lines.append(book_line(
                None, None, fmt_spread(close), -110, market_label(market), team,
                f"{card['card_id']}-line",
            ))

    elif market == "moneyline":
        p = pick_for(pick_rows, side=side)
        if p and p.get("best_odds") is not None:
            lines.append(book_line(
                p.get("best_book_name"), p.get("best_book_logo"),
                p.get("pick_label") or f"{team} ML",
                p.get("best_odds"),
                "Moneyline", team, f"{card['card_id']}-ml",
            ))
        elif ln := _shop_line(odds_shop, gid, market, side, team):
            lines.append({**ln, "id": f"{card['card_id']}-ml"})
        elif (ml := _ml_close(game, team)) is not None:
            lines.append(book_line(
                None, None, f"{team} ML", ml, "Moneyline", team, f"{card['card_id']}-ml",
            ))

    elif market in ("total", "h1_total"):
        close_key = "fg_total_close" if market == "total" else "h1_total_close"
        for ou_side, label in (("OVER", "Over"), ("UNDER", "Under")):
            p = pick_for(pick_rows, side=ou_side)
            if p and p.get("best_line") is not None:
                lines.append(book_line(
                    p.get("best_book_name"), p.get("best_book_logo"),
                    f"{label} {p['best_line']:g}",
                    p.get("best_odds") or -110,
                    label, None, f"{card['card_id']}-{ou_side.lower()}",
                ))
            elif ln := _shop_line(odds_shop, gid, market, ou_side, None):
                lines.append({**ln, "id": f"{card['card_id']}-{ou_side.lower()}"})
            elif game.get(close_key) is not None:
                lines.append(book_line(
                    None, None, f"{label} {float(game[close_key]):g}", -110, label, None,
                    f"{card['card_id']}-{ou_side.lower()}",
                ))

    elif market == "team_total":
        is_home = team == home
        bt = "team_total_home" if is_home else "team_total_away"
        close = _tt_close(game, team)
        for ou_side, label in (("OVER", "Over"), ("UNDER", "Under")):
            p = pick_for(pick_rows, side=ou_side, bet_type=bt)
            if p and p.get("best_line") is not None:
                lines.append(book_line(
                    p.get("best_book_name"), p.get("best_book_logo"),
                    f"{label} {p['best_line']:g}",
                    p.get("best_odds") or -110,
                    label, team, f"{card['card_id']}-{ou_side.lower()}",
                ))
            elif ln := _shop_line(odds_shop, gid, market, ou_side, team):
                lines.append({**ln, "id": f"{card['card_id']}-{ou_side.lower()}"})
            elif close is not None:
                lines.append(book_line(
                    None, None, f"{label} {close:g}", -110, label, team,
                    f"{card['card_id']}-{ou_side.lower()}",
                ))

    return lines
