import React, { useMemo } from 'react';
import type { ParkHRFactors } from '@/hooks/usePark';
import type {
  LineupRow,
  PitcherArsenalByHand,
  PitcherBattedBallProfile,
  PitchHand,
  BatterSplitRow,
  BatterVsPitchTypeRow,
  MatchupGame,
} from '@/types/mlb-matchups';
import { dominantEffectiveLineupHand, parkFavorsHand, parkSuppressesHr } from '@/utils/parkHr';
import { Headshot } from './Headshot';
import { InsightChips } from './InsightChips';
import { generatePitcherInsights, type PitcherContext } from './insightEngine';
import { arsenalForDisplay, defaultArsenalTab } from '@/utils/mlbArsenal';
import { abbrevPitchLabel, dominantLineupHand, formatPct, formatRate } from '@/utils/mlbPitcherMatchups';

interface PitcherSummaryPanelProps {
  teamLabel: string;
  pitcherName: string;
  pitcherId: number;
  pitchHand: PitchHand;
  arsenal: PitcherArsenalByHand;
  battedBall: PitcherBattedBallProfile;
  opposingLineup: LineupRow[];
  opposingSplits: BatterSplitRow[];
  opposingVsPitch: BatterVsPitchTypeRow[];
  game: MatchupGame;
  park: ParkHRFactors | null;
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
  park,
}: PitcherSummaryPanelProps) {
  const displayArsenal = useMemo(
    () => arsenalForDisplay(arsenal, opposingLineup, pitchHand),
    [arsenal, opposingLineup, pitchHand],
  );

  const topPitches = useMemo(
    () =>
      [...displayArsenal]
        .filter(p => (p.pitches_thrown ?? 0) >= 25)
        .sort((a, b) => (b.usage_pct ?? 0) - (a.usage_pct ?? 0))
        .slice(0, 3),
    [displayArsenal],
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
  const arsenalTab = defaultArsenalTab(opposingLineup, pitchHand);
  const tabLabel = arsenalTab === 'R' ? 'vs RHB' : arsenalTab === 'L' ? 'vs LHB' : 'overall';

  const parkContextLine = useMemo(() => {
    if (!park || !overall) return null;
    const oppEffHand = dominantEffectiveLineupHand(opposingLineup, pitchHand);
    const fbHeavy = (overall.fb_pct ?? 0) >= 35;
    const gbHeavy = (overall.gb_pct ?? 0) >= 50;

    if (fbHeavy && parkFavorsHand(park, oppEffHand)) {
      return {
        tone: 'warn' as const,
        text: '⚠️ FB pitcher at HR-friendly park — bombs possible',
      };
    }
    if (gbHeavy && parkSuppressesHr(park)) {
      return {
        tone: 'positive' as const,
        text: "✓ GB pitcher at pitcher's park — UNDER lean",
      };
    }
    return null;
  }, [park, overall, opposingLineup, pitchHand]);

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
              {formatRate(overall.xwoba_allowed)} xwOBA allowed · {formatPct(overall.k_pct)} K ·{' '}
              {formatPct(overall.bb_pct)} BB · {formatPct(overall.hr_per_fb_pct)} HR/FB
            </p>
          ) : (
            <p>Season batted-ball profile loading…</p>
          )}
        </div>
      </div>
      {topPitches.length > 0 ? (
        <div>
          <p className="text-xs font-semibold text-muted-foreground mb-1">
            Top three pitches ({tabLabel})
          </p>
          <ul className="text-xs sm:text-sm space-y-0.5">
            {topPitches.map(p => (
              <li key={p.pitch_type}>
                • {abbrevPitchLabel(p.pitch_type, p.pitch_type_label)}{' '}
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
          Batted-ball profile: GB {formatPct(overall.gb_pct)} · FB {formatPct(overall.fb_pct)} · LD{' '}
          {formatPct(overall.ld_pct)} · HR/FB {formatPct(overall.hr_per_fb_pct)}
        </p>
      ) : null}
      {vsHandRow?.xwoba_allowed != null ? (
        <p className="text-xs sm:text-sm text-foreground">
          vs {handLabel} batters: {formatRate(vsHandRow.xwoba_allowed)} xwOBA allowed
        </p>
      ) : null}
      {parkContextLine ? (
        <p
          className={
            parkContextLine.tone === 'warn'
              ? 'text-xs sm:text-sm text-red-600 dark:text-red-400 font-medium leading-snug'
              : 'text-xs sm:text-sm text-emerald-600 dark:text-emerald-400 font-medium leading-snug'
          }
        >
          {parkContextLine.text}
        </p>
      ) : null}
    </div>
  );
}
