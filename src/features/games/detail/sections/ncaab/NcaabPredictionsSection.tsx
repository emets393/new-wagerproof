import * as React from 'react';
import { Brain, Target, BarChart, Info, Sparkles, ChevronUp, ChevronDown } from 'lucide-react';
import { WidgetCard } from '@/components/ios';
import { getContrastingTextColor } from '@/utils/teamColors';
import { renderTextWithLinks } from '@/utils/markdownLinks';
import {
  roundToHalf,
  formatHalfNoSign,
  getEdgeInfo,
  getEdgeExplanation,
} from '../../edgeExplanations';
import type { NCAABPrediction } from '../../../api/ncaabGames';
import type { GameFeedItem, TeamRef } from '../../../types';

/**
 * NCAAB Model Predictions, ported from GameDetailsModal's CFB/NCAAB block
 * (NCAAB branch): spread edge + O/U edge with explicit fallback cards when a
 * delta can't be computed. Completion keys: 'spread_prediction' and
 * 'ou_prediction'.
 */

const formatSignedHalf = (value: number | null | undefined): string => {
  if (value === null || value === undefined || isNaN(Number(value))) return 'N/A';
  const rounded = roundToHalf(Number(value));
  if (rounded > 0) return `+${rounded}`;
  return rounded.toString();
};

/** Edge-team circle: adapter logo (getNcaabLogo via TeamRef) with initials fallback. */
function EdgeTeamDisc({ team }: { team: TeamRef }) {
  const [imgFailed, setImgFailed] = React.useState(false);
  React.useEffect(() => setImgFailed(false), [team.logoUrl]);

  const hasLogo =
    !!team.logoUrl && team.logoUrl !== '/placeholder.svg' && team.logoUrl.trim() !== '' && !imgFailed;

  return (
    <div
      className="h-12 w-12 sm:h-16 sm:w-16 rounded-full flex items-center justify-center border-2 transition-transform duration-200 hover:scale-105 shadow-lg overflow-hidden"
      style={{
        background: hasLogo
          ? 'transparent'
          : `linear-gradient(135deg, ${team.colors.primary}, ${team.colors.secondary})`,
        borderColor: `${team.colors.primary}`,
      }}
    >
      {hasLogo ? (
        <img
          src={team.logoUrl as string}
          alt={team.name}
          className="w-full h-full object-contain p-1"
          onError={() => setImgFailed(true)}
        />
      ) : (
        <span
          className="text-xs sm:text-sm font-bold drop-shadow-md"
          style={{ color: getContrastingTextColor(team.colors.primary, team.colors.secondary) }}
        >
          {team.abbrev}
        </span>
      )}
    </div>
  );
}

interface NcaabPredictionsSectionProps {
  game: GameFeedItem;
  completions: Record<string, string>;
}

