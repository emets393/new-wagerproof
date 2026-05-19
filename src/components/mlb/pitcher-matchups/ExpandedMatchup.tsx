import React from 'react';
import type { ParkHRFactors } from '@/hooks/usePark';
import type { LeagueBenchmarks, MatchupGame, PitcherMatchupData } from '@/types/mlb-matchups';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PitcherArsenalTable } from './PitcherArsenalTable';
import { LineupTable } from './LineupTable';
import { Loader2 } from 'lucide-react';

interface ExpandedMatchupProps {
  game: MatchupGame;
  data: PitcherMatchupData | undefined;
  benchmarksR: LeagueBenchmarks;
  benchmarksL: LeagueBenchmarks;
  isLoading: boolean;
  activeTab: 'away' | 'home';
  onTabChange: (tab: 'away' | 'home') => void;
  park: ParkHRFactors | null;
}

export function ExpandedMatchup({
  game,
  data,
  benchmarksR,
  benchmarksL,
  isLoading,
  activeTab,
  onTabChange,
  park,
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
            <PitcherArsenalTable
              arsenal={data.awayArsenal}
              pitcherName={game.away_sp_name}
              pitcherId={game.away_sp_id}
            />
          </section>
          <section className="min-w-0 space-y-2">
            <h4 className="text-sm font-bold">
              {game.home_team_name} lineup vs {game.away_sp_name}
            </h4>
            <LineupTable
              lineup={data.homeLineup}
              batterSplits={data.homeLineupSplits}
              opposingPitcherHand={game.away_sp_hand}
              opposingPitcherId={game.away_sp_id}
              opposingPitcherName={game.away_sp_name}
              opposingArsenal={data.awayArsenal}
              opposingBattedBall={data.awayBattedBall}
              batterVsPitchByPlayer={data.homeBatterVsPitch}
              opposingArchetype={data.awayArchetype?.archetype ?? 'Insufficient'}
              vsArchetypeByBatter={data.homeVsArchetypeByBatter}
              benchmarks={benchmarksR}
              game={game}
              park={park}
            />
          </section>
        </div>
      </TabsContent>

      <TabsContent value="home" className="mt-4 space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <section className="min-w-0 space-y-2">
            <h4 className="text-sm font-bold">Pitcher arsenal — {game.home_sp_name}</h4>
            <PitcherArsenalTable
              arsenal={data.homeArsenal}
              pitcherName={game.home_sp_name}
              pitcherId={game.home_sp_id}
            />
          </section>
          <section className="min-w-0 space-y-2">
            <h4 className="text-sm font-bold">
              {game.away_team_name} lineup vs {game.home_sp_name}
            </h4>
            <LineupTable
              lineup={data.awayLineup}
              batterSplits={data.awayLineupSplits}
              opposingPitcherHand={game.home_sp_hand}
              opposingPitcherId={game.home_sp_id}
              opposingPitcherName={game.home_sp_name}
              opposingArsenal={data.homeArsenal}
              opposingBattedBall={data.homeBattedBall}
              batterVsPitchByPlayer={data.awayBatterVsPitch}
              opposingArchetype={data.homeArchetype?.archetype ?? 'Insufficient'}
              vsArchetypeByBatter={data.awayVsArchetypeByBatter}
              benchmarks={benchmarksL}
              game={game}
              park={park}
            />
          </section>
        </div>
      </TabsContent>
    </Tabs>
  );
}
