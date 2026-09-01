import * as React from 'react';
import { ArrowDown, ArrowUp, Zap } from 'lucide-react';
import { EdgePill } from '@/components/ios';
import { cn } from '@/lib/utils';
import type { GameEdges, TeamRef } from '../types';

function MiniTeamLogo({ team, size = 14 }: { team: TeamRef; size?: number }) {
  const [failed, setFailed] = React.useState(false);
  React.useEffect(() => setFailed(false), [team.logoUrl]);

  const showLogo = Boolean(team.logoUrl) && !failed;

  return (
    <span
      aria-hidden
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-full"
      style={{
        width: size,
        height: size,
        background: showLogo ? 'hsl(var(--background))' : team.colors.primary,
      }}
    >
      {showLogo ? (
        <img
          src={team.logoUrl as string}
          alt=""
          className="h-full w-full object-contain p-px"
          onError={() => setFailed(true)}
        />
      ) : (
        <span className="text-[7px] font-bold leading-none text-white">
          {team.abbrev.slice(0, 3)}
        </span>
      )}
    </span>
  );
}

/**
 * Model projection chips under the matchup on GameListCard.
 * SPREAD + O/U only (owner rule 2026-08-24: no ML pill) — spread shows the
 * favored team's logo; totals use ↑ green / ↓ red.
 * NFL/CFB also surface slate signal count from slate flags_* / n_flags_* (hidden at 0).
 */
export function ProjectionPills({
  edges,
  awayTeam,
  homeTeam,
  signalCount = 0,
  className,
}: {
  edges: GameEdges;
  awayTeam: TeamRef;
  homeTeam: TeamRef;
  /** Unique non-blanket slate signals for this game (`flags_*` / `n_flags_*`). */
  signalCount?: number;
  className?: string;
}) {
  // Positive home_spread_diff = value on home (see NflPredictionsSection / getEdgeInfo).
  const spreadTeam =
    edges.spreadEdge === null || edges.spreadEdge === 0
      ? null
      : edges.spreadEdge > 0
        ? homeTeam
        : awayTeam;

  // Positive total edge = Over (GameEdges contract).
  const totalLean =
    edges.totalEdge === null || edges.totalEdge === 0
      ? null
      : edges.totalEdge > 0
        ? 'over'
        : 'under';

  const showSignals = signalCount > 0;
  if (!spreadTeam && !totalLean && !showSignals) return null;

  return (
    <div className={cn('flex min-w-0 flex-1 flex-wrap items-center gap-1', className)}>
      {spreadTeam && edges.spreadEdge !== null && (
        <EdgePill
          className="px-2 py-0.5 text-[10px]"
          text="SPR"
          magnitude={Math.abs(edges.spreadEdge)}
          icon={<MiniTeamLogo team={spreadTeam} />}
          title={`Favors ${spreadTeam.name}`}
          aria-label={`Spread favors ${spreadTeam.name}`}
        />
      )}
      {totalLean && edges.totalEdge !== null && (
        <EdgePill
          className="px-2 py-0.5 text-[10px]"
          text="O/U"
          magnitude={Math.abs(edges.totalEdge)}
          tone={totalLean}
          icon={
            totalLean === 'over' ? (
              <ArrowUp className="h-3 w-3 shrink-0" strokeWidth={2.75} aria-hidden />
            ) : (
              <ArrowDown className="h-3 w-3 shrink-0" strokeWidth={2.75} aria-hidden />
            )
          }
          title={totalLean === 'over' ? 'Favors Over' : 'Favors Under'}
          aria-label={totalLean === 'over' ? 'Favors Over' : 'Favors Under'}
        />
      )}
      {showSignals && (
        <span
          className="inline-flex items-center gap-1 rounded-md border border-amber-500/40 bg-amber-500/20 px-2 py-0.5 text-[11px] font-extrabold tracking-tight text-amber-700 dark:border-amber-400/50 dark:bg-amber-400/20 dark:text-amber-300"
          title={`${signalCount} signal${signalCount === 1 ? '' : 's'}`}
          aria-label={`${signalCount} signal${signalCount === 1 ? '' : 's'}`}
        >
          <Zap className="h-3.5 w-3.5 shrink-0 fill-current" aria-hidden />
          {signalCount} Signal{signalCount === 1 ? '' : 's'}
        </span>
      )}
    </div>
  );
}