export function NcaabPredictionsSection({ game, completions }: NcaabPredictionsSectionProps) {
  const raw = game.raw as unknown as NCAABPrediction;

  const homeSpreadDiff = raw.home_spread_diff ?? null;
  const overLineDiff = raw.over_line_diff ?? null;
  const predSpread = (raw.pred_spread as number | null | undefined) ?? null;
  const predOverLine = (raw.pred_over_line as number | null | undefined) ?? null;
  const apiOverLine = (raw.api_over_line as number | null | undefined) ?? null;

  // Same gate as the modal's CFB/NCAAB block.
  if (
    predSpread === null &&
    homeSpreadDiff === null &&
    predOverLine === null &&
    overLineDiff === null
  ) {
    return null;
  }

  return (
    <WidgetCard icon={<Brain />} title="Model Predictions">
      <div className="space-y-3">
        {/* Spread Edge Display */}
        {(() => {
          const edgeInfo = getEdgeInfo(homeSpreadDiff, raw.away_team, raw.home_team);

          if (!edgeInfo) {
            return (
              <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-gray-200 dark:border-white/20 p-3 sm:p-4">
                <div className="text-center">
                  <div className="flex items-center justify-center gap-2 mb-2 pb-1.5 border-b border-gray-200 dark:border-white/10">
                    <Target className="h-4 w-4 text-green-400" />
                    <h5 className="text-sm font-semibold text-gray-800 dark:text-white/90">Spread</h5>
                  </div>
                  <div className="text-xs text-gray-600 dark:text-white/60">
                    Edge calculation unavailable
                  </div>
                  <div className="mt-2">
                    <div className="text-xs font-semibold text-gray-700 dark:text-white/80 mb-1">
                      Model Spread
                    </div>
                    <div className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
                      {formatSignedHalf(predSpread)}
                    </div>
                  </div>
                </div>
              </div>
            );
          }

          const edgeTeam = edgeInfo.isHomeEdge ? game.homeTeam : game.awayTeam;

          return (
            <div className="bg-green-500/10 backdrop-blur-sm rounded-xl border border-green-500/20 shadow-sm p-3 sm:p-4">
              <div className="flex items-center justify-center gap-2 mb-3 pb-2 border-b border-gray-200 dark:border-white/10">
                <Target className="h-4 w-4 text-green-400" />
                <h5 className="text-sm font-semibold text-gray-800 dark:text-white/90">Spread</h5>
              </div>

              <div className="flex items-center justify-between gap-4">
                <div className="flex-shrink-0">
                  <EdgeTeamDisc team={edgeTeam} />
                </div>

                <div className="text-center flex-1">
                  <div className="text-xs text-gray-600 dark:text-white/60 mb-1">
                    Edge to {edgeTeam.abbrev}
                  </div>
                  <div className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
                    {edgeInfo.displayEdge}
                  </div>
                </div>

                <div className="text-center flex-1">
                  <div className="text-xs text-gray-600 dark:text-white/60 mb-1">Model Spread</div>
                  {(() => {
                    // Modal quirk kept: display sign flips to the edge team's perspective.
                    let modelSpreadDisplay = predSpread;
                    if (!edgeInfo.isHomeEdge) {
                      if (modelSpreadDisplay !== null) modelSpreadDisplay = -modelSpreadDisplay;
                    }
                    return (
                      <div className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
                        {formatSignedHalf(modelSpreadDisplay)}
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>
          );
        })()}

        {/* Spread Explanation */}
        {(() => {
          const edgeInfo = getEdgeInfo(homeSpreadDiff, raw.away_team, raw.home_team);
          const aiExplanation = completions['spread_prediction'];

          // Show if we have AI completion OR edge info
          if (!aiExplanation && !edgeInfo) return null;

          const staticExplanation = edgeInfo
            ? getEdgeExplanation(edgeInfo.edgeValue, edgeInfo.teamName, 'spread')
            : 'Our model has analyzed this spread prediction.';

          return (
            <div className="bg-white/5 backdrop-blur-sm rounded-lg border border-gray-200 dark:border-white/10 p-3">
              <div className="flex items-center gap-2 mb-2">
                <Info className="h-3 w-3 text-blue-400 flex-shrink-0" />
                <h6 className="text-xs font-semibold text-gray-900 dark:text-white">What This Means</h6>
                {aiExplanation && <Sparkles className="h-3 w-3 text-purple-400 ml-auto" />}
              </div>
              <p className="text-xs text-gray-700 dark:text-white/70 text-left leading-relaxed">
                {renderTextWithLinks(aiExplanation || staticExplanation)}
              </p>
            </div>
          );
        })()}

        {/* Over/Under Edge Display */}
        {(() => {
          const ouDiff = overLineDiff;
          const hasOuData = ouDiff !== null || predOverLine !== null || apiOverLine !== null;

          if (!hasOuData) {
            return (
              <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-gray-200 dark:border-white/20 p-3 sm:p-4">
                <div className="text-center">
                  <div className="flex items-center justify-center gap-2 mb-2 pb-1.5 border-b border-gray-200 dark:border-white/10">
                    <BarChart className="h-4 w-4 text-orange-400" />
                    <h5 className="text-sm font-semibold text-gray-800 dark:text-white/90">Over/Under</h5>
                  </div>
                  <div className="text-xs text-gray-600 dark:text-white/60">No O/U data available</div>
                </div>
              </div>
            );
          }

          const isOver = (ouDiff ?? 0) > 0;
          const magnitude = Math.abs(ouDiff ?? 0);
          const displayMagnitude = roundToHalf(magnitude).toString();
          const modelValue = predOverLine;

          return (
            <div
              className={`rounded-xl border p-3 sm:p-4 backdrop-blur-sm shadow-sm ${
                isOver ? 'bg-green-500/10 border-green-500/20' : 'bg-red-500/10 border-red-500/20'
              }`}
            >
              <div className="flex items-center justify-center gap-2 mb-3 pb-2 border-b border-gray-200 dark:border-white/10">
                <BarChart className={`h-4 w-4 ${isOver ? 'text-green-400' : 'text-red-400'}`} />
                <h5 className="text-sm font-semibold text-gray-800 dark:text-white/90">Over/Under</h5>
              </div>

              <div className="flex items-center justify-between gap-4">
                <div className="flex-shrink-0">
                  {isOver ? (
                    <div className="flex flex-col items-center">
                      <ChevronUp className="h-12 w-12 sm:h-16 sm:w-16 text-green-400" />
                      <div className="text-xs font-bold text-green-400 -mt-1">Over</div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center">
                      <ChevronDown className="h-12 w-12 sm:h-16 sm:w-16 text-red-400" />
                      <div className="text-xs font-bold text-red-400 -mt-1">Under</div>
                    </div>
                  )}
                </div>

                <div className="text-center flex-1">
                  <div className="text-xs text-gray-600 dark:text-white/60 mb-1">
                    Edge to {isOver ? 'Over' : 'Under'}
                  </div>
                  <div className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
                    {displayMagnitude}
                  </div>
                </div>

                <div className="text-center flex-1">
                  <div className="text-xs text-gray-600 dark:text-white/60 mb-1">Model O/U</div>
                  <div className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
                    {formatHalfNoSign(modelValue)}
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        {/* O/U Explanation */}
        {(() => {
          const ouDiff = overLineDiff;
          const hasOuData = ouDiff !== null || predOverLine !== null || apiOverLine !== null;
          const aiExplanation = completions['ou_prediction'];

          // Show if we have AI completion OR OU data
          if (!aiExplanation && !hasOuData) return null;

          const isOver = (ouDiff ?? 0) > 0;
          const magnitude = Math.abs(ouDiff ?? 0);
          const staticExplanation = hasOuData
            ? getEdgeExplanation(magnitude, '', 'ou', isOver ? 'over' : 'under')
            : 'Our model has analyzed this over/under prediction.';

          return (
            <div className="bg-white/5 backdrop-blur-sm rounded-lg border border-gray-200 dark:border-white/10 p-3">
              <div className="flex items-center gap-2 mb-2">
                <Info className="h-3 w-3 text-blue-400 flex-shrink-0" />
                <h6 className="text-xs font-semibold text-gray-900 dark:text-white">What This Means</h6>
                {aiExplanation && <Sparkles className="h-3 w-3 text-purple-400 ml-auto" />}
              </div>
              <p className="text-xs text-gray-700 dark:text-white/70 text-left leading-relaxed">
                {renderTextWithLinks(aiExplanation || staticExplanation)}
              </p>
            </div>
          );
        })()}
      </div>
    </WidgetCard>
  );
}
