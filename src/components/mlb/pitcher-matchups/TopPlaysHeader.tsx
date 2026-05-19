import React from 'react';
import type { TopPlayEntry, TopPlays } from '@/types/mlb-matchups';
import { TopPlayColumn } from './TopPlayColumn';

interface TopPlaysHeaderProps {
  topPlays: TopPlays;
  onSelectPlay: (entry: TopPlayEntry) => void;
}

export function TopPlaysHeader({ topPlays, onSelectPlay }: TopPlaysHeaderProps) {
  const hasAny =
    topPlays.hr_threats.length > 0 ||
    topPlays.hit_leans.length > 0 ||
    topPlays.pitcher_plays.length > 0 ||
    topPlays.k_props.length > 0;

  if (!hasAny) return null;

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-bold text-foreground">Best plays today</h2>
        <p className="text-xs text-muted-foreground">
          Ranked by matchup model scores (50+ only). Click a name to jump to that game.
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <TopPlayColumn
          title="HR threats"
          emoji="💣"
          entries={topPlays.hr_threats}
          onSelect={onSelectPlay}
        />
        <TopPlayColumn
          title="Hit leans"
          emoji="🎯"
          entries={topPlays.hit_leans}
          onSelect={onSelectPlay}
        />
        <TopPlayColumn
          title="Pitcher plays"
          emoji="🥊"
          entries={topPlays.pitcher_plays}
          onSelect={onSelectPlay}
        />
        <TopPlayColumn title="K props" emoji="⚡" entries={topPlays.k_props} onSelect={onSelectPlay} />
      </div>
    </section>
  );
}
