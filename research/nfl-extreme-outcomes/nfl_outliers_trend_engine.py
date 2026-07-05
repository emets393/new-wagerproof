"""Card assembly for NFL Outliers trends — Python port of NFLTrendsEngine.swift."""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any
from zoneinfo import ZoneInfo

DIVISIONS = [
    ["BUF", "MIA", "NE", "NYJ"],
    ["BAL", "CIN", "CLE", "PIT"],
    ["HOU", "IND", "JAX", "TEN"],
    ["DEN", "KC", "LV", "LAC"],
    ["DAL", "NYG", "PHI", "WAS"],
    ["CHI", "DET", "GB", "MIN"],
    ["ATL", "CAR", "NO", "TB"],
    ["ARI", "LA", "SF", "SEA"],
]

TEAM_MARKETS = ["spread", "moneyline", "total", "team_total", "h1_spread", "h1_total"]
COACH_MARKETS = TEAM_MARKETS
REFEREE_MARKETS = ["spread", "moneyline", "total", "h1_spread", "h1_total"]
PLAYER_PREVIEW_CAP = 4


def is_division_game(home: str, away: str) -> bool:
    return any(home in d and away in d for d in DIVISIONS)


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
    return GameContext(
        home_fav_dog=home_fav,
        away_fav_dog=away_fav,
        division_scope="division" if is_division_game(game["home_ab"], game["away_ab"]) else "non_division",
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
        "player_anytime_td": "Anytime TD",
        "player_rush_yds": "Rushing Yards",
        "player_reception_yds": "Receiving Yards",
        "player_receptions": "Receptions",
        "player_pass_yds": "Passing Yards",
        "player_pass_tds": "Passing TDs",
        "player_pass_attempts": "Pass Attempts",
        "player_pass_completions": "Completions",
        "player_rush_attempts": "Rush Attempts",
    }
    return labels.get(market, market.replace("_", " ").title())


def verb(market: str, hit_side: bool, is_referee: bool) -> str:
    if market == "spread":
        if is_referee:
            return "Home covered" if hit_side else "Away covered"
        return "Covered" if hit_side else "Failed to cover"
    if market == "moneyline":
        if is_referee:
            return "Home won" if hit_side else "Away won"
        return "Won" if hit_side else "Lost"
    if market in ("total", "team_total", "h1_total", "player_pass_yds", "player_pass_tds",
                  "player_receptions", "player_reception_yds", "player_rush_yds",
                  "player_pass_attempts", "player_pass_completions", "player_rush_attempts"):
        return "Over" if hit_side else "Under"
    if market == "h1_spread":
        if is_referee:
            return "Home covered 1H" if hit_side else "Away covered 1H"
        return "Covered 1H" if hit_side else "Failed to cover 1H"
    if market == "player_anytime_td":
        return "Scored" if hit_side else "Didn't score"
    return "Hit" if hit_side else "Missed"


def coverage_chip(coverage: str | None) -> str | None:
    if not coverage or coverage.lower() == "career":
        return None
    if "2023" in coverage:
        return "2023–25"
    if "2024" in coverage:
        return "2024–25"
    return coverage


def split_cell_metrics(market: str, cell: dict, is_referee: bool) -> dict | None:
    """Normalize split/H2H cells into display + sort fields.

    Anytime TD is always shown from the Yes/scored perspective so players who
    rarely score don't bubble up as strong \"didn't score\" signals.
    """
    n = cell.get("n", 0)
    if n < 2:
        return None
    if market == "player_anytime_td":
        scored = cell.get("h", 0)
        rate = cell.get("pct", scored / n if n else 0)
        return {
            "count": scored,
            "display_pct": rate,
            "sort_pct": rate,
            "hit_side": True,
            "verb": "Scored",
        }
    pct = cell.get("pct", 0)
    dominant = max(pct, 1 - pct)
    hit_side = pct >= 0.5
    count = cell["h"] if hit_side else cell["l"]
    return {
        "count": count,
        "display_pct": dominant,
        "sort_pct": dominant,
        "hit_side": hit_side,
        "verb": verb(market, hit_side, is_referee),
    }


def team_dimension_specs(side: str, fav_dog: str | None, opponent: str) -> list[TrendDimensionSpec]:
    dims = [
        TrendDimensionSpec("overall", "games"),
        TrendDimensionSpec(side, "home games" if side == "home" else "road games"),
    ]
    if fav_dog:
        dims.append(TrendDimensionSpec(
            fav_dog,
            "as a favorite" if fav_dog == "favorite" else "as an underdog",
        ))
    dims.append(TrendDimensionSpec("h2h", f"vs {opponent}", is_h2h=True, opponent=opponent))
    return dims


