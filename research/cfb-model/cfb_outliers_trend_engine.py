"""Card assembly for CFB Outliers trends — mirrors nfl_outliers_trend_engine.py (teams + coaches only)."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Any
from zoneinfo import ZoneInfo

TEAM_MARKETS = ["spread", "moneyline", "total", "team_total", "h1_spread", "h1_total"]
COACH_MARKETS = TEAM_MARKETS


def is_conference_game(home_conf: str | None, away_conf: str | None) -> bool:
    if not home_conf or not away_conf:
        return False
    return home_conf.strip().lower() == away_conf.strip().lower()


def is_primetime(kickoff: str | None) -> bool:
    if not kickoff:
        return False
    try:
        ts = kickoff.replace("Z", "+00:00")
        dt = datetime.fromisoformat(ts)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=ZoneInfo("UTC"))
        et = dt.astimezone(ZoneInfo("America/New_York"))
        return et.hour >= 19
    except ValueError:
        pass
    if "T" in kickoff:
        part = kickoff.split("T", 1)[1]
        hour = part.split(":", 1)[0]
        try:
            return int(hour) >= 19
        except ValueError:
            return False
    return False


@dataclass
class GameContext:
    home_fav_dog: str | None
    away_fav_dog: str | None
    division_scope: str
    primetime_scope: str


def game_context(game: dict[str, Any]) -> GameContext:
    spread = game.get("fg_spread_close") or 0
    if spread == 0:
        home_fav = away_fav = None
    elif spread < 0:
        home_fav, away_fav = "favorite", "underdog"
    else:
        home_fav, away_fav = "underdog", "favorite"
    conf = is_conference_game(game.get("home_conf"), game.get("away_conf"))
    return GameContext(
        home_fav_dog=home_fav,
        away_fav_dog=away_fav,
        division_scope="division" if conf else "non_division",
        primetime_scope="primetime" if is_primetime(game.get("kickoff")) else "regular",
    )


@dataclass
class TrendDimensionSpec:
    key: str
    display_context: str
    is_h2h: bool = False
    opponent: str | None = None


def market_label(market: str) -> str:
    labels = {
        "spread": "Spread",
        "moneyline": "Moneyline",
        "total": "Total",
        "team_total": "Team Total",
        "h1_spread": "1H Spread",
        "h1_total": "1H Total",
    }
    return labels.get(market, market.replace("_", " ").title())


def verb(market: str, hit_side: bool) -> str:
    if market == "spread":
        return "Covered" if hit_side else "Failed to cover"
    if market == "moneyline":
        return "Won" if hit_side else "Lost"
    if market in ("total", "team_total", "h1_total"):
        return "Over" if hit_side else "Under"
    if market == "h1_spread":
        return "Covered 1H" if hit_side else "Failed to cover 1H"
    return "Hit" if hit_side else "Missed"


def coverage_chip(coverage: str | None) -> str | None:
    if not coverage or coverage.lower() == "career":
        return None
    if "2023" in coverage:
        return "since 2023"
    if "2024" in coverage:
        return "2024–25"
    return None


def split_cell_metrics(market: str, cell: dict) -> dict | None:
    n = cell.get("n", 0)
    if n < 2:
        return None
    pct = cell.get("pct", 0)
    dominant = max(pct, 1 - pct)
    hit_side = pct >= 0.5
    count = cell["h"] if hit_side else cell["l"]
    return {
        "count": count,
        "display_pct": dominant,
        "sort_pct": dominant,
        "hit_side": hit_side,
        "verb": verb(market, hit_side),
    }


def team_dimension_specs(side: str, fav_dog: str | None, opponent: str, opp_label: str) -> list[TrendDimensionSpec]:
    dims = [
        TrendDimensionSpec("overall", "games"),
        TrendDimensionSpec(side, "home games" if side == "home" else "road games"),
    ]
    if fav_dog:
        dims.append(TrendDimensionSpec(
            fav_dog,
            "as a favorite" if fav_dog == "favorite" else "as an underdog",
        ))
    dims.append(TrendDimensionSpec("h2h", f"vs {opp_label}", is_h2h=True, opponent=opponent))
    return dims


def coach_dimension_specs(side: str, fav_dog: str | None, ctx: GameContext, opponent: str, opp_label: str) -> list[TrendDimensionSpec]:
    dims = team_dimension_specs(side, fav_dog, opponent, opp_label)
    insert_at = len(dims) - 1
    dims.insert(insert_at, TrendDimensionSpec(
        ctx.division_scope,
        "Conference games" if ctx.division_scope == "division" else "Non-conference games",
    ))
    dims.insert(insert_at + 1, TrendDimensionSpec(
        ctx.primetime_scope,
        "primetime games" if ctx.primetime_scope == "primetime" else "non-primetime games",
    ))
    return dims


def extreme_split_row(
    splits: dict,
    market: str,
    dimension: str,
    display_context: str,
    coverage: str | None,
) -> dict | None:
    dim_block = (splits.get(market) or {}).get(dimension)
    if not dim_block:
        return None
    best = None
    for window in sorted(dim_block.keys(), key=lambda w: int(w)):
        cell = dim_block[window]
        metrics = split_cell_metrics(market, cell)
        if not metrics:
            continue
        candidate = (cell, window, metrics)
        if best is None or metrics["sort_pct"] > best[2]["sort_pct"] or (
            metrics["sort_pct"] == best[2]["sort_pct"] and cell.get("n", 0) > best[0].get("n", 0)
        ):
            best = candidate
    if not best:
        return None
    cell, window, metrics = best
    pct_text = int(round(metrics["display_pct"] * 100))
    text = f"{metrics['verb']} {metrics['count']} of last {cell['n']} {display_context} ({pct_text}%)"
    return {
        "id": f"{market}-{dimension}-{window}",
        "text": text,
        "coverage_note": coverage_chip(coverage),
        "dominant_pct": metrics["display_pct"],
        "sample_n": cell["n"],
        "hit_side": metrics["hit_side"],
    }


def extreme_h2h_row(
    cell: dict,
    market: str,
    opponent_label: str,
    coverage: str | None,
) -> dict | None:
    n = cell.get("n", 0)
    if n < 2:
        return None
    pct = cell.get("pct")
    if pct is None:
        pct = cell["h"] / n if n else 0
    metrics = split_cell_metrics(
        market,
        {"n": n, "h": cell.get("h", 0), "l": cell.get("l", max(0, n - cell.get("h", 0))), "pct": pct},
    )
    if not metrics:
        return None
    pct_text = int(round(metrics["display_pct"] * 100))
    text = f"{metrics['verb']} {metrics['count']} of last {n} vs {opponent_label} ({pct_text}%)"
    return {
        "id": f"{market}-h2h-{opponent_label}",
        "text": text,
        "coverage_note": coverage_chip(coverage),
        "dominant_pct": metrics["display_pct"],
        "sample_n": n,
        "hit_side": metrics["hit_side"],
    }


def build_subject_card(
    *,
    id_prefix: str,
    game: dict,
    kind: str,
    subject_name: str,
    subject_detail: str | None,
    team_key: str | None,
    market: str,
    splits: dict,
    h2h: dict | None,
    dimensions: list[TrendDimensionSpec],
    coverage: str | None,
    opponent_label: str,
) -> dict | None:
    rows = []
    for dim in dimensions:
        if dim.is_h2h:
            if not dim.opponent or not h2h:
                continue
            cell = (h2h.get("markets") or h2h).get(market) if isinstance(h2h, dict) else None
            if cell is None and isinstance(h2h, dict):
                cell = h2h.get(market)
            if cell and (row := extreme_h2h_row(cell, market, opponent_label, coverage)):
                rows.append(row)
            continue
        if row := extreme_split_row(splits, market, dim.key, dim.display_context, coverage):
            rows.append(row)
    if not rows:
        return None
    strongest = max(rows, key=lambda r: (r["dominant_pct"], r["sample_n"]))
    gid = str(game["game_id"])
    matchup = game.get("matchup_label") or f"{game['away_team']} @ {game['home_team']}"
    sort_rank = strongest["dominant_pct"] * 1000 + strongest["sample_n"]
    return {
        "card_id": id_prefix,
        "game_id": gid,
        "matchup_label": matchup,
        "subject_kind": kind,
        "subject_name": subject_name,
        "subject_detail": subject_detail,
        "team_abbr": team_key,
        "player_id": None,
        "market_key": market,
        "bet_type_label": market_label(market),
        "trend_value": strongest["dominant_pct"],
        "trend_sample_n": strongest["sample_n"],
        "sort_rank": sort_rank,
        "hit_side": strongest["hit_side"],
        "rows": [{k: v for k, v in r.items() if k != "hit_side"} for r in rows],
        "headshot_url": None,
        "betting_lines": [],
        "is_player_overflow": False,
    }


def active_coaches_by_team(coaches: list[dict]) -> dict[str, dict]:
    best: dict[str, dict] = {}
    for coach in coaches:
        team = coach.get("current_team")
        if not team:
            continue
        if team not in best or (coach.get("last_season") or 0) > (best[team].get("last_season") or 0):
            best[team] = coach
    return best


def coach_detail(coach: dict) -> str | None:
    parts = []
    if coach.get("current_team"):
        parts.append(coach["current_team"])
    if coach.get("career_games"):
        parts.append(f"{coach['career_games']} career games")
    return " · ".join(parts) if parts else None


def matchup_record(matchups: dict | None, opponent: str) -> dict | None:
    if not matchups:
        return None
    if opponent in matchups:
        return matchups[opponent]
    for key, val in matchups.items():
        if key.lower() == opponent.lower():
            return val
    return None


def build_all_cards(
    games: list[dict],
    teams: list[dict],
    coaches: list[dict],
) -> list[dict]:
    cards: list[dict] = []
    team_by = {t["team_name"]: t for t in teams}
    coach_by = active_coaches_by_team(coaches)

    for game in games:
        ctx = game_context(game)
        home = game["home_team"]
        away = game["away_team"]
        home_label = game.get("home_ab") or home
        away_label = game.get("away_ab") or away
        gid = str(game["game_id"])

        for team_name, side, opp, opp_label, fav_dog in (
            (home, "home", away, away_label, ctx.home_fav_dog),
            (away, "away", home, home_label, ctx.away_fav_dog),
        ):
            team = team_by.get(team_name)
            if team:
                dims = team_dimension_specs(side, fav_dog, opp, opp_label)
                for market in TEAM_MARKETS:
                    if card := build_subject_card(
                        id_prefix=f"team-{team_name}-{gid}-{market}",
                        game=game,
                        kind="team",
                        subject_name=team_name,
                        subject_detail=game.get("home_ab") if team_name == home else game.get("away_ab"),
                        team_key=team_name,
                        market=market,
                        splits=team.get("splits") or {},
                        h2h=matchup_record(team.get("matchups") or {}, opp),
                        dimensions=dims,
                        coverage=None,
                        opponent_label=opp_label,
                    ):
                        cards.append(card)

            coach = coach_by.get(team_name)
            if coach:
                dims = coach_dimension_specs(side, fav_dog, ctx, opp, opp_label)
                for market in COACH_MARKETS:
                    cov = (coach.get("market_coverage") or {}).get(market)
                    if card := build_subject_card(
                        id_prefix=f"coach-{coach['coach']}-{gid}-{market}",
                        game=game,
                        kind="coach",
                        subject_name=coach["coach"],
                        subject_detail=coach_detail(coach),
                        team_key=team_name,
                        market=market,
                        splits=coach.get("splits") or {},
                        h2h=matchup_record(coach.get("matchups") or {}, opp),
                        dimensions=dims,
                        coverage=cov,
                        opponent_label=opp_label,
                    ):
                        cards.append(card)

    cards.sort(key=lambda c: (-c["trend_value"], -c["trend_sample_n"]))
    return cards
