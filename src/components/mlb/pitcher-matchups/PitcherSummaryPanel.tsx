import React, { useMemo } from 'react';
import type { LineupRow, PitcherArsenalRow, PitcherBattedBallProfile, PitchHand } from '@/types/mlb-matchups';
import type { BatterSplitRow, BatterVsPitchTypeRow, MatchupGame } from '@/types/mlb-matchups';
import { Headshot } from './Headshot';
import { InsightChips } from './InsightChips';
import { generatePitcherInsights, type PitcherContext } from './insightEngine';
import { dominantLineupHand, formatPct, formatRate } from '@/utils/mlbPitcherMatchups';

interface PitcherSummaryPanelProps {
  teamLabel: string;
  pitcherName: string;
  pitcherId: number;
  pitchHand: PitchHand;
  arsenal: PitcherArsenalRow[];
  battedBall: PitcherBattedBallProfile;
  opposingLineup: LineupRow[];
  opposingSplits: BatterSplitRow[];
  opposingVsPitch: BatterVsPitchTypeRow[];
  game: MatchupGame;
}

export function PitcherSummaryPanel({
  teamLabel,
  pitcherName,
  pitcherId,
  pitchHand,
  arsenal,
  battedBall,
  opposingLineup,
  opposingSplits,
  opposingVsPitch,
  game,
}: PitcherSummaryPanelProps) {
  const topPitches = useMemo(
    () =>
      [...arsenal]
        .filter(p => (p.pitches_thrown ?? 0) >= 25)
        .sort((a, b) => (b.usage_pct ?? 0) - (a.usage_pct ?? 0))
        .slice(0, 3),
    [arsenal],
  );

  const pitcherInsights = useMemo(() => {
    const ctx: PitcherContext = {
      pitcherId,
      pitcherName,
      pitchHand,
      arsenal,
      battedBall,
      opposingLineup,
      opposingSplits,
      opposingVsPitch,
      game,
    };
    return generatePitcherInsights(ctx);
  }, [pitcherId, pitcherName, pitchHand, arsenal, battedBall, opposingLineup, opposingSplits, opposingVsPitch, game]);

  const overall = battedBall.overall;
  const oppHand = dominantLineupHand(opposingLineup);
  const vsHandRow = oppHand === 'L' ? battedBall.vs_L : battedBall.vs_R;
  const handLabel = oppHand === 'L' ? 'left-handed' : 'right-handed';

  return (
    <div className="rounded-lg border border-border bg-card/50 p-3 sm:p-4 space-y-3 min-w-0">
      <p className="text-sm font-bold text-foreground">
        {teamLabel} · {pitcherName} ({pitchHand === 'R' ? 'Right' : 'Left'}-handed)
      </p>
      <div className="flex gap-3 items-start">
        <Headshot playerId={pitcherId} size={60} alt={pitcherName} />
        <div className="text-xs sm:text-sm text-muted-foreground space-y-0.5 min-w-0">
          {overall?.xwoba_allowed != null ? (
            <p>
              {formatRate(overall.xwoba_allowed)} expected weighted on-base average allowed ·{' '}
              {formatPct(overall.k_pct)} strikeouts · {formatPct(overall.bb_pct)} walks
            </p>
          ) : (
            <p>Season batted-ball profile loading…</p>
          )}
        </div>
      </div>
      {topPitches.length > 0 ? (
        <div>
          <p className="text-xs font-semibold text-muted-foreground mb-1">Top three pitches</p>
          <ul className="text-xs sm:text-sm space-y-0.5">
            {topPitches.map(p => (
              <li key={p.pitch_type}>
                • {p.pitch_type_label}{' '}
                <span className="text-muted-foreground">
                  {Math.round(p.usage_pct ?? 0)}% · {p.avg_velo?.toFixed(1) ?? '—'} mph
                </span>
              </li>
            ))}
          </ul>
          <InsightChips insights={pitcherInsights} size="sm" className="mt-2" />
        </div>
      ) : null}
      {overall ? (
        <p className="text-xs sm:text-sm text-muted-foreground leading-snug">
          Batted-ball profile vs all batters: GB {formatPct(overall.gb_pct)} · FB{' '}
          {formatPct(overall.fb_pct)} · LD {formatPct(overall.ld_pct)} · HR/FB{' '}
          {formatPct(overall.hr_per_fb_pct)}
        </p>
      ) : null}
      {vsHandRow?.xwoba_allowed != null ? (
        <p className="text-xs sm:text-sm text-foreground">
          vs {handLabel} batters: {formatRate(vsHandRow.xwoba_allowed)} expected weighted on-base average
        </p>
      ) : null}
    </div>
  );
}
