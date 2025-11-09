import { Dispatch, SetStateAction, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Button as MovingBorderButton } from '@/components/ui/moving-border';
import { Brain, Target, BarChart, Info, Sparkles, ChevronUp, ChevronDown, TrendingUp, Users, CloudRain } from 'lucide-react';
import { getCFBTeamColors, getNFLTeamColors } from '@/utils/teamColors';
import { WeatherIcon as WeatherIconComponent, IconWind } from '@/utils/weatherIcons';
import HistoricalDataSection from './HistoricalDataSection';

interface GameDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  prediction: any;
  league: 'cfb' | 'nfl';
  aiCompletions: Record<string, Record<string, string>>;
  simLoadingById: Record<string, boolean>;
  simRevealedById: Record<string, boolean>;
  setSimLoadingById: Dispatch<SetStateAction<Record<string, boolean>>>;
  setSimRevealedById: Dispatch<SetStateAction<Record<string, boolean>>>;
  focusedCardId: string | null;
  getTeamInitials: (teamName: string) => string;
  getContrastingTextColor: (bgColor1: string, bgColor2: string) => string;
  // NFL-specific props
  getFullTeamName?: (teamCity: string) => { city: string; name: string };
  formatSpread?: (spread: number | null) => string;
  parseBettingSplit?: (label: string | null) => {
    team: string;
    percentage: number;
    isSharp: boolean;
    isPublic: boolean;
    direction?: string;
  } | null;
  expandedBettingFacts?: Record<string, boolean>;
  setExpandedBettingFacts?: Dispatch<SetStateAction<Record<string, boolean>>>;
  // NFL-specific callbacks for HistoricalDataSection
  onH2HClick?: () => void;
  onLinesClick?: () => void;
}

