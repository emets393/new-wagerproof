import * as React from 'react';
import { FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AIPayloadViewer } from '@/components/AIPayloadViewer';
import { useAdminMode } from '@/contexts/AdminModeContext';
import { MarketOddsSection } from '../MarketOddsSection';
import { NbaMoneylineSection, NbaScorePredictionSection, NbaSpreadSection, NbaTotalSection } from './NbaPredictionsSection';
import { NbaBettingTrendsSection } from './NbaBettingTrendsSection';
import { NbaTeamStatsSection } from './NbaTeamStatsSection';
import { NbaInjuriesSection } from './NbaInjuriesSection';
import { NbaFirstHalfSection } from './NbaFirstHalfSection';
import { NbaSignalProvider } from './NbaSignalsSection';
import { useNbaMatchupOverview } from './useNbaMatchupOverview';
import type { NBAPrediction } from '../../../api/nbaGames';
import type { SportSectionsProps } from '../index';

/**
 * NBA detail-pane stack: the projected final, then one card per market. Signals
 * sit on the market they belong to. Market odds, betting trends, team stats,
 * and injuries follow. The admin-only AI Payload viewer stays at the end.
 */
export function NbaSections({ game, onCompletionGenerated }: SportSectionsProps) {
  const { adminModeEnabled } = useAdminMode();
  const [payloadViewerOpen, setPayloadViewerOpen] = React.useState(false);

  const raw = game.raw as unknown as NBAPrediction;
  const overview = useNbaMatchupOverview(raw.away_team, raw.home_team, raw.game_date);

  return (
    <NbaSignalProvider game={game}>
      <NbaScorePredictionSection game={game} />
      <NbaSpreadSection game={game} />
      <NbaMoneylineSection game={game} />
      <NbaTotalSection game={game} />
      <NbaFirstHalfSection game={game} />
      <MarketOddsSection game={game} />
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
    </NbaSignalProvider>
  );
}
