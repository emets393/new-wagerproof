import { AlertCircle, ArrowDown, ArrowUp, History } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { WidgetCard } from '@/components/ios';
import { cn } from '@/lib/utils';
import { getNFLTeamLogo, type NFLPrediction } from '../../../api/nflGames';
import type { GameFeedItem } from '../../../types';
import { nflH2HHeadline } from '../../headlines/nfl';
import { ComparisonBar, TeamMark } from './shared';
import { useNflH2H, type NflH2HGame } from './useNflH2H';

const formatDate = (dateString: string) => {
  if (!dateString) return '—';
  const date = new Date(dateString.length <= 10 ? `${dateString}T12:00:00` : dateString);
  if (Number.isNaN(date.getTime())) return dateString;
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

const formatSeasonLabel = (row: NflH2HGame) => {
  const season =
    row.season != null
      ? String(row.season)
      : row.game_date && row.game_date.length >= 4
        ? row.game_date.slice(0, 4)
        : null;
  if (!season) return formatDate(row.game_date);
  return `${season} Season · ${formatDate(row.game_date)}`;
};

const formatSpread = (value: number | null | undefined) => {
  if (value == null || Number.isNaN(Number(value))) return '—';
  const n = Number(value);
  if (n === 0) return 'PK';
  return n > 0 ? `+${n}` : String(n);
};

const formatTotal = (value: number | null | undefined) => {
  if (value == null || Number.isNaN(Number(value))) return '—';
  const n = Number(value);
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
};

const formatMl = (value: number | null | undefined) => {
  if (value == null || Number.isNaN(Number(value))) return '—';
  const n = Math.round(Number(value));
  return n > 0 ? `+${n}` : String(n);
};

const OVER_FILL = '#10b981';
const UNDER_FILL = '#3b82f6';

const calculateH2HSummary = (h2hGames: NflH2HGame[], homeAbbr: string) => {
  const stats = {
    homeTeamWins: 0,
    awayTeamWins: 0,
    homeTeamCovers: 0,
    awayTeamCovers: 0,
    overs: 0,
    unders: 0,
  };
  if (!h2hGames || h2hGames.length === 0) return stats;
  const home = homeAbbr.toUpperCase();

  h2hGames.forEach((game) => {
    if (game.winner_team) {
      if (game.winner_team === home) stats.homeTeamWins++;
      else stats.awayTeamWins++;
    } else if ((game.home_score ?? 0) > (game.away_score ?? 0)) {
      if (game.home_team === home) stats.homeTeamWins++;
      else stats.awayTeamWins++;
    } else if ((game.away_score ?? 0) > (game.home_score ?? 0)) {
      if (game.away_team === home) stats.homeTeamWins++;
      else stats.awayTeamWins++;
    }

    if (game.cover_team) {
      if (game.cover_team === home) stats.homeTeamCovers++;
      else stats.awayTeamCovers++;
    } else if (game.home_away_spread_cover === 1) {
      if (game.home_team === home) stats.homeTeamCovers++;
      else stats.awayTeamCovers++;
    } else if (game.home_away_spread_cover === 0) {
      if (game.away_team === home) stats.homeTeamCovers++;
      else stats.awayTeamCovers++;
    }

    if (game.ou_result === 1) stats.overs++;
    else if (game.ou_result === 0) stats.unders++;
  });

  return stats;
};

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

function HistoryPill({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: string;
  tone?: 'default' | 'win' | 'cover' | 'over' | 'under' | 'muted';
}) {
  const toneClass =
    tone === 'win'
      ? 'text-primary'
      : tone === 'cover'
        ? 'text-emerald-600 dark:text-emerald-400'
        : tone === 'over'
          ? 'text-emerald-600 dark:text-emerald-400'
          : tone === 'under'
            ? 'text-blue-600 dark:text-blue-400'
            : tone === 'muted'
              ? 'text-muted-foreground'
              : 'text-foreground';

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-black/[0.04] px-2 py-1 dark:bg-white/10">
      <span className="text-[8px] font-bold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className={cn('text-[10px] font-bold uppercase', toneClass)}>{value}</span>
    </span>
  );
}

