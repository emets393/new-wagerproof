import * as React from 'react';
import { cn } from '@/lib/utils';
import type { CompGame, CompMarket, CompSide } from '../types';
import { currentLineForSide, formatSignedLine } from '../format';
import { TeamMark } from './TeamMark';

function LineChip({
  active,
  disabled,
  pending,
  children,
  onClick,
  className,
}: {
  active: boolean;
  disabled: boolean;
  pending?: boolean;
  children: React.ReactNode;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'min-w-[4.5rem] rounded-lg border px-2 py-1.5 text-center font-mono text-[13px] font-black transition-all active:scale-[0.97]',
        active
          ? 'border-amber-500/50 bg-amber-500/20 text-amber-950 shadow-[0_0_10px_rgba(245,158,11,0.2)] dark:text-amber-100'
          : 'border-black/5 bg-muted/35 hover:bg-muted/55 dark:border-white/10',
        (disabled || pending) && !active && 'cursor-not-allowed opacity-45',
        className
      )}
    >
      {pending ? (
        <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
          —
        </span>
      ) : (
        children
      )}
    </button>
  );
}

/**
 * Compact card: away/home rows with logo+name | spread | over/under.
 * Top: Away · away spread · Over
 * Bottom: Home · home spread · Under
 */
export function GamePickCard({
  game,
  selected,
  locked,
  onToggle,
}: {
  game: CompGame;
  selected: Partial<Record<CompMarket, CompSide>>;
  locked: boolean;
  onToggle: (market: CompMarket, side: CompSide) => void;
}) {
  const kick = React.useMemo(
    () =>
      new Date(game.kickoff).toLocaleString(undefined, {
        weekday: 'short',
        hour: 'numeric',
        minute: '2-digit',
      }),
    [game.kickoff]
  );

  const spreadPending = game.spread_home == null;
  const totalPending = game.total == null;
  const awayLine = currentLineForSide(game, 'spread', 'away');
  const homeLine = currentLineForSide(game, 'spread', 'home');
  const totalStr =
    game.total == null ? null : formatSignedLine(game.total).replace(/^[+−]/, '');

  const toggle = (market: CompMarket, side: CompSide) => {
    if (locked) return;
    if (market === 'spread' && spreadPending) return;
    if (market === 'total' && totalPending) return;
    onToggle(market, side);
  };

  return (
    <div className="rounded-xl border border-black/5 bg-white/55 px-2.5 py-2 backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.05]">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="text-[10px] font-semibold text-muted-foreground">{kick}</span>
        <span
          className={cn(
            'rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide',
            game.sport === 'nfl'
              ? 'bg-sky-500/15 text-sky-700 dark:text-sky-300'
              : 'bg-amber-500/15 text-amber-800 dark:text-amber-200'
          )}
        >
          {game.sport}
        </span>
      </div>

      {/* Column headers */}
      <div className="mb-1 grid grid-cols-[minmax(0,1fr)_4.5rem_4.5rem] gap-1.5 px-0.5 text-[8px] font-bold uppercase tracking-wide text-muted-foreground">
        <span>Team</span>
        <span className="text-center">Spread</span>
        <span className="text-center">Total</span>
      </div>

      {/* Away row */}
      <div className="grid grid-cols-[minmax(0,1fr)_4.5rem_4.5rem] items-center gap-1.5">
        <div className="flex min-w-0 items-center gap-1.5">
          <TeamMark sport={game.sport} name={game.away_team} />
          <span className="truncate text-[12px] font-bold leading-tight">{game.away_team}</span>
        </div>
        <LineChip
          active={selected.spread === 'away'}
          disabled={locked || spreadPending}
          pending={spreadPending}
          onClick={() => toggle('spread', 'away')}
        >
          {formatSignedLine(awayLine)}
        </LineChip>
        <LineChip
          active={selected.total === 'over'}
          disabled={locked || totalPending}
          pending={totalPending}
          onClick={() => toggle('total', 'over')}
        >
          <span className="text-[9px] font-bold uppercase text-muted-foreground">O</span>{' '}
          {totalStr}
        </LineChip>
      </div>

      {/* Home row */}
      <div className="mt-1 grid grid-cols-[minmax(0,1fr)_4.5rem_4.5rem] items-center gap-1.5">
        <div className="flex min-w-0 items-center gap-1.5">
          <TeamMark sport={game.sport} name={game.home_team} />
          <span className="truncate text-[12px] font-bold leading-tight">{game.home_team}</span>
        </div>
        <LineChip
          active={selected.spread === 'home'}
          disabled={locked || spreadPending}
          pending={spreadPending}
          onClick={() => toggle('spread', 'home')}
        >
          {formatSignedLine(homeLine)}
        </LineChip>
        <LineChip
          active={selected.total === 'under'}
          disabled={locked || totalPending}
          pending={totalPending}
          onClick={() => toggle('total', 'under')}
        >
          <span className="text-[9px] font-bold uppercase text-muted-foreground">U</span>{' '}
          {totalStr}
        </LineChip>
      </div>
    </div>
  );
}
