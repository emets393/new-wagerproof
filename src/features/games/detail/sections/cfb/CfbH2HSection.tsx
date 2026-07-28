import { AlertCircle, History } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { WidgetCard } from '@/components/ios';
import { cn } from '@/lib/utils';
import type { CFBPrediction } from '../../../api/cfbGames';
import type { GameFeedItem, TeamRef } from '../../../types';
import { CollegeTeamMark } from './shared';
import { useCfbH2H, type CfbH2HGame } from './useCfbH2H';

const formatDate = (dateString: string) => {
  if (!dateString) return '—';
  const date = new Date(`${dateString}T12:00:00`);
  if (Number.isNaN(date.getTime())) return dateString;
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

const formatSeasonLabel = (row: CfbH2HGame) => {
  const season = row.season != null ? String(row.season) : null;
  if (!season) return formatDate(row.game_date);
  return `${season} Season · ${formatDate(row.game_date)}`;
};

function calculateSummary(games: CfbH2HGame[], homeName: string, awayName: string) {
  const stats = { homeWins: 0, awayWins: 0 };
  for (const g of games) {
    if (g.winner_team === homeName) stats.homeWins++;
    else if (g.winner_team === awayName) stats.awayWins++;
  }
  return stats;
}

function HistoryPill({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-black/[0.04] px-2 py-1 dark:bg-white/10">
      <span className="text-[8px] font-bold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="text-[10px] font-bold uppercase text-primary">{value}</span>
    </span>
  );
}

function TeamScore({
  team,
  name,
  score,
}: {
  team: TeamRef | null;
  name: string;
  score: number | null;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      {team ? <CollegeTeamMark team={team} size={20} /> : null}
      <span className="text-[12px] font-bold text-foreground">{name}</span>
      <span className="text-[14px] font-bold tabular-nums text-foreground">{score ?? '—'}</span>
    </span>
  );
}

function MatchupRow({
  row,
  home,
  away,
}: {
  row: CfbH2HGame;
  home: TeamRef;
  away: TeamRef;
}) {
  const homeMark =
    row.home_team === home.name ? home : row.home_team === away.name ? away : null;
  const awayMark =
    row.away_team === away.name ? away : row.away_team === home.name ? home : null;

  return (
    <div className="rounded-xl border border-black/5 bg-black/[0.02] p-3 dark:border-white/10 dark:bg-white/[0.03]">
      <div className="mb-2 flex items-center gap-2">
        <span className="text-[11px] font-bold text-muted-foreground">{formatSeasonLabel(row)}</span>
        {row.neutral_site ? (
          <span className="text-[9px] font-bold uppercase text-sky-600 dark:text-sky-400">
            Neutral
          </span>
        ) : null}
      </div>

      <div className="mb-2 flex flex-wrap items-center gap-2">
        <TeamScore team={awayMark} name={row.away_team} score={row.away_score} />
        <span className="text-[12px] font-bold text-muted-foreground">@</span>
        <TeamScore team={homeMark} name={row.home_team} score={row.home_score} />
        <span className="ml-auto text-[11px] font-semibold tabular-nums text-muted-foreground">
          Total {row.total_points ?? '—'}
        </span>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <HistoryPill label="Winner" value={row.winner_team || '—'} />
        {row.week != null ? (
          <span className={cn('text-[10px] font-semibold text-muted-foreground')}>
            Wk {row.week}
          </span>
        ) : null}
      </div>
    </div>
  );
}

/**
 * CFB head-to-head from `cfb_games` (there is no `cfb_matchup_history` table).
 * Prior seasons only — Week 1 still shows historical series when they exist.
 */
export function CfbH2HSection({ game }: { game: GameFeedItem<CFBPrediction> }) {
  const homeName = game.homeTeam.name;
  const awayName = game.awayTeam.name;
  const { games: h2hGames, loading, error } = useCfbH2H(homeName, awayName);
  const stats = calculateSummary(h2hGames, homeName, awayName);

  const matchupVerified =
    h2hGames.length > 0 &&
    h2hGames.every(
      (m) =>
        (m.home_team === homeName && m.away_team === awayName) ||
        (m.home_team === awayName && m.away_team === homeName),
    );

  return (
    <WidgetCard
      icon={<History />}
      title="Head to Head"
      subtitle="Prior completed meetings between these schools — not limited to the current season."
      accessory={
        !loading && !error && matchupVerified ? (
          <span className="text-[11px] font-semibold tabular-nums text-muted-foreground">
            Last {h2hGames.length}
          </span>
        ) : undefined
      }
    >
      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-28 w-full" />
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
          <div className="flex items-center justify-between gap-3 border-b border-black/5 pb-3 dark:border-white/10">
            <span className="flex items-center gap-2">
              <CollegeTeamMark team={game.awayTeam} size={28} />
              <span className="text-[12px] font-bold text-foreground">{game.awayTeam.abbrev}</span>
              <span className="text-[18px] font-bold tabular-nums text-foreground">
                {stats.awayWins}
              </span>
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
              Wins
            </span>
            <span className="flex items-center gap-2">
              <span className="text-[18px] font-bold tabular-nums text-foreground">
                {stats.homeWins}
              </span>
              <span className="text-[12px] font-bold text-foreground">{game.homeTeam.abbrev}</span>
              <CollegeTeamMark team={game.homeTeam} size={28} />
            </span>
          </div>

          <div className="mt-3 space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Matchup history
            </p>
            {h2hGames.map((row) => (
              <MatchupRow
                key={row.id}
                row={row}
                home={game.homeTeam}
                away={game.awayTeam}
              />
            ))}
          </div>
        </>
      )}
    </WidgetCard>
  );
}
