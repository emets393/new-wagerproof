import * as React from 'react';
import { Brain, Target, BarChart, Info, Sparkles } from 'lucide-react';
import { WidgetCard } from '@/components/ios';
import { getContrastingTextColor } from '@/utils/teamColors';
import { renderTextWithLinks } from '@/utils/markdownLinks';
import {
  roundToHalf,
  formatHalfNoSign,
  getEdgeInfo,
  getEdgeExplanation,
} from '../../edgeExplanations';
import type { NBAPrediction } from '../../../api/nbaGames';
import type { GameFeedItem, TeamRef } from '../../../types';

/**
 * NBA Model Predictions, ported from GameDetailsModal's NBA block
 * (spread edge + O/U edge with AI "What This Means" text). Completion keys:
 * 'spread_prediction' and 'ou_prediction'.
 */

const formatSignedHalf = (value: number | null | undefined): string => {
  if (value === null || value === undefined || isNaN(Number(value))) return 'N/A';
  const rounded = roundToHalf(Number(value));
  if (rounded > 0) return `+${rounded}`;
  return rounded.toString();
};

/** Edge-team circle: adapter logo with initials fallback on load error. */
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

interface NbaPredictionsSectionProps {
  game: GameFeedItem;
  completions: Record<string, string>;
}

export function NbaPredictionsSection({ game, completions }: NbaPredictionsSectionProps) {
  const raw = game.raw as unknown as NBAPrediction;

  const homeSpreadDiff = raw.home_spread_diff ?? null;
  const overLineDiff = raw.over_line_diff ?? null;
  const predSpread = (raw.pred_spread as number | null | undefined) ?? null;
  const predOverLine = (raw.pred_over_line as number | null | undefined) ?? null;

  // Same gate as the modal: nothing to say without at least one delta.
  if (homeSpreadDiff === null && overLineDiff === null) return null;

  return (
    <WidgetCard icon={<Brain />} title="Model Predictions">
      <div className="space-y-3">
        {/* Spread Edge Display */}
        {(() => {
          const edgeInfo = getEdgeInfo(homeSpreadDiff, raw.away_team, raw.home_team);

          if (!edgeInfo) {
            return null;
          }

          const edgeTeam = edgeInfo.isHomeEdge ? game.homeTeam : game.awayTeam;
          const aiExplanation = completions['spread_prediction'];
          const staticExplanation = getEdgeExplanation(edgeInfo.edgeValue, edgeInfo.teamName, 'spread');

          return (
            <>
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
                    <div className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
                      {formatSignedHalf(
                        edgeInfo.isHomeEdge ? predSpread : predSpread !== null ? -predSpread : null
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Spread Explanation */}
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
            </>
          );
        })()}

        {/* Over/Under Edge Display */}
        {(() => {
          const ouDiff = overLineDiff;
          const hasOuData = ouDiff !== null;

          if (!hasOuData) {
            return null;
          }

          const isOver = (ouDiff ?? 0) > 0;
          const magnitude = Math.abs(ouDiff ?? 0);
          const displayMagnitude = roundToHalf(magnitude).toString();

          const aiExplanation = completions['ou_prediction'];
          const staticExplanation = getEdgeExplanation(magnitude, '', 'ou', isOver ? 'over' : 'under');

          return (
            <>
              <div
                className={`rounded-xl border p-3 sm:p-4 backdrop-blur-sm shadow-sm ${
                  isOver ? 'bg-green-500/10 border-green-500/20' : 'bg-red-500/10 border-red-500/20'
                }`}
              >
                <div className="flex items-center justify-center gap-2 mb-3 pb-2 border-b border-gray-200 dark:border-white/10">
                  <BarChart className="h-4 w-4 text-orange-400" />
                  <h5 className="text-sm font-semibold text-gray-800 dark:text-white/90">Over/Under</h5>
                </div>

                <div className="flex items-center justify-between gap-4">
                  <div
                    className={`flex-shrink-0 rounded-lg p-3 ${
                      isOver ? 'bg-green-500/20' : 'bg-red-500/20'
                    }`}
                  >
                    <div
                      className={`text-3xl sm:text-4xl font-black ${
                        isOver ? 'text-green-400' : 'text-red-400'
                      }`}
                    >
                      {isOver ? '▲' : '▼'}
                    </div>
                    <div className="text-xs text-gray-600 dark:text-white/60 mt-1">
                      {isOver ? 'Over' : 'Under'}
                    </div>
                  </div>

                  <div className="text-center flex-1">
                    <div className="text-xs text-gray-600 dark:text-white/60 mb-1">
                      Edge to {isOver ? 'Over' : 'Under'}
                    </div>
                    <div className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
                      +{displayMagnitude}
                    </div>
                  </div>

                  <div className="text-center flex-1">
                    <div className="text-xs text-gray-600 dark:text-white/60 mb-1">Model Total</div>
                    <div className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
                      {formatHalfNoSign(predOverLine)}
                    </div>
                  </div>
                </div>
              </div>

              {/* O/U Explanation */}
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
            </>
          );
        })()}
      </div>
    </WidgetCard>
  );
}
