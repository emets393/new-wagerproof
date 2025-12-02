import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Edit, CheckCircle2, XCircle, Minus, RotateCcw } from 'lucide-react';
import { useAdminMode } from '@/contexts/AdminModeContext';
import { motion, AnimatePresence } from 'framer-motion';
import Aurora from '@/components/magicui/aurora';
import { getNFLTeamInitials, getCFBTeamInitials, getNBATeamInitials, getNCAABTeamInitials, getContrastingTextColor } from '@/utils/teamColors';
import { SportsbookButtons } from '@/components/SportsbookButtons';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { calculateUnits } from '@/utils/unitsCalculation';
import { cn } from '@/lib/utils';

interface EditorPickCardProps {
  pick: {
    id: string;
    game_id: string;
    game_type: 'nfl' | 'cfb' | 'nba' | 'ncaab';
    selected_bet_type: string; // Can be single string or comma-separated string
    editors_notes: string | null;
    is_published: boolean;
    editor_id: string;
    betslip_links?: Record<string, string> | null; // JSONB from database
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
    raw_game_date?: string; // Raw date for comparison (YYYY-MM-DD or ISO string)
    away_spread?: number | null;
    home_spread?: number | null;
    over_line?: number | null;
    away_ml?: number | null;
    home_ml?: number | null;
    opening_spread?: number | null; // For CFB games
    home_team_colors: { primary: string; secondary: string };
    away_team_colors: { primary: string; secondary: string };
  };
  onUpdate?: () => void;
  onDelete?: () => void;
  onEdit?: () => void;
}

