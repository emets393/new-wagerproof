import * as React from 'react';
import { SkeletonBlock } from '@/components/ios';
import { getTrendColor } from './useNbaMatchupOverview';
import type { TeamRef } from '../../../types';

/**
 * Away | metric | home comparison table, ported from MatchupOverviewModal's
 * "Recent Trends" grid. The row list is provided by the caller so the same
 * renderer serves both the Betting Trends and Team Stats sections.
 */

export interface TrendRowDef {
  /** Metric label — also drives getTrendColor's better/worse direction. */
  label: string;
  away: number | null;
  home: number | null;
  format: (value: number) => string;
}

function TeamLogoHeader({ team }: { team: TeamRef }) {
  const [imgFailed, setImgFailed] = React.useState(false);
  React.useEffect(() => setImgFailed(false), [team.logoUrl]);

  const hasLogo =
    !!team.logoUrl && team.logoUrl !== '/placeholder.svg' && team.logoUrl.trim() !== '' && !imgFailed;

  return (
    <div className="flex items-center justify-center">
      {hasLogo ? (
        <img
          src={team.logoUrl as string}
          alt={team.name}
          className="w-10 h-10 object-contain"
          onError={() => setImgFailed(true)}
        />
      ) : (
        <span className="text-sm font-bold text-muted-foreground">{team.abbrev}</span>
      )}
    </div>
  );
}

export function TrendsTable({
  awayTeam,
  homeTeam,
  rows,
}: {
  awayTeam: TeamRef;
  homeTeam: TeamRef;
  rows: TrendRowDef[];
}) {
  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <div className="grid grid-cols-[84px_1fr_84px] gap-2 px-3 py-2 bg-muted/50 border-b border-border">
        <TeamLogoHeader team={awayTeam} />
        <div />
        <TeamLogoHeader team={homeTeam} />
      </div>
      <div className="divide-y divide-border">
        {rows.map((row) => {
          const colors = getTrendColor(row.away, row.home, row.label);
          return (
            <div key={row.label} className="grid grid-cols-[84px_1fr_84px] gap-2 px-3 py-2 text-sm">
              <div className="text-center font-bold text-base" style={{ color: colors.awayColor }}>
                {row.away !== null ? row.format(row.away) : '-'}
              </div>
              <div className="font-bold text-center text-foreground">{row.label}</div>
              <div className="text-center font-bold text-base" style={{ color: colors.homeColor }}>
                {row.home !== null ? row.format(row.home) : '-'}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Shared loading / empty framing for the two trends-backed sections. */
export function TrendsSectionBody({
  loading,
  trendsAvailable,
  children,
}: {
  loading: boolean;
  trendsAvailable: boolean;
  children: React.ReactNode;
}) {
  if (loading) {
    return (
      <div className="space-y-2">
        <SkeletonBlock height={34} />
        <SkeletonBlock height={34} />
        <SkeletonBlock height={34} />
      </div>
    );
  }

  if (!trendsAvailable) {
    return (
      <p className="text-sm text-muted-foreground text-center py-3">
        Team trend data not available for this matchup
      </p>
    );
  }

  return <>{children}</>;
}
