import { BarChart, Brain, ChevronDown, ChevronUp, Info, Sparkles, Target } from 'lucide-react';
import { WidgetCard } from '@/components/ios';
import { renderTextWithLinks } from '@/utils/markdownLinks';
import { getContrastingTextColor } from '@/utils/teamColors';
import {
  formatHalfNoSign,
  getEdgeExplanation,
  getEdgeInfo,
  roundToHalf,
} from '../../edgeExplanations';
import {
  getCFBTeamColors,
  getCFBTeamInitials,
  getCFBTeamLogo,
  type CFBPrediction,
  type CFBTeamMapping,
} from '../../../api/cfbGames';
import type { GameFeedItem } from '../../../types';

// Verbatim from GameDetailsModal's CFB helpers — signed display for the model spread.
const formatSignedHalf = (value: number | null | undefined): string => {
  if (value === null || value === undefined || isNaN(Number(value))) return 'N/A';
  const rounded = roundToHalf(Number(value));
  if (rounded > 0) return `+${rounded}`;
  return rounded.toString();
};

interface CfbPredictionsSectionProps {
  game: GameFeedItem<CFBPrediction>;
  teamMappings: CFBTeamMapping[];
  /** AI completion texts for this game, keyed by widget type. */
  completions: Record<string, string>;
}

/**
 * Regular-mode CFB Model Predictions — port of the CFB/NCAAB branch of
 * GameDetailsModal (~836-1093): spread edge + explanation, O/U edge +
 * explanation, with AI completion text overriding the static copy.
 */
