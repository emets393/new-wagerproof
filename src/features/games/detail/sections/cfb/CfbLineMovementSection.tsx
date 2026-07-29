import type { CFBPrediction } from '../../../api/cfbGames';
import type { GameFeedItem } from '../../../types';
import { LineMovementWidget } from '../shared/LineMovementWidget';
import { slateScalars } from '../shared/lineMovement';
import { CollegeTeamMark } from './shared';
import { useCfbLineMovement } from './useCfbLineMovement';

/**
 * CFB Line Movement — FG consensus from the game-keyed `cfb_line_movement` view,
 * openers and every other market's fallback from `cfb_slate_games`. 1H and team
 * totals stay visible but empty until those markets are archived for CFB.
 */
export function CfbLineMovementSection({ game }: { game: GameFeedItem<CFBPrediction> }) {
  const raw = game.raw;
  const away = game.awayTeam;
  const home = game.homeTeam;

  const { markets, loading, error, refetch, hasDataSource } = useCfbLineMovement({
    gameId: raw.game_id ?? null,
    season: (raw.season as number | undefined) ?? null,
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
      renderTeamMark={(team, size) => <CollegeTeamMark team={team} size={size} />}
    />
  );
}
