import { ArrowDown, ArrowUp, Check, CircleDollarSign, Sigma, TrendingUp, Trophy } from 'lucide-react';
import { WidgetCard } from '@/components/ios';
import { cn } from '@/lib/utils';
import { getEdgeInfo } from '../../edgeExplanations';
import { ModelEdgeRail, ModelVsMarketRow, MoneylineEdgeBar, NBA_EDGE_SCALE, SpreadCoverBar, moneylineOutcome } from '../../charts';
import { CARD_STACK, fmt1, fmtSigned1, Recommendation, round1, TeamMark, toNum } from './shared';
import type { NBAPrediction } from '../../../api/nbaGames';
import type { GameFeedItem } from '../../../types';
import { nbaSpreadHeadline, nbaTotalHeadline } from '../../headlines/nba';
import { NbaMarketSignals } from './NbaSignalsSection';

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

/** Open projected final. Sits above the market cards, under agent consensus. */
export function NbaScorePredictionSection({ game }: NbaPredictionsSectionProps) {
  const raw = game.raw as unknown as NBAPrediction;
  const score = nbaPredictedScore(raw);
  const homeWins = score !== null && score.home >= score.away;

  return (
    <WidgetCard
      icon={<Trophy />}
      title="Score Prediction"
      subtitle="The final the model projects."
      className="@xl:col-span-2"
    >
      {score ? (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="flex min-w-0 items-center gap-1.5">
              <TeamMark team={game.awayTeam} size={28} dimmed={homeWins} />
              <span className={cn('text-lg font-bold tabular-nums', homeWins ? 'text-muted-foreground' : 'text-foreground')}>
                {game.awayTeam.abbrev} {score.away.toFixed(1)}
              </span>
              {!homeWins && <Check className="h-3.5 w-3.5 shrink-0 text-primary" />}
            </span>
            <span className="flex min-w-0 items-center gap-1.5">
              {homeWins && <Check className="h-3.5 w-3.5 shrink-0 text-primary" />}
              <span className={cn('text-lg font-bold tabular-nums', homeWins ? 'text-foreground' : 'text-muted-foreground')}>
                {score.home.toFixed(1)} {game.homeTeam.abbrev}
              </span>
              <TeamMark team={game.homeTeam} size={28} dimmed={!homeWins} />
            </span>
          </div>
          <div
            className="flex h-2.5 overflow-hidden rounded-full bg-muted"
            role="img"
            aria-label={`Projected ${game.awayTeam.abbrev} ${score.away.toFixed(1)}, ${game.homeTeam.abbrev} ${score.home.toFixed(1)}`}
          >
            <div
              style={{ width: `${scoreShare(score.away, score.home)}%`, backgroundColor: game.awayTeam.colors.primary }}
              className={cn('transition-opacity', homeWins && 'opacity-35')}
            />
            <div
              style={{ width: `${100 - scoreShare(score.away, score.home)}%`, backgroundColor: game.homeTeam.colors.primary }}
              className={cn('transition-opacity', !homeWins && 'opacity-35')}
            />
          </div>
        </div>
      ) : (
        <p className="text-[13px] text-muted-foreground">No projected score for this game yet.</p>
      )}
    </WidgetCard>
  );
}

function scoreShare(away: number, home: number): number {
  const total = away + home;
  return total > 0 ? (away / total) * 100 : 50;
}

function nbaPredictedScore(raw: NBAPrediction): { away: number; home: number } | null {
  const home = toNum(raw.home_score_pred);
  const away = toNum(raw.away_score_pred);
  if (home !== null && away !== null) return { away, home };
  const total = toNum(raw.pred_over_line);
  const fairHomeSpread = toNum(raw.pred_spread);
  if (total === null || fairHomeSpread === null) return null;
  const margin = -fairHomeSpread;
  return { home: (total + margin) / 2, away: (total - margin) / 2 };
}

export function NbaSpreadSection({ game }: NbaPredictionsSectionProps) {
  const raw = game.raw as unknown as NBAPrediction;

  const homeSpreadDiff = toNum(raw.home_spread_diff);
  const predSpread = toNum(raw.pred_spread);
  const vegasHomeSpread = toNum(raw.home_spread);

  // Same gate as before: without a model-vs-market delta there's no pick to make.
  const edgeInfo = getEdgeInfo(homeSpreadDiff, raw.away_team, raw.home_team);
  if (!edgeInfo) return <NbaMarketSignals market="spread" />;

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
        <NbaMarketSignals market="spread" />
      </div>
    </WidgetCard>
  );
}

export function NbaTotalSection({ game }: NbaPredictionsSectionProps) {
  const raw = game.raw as unknown as NBAPrediction;

  const overLineDiff = toNum(raw.over_line_diff);
  if (overLineDiff === null) return <NbaMarketSignals market="total" />;

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
      subtitle={
        raw.nba_total_tier === 'warmup'
          ? 'Tracking only while the total model warms up. This is the model total against the posted total, not a bet.'
          : raw.nba_total_tier === 'bet' || raw.nba_total_tier === 'lean'
            ? 'How many points the model expects versus the posted total, and which way that leans. Candidate model — tracked this season, bet-size accordingly.'
            : 'How many points the model expects versus the posted total, and which way that leans.'
      }
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
        <NbaMarketSignals market="total" />
      </div>
    </WidgetCard>
  );
}

export function NbaMoneylineSection({ game }: NbaPredictionsSectionProps) {
  const raw = game.raw as unknown as NBAPrediction;
  const homeProb = toNum(raw.home_away_ml_prob);
  if (homeProb === null || homeProb <= 0 || homeProb >= 1) return <NbaMarketSignals market="moneyline" />;

  const pickIsHome = homeProb >= 0.5;
  const probability = pickIsHome ? homeProb : 1 - homeProb;
  const price = toNum(pickIsHome ? raw.home_ml : raw.away_ml);
  if (price === null || Math.abs(price) < 100) return <NbaMarketSignals market="moneyline" />;

  const team = pickIsHome ? game.homeTeam : game.awayTeam;
  const outcome = moneylineOutcome(price, probability, NBA_EDGE_SCALE);
  const edgeLabel = `${outcome.edge > 0 ? '+' : ''}${outcome.edge.toFixed(1)}`;

  return (
    <WidgetCard
      icon={<CircleDollarSign />}
      title="Moneyline"
      headline={`Model gives ${team.abbrev} a ${(probability * 100).toFixed(1)}% chance. The price needs ${outcome.breakEvenPercent.toFixed(1)}% to break even.`}
      subtitle="Win probability from the originator spread, set against the posted price."
    >
      <div className={CARD_STACK}>
        <Recommendation
          market="Moneyline"
          pick={team.abbrev}
          team={team}
          edge={edgeLabel}
          edgeIcon={<TrendingUp className="h-3.5 w-3.5" />}
        />
        <MoneylineEdgeBar
          price={price}
          modelProbability={probability}
          scale={NBA_EDGE_SCALE}
          teamAbbrev={team.abbrev}
        />
        <NbaMarketSignals market="moneyline" />
      </div>
    </WidgetCard>
  );
}
