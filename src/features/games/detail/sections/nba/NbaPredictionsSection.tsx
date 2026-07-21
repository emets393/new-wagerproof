import { ArrowDown, ArrowUp, CircleDollarSign, Sigma, TrendingUp } from 'lucide-react';
import { WidgetCard } from '@/components/ios';
import { cn } from '@/lib/utils';
import { renderTextWithLinks } from '@/utils/markdownLinks';
import { getEdgeExplanation, getEdgeInfo } from '../../edgeExplanations';
import {
  CARD_STACK,
  Explanation,
  fmt1,
  fmtSigned1,
  ModelVsMarket,
  OverUnderPickRow,
  Recommendation,
  round1,
  SpreadPickRow,
  toNum,
} from './shared';
import type { NBAPrediction } from '../../../api/nbaGames';
import type { GameFeedItem } from '../../../types';

/**
 * NBA model output, split into one card per market (rule 1). This used to be a
 * single "Model Predictions" card stacking a spread panel, its explanation, an
 * O/U panel, and its explanation — four tinted boxes answering two questions.
 *
 * Every displayed number is rounded first and the gap is then computed from the
 * rounded values, so model / Vegas / edge always reconcile on screen (rule 10).
 */

interface NbaPredictionsSectionProps {
  game: GameFeedItem;
  completions: Record<string, string>;
}

export function NbaSpreadSection({ game, completions }: NbaPredictionsSectionProps) {
  const raw = game.raw as unknown as NBAPrediction;

  const homeSpreadDiff = toNum(raw.home_spread_diff);
  const predSpread = toNum(raw.pred_spread);
  const vegasHomeSpread = toNum(raw.home_spread);

  // Same gate as before: without a model-vs-market delta there's no pick to make.
  const edgeInfo = getEdgeInfo(homeSpreadDiff, raw.away_team, raw.home_team);
  if (!edgeInfo) return null;

  const pickIsHome = edgeInfo.isHomeEdge;
  const pickTeam = pickIsHome ? game.homeTeam : game.awayTeam;

  // Flip both lines to the picked team's perspective so "model has them at -6,
  // the book has them at -3.5" is a like-for-like comparison.
  const modelLine = predSpread === null ? null : round1(pickIsHome ? predSpread : -predSpread);
  const marketLine =
    vegasHomeSpread === null ? null : round1(pickIsHome ? vegasHomeSpread : -vegasHomeSpread);
  const derivedEdge =
    modelLine !== null && marketLine !== null ? round1(marketLine - modelLine) : null;
  const edgePts = derivedEdge ?? round1(Math.abs(homeSpreadDiff as number));

  const awayLine =
    vegasHomeSpread === null ? '—' : fmtSigned1(round1(-vegasHomeSpread));
  const homeLine = vegasHomeSpread === null ? '—' : fmtSigned1(round1(vegasHomeSpread));

  const aiExplanation = completions['spread_prediction'];
  const staticExplanation = getEdgeExplanation(edgeInfo.edgeValue, edgeInfo.teamName, 'spread');

  return (
    <WidgetCard
      icon={<CircleDollarSign />}
      title="Spread"
      subtitle="Which side the model would lay or take points with, and how far its line sits from the book's."
    >
      <div className={CARD_STACK}>
        <Recommendation
          market="Spread"
          pick={`${pickTeam.abbrev} ${marketLine !== null ? fmtSigned1(marketLine) : ''}`.trim()}
          team={pickTeam}
          edge={`+${edgePts.toFixed(1)}`}
          edgeIcon={<TrendingUp className="h-3.5 w-3.5" />}
        />

        <SpreadPickRow
          awayTeam={game.awayTeam}
          homeTeam={game.homeTeam}
          awayLine={awayLine}
          homeLine={homeLine}
          pickIsHome={pickIsHome}
        />

        {modelLine !== null && marketLine !== null && (
          <ModelVsMarket
            model={fmtSigned1(modelLine)}
            market={fmtSigned1(marketLine)}
            gap={edgePts}
            unit="pts"
            tone="primary"
            lean={
              <>
                Model makes{' '}
                <span className="font-bold text-foreground">{pickTeam.abbrev}</span>{' '}
                <span className="font-bold text-foreground">{edgePts.toFixed(1)} points</span>{' '}
                stronger than the book does
              </>
            }
          />
        )}

        <Explanation
          text={renderTextWithLinks(aiExplanation || staticExplanation)}
          isAi={Boolean(aiExplanation)}
        />
      </div>
    </WidgetCard>
  );
}

export function NbaTotalSection({ game, completions }: NbaPredictionsSectionProps) {
  const raw = game.raw as unknown as NBAPrediction;

  const overLineDiff = toNum(raw.over_line_diff);
  if (overLineDiff === null) return null;

  const predOverLine = toNum(raw.pred_over_line);
  const vegasTotal = toNum(raw.over_line);

  const modelTotal = predOverLine === null ? null : round1(predOverLine);
  const marketTotal = vegasTotal === null ? null : round1(vegasTotal);
  const derivedGap =
    modelTotal !== null && marketTotal !== null ? round1(modelTotal - marketTotal) : null;

  // Direction stays keyed off the raw delta so a gap that rounds to 0.0 can't
  // silently flip the pick from OVER to UNDER.
  const isOver = overLineDiff > 0;
  const gap = derivedGap ?? round1(overLineDiff);
  const magnitude = Math.abs(gap);

  const aiExplanation = completions['ou_prediction'];
  const staticExplanation = getEdgeExplanation(
    Math.abs(overLineDiff),
    '',
    'ou',
    isOver ? 'over' : 'under',
  );

  return (
    <WidgetCard
      icon={<Sigma />}
      title="Total"
      subtitle="How many points the model expects versus the posted total, and which way that leans."
    >
      <div className={CARD_STACK}>
        <Recommendation
          market="Total"
          pick={isOver ? 'OVER' : 'UNDER'}
          tone={isOver ? 'over' : 'under'}
          edge={`+${magnitude.toFixed(1)}`}
          edgeIcon={
            isOver ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />
          }
        />

        <OverUnderPickRow isOver={isOver} />

        {modelTotal !== null && marketTotal !== null && (
          <ModelVsMarket
            model={fmt1(modelTotal)}
            market={fmt1(marketTotal)}
            gap={gap}
            unit="pts"
            tone={isOver ? 'over' : 'under'}
            lean={
              <>
                Model projects{' '}
                <span className="font-bold text-foreground">
                  {magnitude.toFixed(1)} points {isOver ? 'more' : 'fewer'}
                </span>{' '}
                than Vegas &rarr; leans{' '}
                <span
                  className={cn(
                    'font-bold',
                    isOver
                      ? 'text-emerald-600 dark:text-emerald-300'
                      : 'text-blue-600 dark:text-blue-300',
                  )}
                >
                  {isOver ? 'OVER' : 'UNDER'}
                </span>
              </>
            }
          />
        )}

        <Explanation
          text={renderTextWithLinks(aiExplanation || staticExplanation)}
          isAi={Boolean(aiExplanation)}
        />
      </div>
    </WidgetCard>
  );
}
