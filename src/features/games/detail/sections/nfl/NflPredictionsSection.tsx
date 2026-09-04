import { ArrowDown, ArrowUp, Sigma, Target, TrendingUp } from 'lucide-react';
import { WidgetCard } from '@/components/ios';
import { getNFLFullTeamName, type NFLPrediction } from '../../../api/nflGames';
import type { GameFeedItem, TeamRef } from '../../../types';
import {
  FADE_ALERT_PCT,
  formatLine,
  nflSpreadHeadline,
  nflTotalHeadline,
} from '../../headlines/nfl';
import { ModelEdgeRail, ModelVsMarketRow, NFL_EDGE_SCALE, SpreadCoverBar } from '../../charts';
import {
  ConfidenceMeter,
  EdgeValue,
  FadeAlertChip,
  Recommendation,
} from './shared';

interface NflPredictionSectionProps {
  game: GameFeedItem;
}

/**
 * Spread pick, recommendation-first: which side covers, how confident the model
 * is, then where the model's own line sits against the Vegas number.
 *
 * Split out of the old combined "Model Predictions" card, which answered the
 * spread question and the total question in one widget.
 */
export function NflSpreadSection({ game }: NflPredictionSectionProps) {
  const raw = game.raw as NFLPrediction;
  const coverProb = raw.home_away_spread_cover_prob;
  // Off-season / pre-model weeks: no probability yet, nothing to recommend.
  if (coverProb === null || coverProb === undefined) return null;

  const isHome = coverProb > 0.5;
  const team: TeamRef = isHome ? game.homeTeam : game.awayTeam;
  const vegasLine = isHome ? raw.home_spread : raw.away_spread;
  const confidencePct = Math.round((isHome ? coverProb : 1 - coverProb) * 100);

  // home_spread_diff = vegas home spread − model fair home spread on the new
  // slate model (fg_spread_edge). Positive = value on the HOME side. Flip when
  // the pick is the road team so the number always reads from the picked side.
  const homeDiff = raw.home_spread_diff ?? null;
  const pickEdge = homeDiff === null || Number.isNaN(homeDiff) ? null : isHome ? homeDiff : -homeDiff;
  // Derived from the edge (not re-modelled) so model − vegas equals the gap shown.
  const modelLine =
    vegasLine !== null && vegasLine !== undefined && pickEdge !== null
      ? Number(vegasLine) - pickEdge
      : null;

  return (
    <WidgetCard
      icon={<Target />}
      title="Spread"
      headline={
        nflSpreadHeadline({
          teamAbbrev: team.abbrev,
          vegasLine: vegasLine ?? null,
          confidencePct,
          pickEdge,
        }) ?? undefined
      }
      subtitle="Which side the model expects to cover, and whether its own line is better than the one Vegas is offering."
      contentClassName="space-y-3"
    >
      <Recommendation
        market="Spread pick"
        pick={`${team.abbrev} ${formatLine(vegasLine)}`}
        team={team}
        edge={
          pickEdge !== null ? (
            <EdgeValue value={pickEdge} unit="pts" icon={<TrendingUp className="h-3.5 w-3.5" />} />
          ) : undefined
        }
      />

      <ConfidenceMeter
        pct={confidencePct}
        outcome={`chance ${team.abbrev} covers`}
        accessory={confidencePct >= FADE_ALERT_PCT ? <FadeAlertChip /> : undefined}
      />

      {/* `modelLine` is the pick team's fair SPREAD; the bar plots MARGIN, so it
          is negated exactly once, here. Its cushion is vegasLine − modelLine,
          which is `pickEdge` by construction (rule 10). */}
      {modelLine !== null && pickEdge !== null && vegasLine !== null && vegasLine !== undefined && (
        <SpreadCoverBar
          line={Number(vegasLine)}
          modelMargin={-modelLine}
          scale={NFL_EDGE_SCALE}
          pickAbbrev={team.abbrev}
          opponentAbbrev={(isHome ? game.awayTeam : game.homeTeam).abbrev}
        />
      )}
    </WidgetCard>
  );
}

/**
 * Total pick. Same shape as the spread card — one question, recommendation
 * first — with OVER/UNDER carrying green+up / blue+down on the word itself.
 *
 * After the 2026 slate cutover the model publishes `fg_total_pick` +
 * `fg_total_edge` / `fg_pred_total` rather than a classifier `ou_result_prob`.
 * Prefer the pick when present; fall back to model-vs-Vegas edge.
 */
