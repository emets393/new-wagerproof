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
import { CfbPredictionsSection } from './CfbPredictionsSection';
import { CfbWeatherSection } from './CfbWeatherSection';

/**
 * CFB detail stack for the /games split view. Two experiences, mirroring the
 * legacy page's admin toggle:
 * - regular: Spread + Total + Weather + Market Odds (+ admin AI Payload)
 * - dry-run (admin): Slate Summary (Mammoth/conviction) + the 7 grouped
 *   prediction cards + Market Odds
 *
 * One card per market rather than one "Model Predictions" card answering three
 * questions — see `detail/WIDGET_DESIGN.md`.
 */
export function CfbSections(props: SportSectionsProps) {
  const { game, extras, completions, onCompletionGenerated } = props;
  const { adminModeEnabled } = useAdminMode();
  const [payloadOpen, setPayloadOpen] = useState(false);

  const cfbGame = game as GameFeedItem<CFBPrediction>;
  const raw = cfbGame.raw;
  const isDryRun = raw.is_dry_run === true || extras.mode === 'dryrun';

  // Admin-only: opens the existing payload viewer against the merged raw row,
  // then refreshes this game's cached completions after a generation.
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

  if (isDryRun) {
    return (
      <>
        <CfbDryRunSummarySection game={cfbGame} />
        <CfbDryRunPicksSection game={cfbGame} />
        <MarketOddsSection game={game} />
        {payloadAffordance}
      </>
    );
  }

  return (
    <>
      <CfbPredictionsSection game={cfbGame} completions={completions} />
      <CfbWeatherSection game={cfbGame} />
      <MarketOddsSection game={game} />
      {payloadAffordance}
    </>
  );
}
