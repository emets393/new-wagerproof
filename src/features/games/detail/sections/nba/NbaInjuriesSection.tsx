import * as React from 'react';
import { Chip, Pagination, Tooltip } from '@heroui/react';
import { AlertCircle, Stethoscope } from 'lucide-react';
import { SegmentedControl, SkeletonBlock, WidgetCard } from '@/components/ios';
import { TeamMark } from './shared';
import type { NbaInjuryReport } from './useNbaMatchupOverview';
import type { GameFeedItem, TeamRef } from '../../../types';

/**
 * NBA injury report, led by the answer the card exists to give: which side is
 * missing more production.
 *
 * Impact = sum of -PIE across a team's injured players, so a more negative
 * number means more production sidelined. The two teams used to sit in separate
 * bordered tables with a third bordered box underneath holding the totals —
 * flattened here, with one team's list on screen at a time so long reports
 * paginate instead of stretching the card (rules 3, 8, 9).
 */

/** Rows on screen at once, and the reserved height so paging can't move the pager. */
const ROWS_PER_PAGE = 4;

const toPie = (pie: string | number | null | undefined): number | null => {
  if (pie === null || pie === undefined) return null;
  const value = typeof pie === 'string' ? parseFloat(pie) : pie;
  return Number.isNaN(value) ? null : value;
};

const calculateInjuryImpact = (injuries: NbaInjuryReport[]): number =>
  injuries.reduce((sum, injury) => {
    const pie = toPie(injury.avg_pie_season);
    return sum + (pie === null ? 0 : -pie);
  }, 0);

const sortByPIE = (injuries: NbaInjuryReport[]): NbaInjuryReport[] =>
  [...injuries].sort((a, b) => (toPie(b.avg_pie_season) ?? -Infinity) - (toPie(a.avg_pie_season) ?? -Infinity));

/** Status text is free-form from the feed, so match on substrings. */
function statusTone(status: string): 'danger' | 'warning' | 'default' {
  const s = (status || '').toLowerCase();
  if (s.includes('out') || s.includes('suspend')) return 'danger';
  if (s.includes('doubtful') || s.includes('question') || s.includes('day')) return 'warning';
  return 'default';
}

/**
 * Which team is more depleted, as a bar diverging from an even center line.
 * Two impact totals side by side left the reader to work out both which number
 * was worse and whether the gap mattered.
 */
function ImpactCompare({
  awayTeam,
  homeTeam,
  awayImpact,
  homeImpact,
  awayCount,
  homeCount,
}: {
  awayTeam: TeamRef;
  homeTeam: TeamRef;
  awayImpact: number;
  homeImpact: number;
  awayCount: number;
  homeCount: number;
}) {
  // More negative = more production missing. The bar points at the hurt side.
  const awayWorse = awayImpact < homeImpact;
  const even = awayImpact === homeImpact;
  const gap = Math.abs(awayImpact - homeImpact);
  // A 0.20 PIE swing is roughly a starter's worth of production — enough to pin.
  const magnitude = Math.min(gap / 0.2, 1) * 50;
  const hurtTeam = awayWorse ? awayTeam : homeTeam;

  return (
    <div className="pb-3">
      <div className="flex items-baseline justify-between gap-2">
        <span className="flex items-center gap-1.5">
          <TeamMark team={awayTeam} size={28} dimmed={!even && !awayWorse} />
          <span className="text-[13px] font-bold tabular-nums text-foreground">
            {awayImpact.toFixed(2)}
          </span>
          <span className="text-[10px] text-muted-foreground">({awayCount})</span>
        </span>
        <span className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground/70">
          Production missing
        </span>
        <span className="flex items-center gap-1.5">
          <span className="text-[10px] text-muted-foreground">({homeCount})</span>
          <span className="text-[13px] font-bold tabular-nums text-foreground">
            {homeImpact.toFixed(2)}
          </span>
          <TeamMark team={homeTeam} size={28} dimmed={!even && awayWorse} />
        </span>
      </div>

      <div className="relative mt-1 h-2 w-full overflow-hidden rounded-sm bg-muted/60">
        <span className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-muted-foreground/30" />
        {!even && (
          <span
            className="absolute inset-y-0 rounded-sm bg-red-500/80"
            style={
              awayWorse
                ? { right: '50%', width: `${magnitude}%` }
                : { left: '50%', width: `${magnitude}%` }
            }
          />
        )}
      </div>

      <p className="mt-1.5 text-[11px] text-muted-foreground">
        {even ? (
          'Both teams are missing about the same amount of production.'
        ) : (
          <>
            <span className="font-bold text-foreground">{hurtTeam.abbrev}</span> is missing more
            production — a {gap.toFixed(2)} PIE gap between the two injury lists.
          </>
        )}
      </p>
    </div>
  );
}

