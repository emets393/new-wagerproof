import { ArrowDown, ArrowUp, CircleDollarSign, Sigma, TrendingUp } from 'lucide-react';
import { WidgetCard } from '@/components/ios';
import { getEdgeInfo } from '../../edgeExplanations';
import { ModelEdgeRail, ModelVsMarketRow, NBA_EDGE_SCALE, SpreadCoverBar } from '../../charts';
import {
  CARD_STACK,
  fmt1,
  fmtSigned1,
  OverUnderPickRow,
  Recommendation,
  round1,
  SpreadPickRow,
  toNum,
} from './shared';
import type { NBAPrediction } from '../../../api/nbaGames';
import type { GameFeedItem } from '../../../types';
import { nbaSpreadHeadline, nbaTotalHeadline } from '../../headlines/nba';

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
}

export function NbaSpreadSection({ game }: NbaPredictionsSectionProps) {
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

  return (
    <WidgetCard
      icon={<CircleDollarSign />}
      title="Spread"
      headline={nbaSpreadHeadline({
        pickAbbrev: pickTeam.abbrev,
        modelLine,
        marketLine,
        edgePts,
      }) ?? undefined}
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

        {/* Margin, not lines: `modelLine` is the pick team's fair SPREAD, so it is
            negated exactly once, here, to become the margin the bar plots. The
            bar's cushion is marketLine − modelLine, the same subtraction that
            produced `edgePts` above (rule 10). */}
        {modelLine !== null && marketLine !== null && (
          <SpreadCoverBar
            line={marketLine}
            modelMargin={-modelLine}
            scale={NBA_EDGE_SCALE}
            pickAbbrev={pickTeam.abbrev}
            opponentAbbrev={(pickIsHome ? game.awayTeam : game.homeTeam).abbrev}
          />
        )}
      </div>
    </WidgetCard>
  );
}

export function NbaTotalSection({ game }: NbaPredictionsSectionProps) {
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
  // A 0.0 gap has no direction to contradict, so it still gets the rail.
  const railAgreesWithPick = gap === 0 || gap > 0 === isOver;

  return (
    <WidgetCard
      icon={<Sigma />}
      title="Total"
      headline={nbaTotalHeadline({ modelTotal, marketTotal, isOver, magnitude }) ?? undefined}
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

        {/* The rail names the lean from sign(model − market). `isOver` comes from
            the raw delta instead, so a stale `over_line` can make them disagree —
            in that case fall back to the plain row rather than print "Over Lean"
            under an UNDER recommendation. */}
        {modelTotal !== null && marketTotal !== null &&
          (railAgreesWithPick ? (
            <ModelEdgeRail
              market={marketTotal}
              model={modelTotal}
              scale={NBA_EDGE_SCALE}
              format={(v) => fmt1(v)}
            />
          ) : (
            <ModelVsMarketRow
              model={fmt1(modelTotal)}
              market={fmt1(marketTotal)}
              gapDisplay={`${gap > 0 ? '+' : ''}${gap.toFixed(1)}`}
              gapUnit="pts"
              tone={isOver ? 'over' : 'under'}
              lean={
                <>
                  Model projects{' '}
                  <span className="font-bold text-foreground">
                    {magnitude.toFixed(1)} points {isOver ? 'more' : 'fewer'}
                  </span>{' '}
                  than the posted total, but the model&apos;s own direction column says{' '}
                  {isOver ? 'OVER' : 'UNDER'}
                </>
              }
            />
          ))}
      </div>
    </WidgetCard>
  );
}
