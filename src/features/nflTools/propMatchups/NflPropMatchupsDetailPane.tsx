import { BarChart3 } from 'lucide-react';
import { HeroChip, MlbToolDetailShell } from '@/features/mlbTools/shared/MlbToolDetailShell';
import type { NflPropPlayerTrends } from '@/features/propBreakdown/types';
import { shortPlayerName, type NflPropGameFeedItem } from './model';
import { NflPropMatchupsSections } from './sections';

export function NflPropMatchupsDetailPane({
  item,
  isFeedLoading,
  trendsByPlayer,
  onSelectPlayer,
}: {
  item: NflPropGameFeedItem | null;
  isFeedLoading: boolean;
  trendsByPlayer: Record<string, NflPropPlayerTrends>;
  onSelectPlayer?: (playerId: string) => void;
}) {
  const top = item?.topHighlight ?? null;

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
            <HeroChip label="Edge">
              {top ? (
                <span className="truncate text-foreground">
                  {shortPlayerName(top.player.player_name)}
                </span>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </HeroChip>
          </>
        ) : undefined
      }
    >
      {item && <NflPropMatchupsSections item={item} trendsByPlayer={trendsByPlayer} onSelectPlayer={onSelectPlayer} />}
    </MlbToolDetailShell>
  );
}
