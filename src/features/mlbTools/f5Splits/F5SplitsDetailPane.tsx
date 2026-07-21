import { Timer } from 'lucide-react';
import { HeroChip, MlbToolDetailShell } from '../shared/MlbToolDetailShell';
import { DirectionWord, TeamMark } from '../shared/visuals';
import { F5SplitsSections } from './sections';
import { handSuffix, type F5FeedItem } from './model';

/**
 * Right pane for /mlb/f5-splits. The hero restates the two answers (side lean,
 * total lean) so the widget stack below reads as the evidence for them.
 */
export function F5SplitsDetailPane({
  item,
  isFeedLoading,
}: {
  item: F5FeedItem | null;
  isFeedLoading: boolean;
}) {
  const leanTeam =
    item?.side.lean === 'away' ? item.away : item?.side.lean === 'home' ? item.home : null;

  return (
    <MlbToolDetailShell
      game={item}
      isFeedLoading={isFeedLoading}
      emptyIcon={<Timer className="h-9 w-9 text-muted-foreground/50" />}
      emptyLabel="Select a game to see its first-five splits"
      subline={
        item
          ? `${item.game.away_sp_name ?? 'TBD'}${handSuffix(item.game.away_sp_hand) ? ` (${handSuffix(item.game.away_sp_hand)})` : ''} vs ${item.game.home_sp_name ?? 'TBD'}${handSuffix(item.game.home_sp_hand) ? ` (${handSuffix(item.game.home_sp_hand)})` : ''}`
          : undefined
      }
      chips={
        item ? (
          <>
            <HeroChip label="F5 side">
              {leanTeam ? (
                <>
                  <TeamMark team={leanTeam} size={16} />
                  <span className="text-foreground">{leanTeam.abbrev}</span>
                  <span className="text-muted-foreground">
                    +{item.side.marginPts?.toFixed(1)}%
                  </span>
                </>
              ) : (
                <span className="text-muted-foreground">No edge</span>
              )}
            </HeroChip>
            <HeroChip label="F5 total">
              <DirectionWord direction={item.total.direction} />
              {item.total.gap !== null && (
                <span className="text-muted-foreground tabular-nums">
                  {item.total.gap > 0 ? '+' : ''}
                  {item.total.gap.toFixed(2)}
                </span>
              )}
            </HeroChip>
          </>
        ) : undefined
      }
    >
      {item && <F5SplitsSections item={item} />}
    </MlbToolDetailShell>
  );
}
