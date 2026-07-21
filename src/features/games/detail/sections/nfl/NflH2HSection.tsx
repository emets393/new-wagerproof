import { AlertCircle, ArrowDown, ArrowUp, History } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { WidgetCard } from '@/components/ios';
import { cn } from '@/lib/utils';
import { getNFLTeamLogo, type NFLPrediction } from '../../../api/nflGames';
import type { GameFeedItem } from '../../../types';
import { ComparisonBar, Disclosure, TeamMark } from './shared';
import { useNflH2H, type NflH2HGame } from './useNflH2H';

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

const OVER_FILL = '#10b981';
const UNDER_FILL = '#3b82f6';

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

/** Direction disc for the Over/Under bar — same color language as the total pick. */
function DirectionMark({ over }: { over: boolean }) {
  return (
    <span
      className={cn(
        'flex h-[28px] w-[28px] shrink-0 items-center justify-center rounded-full',
        over
          ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300'
          : 'bg-blue-500/15 text-blue-600 dark:text-blue-300',
      )}
    >
      {over ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />}
    </span>
  );
}

/**
 * Head to Head: wins / covers / over-under across the last five meetings as
 * divided bars, with the game-by-game scores behind a disclosure.
 *
 * The counts used to be pairs of boxed numbers with a green tint on whichever
 * was larger; three bars say the same thing without the reader comparing
 * digits, and the box-per-matchup list is evidence, so it collapses.
 */
export function NflH2HSection({ game }: { game: GameFeedItem }) {
  const raw = game.raw as NFLPrediction;
  const { games: h2hGames, loading, error } = useNflH2H(raw.home_team, raw.away_team);
  const stats = calculateH2HSummary(h2hGames, raw.home_team);

  const away = game.awayTeam;
  const home = game.homeTeam;

  return (
    <WidgetCard
      icon={<History />}
      title="Head to Head"
      subtitle="How these two teams have actually finished the last few times they played."
      accessory={
        !loading && !error && h2hGames.length > 0 ? (
          <span className="text-[11px] font-semibold tabular-nums text-muted-foreground">
            Last {h2hGames.length}
          </span>
        ) : undefined
      }
    >
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
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          No historical matchups found between these teams.
        </p>
      ) : (
        <>
          <div className="divide-y divide-black/5 dark:divide-white/10">
            <ComparisonBar
              caption="Wins"
              leftMark={<TeamMark team={away} size={28} />}
              leftLabel={away.abbrev}
              leftValue={stats.awayTeamWins}
              leftColor={away.colors.primary}
              rightMark={<TeamMark team={home} size={28} />}
              rightLabel={home.abbrev}
              rightValue={stats.homeTeamWins}
              rightColor={home.colors.primary}
            />
            <ComparisonBar
              caption="Covers"
              leftMark={<TeamMark team={away} size={28} />}
              leftLabel={away.abbrev}
              leftValue={stats.awayTeamCovers}
              leftColor={away.colors.primary}
              rightMark={<TeamMark team={home} size={28} />}
              rightLabel={home.abbrev}
              rightValue={stats.homeTeamCovers}
              rightColor={home.colors.primary}
            />
            <ComparisonBar
              caption="Over / Under"
              leftMark={<DirectionMark over />}
              leftLabel="Overs"
              leftValue={stats.overs}
              leftColor={OVER_FILL}
              rightMark={<DirectionMark over={false} />}
              rightLabel="Unders"
              rightValue={stats.unders}
              rightColor={UNDER_FILL}
            />
          </div>

          <div className="pt-2">
            <Disclosure
              label="Game by game"
              summary={`${h2hGames.length} meeting${h2hGames.length === 1 ? '' : 's'}`}
            >
              <p className="mb-1.5 text-[10px] leading-snug text-muted-foreground/80">
                Final scores from the meetings the summary above is built on, most recent first.
              </p>
              <div className="divide-y divide-black/5 dark:divide-white/10">
                {h2hGames.map((matchup) => (
                  <div
                    key={String(matchup.id)}
                    className="flex items-center gap-2 py-1.5 text-[11px]"
                  >
                    <span className="w-20 shrink-0 text-muted-foreground">
                      {formatDate(matchup.game_date)}
                    </span>
                    <span className="w-12 shrink-0 text-muted-foreground/70">
                      Wk {matchup.week ?? '—'}
                    </span>
                    <span className="ml-auto flex shrink-0 items-center gap-1.5">
                      <img
                        src={getNFLTeamLogo(matchup.away_team)}
                        alt={matchup.away_team}
                        className="h-4 w-4 object-contain"
                      />
                      <span className="font-bold tabular-nums text-foreground">
                        {matchup.away_score}
                      </span>
                      <span className="text-muted-foreground/60">@</span>
                      <span className="font-bold tabular-nums text-foreground">
                        {matchup.home_score}
                      </span>
                      <img
                        src={getNFLTeamLogo(matchup.home_team)}
                        alt={matchup.home_team}
                        className="h-4 w-4 object-contain"
                      />
                    </span>
                  </div>
                ))}
              </div>
            </Disclosure>
          </div>
        </>
      )}
    </WidgetCard>
  );
}
