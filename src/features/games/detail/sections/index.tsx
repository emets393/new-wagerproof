import type { GameFeedItem } from '../../types';
import { NflSections } from './nfl';
import { CfbSections } from './cfb';
import { NbaSections } from './nba';
import { NcaabSections } from './ncaab';
import { MlbSections } from './mlb';

export interface SportSectionsProps {
  game: GameFeedItem;
  extras: Record<string, unknown>;
  /** AI completion texts for this game, keyed by widget type. */
  completions: Record<string, string>;
  onCompletionGenerated: (gameId: string) => void;
}

/**
 * Per-sport widget stacks for the detail pane, ported from GameDetailsModal,
 * MatchupOverviewModal, the CFB dry-run modal, and the MLB inline detail.
 */
export function SportSections(props: SportSectionsProps) {
  switch (props.game.sport) {
    case 'nfl':
      return <NflSections {...props} />;
    case 'cfb':
      return <CfbSections {...props} />;
    case 'nba':
      return <NbaSections {...props} />;
    case 'ncaab':
      return <NcaabSections {...props} />;
    case 'mlb':
      return <MlbSections {...props} />;
    default:
      return null;
  }
}