function MatchupRow({ row }: { row: NflH2HGame }) {
  const ou = (row.ou_result_label || '').toUpperCase();
  const coverValue = row.cover_team || row.ats_result || 'Push';
  const ouTone = ou === 'OVER' ? 'over' : ou === 'UNDER' ? 'under' : 'muted';

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
        <span className="inline-flex items-center gap-1.5">
          <img
            src={getNFLTeamLogo(row.away_team)}
            alt={row.away_team}
            className="h-5 w-5 object-contain"
          />
          <span className="text-[12px] font-bold text-foreground">{row.away_team}</span>
          <span className="text-[14px] font-bold tabular-nums text-foreground">
            {row.away_score ?? '—'}
          </span>
        </span>
        <span className="text-[12px] font-bold text-muted-foreground">@</span>
        <span className="inline-flex items-center gap-1.5">
          <img
            src={getNFLTeamLogo(row.home_team)}
            alt={row.home_team}
            className="h-5 w-5 object-contain"
          />
          <span className="text-[12px] font-bold text-foreground">{row.home_team}</span>
          <span className="text-[14px] font-bold tabular-nums text-foreground">
            {row.home_score ?? '—'}
          </span>
        </span>
        <span className="ml-auto text-[11px] font-semibold tabular-nums text-muted-foreground">
          Total {row.total_points ?? '—'}
        </span>
      </div>

      <div className="mb-1.5 flex flex-wrap gap-1.5">
        <HistoryPill label="Winner" value={row.winner_team || '—'} tone="win" />
        <HistoryPill
          label="Covered"
          value={coverValue}
          tone={row.cover_team ? 'cover' : 'muted'}
        />
        <HistoryPill label="O/U" value={row.ou_result_label || '—'} tone={ouTone} />
      </div>

      <p className="text-[10px] font-semibold tabular-nums text-muted-foreground">
        Spread {formatSpread(row.closing_spread_home)} · Total {formatTotal(row.closing_total)}
        {row.closing_ml_away != null || row.closing_ml_home != null
          ? ` · ML ${formatMl(row.closing_ml_away)} / ${formatMl(row.closing_ml_home)}`
          : ''}
      </p>
    </div>
  );
}

/**
 * Head to Head: wins / covers / over-under across recent meetings, plus a
 * native-style game-by-game list (Winner / Covered / O/U).
 */
export function NflH2HSection({ game }: { game: GameFeedItem }) {
  const raw = game.raw as NFLPrediction;
  const homeAbbr = String(
    (raw.home_ab as string | undefined) || game.homeTeam.abbrev || '',
  ).toUpperCase();
  const awayAbbr = String(
    (raw.away_ab as string | undefined) || game.awayTeam.abbrev || '',
  ).toUpperCase();

  const { games: h2hGames, loading, error } = useNflH2H(homeAbbr, awayAbbr);
  const stats = calculateH2HSummary(h2hGames, homeAbbr);

  const away = game.awayTeam;
  const home = game.homeTeam;

  const matchupVerified =
    h2hGames.length > 0 &&
    h2hGames.every(
      (matchup) =>
        (matchup.home_team === homeAbbr && matchup.away_team === awayAbbr) ||
        (matchup.home_team === awayAbbr && matchup.away_team === homeAbbr),
    );

  return (
    <WidgetCard
      icon={<History />}
      title="Head to Head"
      headline={
        nflH2HHeadline({
          loading,
          error,
          meetings: h2hGames.length,
          matchupVerified,
          homeName: home.name,
          awayName: away.name,
          homeWins: stats.homeTeamWins,
          awayWins: stats.awayTeamWins,
          homeCovers: stats.homeTeamCovers,
          awayCovers: stats.awayTeamCovers,
          overs: stats.overs,
          unders: stats.unders,
        }) ?? undefined
      }
      subtitle="Prior-season meetings between these two clubs — not limited to the current slate."
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

          <div className="mt-3 space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Matchup history
            </p>
            {h2hGames.map((matchup) => (
              <MatchupRow key={String(matchup.id)} row={matchup} />
            ))}
          </div>
        </>
      )}
    </WidgetCard>
  );
}
