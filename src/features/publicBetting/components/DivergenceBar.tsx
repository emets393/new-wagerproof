import * as React from 'react';
import type { TeamRef } from '@/features/games/types';
import type { PublicSide } from '../types';
import { TeamDisc } from './TeamMarks';

interface DivergenceBarProps {
  betsAway: number;
  betsHome: number;
  moneyAway: number;
  moneyHome: number;
  awayColor: string;
  homeColor: string;
  /** Side whose money share beats its ticket share. No wedge when this is null. */
  moneyTiltSide: PublicSide | null;
  awayLabel: string;
  homeLabel: string;
  /** Spread and moneyline only. Totals are Over and Under, not the two teams. */
  awayTeam?: TeamRef;
  homeTeam?: TeamRef;
}

function share(left: number, right: number): number {
  const sum = left + right;
  if (sum <= 0) return 50;
  return (left / sum) * 100;
}

function Bar({ leftPct, awayColor, homeColor }: { leftPct: number; awayColor: string; homeColor: string }) {
  const [grown, setGrown] = React.useState(false);

  React.useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      setGrown(true);
      return;
    }
    const id = requestAnimationFrame(() => setGrown(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const left = grown ? leftPct : 0;

  return (
    <div
      className="grid h-3 gap-1 motion-safe:transition-[grid-template-columns] motion-safe:duration-500 motion-safe:ease-out"
      style={{ gridTemplateColumns: `${left}fr ${Math.max(0, 100 - left)}fr` }}
    >
      <div className="min-w-0 rounded-full" style={{ background: awayColor }} />
      <div className="min-w-0 rounded-full" style={{ background: homeColor }} />
    </div>
  );
}

function Ends({
  left,
  right,
  label,
  awayColor,
  homeColor,
}: {
  left: number;
  right: number;
  label: string;
  awayColor: string;
  homeColor: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-2 text-[11px] font-semibold leading-none tabular-nums">
      <span style={{ color: awayColor }}>{Math.round(left)}%</span>
      <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
      <span style={{ color: homeColor }}>{Math.round(right)}%</span>
    </div>
  );
}

/**
 * How far one side's money share sits ahead of its ticket share.
 * Null when the two splits match. The number uses the same rounded percents
 * printed on the bars.
 */
export function differenceCaption(
  betsAway: number,
  betsHome: number,
  moneyAway: number,
  moneyHome: number,
  moneyTiltSide: PublicSide | null,
  awayLabel: string,
  homeLabel: string,
): { text: string; side: PublicSide; points: number } | null {
  if (!moneyTiltSide) return null;
  const tickets = Math.round(moneyTiltSide === 'away' ? betsAway : betsHome);
  const money = Math.round(moneyTiltSide === 'away' ? moneyAway : moneyHome);
  const points = money - tickets;
  if (points < 1) return null;
  const name = moneyTiltSide === 'away' ? awayLabel : homeLabel;
  return { text: `${points}% more money than tickets on ${name}`, side: moneyTiltSide, points };
}

/**
 * Tickets and money on one axis. Each side keeps its own color, with a gap at
 * the split so similar hues don't run together. The row between them states
 * the money-versus-tickets gap in words.
 */
export function DivergenceBar({
  betsAway,
  betsHome,
  moneyAway,
  moneyHome,
  awayColor,
  homeColor,
  moneyTiltSide,
  awayLabel,
  homeLabel,
  awayTeam,
  homeTeam,
}: DivergenceBarProps) {
  const betSplit = share(betsAway, betsHome);
  const moneySplit = share(moneyAway, moneyHome);
  const difference = differenceCaption(betsAway, betsHome, moneyAway, moneyHome, moneyTiltSide, awayLabel, homeLabel);
  const differenceColor = difference?.side === 'away' ? awayColor : difference?.side === 'home' ? homeColor : null;

  return (
    <div
      className="min-w-0"
      role="img"
      aria-label={`Tickets ${Math.round(betsAway)}% ${awayLabel}, ${Math.round(betsHome)}% ${homeLabel}. Money ${Math.round(moneyAway)}% ${awayLabel}, ${Math.round(moneyHome)}% ${homeLabel}.${difference ? ` ${difference.text}.` : ''}`}
    >
      <div className="flex items-center gap-1.5">
        {awayTeam && (
          <span className="shrink-0" aria-hidden>
            <TeamDisc team={awayTeam} size={22} />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <Ends left={betsAway} right={betsHome} label="🎟️ Tickets" awayColor={awayColor} homeColor={homeColor} />
          <div className="relative mt-1">
            <div className="pointer-events-none absolute inset-y-0 left-1/2 z-[1] w-px -translate-x-1/2 bg-foreground/25" />
            <Bar leftPct={betSplit} awayColor={awayColor} homeColor={homeColor} />
          </div>
          {difference && differenceColor && (
            <div className="py-1">
              <div className="relative h-2">
                <div
                  className="absolute inset-y-0"
                  style={{
                    left: `${Math.min(betSplit, moneySplit)}%`,
                    width: `${Math.abs(moneySplit - betSplit)}%`,
                    background: differenceColor,
                    opacity: 0.55,
                    clipPath:
                      moneySplit >= betSplit
                        ? 'polygon(0 0, 100% 100%, 0 100%)'
                        : 'polygon(100% 0, 0 100%, 100% 100%)',
                  }}
                />
              </div>
              <p className="flex flex-wrap items-baseline justify-center gap-x-1 pt-1 text-center text-[11px] font-semibold leading-tight text-foreground/80">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">⚡ Difference</span>
                <span className="tabular-nums" style={{ color: differenceColor }}>
                  {difference.points}%
                </span>
                <span>more money than tickets on</span>
                <span style={{ color: differenceColor }}>{difference.side === 'away' ? awayLabel : homeLabel}</span>
              </p>
            </div>
          )}
          <div className={`relative ${difference ? '' : 'mt-1.5'}`}>
            <div className="pointer-events-none absolute inset-y-0 left-1/2 z-[1] w-px -translate-x-1/2 bg-foreground/25" />
            <Bar leftPct={moneySplit} awayColor={awayColor} homeColor={homeColor} />
          </div>
          <div className="mt-1">
            <Ends left={moneyAway} right={moneyHome} label="💵 Money" awayColor={awayColor} homeColor={homeColor} />
          </div>
        </div>
        {homeTeam && (
          <span className="shrink-0" aria-hidden>
            <TeamDisc team={homeTeam} size={22} />
          </span>
        )}
      </div>
    </div>
  );
}
