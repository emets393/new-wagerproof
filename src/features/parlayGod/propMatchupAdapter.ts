// Assembles `ParlayGodPropMatchup[]` (the engine's prop-slate input) from the
// shapes the existing MLB hooks already return — pure, so it's unit-testable and
// the hook stays thin. The batched `mlb_game_lineups` rows come from
// `useParlayGod` (one query over all game_pks, not the heavy per-game matchup fetch).
import type { MatchupGame } from '@/types/mlb-matchups';
import type { MlbPlayerPropRow } from '@/types/mlb-player-props';
import type { ParlayGodPropMatchup } from './types';

/** Slim projection of `mlb_game_lineups` — just enough to tint prop avatars. */
export interface LineupTeamRow {
  game_pk: number;
  team_id: number;
  player_id: number;
}

export function buildPropMatchups(params: {
  games: MatchupGame[];
  propsByGamePk: Map<number, MlbPlayerPropRow[]>;
  lineupRows: LineupTeamRow[];
}): ParlayGodPropMatchup[] {
  const { games, propsByGamePk, lineupRows } = params;

  const rowsByGame = new Map<number, LineupTeamRow[]>();
  for (const row of lineupRows) {
    const list = rowsByGame.get(row.game_pk) ?? [];
    list.push(row);
    rowsByGame.set(row.game_pk, list);
  }

  const matchups: ParlayGodPropMatchup[] = [];
  for (const game of games) {
    const props = propsByGamePk.get(game.game_pk);
    // No props for this game → no prop legs; skip rather than carry an empty shell.
    if (!props || props.length === 0) continue;

    const teamByPlayerId = new Map<number, string>();
    const abbrByTeamId = new Map<number, string>([
      [game.away_team_id, game.away_abbr],
      [game.home_team_id, game.home_abbr],
    ]);
    for (const row of rowsByGame.get(game.game_pk) ?? []) {
      const abbr = abbrByTeamId.get(row.team_id);
      if (abbr) teamByPlayerId.set(row.player_id, abbr);
    }
    // Starters may not appear in the lineup table — seed them off the game row.
    if (Number.isFinite(game.away_sp_id) && game.away_sp_id > 0) {
      teamByPlayerId.set(game.away_sp_id, game.away_abbr);
    }
    if (Number.isFinite(game.home_sp_id) && game.home_sp_id > 0) {
      teamByPlayerId.set(game.home_sp_id, game.home_abbr);
    }

    matchups.push({
      gamePk: game.game_pk,
      awayAbbr: game.away_abbr,
      homeAbbr: game.home_abbr,
      gameTimeEt: game.game_time,
      teamByPlayerId,
      props,
    });
  }
  return matchups;
}
