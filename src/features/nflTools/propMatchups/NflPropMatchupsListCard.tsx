import { FeedPill, MlbToolListCard } from '@/features/mlbTools/shared/MlbToolListCard';
import type { NflPropGameFeedItem } from './model';

export function NflPropMatchupsListCard({
  item,
  isSelected,
  onSelect,
  spotlightCount = 0,
}: {
  item: NflPropGameFeedItem;
  isSelected: boolean;
  onSelect: (id: string) => void;
  spotlightCount?: number;
}) {
  return (
    <MlbToolListCard
      item={item}
      isSelected={isSelected}
      onSelect={onSelect}
      caption={item.gameLabel}
      pills={
        <>
          <FeedPill label="Spotlight">
            {spotlightCount > 0 ? (
              <span className="truncate text-foreground">{spotlightCount}</span>
            ) : (
              <span className="text-muted-foreground">None</span>
            )}
          </FeedPill>
          <FeedPill label="Players" trailing={`${item.playerCount}`}>
            <span className="text-foreground">listed</span>
          </FeedPill>
        </>
      }
    />
  );
}
