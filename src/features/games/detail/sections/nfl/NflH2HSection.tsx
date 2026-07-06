import { AlertCircle, ArrowDown, ArrowUp, Calendar, History } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { WidgetCard } from '@/components/ios';
import { getNFLTeamLogo, type NFLPrediction } from '../../../api/nflGames';
import type { GameFeedItem } from '../../../types';
import { useNflH2H, type NflH2HGame } from './useNflH2H';

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

// Port of the modal's calculateH2HSummary — wins/covers/overs from nfl_training_data rows.
const calculateH2HSummary = (h2hGames: NflH2HGame[], homeTeam: string) => {
  const stats = {
    homeTeamWins: 0,
    awayTeamWins: 0,
    homeTeamCovers: 0,
    awayTeamCovers: 0,
    overs: 0,
    unders: 0,
  };
  if (!h2hGames || h2hGames.length === 0) return stats;

  h2hGames.forEach((game) => {
    // Count wins
    if ((game.home_score ?? 0) > (game.away_score ?? 0)) {
      if (game.home_team === homeTeam) {
        stats.homeTeamWins++;
      } else {
        stats.awayTeamWins++;
      }
    } else if ((game.away_score ?? 0) > (game.home_score ?? 0)) {
      if (game.away_team === homeTeam) {
        stats.homeTeamWins++;
      } else {
        stats.awayTeamWins++;
      }
    }

    // Count covers (home_away_spread_cover: 1 = home covered, 0 = away covered)
    if (game.home_away_spread_cover === 1) {
      if (game.home_team === homeTeam) {
        stats.homeTeamCovers++;
      } else {
        stats.awayTeamCovers++;
      }
    } else if (game.home_away_spread_cover === 0) {
      if (game.away_team === homeTeam) {
        stats.homeTeamCovers++;
      } else {
        stats.awayTeamCovers++;
      }
    }

    // Count over/under
    if (game.ou_result === 1) {
      stats.overs++;
    } else if (game.ou_result === 0) {
      stats.unders++;
    }
  });

  return stats;
};

function TeamStatPair({
  awayLogo,
  awayLabel,
  awayValue,
  homeLogo,
  homeLabel,
  homeValue,
}: {
  awayLogo: string;
  awayLabel: string;
  awayValue: number;
  homeLogo: string;
  homeLabel: string;
  homeValue: number;
}) {
  return (
    <div className="flex items-center justify-center space-x-2">
      <div
        className={`flex flex-col items-center p-2 rounded-lg transition-all duration-200 ${
          awayValue > homeValue
            ? 'bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800'
            : 'bg-transparent'
        }`}
      >
        <img src={awayLogo} alt={`${awayLabel} logo`} className="object-contain w-8 h-8" />
        <div className="font-bold text-gray-900 dark:text-white text-lg">{awayValue}</div>
      </div>
      <div
        className={`flex flex-col items-center p-2 rounded-lg transition-all duration-200 ${
          homeValue > awayValue
            ? 'bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800'
            : 'bg-transparent'
        }`}
      >
        <img src={homeLogo} alt={`${homeLabel} logo`} className="object-contain w-8 h-8" />
        <div className="font-bold text-gray-900 dark:text-white text-lg">{homeValue}</div>
      </div>
    </div>
  );
}

/**
 * Head to Head, ported from GameDetailsModal's NFL H2H block: wins/covers/O-U
 * summary over the last 5 meetings plus the 3 most recent final scores.
 */
