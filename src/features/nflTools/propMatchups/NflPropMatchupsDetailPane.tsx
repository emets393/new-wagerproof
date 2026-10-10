import { BarChart3 } from 'lucide-react';
import { HeroChip, MlbToolDetailShell } from '@/features/mlbTools/shared/MlbToolDetailShell';
import type { NflPropPlayerTrends } from '@/features/propBreakdown/types';
import type { NflPropGameFeedItem } from './model';
import { NflPropMatchupsSections } from './sections';

export function NflPropMatchupsDetailPane({
  item,
  isFeedLoading,
  trendsByPlayer,
  onSelectPlayer,
  spotlightIds,
  spotlightRank,
}: {
  item: NflPropGameFeedItem | null;
  isFeedLoading: boolean;
  trendsByPlayer: Record<string, NflPropPlayerTrends>;
  onSelectPlayer?: (playerId: string) => void;
  spotlightIds?: ReadonlySet<string>;
  spotlightRank?: ReadonlyMap<string, number>;
}) {
  const spotlightCount = item
    ? [...item.homePlayers, ...item.awayPlayers].filter((player) => spotlightIds?.has(player.player_id)).length
    : 0;

  return (
    <MlbToolDetailShell
      game={item}
      isFeedLoading={isFeedLoading}
      emptyIcon={<BarChart3 className="h-9 w-9 text-muted-foreground/50" />}
      emptyLabel="Select a game to see player prop matchups"
      subline={item ? item.gameLabel : undefined}
      chips={
        item ? (
          <>
            <HeroChip label="Week">
              <span className="text-foreground">
                {item.week} · {item.season}
              </span>
            </HeroChip>
            <HeroChip label="Players">
              <span className="text-foreground">{item.playerCount}</span>
            </HeroChip>
            <HeroChip label="Spotlight">
              <span className="text-foreground">{spotlightCount}</span>
            </HeroChip>
          </>
        ) : undefined
      }
    >
      {item && <NflPropMatchupsSections item={item} trendsByPlayer={trendsByPlayer} onSelectPlayer={onSelectPlayer} spotlightIds={spotlightIds} spotlightRank={spotlightRank} />}
    </MlbToolDetailShell>
  );
}
