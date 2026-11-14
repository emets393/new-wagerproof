import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { withAlpha } from '../colors';
import { formatLine } from '../signals';
import type { MarketRead, PublicMarket } from '../types';

interface LineMoveRailProps {
  market: PublicMarket;
  awayName: string;
  homeName: string;
  read: MarketRead;
  /** Color of the side the line moved toward. */
  color: string;
}

function points(size: number): string {
  const text = String(Math.round(size * 100) / 100);
  return `${text} ${Number(text) === 1 ? 'point' : 'points'}`;
}

function directionMark(market: PublicMarket, flat: boolean, movedToward: MarketRead['movedToward']): string {
  if (flat) return '⏸️';
  if (market === 'total') return movedToward === 'away' ? '📈' : '📉';
  return '👉';
}

function Cell({
  emphasize,
  color,
  children,
  align = 'left',
}: {
  emphasize: boolean;
  color: string;
  children: ReactNode;
  align?: 'left' | 'right' | 'center';
}) {
  return (
    <div
      className={cn(
        'min-w-0 rounded-xl border px-2.5 py-2',
        align === 'center' && 'text-center',
        align === 'right' && 'text-right',
        !emphasize && 'border-dashed border-white/20 bg-transparent dark:border-white/15',
      )}
      style={
        emphasize
          ? { borderColor: withAlpha(color, 0.7), backgroundColor: withAlpha(color, 0.16), color }
          : undefined
      }
    >
      {children}
    </div>
  );
}

function Figure({
  name,
  value,
  market,
  emphasize,
  color,
  align,
}: {
  name?: string;
  value: number | null;
  market: PublicMarket;
  emphasize: boolean;
  color: string;
  align: 'left' | 'right' | 'center';
}) {
  return (
    <Cell emphasize={emphasize} color={color} align={align}>
      {name && (
        <div
          className={cn(
            'truncate text-[10px] font-bold uppercase tracking-wide leading-tight',
            emphasize ? 'opacity-80' : 'text-muted-foreground',
          )}
        >
          {name}
        </div>
      )}
      <div className={cn('tabular-nums text-[17px] font-bold leading-tight', !emphasize && 'text-foreground')}>
        {value === null ? '—' : formatLine(market, value)}
      </div>
    </Cell>
  );
}

/**
 * Open and current numbers sit in matching cells. A spread always names the
 * team inside its cell, so a plus number cannot be read as the other side.
 */
export function LineMoveRail({ market, awayName, homeName, read, color }: LineMoveRailProps) {
  const { open, current, homeOpen, homeCurrent, movedToward, moveSize } = read;
  if (open === null && current === null && homeOpen === null && homeCurrent === null) return null;

  const flat = movedToward === null || moveSize === 0 || moveSize === null;
  const toward = movedToward === 'away' ? read.sideName.away : movedToward === 'home' ? read.sideName.home : null;
  const caption = flat
    ? current === null
      ? 'Opener only'
      : 'Unchanged'
    : market === 'ml'
      ? `Toward ${toward}`
      : `${points(moveSize ?? 0)} toward ${toward}`;
  const mark = directionMark(market, flat || current === null, movedToward);
  const awayEmphasis = !flat && movedToward === 'away';
  const homeEmphasis = !flat && movedToward === 'home';
  const openerMissing = open === null && current !== null;

  if (openerMissing) {
    return (
      <div className="rounded-2xl border border-black/10 bg-black/[0.03] px-3 py-2.5 dark:border-white/10 dark:bg-white/[0.03]">
        <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Now</div>
        <div className="mt-1 text-[17px] font-bold tabular-nums text-foreground">
          {market === 'total' ? formatLine(market, current) : `${awayName} ${formatLine(market, current)}`}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-black/10 bg-black/[0.03] p-2.5 dark:border-white/10 dark:bg-white/[0.03]">
      <div className="mb-1.5 grid grid-cols-[minmax(0,1fr)_2.25rem_minmax(0,1fr)] items-center px-0.5">
        <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Open</div>
        <div />
        <div className="text-right text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Now</div>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_2.25rem_minmax(0,1fr)] items-center gap-x-1.5 gap-y-1.5">
        {market === 'total' ? (
          <>
            <Figure value={open} market="total" emphasize={false} color={color} align="center" />
            <div className="text-center text-[18px] leading-none" aria-hidden style={flat ? undefined : { color }}>
              {current === null ? '' : flat ? '➖' : '➡️'}
            </div>
            <Figure value={current} market="total" emphasize={!flat && current !== null} color={color} align="center" />
          </>
        ) : (
          <>
            <Figure name={awayName} value={open} market={market} emphasize={false} color={color} align="left" />
            <div className="row-span-2 text-center text-[18px] leading-none" aria-hidden style={flat ? undefined : { color }}>
              {current === null ? '' : flat ? '➖' : '➡️'}
            </div>
            <Figure name={awayName} value={current} market={market} emphasize={awayEmphasis} color={color} align="right" />
            <Figure name={homeName} value={homeOpen} market={market} emphasize={false} color={color} align="left" />
            <Figure name={homeName} value={homeCurrent} market={market} emphasize={homeEmphasis} color={color} align="right" />
          </>
        )}
      </div>
      <p className="mt-2 text-center text-[13px] font-semibold leading-tight" style={flat ? undefined : { color }}>
        <span aria-hidden className="mr-1">
          {mark}
        </span>
        {caption}
      </p>
    </div>
  );
}