function InjuryList({ injuries, accentColor }: { injuries: NbaInjuryReport[]; accentColor: string }) {
  const [page, setPage] = React.useState(1);

  const sorted = React.useMemo(() => sortByPIE(injuries), [injuries]);
  const maxPie = React.useMemo(
    () => Math.max(...sorted.map((i) => toPie(i.avg_pie_season) ?? 0), 0.0001),
    [sorted],
  );

  if (sorted.length === 0) {
    return (
      <p className="py-4 text-center text-[12px] text-muted-foreground">No injuries reported</p>
    );
  }

  const pageCount = Math.max(1, Math.ceil(sorted.length / ROWS_PER_PAGE));
  const activePage = Math.min(page, pageCount);
  const visible = sorted.slice((activePage - 1) * ROWS_PER_PAGE, activePage * ROWS_PER_PAGE);

  return (
    <div className="flex flex-col gap-2">
      <div className="divide-y divide-black/5 dark:divide-white/10">
        {visible.map((injury, index) => {
          const pie = toPie(injury.avg_pie_season);
          return (
            <div
              key={`${injury.player_name}-${(activePage - 1) * ROWS_PER_PAGE + index}`}
              className="flex h-9 items-center gap-2"
            >
              <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-foreground">
                {injury.player_name}
              </span>
              <Chip
                size="sm"
                variant="flat"
                color={statusTone(injury.status)}
                classNames={{ base: 'h-5', content: 'px-1.5 text-[9px] font-bold uppercase' }}
              >
                {injury.status}
              </Chip>
              <Tooltip
                content="Player Impact Estimate — share of the game's total production this player accounts for"
                size="sm"
                delay={300}
              >
                <span className="flex shrink-0 items-center gap-1.5">
                  <span className="relative h-1.5 w-12 overflow-hidden rounded-full bg-muted">
                    <span
                      className="absolute inset-y-0 left-0 rounded-full"
                      style={{
                        width: `${Math.max(0, Math.min((pie ?? 0) / maxPie, 1)) * 100}%`,
                        backgroundColor: accentColor,
                      }}
                    />
                  </span>
                  <span className="w-9 text-right text-[10px] tabular-nums text-muted-foreground">
                    {pie === null ? 'N/A' : pie.toFixed(3)}
                  </span>
                </span>
              </Tooltip>
            </div>
          );
        })}
        {/* Hold the full window height on a short last page so the pager stays put. */}
        {Array.from({ length: ROWS_PER_PAGE - visible.length }).map((_, i) => (
          <div key={`pad-${i}`} className="h-9" aria-hidden />
        ))}
      </div>

      {pageCount > 1 && (
        <div className="flex justify-center">
          <Pagination
            total={pageCount}
            page={activePage}
            onChange={setPage}
            size="sm"
            radius="md"
            variant="light"
            showControls
            aria-label="Injury report pages"
          />
        </div>
      )}
    </div>
  );
}

export function NbaInjuriesSection({
  game,
  injuries,
  loading,
  error,
}: {
  game: GameFeedItem;
  injuries: NbaInjuryReport[];
  loading: boolean;
  error: string | null;
}) {
  const [side, setSide] = React.useState<'away' | 'home'>('away');

  const raw = game.raw as Record<string, unknown>;
  const awayTeamName = (raw.away_team as string) || game.awayTeam.name;
  const homeTeamName = (raw.home_team as string) || game.homeTeam.name;

  // Case-insensitive exact team_name match, as in the source modal.
  const matches = (name: string) => (injury: NbaInjuryReport) =>
    Boolean(name && injury.team_name) && injury.team_name.toLowerCase() === name.toLowerCase();

  const awayInjuries = injuries.filter(matches(awayTeamName));
  const homeInjuries = injuries.filter(matches(homeTeamName));

  const awayImpact = calculateInjuryImpact(awayInjuries);
  const homeImpact = calculateInjuryImpact(homeInjuries);

  const anyInjuries = awayInjuries.length > 0 || homeInjuries.length > 0;
  const activeTeam = side === 'away' ? game.awayTeam : game.homeTeam;
  const activeInjuries = side === 'away' ? awayInjuries : homeInjuries;

  return (
    <WidgetCard
      icon={<Stethoscope />}
      title="Injuries"
      subtitle="Who's unavailable for each side, and how much of their team's production is sitting out."
      className="@xl:col-span-2"
      accessory={
        !loading && anyInjuries ? (
          <SegmentedControl
            size="sm"
            options={[
              { value: 'away', label: `${game.awayTeam.abbrev} (${awayInjuries.length})` },
              { value: 'home', label: `${game.homeTeam.abbrev} (${homeInjuries.length})` },
            ]}
            value={side}
            // Wrapped: passing setSide directly collapses the generic to `string`.
            onChange={(value) => setSide(value as 'away' | 'home')}
          />
        ) : undefined
      }
    >
      {error && (
        <p className="mb-2 flex items-center gap-1.5 text-[11px] text-red-600 dark:text-red-300">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          {error}
        </p>
      )}

      {loading ? (
        <div className="space-y-2">
          <SkeletonBlock height={28} />
          <SkeletonBlock height={36} />
          <SkeletonBlock height={36} />
        </div>
      ) : anyInjuries ? (
        <div className="divide-y divide-black/5 dark:divide-white/10">
          <ImpactCompare
            awayTeam={game.awayTeam}
            homeTeam={game.homeTeam}
            awayImpact={awayImpact}
            homeImpact={homeImpact}
            awayCount={awayInjuries.length}
            homeCount={homeInjuries.length}
          />
          <div className="pt-2">
            {/* Keyed by side so switching teams resets the pager — page 3 of a
                long list would otherwise land on an empty page of a short one. */}
            <InjuryList
              key={side}
              injuries={activeInjuries}
              accentColor={activeTeam.colors.primary}
            />
          </div>
        </div>
      ) : (
        <p className="py-3 text-center text-[12px] text-muted-foreground">
          No injuries reported for either team.
        </p>
      )}
    </WidgetCard>
  );
}
