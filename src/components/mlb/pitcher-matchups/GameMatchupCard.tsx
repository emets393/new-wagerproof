import React, { forwardRef, useImperativeHandle, useMemo, useState } from 'react';
import type { MatchupGame } from '@/types/mlb-matchups';
import { usePitcherMatchupData } from '@/hooks/usePitcherMatchupData';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { usePark } from '@/hooks/usePark';
import { ParkBanner } from './ParkBanner';
import { WeatherBanner } from './WeatherBanner';
import { PitcherSummaryPanel } from './PitcherSummaryPanel';
import { InsightsBar } from './InsightsBar';
import { ExpandedMatchup } from './ExpandedMatchup';
import {
  formatGameDateLabel,
  formatGameTimeEt,
  formatMoneyline,
  seasonFromDate,
} from '@/utils/mlbPitcherMatchups';
import { buildGameContext, generateGameInsights } from './insightEngine';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { MlbTeamLogo } from './MlbTeamLogo';
import type { LeagueBenchmarks } from '@/types/mlb-matchups';

export interface GameMatchupCardHandle {
  expand: () => void;
}

interface GameMatchupCardProps {
  game: MatchupGame;
  eagerLoad?: boolean;
  benchmarksR: LeagueBenchmarks;
  benchmarksL: LeagueBenchmarks;
  highlightPlayerId?: number | null;
}

export const GameMatchupCard = forwardRef<GameMatchupCardHandle, GameMatchupCardProps>(
  function GameMatchupCard(
    { game, eagerLoad = false, benchmarksR, benchmarksL, highlightPlayerId },
    ref,
  ) {
    const [expanded, setExpanded] = useState(false);
    const [activeTab, setActiveTab] = useState<'away' | 'home'>('away');
    const season = seasonFromDate(game.official_date);

    const shouldFetch = expanded || eagerLoad;

    const { data, isLoading } = usePitcherMatchupData(game, season, shouldFetch);
    const { data: park } = usePark(game.home_abbr);

    useImperativeHandle(ref, () => ({
      expand: () => setExpanded(true),
    }));

    const tier1Insights = useMemo(() => {
      if (!data) return [];
      const ctx = buildGameContext(game, data, park ?? null);
      return generateGameInsights(ctx);
    }, [game, data, park]);

    return (
      <Card
        id={`game-${game.game_pk}`}
        className={
          highlightPlayerId != null ? 'ring-2 ring-primary/60 scroll-mt-24' : 'scroll-mt-24'
        }
      >
        <CardHeader className="px-3 sm:px-6 pb-3 pt-4 space-y-3 bg-muted/30">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base sm:text-lg font-bold text-foreground flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="inline-flex items-center gap-1.5">
                <MlbTeamLogo abbrev={game.away_abbr} name={game.away_team_name} />
                {game.away_team_name}
              </span>
              <span className="text-muted-foreground font-normal">@</span>
              <span className="inline-flex items-center gap-1.5">
                <MlbTeamLogo abbrev={game.home_abbr} name={game.home_team_name} />
                {game.home_team_name}
              </span>
            </h2>
            <Badge variant="secondary" className="text-xs">
              📅 {formatGameDateLabel(game.official_date)} · {formatGameTimeEt(game.game_time)}
            </Badge>
          </div>
          <ParkBanner park={park} game={game} />
          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
            {game.total_line != null ? <span>Game total: {game.total_line}</span> : null}
            {game.away_ml != null ? <span>Away moneyline: {formatMoneyline(game.away_ml)}</span> : null}
            {game.home_ml != null ? <span>Home moneyline: {formatMoneyline(game.home_ml)}</span> : null}
          </div>
          <WeatherBanner game={game} />
        </CardHeader>

        <CardContent className="px-3 sm:px-6 pb-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <PitcherSummaryPanel
              teamLabel={game.away_team_name}
              pitcherName={game.away_sp_name}
              pitcherId={game.away_sp_id}
              pitchHand={game.away_sp_hand}
              arsenal={data?.awayArsenal ?? { A: [], R: [], L: [] }}
              battedBall={data?.awayBattedBall ?? { overall: null, vs_R: null, vs_L: null }}
              opposingLineup={data?.homeLineup ?? []}
              opposingSplits={data?.homeLineupSplits ?? []}
              opposingVsPitch={data?.homeBatterVsPitch ?? []}
              game={game}
              park={park ?? null}
            />
            <PitcherSummaryPanel
              teamLabel={game.home_team_name}
              pitcherName={game.home_sp_name}
              pitcherId={game.home_sp_id}
              pitchHand={game.home_sp_hand}
              arsenal={data?.homeArsenal ?? { A: [], R: [], L: [] }}
              battedBall={data?.homeBattedBall ?? { overall: null, vs_R: null, vs_L: null }}
              opposingLineup={data?.awayLineup ?? []}
              opposingSplits={data?.awayLineupSplits ?? []}
              opposingVsPitch={data?.awayBatterVsPitch ?? []}
              game={game}
              park={park ?? null}
            />
          </div>

          {tier1Insights.length > 0 ? <InsightsBar insights={tier1Insights} /> : null}

          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => setExpanded(e => !e)}
          >
            {expanded ? (
              <>
                <ChevronUp className="h-4 w-4 mr-2" />
                Hide full matchup details
              </>
            ) : (
              <>
                <ChevronDown className="h-4 w-4 mr-2" />
                Show full matchup details
              </>
            )}
          </Button>

          {expanded ? (
            <ExpandedMatchup
              game={game}
              data={data}
              benchmarksR={benchmarksR}
              benchmarksL={benchmarksL}
              isLoading={isLoading}
              activeTab={activeTab}
              onTabChange={setActiveTab}
              park={park ?? null}
            />
          ) : null}
        </CardContent>
      </Card>
    );
  },
);