export function GameDetailsModal({
  isOpen,
  onClose,
  prediction,
  league,
  aiCompletions,
  simLoadingById,
  simRevealedById,
  setSimLoadingById,
  setSimRevealedById,
  focusedCardId,
  getTeamInitials,
  getContrastingTextColor,
  getFullTeamName,
  formatSpread,
  parseBettingSplit,
  expandedBettingFacts,
  setExpandedBettingFacts,
  onH2HClick,
  onLinesClick,
}: GameDetailsModalProps) {
  if (!prediction) return null;

  const [localExpandedBettingFacts, setLocalExpandedBettingFacts] = useState(false);
  const effectiveExpandedBettingFacts = expandedBettingFacts || {};
  const effectiveSetExpandedBettingFacts = setExpandedBettingFacts || (() => {});

  // Helper functions for CFB
  const roundToHalf = (value: number): number => {
    return Math.round(value * 2) / 2;
  };

  const formatSignedHalf = (value: number | null | undefined): string => {
    if (value === null || value === undefined || isNaN(Number(value))) return 'N/A';
    const rounded = roundToHalf(Number(value));
    if (rounded > 0) return `+${rounded}`;
    return rounded.toString();
  };

  const formatHalfNoSign = (value: number | null | undefined): string => {
    if (value === null || value === undefined || isNaN(Number(value))) return 'N/A';
    const rounded = roundToHalf(Number(value));
    return rounded.toString();
  };

  const formatEdge = (edge: number): string => {
    const roundedEdge = roundToHalf(Math.abs(edge));
    return roundedEdge.toString();
  };

  const getEdgeInfo = (homeSpreadDiff: number | null, awayTeam: string, homeTeam: string) => {
    if (homeSpreadDiff === null || isNaN(homeSpreadDiff)) return null;
    
    const isHomeEdge = homeSpreadDiff > 0;
    const teamName = isHomeEdge ? homeTeam : awayTeam;
    const edgeValue = Math.abs(homeSpreadDiff);
    
    return {
      teamName,
      edgeValue: roundToHalf(edgeValue),
      isHomeEdge,
      displayEdge: formatEdge(homeSpreadDiff)
    };
  };

  const getEdgeExplanation = (edge: number, team: string, type: 'spread' | 'ou', direction?: 'over' | 'under'): string => {
    const absEdge = Math.abs(edge);
    
    if (type === 'spread') {
      if (absEdge >= 7) {
        return `Our model spread differs from the Vegas line by ${absEdge.toFixed(1)} points, favoring ${team}. This large discrepancy suggests Vegas may have significantly mispriced this matchup.`;
      } else if (absEdge >= 3) {
        return `Our model's ${absEdge.toFixed(1)}-point difference from the Vegas spread favors ${team}. This moderate edge shows our analytics see the game differently than the market.`;
      } else {
        return `Our model differs from Vegas by ${absEdge.toFixed(1)} points on ${team}. This small edge indicates our projection is fairly close to the market's assessment.`;
      }
    } else {
      const dir = direction || 'over';
      if (absEdge >= 7) {
        return `Our model's projected total differs from the Vegas line by ${absEdge.toFixed(1)} points, leaning ${dir}. This significant gap suggests Vegas has mispriced this game's scoring potential.`;
      } else if (absEdge >= 3) {
        return `Our model projects a total that's ${absEdge.toFixed(1)} points different from Vegas, favoring the ${dir}. This moderate discrepancy shows our scoring projection doesn't align with the market.`;
      } else {
        return `Our model's total is ${absEdge.toFixed(1)} points from the Vegas line, slightly favoring the ${dir}. This minimal difference means our projection closely matches the market's assessment.`;
      }
    }
  };

  // Spinning football loader for simulator
  const FootballLoader = () => (
    <svg
      className="h-8 w-8 animate-spin mr-2"
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <ellipse cx="32" cy="32" rx="28" ry="18" fill="currentColor" className="text-orange-600" />
      <path d="M32 14 L32 50 M16 32 L48 32 M20 20 L44 44 M20 44 L44 20" stroke="white" strokeWidth="2" />
    </svg>
  );

  const getTeamColors = league === 'cfb' ? getCFBTeamColors : getNFLTeamColors;
  const awayTeamColors = getTeamColors(prediction.away_team);
  const homeTeamColors = getTeamColors(prediction.home_team);
  const gameId = prediction.training_key || prediction.unique_id || prediction.id || `${prediction.away_team}_${prediction.home_team}`;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">
            {prediction.away_team} @ {prediction.home_team}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* CFB Content */}
          {league === 'cfb' && (
            <>
              {/* Model Predictions Section */}
              {(prediction.pred_spread !== null || prediction.home_spread_diff !== null || prediction.pred_over_line !== null || prediction.over_line_diff !== null) && (
                <div className="text-center">
                  <div className="bg-white/5 backdrop-blur-sm p-4 rounded-lg border border-white/20 space-y-4">
                    <div className="flex items-center justify-center gap-2">
                      <Brain className="h-5 w-5 text-purple-400" />
                      <h4 className="text-lg font-bold text-gray-900 dark:text-white">Model Predictions</h4>
                    </div>

                    <div className="space-y-3">
                      {/* Spread Edge Display */}
                      {(() => {
                        const edgeInfo = getEdgeInfo(prediction.home_spread_diff, prediction.away_team, prediction.home_team);

                        if (!edgeInfo) {
                          return (
                            <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/20 p-3 sm:p-4">
                              <div className="text-center">
                                <div className="flex items-center justify-center gap-2 mb-2 pb-1.5 border-b border-white/10">
                                  <Target className="h-4 w-4 text-green-400" />
                                  <h5 className="text-sm font-semibold text-white/90">Spread</h5>
                                </div>
                                <div className="text-xs text-white/60">Edge calculation unavailable</div>
                                <div className="mt-2">
                                  <div className="text-xs font-semibold text-white/80 mb-1">Model Spread</div>
                                  <div className="text-xl sm:text-2xl font-bold text-white">
                                    {formatSignedHalf(prediction.pred_spread)}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        }

                        return (
                          <div className="bg-green-500/10 backdrop-blur-sm rounded-xl border border-green-500/20 shadow-sm p-3 sm:p-4">
                            <div className="flex items-center justify-center gap-2 mb-3 pb-2 border-b border-gray-200 dark:border-white/10">
                              <Target className="h-4 w-4 text-green-400" />
                              <h5 className="text-sm font-semibold text-gray-800 dark:text-white/90">Spread</h5>
                            </div>
                            
                            <div className="flex items-center justify-between gap-4">
                              <div className="flex-shrink-0">
                                {(() => {
                                  const teamColors = getTeamColors(edgeInfo.teamName);
                                  return (
                                    <div 
                                      className="h-12 w-12 sm:h-16 sm:w-16 rounded-full flex items-center justify-center border-2 transition-transform duration-200 hover:scale-105 shadow-lg"
                                      style={{
                                        background: `linear-gradient(135deg, ${teamColors.primary}, ${teamColors.secondary})`,
                                        borderColor: `${teamColors.primary}`
                                      }}
                                    >
                                      <span 
                                        className="text-xs sm:text-sm font-bold drop-shadow-md"
                                        style={{ color: getContrastingTextColor(teamColors.primary, teamColors.secondary) }}
                                      >
                                        {getTeamInitials(edgeInfo.teamName)}
                                      </span>
                                    </div>
                                  );
                                })()}
                              </div>

                              <div className="text-center flex-1">
                                <div className="text-xs text-gray-600 dark:text-white/60 mb-1">Edge to {getTeamInitials(edgeInfo.teamName)}</div>
                                <div className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
                                  {edgeInfo.displayEdge}
                                </div>
                              </div>

                              <div className="text-center flex-1">
                                <div className="text-xs text-gray-600 dark:text-white/60 mb-1">Model Spread</div>
                                {(() => {
                                  let modelSpreadDisplay = prediction.pred_spread;
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
                        const edgeInfo = getEdgeInfo(prediction.home_spread_diff, prediction.away_team, prediction.home_team);
                        if (!edgeInfo) return null;
                        
                        const aiExplanation = aiCompletions[gameId]?.['spread_prediction'];
                        const staticExplanation = getEdgeExplanation(edgeInfo.edgeValue, edgeInfo.teamName, 'spread');
                        
                        return (
                          <div className="bg-white/5 backdrop-blur-sm rounded-lg border border-gray-200 dark:border-white/10 p-3">
                            <div className="flex items-center gap-2 mb-2">
                              <Info className="h-3 w-3 text-blue-400 flex-shrink-0" />
                              <h6 className="text-xs font-semibold text-gray-900 dark:text-white">What This Means</h6>
                              {aiExplanation && (
                                <Sparkles className="h-3 w-3 text-purple-400 ml-auto" title="AI-powered analysis" />
                              )}
                            </div>
                            <p className="text-xs text-gray-700 dark:text-white/70 text-left leading-relaxed">
                              {aiExplanation || staticExplanation}
                            </p>
                          </div>
                        );
                      })()}

                      {/* Over/Under Edge Display */}
                      {(() => {
                        const ouDiff = prediction.over_line_diff;
                        const hasOuData = ouDiff !== null || prediction.pred_over_line !== null || prediction.api_over_line !== null;

                        if (!hasOuData) {
                          return (
                            <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/20 p-3 sm:p-4">
                              <div className="text-center">
                                <div className="flex items-center justify-center gap-2 mb-2 pb-1.5 border-b border-white/10">
                                  <BarChart className="h-4 w-4 text-orange-400" />
                                  <h5 className="text-sm font-semibold text-white/90">Over/Under</h5>
                                </div>
                                <div className="text-xs text-white/60">No O/U data available</div>
                              </div>
                            </div>
                          );
                        }

                        const isOver = (ouDiff ?? 0) > 0;
                        const magnitude = Math.abs(ouDiff ?? 0);
                        const displayMagnitude = roundToHalf(magnitude).toString();
                        const modelValue = prediction.pred_over_line;

                        return (
                          <div className={`rounded-xl border p-3 sm:p-4 backdrop-blur-sm shadow-sm ${
                            isOver 
                              ? 'bg-green-500/10 border-green-500/20' 
                              : 'bg-red-500/10 border-red-500/20'
                          }`}>
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
                                <div className="text-xs text-gray-600 dark:text-white/60 mb-1">Edge to {isOver ? 'Over' : 'Under'}</div>
                                <div className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">{displayMagnitude}</div>
                              </div>

                              <div className="text-center flex-1">
                                <div className="text-xs text-gray-600 dark:text-white/60 mb-1">Model O/U</div>
                                <div className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">{formatHalfNoSign(modelValue)}</div>
                              </div>
                            </div>
                          </div>
                        );
                      })()}

                      {/* O/U Explanation */}
                      {(() => {
                        const ouDiff = prediction.over_line_diff;
                        const hasOuData = ouDiff !== null || prediction.pred_over_line !== null || prediction.api_over_line !== null;
                        if (!hasOuData) return null;
                        
                        const isOver = (ouDiff ?? 0) > 0;
                        const magnitude = Math.abs(ouDiff ?? 0);
                        const aiExplanation = aiCompletions[gameId]?.['ou_prediction'];
                        const staticExplanation = getEdgeExplanation(magnitude, '', 'ou', isOver ? 'over' : 'under');
                        
                        return (
                          <div className="bg-white/5 backdrop-blur-sm rounded-lg border border-gray-200 dark:border-white/10 p-3">
                            <div className="flex items-center gap-2 mb-2">
                              <Info className="h-3 w-3 text-blue-400 flex-shrink-0" />
                              <h6 className="text-xs font-semibold text-gray-900 dark:text-white">What This Means</h6>
                              {aiExplanation && (
                                <Sparkles className="h-3 w-3 text-purple-400 ml-auto" title="AI-powered analysis" />
                              )}
                            </div>
                            <p className="text-xs text-gray-700 dark:text-white/70 text-left leading-relaxed">
                              {aiExplanation || staticExplanation}
                            </p>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* NFL Content */}
          {league === 'nfl' && getFullTeamName && formatSpread && parseBettingSplit && (
            <>
              {/* NFL Model Predictions */}
              <div className="text-center">
                <div className="bg-gray-50 dark:bg-white/5 backdrop-blur-sm p-4 rounded-lg border border-gray-200 dark:border-white/20 space-y-4">
                  <div className="flex items-center justify-center gap-2">
                    <Brain className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                    <h4 className="text-lg font-bold text-gray-900 dark:text-white">Model Predictions</h4>
                  </div>
                  
                  {/* Spread Predictions */}
                  {prediction.home_away_spread_cover_prob !== null && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-center gap-2">
                        <Target className="h-4 w-4 text-green-600 dark:text-green-400" />
                        <h5 className="text-sm font-semibold text-gray-800 dark:text-white/90">Spread</h5>
                      </div>
                      {(() => {
                        const isHome = prediction.home_away_spread_cover_prob > 0.5;
                        const predictedTeam = isHome ? prediction.home_team : prediction.away_team;
                        const predictedTeamColors = isHome ? homeTeamColors : awayTeamColors;
                        const predictedSpread = isHome ? prediction.home_spread : prediction.away_spread;
                        const confidencePct = Math.round((isHome ? prediction.home_away_spread_cover_prob : 1 - prediction.home_away_spread_cover_prob) * 100);
                        const confidenceColorClass =
                          confidencePct <= 58 ? 'text-red-400' :
                          confidencePct <= 65 ? 'text-orange-400' :
                          'text-green-400';
                        const confidenceBgClass =
                          confidencePct <= 58 ? 'bg-red-100 dark:bg-red-500/10 border-red-300 dark:border-red-500/20' :
                          confidencePct <= 65 ? 'bg-orange-100 dark:bg-orange-500/10 border-orange-300 dark:border-orange-500/20' :
                          'bg-green-100 dark:bg-green-500/10 border-green-300 dark:border-green-500/20';
                        const confidenceLabel =
                          confidencePct <= 58 ? 'Low Confidence' :
                          confidencePct <= 65 ? 'Moderate Confidence' :
                          'High Confidence';
                        const spreadValue = Math.abs(Number(predictedSpread));
                        const isNegativeSpread = Number(predictedSpread) < 0;
                        
                        const aiExplanation = aiCompletions[gameId]?.['spread_prediction'];
                        const staticExplanation =
                          confidencePct <= 58 
                            ? `For this bet to win, ${getFullTeamName(predictedTeam).city} needs to ${isNegativeSpread ? `win by more than ${spreadValue} points` : `either win the game or lose by fewer than ${spreadValue} points`}. With ${confidencePct}% confidence, this is a toss-up.`
                            : confidencePct <= 65
                            ? `For this bet to win, ${getFullTeamName(predictedTeam).city} needs to ${isNegativeSpread ? `win by more than ${spreadValue} points` : `either win the game or lose by fewer than ${spreadValue} points`}. The model gives this a ${confidencePct}% chance.`
                            : `For this bet to win, ${getFullTeamName(predictedTeam).city} needs to ${isNegativeSpread ? `win by more than ${spreadValue} points` : `either win the game or lose by fewer than ${spreadValue} points`}. With ${confidencePct}% confidence, the model sees a strong likelihood.`;
                        
                        const explanation = aiExplanation || staticExplanation;
                        
                        return (
                          <>
                            <div className="grid grid-cols-2 items-stretch gap-3">
                              <div className="bg-green-100 dark:bg-green-500/10 backdrop-blur-sm rounded-lg border border-green-300 dark:border-green-500/20 p-3 flex flex-col items-center justify-center">
                                <div 
                                  className="h-12 w-12 sm:h-16 sm:w-16 rounded-full flex items-center justify-center border-2 mb-2 shadow-lg"
                                  style={{
                                    background: `linear-gradient(135deg, ${predictedTeamColors.primary}, ${predictedTeamColors.secondary})`,
                                    borderColor: `${predictedTeamColors.primary}`
                                  }}
                                >
                                  <span 
                                    className="text-xs sm:text-sm font-bold drop-shadow-md"
                                    style={{ color: getContrastingTextColor(predictedTeamColors.primary, predictedTeamColors.secondary) }}
                                  >
                                    {getTeamInitials(predictedTeam)}
                                  </span>
                                </div>
                                <span className="text-xs sm:text-sm font-semibold text-gray-900 dark:text-white text-center leading-snug">
                                  {getFullTeamName(predictedTeam).city}
                                </span>
                                <span className="text-xs text-gray-600 dark:text-white/70">
                                  ({formatSpread(predictedSpread)})
                                </span>
                              </div>
                              <div className={`${confidenceBgClass} backdrop-blur-sm rounded-lg border p-3 flex flex-col items-center justify-center`}>
                                <div className={`text-2xl sm:text-3xl font-extrabold leading-tight ${confidenceColorClass}`}>
                                  {confidencePct}%
                                </div>
                                <div className="text-xs text-gray-600 dark:text-white/60 font-medium mt-1">{confidenceLabel}</div>
                              </div>
                            </div>
                            <div className="bg-gray-100 dark:bg-white/5 backdrop-blur-sm rounded-lg border border-gray-200 dark:border-white/10 p-3">
                              <div className="flex items-center gap-2 mb-2">
                                <Info className="h-3 w-3 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                                <h6 className="text-xs font-semibold text-gray-900 dark:text-white">What This Means</h6>
                              </div>
                              <p className="text-xs text-gray-700 dark:text-white/70 text-left leading-relaxed">
                                {explanation}
                              </p>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  )}

                  {/* Over/Under Analysis */}
                  {prediction.ou_result_prob !== null && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-center gap-2">
                        <TrendingUp className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                        <h5 className="text-sm font-semibold text-gray-800 dark:text-white/90">Over / Under</h5>
                      </div>
                      {(() => {
                        const isOver = prediction.ou_result_prob! > 0.5;
                        const confidencePct = Math.round((isOver ? prediction.ou_result_prob! : 1 - prediction.ou_result_prob!) * 100);
                        const confidenceColorClass =
                          confidencePct <= 58 ? 'text-red-400' :
                          confidencePct <= 65 ? 'text-orange-400' :
                          'text-green-400';
                        const confidenceBgClass =
                          confidencePct <= 58 ? 'bg-red-100 dark:bg-red-500/10 border-red-300 dark:border-red-500/20' :
                          confidencePct <= 65 ? 'bg-orange-100 dark:bg-orange-500/10 border-orange-300 dark:border-orange-500/20' :
                          'bg-green-100 dark:bg-green-500/10 border-green-300 dark:border-green-500/20';
                        const confidenceLabel =
                          confidencePct <= 58 ? 'Low Confidence' :
                          confidencePct <= 65 ? 'Moderate Confidence' :
                          'High Confidence';
                        const arrow = isOver ? '▲' : '▼';
                        const arrowColor = isOver ? 'text-green-400' : 'text-red-400';
                        const arrowBg = isOver ? 'bg-green-100 dark:bg-green-500/10 border-green-300 dark:border-green-500/20' : 'bg-red-100 dark:bg-red-500/10 border-red-300 dark:border-red-500/20';
                        const label = isOver ? 'Over' : 'Under';
                        const totalPoints = prediction.over_line;
                        
                        const aiExplanation = aiCompletions[gameId]?.['ou_prediction'];
                        const staticExplanation =
                          confidencePct <= 58 
                            ? `For this bet to win, the combined score needs to be ${isOver ? 'MORE' : 'LESS'} than ${totalPoints} points. With ${confidencePct}% confidence, this is a coin flip.`
                            : confidencePct <= 65
                            ? `For this bet to win, the combined score needs to be ${isOver ? 'MORE' : 'LESS'} than ${totalPoints} points. The model gives this a ${confidencePct}% chance.`
                            : `For this bet to win, the combined score needs to be ${isOver ? 'MORE' : 'LESS'} than ${totalPoints} points. With ${confidencePct}% confidence, the model expects a ${isOver ? 'high-scoring' : 'low-scoring'} game.`;
                        
                        const explanation = aiExplanation || staticExplanation;
                        
                        return (
                          <>
                            <div className="grid grid-cols-2 items-stretch gap-3">
                              <div className={`${arrowBg} backdrop-blur-sm rounded-lg border p-3 flex flex-col items-center justify-center`}>
                                <div className={`text-4xl sm:text-5xl font-black ${arrowColor}`}>{arrow}</div>
                                <div className="mt-2 text-sm sm:text-base font-semibold text-gray-900 dark:text-white text-center">
                                  {label} {prediction.over_line || '-'}
                                </div>
                              </div>
                              <div className={`${confidenceBgClass} backdrop-blur-sm rounded-lg border p-3 flex flex-col items-center justify-center`}>
                                <div className={`text-2xl sm:text-3xl font-extrabold leading-tight ${confidenceColorClass}`}>
                                  {confidencePct}%
                                </div>
                                <div className="text-xs text-gray-600 dark:text-white/60 font-medium mt-1">{confidenceLabel}</div>
                              </div>
                            </div>
                            <div className="bg-gray-100 dark:bg-white/5 backdrop-blur-sm rounded-lg border border-gray-200 dark:border-white/10 p-3">
                              <div className="flex items-center gap-2 mb-2">
                                <Info className="h-3 w-3 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                                <h6 className="text-xs font-semibold text-gray-900 dark:text-white">What This Means</h6>
                              </div>
                              <p className="text-xs text-gray-700 dark:text-white/70 text-left leading-relaxed">
                                {explanation}
                              </p>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  )}
                </div>
              </div>

              {/* Betting Split Labels Section for NFL */}
              {(prediction.ml_splits_label || prediction.spread_splits_label || prediction.total_splits_label) && (
                <div className="text-center">
                  <div className="bg-gray-50 dark:bg-white/5 backdrop-blur-sm p-4 rounded-lg border border-gray-200 dark:border-white/20 space-y-4">
                    <button
                      onClick={() => setLocalExpandedBettingFacts(!localExpandedBettingFacts)}
                      className="w-full flex items-center justify-center gap-2 group hover:opacity-80 transition-opacity"
                    >
                      <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                      <h4 className="text-lg font-bold text-gray-900 dark:text-white">Public Betting Facts</h4>
                      <motion.div
                        animate={{ rotate: localExpandedBettingFacts ? 180 : 0 }}
                        transition={{ duration: 0.3 }}
                      >
                        <ChevronDown className="h-5 w-5 text-gray-500 dark:text-white/60" />
                      </motion.div>
                    </button>

                    {!localExpandedBettingFacts && (
                      <div className="flex flex-wrap justify-center gap-2">
                        {prediction.ml_splits_label && (() => {
                          const mlData = parseBettingSplit(prediction.ml_splits_label);
                          if (!mlData || !mlData.team) return null;
                          const colorTheme = mlData.isSharp ? 'green' :
                                            mlData.percentage >= 70 ? 'purple' :
                                            mlData.percentage >= 60 ? 'blue' : 'neutral';
                          const bgClass = colorTheme === 'green' ? 'bg-green-100 dark:bg-green-500/10 border-green-300 dark:border-green-500/20' :
                                         colorTheme === 'purple' ? 'bg-purple-100 dark:bg-purple-500/10 border-purple-300 dark:border-purple-500/20' :
                                         colorTheme === 'blue' ? 'bg-blue-100 dark:bg-blue-500/10 border-blue-300 dark:border-blue-500/20' :
                                         'bg-gray-100 dark:bg-white/5 border-gray-300 dark:border-white/20';
                          return (
                            <div key="ml" className={`${bgClass} backdrop-blur-sm rounded-lg border px-3 py-2 flex items-center gap-2`}>
                              <TrendingUp className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                              <span className="text-xs font-semibold text-gray-900 dark:text-white">ML: {mlData.team}</span>
                            </div>
                          );
                        })()}
                        
                        {prediction.spread_splits_label && (() => {
                          const spreadData = parseBettingSplit(prediction.spread_splits_label);
                          if (!spreadData || !spreadData.team) return null;
                          const colorTheme = spreadData.isSharp ? 'green' :
                                            spreadData.percentage >= 70 ? 'purple' :
                                            spreadData.percentage >= 60 ? 'blue' : 'neutral';
                          const bgClass = colorTheme === 'green' ? 'bg-green-100 dark:bg-green-500/10 border-green-300 dark:border-green-500/20' :
                                         colorTheme === 'purple' ? 'bg-purple-100 dark:bg-purple-500/10 border-purple-300 dark:border-purple-500/20' :
                                         colorTheme === 'blue' ? 'bg-blue-100 dark:bg-blue-500/10 border-blue-300 dark:border-blue-500/20' :
                                         'bg-gray-100 dark:bg-white/5 border-gray-300 dark:border-white/20';
                          return (
                            <div key="spread" className={`${bgClass} backdrop-blur-sm rounded-lg border px-3 py-2 flex items-center gap-2`}>
                              <Target className="h-3 w-3 text-green-600 dark:text-green-400" />
                              <span className="text-xs font-semibold text-gray-900 dark:text-white">Spread: {spreadData.team}</span>
                            </div>
                          );
                        })()}
                        
                        {prediction.total_splits_label && (() => {
                          const totalData = parseBettingSplit(prediction.total_splits_label);
                          if (!totalData || !totalData.direction) return null;
                          const isOver = totalData.direction === 'over';
                          const colorTheme = totalData.isSharp ? 'green' :
                                            totalData.percentage >= 70 ? 'purple' :
                                            totalData.percentage >= 60 ? 'blue' : 'neutral';
                          const bgClass = colorTheme === 'green' ? 'bg-green-100 dark:bg-green-500/10 border-green-300 dark:border-green-500/20' :
                                         colorTheme === 'purple' ? 'bg-purple-100 dark:bg-purple-500/10 border-purple-300 dark:border-purple-500/20' :
                                         colorTheme === 'blue' ? 'bg-blue-100 dark:bg-blue-500/10 border-blue-300 dark:border-blue-500/20' :
                                         'bg-gray-100 dark:bg-white/5 border-gray-300 dark:border-white/20';
                          const arrow = isOver ? '▲' : '▼';
                          const arrowColor = isOver ? 'text-green-400' : 'text-red-400';
                          return (
                            <div key="total" className={`${bgClass} backdrop-blur-sm rounded-lg border px-3 py-2 flex items-center gap-2`}>
                              <BarChart className="h-3 w-3 text-orange-600 dark:text-orange-400" />
                              <span className={`text-sm font-bold ${arrowColor}`}>{arrow}</span>
                              <span className="text-xs font-semibold text-gray-900 dark:text-white">{totalData.team}</span>
                            </div>
                          );
                        })()}
                      </div>
                    )}

                    {localExpandedBettingFacts && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.3 }}
                        className="space-y-4 text-left"
                      >
                        <p className="text-sm text-gray-700 dark:text-white/70">
                          Detailed betting split information shows you where the public and sharp money is flowing. Click the previews above to see full details for each bet type.
                        </p>
                      </motion.div>
                    )}
                  </div>
                </div>
              )}

              {/* Weather Section for NFL */}
              {(prediction.icon || prediction.temperature || prediction.wind_speed) && (
                <div className="text-center">
                  <div className="bg-gray-50 dark:bg-white/5 backdrop-blur-sm p-4 rounded-lg border border-gray-200 dark:border-white/20 space-y-3">
                    <div className="flex items-center justify-center gap-2">
                      <CloudRain className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
                      <h4 className="text-lg font-bold text-gray-900 dark:text-white">Weather</h4>
                    </div>
                    
                    <div className="flex justify-center">
                      <div className="text-center">
                        <div className="flex items-center justify-center space-x-4 mb-2">
                          {prediction.icon && (
                            <div className="w-16 h-16 flex items-center justify-center">
                              <WeatherIconComponent 
                                code={prediction.icon}
                                size={64}
                                className="stroke-current text-gray-800 dark:text-white"
                              />
                            </div>
                          )}

                          {prediction.temperature !== null && (
                            <div className="text-lg font-bold text-gray-900 dark:text-white min-w-[60px] text-center">
                              {Math.round(prediction.temperature)}°F
                            </div>
                          )}

                          {prediction.wind_speed !== null && prediction.wind_speed > 0 && (
                            <div className="flex items-center space-x-2 min-w-[70px]">
                              <IconWind size={24} className="stroke-current text-blue-600 dark:text-blue-400" />
                              <span className="text-sm font-medium text-gray-700 dark:text-white/80">
                                {Math.round(prediction.wind_speed)} mph
                              </span>
                            </div>
                          )}
                        </div>
                        
                        {prediction.icon && (
                          <div className="text-xs font-medium text-gray-600 dark:text-white/70 capitalize">
                            {prediction.icon.replace(/-/g, ' ')}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Historical Data Section for NFL */}
              <HistoricalDataSection
                prediction={prediction}
                awayTeamColors={awayTeamColors}
                homeTeamColors={homeTeamColors}
                onH2HClick={onH2HClick || (() => {})}
                onLinesClick={onLinesClick || (() => {})}
              />
            </>
          )}

          {/* Match Simulator Section - CFB Only */}
          {league === 'cfb' && (
          <div className="text-center">
            <div className="bg-white/5 backdrop-blur-sm p-4 rounded-lg border border-white/20 space-y-4">
              <div className="flex items-center justify-center gap-2">
                <Sparkles className="h-5 w-5 text-amber-400" />
                <h4 className="text-lg font-bold text-gray-900 dark:text-white">Match Simulator</h4>
              </div>

              {!simRevealedById[prediction.id] && (
                <div className="flex justify-center">
                  {focusedCardId === prediction.id ? (
                    <MovingBorderButton
                      borderRadius="0.5rem"
                      containerClassName="h-auto w-auto"
                      borderClassName="bg-[radial-gradient(hsl(var(--primary))_40%,transparent_60%)]"
                      duration={3000}
                      className="bg-card dark:bg-card text-foreground dark:text-foreground border-border px-6 py-6 text-lg font-bold h-full w-full"
                      disabled={!!simLoadingById[prediction.id]}
                      onClick={() => {
                        setSimLoadingById(prev => ({ ...prev, [prediction.id]: true }));
                        setTimeout(() => {
                          setSimLoadingById(prev => ({ ...prev, [prediction.id]: false }));
                          setSimRevealedById(prev => ({ ...prev, [prediction.id]: true }));
                        }, 2500);
                      }}
                    >
                      {simLoadingById[prediction.id] ? (
                        <span className="flex items-center">
                          <FootballLoader /> Simulating…
                        </span>
                      ) : (
                        'Simulate Match'
                      )}
                    </MovingBorderButton>
                  ) : (
                    <Button
                      disabled={!!simLoadingById[prediction.id]}
                      onClick={() => {
                        setSimLoadingById(prev => ({ ...prev, [prediction.id]: true }));
                        setTimeout(() => {
                          setSimLoadingById(prev => ({ ...prev, [prediction.id]: false }));
                          setSimRevealedById(prev => ({ ...prev, [prediction.id]: true }));
                        }, 2500);
                      }}
                      className="px-6 py-6 text-lg font-bold bg-card dark:bg-card text-foreground dark:text-foreground border-2 border-border shadow-md hover:bg-muted/50"
                    >
                      {simLoadingById[prediction.id] ? (
                        <span className="flex items-center">
                          <FootballLoader /> Simulating…
                        </span>
                      ) : (
                        'Simulate Match'
                      )}
                    </Button>
                  )}
                </div>
              )}

              {simRevealedById[prediction.id] && (
                <div className="flex justify-between items-center bg-gradient-to-br from-orange-50 to-orange-50 dark:from-orange-950/30 dark:to-orange-950/30 p-3 sm:p-4 rounded-lg border border-border">
                  <div className="text-center flex-1">
                    <div 
                      className="h-12 w-12 sm:h-16 sm:w-16 mx-auto mb-1 sm:mb-2 rounded-full flex items-center justify-center border-2 transition-transform duration-200 shadow-lg"
                      style={{
                        background: `linear-gradient(135deg, ${awayTeamColors.primary}, ${awayTeamColors.secondary})`,
                        borderColor: `${awayTeamColors.primary}`
                      }}
                    >
                      <span 
                        className="text-xs sm:text-sm font-bold drop-shadow-md"
                        style={{ color: getContrastingTextColor(awayTeamColors.primary, awayTeamColors.secondary) }}
                      >
                        {getTeamInitials(prediction.away_team)}
                      </span>
                    </div>
                    <div className="text-xl sm:text-2xl font-bold text-foreground">
                      {(() => {
                        const val = prediction.pred_away_points ?? prediction.pred_away_score;
                        return val !== null && val !== undefined ? Math.round(Number(val)).toString() : '-';
                      })()}
                    </div>
                  </div>

                  <div className="text-center px-3 sm:px-4">
                    <div className="text-base sm:text-lg font-bold text-muted-foreground">VS</div>
                  </div>

                  <div className="text-center flex-1">
                    <div 
                      className="h-12 w-12 sm:h-16 sm:w-16 mx-auto mb-2 rounded-full flex items-center justify-center border-2 transition-transform duration-200 shadow-lg"
                      style={{
                        background: `linear-gradient(135deg, ${homeTeamColors.primary}, ${homeTeamColors.secondary})`,
                        borderColor: `${homeTeamColors.primary}`
                      }}
                    >
                      <span 
                        className="text-xs sm:text-sm font-bold drop-shadow-md"
                        style={{ color: getContrastingTextColor(homeTeamColors.primary, homeTeamColors.secondary) }}
                      >
                        {getTeamInitials(prediction.home_team)}
                      </span>
                    </div>
                    <div className="text-xl sm:text-2xl font-bold text-foreground">
                      {(() => {
                        const val = prediction.pred_home_points ?? prediction.pred_home_score;
                        return val !== null && val !== undefined ? Math.round(Number(val)).toString() : '-';
                      })()}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
