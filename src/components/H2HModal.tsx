import React, { useState, useEffect } from 'react';
import { X, Calendar, Trophy, Target, ArrowUp, ArrowDown } from 'lucide-react';
import { collegeFootballSupabase } from '@/integrations/supabase/college-football-client';

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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-8 py-6 border-b border-slate-200 bg-white">
          <div className="flex items-center space-x-4">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-amber-500 flex items-center justify-center shadow-sm">
              <Trophy className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">
                {homeTeam} vs {awayTeam}
              </h2>
              <p className="text-sm text-slate-500 font-medium">Most Recent Head to Head Analysis</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors duration-200"
          >
            <X className="h-4 w-4 text-slate-600" />
          </button>
        </div>

        {/* Summary Statistics */}
        <div className="px-8 py-6 bg-gradient-to-r from-slate-50 to-slate-100 border-b border-slate-200">
          <div className="grid grid-cols-3 gap-8">
            {/* Wins */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 hover:shadow-md transition-shadow duration-200">
              <div className="text-center">
                <h3 className="text-sm font-semibold text-slate-600 uppercase tracking-wide mb-6">Wins</h3>
                <div className="flex items-center justify-center space-x-12">
                  <div className={`flex flex-col items-center space-y-4 p-3 rounded-lg transition-all duration-200 ${
                    stats.awayTeamWins > stats.homeTeamWins 
                      ? 'bg-green-50 border-2 border-green-200 shadow-sm' 
                      : 'bg-transparent'
                  }`}>
                    <img 
                      src={getTeamLogo(awayTeam)} 
                      alt={`${awayTeam} logo`}
                      className="w-16 h-16 object-contain"
                    />
                    <div className="text-3xl font-bold text-slate-900">{stats.awayTeamWins}</div>
                  </div>
                  <div className={`flex flex-col items-center space-y-4 p-3 rounded-lg transition-all duration-200 ${
                    stats.homeTeamWins > stats.awayTeamWins 
                      ? 'bg-green-50 border-2 border-green-200 shadow-sm' 
                      : 'bg-transparent'
                  }`}>
                    <img 
                      src={getTeamLogo(homeTeam)} 
                      alt={`${homeTeam} logo`}
                      className="w-16 h-16 object-contain"
                    />
                    <div className="text-3xl font-bold text-slate-900">{stats.homeTeamWins}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Covers */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 hover:shadow-md transition-shadow duration-200">
              <div className="text-center">
                <h3 className="text-sm font-semibold text-slate-600 uppercase tracking-wide mb-6">Covers</h3>
                <div className="flex items-center justify-center space-x-12">
                  <div className={`flex flex-col items-center space-y-4 p-3 rounded-lg transition-all duration-200 ${
                    stats.awayTeamCovers > stats.homeTeamCovers 
                      ? 'bg-green-50 border-2 border-green-200 shadow-sm' 
                      : 'bg-transparent'
                  }`}>
                    <img 
                      src={getTeamLogo(awayTeam)} 
                      alt={`${awayTeam} logo`}
                      className="w-16 h-16 object-contain"
                    />
                    <div className="text-3xl font-bold text-slate-900">{stats.awayTeamCovers}</div>
                  </div>
                  <div className={`flex flex-col items-center space-y-4 p-3 rounded-lg transition-all duration-200 ${
                    stats.homeTeamCovers > stats.awayTeamCovers 
                      ? 'bg-green-50 border-2 border-green-200 shadow-sm' 
                      : 'bg-transparent'
                  }`}>
                    <img 
                      src={getTeamLogo(homeTeam)} 
                      alt={`${homeTeam} logo`}
                      className="w-16 h-16 object-contain"
                    />
                    <div className="text-3xl font-bold text-slate-900">{stats.homeTeamCovers}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Over/Under */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 hover:shadow-md transition-shadow duration-200">
              <div className="text-center">
                <h3 className="text-sm font-semibold text-slate-600 uppercase tracking-wide mb-6">Over/Under</h3>
                <div className="flex items-center justify-center space-x-12">
                  <div className={`flex flex-col items-center space-y-3 p-3 rounded-lg transition-all duration-200 ${
                    stats.overs > stats.unders 
                      ? 'bg-green-50 border-2 border-green-200 shadow-sm' 
                      : 'bg-transparent'
                  }`}>
                    <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center">
                      <ArrowUp className="h-7 w-7 text-emerald-600" />
                    </div>
                    <div className="text-3xl font-bold text-slate-900">{stats.overs}</div>
                    <div className="text-sm font-medium text-emerald-600">Over</div>
                  </div>
                  <div className={`flex flex-col items-center space-y-3 p-3 rounded-lg transition-all duration-200 ${
                    stats.unders > stats.overs 
                      ? 'bg-green-50 border-2 border-green-200 shadow-sm' 
                      : 'bg-transparent'
                  }`}>
                    <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center">
                      <ArrowDown className="h-7 w-7 text-red-600" />
                    </div>
                    <div className="text-3xl font-bold text-slate-900">{stats.unders}</div>
                    <div className="text-sm font-medium text-red-600">Under</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-3 text-gray-600">Loading historical data...</span>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <div className="text-red-500 text-lg font-medium">{error}</div>
              <button
                onClick={fetchH2HData}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Try Again
              </button>
            </div>
          ) : games.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-gray-500 text-lg">No historical matchups found</div>
              <div className="text-gray-400 text-sm mt-2">
                These teams haven't played each other recently
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="text-sm text-gray-600 mb-4">
                Last {games.length} matchup{games.length !== 1 ? 's' : ''} between these teams:
              </div>
              
              {games.map((game, index) => {
                const winner = getWinner(game.home_score, game.away_score, game.home_team, game.away_team);
                const spreadResult = getSpreadResult(game.home_score, game.away_score, game.home_spread, game.away_spread, game.home_team, game.away_team, game.home_away_spread_cover);
                const mlResult = getMLResult(game.home_score, game.away_score, game.home_away_ml, game.away_ml, game.home_team, game.away_team);
                const ouResult = getOUResult(game.home_score, game.away_score, game.ou_result);

                return (
                  <div key={game.id} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-2">
                        <Calendar className="h-4 w-4 text-gray-500" />
                        <span className="text-sm font-medium text-gray-600">
                          {formatDate(game.game_date)} - Week {game.week}
                        </span>
                      </div>
                      <div className="text-sm text-gray-500">
                        Season {game.season}
                      </div>
                    </div>

                    {/* Betting Results */}
                    <div className="grid grid-cols-3 gap-6 items-center">
                      {/* Spread */}
                      <div className="text-center">
                        <div className="flex items-center justify-center space-x-1 mb-2">
                          <Target className="h-5 w-5 text-blue-500" />
                          <span className="text-base font-medium text-gray-700">Spread</span>
                        </div>
                        <div className={`text-lg font-semibold ${
                          spreadResult.covered ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {spreadResult.winner} {spreadResult.spreadLine > 0 ? '+' : ''}{spreadResult.spreadLine} {spreadResult.covered ? '✓' : '✗'}
                        </div>
                      </div>

                      {/* Score */}
                      <div className="text-center">
                        <div className="flex items-center justify-center space-x-6 whitespace-nowrap">
                          <div className="flex flex-col items-center">
                            <span className="text-xs font-medium text-gray-500 mb-1">Home</span>
                            <img 
                              src={getTeamLogo(game.home_team)} 
                              alt={game.home_team}
                              className="h-12 w-12 object-contain flex-shrink-0"
                            />
                          </div>
                          <div className="text-4xl font-bold text-gray-900 flex-shrink-0">
                            {game.home_score} - {game.away_score}
                          </div>
                          <div className="flex flex-col items-center">
                            <span className="text-xs font-medium text-gray-500 mb-1">Away</span>
                            <img 
                              src={getTeamLogo(game.away_team)} 
                              alt={game.away_team}
                              className="h-12 w-12 object-contain flex-shrink-0"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Over/Under */}
                      <div className="text-center">
                        <div className="flex items-center justify-center space-x-1 mb-2">
                          <span className="text-base font-medium text-gray-700">Over/Under</span>
                        </div>
                        <div className={`text-lg font-semibold flex items-center justify-center space-x-1 ${
                          game.ou_result === 1 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          <span>{getOUDisplay(game.ou_result)} {game.ou_vegas_line}</span>
                          {game.ou_result === 1 ? (
                            <ArrowUp className="h-5 w-5 text-green-600" />
                          ) : (
                            <ArrowDown className="h-5 w-5 text-red-600" />
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
