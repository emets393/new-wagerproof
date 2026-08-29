import * as React from 'react';
import { Lock, Search, Star } from 'lucide-react';
import { GlassCard } from '@/components/ios';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import type { CompSubmissionCard, CompSubmissionPickRow, CompWeek } from '../types';
import {
  formatCountdown,
  formatDeadlinePair,
  formatSignedLine,
} from '../format';
import { compTeamShortName } from '../teamLogos';
import { TeamMark } from './TeamMark';

export function EveryonePicksTab({
  week,
  now,
  pastDeadline,
  cards,
  isLoading,
  error,
}: {
  week: CompWeek | null;
  now: number;
  pastDeadline: boolean;
  cards: CompSubmissionCard[] | undefined;
  isLoading: boolean;
  error: string | null;
}) {
  const { user } = useAuth();
  const [search, setSearch] = React.useState('');

  if (!pastDeadline) {
    const ms = week ? Math.max(0, new Date(week.deadline).getTime() - now) : 0;
    const pair = week ? formatDeadlinePair(week.deadline) : null;
    return (
      <GlassCard radius={18} className="p-6 text-center">
        <Lock className="mx-auto h-8 w-8 text-muted-foreground" />
        <p className="mt-3 text-[15px] font-bold">Picks unlock after Friday 12:00 PM ET</p>
        {pair && (
          <p className="mt-1 text-[13px] text-muted-foreground">
            {pair.et} · {pair.local}
          </p>
        )}
        <p className="mt-4 font-mono text-[28px] font-black">{formatCountdown(ms)}</p>
      </GlassCard>
    );
  }

  if (isLoading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-56 animate-pulse rounded-2xl bg-muted/40" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <GlassCard radius={18} className="p-6 text-center text-[13px] text-muted-foreground">
        {error}
      </GlassCard>
    );
  }

  const all = cards ?? [];
  const q = search.trim().toLowerCase();
  const filtered = q
    ? all.filter((c) => c.displayName.toLowerCase().includes(q))
    : all;

  const ordered = [...filtered].sort((a, b) => {
    const aMine = user?.id === a.userId ? 0 : 1;
    const bMine = user?.id === b.userId ? 0 : 1;
    if (aMine !== bMine) return aMine - bMine;
    const at = a.submittedAt ? new Date(a.submittedAt).getTime() : 0;
    const bt = b.submittedAt ? new Date(b.submittedAt).getTime() : 0;
    return at - bt;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
            Everyone&apos;s picks
          </h2>
          <p className="mt-0.5 text-[13px] font-semibold text-muted-foreground">
            {all.length} {all.length === 1 ? 'player' : 'players'} submitted
          </p>
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search players…"
            className="h-9 w-full rounded-full border border-black/5 bg-white/60 pl-9 pr-3 text-[13px] font-semibold backdrop-blur-xl outline-none placeholder:text-muted-foreground focus:border-amber-500/40 dark:border-white/10 dark:bg-white/[0.06]"
          />
        </div>
      </div>

      {ordered.length === 0 ? (
        <GlassCard radius={18} className="p-6 text-center text-[13px] text-muted-foreground">
          {q ? 'No players match that search.' : 'No submitted picks yet.'}
        </GlassCard>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {ordered.map((card) => (
            <SubmissionCard
              key={card.entryId}
              card={card}
              mine={user?.id === card.userId}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SubmissionCard({ card, mine }: { card: CompSubmissionCard; mine: boolean }) {
  const submittedLabel = React.useMemo(() => {
    if (!card.submittedAt) return null;
    return new Date(card.submittedAt).toLocaleString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  }, [card.submittedAt]);

  return (
    <GlassCard
      radius={18}
      className={cn(
        'flex flex-col overflow-hidden p-0',
        mine && 'ring-2 ring-amber-500/45'
      )}
    >
      <div className="flex items-start justify-between gap-2 border-b border-black/5 px-3.5 py-3 dark:border-white/10">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate text-[15px] font-black leading-tight">
              {card.displayName}
            </span>
            {mine && (
              <span className="shrink-0 rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-900 dark:text-amber-100">
                You
              </span>
            )}
          </div>
          {submittedLabel && (
            <p className="mt-0.5 text-[11px] font-semibold text-muted-foreground">
              Submitted {submittedLabel}
            </p>
          )}
        </div>
        <span className="shrink-0 font-mono text-[12px] font-bold tabular-nums text-muted-foreground">
          {card.picks.length}/6
        </span>
      </div>

      <ul className="divide-y divide-black/5 dark:divide-white/10">
        {card.picks.map((pick) => (
          <PickRow key={pick.pick_id} pick={pick} />
        ))}
      </ul>
    </GlassCard>
  );
}

function PickRow({ pick }: { pick: CompSubmissionPickRow }) {
  const sport = pick.sport;
  const isSpread = pick.market === 'spread';
  const team =
    isSpread ? (pick.side === 'home' ? pick.home_team : pick.away_team) : null;
  const line =
    pick.line != null
      ? isSpread
        ? formatSignedLine(Number(pick.line))
        : String(pick.line)
      : null;
  const title = isSpread
    ? `${compTeamShortName(sport, team!)} ${line ?? ''}`.trim()
    : `${pick.side === 'over' ? 'Over' : 'Under'}${line ? ` ${line}` : ''}`;
  const matchup = `${compTeamShortName(sport, pick.away_team)} @ ${compTeamShortName(sport, pick.home_team)}`;

  const resultTone =
    pick.result === 'win'
      ? 'text-emerald-600 dark:text-emerald-300'
      : pick.result === 'loss'
        ? 'text-rose-600 dark:text-rose-300'
        : pick.result === 'push'
          ? 'text-muted-foreground'
          : null;

  return (
    <li
      className={cn(
        'flex items-center gap-2.5 px-3.5 py-2.5',
        pick.is_potw && 'bg-amber-500/[0.07]'
      )}
    >
      {isSpread && team ? (
        <span className="rounded-full bg-background p-0.5 ring-1 ring-black/5 dark:ring-white/10">
          <TeamMark sport={sport} name={team} size="md" />
        </span>
      ) : (
        <span className="flex items-center -space-x-1.5">
          <span className="rounded-full bg-background p-0.5 ring-1 ring-black/5 dark:ring-white/10">
            <TeamMark sport={sport} name={pick.away_team} size="sm" />
          </span>
          <span className="rounded-full bg-background p-0.5 ring-1 ring-black/5 dark:ring-white/10">
            <TeamMark sport={sport} name={pick.home_team} size="sm" />
          </span>
        </span>
      )}

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          {pick.is_potw && (
            <Star className="h-3.5 w-3.5 shrink-0 fill-amber-500 text-amber-500" />
          )}
          <span className="truncate text-[13px] font-black leading-tight">{title}</span>
        </div>
        <div className="mt-0.5 truncate text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
          {sport} · {isSpread ? 'Spread' : 'Total'} · {matchup}
        </div>
      </div>

      {resultTone && (
        <span className={cn('shrink-0 text-[11px] font-black uppercase', resultTone)}>
          {pick.result}
          {pick.points != null && pick.points > 0 ? ` · ${pick.points}` : ''}
        </span>
      )}
    </li>
  );
}
