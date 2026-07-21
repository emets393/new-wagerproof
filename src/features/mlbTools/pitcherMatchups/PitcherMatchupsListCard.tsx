import { FeedPill, MlbToolListCard } from '../shared/MlbToolListCard';
import { formatPropLine } from '@/utils/mlbPlayerProps';
import { shortPlayerName, type PropMatchupFeedItem } from './model';
import { formatSigned, TeamMark } from '../shared/visuals';

/** Family name only — the caption has no room for two full pitcher names. */
function lastName(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts[parts.length - 1] || name;
}

/**
 * Feed card for /mlb/pitcher-matchups. Leads with tonight's pitching matchup and
 * carries the game's single best posted prop, so the list answers "which game
 * has something worth betting" before anything is opened.
 */
export function PitcherMatchupsListCard({
  item,
  isSelected,
  onSelect,
}: {
  item: PropMatchupFeedItem;
  isSelected: boolean;
  onSelect: (id: string) => void;
}) {
  const { game, topPlay } = item;
  const topTeam = topPlay?.side === 'away' ? item.away : topPlay?.side === 'home' ? item.home : null;

  return (
    <MlbToolListCard
      item={item}
      isSelected={isSelected}
      onSelect={onSelect}
      caption={`${lastName(game.away_sp_name)} (${game.away_sp_hand}) vs ${lastName(game.home_sp_name)} (${game.home_sp_hand})`}
      pills={
        <>
          <FeedPill
            label="Top prop"
            trailing={
              topPlay?.edgePts != null ? `${formatSigned(topPlay.edgePts, 0)}%` : undefined
            }
          >
            {topPlay ? (
              <>
                {topTeam && <TeamMark team={topTeam} size={14} />}
                <span className="truncate text-foreground">
                  {shortPlayerName(topPlay.playerName)} O{formatPropLine(topPlay.computed.line)}
                </span>
              </>
            ) : (
              <span className="text-muted-foreground">
                {item.propsLoading ? 'Loading…' : 'Not posted'}
              </span>
            )}
          </FeedPill>
          <FeedPill label="Lines" trailing={`${item.plays.length}`}>
            <span className="text-foreground">posted</span>
          </FeedPill>
        </>
      }
    />
  );
}
