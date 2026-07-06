import { useState } from 'react';
import { FileJson } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAdminMode } from '@/contexts/AdminModeContext';
import { AIPayloadViewer } from '@/components/AIPayloadViewer';
import { GameTailSection } from '@/components/GameTailSection';
import { SHOW_WEBSITE_TAILING_FEATURES } from '@/lib/featureFlags';
import type { NFLPrediction } from '../../../api/nflGames';
import type { SportSectionsProps } from '../index';
import { MarketOddsSection } from '../MarketOddsSection';
import { NflPredictionsSection } from './NflPredictionsSection';
import { NflBettingSplitsSection } from './NflBettingSplitsSection';
import { NflH2HSection } from './NflH2HSection';
import { NflLineMovementSection } from './NflLineMovementSection';

/**
 * NFL detail-pane widget stack, ported from GameDetailsModal's NFL branch.
 * Weather is intentionally absent: the modal's NFL weather block only had
 * temp/wind/icon, all of which the DetailHero chip already shows.
 */
export function NflSections({ game, extras, completions, onCompletionGenerated }: SportSectionsProps) {
  const raw = game.raw as NFLPrediction;
  const { adminModeEnabled } = useAdminMode();
  const [payloadViewerOpen, setPayloadViewerOpen] = useState(false);

  return (
    <>
      <MarketOddsSection game={game} />
      <NflPredictionsSection game={game} completions={completions} />
      <NflBettingSplitsSection raw={raw} />
      <NflH2HSection game={game} />
      <NflLineMovementSection game={game} extras={extras} />

      {SHOW_WEBSITE_TAILING_FEATURES && (
        <GameTailSection
          gameUniqueId={raw.training_key || raw.unique_id}
          sport="nfl"
          homeTeam={raw.home_team}
          awayTeam={raw.away_team}
          lines={{
            home_ml: raw.home_ml,
            away_ml: raw.away_ml,
            home_spread: raw.home_spread,
            away_spread: raw.away_spread,
            total: raw.over_line,
          }}
          compact
        />
      )}

      {adminModeEnabled && (
        <>
          <div className="flex justify-center pt-1">
            <Button
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={() => setPayloadViewerOpen(true)}
            >
              <FileJson className="mr-1.5 h-3.5 w-3.5" />
              AI Payload
            </Button>
          </div>
          <AIPayloadViewer
            open={payloadViewerOpen}
            onOpenChange={setPayloadViewerOpen}
            game={raw}
            sportType="nfl"
            onCompletionGenerated={() => onCompletionGenerated(game.id)}
          />
        </>
      )}
    </>
  );
}
