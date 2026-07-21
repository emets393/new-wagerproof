import { Chip } from '@heroui/react';
import { ArrowDown, ArrowUp } from 'lucide-react';
import React from 'react';
import { CheckCircle2, XCircle, HelpCircle, Zap } from 'lucide-react';
import { useMLBRegressionReport, type SuggestedPick } from '@/hooks/useMLBRegressionReport';
import { useMLBBucketAccuracy } from '@/hooks/useMLBBucketAccuracy';

// Mirrors wagerproof-mobile/components/mlb/MLBRegressionPicksSection.tsx. Filters
// today's suggested_picks by game_pk and renders the 0-4 picks that apply to the
// current card, annotated with whether each aligns with or contradicts the
// model's own pick for that bet type.

type Alignment = 'aligns' | 'contradicts' | 'unknown';

export interface MLBRegressionPicksForGameProps {
  gamePk: number | null | undefined;
  homeAbbrev: string;
  awayAbbrev: string;
  homeTeamName?: string | null;
  awayTeamName?: string | null;
  /** Model's full-game ML pick side (derived from edge_pct). */
  fullMlPickIsHome: boolean | null;
  /** Model's F5 ML pick side. */
  f5MlPickIsHome: boolean | null;
  /** Model's full-game total direction. */
  fullOuDir: 'OVER' | 'UNDER' | null;
  /** Model's F5 total direction. */
  f5OuDir: 'OVER' | 'UNDER' | null;
}

const BET_TYPE_LABEL: Record<SuggestedPick['bet_type'], string> = {
  full_ml: 'Full Game · Moneyline',
  full_ou: 'Full Game · Total',
  full_rl: 'Full Game · Run Line',
  f5_ml: '1st 5 · Moneyline',
  f5_ou: '1st 5 · Total',
  f5_rl: '1st 5 · Run Line',
};

/**
 * Picks arrive as plain strings ("UNDER 8.5"). Split the direction word out so
 * it can carry the same color + arrow language totals use everywhere else —
 * over/under is the one thing you must not misread on a total.
 */
