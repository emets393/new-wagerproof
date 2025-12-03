import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Edit, CheckCircle2, XCircle, Minus, RotateCcw, ChevronDown, ChevronUp } from 'lucide-react';
import { useAdminMode } from '@/contexts/AdminModeContext';
import { motion, AnimatePresence } from 'framer-motion';
import { getNFLTeamInitials, getCFBTeamInitials, getNBATeamInitials, getNCAABTeamInitials, getContrastingTextColor } from '@/utils/teamColors';
import { SportsbookButtons } from '@/components/SportsbookButtons';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { calculateUnits } from '@/utils/unitsCalculation';
import { cn } from '@/lib/utils';

interface EditorPickListItemProps {
  pick: {
    id: string;
    game_id: string;
    game_type: 'nfl' | 'cfb' | 'nba' | 'ncaab';
    selected_bet_type: string;
    editors_notes: string | null;
    is_published: boolean;
    editor_id: string;
    betslip_links?: Record<string, string> | null;
    pick_value?: string | null;
    best_price?: string | null;
    sportsbook?: string | null;
    units?: number | null;
    is_free_pick?: boolean;
    archived_game_data?: any;
    bet_type?: string | null;
    result?: 'won' | 'lost' | 'push' | 'pending' | null;
  };
  gameData: {
    away_team: string;
    home_team: string;
    away_logo?: string;
    home_logo?: string;
    game_date?: string;
    game_time?: string;
    raw_game_date?: string;
    away_spread?: number | null;
    home_spread?: number | null;
    over_line?: number | null;
    away_ml?: number | null;
    home_ml?: number | null;
    opening_spread?: number | null;
    home_team_colors: { primary: string; secondary: string };
    away_team_colors: { primary: string; secondary: string };
  };
  onUpdate?: () => void;
  onDelete?: () => void;
  onEdit?: () => void;
}

