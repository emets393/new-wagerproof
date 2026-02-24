import debug from '@/utils/debug';
import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence, useAnimation, useReducedMotion } from 'framer-motion';
import { collegeFootballSupabase } from '@/integrations/supabase/college-football-client';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Shield, Trophy, School, Star, Bot, Home, Newspaper, Activity, Users, MessageSquare, Smartphone, FileImage, Share2, GraduationCap, User } from 'lucide-react';
import { Basketball, DiscordLogo } from 'phosphor-react';
import CFBMiniCard from './CFBMiniCard';
import { LiveScoreTicker } from '@/components/LiveScoreTicker';
import { getNBATeamColors } from '@/utils/teamColors';

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

interface TeamMapping {
  api: string;
  logo_light: string;
}

const DUMMY_GAMES: GamePrediction[] = [
  {
    id: 'dummy-1',
    away_team: 'Los Angeles Lakers',
    home_team: 'Boston Celtics',
    home_ml: -150, away_ml: 130,
    home_spread: -3.5, away_spread: 3.5,
    total_line: 224.5,
    game_time: '7:30 PM EST',
    pred_ml_proba: 0.62, pred_spread_proba: 0.58, pred_total_proba: 0.55,
    home_spread_diff: 1.2, over_line_diff: -2.5,
  },
  {
    id: 'dummy-2',
    away_team: 'Golden State Warriors',
    home_team: 'Phoenix Suns',
    home_ml: -120, away_ml: 100,
    home_spread: -2.0, away_spread: 2.0,
    total_line: 231.0,
    game_time: '9:00 PM EST',
    pred_ml_proba: 0.54, pred_spread_proba: 0.52, pred_total_proba: 0.48,
    home_spread_diff: -0.5, over_line_diff: 3.0,
  },
  {
    id: 'dummy-3',
    away_team: 'Miami Heat',
    home_team: 'Milwaukee Bucks',
    home_ml: -180, away_ml: 155,
    home_spread: -4.5, away_spread: 4.5,
    total_line: 218.5,
    game_time: '7:00 PM EST',
    pred_ml_proba: 0.68, pred_spread_proba: 0.61, pred_total_proba: 0.52,
    home_spread_diff: 2.0, over_line_diff: -1.5,
  },
  {
    id: 'dummy-4',
    away_team: 'Denver Nuggets',
    home_team: 'Dallas Mavericks',
    home_ml: 110, away_ml: -130,
    home_spread: 1.5, away_spread: -1.5,
    total_line: 226.0,
    game_time: '8:30 PM EST',
    pred_ml_proba: 0.45, pred_spread_proba: 0.47, pred_total_proba: 0.56,
    home_spread_diff: -1.0, over_line_diff: 4.5,
  },
];

// ─── Agents Panel ───────────────────────────────────────────────────

const DEMO_AGENTS = [
  { emoji: '🎯', name: 'SharpShooter', sport: 'NBA', color: '#22c55e', trait: 'Value Hunter', target: 87 },
  { emoji: '🧠', name: 'DeepModel', sport: 'NFL', color: '#8b5cf6', trait: 'ML Specialist', target: 94 },
  { emoji: '📊', name: 'StatBot', sport: 'NCAAF', color: '#3b82f6', trait: 'Data Analyst', target: 72 },
];

const ANALYSIS_LINES = [
  'Scanning 847 data points across 12 NBA games...',
  'SharpShooter: Value detected on BOS -3.5 (68% conf)',
  'DeepModel: Cross-referencing injury reports...',
  'StatBot: Historical matchup analysis complete',
  'Consensus: 3/3 agents agree on BOS spread',
  'Generating pick with 72% model confidence...',
];

