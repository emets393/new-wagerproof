import React from 'react';
import { cn } from '@/lib/utils';

interface F5SplitsComparisonRowProps {
  title: string;
  away: React.ReactNode;
  home: React.ReactNode;
  awaySubtext?: React.ReactNode;
  homeSubtext?: React.ReactNode;
  awayClassName?: string;
  homeClassName?: string;
  awayLabel?: string;
  homeLabel?: string;
  className?: string;
}

function ValueCell({
  children,
  className,
  subtext,
  align,
}: {
  children: React.ReactNode;
  className?: string;
  subtext?: React.ReactNode;
  align: 'left' | 'center' | 'right';
}) {
  const alignClass =
    align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left';

  return (
    <div className={cn('min-w-0', alignClass)}>
      <div className={cn('text-sm font-semibold text-foreground break-words leading-snug', className)}>
        {children}
      </div>
      {subtext ? (
        <div className={cn('text-[10px] sm:text-[11px] text-muted-foreground mt-0.5 break-words leading-snug', alignClass)}>
          {subtext}
        </div>
      ) : null}
    </div>
  );
}

export function F5SplitsComparisonRow({
  title,
  away,
  home,
  awaySubtext,
  homeSubtext,
  awayClassName,
  homeClassName,
  awayLabel = 'Away',
  homeLabel = 'Home',
  className,
}: F5SplitsComparisonRowProps) {
  const rowBorder = 'border-b border-border/60 last:border-0';

  return (
    <>
      {/* Mobile: title on top, away | home below */}
      <div className={cn('sm:hidden py-3', rowBorder, className)}>
        <p className="text-xs font-medium text-muted-foreground text-center leading-snug px-1 mb-2.5">
          {title}
        </p>
        <div className="grid grid-cols-2 gap-x-3 gap-y-0">
          <div className="min-w-0 border-r border-border/40 pr-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground text-center mb-1 truncate">
              {awayLabel}
            </p>
            <ValueCell align="center" className={awayClassName} subtext={awaySubtext}>
              {away}
            </ValueCell>
          </div>
          <div className="min-w-0 pl-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground text-center mb-1 truncate">
              {homeLabel}
            </p>
            <ValueCell align="center" className={homeClassName} subtext={homeSubtext}>
              {home}
            </ValueCell>
          </div>
        </div>
      </div>

      {/* Tablet+ : away | title | home */}
      <div
        className={cn(
          'hidden sm:grid grid-cols-[minmax(0,1fr)_minmax(6.5rem,9.5rem)_minmax(0,1fr)] md:grid-cols-[minmax(0,1fr)_minmax(7.5rem,11rem)_minmax(0,1fr)] gap-x-2 md:gap-x-3 gap-y-0.5 items-start py-2.5 md:py-3',
          rowBorder,
          className,
        )}
      >
        <ValueCell align="right" className={awayClassName} subtext={awaySubtext}>
          {away}
        </ValueCell>
        <div className="text-center px-0.5 md:px-1 min-w-0 self-center">
          <p className="text-[11px] md:text-xs font-medium text-muted-foreground leading-snug">{title}</p>
        </div>
        <ValueCell align="left" className={homeClassName} subtext={homeSubtext}>
          {home}
        </ValueCell>
      </div>
    </>
  );
}
