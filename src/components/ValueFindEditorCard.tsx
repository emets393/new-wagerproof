import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Target } from 'lucide-react';
import Aurora from '@/components/magicui/aurora';
import { getNFLTeamColors, getCFBTeamColors, getNFLTeamInitials, getCFBTeamInitials, getContrastingTextColor } from '@/utils/teamColors';

interface ValueFindEditorCardProps {
  gameId: string;
  matchup: string;
  betType: 'spread' | 'ml' | 'ou';
  recommendedPick: string;
  confidence: number;
  keyFactors: string[];
  explanation: string;
  gameData?: any; // For team colors, logos, etc.
  sportType?: 'nfl' | 'cfb'; // Added to determine which color set to use
}

export function ValueFindEditorCard({
  matchup,
  betType,
  recommendedPick,
  confidence,
  keyFactors,
  explanation,
  sportType = 'nfl', // Default to NFL if not specified
}: ValueFindEditorCardProps) {
  // Map bet types to display labels
  const betTypeLabels = {
    spread: 'Spread',
    ml: 'Moneyline',
    ou: 'Over/Under'
  };

  // Color based on confidence
  const getConfidenceColor = (conf: number) => {
    if (conf >= 8) return 'text-green-400';
    if (conf >= 6) return 'text-yellow-400';
    return 'text-orange-400';
  };

  // Defensive checks for empty/invalid data
  const safeMatchup = matchup || 'Loading matchup...';
  const safeRecommendedPick = recommendedPick || 'N/A';
  const safeExplanation = explanation || 'No analysis available.';
  const safeConfidence = confidence || 0;
  const safeKeyFactors = keyFactors || [];
  const confidenceStars = '⭐'.repeat(Math.min(Math.max(0, safeConfidence), 10));

  // Extract team data from matchup (e.g., "Bills @ Chiefs" -> team circles)
  const getTeamDataForMatchup = (matchupStr: string) => {
    const parts = matchupStr.split('@').map(t => t.trim());
    if (parts.length !== 2) return { away: null, home: null };
    
    const awayTeam = parts[0];
    const homeTeam = parts[1];
    
    const getColors = sportType === 'nfl' ? getNFLTeamColors : getCFBTeamColors;
    const getInitials = sportType === 'nfl' ? getNFLTeamInitials : getCFBTeamInitials;
    
    return {
      away: {
        name: awayTeam,
        colors: getColors(awayTeam),
        initials: getInitials(awayTeam),
      },
      home: {
        name: homeTeam,
        colors: getColors(homeTeam),
        initials: getInitials(homeTeam),
      },
    };
  };

  const teamData = getTeamDataForMatchup(safeMatchup);

  return (
    <Card
      className="border-white/20 hover:border-purple-500/50 transition-all duration-300 overflow-hidden relative h-full flex flex-col"
      style={{
        background: 'rgba(0, 0, 0, 0.4)',
        backdropFilter: 'blur(40px)',
        WebkitBackdropFilter: 'blur(40px)',
      }}
    >
      <div className="absolute inset-0 -z-10">
        <Aurora
          size={300}
          className="opacity-20"
          color1="rgba(139, 92, 246, 0.2)"
          color2="rgba(59, 130, 246, 0.2)"
        />
      </div>
      
      <CardHeader className="pb-3 shrink-0">
        <div className="flex items-start justify-between">
          <Badge className="bg-gradient-to-r from-purple-600 to-blue-600 text-white border-none">
            <Sparkles className="w-3 h-3 mr-1" />
            Value Find
          </Badge>
          <Badge variant="outline" className="text-white/70 border-white/30">
            {betTypeLabels[betType] || 'Unknown'}
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4 flex-1 min-h-0">
        {/* Matchup with Team Circles */}
        <div className="text-center pb-3 border-b border-white/10">
          <div className="flex items-center justify-center gap-3 mb-2">
            {teamData.away && (
              <div className="flex flex-col items-center gap-1">
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center text-xs font-bold shadow-lg"
                  style={{
                    background: `linear-gradient(135deg, ${teamData.away.colors.primary} 0%, ${teamData.away.colors.secondary} 100%)`,
                    color: getContrastingTextColor(teamData.away.colors.primary, teamData.away.colors.secondary),
                    border: `2px solid ${teamData.away.colors.primary}`,
                  }}
                >
                  {teamData.away.initials}
                </div>
                <span className="text-white/70 text-xs font-medium">{teamData.away.name}</span>
              </div>
            )}
            <span className="text-white/60 text-xl font-bold">@</span>
            {teamData.home && (
              <div className="flex flex-col items-center gap-1">
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center text-xs font-bold shadow-lg"
                  style={{
                    background: `linear-gradient(135deg, ${teamData.home.colors.primary} 0%, ${teamData.home.colors.secondary} 100%)`,
                    color: getContrastingTextColor(teamData.home.colors.primary, teamData.home.colors.secondary),
                    border: `2px solid ${teamData.home.colors.primary}`,
                  }}
                >
                  {teamData.home.initials}
                </div>
                <span className="text-white/70 text-xs font-medium">{teamData.home.name}</span>
              </div>
            )}
          </div>
        </div>

        {/* Recommended Pick */}
        <div className="bg-gradient-to-r from-purple-600/20 to-blue-600/20 p-4 rounded-lg border border-purple-500/30">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-white/60">Recommended Pick:</p>
            <Target className="w-4 h-4 text-purple-400" />
          </div>
          <p className="text-white font-bold text-xl mb-2">{safeRecommendedPick}</p>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className="bg-gradient-to-r from-green-600 to-emerald-600 text-white border-none text-xs">
              Confidence: {safeConfidence}/10
            </Badge>
            {confidenceStars && (
              <span className="text-yellow-400 text-sm">{confidenceStars}</span>
            )}
          </div>
        </div>

        {/* Explanation */}
        <div>
          <p className="text-xs text-white/60 mb-2">Analysis:</p>
          <p className="text-white/90 text-sm leading-relaxed">{safeExplanation}</p>
        </div>

        {/* Key Factors */}
        {safeKeyFactors.length > 0 && (
          <div>
            <p className="text-xs text-white/60 mb-2">Key Factors:</p>
            <ul className="space-y-2">
              {safeKeyFactors.map((factor, idx) => (
                <li key={idx} className="text-xs text-white/80 flex items-start gap-2">
                  <span className={`mt-0.5 ${getConfidenceColor(safeConfidence)}`}>•</span>
                  <span>{factor}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