export function CfbPredictionsSection({ game, teamMappings, completions }: CfbPredictionsSectionProps) {
  const prediction = game.raw;

  // Normalize undefined → null so the legacy `!== null` gates stay correct off-season.
  const predSpread = prediction.pred_spread ?? null;
  const homeSpreadDiff = prediction.home_spread_diff ?? null;
  const predOverLine = prediction.pred_over_line ?? null;
  const overLineDiff = prediction.over_line_diff ?? null;
  const apiOverLine = prediction.api_over_line ?? null;

  const hasAnyModelData =
    predSpread !== null || homeSpreadDiff !== null || predOverLine !== null || overLineDiff !== null;
  if (!hasAnyModelData) return null;

  const spreadAi = completions['spread_prediction'];
  const ouAi = completions['ou_prediction'];

  const edgeInfo = getEdgeInfo(homeSpreadDiff, prediction.away_team, prediction.home_team);

  const hasOuData = overLineDiff !== null || predOverLine !== null || apiOverLine !== null;
  const isOver = (overLineDiff ?? 0) > 0;
  const ouMagnitude = Math.abs(overLineDiff ?? 0);

  return (
    <WidgetCard icon={<Brain />} title="Model Predictions">
      <div className="space-y-3">
        {/* Spread Edge Display */}
        {!edgeInfo ? (
          <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-gray-200 dark:border-white/20 p-3 sm:p-4">
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 mb-2 pb-1.5 border-b border-gray-200 dark:border-white/10">
                <Target className="h-4 w-4 text-green-500 dark:text-green-400" />
                <h5 className="text-sm font-semibold text-gray-800 dark:text-white/90">Spread</h5>
              </div>
              <div className="text-xs text-gray-600 dark:text-white/60">Edge calculation unavailable</div>
              <div className="mt-2">
                <div className="text-xs font-semibold text-gray-700 dark:text-white/80 mb-1">Model Spread</div>
                <div className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
                  {formatSignedHalf(predSpread)}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-green-500/10 backdrop-blur-sm rounded-xl border border-green-500/20 shadow-sm p-3 sm:p-4">
            <div className="flex items-center justify-center gap-2 mb-3 pb-2 border-b border-gray-200 dark:border-white/10">
              <Target className="h-4 w-4 text-green-500 dark:text-green-400" />
              <h5 className="text-sm font-semibold text-gray-800 dark:text-white/90">Spread</h5>
            </div>

            <div className="flex items-center justify-between gap-4">
              <div className="flex-shrink-0">
                <EdgeTeamLogo teamName={edgeInfo.teamName} teamMappings={teamMappings} />
              </div>

              <div className="text-center flex-1">
                <div className="text-xs text-gray-600 dark:text-white/60 mb-1">
                  Edge to {getCFBTeamInitials(edgeInfo.teamName)}
                </div>
                <div className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
                  {edgeInfo.displayEdge}
                </div>
              </div>

              <div className="text-center flex-1">
                <div className="text-xs text-gray-600 dark:text-white/60 mb-1">Model Spread</div>
                {(() => {
                  // Legacy sign flip: model spread is home-relative; mirror it when the edge team is away.
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
        )}

        {/* Spread Explanation */}
        {(spreadAi || edgeInfo) && (
          <ExplanationCard
            aiExplanation={spreadAi}
            staticExplanation={
              edgeInfo
                ? getEdgeExplanation(edgeInfo.edgeValue, edgeInfo.teamName, 'spread')
                : 'Our model has analyzed this spread prediction.'
            }
          />
        )}

        {/* Over/Under Edge Display */}
        {!hasOuData ? (
          <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-gray-200 dark:border-white/20 p-3 sm:p-4">
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 mb-2 pb-1.5 border-b border-gray-200 dark:border-white/10">
                <BarChart className="h-4 w-4 text-orange-500 dark:text-orange-400" />
                <h5 className="text-sm font-semibold text-gray-800 dark:text-white/90">Over/Under</h5>
              </div>
              <div className="text-xs text-gray-600 dark:text-white/60">No O/U data available</div>
            </div>
          </div>
        ) : (
          <div
            className={`rounded-xl border p-3 sm:p-4 backdrop-blur-sm shadow-sm ${
              isOver ? 'bg-green-500/10 border-green-500/20' : 'bg-red-500/10 border-red-500/20'
            }`}
          >
            <div className="flex items-center justify-center gap-2 mb-3 pb-2 border-b border-gray-200 dark:border-white/10">
              <BarChart className={`h-4 w-4 ${isOver ? 'text-green-500 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`} />
              <h5 className="text-sm font-semibold text-gray-800 dark:text-white/90">Over/Under</h5>
            </div>

            <div className="flex items-center justify-between gap-4">
              <div className="flex-shrink-0">
                {isOver ? (
                  <div className="flex flex-col items-center">
                    <ChevronUp className="h-12 w-12 sm:h-16 sm:w-16 text-green-500 dark:text-green-400" />
                    <div className="text-xs font-bold text-green-500 dark:text-green-400 -mt-1">Over</div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center">
                    <ChevronDown className="h-12 w-12 sm:h-16 sm:w-16 text-red-500 dark:text-red-400" />
                    <div className="text-xs font-bold text-red-500 dark:text-red-400 -mt-1">Under</div>
                  </div>
                )}
              </div>

              <div className="text-center flex-1">
                <div className="text-xs text-gray-600 dark:text-white/60 mb-1">
                  Edge to {isOver ? 'Over' : 'Under'}
                </div>
                <div className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
                  {roundToHalf(ouMagnitude).toString()}
                </div>
              </div>

              <div className="text-center flex-1">
                <div className="text-xs text-gray-600 dark:text-white/60 mb-1">Model O/U</div>
                <div className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
                  {formatHalfNoSign(predOverLine)}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* O/U Explanation */}
        {(ouAi || hasOuData) && (
          <ExplanationCard
            aiExplanation={ouAi}
            staticExplanation={
              hasOuData
                ? getEdgeExplanation(ouMagnitude, '', 'ou', isOver ? 'over' : 'under')
                : 'Our model has analyzed this over/under prediction.'
            }
          />
        )}
      </div>
    </WidgetCard>
  );
}

/** "What This Means" block — AI completion text (with markdown links) wins over the static copy. */
function ExplanationCard({
  aiExplanation,
  staticExplanation,
}: {
  aiExplanation: string | undefined;
  staticExplanation: string;
}) {
  return (
    <div className="bg-white/5 backdrop-blur-sm rounded-lg border border-gray-200 dark:border-white/10 p-3">
      <div className="flex items-center gap-2 mb-2">
        <Info className="h-3 w-3 text-blue-500 dark:text-blue-400 flex-shrink-0" />
        <h6 className="text-xs font-semibold text-gray-900 dark:text-white">What This Means</h6>
        {aiExplanation && <Sparkles className="h-3 w-3 text-purple-500 dark:text-purple-400 ml-auto" />}
      </div>
      <p className="text-xs text-gray-700 dark:text-white/70 text-left leading-relaxed">
        {renderTextWithLinks(aiExplanation || staticExplanation)}
      </p>
    </div>
  );
}

/** Team logo disc with the legacy DOM onError fallback to gradient + initials. */
function EdgeTeamLogo({
  teamName,
  teamMappings,
}: {
  teamName: string;
  teamMappings: CFBTeamMapping[];
}) {
  const teamColors = getCFBTeamColors(teamName);
  const logoUrl = getCFBTeamLogo(teamName, teamMappings);
  const hasLogo = !!logoUrl && logoUrl !== '/placeholder.svg' && logoUrl.trim() !== '';

  return (
    <div
      className="h-12 w-12 sm:h-16 sm:w-16 rounded-full flex items-center justify-center border-2 transition-transform duration-200 hover:scale-105 shadow-lg overflow-hidden"
      style={{
        background: hasLogo
          ? 'transparent'
          : `linear-gradient(135deg, ${teamColors.primary}, ${teamColors.secondary})`,
        borderColor: `${teamColors.primary}`,
      }}
    >
      {hasLogo ? (
        <img
          src={logoUrl}
          alt={teamName}
          className="w-full h-full object-contain p-1"
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            target.style.display = 'none';
            const parent = target.parentElement;
            if (parent && !parent.querySelector('.fallback-initials')) {
              const fallback = document.createElement('span');
              fallback.className = 'text-xs sm:text-sm font-bold drop-shadow-md fallback-initials';
              fallback.style.color = getContrastingTextColor(teamColors.primary, teamColors.secondary);
              fallback.textContent = getCFBTeamInitials(teamName);
              parent.style.background = `linear-gradient(135deg, ${teamColors.primary}, ${teamColors.secondary})`;
              parent.appendChild(fallback);
            }
          }}
        />
      ) : (
        <span
          className="text-xs sm:text-sm font-bold drop-shadow-md"
          style={{ color: getContrastingTextColor(teamColors.primary, teamColors.secondary) }}
        >
          {getCFBTeamInitials(teamName)}
        </span>
      )}
    </div>
  );
}
