import React, { useMemo } from 'react';
import type { ParkHRFactors } from '@/hooks/usePark';
import type {
  LineupRow,
  PitcherArchetypeProfile,
  PitcherArsenalByHand,
  PitcherBattedBallProfile,
  PitcherBattedBallRow,
  PitchHand,
  BatterSplitRow,
  BatterVsPitchTypeRow,
  MatchupGame,
} from '@/types/mlb-matchups';
import { PitcherArchetypeBadge } from './PitcherArchetypeBadge';
import { dominantEffectiveLineupHand, parkFavorsHand, parkSuppressesHr } from '@/utils/parkHr';
import { Headshot } from './Headshot';
import { InsightChips } from './InsightChips';
import { generatePitcherInsights, type PitcherContext } from './insightEngine';
import { arsenalForDisplay, defaultArsenalTab } from '@/utils/mlbArsenal';
import {
  abbrevPitchLabel,
  dominantLineupHand,
  formatPct,
  formatRate,
  hasPitcherBattedBallRow,
  pitcherXwobaAllowed,
  toMilliRate,
} from '@/utils/mlbPitcherMatchups';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

const MIN_BF_WARNING = 30;
const MIN_BF_ARSENAL = 10;

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
  profileLoading?: boolean;
  archetype?: PitcherArchetypeProfile | null;
}

function HandSplitLine({
  label,
  vsR,
  vsL,
  highlightHand,
  formatValue,
  showBf = true,
}: {
  label: string;
  vsR: PitcherBattedBallRow | null;
  vsL: PitcherBattedBallRow | null;
  highlightHand: 'R' | 'L' | null;
  formatValue: (row: PitcherBattedBallRow | null) => string;
  showBf?: boolean;
}) {
  const rText = formatValue(vsR);
  const lText = formatValue(vsL);

  return (
    <Tooltip>
      <TooltipTrigger asChild touchTapMode="toggle">
        <div className="text-xs flex flex-wrap gap-x-3 gap-y-0.5 text-muted-foreground cursor-help touch-manipulation">
          <span
            className={cn(highlightHand === 'R' && 'font-semibold text-foreground')}
          >
            {label} RHB: {rText}
            {showBf && vsR ? ` (${vsR.batters_faced} BF)` : ''}
          </span>
          <span
            className={cn(highlightHand === 'L' && 'font-semibold text-foreground')}
          >
            vs LHB: {lText}
            {showBf && vsL ? ` (${vsL.batters_faced} BF)` : ''}
          </span>
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs text-xs leading-relaxed">
        Split shows this pitcher&apos;s performance against that hand of batter. Bold =
        matches tonight&apos;s opposing lineup composition.
      </TooltipContent>
    </Tooltip>
  );
}