export function NflH2HSection({ game }: { game: GameFeedItem }) {
  const raw = game.raw as NFLPrediction;
  const { games: h2hGames, loading, error } = useNflH2H(raw.home_team, raw.away_team);
  const h2hStats = calculateH2HSummary(h2hGames, raw.home_team);

  const awayLogo = getNFLTeamLogo(raw.away_team);
  const homeLogo = getNFLTeamLogo(raw.home_team);

  return (
    <WidgetCard icon={<History />} title="Head to Head" contentClassName="space-y-4 text-center">
      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      ) : error ? (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : h2hGames.length === 0 ? (
        <div className="text-sm text-gray-600 dark:text-white/70">
          No historical matchups found between these teams
        </div>
      ) : (
        <>
          {/* Summary Statistics */}
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <h5 className="text-xs font-semibold text-gray-600 dark:text-white/70 uppercase tracking-wide mb-2">
                Wins
              </h5>
              <TeamStatPair
                awayLogo={awayLogo}
                awayLabel={raw.away_team}
                awayValue={h2hStats.awayTeamWins}
                homeLogo={homeLogo}
                homeLabel={raw.home_team}
                homeValue={h2hStats.homeTeamWins}
              />
            </div>

            <div className="text-center">
              <h5 className="text-xs font-semibold text-gray-600 dark:text-white/70 uppercase tracking-wide mb-2">
                Covers
              </h5>
              <TeamStatPair
                awayLogo={awayLogo}
                awayLabel={raw.away_team}
                awayValue={h2hStats.awayTeamCovers}
                homeLogo={homeLogo}
                homeLabel={raw.home_team}
                homeValue={h2hStats.homeTeamCovers}
              />
            </div>

            <div className="text-center">
              <h5 className="text-xs font-semibold text-gray-600 dark:text-white/70 uppercase tracking-wide mb-2">
                O/U
              </h5>
              <div className="flex items-center justify-center space-x-2">
                <div
                  className={`flex flex-col items-center p-2 rounded-lg transition-all duration-200 ${
                    h2hStats.overs > h2hStats.unders
                      ? 'bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800'
                      : 'bg-transparent'
                  }`}
                >
                  <div className="rounded-full bg-emerald-50 dark:bg-emerald-950/50 flex items-center justify-center w-8 h-8">
                    <ArrowUp className="text-emerald-600 dark:text-emerald-400 h-4 w-4" />
                  </div>
                  <div className="font-bold text-gray-900 dark:text-white text-lg">
                    {h2hStats.overs}
                  </div>
                </div>
                <div
                  className={`flex flex-col items-center p-2 rounded-lg transition-all duration-200 ${
                    h2hStats.unders > h2hStats.overs
                      ? 'bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800'
                      : 'bg-transparent'
                  }`}
                >
                  <div className="rounded-full bg-red-50 dark:bg-red-950/50 flex items-center justify-center w-8 h-8">
                    <ArrowDown className="text-red-600 dark:text-red-400 h-4 w-4" />
                  </div>
                  <div className="font-bold text-gray-900 dark:text-white text-lg">
                    {h2hStats.unders}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Recent Matchups */}
          <div className="space-y-2 mt-4">
            <div className="text-xs text-gray-600 dark:text-white/70 mb-2">
              Last {h2hGames.length} matchup{h2hGames.length !== 1 ? 's' : ''}:
            </div>
            {h2hGames.slice(0, 3).map((matchup) => (
              <div
                key={String(matchup.id)}
                className="border border-gray-200 dark:border-white/20 rounded-lg bg-gray-100 dark:bg-white/5 p-2"
              >
                <div className="flex items-center justify-between text-xs mb-1">
                  <div className="flex items-center space-x-1">
                    <Calendar className="text-gray-500 dark:text-white/60 h-3 w-3" />
                    <span className="font-medium text-gray-600 dark:text-white/70">
                      {formatDate(matchup.game_date)}
                    </span>
                  </div>
                  <span className="text-gray-500 dark:text-white/60">Week {matchup.week}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <img
                      src={getNFLTeamLogo(matchup.away_team)}
                      alt={matchup.away_team}
                      className="object-contain h-6 w-6"
                    />
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">
                      {matchup.away_score}
                    </span>
                  </div>
                  <span className="text-xs text-gray-500 dark:text-white/60">@</span>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">
                      {matchup.home_score}
                    </span>
                    <img
                      src={getNFLTeamLogo(matchup.home_team)}
                      alt={matchup.home_team}
                      className="object-contain h-6 w-6"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </WidgetCard>
  );
}
