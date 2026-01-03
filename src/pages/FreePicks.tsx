import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { subDays } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { collegeFootballSupabase } from '@/integrations/supabase/college-football-client';
import { Button } from '@/components/ui/button';
import { Loader2, Gift, Crown, Star, MessageSquare, TrendingUp, Zap, Trophy, ArrowRight, X } from 'lucide-react';
import Dither from '@/components/Dither';
import { EditorPickCard } from '@/components/EditorPickCard';
import debug from '@/utils/debug';

interface EditorPick {
  id: string;
  game_id: string;
  game_type: 'nfl' | 'cfb' | 'nba' | 'ncaab';
  editor_id: string;
  selected_bet_type: 'spread' | 'over_under' | 'moneyline';
  editors_notes: string | null;
  is_published: boolean;
  created_at: string;
  updated_at: string;
  betslip_links?: Record<string, string> | null;
  pick_value?: string | null;
  best_price?: string | null;
  sportsbook?: string | null;
  units?: number | null;
  is_free_pick?: boolean;
  archived_game_data?: any;
  bet_type?: string | null;
  result?: 'won' | 'lost' | 'push' | 'pending' | null;
}

interface GameData {
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
  away_team_colors: { primary: string; secondary: string };
  home_team_colors: { primary: string; secondary: string };
}

// Helper function to get team colors
const getTeamColors = (sport: string, teamName: string): { primary: string; secondary: string } => {
  const defaultColors = { primary: '#374151', secondary: '#6B7280' };
  // Basic color mappings - the actual EditorPickCard component will handle the full mappings
  return defaultColors;
};

// Helper function to check if a pick is within the last week or in the future
const isRecentOrFuturePick = (gameData: GameData | undefined, pick: EditorPick): boolean => {
  const oneWeekAgo = subDays(new Date(), 7);
  oneWeekAgo.setHours(0, 0, 0, 0);

  // Try to get date from game data first
  if (gameData?.raw_game_date) {
    try {
      const gameDate = new Date(gameData.raw_game_date);
      return gameDate >= oneWeekAgo;
    } catch {
      // Fall through to check created_at
    }
  }

  // Fall back to pick's created_at date
  if (pick.created_at) {
    try {
      const createdDate = new Date(pick.created_at);
      return createdDate >= oneWeekAgo;
    } catch {
      return false;
    }
  }

  return false;
};

