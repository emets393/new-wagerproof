import React, { useEffect, useMemo, useState } from 'react';
import type { BatterSplitRow, LeagueBenchmarks, PitchHand } from '@/types/mlb-matchups';
import type { MlbPlayerPropRow } from '@/types/mlb-player-props';
import {
  buildVerdict,
  computePropAtLine,
  defaultLine,
  formatPropLine,
  formatPropOdds,
  marketLabel,
  MLB_PLAYER_PROP_VALUE_LABELS,
} from '@/utils/mlbPlayerProps';
import { RecentPropBarChart } from './RecentPropBarChart';
import { LineSelector } from './LineSelector';
import { MarketSwitcher } from './MarketSwitcher';
import { ContextTiles } from './ContextTiles';
import { SeasonStatsAccordion } from './SeasonStatsAccordion';
import { PitcherStatsAccordion } from './PitcherStatsAccordion';
import type { PitcherArchetypeProfile } from '@/utils/mlbPitcherArchetypes';
import type {
  PitcherArchetypeProfile as PitcherSeasonArchetype,
  PitcherArsenalByHand,
  PitcherBattedBallProfile,
} from '@/types/mlb-matchups';

interface PlayerPropDetailProps {
  playerProps: MlbPlayerPropRow[];
  playerId: number;
  playerName: string;
  position?: string | null;
  batSide?: string | null;
  opposingStarterName: string;
  opposingStarterHand: PitchHand;
  opposingArchetype: PitcherArchetypeProfile | null;
  split?: BatterSplitRow;
  benchmarks: LeagueBenchmarks;
  isPitcher?: boolean;
  /** Pitcher-only context (only passed from StarterPropCard). */
  pitcherSeason?: number;
  pitcherGameDate?: string;
  pitcherArsenal?: PitcherArsenalByHand | null;
  pitcherBattedBall?: PitcherBattedBallProfile | null;
  pitcherArchetype?: PitcherSeasonArchetype | null;
}

export function PlayerPropDetail({
  playerProps,
  playerId,
  position,
  batSide,
  opposingStarterName,
  opposingStarterHand,
  opposingArchetype,
  split,
  benchmarks,
  isPitcher = false,
  pitcherSeason,
  pitcherGameDate,
  pitcherArsenal,
  pitcherBattedBall,
  pitcherArchetype,
}: PlayerPropDetailProps) {
  const markets = useMemo(
    () => playerProps.filter(p => p.player_id === playerId),
    [playerProps, playerId],
  );

  const [selectedMarket, setSelectedMarket] = useState(markets[0]?.market ?? '');
  const activeRow = markets.find(m => m.market === selectedMarket) ?? markets[0];
  const [selectedLine, setSelectedLine] = useState<number | null>(
    activeRow ? defaultLine(activeRow.lines) : null,
  );

  useEffect(() => {
    if (!activeRow) return;
    setSelectedLine(defaultLine(activeRow.lines));
  }, [activeRow?.market, playerId]);

  const computed = useMemo(() => {
    if (!activeRow || selectedLine == null) return null;
    return computePropAtLine(activeRow, selectedLine);
  }, [activeRow, selectedLine]);

  if (!activeRow || !computed || selectedLine == null) {
    return (
      <p className="text-sm text-muted-foreground italic py-4">No prop markets available</p>
    );
  }

  const handLabel =
    batSide === 'L' ? 'LHB' : batSide === 'R' ? 'RHB' : batSide === 'S' ? 'Switch' : '';
  const dayNight = activeRow.game_is_day ? '☀️ Day' : '🌙 Night';
  const valueLabel = MLB_PLAYER_PROP_VALUE_LABELS[activeRow.market] ?? 'Val';
  const verdict = buildVerdict(activeRow, computed);
  const subtitleParts = [
    position,
    handLabel,
    !isPitcher ? `vs ${opposingStarterName} (${opposingStarterHand}HP)` : null,
    dayNight,
  ].filter(Boolean);

  return (
    <div className="space-y-4 pt-3 border-t border-border/60">
      {markets.length > 1 ? (
        <div
          className="space-y-1"
          title="Switch between this player's posted prop markets — Hits, RBIs, Total Bases, etc. — without leaving this card."
        >
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
            Switch market
          </p>
          <MarketSwitcher
            props={markets}
            selectedMarket={selectedMarket}
            onSelect={setSelectedMarket}
          />
        </div>
      ) : null}

      <div className="space-y-2">
        <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
          {marketLabel(activeRow.market)}
        </p>
        <div
          className="flex items-baseline gap-3 flex-wrap cursor-help"
          title={`Hit Rate = how often the player went over ${formatPropLine(selectedLine)} ${marketLabel(activeRow.market).toLowerCase()} in their last 10 games.`}
        >
          <span className="text-3xl sm:text-4xl font-extrabold tabular-nums text-primary leading-none">
            {computed.l10.pct ?? '—'}
            {computed.l10.pct != null ? <span className="text-xl">%</span> : null}
          </span>
          <span className="text-sm text-muted-foreground tabular-nums">
            Hit Rate · {computed.l10.over}/{computed.l10.games} last 10
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs tabular-nums">
          <span className="rounded-md border border-primary/40 bg-primary/10 px-2 py-1 text-foreground">
            Over {formatPropLine(selectedLine)} {marketLabel(activeRow.market).toLowerCase()}{' '}
            <span className="font-bold text-primary ml-1">{formatPropOdds(computed.overOdds)}</span>
          </span>
          <span className="rounded-md border border-border/60 bg-muted/30 px-2 py-1 text-muted-foreground">
            Under {formatPropLine(selectedLine)} {marketLabel(activeRow.market).toLowerCase()}{' '}
            <span className="font-bold text-foreground ml-1">{formatPropOdds(computed.underOdds)}</span>
          </span>
        </div>
        <p className="text-xs text-muted-foreground leading-snug">
          {subtitleParts.join(' · ')}
        </p>
      </div>

      <p className="text-sm leading-relaxed text-foreground/90">{verdict}</p>

      <RecentPropBarChart
        bars={computed.chartGames}
        line={selectedLine}
        valueLabel={valueLabel}
      />

      <LineSelector
        lines={activeRow.lines}
        selectedLine={selectedLine}
        onSelect={setSelectedLine}
      />

      <ContextTiles row={activeRow} computed={computed} />

      {!isPitcher ? (
        <SeasonStatsAccordion
          split={split}
          benchmarks={benchmarks}
          opposingStarterHand={opposingStarterHand}
        />
      ) : pitcherSeason != null && pitcherGameDate ? (
        <PitcherStatsAccordion
          pitcherId={playerId}
          season={pitcherSeason}
          gameDate={pitcherGameDate}
          arsenal={pitcherArsenal ?? null}
          battedBall={pitcherBattedBall ?? null}
          archetype={pitcherArchetype ?? null}
        />
      ) : null}
    </div>
  );
}