function SplitStatRow({
  statLabel,
  vsR,
  vsL,
  highlightHand,
  formatOverall,
  formatSplit,
  limitedSample,
}: {
  statLabel: string;
  vsR: PitcherBattedBallRow | null;
  vsL: PitcherBattedBallRow | null;
  highlightHand: 'R' | 'L' | null;
  formatOverall: string;
  formatSplit: (row: PitcherBattedBallRow | null) => string;
  limitedSample: boolean;
}) {
  const asterisk = limitedSample ? '*' : '';
  return (
    <div className="space-y-0.5">
      <p className="text-xs text-muted-foreground">
        <span className="font-medium text-foreground">{statLabel}</span>{' '}
        {formatOverall}
        {asterisk}
      </p>
      <HandSplitLine
        label="vs"
        vsR={vsR}
        vsL={vsL}
        highlightHand={highlightHand}
        formatValue={formatSplit}
        showBf={false}
      />
    </div>
  );
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
  profileLoading = false,
  archetype = null,
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
  const vsR = battedBall.vs_R;
  const vsL = battedBall.vs_L;
  const hasProfile = hasPitcherBattedBallRow(overall);
  const overallBf = overall?.batters_faced ?? 0;
  const limitedSample = hasProfile && overallBf < MIN_BF_WARNING;
  const hideArsenal = hasProfile && overallBf < MIN_BF_ARSENAL;
  const highlightHand = dominantLineupHand(opposingLineup, pitchHand);
  const overallXwoba = pitcherXwobaAllowed(overall);
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

  const statAsterisk = limitedSample ? '*' : '';

  return (
    <div className="rounded-lg border border-border bg-card/50 p-3 sm:p-4 space-y-3 min-w-0">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-bold text-foreground">
          {teamLabel} · {pitcherName} ({pitchHand === 'R' ? 'Right' : 'Left'}-handed)
        </p>
        <PitcherArchetypeBadge archetype={archetype} />
      </div>

      {limitedSample ? (
        <Alert className="border-amber-500/40 bg-amber-500/10">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-sm">
            <strong>Limited 2026 sample ({overallBf} batters faced)</strong> — stats below may
            not reflect this pitcher&apos;s true ability. Consider career data or recent form
            before betting.
          </AlertDescription>
        </Alert>
      ) : null}

      <div
        className={cn(
          'flex gap-3 items-start',
          limitedSample && 'opacity-60',
        )}
      >
        <Headshot playerId={pitcherId} size={60} alt={pitcherName} />
        <TooltipProvider delayDuration={200}>
          <div className="text-xs sm:text-sm text-muted-foreground space-y-2 min-w-0 flex-1">
            {profileLoading && !hasProfile ? (
              <p>Season batted-ball profile loading…</p>
            ) : hasProfile ? (
              <>
                <div className="text-sm space-y-1 text-foreground">
                  <div>
                    {overallXwoba != null ? (
                      <>
                        <strong>{formatRate(overallXwoba)}</strong> xwOBA allowed (overall)
                        {statAsterisk}
                      </>
                    ) : (
                      <strong>Batted-ball profile (overall)</strong>
                    )}
                    <span className="text-xs text-muted-foreground ml-2">
                      · {formatPct(overall!.k_pct)}
                      {statAsterisk} K · {formatPct(overall!.bb_pct)}
                      {statAsterisk} BB · {formatPct(overall!.hr_per_fb_pct)}
                      {statAsterisk} HR/FB
                    </span>
                  </div>
                  <HandSplitLine
                    label="vs"
                    vsR={vsR}
                    vsL={vsL}
                    highlightHand={highlightHand}
                    formatValue={row => toMilliRate(pitcherXwobaAllowed(row))}
                  />
                </div>

                <SplitStatRow
                  statLabel="K%"
                  vsR={vsR}
                  vsL={vsL}
                  highlightHand={highlightHand}
                  formatOverall={formatPct(overall!.k_pct)}
                  formatSplit={row => formatPct(row?.k_pct)}
                  limitedSample={limitedSample}
                />
                <SplitStatRow
                  statLabel="BB%"
                  vsR={vsR}
                  vsL={vsL}
                  highlightHand={highlightHand}
                  formatOverall={formatPct(overall!.bb_pct)}
                  formatSplit={row => formatPct(row?.bb_pct)}
                  limitedSample={limitedSample}
                />
                <SplitStatRow
                  statLabel="GB%"
                  vsR={vsR}
                  vsL={vsL}
                  highlightHand={highlightHand}
                  formatOverall={formatPct(overall!.gb_pct)}
                  formatSplit={row => formatPct(row?.gb_pct)}
                  limitedSample={limitedSample}
                />
                <SplitStatRow
                  statLabel="FB%"
                  vsR={vsR}
                  vsL={vsL}
                  highlightHand={highlightHand}
                  formatOverall={formatPct(overall!.fb_pct)}
                  formatSplit={row => formatPct(row?.fb_pct)}
                  limitedSample={limitedSample}
                />
                <SplitStatRow
                  statLabel="HR/FB%"
                  vsR={vsR}
                  vsL={vsL}
                  highlightHand={highlightHand}
                  formatOverall={formatPct(overall!.hr_per_fb_pct)}
                  formatSplit={row => formatPct(row?.hr_per_fb_pct)}
                  limitedSample={limitedSample}
                />
              </>
            ) : (
              <p className="italic">No season batted-ball profile yet</p>
            )}
          </div>
        </TooltipProvider>
      </div>

      {hideArsenal ? (
        <p className="text-xs text-muted-foreground italic">
          Not enough 2026 data to show pitch arsenal
        </p>
      ) : topPitches.length > 0 ? (
        <div className={cn(limitedSample && 'opacity-60')}>
          <p className="text-xs font-semibold text-muted-foreground mb-1">
            Top three pitches ({tabLabel})
          </p>
          <ul className="text-xs sm:text-sm space-y-0.5">
            {topPitches.map(p => (
              <li key={p.pitch_type}>
                • {abbrevPitchLabel(p.pitch_type, p.pitch_type_label)}
                {limitedSample ? '*' : ''}{' '}
                <span className="text-muted-foreground">
                  {Math.round(p.usage_pct ?? 0)}% · {p.avg_velo?.toFixed(1) ?? '—'} mph
                </span>
              </li>
            ))}
          </ul>
          <InsightChips insights={pitcherInsights} size="sm" className="mt-2" />
        </div>
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