export function EditorPickCard({ pick, gameData, onUpdate, onEdit }: EditorPickCardProps) {
  const { adminModeEnabled } = useAdminMode();
  const { toast } = useToast();
  
  // Check if game date has passed (for showing result buttons)
  const isGamePast = (): boolean => {
    if (!gameData.raw_game_date && !gameData.game_date) return false;
    
    const gameDateStr = gameData.raw_game_date || gameData.game_date;
    if (!gameDateStr) return false;
    
    try {
      // Parse date string (could be YYYY-MM-DD or ISO format)
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
      
      if (onUpdate) {
        onUpdate();
      }
    } catch (error) {
      console.error('Error updating result:', error);
      toast({
        title: 'Error',
        description: 'Failed to update result. Please try again.',
        variant: 'destructive',
      });
    }
  };
  
  // Calculate units for display
  const unitsCalc = calculateUnits(pick.result, pick.best_price, pick.units);
  
  // Detect Android to skip Aurora (WebGL issues on Android)
  const isAndroid = /Android/i.test(navigator.userAgent);
  
  // Helper to get team initials based on game type
  const getTeamInitials = (teamName: string) => {
    switch (pick.game_type) {
      case 'nfl':
        return getNFLTeamInitials(teamName);
      case 'cfb':
        return getCFBTeamInitials(teamName);
      case 'nba':
        return getNBATeamInitials(teamName);
      case 'ncaab':
        return getNCAABTeamInitials(teamName);
      default:
        return getNFLTeamInitials(teamName); // fallback
    }
  };
  
  // Parse bet types - handle both single strings and comma-separated strings
  const parseBetTypes = (betTypeString: string): string[] => {
    if (!betTypeString) return ['spread_home'];
    
    // Split by comma if it's a comma-separated list
    const types = betTypeString.includes(',') 
      ? betTypeString.split(',').map(t => t.trim())
      : [betTypeString];
    
    // Normalize old bet types to new format
    return types.map(betType => {
      if (betType === 'spread') return 'spread_home';
      if (betType === 'moneyline') return 'ml_home';
      if (betType === 'over_under') return 'over';
      return betType;
    });
  };
  
  const selectedBetTypes = parseBetTypes(pick.selected_bet_type);
  const notes = pick.editors_notes || '';
  
  const getAuroraColors = (): string[] => {
    const firstBet = selectedBetTypes[0];

    if (firstBet?.includes('home')) {
      return [gameData.home_team_colors.primary, gameData.home_team_colors.secondary, gameData.home_team_colors.primary];
    }
    if (firstBet?.includes('away')) {
      return [gameData.away_team_colors.primary, gameData.away_team_colors.secondary, gameData.away_team_colors.primary];
    }
    if (firstBet === 'over' || firstBet === 'under') {
      if (gameData.home_spread !== null && gameData.home_spread < 0) {
        return [gameData.home_team_colors.primary, gameData.home_team_colors.secondary, gameData.home_team_colors.primary];
      }
      if (gameData.away_spread !== null && gameData.away_spread < 0) {
        return [gameData.away_team_colors.primary, gameData.away_team_colors.secondary, gameData.away_team_colors.primary];
      }
    }
    // Fallback
    return [gameData.home_team_colors.primary, gameData.away_team_colors.primary, gameData.home_team_colors.secondary];
  };

  const auroraColors = getAuroraColors();

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

  return (
    <Card className={cn(
      "relative overflow-hidden transition-all duration-300 group border",
      "bg-white/50 dark:bg-gray-900/50 hover:bg-white/80 dark:hover:bg-gray-900/80",
      "border-gray-200 dark:border-gray-800 hover:border-blue-300 dark:hover:border-blue-700",
      "backdrop-blur-md shadow-sm hover:shadow-md"
    )}>
      {/* Aurora Effect - Skip on Android due to WebGL compatibility issues, and skip for past games to save resources */}
      <AnimatePresence>
        {pick.is_published && !isAndroid && !isGamePast() && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.6 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: "easeInOut" }}
            className="absolute top-0 left-0 right-0 h-40 z-[1] pointer-events-none overflow-hidden rounded-t-lg"
          >
            <Aurora
              colorStops={auroraColors}
              amplitude={1.2}
              blend={0.6}
              speed={0.8}
            />
          </motion.div>
        )}
      </AnimatePresence>
      {/* Status Badges */}
      <div className="absolute top-4 right-4 z-10 flex gap-2 flex-wrap">
        {pick.result && (
          <Badge 
            variant="secondary" 
            className={
              pick.result === 'won' ? 'bg-green-500 text-white' :
              pick.result === 'lost' ? 'bg-red-500 text-white' :
              'bg-gray-500 text-white'
            }
          >
            {pick.result === 'won' ? 'WON' : pick.result === 'lost' ? 'LOST' : 'PUSH'}
          </Badge>
        )}
        {pick.is_free_pick && (
          <Badge variant="secondary" className="bg-green-500 text-white">
            FREE PICK
          </Badge>
        )}
        {!pick.is_published && (
          <Badge variant="secondary" className="bg-yellow-500 text-white">
            DRAFT
          </Badge>
        )}
      </div>

      <CardContent className="space-y-3 sm:space-y-4 md:space-y-6 pt-3 pb-3 sm:pt-4 sm:pb-4 md:pt-6 md:pb-6 px-3 sm:px-4 md:px-6 relative z-10">
        {/* Game Date and Time */}
        {(gameData.game_date || gameData.game_time) && (
          <div className="text-center space-y-2">
            {gameData.game_date && (
              <div className="text-sm sm:text-base font-bold text-gray-900 dark:text-gray-100">
                {gameData.game_date}
              </div>
            )}
            {gameData.game_time && (
              <div className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100/80 dark:bg-gray-800/80 px-2 sm:px-3 py-1 rounded-full border border-gray-200/50 dark:border-gray-700/50 inline-block backdrop-blur-sm">
                {gameData.game_time}
              </div>
            )}
          </div>
        )}

        {/* Team Circles and Betting Info - Horizontal Layout */}
        <div className="space-y-2 sm:space-y-3 md:space-y-4 pt-1.5">
          {/* Team Circles Row */}
          <div className="flex justify-center items-center space-x-2 sm:space-x-4 md:space-x-6">
            {/* Away Team Circle */}
            <div className="text-center flex-1 max-w-[120px] sm:max-w-[140px] md:max-w-[160px]">
              {(() => {
                const logoUrl = gameData.away_logo;
                const hasLogo = logoUrl && logoUrl !== '/placeholder.svg' && logoUrl.trim() !== '';
                
                return (
                  <div
                    className="h-14 w-14 sm:h-16 sm:w-16 md:h-20 md:w-20 rounded-full flex items-center justify-center mx-auto mb-1.5 sm:mb-2 md:mb-3 shadow-lg transition-transform duration-200 hover:scale-105 overflow-hidden bg-white dark:bg-gray-800"
                    style={{
                      background: hasLogo ? 'transparent' : `linear-gradient(135deg, ${gameData.away_team_colors.primary} 0%, ${gameData.away_team_colors.secondary} 100%)`,
                      border: `2px solid ${gameData.away_team_colors.primary}`,
                    }}
                  >
                    {hasLogo ? (
                      <img 
                        src={logoUrl} 
                        alt={gameData.away_team}
                        className="w-full h-full object-contain p-1"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                          const parent = target.parentElement;
                          if (parent && !parent.querySelector('.fallback-initials')) {
                            const fallback = document.createElement('span');
                            fallback.className = 'text-base sm:text-lg md:text-2xl font-bold fallback-initials';
                            fallback.style.color = getContrastingTextColor(gameData.away_team_colors.primary, gameData.away_team_colors.secondary);
                            fallback.textContent = getTeamInitials(gameData.away_team);
                            parent.style.background = `linear-gradient(135deg, ${gameData.away_team_colors.primary} 0%, ${gameData.away_team_colors.secondary} 100%)`;
                            parent.appendChild(fallback);
                          }
                        }}
                      />
                    ) : (
                      <span 
                        className="text-base sm:text-lg md:text-2xl font-bold"
                        style={{ color: getContrastingTextColor(gameData.away_team_colors.primary, gameData.away_team_colors.secondary) }}
                      >
                        {getTeamInitials(gameData.away_team)}
                      </span>
                    )}
                  </div>
                );
              })()}
              <div className="text-xs sm:text-sm md:text-base font-bold mb-1 sm:mb-2 min-h-[2.5rem] sm:min-h-[3rem] md:min-h-[3.5rem] flex items-start justify-center text-foreground leading-tight text-center break-words px-0.5 sm:px-1 pt-1 sm:pt-2">
                {gameData.away_team}
              </div>
            </div>

            {/* @ Symbol */}
            <div className="text-center px-1 sm:px-2">
              <span className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-gray-400/50 dark:text-gray-500/50">@</span>
            </div>

            {/* Home Team Circle */}
            <div className="text-center flex-1 max-w-[120px] sm:max-w-[140px] md:max-w-[160px]">
              {(() => {
                const logoUrl = gameData.home_logo;
                const hasLogo = logoUrl && logoUrl !== '/placeholder.svg' && logoUrl.trim() !== '';
                
                return (
                  <div
                    className="h-14 w-14 sm:h-16 sm:w-16 md:h-20 md:w-20 rounded-full flex items-center justify-center mx-auto mb-1.5 sm:mb-2 md:mb-3 shadow-lg transition-transform duration-200 hover:scale-105 overflow-hidden bg-white dark:bg-gray-800"
                    style={{
                      background: hasLogo ? 'transparent' : `linear-gradient(135deg, ${gameData.home_team_colors.primary} 0%, ${gameData.home_team_colors.secondary} 100%)`,
                      border: `2px solid ${gameData.home_team_colors.primary}`,
                    }}
                  >
                    {hasLogo ? (
                      <img 
                        src={logoUrl} 
                        alt={gameData.home_team}
                        className="w-full h-full object-contain p-1"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                          const parent = target.parentElement;
                          if (parent && !parent.querySelector('.fallback-initials')) {
                            const fallback = document.createElement('span');
                            fallback.className = 'text-base sm:text-lg md:text-2xl font-bold fallback-initials';
                            fallback.style.color = getContrastingTextColor(gameData.home_team_colors.primary, gameData.home_team_colors.secondary);
                            fallback.textContent = getTeamInitials(gameData.home_team);
                            parent.style.background = `linear-gradient(135deg, ${gameData.home_team_colors.primary} 0%, ${gameData.home_team_colors.secondary} 100%)`;
                            parent.appendChild(fallback);
                          }
                        }}
                      />
                    ) : (
                      <span 
                        className="text-base sm:text-lg md:text-2xl font-bold"
                        style={{ color: getContrastingTextColor(gameData.home_team_colors.primary, gameData.home_team_colors.secondary) }}
                      >
                        {getTeamInitials(gameData.home_team)}
                      </span>
                    )}
                  </div>
                );
              })()}
              <div className="text-xs sm:text-sm md:text-base font-bold mb-1 sm:mb-2 min-h-[2.5rem] sm:min-h-[3rem] md:min-h-[3.5rem] flex items-start justify-center text-foreground leading-tight text-center break-words px-0.5 sm:px-1 pt-1 sm:pt-2">
                {gameData.home_team}
              </div>
            </div>
          </div>

          {/* Betting Lines Row */}
          <div className="flex justify-between items-center gap-1 sm:gap-2">
            {/* Away Team Betting */}
            <div className="text-center flex-1 min-w-0">
              <div className="text-sm sm:text-base md:text-lg font-bold h-5 sm:h-6 md:h-8 flex items-center justify-center text-blue-600 dark:text-blue-400">
                {formatMoneyline(gameData.away_ml)}
              </div>
              <div className="text-xs sm:text-sm md:text-base font-bold h-4 sm:h-5 md:h-6 flex items-center justify-center text-foreground">
                {formatSpread(gameData.away_spread)}
              </div>
              {pick.game_type === 'cfb' && typeof gameData.opening_spread === 'number' && (
                <div className="mt-0.5 sm:mt-1 flex justify-center">
                  <span className="text-[9px] sm:text-[10px] md:text-xs px-1 sm:px-2 py-0.5 rounded-full border bg-background text-foreground border-border">
                    Open: {formatSpread(gameData.opening_spread ? -gameData.opening_spread : null)}
                  </span>
                </div>
              )}
            </div>

            {/* Total */}
            <div className="text-center px-1 sm:px-2 md:px-4 flex-shrink-0">
              <div className="text-[10px] sm:text-xs md:text-sm font-bold text-foreground bg-primary/5 dark:bg-primary/10 px-1.5 sm:px-2 md:px-3 py-0.5 sm:py-1 rounded-full border border-primary/20 backdrop-blur-sm">
                Total: {gameData.over_line || '-'}
              </div>
            </div>

            {/* Home Team Betting */}
            <div className="text-center flex-1 min-w-0">
              <div className="text-sm sm:text-base md:text-lg font-bold h-5 sm:h-6 md:h-8 flex items-center justify-center text-green-600 dark:text-green-400">
                {formatMoneyline(gameData.home_ml)}
              </div>
              <div className="text-xs sm:text-sm md:text-base font-bold h-4 sm:h-5 md:h-6 flex items-center justify-center text-foreground">
                {formatSpread(gameData.home_spread)}
              </div>
              {pick.game_type === 'cfb' && typeof gameData.opening_spread === 'number' && (
                <div className="mt-0.5 sm:mt-1 flex justify-center">
                  <span className="text-[9px] sm:text-[10px] md:text-xs px-1 sm:px-2 py-0.5 rounded-full border bg-background text-foreground border-border">
                    Open: {formatSpread(gameData.opening_spread)}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Pick Details Section */}
        <div className="space-y-4 pt-4 border-t-2 border-gray-200/50 dark:border-gray-700/50">
          {/* Display Pick Value - prioritize new pick_value field, fallback to old bet type display */}
          <div className="bg-blue-50/50 dark:bg-blue-900/20 p-3 sm:p-4 rounded-lg border-2 border-blue-200/50 dark:border-blue-700/50 backdrop-blur-sm">
            <h4 className="text-xs sm:text-sm font-bold text-blue-900 dark:text-blue-100 mb-2 sm:mb-3 uppercase tracking-wider opacity-80">Editor's Pick</h4>
            
            {/* Show new pick_value if available */}
            {pick.pick_value ? (
              <div className="space-y-2">
                <div className="text-lg sm:text-xl md:text-2xl font-bold text-gray-900 dark:text-gray-100 leading-tight">
                  {pick.pick_value}
                </div>
                
                {/* Best Price and Sportsbook */}
                {(pick.best_price || pick.sportsbook) && (
                  <div className="flex flex-wrap gap-2 text-sm">
                    {pick.best_price && (
                      <span className="bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 px-2 py-1 rounded font-semibold border border-green-200 dark:border-green-800">
                        {pick.best_price}
                      </span>
                    )}
                    {pick.sportsbook && (
                      <span className="bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 px-2 py-1 rounded border border-gray-200 dark:border-gray-700 shadow-sm">
                        @ {pick.sportsbook}
                      </span>
                    )}
                  </div>
                )}
                
                {/* Units */}
                {pick.units && (
                  <div className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-1">
                    <span className="font-semibold text-gray-900 dark:text-gray-100">{pick.units}</span> unit{pick.units !== 1 ? 's' : ''}
                  </div>
                )}
                
                {/* Units Result Display */}
                {pick.result && pick.result !== 'pending' && (
                  <div className={`text-sm font-bold ${
                    unitsCalc.netUnits > 0 ? 'text-green-600 dark:text-green-400' :
                    unitsCalc.netUnits < 0 ? 'text-red-600 dark:text-red-400' :
                    'text-gray-600 dark:text-gray-400'
                  }`}>
                    {unitsCalc.netUnits > 0 ? '+' : ''}{unitsCalc.netUnits.toFixed(2)} units
                  </div>
                )}
              </div>
            ) : (
              /* Fallback to old bet type display for legacy picks */
              <div className="space-y-1.5 sm:space-y-2">
                {selectedBetTypes.map((betType, index) => {
                  const getBetDisplay = (type: string) => {
                    switch(type) {
                      case 'spread_away':
                        return `Spread: ${gameData.away_team} ${formatSpread(gameData.away_spread)}`;
                      case 'spread_home':
                        return `Spread: ${gameData.home_team} ${formatSpread(gameData.home_spread)}`;
                      case 'ml_away':
                        return `Moneyline: ${gameData.away_team} ${formatMoneyline(gameData.away_ml)}`;
                      case 'ml_home':
                        return `Moneyline: ${gameData.home_team} ${formatMoneyline(gameData.home_ml)}`;
                      case 'over':
                        return `Over ${gameData.over_line || 'N/A'}`;
                      case 'under':
                        return `Under ${gameData.over_line || 'N/A'}`;
                      case 'spread':
                        return `Spread: ${gameData.home_team} ${formatSpread(gameData.home_spread)}`;
                      case 'moneyline':
                        return `Moneyline: ${gameData.home_team} ${formatMoneyline(gameData.home_ml)}`;
                      case 'over_under':
                        return `Over ${gameData.over_line || 'N/A'}`;
                      default:
                        return type;
                    }
                  };

                  return (
                    <div key={index} className="text-sm sm:text-base md:text-lg font-bold text-gray-900 dark:text-gray-100 flex items-start sm:items-center">
                      <span className="text-blue-600 dark:text-blue-400 mr-1.5 sm:mr-2 mt-0.5 sm:mt-0 flex-shrink-0">•</span>
                      <span className="break-words">{getBetDisplay(betType)}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Display Notes */}
          {notes && (
            <div className="bg-gray-50/80 dark:bg-gray-800/40 p-3 sm:p-4 rounded-lg border border-gray-200/60 dark:border-gray-700/60 backdrop-blur-sm">
              <h4 className="text-xs sm:text-sm font-bold text-gray-500 dark:text-gray-400 mb-1.5 sm:mb-2 uppercase tracking-wider">Analysis</h4>
              <p className="text-xs sm:text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-words leading-relaxed">{notes}</p>
            </div>
          )}

          {/* Sportsbook Buttons */}
          {pick.is_published && (
            <div className="pt-2 border-t border-gray-200/60 dark:border-gray-700/60">
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
              />
            </div>
          )}

          {/* Admin Actions */}
          {adminModeEnabled && (
            <div className="flex flex-col gap-2">
              <div className="flex gap-2">
                <Button onClick={onEdit} variant="outline" className="flex-1">
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </Button>
              </div>
              
              {/* Result Buttons - Only show if game date has passed */}
              {isGamePast() && (
                <div className="space-y-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                  <div className="flex gap-2">
                    <Button
                      onClick={() => handleResultUpdate('won')}
                      variant={pick.result === 'won' ? 'default' : 'outline'}
                      className={`flex-1 ${
                        pick.result === 'won' 
                          ? 'bg-green-600 hover:bg-green-700 text-white' 
                          : ''
                      }`}
                      size="sm"
                    >
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Won
                    </Button>
                    <Button
                      onClick={() => handleResultUpdate('lost')}
                      variant={pick.result === 'lost' ? 'default' : 'outline'}
                      className={`flex-1 ${
                        pick.result === 'lost' 
                          ? 'bg-red-600 hover:bg-red-700 text-white' 
                          : ''
                      }`}
                      size="sm"
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      Lost
                    </Button>
                    <Button
                      onClick={() => handleResultUpdate('push')}
                      variant={pick.result === 'push' ? 'default' : 'outline'}
                      className={`flex-1 ${
                        pick.result === 'push' 
                          ? 'bg-gray-600 hover:bg-gray-700 text-white' 
                          : ''
                      }`}
                      size="sm"
                    >
                      <Minus className="h-4 w-4 mr-2" />
                      Push
                    </Button>
                  </div>
                  
                  {/* Clear Result Button - Only show if a result is set */}
                  {pick.result && pick.result !== 'pending' && (
                    <Button
                      onClick={async () => {
                        try {
                          const { error } = await supabase
                            .from('editors_picks')
                            .update({ result: null } as any)
                            .eq('id', pick.id);
                          
                          if (error) throw error;
                          
                          toast({
                            title: 'Result Cleared',
                            description: 'Pick result has been reset.',
                          });
                          
                          if (onUpdate) {
                            onUpdate();
                          }
                        } catch (error) {
                          console.error('Error clearing result:', error);
                          toast({
                            title: 'Error',
                            description: 'Failed to clear result. Please try again.',
                            variant: 'destructive',
                          });
                        }
                      }}
                      variant="ghost"
                      size="sm"
                      className="w-full"
                    >
                      <RotateCcw className="h-4 w-4 mr-2" />
                      Clear Result
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
