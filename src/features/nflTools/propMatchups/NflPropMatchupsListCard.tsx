import { FeedPill, MlbToolListCard } from '@/features/mlbTools/shared/MlbToolListCard';
import { shortPlayerName, type NflPropGameFeedItem } from './model';

export function NflPropMatchupsListCard({
  item,
  isSelected,
  onSelect,
}: {
  item: NflPropGameFeedItem;
  isSelected: boolean;
  onSelect: (id: string) => void;
}) {
  const top = item.topHighlight;

  return (
    <MlbToolListCard
      item={item}
      isSelected={isSelected}
      onSelect={onSelect}
      caption={item.gameLabel}
      pills={
        <>
          <FeedPill label="Edge">
            {top ? (
              <span className="truncate text-foreground">
                {shortPlayerName(top.player.player_name)} ·{' '}
                {top.highlight.direction === 'up' ? 'up' : 'down'}
              </span>
            ) : (
              <span className="text-muted-foreground">No callout</span>
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