export function NflTotalSection({ game }: NflPredictionSectionProps) {
  const raw = game.raw as NFLPrediction;
  const ouProb = raw.ou_result_prob;
  const pickRaw = String(raw.fg_total_pick ?? '')
    .trim()
    .toUpperCase();
  const totalDiff = raw.over_line_diff ?? null;
  const predTotal = raw.pred_total != null ? Number(raw.pred_total) : null;
  const vegasTotal = raw.over_line;

  let isOver: boolean | null = null;
  if (ouProb !== null && ouProb !== undefined) {
    isOver = ouProb > 0.5;
  } else if (pickRaw === 'OVER') {
    isOver = true;
  } else if (pickRaw === 'UNDER') {
    isOver = false;
  } else if (totalDiff !== null && !Number.isNaN(totalDiff) && totalDiff !== 0) {
    isOver = totalDiff > 0;
  } else if (
    predTotal !== null &&
    Number.isFinite(predTotal) &&
    vegasTotal !== null &&
    vegasTotal !== undefined
  ) {
    const gap = predTotal - Number(vegasTotal);
    if (gap !== 0) isOver = gap > 0;
  }

  if (isOver === null) return null;

  const confidencePct =
    ouProb !== null && ouProb !== undefined
      ? Math.round((isOver ? ouProb : 1 - ouProb) * 100)
      : null;

  // over_line_diff = model fair total − vegas total, i.e. positive means the
  // model projects more points. Flipped for an UNDER pick so the gap always
  // reads as value on the recommended side.
  const pickEdge =
    totalDiff === null || Number.isNaN(totalDiff) ? null : isOver ? totalDiff : -totalDiff;
  const modelTotal =
    predTotal !== null && Number.isFinite(predTotal)
      ? predTotal
      : vegasTotal !== null && vegasTotal !== undefined && totalDiff !== null
        ? Number(vegasTotal) + totalDiff
        : null;
  const railGap =
    modelTotal !== null && vegasTotal !== null && vegasTotal !== undefined
      ? modelTotal - Number(vegasTotal)
      : null;
  // A flat gap has no direction to contradict, so it still gets the rail.
  const railAgreesWithPick = railGap === null || railGap === 0 || railGap > 0 === isOver;

  return (
    <WidgetCard
      icon={<Sigma />}
      title="Total"
      headline={
        nflTotalHeadline({
          isOver,
          confidencePct: confidencePct ?? 55,
          vegasTotal: vegasTotal ?? null,
          pickEdge,
          modelTotal,
        }) ?? undefined
      }
      subtitle="How many points the model expects both teams to score versus the Vegas line, and which way that leans."
      contentClassName="space-y-3"
    >
      <Recommendation
        market="Total pick"
        pick={`${isOver ? 'OVER' : 'UNDER'} ${vegasTotal ?? '—'}`}
        tone={isOver ? 'over' : 'under'}
        pickIcon={isOver ? <ArrowUp className="h-5 w-5" /> : <ArrowDown className="h-5 w-5" />}
        edge={
          pickEdge !== null ? (
            <EdgeValue value={pickEdge} unit="pts" icon={<TrendingUp className="h-3.5 w-3.5" />} />
          ) : undefined
        }
      />

      {confidencePct !== null && (
        <ConfidenceMeter
          pct={confidencePct}
          outcome={`chance the ${isOver ? 'over' : 'under'} hits`}
          accessory={confidencePct >= FADE_ALERT_PCT ? <FadeAlertChip /> : undefined}
        />
      )}

      {/* The rail names the lean from sign(model − market). `isOver` can come from
          the `ou_result_prob` CLASSIFIER instead, which is independent of the
          two totals, so when they disagree the plain row states both rather than
          printing "Under Lean" beneath an OVER recommendation. */}
      {modelTotal !== null && pickEdge !== null && vegasTotal !== null && vegasTotal !== undefined &&
        (railAgreesWithPick ? (
          <ModelEdgeRail market={Number(vegasTotal)} model={modelTotal} scale={NFL_EDGE_SCALE} />
        ) : (
          <ModelVsMarketRow
            model={modelTotal.toFixed(1)}
            market={Number(vegasTotal).toFixed(1)}
            gapDisplay={`${(totalDiff ?? 0) > 0 ? '+' : ''}${(totalDiff ?? 0).toFixed(1)}`}
            gapUnit="pts"
            tone={isOver ? 'over' : 'under'}
            lean={
              <>
                Model projects{' '}
                <span className="font-bold text-foreground">
                  {Math.abs(totalDiff ?? 0).toFixed(1)} points{' '}
                  {(totalDiff ?? 0) >= 0 ? 'more' : 'fewer'}
                </span>{' '}
                than Vegas, but its cover model still backs the{' '}
                <span
                  className={
                    isOver
                      ? 'font-bold text-emerald-600 dark:text-emerald-300'
                      : 'font-bold text-blue-600 dark:text-blue-300'
                  }
                >
                  {isOver ? 'OVER' : 'UNDER'}
                </span>
              </>
            }
          />
        ))}
    </WidgetCard>
  );
}
