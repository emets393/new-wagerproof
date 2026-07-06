import * as React from 'react';
import { FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AIPayloadViewer } from '@/components/AIPayloadViewer';
import { useAdminMode } from '@/contexts/AdminModeContext';
import { MarketOddsSection } from '../MarketOddsSection';
import { MatchSimulatorSection } from '../MatchSimulatorSection';
import { NcaabPredictionsSection } from './NcaabPredictionsSection';
import type { SportSectionsProps } from '../index';

/**
 * NCAAB detail-pane stack, ported from GameDetailsModal's CFB/NCAAB path:
 * Model Predictions + Match Simulator + Polymarket, plus the admin-only AI
 * Payload viewer.
 */
export function NcaabSections({ game, completions, onCompletionGenerated }: SportSectionsProps) {
  const { adminModeEnabled } = useAdminMode();
  const [payloadViewerOpen, setPayloadViewerOpen] = React.useState(false);

  return (
    <>
      <NcaabPredictionsSection game={game} completions={completions} />
      <MatchSimulatorSection game={game} />
      <MarketOddsSection game={game} />

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
