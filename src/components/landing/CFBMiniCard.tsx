import { useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Brain, Lock } from "lucide-react";
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
  away_abbr?: string;
  home_abbr?: string;
  model_fair_home_spread?: number | null;
  model_fair_total?: number | null;
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

// ─── Helpers ─────────────────────────────────────────────────────────

function formatMoneyline(ml: number | null): string {
  if (ml === null || ml === undefined) return '-';
  return ml > 0 ? `+${ml}` : ml.toString();
}

function formatSpread(spread: number | null): string {
  if (spread === null || spread === undefined) return '-';
  return spread > 0 ? `+${spread}` : spread.toString();
}

function formatCompactDate(dateString: string | null | undefined): string {
  if (!dateString) return 'TBD';
  try {
    const parts = dateString.split('T')[0].split('-');
    if (parts.length === 3) {
      const date = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
      return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    }
    return dateString;
  } catch {
    return dateString;
  }
}

function formatTime(timeString: string | null | undefined): string {
  if (!timeString) return 'TBD';
  if (timeString.includes('PM') || timeString.includes('AM')) {
    return timeString.includes('EST') || timeString.includes('ET') ? timeString : `${timeString} EST`;
  }
  try {
    const utcDate = new Date(timeString);
    return utcDate.toLocaleTimeString('en-US', {
      timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit', hour12: true,
    }) + ' EST';
  } catch {
    return 'TBD';
  }
}

function roundToNearestHalf(value: number | null | undefined): number | string {
  if (value === null || value === undefined) return '-';
  return Math.round(value * 2) / 2;
}

// ─── Team Avatar (web version) ───────────────────────────────────────

function WebTeamAvatar({
  teamName,
  colors,
  logoUrl,
  size = 36,
}: {
  teamName: string;
  colors: { primary: string; secondary: string };
  logoUrl: string;
  size?: number;
}) {
  const [imgError, setImgError] = useState(false);
  const initials = getNBATeamInitials(teamName);
  const textColor = getContrastingTextColor(colors.primary, colors.secondary);

  if (logoUrl && !imgError) {
    return (
      <div
        className="rounded-full flex items-center justify-center bg-transparent shrink-0"
        style={{ width: size, height: size }}
      >
        <img
          src={logoUrl}
          alt={teamName}
          className="object-contain"
          style={{ width: size * 0.85, height: size * 0.85 }}
          onError={() => setImgError(true)}
        />
      </div>
    );
  }

  return (
    <div
      className="rounded-full flex items-center justify-center shrink-0"
      style={{
        width: size,
        height: size,
        background: `linear-gradient(135deg, ${colors.primary}, ${colors.secondary})`,
      }}
    >
      <span className="font-bold" style={{ fontSize: size * 0.35, color: textColor }}>
        {initials}
      </span>
    </div>
  );
}

// ─── Main Card Component ─────────────────────────────────────────────

