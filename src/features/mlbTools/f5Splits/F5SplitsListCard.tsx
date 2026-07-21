import { FeedPill, MlbToolListCard } from '../shared/MlbToolListCard';
import { DirectionWord, TeamMark } from '../shared/visuals';
import { handSuffix, lastName, type F5FeedItem } from './model';

/**
 * Feed card for /mlb/f5-splits. Carries both verdicts so the list answers
 * "which game has a real first-five angle tonight" without opening anything.
 */
export function F5SplitsListCard({
  item,
  isSelected,
  onSelect,
}: {
  item: F5FeedItem;
  isSelected: boolean;
  onSelect: (id: string) => void;
}) {
  const { side, total, away, home, game } = item;
  const leanTeam = side.lean === 'away' ? away : side.lean === 'home' ? home : null;

  const awayHand = handSuffix(game.away_sp_hand);
  const homeHand = handSuffix(game.home_sp_hand);

  return (
    <MlbToolListCard
      item={item}
      isSelected={isSelected}
      onSelect={onSelect}
      caption={`${lastName(game.away_sp_name)}${awayHand ? ` (${awayHand[0]})` : ''} vs ${lastName(game.home_sp_name)}${homeHand ? ` (${homeHand[0]})` : ''}`}
      pills={
        <>
          <FeedPill
            label="F5"
            trailing={side.marginPts !== null ? `+${side.marginPts.toFixed(0)}%` : undefined}
          >
            {leanTeam ? (
              <>
                <TeamMark team={leanTeam} size={14} />
                <span className="text-foreground">{leanTeam.abbrev}</span>
              </>
            ) : (
              <span className="text-muted-foreground">No edge</span>
            )}
          </FeedPill>
          <FeedPill
            label="Total"
            trailing={
              total.gap !== null
                ? `${total.gap > 0 ? '+' : ''}${total.gap.toFixed(1)}`
                : undefined
            }
          >
            <DirectionWord direction={total.direction} showIcon={total.direction !== null} />
          </FeedPill>
        </>
      }
    />
  );
}
