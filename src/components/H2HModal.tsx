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
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <Trophy className="h-6 w-6 text-yellow-500" />
            <h2 className="text-2xl font-bold text-gray-900">
              {homeTeam} vs {awayTeam} - Head to Head
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Summary Statistics */}
        <div className="p-6 bg-gray-50 border-b border-gray-200">
          <div className="grid grid-cols-3 gap-6">
            {/* Wins */}
            <div className="text-center p-4 rounded-lg border-2 bg-gradient-to-br from-blue-500/10 to-purple-500/10 border-gradient-to-r from-blue-500 to-purple-500">
              <h3 className="text-lg font-semibold text-gray-700 mb-4">Wins</h3>
              <div className="flex items-center justify-center space-x-8">
                <div className="flex flex-col items-center">
                  <img 
                    src={getTeamLogo(awayTeam)} 
                    alt={`${awayTeam} logo`}
                    className="h-16 w-16 mb-2"
                  />
                  <span className="text-3xl font-bold text-gray-900">{stats.awayTeamWins}</span>
                </div>
                <div className="flex flex-col items-center">
                  <img 
                    src={getTeamLogo(homeTeam)} 
                    alt={`${homeTeam} logo`}
                    className="h-16 w-16 mb-2"
                  />
                  <span className="text-3xl font-bold text-gray-900">{stats.homeTeamWins}</span>
                </div>
              </div>
            </div>

            {/* Covers */}
            <div className="text-center p-4 rounded-lg border-2 bg-gradient-to-br from-green-500/10 to-emerald-500/10 border-gradient-to-r from-green-500 to-emerald-500">
              <h3 className="text-lg font-semibold text-gray-700 mb-4">Covers</h3>
              <div className="flex items-center justify-center space-x-8">
                <div className="flex flex-col items-center">
                  <img 
                    src={getTeamLogo(awayTeam)} 
                    alt={`${awayTeam} logo`}
                    className="h-16 w-16 mb-2"
                  />
                  <span className="text-3xl font-bold text-gray-900">{stats.awayTeamCovers}</span>
                </div>
                <div className="flex flex-col items-center">
                  <img 
                    src={getTeamLogo(homeTeam)} 
                    alt={`${homeTeam} logo`}
                    className="h-16 w-16 mb-2"
                  />
                  <span className="text-3xl font-bold text-gray-900">{stats.homeTeamCovers}</span>
                </div>
              </div>
            </div>

            {/* Over/Under */}
            <div className="text-center p-4 rounded-lg border-2 bg-gradient-to-br from-orange-500/10 to-red-500/10 border-gradient-to-r from-orange-500 to-red-500">
              <h3 className="text-lg font-semibold text-gray-700 mb-4">Over/Under</h3>
              <div className="flex items-center justify-center space-x-8">
                <div className="flex flex-col items-center">
                  <div className="flex items-center justify-center space-x-2 mb-2 h-16">
                    <ArrowUp className="h-8 w-8 text-green-600" />
                    <span className="text-xl font-semibold text-green-600">Over</span>
                  </div>
                  <span className="text-3xl font-bold text-gray-900">{stats.overs}</span>
                </div>
                <div className="flex flex-col items-center">
                  <div className="flex items-center justify-center space-x-2 mb-2 h-16">
                    <ArrowDown className="h-8 w-8 text-red-600" />
                    <span className="text-xl font-semibold text-red-600">Under</span>
                  </div>
                  <span className="text-3xl font-bold text-gray-900">{stats.unders}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
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