function AgentsPanel() {
  const shouldReduce = useReducedMotion();
  const [visibleLines, setVisibleLines] = useState(0);
  const [agentProgress, setAgentProgress] = useState([8, 5, 12]);
  const [confidence, setConfidence] = useState(0);

  useEffect(() => {
    if (shouldReduce) {
      setVisibleLines(ANALYSIS_LINES.length);
      setAgentProgress(DEMO_AGENTS.map(a => a.target));
      setConfidence(78);
      return;
    }

    const lineTimer = setInterval(() => {
      setVisibleLines(prev => {
        if (prev >= ANALYSIS_LINES.length) { clearInterval(lineTimer); return prev; }
        return prev + 1;
      });
    }, 800);

    const progressTimer = setInterval(() => {
      setAgentProgress(prev =>
        prev.map((p, i) => Math.min(p + Math.random() * 10 + 4, DEMO_AGENTS[i].target))
      );
    }, 350);

    let confInterval: ReturnType<typeof setInterval>;
    const confDelay = setTimeout(() => {
      confInterval = setInterval(() => {
        setConfidence(prev => {
          if (prev >= 78) { clearInterval(confInterval); return 78; }
          return prev + 3;
        });
      }, 40);
    }, 1800);

    return () => {
      clearInterval(lineTimer);
      clearInterval(progressTimer);
      clearTimeout(confDelay);
      if (confInterval) clearInterval(confInterval);
    };
  }, [shouldReduce]);

  return (
    <div className="p-3 md:p-5 space-y-3 h-full overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bot className="w-4 h-4 text-violet-500" />
          <span className="text-xs md:text-sm font-semibold text-gray-800 dark:text-gray-200">Agent Network</span>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] md:text-xs text-emerald-600 dark:text-emerald-400 font-medium">
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative rounded-full h-1.5 w-1.5 bg-emerald-500" />
          </span>
          3 Active
        </div>
      </div>

      {/* Agent Cards */}
      <div className="grid grid-cols-3 gap-1.5 md:gap-3">
        {DEMO_AGENTS.map((agent, i) => (
          <motion.div
            key={agent.name}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.12, duration: 0.35 }}
            className="bg-white/60 dark:bg-white/[0.04] backdrop-blur-sm rounded-lg p-1.5 md:p-3 border border-gray-200/40 dark:border-white/[0.06]"
          >
            <div className="text-center space-y-1 md:space-y-1.5">
              <div className="text-lg md:text-2xl">{agent.emoji}</div>
              <div className="text-[9px] md:text-xs font-bold text-gray-800 dark:text-white leading-tight">{agent.name}</div>
              <div
                className="inline-block px-1 md:px-1.5 py-0.5 rounded text-[7px] md:text-[9px] font-mono font-bold text-white"
                style={{ backgroundColor: agent.color }}
              >
                {agent.sport}
              </div>
              <div className="text-[7px] md:text-[10px] text-gray-500 dark:text-gray-400 hidden md:block">{agent.trait}</div>
              <div className="h-1 md:h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <motion.div
                  className="h-full rounded-full"
                  style={{ backgroundColor: agent.color }}
                  initial={{ width: '0%' }}
                  animate={{ width: `${agentProgress[i]}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
              <div className="text-[7px] md:text-[9px] font-mono text-gray-400 tabular-nums">{Math.round(agentProgress[i])}%</div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Terminal */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="bg-gray-900 dark:bg-black/80 rounded-lg p-2 md:p-3 border border-gray-700/50 font-mono"
      >
        <div className="flex items-center gap-2 mb-1.5 pb-1 border-b border-gray-700/50">
          <div className="flex gap-1">
            <div className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-red-500/80" />
            <div className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-yellow-500/80" />
            <div className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-green-500/80" />
          </div>
          <span className="text-gray-500 text-[8px] md:text-[9px]">agent-analysis</span>
        </div>
        <div className="space-y-0.5 md:space-y-1">
          <div className="text-gray-500 text-[8px] md:text-[10px]">$ agent-analysis --mode=consensus</div>
          {ANALYSIS_LINES.slice(0, visibleLines).map((line, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -4 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.2 }}
              className="text-emerald-400 text-[8px] md:text-[10px] leading-relaxed"
            >
              <span className="text-gray-500">{'>'} </span>{line}
            </motion.div>
          ))}
          {visibleLines < ANALYSIS_LINES.length && (
            <span className="inline-block w-1 h-2.5 md:w-1.5 md:h-3 bg-emerald-400 animate-pulse" />
          )}
        </div>
      </motion.div>

      {/* Confidence Bar */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
        className="bg-white/60 dark:bg-white/[0.04] backdrop-blur-sm rounded-lg p-2 md:p-3 border border-gray-200/40 dark:border-white/[0.06]"
      >
        <div className="flex items-center justify-between mb-1">
          <span className="text-[9px] md:text-xs font-medium text-gray-600 dark:text-gray-400">Pick Confidence</span>
          <span className="text-[9px] md:text-xs font-bold text-emerald-600 dark:text-emerald-400 font-mono tabular-nums">{confidence}%</span>
        </div>
        <div className="h-1.5 md:h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400"
            initial={{ width: '0%' }}
            animate={{ width: `${confidence}%` }}
            transition={{ duration: 0.4 }}
          />
        </div>
        <div className="flex items-center justify-between mt-1">
          <span className="text-[8px] md:text-[10px] text-gray-500">Agent Agreement</span>
          <span className="text-[8px] md:text-[10px] font-mono font-bold text-emerald-500">{confidence > 50 ? '3/3' : confidence > 20 ? '2/3' : '1/3'}</span>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────

export default function CFBPreview() {
  const [predictions, setPredictions] = useState<GamePrediction[]>([]);
  const [teamMappings, setTeamMappings] = useState<TeamMapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sportType, setSportType] = useState<SportType>('nba');

  // Demo sequence state
  const [activeView, setActiveView] = useState<'games' | 'agents'>('games');
  const [focusedCard, setFocusedCard] = useState<number | null>(null);
  const [showCursor, setShowCursor] = useState(false);
  const [isClicking, setIsClicking] = useState(false);
  const [highlightedSidebar, setHighlightedSidebar] = useState<string | null>(null);
  const cursorControls = useAnimation();
  const shouldReduce = useReducedMotion();

  // ─── Team Helpers (unchanged) ───

  const getCFBTeamColors = (teamName: string): { primary: string; secondary: string } => {
    const colorMap: { [key: string]: { primary: string; secondary: string } } = {
      'Alabama': { primary: '#9E1B32', secondary: '#FFFFFF' },
      'Auburn': { primary: '#0C2340', secondary: '#E87722' },
      'Georgia': { primary: '#BA0C2F', secondary: '#000000' },
      'Florida': { primary: '#0021A5', secondary: '#FA4616' },
      'LSU': { primary: '#461D7C', secondary: '#FDD023' },
      'Texas A&M': { primary: '#500000', secondary: '#FFFFFF' },
      'Ole Miss': { primary: '#CE1126', secondary: '#14213D' },
      'Mississippi State': { primary: '#5D1725', secondary: '#FFFFFF' },
      'Arkansas': { primary: '#9D2235', secondary: '#FFFFFF' },
      'Kentucky': { primary: '#0033A0', secondary: '#FFFFFF' },
      'Tennessee': { primary: '#FF8200', secondary: '#FFFFFF' },
      'South Carolina': { primary: '#73000A', secondary: '#000000' },
      'Missouri': { primary: '#F1B82D', secondary: '#000000' },
      'Vanderbilt': { primary: '#866D4B', secondary: '#000000' },
      'Ohio State': { primary: '#BB0000', secondary: '#666666' },
      'Michigan': { primary: '#00274C', secondary: '#FFCB05' },
      'Penn State': { primary: '#041E42', secondary: '#FFFFFF' },
      'Michigan State': { primary: '#18453B', secondary: '#FFFFFF' },
      'Wisconsin': { primary: '#C5050C', secondary: '#FFFFFF' },
      'Iowa': { primary: '#FFCD00', secondary: '#000000' },
      'Minnesota': { primary: '#7A0019', secondary: '#FFCC33' },
      'Nebraska': { primary: '#E41C38', secondary: '#FFFFFF' },
      'Illinois': { primary: '#13294B', secondary: '#E84A27' },
      'Northwestern': { primary: '#4E2A84', secondary: '#FFFFFF' },
      'Purdue': { primary: '#000000', secondary: '#CFB991' },
      'Indiana': { primary: '#990000', secondary: '#FFFFFF' },
      'Rutgers': { primary: '#CC0033', secondary: '#FFFFFF' },
      'Maryland': { primary: '#E03A3E', secondary: '#FFD520' },
      'Oklahoma': { primary: '#841617', secondary: '#FDF9D8' },
      'Texas': { primary: '#BF5700', secondary: '#FFFFFF' },
      'Oklahoma State': { primary: '#FF6600', secondary: '#000000' },
      'Baylor': { primary: '#003015', secondary: '#FFB81C' },
      'TCU': { primary: '#4D1979', secondary: '#A3A9AC' },
      'Texas Tech': { primary: '#CC0000', secondary: '#000000' },
      'Kansas State': { primary: '#512888', secondary: '#FFFFFF' },
      'Iowa State': { primary: '#C8102E', secondary: '#F1BE48' },
      'Kansas': { primary: '#0051BA', secondary: '#E8000D' },
      'West Virginia': { primary: '#002855', secondary: '#EAAA00' },
      'BYU': { primary: '#002E5D', secondary: '#FFFFFF' },
      'Cincinnati': { primary: '#E00122', secondary: '#000000' },
      'UCF': { primary: '#BA9B37', secondary: '#000000' },
      'Houston': { primary: '#C8102E', secondary: '#FFFFFF' },
      'Clemson': { primary: '#F56600', secondary: '#522D80' },
      'Florida State': { primary: '#782F40', secondary: '#CEB888' },
      'Miami': { primary: '#F47321', secondary: '#005030' },
      'North Carolina': { primary: '#7BAFD4', secondary: '#13294B' },
      'NC State': { primary: '#CC0000', secondary: '#FFFFFF' },
      'Virginia Tech': { primary: '#630031', secondary: '#CF4420' },
      'Virginia': { primary: '#232D4B', secondary: '#E57200' },
      'Duke': { primary: '#003087', secondary: '#FFFFFF' },
      'Wake Forest': { primary: '#9E7E38', secondary: '#000000' },
      'Georgia Tech': { primary: '#B3A369', secondary: '#003057' },
      'Boston College': { primary: '#98002E', secondary: '#FFB81C' },
      'Pitt': { primary: '#003594', secondary: '#FFB81C' },
      'Syracuse': { primary: '#F76900', secondary: '#000E54' },
      'Louisville': { primary: '#AD0000', secondary: '#000000' },
      'USC': { primary: '#990000', secondary: '#FFCC00' },
      'UCLA': { primary: '#2D68C4', secondary: '#FFD100' },
      'Oregon': { primary: '#007030', secondary: '#FEE123' },
      'Washington': { primary: '#4B2E83', secondary: '#B7A57A' },
      'Utah': { primary: '#CC0000', secondary: '#FFFFFF' },
      'Arizona State': { primary: '#8C1D40', secondary: '#FFC627' },
      'Arizona': { primary: '#003366', secondary: '#CC0033' },
      'Colorado': { primary: '#000000', secondary: '#CFB87C' },
      'Stanford': { primary: '#8C1515', secondary: '#FFFFFF' },
      'California': { primary: '#003262', secondary: '#FDB515' },
      'Oregon State': { primary: '#DC4405', secondary: '#000000' },
      'Washington State': { primary: '#981E32', secondary: '#5E6A71' },
      'Notre Dame': { primary: '#0C2340', secondary: '#C99700' },
      'Army': { primary: '#000000', secondary: '#D4AF37' },
      'Navy': { primary: '#000080', secondary: '#C5B783' },
      'Boise State': { primary: '#0033A0', secondary: '#D64309' },
      'Memphis': { primary: '#003087', secondary: '#808285' },
      'SMU': { primary: '#CC0033', secondary: '#0033A0' },
      'Tulane': { primary: '#006747', secondary: '#418FDE' },
    };
    return colorMap[teamName] || { primary: '#6B7280', secondary: '#9CA3AF' };
  };

  const getTeamLogo = (teamName: string): string => {
    if (sportType === 'cfb') {
      const mapping = teamMappings.find(m => m.api === teamName);
      return mapping?.logo_light || '';
    }
    if (sportType === 'nba' || sportType === 'dummy') {
      const espnLogoMap: { [key: string]: string } = {
        'Atlanta Hawks': 'https://a.espncdn.com/i/teamlogos/nba/500/atl.png',
        'Boston Celtics': 'https://a.espncdn.com/i/teamlogos/nba/500/bos.png',
        'Brooklyn Nets': 'https://a.espncdn.com/i/teamlogos/nba/500/bkn.png',
        'Charlotte Hornets': 'https://a.espncdn.com/i/teamlogos/nba/500/cha.png',
        'Chicago Bulls': 'https://a.espncdn.com/i/teamlogos/nba/500/chi.png',
        'Cleveland Cavaliers': 'https://a.espncdn.com/i/teamlogos/nba/500/cle.png',
        'Dallas Mavericks': 'https://a.espncdn.com/i/teamlogos/nba/500/dal.png',
        'Denver Nuggets': 'https://a.espncdn.com/i/teamlogos/nba/500/den.png',
        'Detroit Pistons': 'https://a.espncdn.com/i/teamlogos/nba/500/det.png',
        'Golden State Warriors': 'https://a.espncdn.com/i/teamlogos/nba/500/gs.png',
        'Houston Rockets': 'https://a.espncdn.com/i/teamlogos/nba/500/hou.png',
        'Indiana Pacers': 'https://a.espncdn.com/i/teamlogos/nba/500/ind.png',
        'LA Clippers': 'https://a.espncdn.com/i/teamlogos/nba/500/lac.png',
        'Los Angeles Clippers': 'https://a.espncdn.com/i/teamlogos/nba/500/lac.png',
        'Los Angeles Lakers': 'https://a.espncdn.com/i/teamlogos/nba/500/lal.png',
        'Memphis Grizzlies': 'https://a.espncdn.com/i/teamlogos/nba/500/mem.png',
        'Miami Heat': 'https://a.espncdn.com/i/teamlogos/nba/500/mia.png',
        'Milwaukee Bucks': 'https://a.espncdn.com/i/teamlogos/nba/500/mil.png',
        'Minnesota Timberwolves': 'https://a.espncdn.com/i/teamlogos/nba/500/min.png',
        'New Orleans Pelicans': 'https://a.espncdn.com/i/teamlogos/nba/500/no.png',
        'New York Knicks': 'https://a.espncdn.com/i/teamlogos/nba/500/ny.png',
        'Oklahoma City Thunder': 'https://a.espncdn.com/i/teamlogos/nba/500/okc.png',
        'Orlando Magic': 'https://a.espncdn.com/i/teamlogos/nba/500/orl.png',
        'Philadelphia 76ers': 'https://a.espncdn.com/i/teamlogos/nba/500/phi.png',
        'Phoenix Suns': 'https://a.espncdn.com/i/teamlogos/nba/500/phx.png',
        'Portland Trail Blazers': 'https://a.espncdn.com/i/teamlogos/nba/500/por.png',
        'Sacramento Kings': 'https://a.espncdn.com/i/teamlogos/nba/500/sac.png',
        'San Antonio Spurs': 'https://a.espncdn.com/i/teamlogos/nba/500/sa.png',
        'Toronto Raptors': 'https://a.espncdn.com/i/teamlogos/nba/500/tor.png',
        'Utah Jazz': 'https://a.espncdn.com/i/teamlogos/nba/500/utah.png',
        'Washington Wizards': 'https://a.espncdn.com/i/teamlogos/nba/500/wsh.png',
      };
      return espnLogoMap[teamName] || '';
    }
    return '';
  };

  const getTeamColors = (teamName: string): { primary: string; secondary: string } => {
    if (sportType === 'cfb') return getCFBTeamColors(teamName);
    return getNBATeamColors(teamName);
  };

  // ─── Data Fetching ───

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const today = new Date().toISOString().split('T')[0];

      const { data: nbaGames } = await collegeFootballSupabase
        .from('nba_input_values_view')
        .select('*')
        .gte('game_date', today)
        .order('game_date', { ascending: true })
        .order('tipoff_time_et', { ascending: true })
        .limit(4);

      if (nbaGames && nbaGames.length > 0) {
        debug.log('Using NBA games for landing page hero');
        const transformedNbaGames: GamePrediction[] = nbaGames.map((game: any) => ({
          id: String(game.game_id),
          away_team: game.away_team,
          home_team: game.home_team,
          home_ml: game.home_moneyline,
          away_ml: game.home_moneyline ? (game.home_moneyline > 0 ? -(game.home_moneyline + 100) : 100 - game.home_moneyline) : null,
          home_spread: game.home_spread,
          away_spread: game.home_spread ? -game.home_spread : null,
          total_line: game.total_line,
          game_time: game.tipoff_time_et,
          game_date: game.game_date,
          pred_ml_proba: 0.55,
          pred_spread_proba: 0.52,
          pred_total_proba: 0.50,
          home_spread_diff: null,
          over_line_diff: null,
        }));
        setPredictions(transformedNbaGames);
        setSportType('nba');
        return;
      }

      debug.log('No NBA games found, trying CFB...');
      const { data: cfbMappings } = await collegeFootballSupabase
        .from('cfb_team_mapping')
        .select('api, logo_light');
      setTeamMappings(cfbMappings || []);

      const { data: cfbPreds } = await collegeFootballSupabase
        .from('cfb_live_weekly_inputs')
        .select('*')
        .limit(4);

      if (cfbPreds && cfbPreds.length > 0) {
        debug.log('Using CFB games for landing page hero');
        setPredictions(cfbPreds);
        setSportType('cfb');
        return;
      }

      debug.log('No live games found, using dummy data');
      setPredictions(DUMMY_GAMES);
      setSportType('dummy');
    } catch (err) {
      debug.error('Error fetching data:', err);
      setPredictions(DUMMY_GAMES);
      setSportType('dummy');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  // ─── Sidebar Items (dynamic active state) ───

  const sidebarItems: Array<{
    icon: React.ComponentType<{ className?: string }> | typeof DiscordLogo | null;
    label: string;
    active: boolean;
    isHeader: boolean;
  }> = useMemo(() => [
    { icon: Home, label: 'Home', active: false, isHeader: false },
    { icon: null, label: 'ANALYSIS', active: false, isHeader: true },
    { icon: Newspaper, label: 'Today in Sports', active: false, isHeader: false },
    { icon: Star, label: "Editors Picks", active: false, isHeader: false },
    { icon: Bot, label: 'WagerBot Chat', active: activeView === 'agents', isHeader: false },
    { icon: Activity, label: 'Score Board', active: false, isHeader: false },
    { icon: null, label: 'SPORTS', active: false, isHeader: true },
    { icon: Trophy, label: 'College Football', active: activeView === 'games' && sportType === 'cfb', isHeader: false },
    { icon: Shield, label: 'NFL', active: false, isHeader: false },
    { icon: Basketball, label: 'NBA', active: activeView === 'games' && (sportType === 'nba' || sportType === 'dummy'), isHeader: false },
    { icon: School, label: 'College Basketball', active: false, isHeader: false },
    { icon: null, label: 'COMMUNITY', active: false, isHeader: true },
    { icon: Users, label: 'Community Picks', active: false, isHeader: false },
    { icon: MessageSquare, label: 'Feature Requests', active: false, isHeader: false },
    { icon: DiscordLogo, label: 'Discord Channel', active: false, isHeader: false },
    { icon: Smartphone, label: 'iOS/Android App', active: false, isHeader: false },
    { icon: FileImage, label: 'Bet Slip Grader', active: false, isHeader: false },
    { icon: Share2, label: 'Share Win', active: false, isHeader: false },
    { icon: GraduationCap, label: 'Learn WagerProof', active: false, isHeader: false },
    { icon: User, label: 'Account', active: false, isHeader: false },
  ], [activeView, sportType]);

  // ─── Demo Sequence ───

  useEffect(() => {
    if (loading || shouldReduce) return;

    let cancelled = false;
    const delay = (ms: number) => new Promise<void>(resolve => { setTimeout(resolve, ms); });
    const ease: [number, number, number, number] = [0.22, 1, 0.36, 1];

    const clickAnim = async () => {
      setIsClicking(true);
      await delay(140);
      if (!cancelled) setIsClicking(false);
    };

    const runSequence = async () => {
      await delay(3000);
      if (cancelled) return;
      setShowCursor(true);
      await cursorControls.start({ opacity: 1, left: '50%', top: '30%', transition: { duration: 0.4 } });
      if (cancelled) return;

      // eslint-disable-next-line no-constant-condition
      while (true) {
        // ── Click card 0 ──
        await cursorControls.start({ left: '38%', top: '36%', transition: { duration: 1.2, ease } });
        if (cancelled) return;
        await clickAnim();
        if (cancelled) return;
        setFocusedCard(0);
        await delay(3500);
        if (cancelled) return;
        setFocusedCard(null);

        // ── Navigate to Agents (WagerBot Chat) ──
        await cursorControls.start({ left: '10%', top: '38%', transition: { duration: 1, ease } });
        if (cancelled) return;
        setHighlightedSidebar('WagerBot Chat');
        await clickAnim();
        if (cancelled) return;
        await delay(250);
        if (cancelled) return;
        setActiveView('agents');
        setHighlightedSidebar(null);
        await delay(6000);
        if (cancelled) return;

        // ── Navigate back to Games (NBA) ──
        await cursorControls.start({ left: '10%', top: '58%', transition: { duration: 0.9, ease } });
        if (cancelled) return;
        setHighlightedSidebar('NBA');
        await clickAnim();
        if (cancelled) return;
        await delay(250);
        if (cancelled) return;
        setActiveView('games');
        setHighlightedSidebar(null);
        await delay(1500);
        if (cancelled) return;

        // ── Click card 2 ──
        await cursorControls.start({ left: '38%', top: '68%', transition: { duration: 1.1, ease } });
        if (cancelled) return;
        await clickAnim();
        if (cancelled) return;
        setFocusedCard(2);
        await delay(3500);
        if (cancelled) return;
        setFocusedCard(null);

        // ── Navigate to Agents again ──
        await cursorControls.start({ left: '10%', top: '38%', transition: { duration: 1, ease } });
        if (cancelled) return;
        setHighlightedSidebar('WagerBot Chat');
        await clickAnim();
        if (cancelled) return;
        await delay(250);
        if (cancelled) return;
        setActiveView('agents');
        setHighlightedSidebar(null);
        await delay(6000);
        if (cancelled) return;

        // ── Back to Games ──
        await cursorControls.start({ left: '10%', top: '58%', transition: { duration: 0.9, ease } });
        if (cancelled) return;
        setHighlightedSidebar('NBA');
        await clickAnim();
        if (cancelled) return;
        await delay(250);
        if (cancelled) return;
        setActiveView('games');
        setHighlightedSidebar(null);
        await delay(1500);
        if (cancelled) return;

        // ── Click card 1 ──
        await cursorControls.start({ left: '70%', top: '36%', transition: { duration: 1.2, ease } });
        if (cancelled) return;
        await clickAnim();
        if (cancelled) return;
        setFocusedCard(1);
        await delay(3500);
        if (cancelled) return;
        setFocusedCard(null);
        await delay(800);
        if (cancelled) return;
      }
    };

    runSequence().catch(() => {});
    return () => { cancelled = true; };
  }, [loading, shouldReduce, cursorControls]);

  // ─── Loading State ───

  if (loading) {
    return (
      <div className="w-full max-w-7xl mx-auto mt-8">
        <div className="relative rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 shadow-2xl bg-gradient-to-br from-gray-50 to-white dark:from-gray-900 dark:to-gray-800">
          <div className="bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Skeleton className="w-8 h-8 rounded" />
              <Skeleton className="h-6 w-32" />
            </div>
            <Skeleton className="h-6 w-20" />
          </div>
          <div className="flex">
            <div className="w-16 md:w-64 bg-gray-50 dark:bg-gray-800/50 border-r border-gray-200 dark:border-gray-700 p-2 md:p-4">
              <Skeleton className="h-4 w-20 mb-3 hidden md:block" />
              <div className="space-y-2">
                {[...Array(8)].map((_, i) => (
                  <Skeleton key={i} className="h-8 w-full rounded-lg" />
                ))}
              </div>
            </div>
            <div className="flex-1 p-3 md:p-6 grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-32 w-full rounded-lg" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── Error State ───

  if (error) {
    return (
      <div className="w-full max-w-7xl mx-auto mt-8">
        <div className="relative rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 shadow-2xl bg-gradient-to-br from-gray-50 to-white dark:from-gray-900 dark:to-gray-800">
          <div className="bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <img src="/wagerproofGreenLight.png" alt="WagerProof" className="w-8 h-8 object-contain rounded-lg dark:hidden" />
              <img src="/wagerproofGreenDark.png" alt="WagerProof" className="w-8 h-8 object-contain rounded-lg hidden dark:block" />
              <span className="font-semibold text-gray-900 dark:text-gray-100">wagerproof.bet</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1 rounded bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-sm font-medium">
              <AlertCircle className="w-4 h-4" />
              Error
            </div>
          </div>
          <div className="flex-1 p-6">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>Unable to load live game data. Please try again later.</AlertDescription>
            </Alert>
          </div>
        </div>
      </div>
    );
  }

  // ─── Main Render ───

  return (
    <div className="w-full max-w-7xl mx-auto mt-4 md:mt-8 mb-4 md:mb-0 animate-fade-in" style={{ animationDelay: '0.2s' }}>
      <div className="relative rounded-2xl overflow-hidden border border-gray-200/80 dark:border-gray-700/80 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.15)] dark:shadow-[0_20px_60px_-15px_rgba(0,0,0,0.4)] bg-gradient-to-br from-gray-50/95 to-white/95 dark:from-gray-900/95 dark:to-gray-800/95 backdrop-blur-sm">

        {/* ── Animated Cursor Overlay ── */}
        {showCursor && (
          <motion.div
            initial={{ opacity: 0, left: '50%', top: '30%' }}
            animate={cursorControls}
            className="absolute z-50 pointer-events-none hidden md:block"
            style={{ filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.2))' }}
          >
            <motion.div
              animate={{ scale: isClicking ? 0.8 : 1 }}
              transition={{ duration: 0.08 }}
            >
              <svg width="18" height="22" viewBox="0 0 18 22" fill="none">
                <path
                  d="M1 1L1 17.5L5.5 13.5L9 21L11.5 20L8 12.5L14 12.5L1 1Z"
                  fill="white"
                  stroke="#333"
                  strokeWidth="1.2"
                  strokeLinejoin="round"
                />
              </svg>
            </motion.div>
            {/* Click ripple */}
            <AnimatePresence>
              {isClicking && (
                <motion.div
                  key="ripple"
                  initial={{ scale: 0.4, opacity: 0.5 }}
                  animate={{ scale: 2.5, opacity: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.45, ease: 'easeOut' }}
                  className="absolute top-0 left-0 w-5 h-5 rounded-full border border-emerald-400/40 bg-emerald-400/20"
                  style={{ transform: 'translate(-40%, -40%)' }}
                />
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {/* ── Dashboard Header ── */}
        <div className="bg-gray-100/90 dark:bg-gray-800/90 backdrop-blur-sm border-b border-gray-200/80 dark:border-gray-700/80 px-4 md:px-6 py-3 md:py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img src="/wagerproof-logo-main.png" alt="WagerProof" className="w-7 h-7 md:w-8 md:h-8 rounded-lg shadow-sm" />
            <span className="font-semibold text-sm md:text-base text-gray-900 dark:text-gray-100 tracking-tight">wagerproof.bet</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-gray-200/60 dark:bg-gray-700/40 border border-gray-300/40 dark:border-gray-600/30">
              <div className="w-1.5 h-1.5 rounded-full bg-red-400" />
              <div className="w-1.5 h-1.5 rounded-full bg-yellow-400" />
              <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-honeydew-100 dark:bg-honeydew-900/30 text-honeydew-700 dark:text-honeydew-400 text-xs font-medium border border-honeydew-200/50 dark:border-honeydew-800/30">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-honeydew-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-honeydew-500" />
              </span>
              Live
            </div>
          </div>
        </div>

        {/* ── Live Score Ticker ── */}
        <div className="overflow-hidden border-b border-gray-200/50 dark:border-gray-700/50">
          <LiveScoreTicker />
        </div>

        {/* ── Main Content Area ── */}
        <div className="flex">
          {/* Sidebar */}
          <div className="w-16 md:w-64 bg-gray-50/80 dark:bg-gray-800/40 backdrop-blur-sm border-r border-gray-200/60 dark:border-gray-700/60 p-2 md:p-3">
            <div className="space-y-0.5">
              {sidebarItems.map((item, index) => {
                if (item.isHeader) {
                  return (
                    <div
                      key={`header-${index}`}
                      className="text-[10px] font-mono font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-[0.12em] mt-4 mb-2 px-1 md:px-3 first:mt-1 hidden md:block"
                    >
                      {item.label}
                    </div>
                  );
                }

                const isHighlighted = highlightedSidebar === item.label;

                return (
                  <div
                    key={item.label}
                    className={`flex items-center justify-center md:justify-start gap-0 md:gap-2.5 px-1 md:px-3 py-1.5 md:py-2 rounded-lg text-sm transition-all duration-200 ${
                      item.active
                        ? 'bg-honeydew-100 dark:bg-honeydew-900/20 text-honeydew-700 dark:text-honeydew-400 font-medium shadow-sm border border-honeydew-200/50 dark:border-honeydew-800/30'
                        : isHighlighted
                        ? 'bg-honeydew-50 dark:bg-honeydew-900/10 text-honeydew-600 dark:text-honeydew-400 ring-1 ring-honeydew-300/50 dark:ring-honeydew-700/30'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/40'
                    }`}
                    title={item.label}
                  >
                    {item.icon && (
                      <item.icon className="w-4 h-4 flex-shrink-0" weight={item.icon === DiscordLogo ? "fill" : undefined} />
                    )}
                    <span className="hidden md:inline text-[13px]">{item.label}</span>
                    {(item.active || isHighlighted) && (
                      <div className={`hidden md:block ml-auto w-1.5 h-1.5 rounded-full ${isHighlighted && !item.active ? 'bg-honeydew-400 animate-pulse' : 'bg-honeydew-500'}`} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Content Area: Games grid + Agents overlay */}
          <div className="relative flex-1 overflow-hidden">
            {/* Games Grid (always rendered for stable height) */}
            <motion.div
              animate={{ opacity: activeView === 'games' ? 1 : 0 }}
              transition={{ duration: 0.3 }}
              className={`p-3 md:p-5 grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 ${activeView !== 'games' ? 'pointer-events-none' : ''}`}
            >
              {predictions.slice(0, 4).map((prediction, index) => {
                const awayTeamColors = getTeamColors(prediction.away_team);
                const homeTeamColors = getTeamColors(prediction.home_team);
                return (
                  <CFBMiniCard
                    key={prediction.id}
                    prediction={prediction}
                    awayTeamColors={awayTeamColors}
                    homeTeamColors={homeTeamColors}
                    getTeamLogo={getTeamLogo}
                    cardIndex={index}
                    sportType={sportType}
                    focused={focusedCard === index}
                  />
                );
              })}
            </motion.div>

            {/* Agents Panel Overlay */}
            <AnimatePresence>
              {activeView === 'agents' && (
                <motion.div
                  key="agents-panel"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="absolute inset-0 bg-gradient-to-br from-gray-50/98 to-white/98 dark:from-gray-900/98 dark:to-gray-800/98 backdrop-blur-sm"
                >
                  <AgentsPanel />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
