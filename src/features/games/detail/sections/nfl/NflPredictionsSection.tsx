import { Brain, Info, Sparkles, Target, TrendingUp, Zap } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Button as MovingBorderButton } from '@/components/ui/moving-border';
import { EdgePill, WidgetCard } from '@/components/ios';
import { renderTextWithLinks } from '@/utils/markdownLinks';
import { formatEdge, getEdgeInfo } from '../../edgeExplanations';
import {
  getNFLFullTeamName,
  getNFLTeamInitials,
  getNFLTeamLogo,
  type NFLPrediction,
} from '../../../api/nflGames';
import type { GameFeedItem } from '../../../types';

// Port of NFL.tsx formatSpread — the modal received it as a prop.
const formatSpread = (spread: number | null): string => {
  if (spread === null || spread === undefined) return '-';
  if (spread > 0) return `+${spread}`;
  return spread.toString();
};

// Port of NFL.tsx getColorLuminance/getContrastingTextColor (logo-fallback initials color).
const getColorLuminance = (hexColor: string): number => {
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
};

const getContrastingTextColor = (bgColor1: string, bgColor2: string): string => {
  const avgLuminance = (getColorLuminance(bgColor1) + getColorLuminance(bgColor2)) / 2;
  return avgLuminance < 0.5 ? '#ffffff' : '#000000';
};

const FADE_ALERT_TOOLTIP =
  'When a model shows extreme confidence (80%+), it may be overreacting to a single factor. Consider analyzing other factors and potentially fading (betting against) this prediction.';

/**
 * FADE ALERT treatment ported from the NFL.tsx card pills: moving-border glow,
 * Zap label, and the "consider fading" tooltip at >=80% model confidence.
 */
function FadeAlertWrap({
  children,
  accent,
}: {
  children: React.ReactNode;
  accent: 'green' | 'purple';
}) {
  const borderClassName =
    accent === 'green'
      ? 'bg-[radial-gradient(#22c55e_40%,transparent_60%)]'
      : 'bg-[radial-gradient(#a855f7_40%,transparent_60%)]';
  const labelClassName =
    accent === 'green'
      ? 'text-green-600 dark:text-green-400'
      : 'text-purple-600 dark:text-purple-400';
  const zapClassName =
    accent === 'green'
      ? 'fill-green-600 dark:fill-green-400'
      : 'fill-purple-600 dark:fill-purple-400';

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex flex-col items-center gap-1.5 cursor-help">
          <MovingBorderButton
            borderRadius="0.75rem"
            containerClassName="h-auto w-full p-0"
            className="w-full bg-transparent p-0 border-0 m-0"
            borderClassName={borderClassName}
            duration={2000}
            as="div"
          >
            {children}
          </MovingBorderButton>
          <div
            className={`flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider ${labelClassName}`}
          >
            <Zap className={`h-3 w-3 ${zapClassName}`} />
            <span>FADE ALERT</span>
          </div>
        </div>
      </TooltipTrigger>
      <TooltipContent
        side="top"
        className="max-w-xs p-3 pr-6 bg-gray-900 dark:bg-gray-800 border-gray-700 dark:border-gray-600"
        sideOffset={8}
        avoidCollisions={true}
        collisionPadding={8}
        style={{ zIndex: 99999 }}
      >
        <p className="text-sm text-white dark:text-gray-100 leading-relaxed">
          {FADE_ALERT_TOOLTIP}
        </p>
      </TooltipContent>
    </Tooltip>
  );
}

interface NflPredictionsSectionProps {
  game: GameFeedItem;
  /** AI-completion texts for this game keyed by widget type. */
  completions: Record<string, string>;
}

/**
 * NFL Model Predictions, ported from GameDetailsModal's NFL block: spread pick
 * + confidence tiles and O/U direction + confidence tiles, each with the
 * "What This Means" explanation (AI completion preferred over static text),
 * plus model-vs-Vegas edge pills and the >=80% FADE ALERT tooltip.
 */