export default function FreePicks() {
  const navigate = useNavigate();
  const [freePicks, setFreePicks] = useState<EditorPick[]>([]);
  const [gamesData, setGamesData] = useState<Map<string, GameData>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFreePicks();
  }, []);

  const fetchFreePicks = async () => {
    try {
      setLoading(true);

      // Fetch free picks
      const { data: picksData, error: picksError } = await supabase
        .from('editors_picks')
        .select('*')
        .eq('is_published', true)
        .eq('is_free_pick', true)
        .order('created_at', { ascending: false });

      if (picksError) throw picksError;

      console.log('[FreePicks] Fetched picks:', picksData?.length, picksData);

      if (!picksData || picksData.length === 0) {
        setFreePicks([]);
        setLoading(false);
        return;
      }

      setFreePicks(picksData);

      // Fetch game data for each pick
      const gameDataMap = new Map<string, GameData>();

      for (const pick of picksData) {
        console.log('[FreePicks] Processing pick:', pick.id, 'game_type:', pick.game_type, 'game_id:', pick.game_id, 'archived_game_data:', pick.archived_game_data);

        // Check if pick has archived game data first (and it has valid team names)
        // Handle both camelCase and snake_case field names
        const archived = pick.archived_game_data;
        const awayTeam = archived?.awayTeam || archived?.away_team;
        const homeTeam = archived?.homeTeam || archived?.home_team;

        if (archived && awayTeam && homeTeam) {
          const awayLogo = archived.awayLogo || archived.away_logo || '';
          const homeLogo = archived.homeLogo || archived.home_logo || '';
          const gameDate = archived.gameDate || archived.game_date || '';
          const gameTime = archived.gameTime || archived.game_time || '';
          const rawGameDate = archived.rawGameDate || archived.raw_game_date || gameDate;
          const awaySpread = archived.awaySpread ?? archived.away_spread ?? null;
          const homeSpread = archived.homeSpread ?? archived.home_spread ?? null;
          const overLine = archived.overLine ?? archived.over_line ?? archived.total ?? null;
          const awayMl = archived.awayMl ?? archived.away_ml ?? null;
          const homeMl = archived.homeMl ?? archived.home_ml ?? null;
          const openingSpread = archived.openingSpread ?? archived.opening_spread ?? null;

          console.log('[FreePicks] Using archived data for', pick.game_id, ':', awayTeam, 'vs', homeTeam);
          gameDataMap.set(pick.game_id, {
            away_team: awayTeam,
            home_team: homeTeam,
            away_logo: typeof awayLogo === 'string' ? awayLogo : '',
            home_logo: typeof homeLogo === 'string' ? homeLogo : '',
            game_date: gameDate,
            game_time: gameTime,
            raw_game_date: rawGameDate,
            away_spread: awaySpread,
            home_spread: homeSpread,
            over_line: overLine,
            away_ml: awayMl,
            home_ml: homeMl,
            opening_spread: openingSpread,
            home_team_colors: archived.homeTeamColors || archived.home_team_colors || getTeamColors(pick.game_type, homeTeam),
            away_team_colors: archived.awayTeamColors || archived.away_team_colors || getTeamColors(pick.game_type, awayTeam),
          });
          continue;
        }

        // Fetch from database based on game type
        try {
          let gameData: GameData | null = null;

          if (pick.game_type === 'nfl') {
            const { data } = await supabase
              .from('nfl_predictions')
              .select('*')
              .eq('game_id', pick.game_id)
              .single();

            if (data) {
              gameData = {
                away_team: data.away_team,
                home_team: data.home_team,
                away_logo: data.away_logo || '',
                home_logo: data.home_logo || '',
                game_date: data.game_date || '',
                game_time: data.game_time || '',
                raw_game_date: data.game_date || '',
                away_spread: data.away_spread ?? null,
                home_spread: data.home_spread ?? null,
                over_line: data.over_line ?? null,
                away_ml: data.away_ml ?? null,
                home_ml: data.home_ml ?? null,
                opening_spread: data.opening_spread ?? null,
                home_team_colors: { primary: '#374151', secondary: '#6B7280' },
                away_team_colors: { primary: '#374151', secondary: '#6B7280' },
              };
            }
          } else if (pick.game_type === 'cfb') {
            const { data } = await collegeFootballSupabase
              .from('cfb_predictions')
              .select('*')
              .eq('game_id', pick.game_id)
              .single();

            if (data) {
              gameData = {
                away_team: data.away_team,
                home_team: data.home_team,
                away_logo: data.away_logo || '',
                home_logo: data.home_logo || '',
                game_date: data.game_date || '',
                game_time: data.game_time || '',
                raw_game_date: data.game_date || '',
                away_spread: data.away_spread ?? null,
                home_spread: data.home_spread ?? null,
                over_line: data.over_line ?? null,
                away_ml: data.away_ml ?? null,
                home_ml: data.home_ml ?? null,
                opening_spread: data.opening_spread ?? null,
                home_team_colors: { primary: '#374151', secondary: '#6B7280' },
                away_team_colors: { primary: '#374151', secondary: '#6B7280' },
              };
            }
          } else if (pick.game_type === 'nba') {
            const { data } = await collegeFootballSupabase
              .from('nba_games')
              .select('*')
              .eq('game_id', pick.game_id)
              .single();

            if (data) {
              gameData = {
                away_team: data.away_team,
                home_team: data.home_team,
                away_logo: '',
                home_logo: '',
                game_date: data.game_date || '',
                game_time: data.game_time || '',
                raw_game_date: data.game_date || '',
                away_spread: data.away_spread ?? null,
                home_spread: data.home_spread ?? null,
                over_line: data.total ?? null,
                away_ml: data.away_ml ?? null,
                home_ml: data.home_ml ?? null,
                opening_spread: null,
                home_team_colors: { primary: '#374151', secondary: '#6B7280' },
                away_team_colors: { primary: '#374151', secondary: '#6B7280' },
              };
            }
          } else if (pick.game_type === 'ncaab') {
            const { data } = await collegeFootballSupabase
              .from('ncaab_games')
              .select('*')
              .eq('game_id', pick.game_id)
              .single();

            if (data) {
              gameData = {
                away_team: data.away_team,
                home_team: data.home_team,
                away_logo: '',
                home_logo: '',
                game_date: data.game_date || '',
                game_time: data.game_time || '',
                raw_game_date: data.game_date || '',
                away_spread: data.away_spread ?? null,
                home_spread: data.home_spread ?? null,
                over_line: data.total ?? null,
                away_ml: data.away_ml ?? null,
                home_ml: data.home_ml ?? null,
                opening_spread: null,
                home_team_colors: { primary: '#374151', secondary: '#6B7280' },
                away_team_colors: { primary: '#374151', secondary: '#6B7280' },
              };
            }
          }

          if (gameData) {
            console.log('[FreePicks] Found game data for', pick.game_id, ':', gameData.away_team, 'vs', gameData.home_team);
            gameDataMap.set(pick.game_id, gameData);
          } else {
            console.log('[FreePicks] No game data found for', pick.game_id, 'game_type:', pick.game_type);
          }
        } catch (err) {
          console.error('[FreePicks] Error fetching game data for', pick.game_id, ':', err);
        }
      }

      console.log('[FreePicks] Final gameDataMap size:', gameDataMap.size);
      setGamesData(gameDataMap);
    } catch (error) {
      debug.error('Error fetching free picks:', error);
    } finally {
      setLoading(false);
    }
  };

  const features = [
    { icon: Star, text: 'All Editor Picks' },
    { icon: MessageSquare, text: 'AI-Powered WagerBot' },
    { icon: TrendingUp, text: 'Advanced Analytics' },
    { icon: Zap, text: 'Fade Alerts & Outliers' },
    { icon: Trophy, text: 'Live Scores' },
    { icon: MessageSquare, text: 'Discord Community' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm overflow-auto">
      {/* Dither Background Effect */}
      <div className="absolute inset-0 overflow-hidden">
        <Dither
          waveSpeed={0.05}
          waveFrequency={3}
          waveAmplitude={0.3}
          waveColor={[0.13, 0.77, 0.37]}
          colorNum={4}
          pixelSize={2}
          disableAnimation={false}
          enableMouseInteraction={false}
          mouseRadius={0}
        />
      </div>

      {/* Main Container */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="relative z-10 w-full max-w-4xl mx-4 my-8 bg-black/40 backdrop-blur-3xl border border-white/20 rounded-3xl shadow-2xl overflow-hidden"
        style={{
          background: 'rgba(0, 0, 0, 0.4)',
          backdropFilter: 'blur(40px)',
          WebkitBackdropFilter: 'blur(40px)',
        }}
      >
        {/* Close Button */}
        <div className="absolute top-4 right-4 z-20">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/')}
            className="text-white/70 hover:text-white hover:bg-white/10 rounded-full"
          >
            <X className="h-6 w-6" />
          </Button>
        </div>

        {/* Scrollable Content */}
        <div className="max-h-[90vh] overflow-y-auto p-6 sm:p-8 md:p-10">
          {/* Hero Section */}
          <motion.div
            className="text-center mb-10"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <div className="inline-flex items-center gap-2 bg-green-500/20 border border-green-500/30 px-4 py-2 rounded-full mb-6">
              <Gift className="h-4 w-4 text-green-400" />
              <span className="text-green-400 text-sm font-semibold tracking-wide">FREE</span>
            </div>

            <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-white mb-4">
              Free Picks
            </h1>
            <p className="text-lg text-white/70 max-w-xl mx-auto">
              Get access to complimentary picks from our expert editors
            </p>
          </motion.div>

          {/* Picks Section */}
          <motion.div
            className="mb-10"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            {loading ? (
              <div className="flex flex-col items-center justify-center py-16">
                <Loader2 className="h-10 w-10 animate-spin text-green-500 mb-4" />
                <p className="text-white/70">Loading free picks...</p>
              </div>
            ) : freePicks.length === 0 || !freePicks.some(pick => {
              const gameData = gamesData.get(pick.game_id);
              const hasValidGameData = gameData && gameData.away_team && gameData.away_team !== 'Away' && gameData.home_team && gameData.home_team !== 'Home';
              const isRecent = isRecentOrFuturePick(gameData, pick);
              return hasValidGameData && isRecent;
            }) ? (
              <div className="flex flex-col items-center justify-center py-8 px-4">
                {/* Show CTA section directly when no picks */}
              </div>
            ) : (
              <div className="grid gap-4 md:gap-6">
                {freePicks.map((pick) => {
                  const gameData = gamesData.get(pick.game_id);
                  // Skip picks without valid game data (missing team names means data is incomplete)
                  if (!gameData || !gameData.away_team || gameData.away_team === 'Away' || !gameData.home_team || gameData.home_team === 'Home') {
                    return null;
                  }
                  // Skip picks older than one week
                  if (!isRecentOrFuturePick(gameData, pick)) {
                    return null;
                  }

                  return (
                    <div key={pick.id} className="transform transition-all hover:scale-[1.01]">
                      <EditorPickCard
                        pick={pick}
                        gameData={gameData}
                        onRefresh={fetchFreePicks}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>

          {/* CTA Section */}
          <motion.div
            className="mb-10"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <div className="bg-gradient-to-br from-green-500/20 to-green-600/10 border border-green-500/30 rounded-2xl p-8 text-center">
              <Crown className="h-12 w-12 text-yellow-400 mx-auto mb-4" />
              <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">
                Enter WagerProof to See Our Free Picks
              </h2>
              <p className="text-white/70 max-w-lg mx-auto mb-6 leading-relaxed">
                Access dozens of picks, powerful betting tools, and in-depth data for every game across NFL, NBA, CFB, and NCAAB. Plus, join our Discord community of data-driven bettors.
              </p>
              <Button
                onClick={() => navigate('/welcome')}
                className="bg-green-500 hover:bg-green-600 text-black font-semibold px-8 py-6 text-lg rounded-xl"
              >
                Enter WagerProof
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </div>
          </motion.div>

          {/* Features Preview */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
          >
            <h3 className="text-lg font-semibold text-white text-center mb-6">
              What You Get With Pro
            </h3>
            <div className="flex flex-wrap justify-center gap-3">
              {features.map((feature, index) => (
                <div
                  key={index}
                  className="flex items-center gap-2 bg-white/5 border border-white/10 px-4 py-2.5 rounded-full"
                >
                  <feature.icon className="h-4 w-4 text-green-400" />
                  <span className="text-white/90 text-sm font-medium">{feature.text}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}
