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
  f5_ml: '1st 5 · Moneyline',
  f5_ou: '1st 5 · Total',
};

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
    <div className="rounded-xl border border-purple-500/30 bg-purple-950/20 p-3 sm:p-4 ring-1 ring-inset ring-purple-400/10 shadow-sm space-y-3">
      <div className="flex items-center gap-2">
        <Zap className="h-4 w-4 text-purple-400" />
        <div className="text-sm font-semibold text-white">
          Regression Report {picks.length > 1 ? 'Picks' : 'Pick'}
        </div>
      </div>

      <div className="space-y-2">
        {picks.map((p, i) => {
          const alignment = computeAlignment(p, props);
          const isPerfectStorm = (p.edge_bucket || '').toLowerCase() === 'perfect_storm';
          const alignmentTheme = alignment === 'aligns'
            ? { bg: 'bg-emerald-500/15', border: 'border-emerald-400/40', fg: 'text-emerald-300', Icon: CheckCircle2, label: 'Aligns with model' }
            : alignment === 'contradicts'
              ? { bg: 'bg-red-500/15', border: 'border-red-400/40', fg: 'text-red-300', Icon: XCircle, label: 'Contradicts model' }
              : { bg: 'bg-slate-500/15', border: 'border-slate-400/30', fg: 'text-slate-300', Icon: HelpCircle, label: 'Comparison unavailable' };
          const confTheme = p.confidence_at_suggestion === 'high'
            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40'
            : 'bg-yellow-500/20 text-yellow-300 border-yellow-400/40';

          return (
            <div
              key={`${p.bet_type}-${i}`}
              className="rounded-lg border border-slate-600/50 bg-slate-950/50 p-3 space-y-2"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  {BET_TYPE_LABEL[p.bet_type]}
                </div>
                <span className={`text-[10px] font-bold tracking-wider px-1.5 py-0.5 rounded border ${confTheme}`}>
                  {p.confidence_at_suggestion.toUpperCase()}
                </span>
              </div>

              <div className="text-sm sm:text-base font-bold text-white">{p.pick}</div>

              <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded border text-[11px] font-semibold ${alignmentTheme.bg} ${alignmentTheme.border} ${alignmentTheme.fg}`}>
                <alignmentTheme.Icon className="h-3 w-3" />
                {alignmentTheme.label}
              </div>

              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div>
                  <div className="text-muted-foreground">Edge</div>
                  <div className="font-medium text-white">
                    {p.edge_at_suggestion > 0 ? '+' : ''}{p.edge_at_suggestion}{p.bet_type.includes('ml') ? '%' : ''}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Bucket</div>
                  <div className="font-medium text-white">{p.edge_bucket}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Bucket W%</div>
                  {isPerfectStorm ? (
                    perfectStormOverall && perfectStormOverall.games > 0 ? (
                      <div className={`font-medium ${winColor(perfectStormOverall.win_pct)}`}>
                        {perfectStormOverall.win_pct}%
                      </div>
                    ) : (
                      <div className="font-medium text-muted-foreground">N/A</div>
                    )
                  ) : (
                    <div className={`font-medium ${winColor(p.bucket_win_pct)}`}>
                      {p.bucket_win_pct}%
                    </div>
                  )}
                </div>
              </div>

              {p.reasoning ? (
                <div className="text-xs italic text-slate-400 leading-snug">{p.reasoning}</div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