export function EditorPickListItem({ pick, gameData, onUpdate, onEdit }: EditorPickListItemProps) {
  const { adminModeEnabled } = useAdminMode();
  const { toast } = useToast();
  const [isExpanded, setIsExpanded] = useState(false);

  // Check if game date has passed
  const isGamePast = (): boolean => {
    if (!gameData.raw_game_date && !gameData.game_date) return false;
    
    const gameDateStr = gameData.raw_game_date || gameData.game_date;
    if (!gameDateStr) return false;
    
    try {
      const gameDate = new Date(gameDateStr.split('T')[0]);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      gameDate.setHours(0, 0, 0, 0);
      
      return gameDate < today;
    } catch {
      return false;
    }
  };

  const handleResultUpdate = async (result: 'won' | 'lost' | 'push') => {
    try {
      const { error } = await supabase
        .from('editors_picks')
        .update({ result: result } as any)
        .eq('id', pick.id);
      
      if (error) throw error;
      
      toast({
        title: 'Result Updated',
        description: `Pick marked as ${result}.`,
      });
      
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Error updating result:', error);
      toast({
        title: 'Error',
        description: 'Failed to update result. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const unitsCalc = calculateUnits(pick.result, pick.best_price, pick.units);

  const getTeamInitials = (teamName: string) => {
    switch (pick.game_type) {
      case 'nfl': return getNFLTeamInitials(teamName);
      case 'cfb': return getCFBTeamInitials(teamName);
      case 'nba': return getNBATeamInitials(teamName);
      case 'ncaab': return getNCAABTeamInitials(teamName);
      default: return getNFLTeamInitials(teamName);
    }
  };

  const parseBetTypes = (betTypeString: string): string[] => {
    if (!betTypeString) return ['spread_home'];
    const types = betTypeString.includes(',') 
      ? betTypeString.split(',').map(t => t.trim())
      : [betTypeString];
    
    return types.map(betType => {
      if (betType === 'spread') return 'spread_home';
      if (betType === 'moneyline') return 'ml_home';
      if (betType === 'over_under') return 'over';
      return betType;
    });
  };

  const selectedBetTypes = parseBetTypes(pick.selected_bet_type);
  const notes = pick.editors_notes || '';

  const formatSpread = (spread: number | null | undefined): string => {
    if (spread === null || spread === undefined) return '-';
    if (spread > 0) return `+${spread}`;
    return spread.toString();
  };

  const formatMoneyline = (ml: number | null | undefined): string => {
    if (ml === null || ml === undefined) return '-';
    if (ml > 0) return `+${ml}`;
    return ml.toString();
  };

  // Determine highlight color based on pick side
  const getHighlightColor = () => {
    const firstBet = selectedBetTypes[0];
    if (firstBet?.includes('home')) return gameData.home_team_colors.primary;
    if (firstBet?.includes('away')) return gameData.away_team_colors.primary;
    return 'transparent';
  };

  const highlightColor = getHighlightColor();

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="group relative"
    >
      {/* Main Row */}
      <div 
        className={cn(
          "relative flex flex-col md:flex-row md:items-center gap-4 p-4 rounded-xl transition-all duration-300 border",
          "bg-white/50 dark:bg-gray-900/50 hover:bg-white/80 dark:hover:bg-gray-900/80",
          "border-gray-200 dark:border-gray-800 hover:border-blue-300 dark:hover:border-blue-700",
          "backdrop-blur-md shadow-sm hover:shadow-md",
          (isExpanded || adminModeEnabled) && "ring-1 ring-blue-400 dark:ring-blue-600 bg-white/90 dark:bg-gray-900/90"
        )}
      >
        {/* Left Highlight Bar */}
        <div 
          className="absolute left-0 top-4 bottom-4 w-1 rounded-r-full opacity-80"
          style={{ backgroundColor: highlightColor !== 'transparent' ? highlightColor : undefined }} 
        />

        {/* Game Info & Matchup Section */}
        <div className="flex items-center gap-4 flex-1 min-w-0 pl-2">
          {/* Date Box */}
          <div className="flex flex-col items-center justify-center min-w-[70px] px-1 py-1 bg-gray-100 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700/50 gap-0.5">
            {(() => {
              try {
                // Use game_date if available (pre-formatted), otherwise parse raw_game_date
                if (gameData.game_date && gameData.game_date !== 'TBD' && !gameData.game_date.includes('INVALID')) {
                  const dateParts = gameData.game_date.split(', ');
                  if (dateParts.length >= 2) {
                    const dayOfWeek = dateParts[0];
                    const monthDate = dateParts[1];
                    
                    // Map short day names to full names
                    const dayNameMap: { [key: string]: string } = {
                      'Sun': 'Sunday', 'Mon': 'Monday', 'Tue': 'Tuesday', 'Wed': 'Wednesday',
                      'Thu': 'Thursday', 'Fri': 'Friday', 'Sat': 'Saturday'
                    };
                    const fullDayName = dayNameMap[dayOfWeek] || dayOfWeek;
                    
                    return (
                      <>
                        <span className="text-[10px] uppercase font-semibold text-gray-500 dark:text-gray-400 leading-tight">
                          {monthDate}
                        </span>
                        <span className="text-sm font-extrabold text-gray-900 dark:text-gray-100 leading-tight py-0.5">
                          {fullDayName}
                        </span>
                        <span className="text-[10px] text-gray-500 dark:text-gray-400 leading-tight">
                          {gameData.game_time?.split(' ')[0] || 'TBD'} {gameData.game_time?.split(' ').slice(1).join(' ') || ''}
                        </span>
                      </>
                    );
                  }
                }
                
                // Fallback to parsing raw_game_date
                if (gameData.raw_game_date && gameData.raw_game_date !== 'TBD' && !gameData.raw_game_date.includes('INVALID')) {
                  let dateObj: Date;
                  
                  if (gameData.raw_game_date.includes('T')) {
                    dateObj = new Date(gameData.raw_game_date);
                  } else if (gameData.raw_game_date.match(/^\d{4}-\d{2}-\d{2}$/)) {
                    // YYYY-MM-DD format
                    const [year, month, day] = gameData.raw_game_date.split('-').map(Number);
                    dateObj = new Date(year, month - 1, day);
                  } else {
                    dateObj = new Date(gameData.raw_game_date);
                  }
                  
                  // Check if date is valid
                  if (isNaN(dateObj.getTime())) {
                    return <span className="text-xs text-gray-500">TBD</span>;
                  }
                  
                  const month = dateObj.toLocaleDateString('en-US', { month: 'short' });
                  const dayNum = dateObj.getDate();
                  const fullDayName = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
                  
                  return (
                    <>
                      <span className="text-[10px] uppercase font-semibold text-gray-500 dark:text-gray-400 leading-tight">
                        {month} {dayNum}
                      </span>
                      <span className="text-sm font-extrabold text-gray-900 dark:text-gray-100 leading-tight py-0.5">
                        {fullDayName}
                      </span>
                      <span className="text-[10px] text-gray-500 dark:text-gray-400 leading-tight">
                        {gameData.game_time?.split(' ')[0] || 'TBD'} {gameData.game_time?.split(' ').slice(1).join(' ') || ''}
                      </span>
                    </>
                  );
                }
                
                return <span className="text-xs text-gray-500">TBD</span>;
              } catch (e) {
                return <span className="text-xs text-gray-500">TBD</span>;
              }
            })()}
          </div>

          {/* Teams */}
          <div className="flex flex-col gap-1.5 flex-1">
            {/* Away Team */}
            <div className="flex items-center gap-3">
               <div className="w-8 h-8 flex-shrink-0 rounded-full overflow-hidden bg-white dark:bg-gray-800 shadow-sm border border-gray-100 dark:border-gray-700 flex items-center justify-center">
                  {gameData.away_logo && gameData.away_logo !== '/placeholder.svg' ? (
                    <img src={gameData.away_logo} alt={gameData.away_team} className="w-full h-full object-contain p-0.5" />
                  ) : (
                    <span className="text-xs font-bold" style={{ color: gameData.away_team_colors.primary }}>
                      {getTeamInitials(gameData.away_team)}
                    </span>
                  )}
               </div>
               <div className="flex flex-col min-w-0">
                 <span className="font-bold text-sm sm:text-base truncate text-gray-900 dark:text-gray-100">
                   {gameData.away_team}
                 </span>
                 <span className="text-xs text-gray-500 dark:text-gray-400 flex gap-2">
                    <span>{formatMoneyline(gameData.away_ml)}</span>
                    <span>{formatSpread(gameData.away_spread)}</span>
                 </span>
               </div>
            </div>

            {/* Home Team */}
            <div className="flex items-center gap-3">
               <div className="w-8 h-8 flex-shrink-0 rounded-full overflow-hidden bg-white dark:bg-gray-800 shadow-sm border border-gray-100 dark:border-gray-700 flex items-center justify-center">
                  {gameData.home_logo && gameData.home_logo !== '/placeholder.svg' ? (
                    <img src={gameData.home_logo} alt={gameData.home_team} className="w-full h-full object-contain p-0.5" />
                  ) : (
                    <span className="text-xs font-bold" style={{ color: gameData.home_team_colors.primary }}>
                      {getTeamInitials(gameData.home_team)}
                    </span>
                  )}
               </div>
               <div className="flex flex-col min-w-0">
                 <span className="font-bold text-sm sm:text-base truncate text-gray-900 dark:text-gray-100">
                   {gameData.home_team}
                 </span>
                 <span className="text-xs text-gray-500 dark:text-gray-400 flex gap-2">
                    <span>{formatMoneyline(gameData.home_ml)}</span>
                    <span>{formatSpread(gameData.home_spread)}</span>
                 </span>
               </div>
            </div>
          </div>
        </div>

        {/* The Pick Section - Includes Analysis Inline */}
        <div className="flex flex-col flex-[1.5] gap-3 min-w-[200px] pl-2 md:pl-4 border-t md:border-t-0 md:border-l border-gray-200 dark:border-gray-800 pt-4 md:pt-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-0.5">
                  Editor's Pick
                </div>
                
                {pick.pick_value ? (
                  <div className="text-lg font-bold text-blue-600 dark:text-blue-400 leading-tight">
                    {pick.pick_value}
                  </div>
                ) : (
                   /* Legacy Pick Display */
                   selectedBetTypes.map((betType, idx) => (
                     <div key={idx} className="text-sm font-bold text-blue-600 dark:text-blue-400">
                        {betType.replace('_', ' ').toUpperCase()}
                     </div>
                   ))
                )}
              </div>

              <div className="text-right">
                <div className="flex items-center gap-2 justify-end">
                   {pick.best_price && (
                      <span className="font-medium text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30 px-1.5 py-0.5 rounded text-xs">
                        {pick.best_price}
                      </span>
                   )}
                   {pick.units && (
                     <span className="text-gray-600 dark:text-gray-400 text-xs">
                       {pick.units}u
                     </span>
                   )}
                </div>
                {/* Result Badge (if active) */}
                {pick.result && pick.result !== 'pending' && (
                  <div className={`text-xs font-bold mt-1 ${
                    unitsCalc.netUnits > 0 ? 'text-green-600 dark:text-green-400' :
                    unitsCalc.netUnits < 0 ? 'text-red-600 dark:text-red-400' :
                    'text-gray-600 dark:text-gray-400'
                  }`}>
                    {unitsCalc.netUnits > 0 ? '+' : ''}{unitsCalc.netUnits.toFixed(2)} units
                    <span className={cn(
                      "ml-1 px-1 py-0.5 rounded text-[10px] uppercase",
                      pick.result === 'won' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                      pick.result === 'lost' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                      'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
                    )}>
                      {pick.result}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Analysis Text - Inline */}
            {notes && (
              <div className="text-sm text-gray-600 dark:text-gray-300 leading-snug line-clamp-3 hover:line-clamp-none transition-all duration-300">
                <span className="font-semibold text-gray-500 dark:text-gray-400 text-xs uppercase mr-1">Analysis:</span>
                {notes}
              </div>
            )}
        </div>

        {/* Actions Section */}
        <div className="flex flex-row md:flex-col items-center md:items-end gap-2 pl-2 md:pl-4 border-t md:border-t-0 md:border-l border-gray-200 dark:border-gray-800 pt-4 md:pt-0 justify-end">
           {adminModeEnabled && (
             <Button 
               variant="ghost" 
               size="sm" 
               className={cn(
                 "h-8 w-8 p-0 rounded-full hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-600 dark:hover:text-blue-400",
                 isExpanded && "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rotate-180"
               )}
               onClick={() => setIsExpanded(!isExpanded)}
             >
               <ChevronDown className="h-5 w-5" />
             </Button>
           )}
           
           {pick.is_published && (
             <SportsbookButtons
               pickId={pick.id}
               gameType={pick.game_type}
               awayTeam={gameData.away_team}
               homeTeam={gameData.home_team}
               selectedBetType={pick.selected_bet_type}
               awaySpread={gameData.away_spread}
               homeSpread={gameData.home_spread}
               overLine={gameData.over_line}
               awayMl={gameData.away_ml}
               homeMl={gameData.home_ml}
               existingLinks={pick.betslip_links || null}
               onLinksUpdated={onUpdate}
               compact={true} // We need to add this prop or handle it in SportsbookButtons if we want a smaller version
             />
           )}
        </div>
      </div>

      {/* Expanded Content - Admin Tools Only */}
      <AnimatePresence>
        {isExpanded && adminModeEnabled && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="overflow-hidden"
          >
             <div className="mx-4 -mt-2 mb-4 px-4 sm:px-6 py-4 bg-gray-50/80 dark:bg-gray-800/50 rounded-b-xl border-x border-b border-gray-200 dark:border-gray-800 shadow-inner">
                {/* Admin Tools */}
                <div className="flex flex-wrap gap-3 pt-1">
                   <Button onClick={onEdit} variant="outline" size="sm" className="gap-2">
                      <Edit className="h-3.5 w-3.5" /> Edit Pick
                   </Button>

                   {isGamePast() && (
                      <div className="flex items-center gap-2 ml-auto">
                        <span className="text-xs font-medium text-muted-foreground mr-1">Set Result:</span>
                        <Button
                          onClick={() => handleResultUpdate('won')}
                          size="sm"
                          variant={pick.result === 'won' ? 'default' : 'outline'}
                          className={pick.result === 'won' ? 'bg-green-600 hover:bg-green-700' : 'h-7'}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" /> Won
                        </Button>
                        <Button
                          onClick={() => handleResultUpdate('lost')}
                          size="sm"
                          variant={pick.result === 'lost' ? 'default' : 'outline'}
                          className={pick.result === 'lost' ? 'bg-red-600 hover:bg-red-700' : 'h-7'}
                        >
                           <XCircle className="h-3.5 w-3.5 mr-1.5" /> Lost
                        </Button>
                        <Button
                          onClick={() => handleResultUpdate('push')}
                          size="sm"
                          variant={pick.result === 'push' ? 'default' : 'outline'}
                          className={pick.result === 'push' ? 'bg-gray-600 hover:bg-gray-700' : 'h-7'}
                        >
                           <Minus className="h-3.5 w-3.5 mr-1.5" /> Push
                        </Button>
                        
                        {pick.result && pick.result !== 'pending' && (
                          <Button
                            onClick={async () => {
                              try {
                                const { error } = await supabase
                                  .from('editors_picks')
                                  .update({ result: null } as any)
                                  .eq('id', pick.id);
                                if (error) throw error;
                                toast({ title: 'Result Cleared', description: 'Pick result has been reset.' });
                                if (onUpdate) onUpdate();
                              } catch (error) {
                                console.error(error);
                                toast({ title: 'Error', variant: 'destructive' });
                              }
                            }}
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-muted-foreground hover:text-foreground"
                            title="Clear Result"
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                   )}
                </div>
             </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