def coach_dimension_specs(side: str, fav_dog: str | None, ctx: GameContext, opponent: str) -> list[TrendDimensionSpec]:
    dims = team_dimension_specs(side, fav_dog, opponent)
    insert_at = len(dims) - 1
    dims.insert(insert_at, TrendDimensionSpec(
        ctx.division_scope,
        "division games" if ctx.division_scope == "division" else "non-division games",
    ))
    dims.insert(insert_at + 1, TrendDimensionSpec(
        ctx.primetime_scope,
        "primetime games" if ctx.primetime_scope == "primetime" else "non-primetime games",
    ))
    return dims


def referee_dimension_specs(ctx: GameContext) -> list[TrendDimensionSpec]:
    return [
        TrendDimensionSpec("overall", "games"),
        TrendDimensionSpec(
            ctx.division_scope,
            "division games" if ctx.division_scope == "division" else "non-division games",
        ),
        TrendDimensionSpec(
            ctx.primetime_scope,
            "primetime games" if ctx.primetime_scope == "primetime" else "non-primetime games",
        ),
    ]


def player_dimension_specs(side: str, ctx: GameContext, opponent: str) -> list[TrendDimensionSpec]:
    return [
        TrendDimensionSpec("overall", "games"),
        TrendDimensionSpec(side, "home games" if side == "home" else "road games"),
        TrendDimensionSpec(
            ctx.division_scope,
            "division games" if ctx.division_scope == "division" else "non-division games",
        ),
        TrendDimensionSpec(
            ctx.primetime_scope,
            "primetime games" if ctx.primetime_scope == "primetime" else "non-primetime games",
        ),
        TrendDimensionSpec("h2h", f"vs {opponent}", is_h2h=True, opponent=opponent),
    ]


