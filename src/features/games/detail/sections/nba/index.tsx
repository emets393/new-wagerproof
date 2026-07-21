import * as React from 'react';
import { FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AIPayloadViewer } from '@/components/AIPayloadViewer';
import { useAdminMode } from '@/contexts/AdminModeContext';
import { MarketOddsSection } from '../MarketOddsSection';
import { MatchSimulatorSection } from '../MatchSimulatorSection';
import { NbaSpreadSection, NbaTotalSection } from './NbaPredictionsSection';
import { NbaBettingTrendsSection } from './NbaBettingTrendsSection';
import { NbaTeamStatsSection } from './NbaTeamStatsSection';
import { NbaInjuriesSection } from './NbaInjuriesSection';
import { useNbaMatchupOverview } from './useNbaMatchupOverview';
import type { NBAPrediction } from '../../../api/nbaGames';
import type { SportSectionsProps } from '../index';

/**
 * NBA detail-pane stack: Spread + Total (one card per market, split out of the
 * old combined Model Predictions card) + Market Odds + Match Simulator, then
 * Betting Trends / Team Stats / Injuries, plus the admin-only AI Payload viewer.
 */
export function NbaSections({ game, completions, onCompletionGenerated }: SportSectionsProps) {
  const { adminModeEnabled } = useAdminMode();
  const [payloadViewerOpen, setPayloadViewerOpen] = React.useState(false);

  const raw = game.raw as unknown as NBAPrediction;
  const overview = useNbaMatchupOverview(raw.away_team, raw.home_team, raw.game_date);

  return (
    <>
      <NbaSpreadSection game={game} completions={completions} />
      <NbaTotalSection game={game} completions={completions} />
      <MarketOddsSection game={game} />
      <MatchSimulatorSection game={game} />
      <NbaBettingTrendsSection game={game} trends={overview.trends} loading={overview.trendsLoading} />
      <NbaTeamStatsSection game={game} trends={overview.trends} loading={overview.trendsLoading} />
      <NbaInjuriesSection
        game={game}
        injuries={overview.injuries}
        loading={overview.injuriesLoading}
        error={overview.injuriesError}
      />

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
            sportType="nba"
            onCompletionGenerated={() => onCompletionGenerated(game.id)}
          />
        </>
      )}
    </>
  );
}
