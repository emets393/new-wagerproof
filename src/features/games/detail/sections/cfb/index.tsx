import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AIPayloadViewer } from '@/components/AIPayloadViewer';
import { useAdminMode } from '@/contexts/AdminModeContext';
import { MarketOddsSection } from '../MarketOddsSection';
import type { SportSectionsProps } from '../index';
import type { CFBPrediction } from '../../../api/cfbGames';
import type { GameFeedItem } from '../../../types';
import { CfbDryRunPicksSection, CfbDryRunSummarySection } from './CfbDryRunSections';
import { CfbH2HSection } from './CfbH2HSection';
import { CfbLineMovementSection } from './CfbLineMovementSection';
import { CfbWeatherSection } from './CfbWeatherSection';

/**
 * CFB detail stack for the /games split view — mirrors the native sheet:
 *   slate summary → multi-market picks (from dryrun_picks, or fg_* synthesis
 *   when picks are cold Weeks 1–3) with team season trends → market odds →
 *   weather → open→close line move → head-to-head (cfb_games prior seasons).
 *
 * Legacy CollegeSpread/Total cards are omitted so FG lines never double-render.
 */
export function CfbSections(props: SportSectionsProps) {
  const { game, onCompletionGenerated } = props;
  const { adminModeEnabled } = useAdminMode();
  const [payloadOpen, setPayloadOpen] = useState(false);

  const cfbGame = game as GameFeedItem<CFBPrediction>;
  const raw = cfbGame.raw;

  const payloadAffordance = adminModeEnabled ? (
    <>
      <Button
        size="sm"
        variant="outline"
        className="w-full border-purple-400 bg-purple-500/90 text-white hover:bg-purple-600 hover:text-white"
        onClick={() => setPayloadOpen(true)}
      >
        <Sparkles className="mr-1 h-4 w-4" />
        AI Payload
      </Button>
      <AIPayloadViewer
        open={payloadOpen}
        onOpenChange={setPayloadOpen}
        game={raw}
        sportType="cfb"
        onCompletionGenerated={() => onCompletionGenerated(game.id)}
      />
    </>
  ) : null;

  return (
    <>
      <CfbDryRunSummarySection game={cfbGame} />
      <CfbDryRunPicksSection game={cfbGame} />
      <MarketOddsSection game={game} />
      <CfbWeatherSection game={cfbGame} />
      <CfbLineMovementSection game={cfbGame} />
      <CfbH2HSection game={cfbGame} />
      {payloadAffordance}
    </>
  );
}
