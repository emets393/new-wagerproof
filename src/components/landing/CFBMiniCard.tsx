import { AuroraText } from "@/components/magicui/aurora-text";
import ElectricBorder from "@/components/ui/electric-border";
import BlurEffect from "react-progressive-blur";
import { Lock } from "lucide-react";

interface CFBPrediction {
  id: string;
  away_team: string;
  home_team: string;
  home_ml: number | null;
  away_ml: number | null;
  home_spread: number | null;
  away_spread: number | null;
  total_line: number | null;
  start_time?: string;
  start_date?: string;
  game_datetime?: string;
  datetime?: string;
  away_moneyline?: number | null;
  home_moneyline?: number | null;
  api_spread?: number | null;
  api_over_line?: number | null;
  // Model predictions
  pred_ml_proba?: number | null;
  pred_spread_proba?: number | null;
  pred_total_proba?: number | null;
  home_spread_diff?: number | null;
  over_line_diff?: number | null;
}

interface CFBMiniCardProps {
  prediction: CFBPrediction;
  awayTeamColors: { primary: string; secondary: string };
  homeTeamColors: { primary: string; secondary: string };
  getTeamLogo: (teamName: string) => string;
}

export default function CFBMiniCard({ 
  prediction, 
  awayTeamColors, 
  homeTeamColors, 
  getTeamLogo 
}: CFBMiniCardProps) {
  
  const formatMoneyline = (ml: number | null): string => {
    if (ml === null || ml === undefined) return '-';
    if (ml > 0) return `+${ml}`;
    return ml.toString();
  };

  const formatSpread = (spread: number | null): string => {
    if (spread === null || spread === undefined) return '-';
    if (spread > 0) return `+${spread}`;
    return spread.toString();
  };

  const formatStartTime = (startTimeString: string | null | undefined): string => {
    if (!startTimeString) return 'TBD';
    
    try {
      const utcDate = new Date(startTimeString);
      const estTime = utcDate.toLocaleTimeString('en-US', {
        timeZone: 'America/New_York',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
      return `${estTime} EST`;
    } catch (error) {
      return 'TBD';
    }
  };

  const getTeamAcronym = (teamName: string): string => {
    const acronymMap: { [key: string]: string } = {
      'Alabama': 'ALA', 'Auburn': 'AUB', 'Georgia': 'UGA', 'Florida': 'UF',
      'LSU': 'LSU', 'Texas A&M': 'TAMU', 'Ole Miss': 'MISS', 'Mississippi State': 'MSST',
      'Arkansas': 'ARK', 'Kentucky': 'UK', 'Tennessee': 'TENN', 'South Carolina': 'SC',
      'Missouri': 'MIZ', 'Vanderbilt': 'VAN', 'Ohio State': 'OSU', 'Michigan': 'MICH',
      'Penn State': 'PSU', 'Michigan State': 'MSU', 'Wisconsin': 'WISC', 'Iowa': 'IOWA',
      'Minnesota': 'MINN', 'Nebraska': 'NEB', 'Illinois': 'ILL', 'Northwestern': 'NW',
      'Purdue': 'PUR', 'Indiana': 'IND', 'Rutgers': 'RUT', 'Maryland': 'MD',
      'Oklahoma': 'OU', 'Texas': 'TEX', 'Oklahoma State': 'OKST', 'Baylor': 'BAY',
      'TCU': 'TCU', 'Texas Tech': 'TTU', 'Kansas State': 'KSU', 'Iowa State': 'ISU',
      'Kansas': 'KU', 'West Virginia': 'WVU', 'BYU': 'BYU', 'Cincinnati': 'CIN',
      'UCF': 'UCF', 'Houston': 'HOU', 'USC': 'USC', 'UCLA': 'UCLA', 'Oregon': 'ORE',
      'Washington': 'UW', 'Utah': 'UTAH', 'Arizona State': 'ASU', 'Arizona': 'ARIZ',
      'Colorado': 'COLO', 'Stanford': 'STAN', 'California': 'CAL', 'Oregon State': 'ORST',
      'Washington State': 'WSU', 'Clemson': 'CLEM', 'Florida State': 'FSU', 'Miami': 'MIA',
      'North Carolina': 'UNC', 'NC State': 'NCST', 'Virginia Tech': 'VT', 'Virginia': 'UVA',
      'Duke': 'DUKE', 'Wake Forest': 'WAKE', 'Georgia Tech': 'GT', 'Boston College': 'BC',
      'Pitt': 'PITT', 'Syracuse': 'SYR', 'Louisville': 'LOU', 'Notre Dame': 'ND'
    };
    
    return acronymMap[teamName] || teamName.substring(0, 4).toUpperCase();
  };

  // Create aurora gradient based on team colors
  const createAuroraGradient = (colors1: { primary: string; secondary: string }, colors2: { primary: string; secondary: string }) => {
    return {
      background: `linear-gradient(135deg, 
        ${colors1.primary}15 0%, 
        ${colors2.primary}15 25%, 
        ${colors1.secondary}10 50%, 
        ${colors2.secondary}10 75%, 
        ${colors1.primary}15 100%)`,
      borderImage: `linear-gradient(135deg, 
        ${colors1.primary}40, 
        ${colors2.primary}40, 
        ${colors1.secondary}30, 
        ${colors2.secondary}30) 1`
    };
  };

  const auroraStyle = createAuroraGradient(awayTeamColors, homeTeamColors);

  // Calculate model confidence (average of available probabilities)
  const getModelConfidence = (): number => {
    const probs = [prediction.pred_ml_proba, prediction.pred_spread_proba, prediction.pred_total_proba].filter(p => p !== null && p !== undefined);
    if (probs.length === 0) return 0;
    const avg = probs.reduce((sum, p) => sum + (p as number), 0) / probs.length;
    return Math.round(avg * 100);
  };

  const modelConfidence = getModelConfidence();

  // Get edge information for mini predictions
  const getSpreadEdge = (): { team: string; edge: number } | null => {
    if (!prediction.home_spread_diff) return null;
    const isHomeEdge = prediction.home_spread_diff > 0;
    return {
      team: isHomeEdge ? getTeamAcronym(prediction.home_team) : getTeamAcronym(prediction.away_team),
      edge: Math.abs(prediction.home_spread_diff)
    };
  };

  const getOUEdge = (): { direction: 'Over' | 'Under'; edge: number } | null => {
    if (!prediction.over_line_diff) return null;
    return {
      direction: prediction.over_line_diff > 0 ? 'Over' : 'Under',
      edge: Math.abs(prediction.over_line_diff)
    };
  };

  const spreadEdge = getSpreadEdge();
  const ouEdge = getOUEdge();

  return (
    <div 
      className="relative rounded-2xl p-[2px] hover:shadow-lg transition-all duration-300 hover:scale-[1.02] cursor-pointer overflow-hidden"
      style={{
        background: auroraStyle.borderImage || 'linear-gradient(45deg, #73b69e, #a8d5ba)'
      }}
    >
      <div 
        className="relative rounded-2xl p-4 w-full h-full overflow-hidden"
        style={{
          background: auroraStyle.background
        }}
      >
      {/* Subtle aurora overlay effect */}
      <div 
        className="absolute inset-0 rounded-2xl opacity-20 pointer-events-none"
        style={{
          background: `radial-gradient(circle at 30% 20%, ${awayTeamColors.primary}20 0%, transparent 50%), 
                      radial-gradient(circle at 70% 80%, ${homeTeamColors.primary}20 0%, transparent 50%)`
        }}
      />
      
      <div className="relative z-10 space-y-3">
        {/* Game Time */}
        <div className="text-center">
          <div className="text-xs font-medium text-gray-600 dark:text-gray-400">
            {formatStartTime(prediction.start_time || prediction.start_date || prediction.game_datetime || prediction.datetime)}
          </div>
        </div>

        {/* Teams Row */}
        <div className="flex items-center justify-between">
          {/* Away Team */}
          <div className="flex items-center space-x-2 flex-1">
            {getTeamLogo(prediction.away_team) && (
              <img 
                src={getTeamLogo(prediction.away_team)} 
                alt={`${prediction.away_team} logo`}
                className="h-8 w-8 drop-shadow-sm"
              />
            )}
            <div className="min-w-0 flex-1">
              <AuroraText 
                className="text-sm font-bold truncate"
                style={{ color: awayTeamColors.primary }}
              >
                {getTeamAcronym(prediction.away_team)}
              </AuroraText>
            </div>
          </div>

          {/* @ Symbol */}
          <div className="px-2">
            <span className="text-sm font-bold text-gray-500">@</span>
          </div>

          {/* Home Team */}
          <div className="flex items-center space-x-2 flex-1 justify-end">
            <div className="min-w-0 flex-1 text-right">
              <AuroraText 
                className="text-sm font-bold truncate"
                style={{ color: homeTeamColors.primary }}
              >
                {getTeamAcronym(prediction.home_team)}
              </AuroraText>
            </div>
            {getTeamLogo(prediction.home_team) && (
              <img 
                src={getTeamLogo(prediction.home_team)} 
                alt={`${prediction.home_team} logo`}
                className="h-8 w-8 drop-shadow-sm"
              />
            )}
          </div>
        </div>

        {/* Betting Lines */}
        <div className="grid grid-cols-3 gap-2 text-center">
          {/* Away ML & Spread */}
          <div className="space-y-1">
            <div className="text-xs font-medium text-blue-600 dark:text-blue-400">
              {formatMoneyline(prediction.away_moneyline || prediction.away_ml)}
            </div>
            <div className="text-xs font-medium text-gray-700 dark:text-gray-300">
              {formatSpread(prediction.api_spread ? -prediction.api_spread : null)}
            </div>
          </div>

          {/* Total */}
          <div className="space-y-1">
            <div className="text-xs font-bold text-gray-600 dark:text-gray-400">Total</div>
            <div className="text-xs font-medium text-gray-700 dark:text-gray-300">
              {prediction.api_over_line || prediction.total_line || '-'}
            </div>
          </div>

          {/* Home ML & Spread */}
          <div className="space-y-1">
            <div className="text-xs font-medium text-green-600 dark:text-green-400">
              {formatMoneyline(prediction.home_moneyline || prediction.home_ml)}
            </div>
            <div className="text-xs font-medium text-gray-700 dark:text-gray-300">
              {formatSpread(prediction.api_spread)}
            </div>
          </div>
        </div>

        {/* Model Confidence Indicator */}
        {modelConfidence > 0 && (
          <div className="flex justify-center">
            <ElectricBorder
              className="px-3 py-1 rounded-full bg-background/80 backdrop-blur-sm"
              borderClassName="bg-gradient-to-r from-blue-500 to-purple-500"
            >
              <div className="text-xs font-bold text-foreground">
                Model Confidence: {modelConfidence}%
              </div>
            </ElectricBorder>
          </div>
        )}

        {/* Mini Model Predictions */}
        {(spreadEdge || ouEdge) && (
          <div className="grid grid-cols-2 gap-2 text-center">
            {/* Spread Edge */}
            {spreadEdge && (
              <div className="bg-background/60 backdrop-blur-sm rounded-lg p-2 border border-border/50">
                <div className="text-xs font-medium text-muted-foreground">Spread Edge</div>
                <div className="text-sm font-bold text-foreground">
                  {spreadEdge.team} {spreadEdge.edge.toFixed(1)}
                </div>
              </div>
            )}

            {/* O/U Edge */}
            {ouEdge && (
              <div className="bg-background/60 backdrop-blur-sm rounded-lg p-2 border border-border/50">
                <div className="text-xs font-medium text-muted-foreground">O/U Edge</div>
                <div className="text-sm font-bold text-foreground">
                  {ouEdge.direction} {ouEdge.edge.toFixed(1)}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Premium Features Preview - Blurred Mockups */}
        <div className="space-y-2">
          <div className="text-center">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Model Predictions
            </div>
          </div>
          
          {/* Blurred Feature Tiles */}
          <div className="grid grid-cols-1 gap-2 relative">
            {/* Edge Analysis Mockup */}
            <div className="relative overflow-hidden rounded-lg border border-border/30">
              <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/30 dark:to-purple-950/30 p-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-medium text-muted-foreground">Edge Analysis</div>
                  <div className="text-xs font-bold text-blue-600 dark:text-blue-400">+2.3 pts</div>
                </div>
                <div className="text-xs text-muted-foreground mt-1">Advanced model edge detection</div>
              </div>
              {/* Progressive blur overlay */}
              <div 
                className="absolute inset-0 overflow-hidden pointer-events-none" 
                style={{ 
                  borderRadius: '0.5rem',
                  WebkitMask: 'radial-gradient(circle, white 100%, transparent 100%)',
                  mask: 'radial-gradient(circle, white 100%, transparent 100%)'
                }}
              >
                <BlurEffect
                  position="right"
                  intensity={120}
                  className="bg-gradient-to-r from-transparent via-white/20 to-white/80 dark:via-black/20 dark:to-black/80 w-3/5 pointer-events-none"
                />
              </div>
              {/* Lock icon - positioned on top */}
              <div className="absolute top-2 right-2 z-10 pointer-events-none">
                <div className="bg-white/90 dark:bg-black/90 backdrop-blur-sm rounded-full p-1.5 shadow-lg border border-white/20 dark:border-black/20">
                  <Lock className="w-3 h-3 text-gray-700 dark:text-gray-300" />
                </div>
              </div>
            </div>

            {/* Public Split Mockup */}
            <div className="relative overflow-hidden rounded-lg border border-border/30">
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 p-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-medium text-muted-foreground">Public Split</div>
                  <div className="text-xs font-bold text-green-600 dark:text-green-400">73% / 27%</div>
                </div>
                <div className="text-xs text-muted-foreground mt-1">Sharp vs public money flow</div>
              </div>
              {/* Progressive blur overlay */}
              <div 
                className="absolute inset-0 overflow-hidden pointer-events-none" 
                style={{ 
                  borderRadius: '0.5rem',
                  WebkitMask: 'radial-gradient(circle, white 100%, transparent 100%)',
                  mask: 'radial-gradient(circle, white 100%, transparent 100%)'
                }}
              >
                <BlurEffect
                  position="right"
                  intensity={120}
                  className="bg-gradient-to-r from-transparent via-white/20 to-white/80 dark:via-black/20 dark:to-black/80 w-3/5 pointer-events-none"
                />
              </div>
              {/* Lock icon - positioned on top */}
              <div className="absolute top-2 right-2 z-10 pointer-events-none">
                <div className="bg-white/90 dark:bg-black/90 backdrop-blur-sm rounded-full p-1.5 shadow-lg border border-white/20 dark:border-black/20">
                  <Lock className="w-3 h-3 text-gray-700 dark:text-gray-300" />
                </div>
              </div>
            </div>

            {/* Simulate Game Mockup */}
            <div className="relative overflow-hidden rounded-lg border border-border/30">
              <div className="bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-950/30 dark:to-red-950/30 p-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-medium text-muted-foreground">Simulate Game</div>
                  <div className="text-xs font-bold text-orange-600 dark:text-orange-400">28 - 21</div>
                </div>
                <div className="text-xs text-muted-foreground mt-1">AI game simulation results</div>
              </div>
              {/* Progressive blur overlay */}
              <div 
                className="absolute inset-0 overflow-hidden pointer-events-none" 
                style={{ 
                  borderRadius: '0.5rem',
                  WebkitMask: 'radial-gradient(circle, white 100%, transparent 100%)',
                  mask: 'radial-gradient(circle, white 100%, transparent 100%)'
                }}
              >
                <BlurEffect
                  position="right"
                  intensity={120}
                  className="bg-gradient-to-r from-transparent via-white/20 to-white/80 dark:via-black/20 dark:to-black/80 w-3/5 pointer-events-none"
                />
              </div>
              {/* Lock icon - positioned on top */}
              <div className="absolute top-2 right-2 z-10 pointer-events-none">
                <div className="bg-white/90 dark:bg-black/90 backdrop-blur-sm rounded-full p-1.5 shadow-lg border border-white/20 dark:border-black/20">
                  <Lock className="w-3 h-3 text-gray-700 dark:text-gray-300" />
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Bottom accent line with team colors */}
        <div className="flex h-1 rounded-full overflow-hidden">
          <div 
            className="flex-1" 
            style={{ backgroundColor: `${awayTeamColors.primary}60` }}
          />
          <div 
            className="flex-1" 
            style={{ backgroundColor: `${homeTeamColors.primary}60` }}
          />
        </div>
      </div>
      </div>
    </div>
  );
}
