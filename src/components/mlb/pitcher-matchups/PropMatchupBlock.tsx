import React from 'react';
import type { LeagueBenchmarks, MatchupGame, PitcherMatchupData } from '@/types/mlb-matchups';
import type { MlbPlayerPropRow } from '@/types/mlb-player-props';
import { useMLBPlayerPropsL10 } from '@/hooks/useMLBPlayerPropsL10';
import { usePark } from '@/hooks/usePark';
import { ParkBanner } from './ParkBanner';
import { WeatherBanner } from './WeatherBanner';
import { MlbTeamLogo } from './MlbTeamLogo';
import { StarterPropCard } from '@/components/mlb/player-props/StarterPropCard';
import { PlayerPropCard } from '@/components/mlb/player-props/PlayerPropCard';
import { formatGameTimeEt, formatMoneyline, seasonFromDate } from '@/utils/mlbPitcherMatchups';
import { groupPropsByPlayer } from '@/utils/mlbPlayerProps';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface PropMatchupBlockProps {
  game: MatchupGame;
  matchupData: PitcherMatchupData | null | undefined;
  matchupLoading: boolean;
  benchmarksR: LeagueBenchmarks;
  benchmarksL: LeagueBenchmarks;
  eagerLoadProps?: boolean;
}

function PropsSkeleton() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-16 w-full" />
    </div>
  );
}

export function PropMatchupBlock({
  game,
  matchupData,
  matchupLoading,
  benchmarksR,
  benchmarksL,
  eagerLoadProps = true,
}: PropMatchupBlockProps) {
  const { data: playerProps = [], isLoading: propsLoading } = useMLBPlayerPropsL10(
    game.game_pk,
    eagerLoadProps,
  );
  const { data: park } = usePark(game.home_abbr);

  const gameIsDay = playerProps[0]?.game_is_day ?? false;
  const hasProps = playerProps.length > 0;

  const awayLineup = matchupData?.awayLineup ?? [];
  const homeLineup = matchupData?.homeLineup ?? [];
  const splitById = new Map(
    [...(matchupData?.awayLineupSplits ?? []), ...(matchupData?.homeLineupSplits ?? [])].map(
      s => [s.batter_id, s],
    ),
  );
  const lineupPlayerIds = new Set([...awayLineup, ...homeLineup].map(row => row.player_id));
  const extraBatterGroups = [...groupPropsByPlayer(playerProps, false).entries()]
    .filter(([playerId]) => !lineupPlayerIds.has(playerId));

  const awayBenchmarks = benchmarksR;
  const homeBenchmarks = benchmarksL;
  const season = seasonFromDate(game.official_date);

  return (
    <Card id={`game-${game.game_pk}`} className="scroll-mt-24">
      <CardHeader className="px-3 sm:px-6 pb-3 pt-4 space-y-2 bg-muted/20">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base sm:text-lg font-bold flex flex-wrap items-center gap-x-2 gap-y-1">
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
          <Badge variant="secondary" className="text-xs tabular-nums">
            {formatGameTimeEt(game.game_time)} · {gameIsDay ? '☀️ Day' : '🌙 Night'}
          </Badge>
        </div>
        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          {game.total_line != null ? <span>O/U {game.total_line}</span> : null}
          {game.venue_name ? <span>{game.venue_name}</span> : null}
          {game.away_ml != null ? <span>Away {formatMoneyline(game.away_ml)}</span> : null}
        </div>
        <ParkBanner park={park} game={game} />
        <WeatherBanner game={game} />
      </CardHeader>

      <CardContent className="px-3 sm:px-6 pb-4 space-y-5">
        {matchupLoading && !matchupData ? (
          <Skeleton className="h-24 w-full" />
        ) : (
          <div className="space-y-2.5">
            <StarterPropCard
              pitcherId={game.away_sp_id}
              pitcherName={game.away_sp_name}
              teamLabel={game.away_team_name}
              pitchHand={game.away_sp_hand}
              archetype={matchupData?.awayArchetype ?? null}
              playerProps={playerProps}
              opposingStarterName={game.home_sp_name}
              opposingStarterHand={game.home_sp_hand}
              benchmarks={awayBenchmarks}
              season={season}
              gameDate={game.official_date}
              arsenal={matchupData?.awayArsenal ?? null}
              battedBall={matchupData?.awayBattedBall ?? null}
            />
            <StarterPropCard
              pitcherId={game.home_sp_id}
              pitcherName={game.home_sp_name}
              teamLabel={game.home_team_name}
              pitchHand={game.home_sp_hand}
              archetype={matchupData?.homeArchetype ?? null}
              playerProps={playerProps}
              opposingStarterName={game.away_sp_name}
              opposingStarterHand={game.away_sp_hand}
              benchmarks={homeBenchmarks}
              season={season}
              gameDate={game.official_date}
              arsenal={matchupData?.homeArsenal ?? null}
              battedBall={matchupData?.homeBattedBall ?? null}
            />
          </div>
        )}

        {propsLoading ? (
          <PropsSkeleton />
        ) : !hasProps ? (
          <Alert className="border-dashed">
            <AlertDescription className="text-sm text-muted-foreground">
              Props not posted yet — check back closer to first pitch
            </AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-6">
            <section className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {game.away_team_name} lineup
              </h3>
              <div className="space-y-2">
                {awayLineup.map(row => {
                  const propsForPlayer = playerProps.filter(p => p.player_id === row.player_id && !p.is_pitcher);
                  if (propsForPlayer.length === 0) return null;
                  return (
                    <PlayerPropCard
                      key={row.player_id}
                      playerId={row.player_id}
                      playerName={row.player_name}
                      battingOrder={row.batting_order}
                      position={row.position}
                      batSide={row.bat_side}
                      playerProps={propsForPlayer}
                      opposingStarterName={game.home_sp_name}
                      opposingStarterHand={game.home_sp_hand}
                      opposingArchetype={matchupData?.homeArchetype ?? null}
                      split={splitById.get(row.player_id)}
                      benchmarks={awayBenchmarks}
                    />
                  );
                })}
              </div>
            </section>

            <section className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {game.home_team_name} lineup
              </h3>
              <div className="space-y-2">
                {homeLineup.map(row => {
                  const propsForPlayer = playerProps.filter(p => p.player_id === row.player_id && !p.is_pitcher);
                  if (propsForPlayer.length === 0) return null;
                  return (
                    <PlayerPropCard
                      key={row.player_id}
                      playerId={row.player_id}
                      playerName={row.player_name}
                      battingOrder={row.batting_order}
                      position={row.position}
                      batSide={row.bat_side}
                      playerProps={propsForPlayer}
                      opposingStarterName={game.away_sp_name}
                      opposingStarterHand={game.away_sp_hand}
                      opposingArchetype={matchupData?.awayArchetype ?? null}
                      split={splitById.get(row.player_id)}
                      benchmarks={homeBenchmarks}
                    />
                  );
                })}
              </div>
            </section>

            {extraBatterGroups.length > 0 ? (
              <section className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Posted batter props
                </h3>
                <div className="space-y-2">
                  {extraBatterGroups.map(([playerId, props]) => (
                    <PlayerPropCard
                      key={playerId}
                      playerId={playerId}
                      playerName={props[0]?.player_name ?? 'Player'}
                      playerProps={props}
                      opposingStarterName="opposing starter"
                      opposingStarterHand="R"
                      opposingArchetype={null}
                      benchmarks={benchmarksR}
                    />
                  ))}
                </div>
              </section>
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