export default function CFBMiniCard({
  prediction,
  awayTeamColors,
  homeTeamColors,
  getTeamLogo,
  cardIndex = 0,
  sportType = 'cfb',
  focused = false,
}: CFBMiniCardProps) {
  const shouldReduce = useReducedMotion();
  const entranceDelay = shouldReduce ? 0 : cardIndex * 0.1;

  // Determine favorite for background gradient
  const favoriteColors =
    prediction.home_spread !== null && prediction.away_spread !== null
      ? prediction.home_spread < 0 ? homeTeamColors : awayTeamColors
      : prediction.home_ml !== null && prediction.away_ml !== null
        ? prediction.home_ml < prediction.away_ml ? homeTeamColors : awayTeamColors
        : awayTeamColors;

  const getAbbr = (team: string, isHome: boolean) => {
    if (isHome && prediction.home_abbr) return prediction.home_abbr;
    if (!isHome && prediction.away_abbr) return prediction.away_abbr;
    return getNBATeamInitials(team);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.97 }}
      animate={{
        opacity: 1,
        y: focused ? -4 : 0,
        scale: focused ? 1.03 : 1,
      }}
      transition={{ duration: 0.5, delay: entranceDelay + 0.3, ease: 'easeOut' }}
      whileHover={shouldReduce ? {} : { scale: 1.025, y: -2 }}
      className={`relative rounded-[20px] overflow-hidden cursor-pointer group transition-shadow duration-300 ${
        focused
          ? 'ring-2 ring-emerald-400/70 shadow-[0_0_24px_rgba(34,197,94,0.25)]'
          : 'shadow-[0_2px_12px_rgba(0,0,0,0.1)]'
      } bg-white dark:bg-[#1a1a1a]`}
    >
      {/* Top gradient border */}
      <div
        className="absolute top-0 left-0 right-0 h-[3px] z-10"
        style={{
          background: `linear-gradient(to right, ${awayTeamColors.primary}, ${awayTeamColors.secondary}, ${homeTeamColors.primary}, ${homeTeamColors.secondary})`,
        }}
      />

      {/* Background gradient */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `linear-gradient(to bottom, ${favoriteColors.primary}15, ${favoriteColors.secondary}10, transparent)`,
        }}
      />

      {/* Focused analyzing badge */}
      <AnimatePresence>
        {focused && (
          <motion.div
            initial={{ opacity: 0, scale: 0.7, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.7 }}
            transition={{ duration: 0.2 }}
            className="absolute top-2 right-2 z-30 px-2 py-0.5 rounded-full bg-emerald-500 text-white text-[8px] md:text-[10px] font-mono font-bold flex items-center gap-1 shadow-lg"
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

      {/* Card Content */}
      <div className="relative pt-[7px] pb-2.5 md:pb-3 px-2 md:px-2.5">
        {/* Date + Time */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: entranceDelay + 0.4 }}
          className="flex justify-between items-center mb-2 md:mb-2.5"
        >
          <span className="text-[10px] md:text-xs font-semibold text-gray-900 dark:text-gray-100">
            {formatCompactDate(prediction.game_date)}
          </span>
          <span className="px-1.5 md:px-2 py-0.5 rounded-md bg-gray-100 dark:bg-white/10 text-[8px] md:text-[10px] font-semibold text-gray-600 dark:text-gray-300">
            {formatTime(prediction.game_time || prediction.start_time || prediction.game_datetime)}
          </span>
        </motion.div>

        {/* Teams Row */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: entranceDelay + 0.45 }}
          className="flex justify-around items-center mb-2 md:mb-2.5"
        >
          {/* Away Team */}
          <div className="flex flex-col items-center flex-1 min-w-0">
            <WebTeamAvatar
              teamName={prediction.away_team}
              colors={awayTeamColors}
              logoUrl={getTeamLogo(prediction.away_team)}
              size={window.innerWidth < 768 ? 28 : 36}
            />
            <span className="text-[9px] md:text-[11px] font-semibold text-gray-900 dark:text-gray-100 text-center mt-1 truncate max-w-full">
              {getAbbr(prediction.away_team, false)}
            </span>
            <div className="flex gap-1 md:gap-1.5 mt-0.5 justify-center">
              {prediction.away_spread !== null && (
                <span className={`text-[8px] md:text-[9px] font-medium tabular-nums ${(prediction.away_spread ?? 0) < 0 ? 'text-blue-500' : 'text-emerald-500'}`}>
                  {formatSpread(prediction.away_spread)}
                </span>
              )}
              {(prediction.away_ml ?? prediction.away_moneyline) !== null && (
                <span className={`text-[8px] md:text-[9px] font-medium tabular-nums ${((prediction.away_ml ?? prediction.away_moneyline) ?? 0) < 0 ? 'text-blue-500' : 'text-emerald-500'}`}>
                  {formatMoneyline(prediction.away_ml ?? prediction.away_moneyline ?? null)}
                </span>
              )}
            </div>
          </div>

          {/* Center - @ with O/U */}
          <div className="flex flex-col items-center px-1 md:px-1.5 shrink-0">
            <span className="text-base md:text-xl font-semibold text-gray-300 dark:text-gray-600">@</span>
            {(prediction.total_line || prediction.api_over_line) && (
              <span className="mt-0.5 md:mt-1 px-1.5 md:px-2 py-0.5 rounded-md bg-gray-500/10 border border-gray-300/40 dark:border-gray-600/40 text-[7px] md:text-[9px] font-semibold text-gray-500 dark:text-gray-400 tabular-nums whitespace-nowrap">
                O/U: {roundToNearestHalf(prediction.total_line || prediction.api_over_line)}
              </span>
            )}
          </div>

          {/* Home Team */}
          <div className="flex flex-col items-center flex-1 min-w-0">
            <WebTeamAvatar
              teamName={prediction.home_team}
              colors={homeTeamColors}
              logoUrl={getTeamLogo(prediction.home_team)}
              size={window.innerWidth < 768 ? 28 : 36}
            />
            <span className="text-[9px] md:text-[11px] font-semibold text-gray-900 dark:text-gray-100 text-center mt-1 truncate max-w-full">
              {getAbbr(prediction.home_team, true)}
            </span>
            <div className="flex gap-1 md:gap-1.5 mt-0.5 justify-center">
              {prediction.home_spread !== null && (
                <span className={`text-[8px] md:text-[9px] font-medium tabular-nums ${(prediction.home_spread ?? 0) < 0 ? 'text-blue-500' : 'text-emerald-500'}`}>
                  {formatSpread(prediction.home_spread)}
                </span>
              )}
              {(prediction.home_ml ?? prediction.home_moneyline) !== null && (
                <span className={`text-[8px] md:text-[9px] font-medium tabular-nums ${((prediction.home_ml ?? prediction.home_moneyline) ?? 0) < 0 ? 'text-blue-500' : 'text-emerald-500'}`}>
                  {formatMoneyline(prediction.home_ml ?? prediction.home_moneyline ?? null)}
                </span>
              )}
            </div>
          </div>
        </motion.div>

        {/* Model Predictions Section */}
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: entranceDelay + 0.55 }}
          className="mt-1 md:mt-1.5"
        >
          <div className="flex items-center gap-1 mb-1 md:mb-1.5">
            <Brain className="w-2.5 h-2.5 md:w-3 md:h-3 text-emerald-500" />
            <span className="text-[8px] md:text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
              Model Picks
            </span>
          </div>

          <div className="space-y-1 md:space-y-1.5">
            {/* Spread Pill — locked with metric name visible */}
            <div className="flex items-center px-1.5 md:px-2 py-1.5 md:py-2 rounded-xl bg-gray-50 dark:bg-[#2a2a2a] border border-gray-200/50 dark:border-white/[0.08]">
              <div className="w-4 h-4 md:w-5 md:h-5 rounded-full flex items-center justify-center shrink-0 bg-gray-300/50 dark:bg-gray-600/30">
                <Lock className="w-2 h-2 md:w-2.5 md:h-2.5 text-gray-400 dark:text-gray-500" />
              </div>
              <span className="text-[9px] md:text-[11px] font-semibold text-gray-400 dark:text-gray-500 ml-1.5 md:ml-2">
                Spread
              </span>
              <span className="text-[8px] md:text-[10px] font-semibold text-gray-400 dark:text-gray-500 ml-auto px-1.5 py-0.5 rounded-full bg-gray-200/60 dark:bg-white/[0.06] border border-gray-300/40 dark:border-white/[0.06]">
                Members Only
              </span>
            </div>

            {/* O/U Pill — locked with metric name visible */}
            <div className="flex items-center px-1.5 md:px-2 py-1.5 md:py-2 rounded-xl bg-gray-50 dark:bg-[#2a2a2a] border border-gray-200/50 dark:border-white/[0.08]">
              <div className="w-4 h-4 md:w-5 md:h-5 rounded-full flex items-center justify-center shrink-0 bg-gray-300/50 dark:bg-gray-600/30">
                <Lock className="w-2 h-2 md:w-2.5 md:h-2.5 text-gray-400 dark:text-gray-500" />
              </div>
              <span className="text-[9px] md:text-[11px] font-semibold text-gray-400 dark:text-gray-500 ml-1.5 md:ml-2">
                Over / Under
              </span>
              <span className="text-[8px] md:text-[10px] font-semibold text-gray-400 dark:text-gray-500 ml-auto px-1.5 py-0.5 rounded-full bg-gray-200/60 dark:bg-white/[0.06] border border-gray-300/40 dark:border-white/[0.06]">
                Members Only
              </span>
            </div>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
