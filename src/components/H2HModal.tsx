import React, { useState, useEffect } from 'react';
import { X, Calendar, Trophy, Target, ArrowUp, ArrowDown } from 'lucide-react';
import { collegeFootballSupabase } from '@/integrations/supabase/college-football-client';
import { useIsMobile } from '@/hooks/use-mobile';

interface H2HGame {
  id: number;
  home_team: string;
  away_team: string;
  week: number;
  game_date: string;
  home_score: number;
  away_score: number;
  home_spread: number;
  away_spread: number;
  home_away_spread_cover: number;
  home_away_ml: number;
  away_ml?: number;
  ou_result: number;
  ou_vegas_line?: number;
  season: number;
}

interface H2HModalProps {
  isOpen: boolean;
  onClose: () => void;
  homeTeam: string;
  awayTeam: string;
}

const H2HModal: React.FC<H2HModalProps> = ({ isOpen, onClose, homeTeam, awayTeam }) => {
  const [games, setGames] = useState<H2HGame[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isMobile = useIsMobile();

  useEffect(() => {
    if (isOpen && homeTeam && awayTeam) {
      console.log('H2HModal: Opening modal for', homeTeam, 'vs', awayTeam);
      fetchH2HData();
    }
  }, [isOpen, homeTeam, awayTeam]);

  const fetchH2HData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      console.log('Fetching H2H data for:', homeTeam, 'vs', awayTeam);
      
      const { data, error } = await collegeFootballSupabase
        .from('nfl_training_data')
        .select('*')
        .or(`and(home_team.eq."${homeTeam}",away_team.eq."${awayTeam}"),and(home_team.eq."${awayTeam}",away_team.eq."${homeTeam}")`)
        .order('game_date', { ascending: false })
        .limit(5);

      console.log('Query result:', { data, error });

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }
      
      setGames(data || []);
    } catch (err) {
      console.error('Error fetching H2H data:', err);
      setError('Failed to load historical data');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const getWinner = (homeScore: number, awayScore: number, homeTeam: string, awayTeam: string) => {
    return homeScore > awayScore ? homeTeam : awayTeam;
  };

  const getSpreadResult = (homeScore: number, awayScore: number, homeSpread: number, awaySpread: number, homeTeam: string, awayTeam: string, homeAwaySpreadCover: number) => {
    // Use the home_away_spread_cover field to determine who covered
    // 1 = home team covered, 0 = away team covered
    
    if (homeAwaySpreadCover === 1) {
      // Home team covered
      return { 
        winner: homeTeam, 
        covered: true, 
        spreadLine: homeSpread 
      };
    } else if (homeAwaySpreadCover === 0) {
      // Away team covered
      return { 
        winner: awayTeam, 
        covered: true, 
        spreadLine: awaySpread 
      };
    } else {
      // Push or no data
      return { 
        winner: 'Push', 
        covered: false, 
        spreadLine: 0 
      };
    }
  };

  const getMLResult = (homeScore: number, awayScore: number, homeML: number, awayML: number | null, homeTeam: string, awayTeam: string) => {
    const winner = getWinner(homeScore, awayScore, homeTeam, awayTeam);
    const winnerML = winner === homeTeam ? homeML : (awayML || 0);
    return { winner, ml: winnerML };
  };

  const getOUResult = (homeScore: number, awayScore: number, ouResult: number) => {
    const total = homeScore + awayScore;
    if (total > ouResult) return 'Over';
    if (total < ouResult) return 'Under';
    return 'Push';
  };

  const getOUDisplay = (ouResult: number) => {
    // If ou_result is 0, it means Under; if 1, it means Over
    return ouResult === 1 ? 'Over' : 'Under';
  };

  const getTeamLogo = (teamName: string) => {
    console.log('Getting logo for team:', teamName); // Debug log
    
    // Use the same mapping as the main NFL page
    const logoMap: { [key: string]: string } = {
      'Arizona': 'https://a.espncdn.com/i/teamlogos/nfl/500/ari.png',
      'Atlanta': 'https://a.espncdn.com/i/teamlogos/nfl/500/atl.png',
      'Baltimore': 'https://a.espncdn.com/i/teamlogos/nfl/500/bal.png',
      'Buffalo': 'https://a.espncdn.com/i/teamlogos/nfl/500/buf.png',
      'Carolina': 'https://a.espncdn.com/i/teamlogos/nfl/500/car.png',
      'Chicago': 'https://a.espncdn.com/i/teamlogos/nfl/500/chi.png',
      'Cincinnati': 'https://a.espncdn.com/i/teamlogos/nfl/500/cin.png',
      'Cleveland': 'https://a.espncdn.com/i/teamlogos/nfl/500/cle.png',
      'Dallas': 'https://a.espncdn.com/i/teamlogos/nfl/500/dal.png',
      'Denver': 'https://a.espncdn.com/i/teamlogos/nfl/500/den.png',
      'Detroit': 'https://a.espncdn.com/i/teamlogos/nfl/500/det.png',
      'Green Bay': 'https://a.espncdn.com/i/teamlogos/nfl/500/gb.png',
      'Houston': 'https://a.espncdn.com/i/teamlogos/nfl/500/hou.png',
      'Indianapolis': 'https://a.espncdn.com/i/teamlogos/nfl/500/ind.png',
      'Jacksonville': 'https://a.espncdn.com/i/teamlogos/nfl/500/jax.png',
      'Kansas City': 'https://a.espncdn.com/i/teamlogos/nfl/500/kc.png',
      'Las Vegas': 'https://a.espncdn.com/i/teamlogos/nfl/500/lv.png',
      'Los Angeles Chargers': 'https://a.espncdn.com/i/teamlogos/nfl/500/lac.png',
      'Los Angeles Rams': 'https://a.espncdn.com/i/teamlogos/nfl/500/lar.png',
      'LA Chargers': 'https://a.espncdn.com/i/teamlogos/nfl/500/lac.png',
      'LA Rams': 'https://a.espncdn.com/i/teamlogos/nfl/500/lar.png',
      'Miami': 'https://a.espncdn.com/i/teamlogos/nfl/500/mia.png',
      'Minnesota': 'https://a.espncdn.com/i/teamlogos/nfl/500/min.png',
      'New England': 'https://a.espncdn.com/i/teamlogos/nfl/500/ne.png',
      'New Orleans': 'https://a.espncdn.com/i/teamlogos/nfl/500/no.png',
      'NY Giants': 'https://a.espncdn.com/i/teamlogos/nfl/500/nyg.png',
      'NY Jets': 'https://a.espncdn.com/i/teamlogos/nfl/500/nyj.png',
      'Philadelphia': 'https://a.espncdn.com/i/teamlogos/nfl/500/phi.png',
      'Pittsburgh': 'https://a.espncdn.com/i/teamlogos/nfl/500/pit.png',
      'San Francisco': 'https://a.espncdn.com/i/teamlogos/nfl/500/sf.png',
      'Seattle': 'https://a.espncdn.com/i/teamlogos/nfl/500/sea.png',
      'Tampa Bay': 'https://a.espncdn.com/i/teamlogos/nfl/500/tb.png',
      'Tennessee': 'https://a.espncdn.com/i/teamlogos/nfl/500/ten.png',
      'Washington': 'https://a.espncdn.com/i/teamlogos/nfl/500/wsh.png',
      
      // Additional variations that might appear in historical data
      'New York Giants': 'https://a.espncdn.com/i/teamlogos/nfl/500/nyg.png',
      'New York Jets': 'https://a.espncdn.com/i/teamlogos/nfl/500/nyj.png',
      'Arizona Cardinals': 'https://a.espncdn.com/i/teamlogos/nfl/500/ari.png',
      'Atlanta Falcons': 'https://a.espncdn.com/i/teamlogos/nfl/500/atl.png',
      'Baltimore Ravens': 'https://a.espncdn.com/i/teamlogos/nfl/500/bal.png',
      'Buffalo Bills': 'https://a.espncdn.com/i/teamlogos/nfl/500/buf.png',
      'Carolina Panthers': 'https://a.espncdn.com/i/teamlogos/nfl/500/car.png',
      'Chicago Bears': 'https://a.espncdn.com/i/teamlogos/nfl/500/chi.png',
      'Cincinnati Bengals': 'https://a.espncdn.com/i/teamlogos/nfl/500/cin.png',
      'Cleveland Browns': 'https://a.espncdn.com/i/teamlogos/nfl/500/cle.png',
      'Dallas Cowboys': 'https://a.espncdn.com/i/teamlogos/nfl/500/dal.png',
      'Denver Broncos': 'https://a.espncdn.com/i/teamlogos/nfl/500/den.png',
      'Detroit Lions': 'https://a.espncdn.com/i/teamlogos/nfl/500/det.png',
      'Green Bay Packers': 'https://a.espncdn.com/i/teamlogos/nfl/500/gb.png',
      'Houston Texans': 'https://a.espncdn.com/i/teamlogos/nfl/500/hou.png',
      'Indianapolis Colts': 'https://a.espncdn.com/i/teamlogos/nfl/500/ind.png',
      'Jacksonville Jaguars': 'https://a.espncdn.com/i/teamlogos/nfl/500/jax.png',
      'Kansas City Chiefs': 'https://a.espncdn.com/i/teamlogos/nfl/500/kc.png',
      'Las Vegas Raiders': 'https://a.espncdn.com/i/teamlogos/nfl/500/lv.png',
      'Miami Dolphins': 'https://a.espncdn.com/i/teamlogos/nfl/500/mia.png',
      'Minnesota Vikings': 'https://a.espncdn.com/i/teamlogos/nfl/500/min.png',
      'New England Patriots': 'https://a.espncdn.com/i/teamlogos/nfl/500/ne.png',
      'New Orleans Saints': 'https://a.espncdn.com/i/teamlogos/nfl/500/no.png',
      'Philadelphia Eagles': 'https://a.espncdn.com/i/teamlogos/nfl/500/phi.png',
      'Pittsburgh Steelers': 'https://a.espncdn.com/i/teamlogos/nfl/500/pit.png',
      'San Francisco 49ers': 'https://a.espncdn.com/i/teamlogos/nfl/500/sf.png',
      'Seattle Seahawks': 'https://a.espncdn.com/i/teamlogos/nfl/500/sea.png',
      'Tampa Bay Buccaneers': 'https://a.espncdn.com/i/teamlogos/nfl/500/tb.png',
      'Tennessee Titans': 'https://a.espncdn.com/i/teamlogos/nfl/500/ten.png',
      'Washington Commanders': 'https://a.espncdn.com/i/teamlogos/nfl/500/wsh.png'
    };
    
    // Try exact match first
    if (logoMap[teamName]) {
      return logoMap[teamName];
    }
    
    // Try case-insensitive match
    const lowerTeamName = teamName.toLowerCase();
    for (const [key, value] of Object.entries(logoMap)) {
      if (key.toLowerCase() === lowerTeamName) {
        return value;
      }
    }
    
    console.log('No logo found for team:', teamName); // Debug log
    return 'https://a.espncdn.com/i/teamlogos/nfl/500/default.png';
  };

  // Calculate summary statistics
  const calculateSummaryStats = () => {
    if (!games || games.length === 0) {
      return {
        homeTeamWins: 0,
        awayTeamWins: 0,
        homeTeamCovers: 0,
        awayTeamCovers: 0,
        overs: 0,
        unders: 0
      };
    }

    let homeTeamWins = 0;
    let awayTeamWins = 0;
    let homeTeamCovers = 0;
    let awayTeamCovers = 0;
    let overs = 0;
    let unders = 0;

    games.forEach(game => {
      // Count wins - check which team actually won based on scores
      if (game.home_score > game.away_score) {
        // Home team won
        if (game.home_team === homeTeam) {
          homeTeamWins++;
        } else {
          awayTeamWins++;
        }
      } else if (game.away_score > game.home_score) {
        // Away team won
        if (game.away_team === homeTeam) {
          homeTeamWins++;
        } else {
          awayTeamWins++;
        }
      }

      // Count covers - check which team covered based on home_away_spread_cover
      if (game.home_away_spread_cover === 1) {
        // Home team covered
        if (game.home_team === homeTeam) {
          homeTeamCovers++;
        } else {
          awayTeamCovers++;
        }
      } else if (game.home_away_spread_cover === 0) {
        // Away team covered
        if (game.away_team === homeTeam) {
          homeTeamCovers++;
        } else {
          awayTeamCovers++;
        }
      }

      // Count over/under
      if (game.ou_result === 1) {
        overs++;
      } else if (game.ou_result === 0) {
        unders++;
      }
    });

    return {
      homeTeamWins,
      awayTeamWins,
      homeTeamCovers,
      awayTeamCovers,
      overs,
      unders
    };
  };

  const stats = calculateSummaryStats();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50 p-2 sm:p-4">
      <div className={`bg-background rounded-2xl shadow-xl w-full flex flex-col overflow-hidden ${
        isMobile 
          ? 'max-w-sm max-h-[95vh] mx-2' 
          : 'max-w-4xl max-h-[90vh]'
      }`}>
        {/* Header */}
        <div className={`flex items-center justify-between border-b border-border bg-background sticky top-0 z-10 ${
          isMobile ? 'px-4 py-3 shadow-sm' : 'px-8 py-5'
        }`}>
          <div className={`flex items-center ${isMobile ? 'space-x-2' : 'space-x-4'}`}>
            <div className={`rounded-full bg-gradient-to-br from-amber-400 to-amber-500 flex items-center justify-center shadow-sm ${
              isMobile ? 'w-8 h-8' : 'w-10 h-10'
            }`}>
              <Trophy className={`text-white ${isMobile ? 'h-4 w-4' : 'h-5 w-5'}`} />
            </div>
            <div>
              <h2 className={`font-bold text-foreground ${isMobile ? 'text-base' : 'text-xl'}`}>
                {isMobile ? `${homeTeam.length > 8 ? homeTeam.substring(0, 8) + '...' : homeTeam} vs ${awayTeam.length > 8 ? awayTeam.substring(0, 8) + '...' : awayTeam}` : `${homeTeam} vs ${awayTeam}`}
              </h2>
              <p className={`text-muted-foreground font-medium ${isMobile ? 'text-[11px]' : 'text-sm'}`}>
                {isMobile ? 'H2H Analysis' : 'Most Recent Head to Head Analysis'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`rounded-full bg-muted hover:bg-muted/80 flex items-center justify-center transition-colors duration-200 ${
              isMobile ? 'w-9 h-9' : 'w-8 h-8'
            }`}
          >
            <X className={`text-muted-foreground ${isMobile ? 'h-5 w-5' : 'h-4 w-4'}`} />
          </button>
        </div>

        {/* Summary Statistics */}
        <div className={`bg-gradient-to-r from-muted/20 to-muted/40 border-b border-border ${
          isMobile ? 'px-3 py-3' : 'px-8 py-6'
        }`}>
          {isMobile ? (
            // Mobile: Single combined container
            <div className="bg-card rounded-xl shadow-sm border border-border p-3">
              <div className="grid grid-cols-3 gap-2">
                {/* Wins */}
                <div className="text-center">
                  <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Wins</h3>
                  <div className="flex items-center justify-center space-x-2">
                    <div className={`flex flex-col items-center p-1 rounded-lg transition-all duration-200 ${
                      stats.awayTeamWins > stats.homeTeamWins 
                        ? 'bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800' 
                        : 'bg-transparent'
                    }`}>
                      <img 
                        src={getTeamLogo(awayTeam)} 
                        alt={`${awayTeam} logo`}
                        className="object-contain w-6 h-6"
                      />
                      <div className="font-bold text-foreground text-sm">{stats.awayTeamWins}</div>
                    </div>
                    <div className={`flex flex-col items-center p-1 rounded-lg transition-all duration-200 ${
                      stats.homeTeamWins > stats.awayTeamWins 
                        ? 'bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800' 
                        : 'bg-transparent'
                    }`}>
                      <img 
                        src={getTeamLogo(homeTeam)} 
                        alt={`${homeTeam} logo`}
                        className="object-contain w-6 h-6"
                      />
                      <div className="font-bold text-foreground text-sm">{stats.homeTeamWins}</div>
                    </div>
                  </div>
                </div>

                {/* Covers */}
                <div className="text-center">
                  <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Covers</h3>
                  <div className="flex items-center justify-center space-x-2">
                    <div className={`flex flex-col items-center p-1 rounded-lg transition-all duration-200 ${
                      stats.awayTeamCovers > stats.homeTeamCovers 
                        ? 'bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800' 
                        : 'bg-transparent'
                    }`}>
                      <img 
                        src={getTeamLogo(awayTeam)} 
                        alt={`${awayTeam} logo`}
                        className="object-contain w-6 h-6"
                      />
                      <div className="font-bold text-foreground text-sm">{stats.awayTeamCovers}</div>
                    </div>
                    <div className={`flex flex-col items-center p-1 rounded-lg transition-all duration-200 ${
                      stats.homeTeamCovers > stats.awayTeamCovers 
                        ? 'bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800' 
                        : 'bg-transparent'
                    }`}>
                      <img 
                        src={getTeamLogo(homeTeam)} 
                        alt={`${homeTeam} logo`}
                        className="object-contain w-6 h-6"
                      />
                      <div className="font-bold text-foreground text-sm">{stats.homeTeamCovers}</div>
                    </div>
                  </div>
                </div>

                {/* O/U */}
                <div className="text-center">
                  <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">O/U</h3>
                  <div className="flex items-center justify-center space-x-2">
                    <div className={`flex flex-col items-center p-1 rounded-lg transition-all duration-200 ${
                      stats.overs > stats.unders 
                        ? 'bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800' 
                        : 'bg-transparent'
                    }`}>
                      <div className="rounded-full bg-emerald-50 dark:bg-emerald-950/50 flex items-center justify-center w-6 h-6">
                        <ArrowUp className="text-emerald-600 dark:text-emerald-400 h-3 w-3" />
                      </div>
                      <div className="font-bold text-foreground text-sm">{stats.overs}</div>
                    </div>
                    <div className={`flex flex-col items-center p-1 rounded-lg transition-all duration-200 ${
                      stats.unders > stats.overs 
                        ? 'bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800' 
                        : 'bg-transparent'
                    }`}>
                      <div className="rounded-full bg-red-50 dark:bg-red-950/50 flex items-center justify-center w-6 h-6">
                        <ArrowDown className="text-red-600 dark:text-red-400 h-3 w-3" />
                      </div>
                      <div className="font-bold text-foreground text-sm">{stats.unders}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            // Desktop: Original three separate containers
            <div className="grid grid-cols-3 gap-8">
              {/* Wins */}
              <div className="bg-card rounded-xl shadow-sm border border-border hover:shadow-md transition-shadow duration-200 p-6">
                <div className="text-center">
                  <h3 className="font-semibold text-muted-foreground uppercase tracking-wide text-sm mb-6">Wins</h3>
                  <div className="flex items-center justify-center space-x-12">
                    <div className={`flex flex-col items-center p-3 rounded-lg transition-all duration-200 space-y-4 ${
                      stats.awayTeamWins > stats.homeTeamWins 
                        ? 'bg-green-50 dark:bg-green-950/30 border-2 border-green-200 dark:border-green-800 shadow-sm' 
                        : 'bg-transparent'
                    }`}>
                      <img 
                        src={getTeamLogo(awayTeam)} 
                        alt={`${awayTeam} logo`}
                        className="object-contain w-16 h-16"
                      />
                      <div className="font-bold text-foreground text-3xl">{stats.awayTeamWins}</div>
                    </div>
                    <div className={`flex flex-col items-center p-3 rounded-lg transition-all duration-200 space-y-4 ${
                      stats.homeTeamWins > stats.awayTeamWins 
                        ? 'bg-green-50 dark:bg-green-950/30 border-2 border-green-200 dark:border-green-800 shadow-sm' 
                        : 'bg-transparent'
                    }`}>
                      <img 
                        src={getTeamLogo(homeTeam)} 
                        alt={`${homeTeam} logo`}
                        className="object-contain w-16 h-16"
                      />
                      <div className="font-bold text-foreground text-3xl">{stats.homeTeamWins}</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Covers */}
              <div className="bg-card rounded-xl shadow-sm border border-border hover:shadow-md transition-shadow duration-200 p-6">
                <div className="text-center">
                  <h3 className="font-semibold text-muted-foreground uppercase tracking-wide text-sm mb-6">Covers</h3>
                  <div className="flex items-center justify-center space-x-12">
                    <div className={`flex flex-col items-center p-3 rounded-lg transition-all duration-200 space-y-4 ${
                      stats.awayTeamCovers > stats.homeTeamCovers 
                        ? 'bg-green-50 dark:bg-green-950/30 border-2 border-green-200 dark:border-green-800 shadow-sm' 
                        : 'bg-transparent'
                    }`}>
                      <img 
                        src={getTeamLogo(awayTeam)} 
                        alt={`${awayTeam} logo`}
                        className="object-contain w-16 h-16"
                      />
                      <div className="font-bold text-foreground text-3xl">{stats.awayTeamCovers}</div>
                    </div>
                    <div className={`flex flex-col items-center p-3 rounded-lg transition-all duration-200 space-y-4 ${
                      stats.homeTeamCovers > stats.awayTeamCovers 
                        ? 'bg-green-50 dark:bg-green-950/30 border-2 border-green-200 dark:border-green-800 shadow-sm' 
                        : 'bg-transparent'
                    }`}>
                      <img 
                        src={getTeamLogo(homeTeam)} 
                        alt={`${homeTeam} logo`}
                        className="object-contain w-16 h-16"
                      />
                      <div className="font-bold text-foreground text-3xl">{stats.homeTeamCovers}</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Over/Under */}
              <div className="bg-card rounded-xl shadow-sm border border-border hover:shadow-md transition-shadow duration-200 p-6">
                <div className="text-center">
                  <h3 className="font-semibold text-muted-foreground uppercase tracking-wide text-sm mb-6">Over/Under</h3>
                  <div className="flex items-center justify-center space-x-12">
                    <div className={`flex flex-col items-center p-3 rounded-lg transition-all duration-200 space-y-3 ${
                      stats.overs > stats.unders 
                        ? 'bg-green-50 dark:bg-green-950/30 border-2 border-green-200 dark:border-green-800 shadow-sm' 
                        : 'bg-transparent'
                    }`}>
                      <div className="rounded-full bg-emerald-50 dark:bg-emerald-950/50 flex items-center justify-center w-14 h-14">
                        <ArrowUp className="text-emerald-600 dark:text-emerald-400 h-7 w-7" />
                      </div>
                      <div className="font-bold text-foreground text-3xl">{stats.overs}</div>
                      <div className="font-medium text-emerald-600 dark:text-emerald-400 text-sm">Over</div>
                    </div>
                    <div className={`flex flex-col items-center p-3 rounded-lg transition-all duration-200 space-y-3 ${
                      stats.unders > stats.overs 
                        ? 'bg-green-50 dark:bg-green-950/30 border-2 border-green-200 dark:border-green-800 shadow-sm' 
                        : 'bg-transparent'
                    }`}>
                      <div className="rounded-full bg-red-50 dark:bg-red-950/50 flex items-center justify-center w-14 h-14">
                        <ArrowDown className="text-red-600 dark:text-red-400 h-7 w-7" />
                      </div>
                      <div className="font-bold text-foreground text-3xl">{stats.unders}</div>
                      <div className="font-medium text-red-600 dark:text-red-400 text-sm">Under</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Content */}
        <div className={`overflow-y-auto flex-1 ${isMobile ? 'p-4' : 'p-6'} ${isMobile ? 'scroll-smooth' : ''}`} style={{ 
          WebkitOverflowScrolling: isMobile ? 'touch' : 'auto',
          scrollBehavior: isMobile ? 'smooth' : 'auto'
        }}>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              <span className="ml-3 text-muted-foreground">Loading historical data...</span>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <div className="text-destructive text-lg font-medium">{error}</div>
              <button
                onClick={fetchH2HData}
                className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
              >
                Try Again
              </button>
            </div>
          ) : games.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-muted-foreground text-lg">No historical matchups found</div>
              <div className="text-muted-foreground/70 text-sm mt-2">
                These teams haven't played each other recently
              </div>
            </div>
          ) : (
            <div className={`space-y-3 ${isMobile ? 'space-y-3' : 'space-y-4'}`}>
              <div className={`text-muted-foreground ${isMobile ? 'text-xs mb-2' : 'text-sm mb-4'}`}>
                Last {games.length} matchup{games.length !== 1 ? 's' : ''} between these teams:
              </div>
              
              {games.map((game, index) => {
                const winner = getWinner(game.home_score, game.away_score, game.home_team, game.away_team);
                const spreadResult = getSpreadResult(game.home_score, game.away_score, game.home_spread, game.away_spread, game.home_team, game.away_team, game.home_away_spread_cover);
                const mlResult = getMLResult(game.home_score, game.away_score, game.home_away_ml, game.away_ml, game.home_team, game.away_team);
                const ouResult = getOUResult(game.home_score, game.away_score, game.ou_result);

                return (
                  <div key={game.id} className={`border border-border rounded-lg bg-muted/50 ${
                    isMobile ? 'p-2.5' : 'p-4'
                  }`}>
                    <div className={`flex items-center justify-between ${isMobile ? 'mb-2' : 'mb-3'}`}>
                      <div className={`flex items-center ${isMobile ? 'space-x-1' : 'space-x-2'}`}>
                        <Calendar className={`text-muted-foreground ${isMobile ? 'h-3 w-3' : 'h-4 w-4'}`} />
                        <span className={`font-medium text-muted-foreground ${isMobile ? 'text-xs' : 'text-sm'}`}>
                          {formatDate(game.game_date)} - Week {game.week}
                        </span>
                      </div>
                      <div className={`text-muted-foreground ${isMobile ? 'text-xs' : 'text-sm'}`}>
                        Season {game.season}
                      </div>
                    </div>

                    {/* Betting Results */}
                    <div className={`grid items-center ${
                      isMobile ? 'grid-cols-1 gap-2' : 'grid-cols-3 gap-6'
                    }`}>
                      {/* Spread */}
                      <div className={`text-center ${isMobile ? 'py-2 border-b border-border' : ''}`}>
                        <div className={`flex items-center justify-center mb-2 ${
                          isMobile ? 'space-x-1' : 'space-x-1'
                        }`}>
                          <Target className={`text-primary ${isMobile ? 'h-4 w-4' : 'h-5 w-5'}`} />
                          <span className={`font-medium text-foreground ${
                            isMobile ? 'text-sm' : 'text-base'
                          }`}>Spread</span>
                        </div>
                        <div className={`font-semibold ${
                          isMobile ? 'text-base' : 'text-lg'
                        } ${
                          spreadResult.covered ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                        }`}>
                          {spreadResult.winner} {spreadResult.spreadLine > 0 ? '+' : ''}{spreadResult.spreadLine} {spreadResult.covered ? '✓' : '✗'}
                        </div>
                      </div>

                      {/* Score */}
                      <div className={`text-center ${isMobile ? 'py-2 border-b border-border' : ''}`}>
                        <div className={`flex items-center justify-center whitespace-nowrap ${
                          isMobile ? 'space-x-3' : 'space-x-6'
                        }`}>
                          <div className="flex flex-col items-center">
                            <span className={`font-medium text-muted-foreground mb-1 ${
                              isMobile ? 'text-xs' : 'text-xs'
                            }`}>Home</span>
                            <img 
                              src={getTeamLogo(game.home_team)} 
                              alt={game.home_team}
                              className={`object-contain flex-shrink-0 ${
                                isMobile ? 'h-8 w-8' : 'h-12 w-12'
                              }`}
                            />
                          </div>
                          <div className={`font-bold text-foreground flex-shrink-0 ${
                            isMobile ? 'text-2xl' : 'text-4xl'
                          }`}>
                            {game.home_score} - {game.away_score}
                          </div>
                          <div className="flex flex-col items-center">
                            <span className={`font-medium text-muted-foreground mb-1 ${
                              isMobile ? 'text-xs' : 'text-xs'
                            }`}>Away</span>
                            <img 
                              src={getTeamLogo(game.away_team)} 
                              alt={game.away_team}
                              className={`object-contain flex-shrink-0 ${
                                isMobile ? 'h-8 w-8' : 'h-12 w-12'
                              }`}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Over/Under */}
                      <div className={`text-center ${isMobile ? 'py-2' : ''}`}>
                        <div className={`flex items-center justify-center mb-2 ${
                          isMobile ? 'space-x-1' : 'space-x-1'
                        }`}>
                          <span className={`font-medium text-foreground ${
                            isMobile ? 'text-sm' : 'text-base'
                          }`}>Over/Under</span>
                        </div>
                        <div className={`font-semibold flex items-center justify-center space-x-1 ${
                          isMobile ? 'text-base' : 'text-lg'
                        } ${
                          game.ou_result === 1 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                        }`}>
                          <span>{getOUDisplay(game.ou_result)} {game.ou_vegas_line}</span>
                          {game.ou_result === 1 ? (
                            <ArrowUp className={`text-green-600 dark:text-green-400 ${isMobile ? 'h-4 w-4' : 'h-5 w-5'}`} />
                          ) : (
                            <ArrowDown className={`text-red-600 dark:text-red-400 ${isMobile ? 'h-4 w-4' : 'h-5 w-5'}`} />
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default H2HModal;
