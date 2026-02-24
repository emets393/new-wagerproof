import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import BlurEffect from "react-progressive-blur";
import { Lock, TrendingUp, TrendingDown } from "lucide-react";
import { getNBATeamInitials, getContrastingTextColor } from "@/utils/teamColors";

type SportType = 'cfb' | 'nba' | 'dummy';

interface GamePrediction {
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
  game_date?: string;
  game_time?: string;
  away_moneyline?: number | null;
  home_moneyline?: number | null;
  api_spread?: number | null;
  api_over_line?: number | null;
  pred_ml_proba?: number | null;
  pred_spread_proba?: number | null;
  pred_total_proba?: number | null;
  home_spread_diff?: number | null;
  over_line_diff?: number | null;
  home_away_ml_prob?: number | null;
  home_away_spread_cover_prob?: number | null;
  ou_result_prob?: number | null;
}

interface CFBMiniCardProps {
  prediction: GamePrediction;
  awayTeamColors: { primary: string; secondary: string };
  homeTeamColors: { primary: string; secondary: string };
  getTeamLogo: (teamName: string) => string;
  cardIndex?: number;
  sportType?: SportType;
  focused?: boolean;
}

export default function CFBMiniCard({
  prediction,
  awayTeamColors,
  homeTeamColors,
  getTeamLogo,
  cardIndex = 0,
  sportType = 'cfb',
  focused = false
}: CFBMiniCardProps) {
  const shouldReduce = useReducedMotion();

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
    if (startTimeString.includes('PM') || startTimeString.includes('AM')) {
      if (!startTimeString.includes('EST') && !startTimeString.includes('ET')) {
        return `${startTimeString} EST`;
      }
      return startTimeString;
    }
    try {
      const utcDate = new Date(startTimeString);
      const estTime = utcDate.toLocaleTimeString('en-US', {
        timeZone: 'America/New_York',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
      return `${estTime} EST`;
    } catch {
      return 'TBD';
    }
  };

  const getTeamAcronym = (teamName: string): string => {
    if (sportType === 'nba' || sportType === 'dummy') {
      return getNBATeamInitials(teamName);
    }
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

  const createAuroraGradient = (colors1: { primary: string; secondary: string }, colors2: { primary: string; secondary: string }) => ({
    background: `linear-gradient(135deg, ${colors1.primary}12 0%, ${colors2.primary}12 25%, ${colors1.secondary}08 50%, ${colors2.secondary}08 75%, ${colors1.primary}12 100%)`,
    borderImage: `linear-gradient(135deg, ${colors1.primary}35, ${colors2.primary}35, ${colors1.secondary}25, ${colors2.secondary}25) 1`
  });

  const auroraStyle = createAuroraGradient(awayTeamColors, homeTeamColors);

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
  const entranceDelay = shouldReduce ? 0 : cardIndex * 0.1;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.97 }}
      animate={{
        opacity: 1,
        y: focused ? -4 : 0,
        scale: focused ? 1.03 : 1,
      }}
      transition={{ duration: 0.5, delay: entranceDelay + 0.3, ease: "easeOut" }}
      whileHover={shouldReduce ? {} : { scale: 1.025, y: -2 }}
      className={`relative rounded-xl md:rounded-2xl p-[1.5px] cursor-pointer overflow-hidden group transition-shadow duration-300 ${
        focused
          ? 'ring-2 ring-emerald-400/70 shadow-[0_0_24px_rgba(34,197,94,0.25),0_0_48px_rgba(34,197,94,0.1)]'
          : ''
      }`}
      style={{ background: auroraStyle.borderImage || 'linear-gradient(45deg, #73b69e, #a8d5ba)' }}
    >
      {/* Focused analyzing badge */}
      <AnimatePresence>
        {focused && (
          <motion.div
            initial={{ opacity: 0, scale: 0.7, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.7 }}
            transition={{ duration: 0.2 }}
            className="absolute top-1.5 right-1.5 md:top-2 md:right-2 z-30 px-2 py-0.5 rounded-full bg-emerald-500 text-white text-[8px] md:text-[10px] font-mono font-bold flex items-center gap-1 shadow-lg"
          >
            <motion.div
              animate={{ opacity: [1, 0.2, 1] }}
              transition={{ duration: 0.8, repeat: Infinity }}
              className="w-1 h-1 rounded-full bg-white"
            />
            Analyzing
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hover glow effect */}
      <div
        className="absolute -inset-1 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-md pointer-events-none"
        style={{ background: `linear-gradient(135deg, ${awayTeamColors.primary}30, ${homeTeamColors.primary}30)` }}
      />

      <div
        className="relative rounded-xl md:rounded-2xl p-2 md:p-4 w-full h-full overflow-hidden bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm"
        style={{ background: auroraStyle.background }}
      >
        {/* Subtle aurora overlay */}
        <div
          className="absolute inset-0 rounded-xl md:rounded-2xl opacity-20 pointer-events-none"
          style={{
            background: `radial-gradient(circle at 30% 20%, ${awayTeamColors.primary}20 0%, transparent 50%),
                        radial-gradient(circle at 70% 80%, ${homeTeamColors.primary}20 0%, transparent 50%)`
          }}
        />

        <div className="relative z-10 space-y-2 md:space-y-3">
          {/* Game Time */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: entranceDelay + 0.5 }}
            className="text-center"
          >
            <div className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400">
              <motion.div
                animate={shouldReduce ? {} : { scale: [1, 1.3, 1], opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="w-1.5 h-1.5 rounded-full bg-emerald-500"
              />
              {formatStartTime(prediction.game_time || prediction.start_time || prediction.start_date || prediction.game_datetime || prediction.datetime)}
            </div>
          </motion.div>

          {/* Teams Row */}
          <div className="flex flex-col items-center justify-center space-y-2">
            <div className="flex items-center justify-between w-full">
              {/* Away Team */}
              <motion.div
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: entranceDelay + 0.4, duration: 0.4 }}
                className="flex flex-col items-center space-y-1 flex-1"
              >
                {(() => {
                  const initials = getTeamAcronym(prediction.away_team);
                  const textColor = getContrastingTextColor(awayTeamColors.primary, awayTeamColors.secondary);
                  return (
                    <motion.div
                      animate={focused ? { scale: [1, 1.1, 1] } : {}}
                      transition={focused ? { duration: 1.5, repeat: Infinity } : {}}
                      className="h-7 w-7 md:h-10 md:w-10 rounded-full flex items-center justify-center flex-shrink-0 drop-shadow-md border-2 transition-shadow group-hover:shadow-md"
                      style={{
                        background: `linear-gradient(135deg, ${awayTeamColors.primary} 0%, ${awayTeamColors.secondary} 100%)`,
                        borderColor: awayTeamColors.secondary + '80',
                      }}
                    >
                      <span className="text-[0.5rem] md:text-xs font-bold" style={{ color: textColor }}>
                        {initials}
                      </span>
                    </motion.div>
                  );
                })()}
                <div className="min-w-0 text-center">
                  <div className="text-[10px] md:text-xs font-semibold truncate max-w-[80px] md:max-w-[120px] text-gray-900 dark:text-gray-100">
                    {prediction.away_team}
                  </div>
                </div>
              </motion.div>

              {/* VS divider */}
              <div className="px-2 md:px-4">
                <motion.span
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: entranceDelay + 0.5, type: "spring", stiffness: 300 }}
                  className="text-[10px] md:text-xs font-mono font-bold text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-white/5 px-1.5 py-0.5 rounded"
                >
                  @
                </motion.span>
              </div>

              {/* Home Team */}
              <motion.div
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: entranceDelay + 0.4, duration: 0.4 }}
                className="flex flex-col items-center space-y-1 flex-1"
              >
                {(() => {
                  const initials = getTeamAcronym(prediction.home_team);
                  const textColor = getContrastingTextColor(homeTeamColors.primary, homeTeamColors.secondary);
                  return (
                    <motion.div
                      animate={focused ? { scale: [1, 1.1, 1] } : {}}
                      transition={focused ? { duration: 1.5, repeat: Infinity, delay: 0.3 } : {}}
                      className="h-7 w-7 md:h-10 md:w-10 rounded-full flex items-center justify-center flex-shrink-0 drop-shadow-md border-2 transition-shadow group-hover:shadow-md"
                      style={{
                        background: `linear-gradient(135deg, ${homeTeamColors.primary} 0%, ${homeTeamColors.secondary} 100%)`,
                        borderColor: homeTeamColors.secondary + '80',
                      }}
                    >
                      <span className="text-[0.5rem] md:text-xs font-bold" style={{ color: textColor }}>
                        {initials}
                      </span>
                    </motion.div>
                  );
                })()}
                <div className="min-w-0 text-center">
                  <div className="text-[10px] md:text-xs font-semibold truncate max-w-[80px] md:max-w-[120px] text-gray-900 dark:text-gray-100">
                    {prediction.home_team}
                  </div>
                </div>
              </motion.div>
            </div>
          </div>

          {/* Betting Lines */}
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: entranceDelay + 0.55 }}
            className="grid grid-cols-3 gap-1 md:gap-2 text-center"
          >
            <div className="space-y-0.5 md:space-y-1 p-1.5 rounded-lg bg-white/40 dark:bg-white/[0.03]">
              <div className="text-[10px] md:text-xs font-bold text-blue-600 dark:text-blue-400 tabular-nums">
                {formatMoneyline(prediction.away_ml || prediction.away_moneyline)}
              </div>
              <div className="text-[10px] md:text-xs font-medium text-gray-600 dark:text-gray-300 tabular-nums">
                {formatSpread(prediction.away_spread || (prediction.api_spread ? -prediction.api_spread : null))}
              </div>
            </div>
            <div className="space-y-0.5 md:space-y-1 p-1.5 rounded-lg bg-white/40 dark:bg-white/[0.03]">
              <div className="text-[9px] md:text-[10px] font-mono font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Total</div>
              <div className="text-[10px] md:text-xs font-bold text-gray-700 dark:text-gray-300 tabular-nums">
                {prediction.total_line || prediction.api_over_line || '-'}
              </div>
            </div>
            <div className="space-y-0.5 md:space-y-1 p-1.5 rounded-lg bg-white/40 dark:bg-white/[0.03]">
              <div className="text-[10px] md:text-xs font-bold text-green-600 dark:text-green-400 tabular-nums">
                {formatMoneyline(prediction.home_ml || prediction.home_moneyline)}
              </div>
              <div className="text-[10px] md:text-xs font-medium text-gray-600 dark:text-gray-300 tabular-nums">
                {formatSpread(prediction.home_spread || prediction.api_spread)}
              </div>
            </div>
          </motion.div>

          {/* Mini Model Predictions */}
          {(spreadEdge || ouEdge) && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: entranceDelay + 0.65 }}
              className="hidden md:grid grid-cols-2 gap-2 text-center"
            >
              {spreadEdge && (
                <div className="bg-white/50 dark:bg-white/[0.04] backdrop-blur-sm rounded-lg p-2 border border-gray-200/40 dark:border-white/[0.06] flex items-center justify-center gap-1.5">
                  <TrendingUp className="w-3 h-3 text-emerald-500" />
                  <div>
                    <div className="text-[9px] font-mono text-gray-400 uppercase">Spread Edge</div>
                    <div className="text-xs font-bold text-gray-800 dark:text-white tabular-nums">
                      {spreadEdge.team} {spreadEdge.edge.toFixed(1)}
                    </div>
                  </div>
                </div>
              )}
              {ouEdge && (
                <div className="bg-white/50 dark:bg-white/[0.04] backdrop-blur-sm rounded-lg p-2 border border-gray-200/40 dark:border-white/[0.06] flex items-center justify-center gap-1.5">
                  {ouEdge.direction === 'Over' ? (
                    <TrendingUp className="w-3 h-3 text-blue-500" />
                  ) : (
                    <TrendingDown className="w-3 h-3 text-orange-500" />
                  )}
                  <div>
                    <div className="text-[9px] font-mono text-gray-400 uppercase">O/U Edge</div>
                    <div className="text-xs font-bold text-gray-800 dark:text-white tabular-nums">
                      {ouEdge.direction} {ouEdge.edge.toFixed(1)}
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* Premium Features Preview */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: entranceDelay + 0.7 }}
            className="space-y-2"
          >
            <div className="text-center hidden md:block">
              <div className="text-[10px] font-mono font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-[0.12em]">
                Model Predictions
              </div>
            </div>

            <div className="grid grid-cols-1 gap-1.5 relative">
              {/* Edge Analysis Mockup */}
              <div className={`relative overflow-hidden rounded-lg border border-gray-200/30 dark:border-white/[0.04] ${cardIndex !== 0 ? 'hidden md:block' : ''}`}>
                <div className="bg-gradient-to-r from-blue-50/80 to-purple-50/80 dark:from-blue-950/20 dark:to-purple-950/20 p-2 md:p-2.5">
                  <div className="flex items-center justify-between">
                    <div className="text-[10px] md:text-xs font-medium text-gray-500 dark:text-gray-400">Edge Analysis</div>
                    <div className="text-[10px] md:text-xs font-bold text-blue-600 dark:text-blue-400 tabular-nums">+2.3 pts</div>
                  </div>
                  <div className="text-[9px] md:text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">Advanced model edge detection</div>
                </div>
                <div className={`absolute inset-0 overflow-hidden pointer-events-none transition-opacity duration-500 ${focused ? 'opacity-20' : ''}`} style={{ borderRadius: '0.5rem' }}>
                  <BlurEffect
                    position="right"
                    intensity={120}
                    className="bg-gradient-to-r from-transparent via-white/20 to-white/80 dark:via-black/20 dark:to-black/80 w-3/5 pointer-events-none"
                  />
                </div>
                <div className="absolute top-1 right-1 md:top-1.5 md:right-1.5 z-10 pointer-events-none">
                  <div className="bg-white/90 dark:bg-black/80 backdrop-blur-sm rounded-full p-1 shadow-sm border border-gray-200/50 dark:border-white/10">
                    <Lock className="w-2 h-2 md:w-2.5 md:h-2.5 text-gray-500 dark:text-gray-400" />
                  </div>
                </div>
              </div>

              {/* Public Split Mockup */}
              <div className={`relative overflow-hidden rounded-lg border border-gray-200/30 dark:border-white/[0.04] ${cardIndex !== 1 ? 'hidden md:block' : ''}`}>
                <div className="bg-gradient-to-r from-green-50/80 to-emerald-50/80 dark:from-green-950/20 dark:to-emerald-950/20 p-2 md:p-2.5">
                  <div className="flex items-center justify-between">
                    <div className="text-[10px] md:text-xs font-medium text-gray-500 dark:text-gray-400">Public Split</div>
                    <div className="text-[10px] md:text-xs font-bold text-green-600 dark:text-green-400 tabular-nums">73% / 27%</div>
                  </div>
                  <div className="text-[9px] md:text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">Sharp vs public money flow</div>
                </div>
                <div className={`absolute inset-0 overflow-hidden pointer-events-none transition-opacity duration-500 ${focused ? 'opacity-20' : ''}`} style={{ borderRadius: '0.5rem' }}>
                  <BlurEffect
                    position="right"
                    intensity={120}
                    className="bg-gradient-to-r from-transparent via-white/20 to-white/80 dark:via-black/20 dark:to-black/80 w-3/5 pointer-events-none"
                  />
                </div>
                <div className="absolute top-1.5 right-1.5 z-10 pointer-events-none">
                  <div className="bg-white/90 dark:bg-black/80 backdrop-blur-sm rounded-full p-1 shadow-sm border border-gray-200/50 dark:border-white/10">
                    <Lock className="w-2.5 h-2.5 text-gray-500 dark:text-gray-400" />
                  </div>
                </div>
              </div>

              {/* Simulate Game Mockup */}
              <div className={`relative overflow-hidden rounded-lg border border-gray-200/30 dark:border-white/[0.04] ${cardIndex !== 2 && cardIndex !== 3 ? 'hidden md:block' : ''}`}>
                <div className="bg-gradient-to-r from-orange-50/80 to-red-50/80 dark:from-orange-950/20 dark:to-red-950/20 p-2 md:p-2.5">
                  <div className="flex items-center justify-between">
                    <div className="text-[10px] md:text-xs font-medium text-gray-500 dark:text-gray-400">Simulate Game</div>
                    <div className="text-[10px] md:text-xs font-bold text-orange-600 dark:text-orange-400 tabular-nums">28 - 21</div>
                  </div>
                  <div className="text-[9px] md:text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">AI game simulation results</div>
                </div>
                <div className={`absolute inset-0 overflow-hidden pointer-events-none transition-opacity duration-500 ${focused ? 'opacity-20' : ''}`} style={{ borderRadius: '0.5rem' }}>
                  <BlurEffect
                    position="right"
                    intensity={120}
                    className="bg-gradient-to-r from-transparent via-white/20 to-white/80 dark:via-black/20 dark:to-black/80 w-3/5 pointer-events-none"
                  />
                </div>
                <div className="absolute top-1.5 right-1.5 z-10 pointer-events-none">
                  <div className="bg-white/90 dark:bg-black/80 backdrop-blur-sm rounded-full p-1 shadow-sm border border-gray-200/50 dark:border-white/10">
                    <Lock className="w-2.5 h-2.5 text-gray-500 dark:text-gray-400" />
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Bottom accent line */}
          <motion.div
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ delay: entranceDelay + 0.8, duration: 0.6, ease: "easeOut" }}
            className="flex h-[3px] rounded-full overflow-hidden origin-left"
          >
            <motion.div
              animate={shouldReduce ? {} : { opacity: [0.5, 0.8, 0.5] }}
              transition={{ duration: 3, repeat: Infinity }}
              className="flex-1 rounded-l-full"
              style={{ backgroundColor: `${awayTeamColors.primary}70` }}
            />
            <motion.div
              animate={shouldReduce ? {} : { opacity: [0.5, 0.8, 0.5] }}
              transition={{ duration: 3, repeat: Infinity, delay: 1.5 }}
              className="flex-1 rounded-r-full"
              style={{ backgroundColor: `${homeTeamColors.primary}70` }}
            />
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}
