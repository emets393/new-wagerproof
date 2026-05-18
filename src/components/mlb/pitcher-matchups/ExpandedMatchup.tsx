import React from 'react';
import type { MatchupGame, PitcherMatchupData } from '@/types/mlb-matchups';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PitcherArsenalTable } from './PitcherArsenalTable';
import { LineupTable } from './LineupTable';
import { Loader2 } from 'lucide-react';

interface ExpandedMatchupProps {
  game: MatchupGame;
  data: PitcherMatchupData | undefined;
  isLoading: boolean;
  activeTab: 'away' | 'home';
  onTabChange: (tab: 'away' | 'home') => void;
}

export function ExpandedMatchup({
  game,
  data,
  isLoading,
  activeTab,
  onTabChange,
}: ExpandedMatchupProps) {
  if (isLoading || !data) {
    return (
      <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-sm">Loading full matchup details…</span>
      </div>
    );
  }

  return (
    <Tabs value={activeTab} onValueChange={v => onTabChange(v as 'away' | 'home')} className="w-full">
      <TabsList className="grid w-full grid-cols-2 h-auto">
        <TabsTrigger value="away" className="text-xs sm:text-sm py-2 whitespace-normal text-center">
          {game.away_sp_name} vs {game.home_team_name}
        </TabsTrigger>
        <TabsTrigger value="home" className="text-xs sm:text-sm py-2 whitespace-normal text-center">
          {game.home_sp_name} vs {game.away_team_name}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="away" className="mt-4 space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <section className="min-w-0 space-y-2">
            <h4 className="text-sm font-bold">Pitcher arsenal — {game.away_sp_name}</h4>
            <PitcherArsenalTable arsenal={data.awayArsenal} />
          </section>
          <section className="min-w-0 space-y-2">
            <h4 className="text-sm font-bold">
              {game.home_team_name} lineup vs {game.away_sp_name}
            </h4>
            <LineupTable
              lineup={data.homeLineup}
              batterSplits={data.homeBatterSplits}
              opposingPitcherHand={game.away_sp_hand}
              opposingPitcherId={game.away_sp_id}
              opposingPitcherName={game.away_sp_name}
              opposingArsenal={data.awayArsenal}
              opposingBattedBall={data.awayBattedBall}
              batterVsPitchByPlayer={data.homeBatterVsPitch}
              game={game}
            />
          </section>
        </div>
      </TabsContent>

      <TabsContent value="home" className="mt-4 space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <section className="min-w-0 space-y-2">
            <h4 className="text-sm font-bold">Pitcher arsenal — {game.home_sp_name}</h4>
            <PitcherArsenalTable arsenal={data.homeArsenal} />
          </section>
          <section className="min-w-0 space-y-2">
            <h4 className="text-sm font-bold">
              {game.away_team_name} lineup vs {game.home_sp_name}
            </h4>
            <LineupTable
              lineup={data.awayLineup}
              batterSplits={data.awayBatterSplits}
              opposingPitcherHand={game.home_sp_hand}
              opposingPitcherId={game.home_sp_id}
              opposingPitcherName={game.home_sp_name}
              opposingArsenal={data.homeArsenal}
              opposingBattedBall={data.homeBattedBall}
              batterVsPitchByPlayer={data.awayBatterVsPitch}
              game={game}
            />
          </section>
        </div>
      </TabsContent>
    </Tabs>
  );
}