function PickText({ pick }: { pick: string }) {
  const match = /^(OVER|UNDER)\b\s*(.*)$/i.exec(pick.trim());
  if (!match) return <>{pick}</>;
  const isOver = match[1].toUpperCase() === 'OVER';
  return (
    <span className="flex items-center gap-1">
      <span
        className={
          isOver
            ? 'flex items-center gap-0.5 text-emerald-600 dark:text-emerald-300'
            : 'flex items-center gap-0.5 text-blue-600 dark:text-blue-300'
        }
      >
        {isOver ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
        {match[1].toUpperCase()}
      </span>
      {match[2] && <span>{match[2]}</span>}
    </span>
  );
}

function findPickedSide(
  pickText: string,
  homeAbbrev: string,
  awayAbbrev: string,
  homeTeamName?: string | null,
  awayTeamName?: string | null,
): 'home' | 'away' | null {
  const hay = pickText.toLowerCase();
  const candidates: Array<{ side: 'home' | 'away'; needle: string }> = [];
  if (homeTeamName) candidates.push({ side: 'home', needle: homeTeamName.toLowerCase() });
  if (homeAbbrev) candidates.push({ side: 'home', needle: homeAbbrev.toLowerCase() });
  if (awayTeamName) candidates.push({ side: 'away', needle: awayTeamName.toLowerCase() });
  if (awayAbbrev) candidates.push({ side: 'away', needle: awayAbbrev.toLowerCase() });
  // Longest-needle match wins so "Red Sox" beats a stray "Red" substring.
  candidates.sort((a, b) => b.needle.length - a.needle.length);
  for (const { side, needle } of candidates) {
    if (needle && hay.includes(needle)) return side;
  }
  return null;
}

function computeAlignment(
  pick: SuggestedPick,
  props: MLBRegressionPicksForGameProps,
): Alignment {
  if (pick.bet_type === 'full_ml' || pick.bet_type === 'f5_ml') {
    const pickedSide = findPickedSide(pick.pick, props.homeAbbrev, props.awayAbbrev, props.homeTeamName, props.awayTeamName);
    const modelIsHome = pick.bet_type === 'full_ml' ? props.fullMlPickIsHome : props.f5MlPickIsHome;
    if (!pickedSide || modelIsHome === null) return 'unknown';
    const modelSide = modelIsHome ? 'home' : 'away';
    return pickedSide === modelSide ? 'aligns' : 'contradicts';
  }
  if (pick.bet_type === 'full_ou' || pick.bet_type === 'f5_ou') {
    const hay = pick.pick.toLowerCase();
    const isOver = hay.includes('over');
    const isUnder = hay.includes('under');
    if (!isOver && !isUnder) return 'unknown';
    const modelDir = pick.bet_type === 'full_ou' ? props.fullOuDir : props.f5OuDir;
    if (!modelDir) return 'unknown';
    const pickDir = isOver ? 'OVER' : 'UNDER';
    return pickDir === modelDir ? 'aligns' : 'contradicts';
  }
  return 'unknown';
}

function winColor(pct: number): string {
  if (pct >= 65) return 'text-emerald-400';
  if (pct >= 55) return 'text-yellow-400';
  if (pct >= 50) return 'text-orange-400';
  return 'text-red-400';
}

export function MLBRegressionPicksForGame(props: MLBRegressionPicksForGameProps) {
  const { data: report } = useMLBRegressionReport();
  const { data: bucketAccuracy } = useMLBBucketAccuracy();
  // Synthetic aggregate row populated from mlb_graded_picks where
  // is_perfect_storm = true. Used as the bucket W% for picks in that "bucket".
  const perfectStormOverall = bucketAccuracy?.perfect_storm?.overall;
  if (!report || !props.gamePk) return null;
  const picks = (report.suggested_picks || []).filter(p => p.game_pk === props.gamePk);
  if (picks.length === 0) return null;

  return (
    // No outer container and no title: the parent WidgetCard already supplies
    // both. Picks are separated by a rule rather than each sitting in its own
    // bordered box — this used to be three nested surfaces deep.
    <div className="divide-y divide-black/5 dark:divide-white/10">
      {picks.map((p, i) => {
        const alignment = computeAlignment(p, props);
        const isPerfectStorm = (p.edge_bucket || '').toLowerCase() === 'perfect_storm';
        const alignmentTheme =
          alignment === 'aligns'
            ? { tone: 'success' as const, Icon: CheckCircle2, label: 'Agrees with model' }
            : alignment === 'contradicts'
              ? { tone: 'danger' as const, Icon: XCircle, label: 'Disagrees with model' }
              : { tone: 'default' as const, Icon: HelpCircle, label: 'No comparison' };
        // HIGH/MODERATE confidence label removed — Perfect Storm tier
        // (Hammer/PS/Lean/Watch) is the canonical conviction signal now.

        return (
          <div key={`${p.bet_type}-${i}`} className="space-y-2 py-3 first:pt-1 last:pb-1">
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 flex-col">
                <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/70">
                  {BET_TYPE_LABEL[p.bet_type]}
                </span>
                <span className="truncate text-lg font-bold leading-tight text-foreground">
                  <PickText pick={p.pick} />
                </span>
              </div>
              <Chip
                size="sm"
                variant="flat"
                color={alignmentTheme.tone}
                startContent={<alignmentTheme.Icon className="h-3 w-3" />}
                classNames={{ base: 'shrink-0', content: 'font-semibold' }}
              >
                {alignmentTheme.label}
              </Chip>
            </div>

            <div className="grid grid-cols-3 gap-2 rounded-lg bg-muted/40 px-2 py-1.5 text-center">
              <div>
                <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/70">
                  Edge
                </div>
                <div className="text-[13px] font-bold tabular-nums text-foreground">
                  {p.edge_at_suggestion > 0 ? '+' : ''}
                  {p.edge_at_suggestion}
                  {p.bet_type.includes('ml') ? '%' : ''}
                </div>
              </div>
              <div>
                <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/70">
                  Tier
                </div>
                <div className="text-[13px] font-bold leading-tight text-foreground">
                  {p.edge_bucket === 'perfect_storm' ? 'Perfect Storm' : p.edge_bucket}
                </div>
              </div>
              <div>
                <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/70">
                  Tier win%
                </div>
                {isPerfectStorm ? (
                  perfectStormOverall && perfectStormOverall.games > 0 ? (
                    <div className={`text-[13px] font-bold tabular-nums ${winColor(perfectStormOverall.win_pct)}`}>
                      {perfectStormOverall.win_pct}%
                    </div>
                  ) : (
                    <div className="text-[13px] font-bold text-muted-foreground">N/A</div>
                  )
                ) : (
                  <div className={`text-[13px] font-bold tabular-nums ${winColor(p.bucket_win_pct)}`}>
                    {p.bucket_win_pct}%
                  </div>
                )}
              </div>
            </div>

            {p.reasoning ? (
              <p className="text-[11px] leading-snug text-muted-foreground">{p.reasoning}</p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
