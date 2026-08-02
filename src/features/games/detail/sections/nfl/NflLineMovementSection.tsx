import type { NFLPrediction } from '../../../api/nflGames';
import type { GameFeedItem } from '../../../types';
import { LineMovementWidget } from '../shared/LineMovementWidget';
import { slateScalars } from '../shared/lineMovement';
import { TeamMark } from './shared';
import { useNflLineMovement } from './useNflLineMovement';

interface NflLineMovementSectionProps {
  game: GameFeedItem;
  extras: Record<string, unknown>;
}

/**
 * NFL Line Movement — game-keyed consensus from `nfl_line_movement`, with true
 * opening spread/total values from the `nfl_slate_games` row.
 */
export function NflLineMovementSection({ game }: NflLineMovementSectionProps) {
  const raw = game.raw as NFLPrediction;
  const away = game.awayTeam;
  const home = game.homeTeam;

  const { markets, loading, error, refetch, hasDataSource } = useNflLineMovement({
    gameId: (raw.game_id as string | number | undefined) ?? null,
    season: raw.season as number | undefined,
    away,
    home,
    scalars: slateScalars(raw as unknown as Record<string, unknown>),
  });

  return (
    <LineMovementWidget
      markets={markets}
      loading={loading}
      error={error}
      onRetry={refetch}
      hasDataSource={hasDataSource}
      subtitle="Live game consensus — opening lines come from the slate's true opener."
      renderTeamMark={(team, size) => <TeamMark team={team} size={size} />}
    />
  );
}
