import * as React from 'react';
import { FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AIPayloadViewer } from '@/components/AIPayloadViewer';
import { useAdminMode } from '@/contexts/AdminModeContext';
import { MarketOddsSection } from '../MarketOddsSection';
import {
  NcaabHeadToHeadSection,
  NcaabMarketCards,
  NcaabScorePredictionSection,
  NcaabTeamStatsSection,
  NcaabThrillSection,
  useNcaabGameDetail,
} from './NcaabWiredSections';
import type { SportSectionsProps } from '../index';

/**
 * College basketball, in the football order under the header: the projected
 * final, then one card per market, head-to-head, market odds, and team stats.
 * Team trends sit inside each market card. Consensus leads the pane.
 */
export function NcaabSections({ game, onCompletionGenerated }: SportSectionsProps) {
  const { adminModeEnabled } = useAdminMode();
  const [payloadViewerOpen, setPayloadViewerOpen] = React.useState(false);
  const { detail, status } = useNcaabGameDetail(game);

  return (
    <>
      <NcaabScorePredictionSection game={game} />
      <NcaabMarketCards game={game} detail={detail} status={status} />
      <NcaabHeadToHeadSection game={game} detail={detail} status={status} />
      <MarketOddsSection game={game} />
      <NcaabTeamStatsSection game={game} detail={detail} />
      <NcaabThrillSection detail={detail} />

      {adminModeEnabled && (
        <>
          <Button
            variant="outline"
            size="sm"
            className="w-full gap-2"
            onClick={() => setPayloadViewerOpen(true)}
          >
            <FileText className="h-4 w-4" />
            View AI Payload
          </Button>
          <AIPayloadViewer
            open={payloadViewerOpen}
            onOpenChange={setPayloadViewerOpen}
            game={game.raw}
            sportType="ncaab"
            onCompletionGenerated={() => onCompletionGenerated(game.id)}
          />
        </>
      )}
    </>
  );
}
