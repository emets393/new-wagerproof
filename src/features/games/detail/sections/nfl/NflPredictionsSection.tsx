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
import {
  CompareRow,
  ConfidenceMeter,
  EdgeValue,
  FadeAlertChip,
  Recommendation,
  TeamMark,
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

  // home_spread_diff = vegas home spread − model fair home spread, so a positive
  // value is value on the HOME side. Flip it when the pick is the road team so
  // the number always reads from the picked side's perspective.
  // Always null for NFL: the model is a cover/OU CLASSIFIER and publishes no fair
  // line to subtract. The edge branches below are dead on this sport by design.
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

      {modelLine !== null && pickEdge !== null && (
        <CompareRow
          model={formatLine(modelLine)}
          modelMark={<TeamMark team={team} size={24} />}
          vegas={formatLine(vegasLine)}
          gap={pickEdge}
          gapUnit="pts"
          footer={
            <>
              Model makes {team.abbrev}{' '}
              <span className="font-bold text-foreground">
                {Math.abs(pickEdge).toFixed(1)} pts {pickEdge >= 0 ? 'stronger' : 'weaker'}
              </span>{' '}
              than Vegas &rarr;{' '}
              <span
                className={
                  pickEdge >= 0
                    ? 'font-bold text-emerald-600 dark:text-emerald-300'
                    : 'font-bold text-red-600 dark:text-red-300'
                }
              >
                {pickEdge >= 0 ? 'line value' : 'no line value'}
              </span>
            </>
          }
        />
      )}
    </WidgetCard>
  );
}

/**
 * Total pick. Same shape as the spread card — one question, recommendation
 * first — with OVER/UNDER carrying green+up / blue+down on the word itself.
 */
export function NflTotalSection({ game }: NflPredictionSectionProps) {
  const raw = game.raw as NFLPrediction;
  const ouProb = raw.ou_result_prob;
  if (ouProb === null || ouProb === undefined) return null;

  const isOver = ouProb > 0.5;
  const confidencePct = Math.round((isOver ? ouProb : 1 - ouProb) * 100);
  const vegasTotal = raw.over_line;

  // over_line_diff = model fair total − vegas total, i.e. positive means the
  // model projects more points. Flipped for an UNDER pick so the gap always
  // reads as value on the recommended side.
  const totalDiff = raw.over_line_diff ?? null;
  const pickEdge =
    totalDiff === null || Number.isNaN(totalDiff) ? null : isOver ? totalDiff : -totalDiff;
  const modelTotal =
    vegasTotal !== null && vegasTotal !== undefined && totalDiff !== null
      ? Number(vegasTotal) + totalDiff
      : null;

  return (
    <WidgetCard
      icon={<Sigma />}
      title="Total"
      headline={
        nflTotalHeadline({
          isOver,
          confidencePct,
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

      <ConfidenceMeter
        pct={confidencePct}
        outcome={`chance the ${isOver ? 'over' : 'under'} hits`}
        accessory={confidencePct >= FADE_ALERT_PCT ? <FadeAlertChip /> : undefined}
      />

      {modelTotal !== null && pickEdge !== null && (
        <CompareRow
          model={modelTotal.toFixed(1)}
          vegas={Number(vegasTotal).toFixed(1)}
          gap={pickEdge}
          gapUnit="pts"
          footer={
            <>
              Model projects{' '}
              <span className="font-bold text-foreground">
                {Math.abs(totalDiff ?? 0).toFixed(1)} points{' '}
                {(totalDiff ?? 0) >= 0 ? 'more' : 'fewer'}
              </span>{' '}
              than Vegas &rarr; {pickEdge >= 0 ? 'backs the' : 'argues against the'}{' '}
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
      )}
    </WidgetCard>
  );
}
