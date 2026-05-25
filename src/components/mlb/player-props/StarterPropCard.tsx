import React, { useState } from 'react';
import type {
  LeagueBenchmarks,
  PitchHand,
  PitcherArsenalByHand,
  PitcherBattedBallProfile,
} from '@/types/mlb-matchups';
import type { MlbPlayerPropRow } from '@/types/mlb-player-props';
import {
  formatPropLine,
  formatPropOdds,
  marketLabel,
  pickHeadlineProp,
} from '@/utils/mlbPlayerProps';
import { PropMiniViz } from './PropMiniViz';
import { PlayerPropDetail } from './PlayerPropDetail';
import { Headshot } from '@/components/mlb/pitcher-matchups/Headshot';
import { PitcherArchetypeBadge } from '@/components/mlb/pitcher-matchups/PitcherArchetypeBadge';
import type { PitcherArchetypeProfile } from '@/utils/mlbPitcherArchetypes';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StarterPropCardProps {
  pitcherId: number;
  pitcherName: string;
  teamLabel: string;
  pitchHand: PitchHand;
  archetype: PitcherArchetypeProfile | null;
  playerProps: MlbPlayerPropRow[];
  opposingStarterName: string;
  opposingStarterHand: PitchHand;
  benchmarks: LeagueBenchmarks;
  season: number;
  gameDate: string;
  arsenal?: PitcherArsenalByHand | null;
  battedBall?: PitcherBattedBallProfile | null;
}

export function StarterPropCard({
  pitcherId,
  pitcherName,
  teamLabel,
  pitchHand,
  archetype,
  playerProps,
  opposingStarterName,
  opposingStarterHand,
  benchmarks,
  season,
  gameDate,
  arsenal,
  battedBall,
}: StarterPropCardProps) {
  const [expanded, setExpanded] = useState(false);
  const myProps = playerProps.filter(
    p => p.player_id === pitcherId && p.is_pitcher,
  );
  const kProps = myProps.filter(p => p.market === 'pitcher_strikeouts');
  const headline = pickHeadlineProp(kProps.length > 0 ? kProps : myProps);

  return (
    <div className="rounded-lg border border-border/60 bg-muted/20 p-3 space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <Headshot playerId={pitcherId} size={64} alt={pitcherName} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold">{pitcherName}</p>
          <p className="text-xs text-muted-foreground">
            {teamLabel} · {pitchHand}HP
          </p>
        </div>
        <PitcherArchetypeBadge archetype={archetype} />
      </div>

      {headline ? (
        <button
          type="button"
          onClick={() => setExpanded(e => !e)}
          className={cn(
            'w-full rounded-md border border-border/50 bg-card/40 px-2.5 py-2 text-left min-h-[44px]',
            'hover:bg-muted/40 transition-colors duration-150',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          )}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <p className="text-xs font-medium text-foreground">
                  {marketLabel(headline.row.market)}
                </p>
                <span
                  className="inline-flex items-center gap-1 rounded-full bg-primary/15 text-primary px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                  title={
                    headline.row.market === 'pitcher_strikeouts'
                      ? "Pitcher's anchor prop — strikeouts is the most-bet pitcher market."
                      : "The market with this pitcher's highest L10 over rate."
                  }
                >
                  🔥 {headline.row.market === 'pitcher_strikeouts' ? 'K Anchor' : 'Best L10'}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground tabular-nums mt-0.5">
                O {formatPropLine(headline.computed.line)} ·{' '}
                {formatPropOdds(headline.computed.overOdds)} ·{' '}
                <span className="text-primary font-semibold">
                  {headline.computed.l10.over}/{headline.computed.l10.games}
                </span>{' '}
                <span className="text-muted-foreground">last 10</span>
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <PropMiniViz strip={headline.computed.miniStrip} />
              {expanded ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
          </div>
        </button>
      ) : (
        <p className="text-xs text-muted-foreground italic">Strikeout prop not posted</p>
      )}

      {expanded && headline ? (
        <PlayerPropDetail
          playerProps={myProps}
          playerId={pitcherId}
          playerName={pitcherName}
          opposingStarterName={opposingStarterName}
          opposingStarterHand={opposingStarterHand}
          opposingArchetype={null}
          benchmarks={benchmarks}
          isPitcher
          pitcherSeason={season}
          pitcherGameDate={gameDate}
          pitcherArsenal={arsenal ?? null}
          pitcherBattedBall={battedBall ?? null}
          pitcherArchetype={archetype}
        />
      ) : null}
    </div>
  );
}
