import React, { useMemo } from 'react';
import type { TopPlayEntry, TopPlays } from '@/types/mlb-matchups';
import {
  ARCHETYPE_FILTER_OPTIONS,
  ARCHETYPE_META,
  type DisplayPitcherArchetype,
} from '@/utils/mlbPitcherArchetypes';
import { TopPlayColumn } from './TopPlayColumn';
import { cn } from '@/lib/utils';

interface TopPlaysHeaderProps {
  topPlays: TopPlays;
  onSelectPlay: (entry: TopPlayEntry) => void;
  archetypeFilter: DisplayPitcherArchetype | null;
  onArchetypeFilterChange: (archetype: DisplayPitcherArchetype | null) => void;
}

function filterByArchetype(
  entries: TopPlayEntry[],
  archetype: DisplayPitcherArchetype | null,
): TopPlayEntry[] {
  if (!archetype) return entries;
  return entries.filter(e => e.opposing_pitcher_archetype === archetype);
}

export function TopPlaysHeader({
  topPlays,
  onSelectPlay,
  archetypeFilter,
  onArchetypeFilterChange,
}: TopPlaysHeaderProps) {
  const hrThreats = useMemo(
    () => filterByArchetype(topPlays.hr_threats, archetypeFilter),
    [topPlays.hr_threats, archetypeFilter],
  );
  const hitLeans = useMemo(
    () => filterByArchetype(topPlays.hit_leans, archetypeFilter),
    [topPlays.hit_leans, archetypeFilter],
  );

  const hasAny =
    topPlays.hr_threats.length > 0 ||
    topPlays.hit_leans.length > 0 ||
    topPlays.pitcher_plays.length > 0 ||
    topPlays.k_props.length > 0 ||
    topPlays.hottest_hitters.length > 0;

  if (!hasAny) return null;

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-bold text-foreground">Best plays today</h2>
        <p className="text-xs text-muted-foreground">
          Matchup scores (50+) and hottest hitters (60+ L10 heat). Click a name to jump to that game.
        </p>
      </div>

      <div className="space-y-1.5">
        <p className="text-xs text-muted-foreground">
          Filter HR threats &amp; hit leans by opposing pitcher archetype:
        </p>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => onArchetypeFilterChange(null)}
            className={cn(
              'rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors',
              archetypeFilter == null
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border bg-muted/40 text-muted-foreground hover:bg-muted',
            )}
          >
            All
          </button>
          {ARCHETYPE_FILTER_OPTIONS.map(arch => {
            const meta = ARCHETYPE_META[arch];
            return (
              <button
                key={arch}
                type="button"
                onClick={() =>
                  onArchetypeFilterChange(archetypeFilter === arch ? null : arch)
                }
                className={cn(
                  'rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors',
                  archetypeFilter === arch
                    ? meta.color
                    : 'border-border bg-muted/40 text-muted-foreground hover:bg-muted',
                )}
              >
                {meta.icon} {arch}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
        <TopPlayColumn
          title="Hottest hitters"
          emoji="🔥"
          entries={topPlays.hottest_hitters}
          onSelect={onSelectPlay}
          scoreLabel="Hotness"
        />
        <TopPlayColumn
          title="HR threats"
          emoji="💣"
          entries={hrThreats}
          onSelect={onSelectPlay}
          scoreLabel="HR Threat"
        />
        <TopPlayColumn
          title="Hit leans"
          emoji="🎯"
          entries={hitLeans}
          onSelect={onSelectPlay}
          scoreLabel="Hit Lean"
        />
        <TopPlayColumn
          title="Pitcher plays"
          emoji="🥊"
          entries={topPlays.pitcher_plays}
          onSelect={onSelectPlay}
        />
        <TopPlayColumn
          title="K props"
          emoji="⚡"
          entries={topPlays.k_props}
          onSelect={onSelectPlay}
        />
      </div>
    </section>
  );
}
