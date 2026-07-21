import { BarChart3 } from 'lucide-react';
import type { ParkHRFactors } from '@/hooks/usePark';
import type { PitcherArchetypeProfile, PitcherArsenalByHand } from '@/types/mlb-matchups';
import { formatPropLine, formatPropOdds } from '@/utils/mlbPlayerProps';
import { HeroChip, MlbToolDetailShell } from '../shared/MlbToolDetailShell';
import { formatSigned, TeamMark } from '../shared/visuals';
import { PitcherMatchupsSections } from './sections';
import { shortPlayerName, type PropMatchupFeedItem } from './model';

/**
 * Right pane for /mlb/pitcher-matchups. The hero restates the game's single
 * best posted prop so the widget stack below reads as the evidence for it.
 */
export function PitcherMatchupsDetailPane({
  item,
  isFeedLoading,
  awayArchetype,
  homeArchetype,
  awayArsenal,
  homeArsenal,
  park,
}: {
  item: PropMatchupFeedItem | null;
  isFeedLoading: boolean;
  awayArchetype: PitcherArchetypeProfile | null;
  homeArchetype: PitcherArchetypeProfile | null;
  awayArsenal: PitcherArsenalByHand | null | undefined;
  homeArsenal: PitcherArsenalByHand | null | undefined;
  park: ParkHRFactors | null | undefined;
}) {
  const topPlay = item?.topPlay ?? null;
  const topTeam =
    topPlay?.side === 'away' ? item?.away : topPlay?.side === 'home' ? item?.home : null;

  return (
    <MlbToolDetailShell
      game={item}
      isFeedLoading={isFeedLoading}
      emptyIcon={<BarChart3 className="h-9 w-9 text-muted-foreground/50" />}
      emptyLabel="Select a game to see its prop matchups"
      subline={
        item
          ? `${item.game.away_sp_name} (${item.game.away_sp_hand}HP) vs ${item.game.home_sp_name} (${item.game.home_sp_hand}HP)`
          : undefined
      }
      chips={
        item ? (
          <>
            <HeroChip label="Top prop">
              {topPlay ? (
                <>
                  {topTeam && <TeamMark team={topTeam} size={16} />}
                  <span className="text-foreground">
                    {shortPlayerName(topPlay.playerName)} O{formatPropLine(topPlay.computed.line)}
                  </span>
                  <span className="font-mono text-muted-foreground">
                    {formatPropOdds(topPlay.computed.overOdds)}
                  </span>
                </>
              ) : (
                <span className="text-muted-foreground">
                  {item.propsLoading ? 'Loading…' : 'Not posted'}
                </span>
              )}
            </HeroChip>
            {topPlay?.edgePts != null && (
              <HeroChip label="vs price">
                <span className="font-mono tabular-nums text-foreground">
                  {formatSigned(topPlay.edgePts, 1)}%
                </span>
              </HeroChip>
            )}
          </>
        ) : undefined
      }
    >
      {item && (
        <PitcherMatchupsSections
          item={item}
          awayArchetype={awayArchetype}
          homeArchetype={homeArchetype}
          awayArsenal={awayArsenal}
          homeArsenal={homeArsenal}
          park={park}
        />
      )}
    </MlbToolDetailShell>
  );
}