def extreme_split_row(
    splits: dict,
    market: str,
    dimension: str,
    display_context: str,
    is_referee: bool,
    coverage: str | None,
) -> dict | None:
    dim_block = (splits.get(market) or {}).get(dimension)
    if not dim_block:
        return None
    best = None
    for window in sorted(dim_block.keys(), key=lambda w: int(w)):
        cell = dim_block[window]
        metrics = split_cell_metrics(market, cell, is_referee)
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
    is_referee: bool,
    opponent: str,
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
        is_referee,
    )
    if not metrics:
        return None
    pct_text = int(round(metrics["display_pct"] * 100))
    text = f"{metrics['verb']} {metrics['count']} of last {n} vs {opponent} ({pct_text}%)"
    return {
        "id": f"{market}-h2h-{opponent}",
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
    team_abbr: str | None,
    player_id: str | None,
    market: str,
    is_referee: bool,
    splits: dict,
    h2h: dict | None,
    dimensions: list[TrendDimensionSpec],
    coverage: str | None,
) -> dict | None:
    rows = []
    for dim in dimensions:
        if dim.is_h2h:
            if not dim.opponent or not h2h:
                continue
            cell = (h2h.get("markets") or h2h).get(market) if isinstance(h2h, dict) else None
            if cell is None and isinstance(h2h, dict):
                cell = h2h.get(market)
            if cell and (row := extreme_h2h_row(cell, market, is_referee, dim.opponent, coverage)):
                rows.append(row)
            continue
        if row := extreme_split_row(splits, market, dim.key, dim.display_context, is_referee, coverage):
            rows.append(row)
    if not rows:
        return None
    strongest = max(rows, key=lambda r: (r["dominant_pct"], r["sample_n"]))
    gid = game["game_id"]
    matchup = f"{game['away_ab']} @ {game['home_ab']}"
    sort_rank = strongest["dominant_pct"] * 1000 + strongest["sample_n"]
    return {
        "card_id": id_prefix,
        "game_id": gid,
        "matchup_label": matchup,
        "subject_kind": kind,
        "subject_name": subject_name,
        "subject_detail": subject_detail,
        "team_abbr": team_abbr,
        "player_id": player_id,
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


def player_markets(player: dict) -> list[str]:
    mkts = player.get("markets") or []
    if not mkts:
        return [
            "player_pass_yds", "player_pass_tds", "player_receptions",
            "player_reception_yds", "player_rush_yds",
            "player_pass_attempts", "player_pass_completions", "player_rush_attempts",
            "player_anytime_td",
        ]
    return mkts


def coach_detail(coach: dict) -> str | None:
    parts = []
    if coach.get("current_team"):
        parts.append(coach["current_team"])
    if coach.get("career_games"):
        parts.append(f"{coach['career_games']} career games")
    return " · ".join(parts) if parts else None


def player_detail(player: dict) -> str | None:
    parts = []
    if player.get("position"):
        parts.append(player["position"])
    if player.get("current_team"):
        parts.append(player["current_team"])
    return " · ".join(parts) if parts else None


def player_matchup(player: dict, opponent: str) -> dict | None:
    matchups = player.get("matchups") or {}
    if opponent in matchups:
        return matchups[opponent]
    aliases = {
        "LA": "LAR", "LAR": "LA",
        "JAX": "JAC", "JAC": "JAX",
        "WSH": "WAS", "WAS": "WSH",
        "GB": "GNB", "GNB": "GB",
    }
    alt = aliases.get(opponent)
    if alt and alt in matchups:
        return matchups[alt]
    return None


def build_all_cards(
    games: list[dict],
    teams: list[dict],
    coaches: list[dict],
    referees: list[dict],
    players: list[dict],
) -> list[dict]:
    cards: list[dict] = []
    team_by = {t["team_abbr"]: t for t in teams}
    coach_by = active_coaches_by_team(coaches)
    ref_by = {r["referee"]: r for r in referees}
    players_by_team: dict[str, list[dict]] = {}
    for p in players:
        players_by_team.setdefault(p.get("current_team") or "", []).append(p)

    for game in games:
        ctx = game_context(game)
        matchup = f"{game['away_ab']} @ {game['home_ab']}"
        gid = game["game_id"]

        for abbr, side, opp, fav_dog in (
            (game["home_ab"], "home", game["away_ab"], ctx.home_fav_dog),
            (game["away_ab"], "away", game["home_ab"], ctx.away_fav_dog),
        ):
            team = team_by.get(abbr)
            if team:
                dims = team_dimension_specs(side, fav_dog, opp)
                for market in TEAM_MARKETS:
                    if card := build_subject_card(
                        id_prefix=f"team-{abbr}-{gid}-{market}",
                        game=game,
                        kind="team",
                        subject_name=team.get("team_name") or abbr,
                        subject_detail=abbr,
                        team_abbr=abbr,
                        player_id=None,
                        market=market,
                        is_referee=False,
                        splits=team.get("splits") or {},
                        h2h=(team.get("matchups") or {}).get(opp),
                        dimensions=dims,
                        coverage=None,
                    ):
                        cards.append(card)

            coach = coach_by.get(abbr)
            if coach:
                dims = coach_dimension_specs(side, fav_dog, ctx, opp)
                for market in COACH_MARKETS:
                    cov = (coach.get("market_coverage") or {}).get(market)
                    if card := build_subject_card(
                        id_prefix=f"coach-{coach['coach']}-{gid}-{market}",
                        game=game,
                        kind="coach",
                        subject_name=coach["coach"],
                        subject_detail=coach_detail(coach),
                        team_abbr=abbr,
                        player_id=None,
                        market=market,
                        is_referee=False,
                        splits=coach.get("splits") or {},
                        h2h=(coach.get("matchups") or {}).get(opp),
                        dimensions=dims,
                        coverage=cov,
                    ):
                        cards.append(card)

        ref_name = game.get("assigned_referee")
        if ref_name and (ref := ref_by.get(ref_name)):
            dims = referee_dimension_specs(ctx)
            for market in REFEREE_MARKETS:
                cov = (ref.get("market_coverage") or {}).get(market)
                if card := build_subject_card(
                    id_prefix=f"ref-{ref_name}-{gid}-{market}",
                    game=game,
                    kind="referee",
                    subject_name=ref_name,
                    subject_detail=f"{ref.get('career_games')} career games" if ref.get("career_games") else None,
                    team_abbr=None,
                    player_id=None,
                    market=market,
                    is_referee=True,
                    splits=ref.get("splits") or {},
                    h2h=None,
                    dimensions=dims,
                    coverage=cov,
                ):
                    cards.append(card)

        all_players = (players_by_team.get(game["home_ab"]) or []) + (players_by_team.get(game["away_ab"]) or [])
        for player in all_players:
            team_ab = player.get("current_team") or ""
            side = "home" if team_ab == game["home_ab"] else "away"
            opponent = game["away_ab"] if team_ab == game["home_ab"] else game["home_ab"]
            dims = player_dimension_specs(side, ctx, opponent)
            h2h = player_matchup(player, opponent)
            for market in player_markets(player):
                if card := build_subject_card(
                    id_prefix=f"player-{player['player_id']}-{gid}-{market}",
                    game=game,
                    kind="player",
                    subject_name=player.get("player_name") or "Player",
                    subject_detail=player_detail(player),
                    team_abbr=team_ab,
                    player_id=player["player_id"],
                    market=market,
                    is_referee=False,
                    splits=player.get("splits") or {},
                    h2h=h2h,
                    dimensions=dims,
                    coverage=player.get("coverage"),
                ):
                    cards.append(card)

    cards.sort(key=lambda c: (-c["trend_value"], -c["trend_sample_n"]))
    return cards