export function NflPredictionsSection({ game, completions }: NflPredictionsSectionProps) {
  const raw = game.raw as NFLPrediction;
  const homeTeamColors = game.homeTeam.colors;
  const awayTeamColors = game.awayTeam.colors;

  const hasSpread = raw.home_away_spread_cover_prob !== null;
  const hasOu = raw.ou_result_prob !== null;
  // Off-season / pre-model weeks: no probabilities yet, nothing to show.
  if (!hasSpread && !hasOu) return null;

  return (
    <WidgetCard icon={<Brain />} title="Model Predictions" contentClassName="space-y-5">
      {/* Spread Predictions */}
      {hasSpread &&
        (() => {
          const isHome = raw.home_away_spread_cover_prob! > 0.5;
          const predictedTeam = isHome ? raw.home_team : raw.away_team;
          const predictedTeamColors = isHome ? homeTeamColors : awayTeamColors;
          const predictedSpread = isHome ? raw.home_spread : raw.away_spread;
          const confidencePct = Math.round(
            (isHome ? raw.home_away_spread_cover_prob! : 1 - raw.home_away_spread_cover_prob!) *
              100
          );
          const confidenceColorClass =
            confidencePct <= 58
              ? 'text-red-400'
              : confidencePct <= 65
                ? 'text-orange-400'
                : 'text-green-400';
          const confidenceBgClass =
            confidencePct <= 58
              ? 'bg-red-100 dark:bg-red-500/10 border-red-300 dark:border-red-500/20'
              : confidencePct <= 65
                ? 'bg-orange-100 dark:bg-orange-500/10 border-orange-300 dark:border-orange-500/20'
                : 'bg-green-100 dark:bg-green-500/10 border-green-300 dark:border-green-500/20';
          const confidenceLabel =
            confidencePct <= 58
              ? 'Low Confidence'
              : confidencePct <= 65
                ? 'Moderate Confidence'
                : 'High Confidence';
          const spreadValue = Math.abs(Number(predictedSpread));
          const isNegativeSpread = Number(predictedSpread) < 0;
          const isFadeAlert = confidencePct >= 80;

          const aiExplanation = completions['spread_prediction'];
          const staticExplanation =
            confidencePct <= 58
              ? `For this bet to win, ${getNFLFullTeamName(predictedTeam).city} needs to ${isNegativeSpread ? `win by more than ${spreadValue} points` : `either win the game or lose by fewer than ${spreadValue} points`}. With ${confidencePct}% confidence, this is a toss-up.`
              : confidencePct <= 65
                ? `For this bet to win, ${getNFLFullTeamName(predictedTeam).city} needs to ${isNegativeSpread ? `win by more than ${spreadValue} points` : `either win the game or lose by fewer than ${spreadValue} points`}. The model gives this a ${confidencePct}% chance.`
                : `For this bet to win, ${getNFLFullTeamName(predictedTeam).city} needs to ${isNegativeSpread ? `win by more than ${spreadValue} points` : `either win the game or lose by fewer than ${spreadValue} points`}. With ${confidencePct}% confidence, the model sees a strong likelihood.`;

          const explanation = aiExplanation || staticExplanation;

          const logoUrl = getNFLTeamLogo(predictedTeam);
          const hasLogo = logoUrl && logoUrl !== '/placeholder.svg' && logoUrl.trim() !== '';
          const edgeInfo = getEdgeInfo(raw.home_spread_diff ?? null, raw.away_team, raw.home_team);

          const confidenceTile = (
            <div
              className={`${confidenceBgClass} backdrop-blur-sm rounded-lg border p-3 flex w-full flex-col items-center justify-center`}
            >
              <div className={`text-2xl sm:text-3xl font-extrabold leading-tight ${confidenceColorClass}`}>
                {confidencePct}%
              </div>
              <div className="text-xs text-gray-600 dark:text-white/60 font-medium mt-1">
                {confidenceLabel}
              </div>
            </div>
          );

          return (
            <div className="space-y-3">
              <div className="flex items-center justify-center gap-2">
                <Target className="h-4 w-4 text-green-600 dark:text-green-400" />
                <h5 className="text-sm font-semibold text-gray-800 dark:text-white/90">Spread</h5>
                {edgeInfo && (
                  <EdgePill
                    text={`Edge ${getNFLTeamInitials(edgeInfo.teamName)} +${edgeInfo.displayEdge}`}
                    magnitude={edgeInfo.edgeValue}
                  />
                )}
              </div>
              <div className="grid grid-cols-2 items-stretch gap-3">
                <div className="bg-green-100 dark:bg-green-500/10 backdrop-blur-sm rounded-lg border border-green-300 dark:border-green-500/20 p-3 flex flex-col items-center justify-center">
                  <div
                    className="h-12 w-12 sm:h-16 sm:w-16 rounded-full flex items-center justify-center border-2 mb-2 shadow-lg overflow-hidden bg-white dark:bg-gray-800"
                    style={{
                      background: hasLogo
                        ? 'transparent'
                        : `linear-gradient(135deg, ${predictedTeamColors.primary}, ${predictedTeamColors.secondary})`,
                      borderColor: `${predictedTeamColors.primary}`,
                    }}
                  >
                    {hasLogo ? (
                      <img
                        src={logoUrl}
                        alt={predictedTeam}
                        className="w-full h-full object-contain p-1"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                          const parent = target.parentElement;
                          if (parent && !parent.querySelector('.fallback-initials')) {
                            const fallback = document.createElement('span');
                            fallback.className =
                              'text-xs sm:text-sm font-bold drop-shadow-md fallback-initials';
                            fallback.style.color = getContrastingTextColor(
                              predictedTeamColors.primary,
                              predictedTeamColors.secondary
                            );
                            fallback.textContent = getNFLTeamInitials(predictedTeam);
                            parent.style.background = `linear-gradient(135deg, ${predictedTeamColors.primary}, ${predictedTeamColors.secondary})`;
                            parent.appendChild(fallback);
                          }
                        }}
                      />
                    ) : (
                      <span
                        className="text-xs sm:text-sm font-bold drop-shadow-md"
                        style={{
                          color: getContrastingTextColor(
                            predictedTeamColors.primary,
                            predictedTeamColors.secondary
                          ),
                        }}
                      >
                        {getNFLTeamInitials(predictedTeam)}
                      </span>
                    )}
                  </div>
                  <span className="text-xs sm:text-sm font-semibold text-gray-900 dark:text-white text-center leading-snug">
                    {getNFLFullTeamName(predictedTeam).city}
                  </span>
                  <span className="text-xs text-gray-600 dark:text-white/70">
                    ({formatSpread(predictedSpread)})
                  </span>
                </div>
                {isFadeAlert ? (
                  <FadeAlertWrap accent="green">{confidenceTile}</FadeAlertWrap>
                ) : (
                  confidenceTile
                )}
              </div>
              <div className="bg-gray-100 dark:bg-white/5 backdrop-blur-sm rounded-lg border border-gray-200 dark:border-white/10 p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Info className="h-3 w-3 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                  <h6 className="text-xs font-semibold text-gray-900 dark:text-white">
                    What This Means
                  </h6>
                  {aiExplanation && (
                    <Sparkles className="h-3 w-3 text-purple-400 ml-auto" />
                  )}
                </div>
                <p className="text-xs text-gray-700 dark:text-white/70 text-left leading-relaxed">
                  {renderTextWithLinks(explanation)}
                </p>
              </div>
            </div>
          );
        })()}

      {/* Over/Under Analysis */}
      {hasOu &&
        (() => {
          const isOver = raw.ou_result_prob! > 0.5;
          const confidencePct = Math.round(
            (isOver ? raw.ou_result_prob! : 1 - raw.ou_result_prob!) * 100
          );
          const confidenceColorClass =
            confidencePct <= 58
              ? 'text-red-400'
              : confidencePct <= 65
                ? 'text-orange-400'
                : 'text-green-400';
          const confidenceBgClass =
            confidencePct <= 58
              ? 'bg-red-100 dark:bg-red-500/10 border-red-300 dark:border-red-500/20'
              : confidencePct <= 65
                ? 'bg-orange-100 dark:bg-orange-500/10 border-orange-300 dark:border-orange-500/20'
                : 'bg-green-100 dark:bg-green-500/10 border-green-300 dark:border-green-500/20';
          const confidenceLabel =
            confidencePct <= 58
              ? 'Low Confidence'
              : confidencePct <= 65
                ? 'Moderate Confidence'
                : 'High Confidence';
          const arrow = isOver ? '▲' : '▼';
          const arrowColor = isOver ? 'text-green-400' : 'text-red-400';
          const arrowBg = isOver
            ? 'bg-green-100 dark:bg-green-500/10 border-green-300 dark:border-green-500/20'
            : 'bg-red-100 dark:bg-red-500/10 border-red-300 dark:border-red-500/20';
          const label = isOver ? 'Over' : 'Under';
          const totalPoints = raw.over_line;
          const isFadeAlert = confidencePct >= 80;

          const aiExplanation = completions['ou_prediction'];
          const staticExplanation =
            confidencePct <= 58
              ? `For this bet to win, the combined score needs to be ${isOver ? 'MORE' : 'LESS'} than ${totalPoints} points. With ${confidencePct}% confidence, this is a coin flip.`
              : confidencePct <= 65
                ? `For this bet to win, the combined score needs to be ${isOver ? 'MORE' : 'LESS'} than ${totalPoints} points. The model gives this a ${confidencePct}% chance.`
                : `For this bet to win, the combined score needs to be ${isOver ? 'MORE' : 'LESS'} than ${totalPoints} points. With ${confidencePct}% confidence, the model expects a ${isOver ? 'high-scoring' : 'low-scoring'} game.`;

          const explanation = aiExplanation || staticExplanation;
          const ouDiff = raw.over_line_diff ?? null;

          const confidenceTile = (
            <div
              className={`${confidenceBgClass} backdrop-blur-sm rounded-lg border p-3 flex w-full flex-col items-center justify-center`}
            >
              <div className={`text-2xl sm:text-3xl font-extrabold leading-tight ${confidenceColorClass}`}>
                {confidencePct}%
              </div>
              <div className="text-xs text-gray-600 dark:text-white/60 font-medium mt-1">
                {confidenceLabel}
              </div>
            </div>
          );

          return (
            <div className="space-y-3">
              <div className="flex items-center justify-center gap-2">
                <TrendingUp className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <h5 className="text-sm font-semibold text-gray-800 dark:text-white/90">
                  Over / Under
                </h5>
                {ouDiff !== null && !isNaN(ouDiff) && (
                  <EdgePill
                    text={`${ouDiff > 0 ? 'Over' : 'Under'} +${formatEdge(ouDiff)}`}
                    magnitude={Math.abs(ouDiff)}
                  />
                )}
              </div>
              <div className="grid grid-cols-2 items-stretch gap-3">
                <div
                  className={`${arrowBg} backdrop-blur-sm rounded-lg border p-3 flex flex-col items-center justify-center`}
                >
                  <div className={`text-4xl sm:text-5xl font-black ${arrowColor}`}>{arrow}</div>
                  <div className="mt-2 text-sm sm:text-base font-semibold text-gray-900 dark:text-white text-center">
                    {label} {raw.over_line || '-'}
                  </div>
                </div>
                {isFadeAlert ? (
                  <FadeAlertWrap accent="purple">{confidenceTile}</FadeAlertWrap>
                ) : (
                  confidenceTile
                )}
              </div>
              <div className="bg-gray-100 dark:bg-white/5 backdrop-blur-sm rounded-lg border border-gray-200 dark:border-white/10 p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Info className="h-3 w-3 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                  <h6 className="text-xs font-semibold text-gray-900 dark:text-white">
                    What This Means
                  </h6>
                  {aiExplanation && (
                    <Sparkles className="h-3 w-3 text-purple-400 ml-auto" />
                  )}
                </div>
                <p className="text-xs text-gray-700 dark:text-white/70 text-left leading-relaxed">
                  {renderTextWithLinks(explanation)}
                </p>
              </div>
            </div>
          );
        })()}
    </WidgetCard>
  );
}
