import { ArrowDown, ArrowUp, Info, Sigma, Sparkles, Target, TrendingUp } from 'lucide-react';
import { WidgetCard } from '@/components/ios';
import { renderTextWithLinks } from '@/utils/markdownLinks';
import { getNFLFullTeamName, type NFLPrediction } from '../../../api/nflGames';
import type { GameFeedItem, TeamRef } from '../../../types';
import {
  CompareRow,
  ConfidenceMeter,
  EdgeValue,
  FadeAlertChip,
  Recommendation,
  TeamMark,
} from './shared';

/** Signed line with at most one decimal ("-3.5", "+2", "-6.3"). */
const formatLine = (value: number | null): string => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
  const n = Number(value);
  const body = Number.isInteger(n) ? String(Math.abs(n)) : Math.abs(n).toFixed(1);
  return `${n < 0 ? '-' : '+'}${body}`;
};

/** Confidence at which the model is likely overreacting to one factor. */
const FADE_ALERT_PCT = 80;

interface NflPredictionSectionProps {
  game: GameFeedItem;
  /** AI-completion texts for this game keyed by widget type. */
  completions: Record<string, string>;
}

/**
 * The plain-language "what has to happen for this to win" note. AI completion
 * when we have one, static fallback otherwise.
 */
function WhatThisMeans({ text, fromAi }: { text: string; fromAi: boolean }) {
  return (
    <div className="border-t border-black/5 pt-2.5 dark:border-white/10">
      <div className="mb-1 flex items-center gap-1.5">
        <Info className="h-3 w-3 shrink-0 text-muted-foreground" />
        <h6 className="text-[11px] font-semibold text-foreground">What this means</h6>
        {fromAi && <Sparkles className="ml-auto h-3 w-3 text-primary" />}
      </div>
      <p className="text-left text-[11px] leading-relaxed text-muted-foreground">
        {renderTextWithLinks(text)}
      </p>
    </div>
  );
}

/**
 * Spread pick, recommendation-first: which side covers, how confident the model
 * is, then where the model's own line sits against the Vegas number.
 *
 * Split out of the old combined "Model Predictions" card, which answered the
 * spread question and the total question in one widget.
 */
export function NflSpreadSection({ game, completions }: NflPredictionSectionProps) {
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
  const homeDiff = raw.home_spread_diff ?? null;
  const pickEdge = homeDiff === null || Number.isNaN(homeDiff) ? null : isHome ? homeDiff : -homeDiff;
  // Derived from the edge (not re-modelled) so model − vegas equals the gap shown.
  const modelLine =
    vegasLine !== null && vegasLine !== undefined && pickEdge !== null
      ? Number(vegasLine) - pickEdge
      : null;

  const spreadValue = Math.abs(Number(vegasLine ?? 0));
  const isNegativeSpread = Number(vegasLine ?? 0) < 0;
  const cityName = getNFLFullTeamName(team.name).city;
  const requirement = isNegativeSpread
    ? `win by more than ${spreadValue} points`
    : `either win the game or lose by fewer than ${spreadValue} points`;
  const closer =
    confidencePct <= 58
      ? `With ${confidencePct}% confidence, this is a toss-up.`
      : confidencePct <= 65
        ? `The model gives this a ${confidencePct}% chance.`
        : `With ${confidencePct}% confidence, the model sees a strong likelihood.`;

  const aiExplanation = completions['spread_prediction'];
  const explanation =
    aiExplanation || `For this bet to win, ${cityName} needs to ${requirement}. ${closer}`;

  return (
    <WidgetCard
      icon={<Target />}
      title="Spread"
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

      <WhatThisMeans text={explanation} fromAi={Boolean(aiExplanation)} />
    </WidgetCard>
  );
}

/**
 * Total pick. Same shape as the spread card — one question, recommendation
 * first — with OVER/UNDER carrying green+up / blue+down on the word itself.
 */
export function NflTotalSection({ game, completions }: NflPredictionSectionProps) {
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

  const aiExplanation = completions['ou_prediction'];
  const closer =
    confidencePct <= 58
      ? `With ${confidencePct}% confidence, this is a coin flip.`
      : confidencePct <= 65
        ? `The model gives this a ${confidencePct}% chance.`
        : `With ${confidencePct}% confidence, the model expects a ${isOver ? 'high-scoring' : 'low-scoring'} game.`;
  const explanation =
    aiExplanation ||
    `For this bet to win, the combined score needs to be ${isOver ? 'MORE' : 'LESS'} than ${vegasTotal ?? '—'} points. ${closer}`;

  return (
    <WidgetCard
      icon={<Sigma />}
      title="Total"
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

      <WhatThisMeans text={explanation} fromAi={Boolean(aiExplanation)} />
    </WidgetCard>
  );
}
