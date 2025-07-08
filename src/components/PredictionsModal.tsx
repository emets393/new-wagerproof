import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { TrendingUp, TrendingDown, BarChart3 } from "lucide-react";
import TeamPredictionCard from "./TeamPredictionCard";
import TotalPredictionCard from "./TotalPredictionCard";

interface PredictionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  uniqueId: string;
  homeTeam: string;
  awayTeam: string;
}

const PredictionsModal = ({ isOpen, onClose, uniqueId, homeTeam, awayTeam }: PredictionsModalProps) => {
  // Fetch moneyline handle and bets from circa_lines (only table we need now)
  const normalizedId = uniqueId.replace(/\+/g, ' ');
  const { data: moneylineData, isLoading } = useQuery({
    queryKey: ["circa_lines", uniqueId],
    queryFn: async () => {
      console.log('Fetching circa_lines data for unique_id:', normalizedId);
      const { data, error } = await supabase
        .from("circa_lines")
        .select("Handle_Home, Handle_Away, Bets_Home, Bets_Away, RL_Handle_Home, RL_Handle_Away, RL_Bets_Home, RL_Bets_Away, Total_Over_Handle, Total_Under_Handle, Total_Over_Bets, Total_Under_Bets")
        .eq("unique_id", normalizedId)
        .single();
      if (error) {
        console.error("Error fetching circa_lines:", error);
        return null;
      }
      console.log('Circa_lines data found:', data);
      return data;
    },
    enabled: isOpen,
  });

  // Fetch game stats from input_values_view
  const { data: gameStats, isLoading: isStatsLoading } = useQuery({
    queryKey: ["game_stats", uniqueId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("input_values_view")
        .select("*")
        .eq("unique_id", uniqueId)
        .single();
      if (error) {
        console.error("Error fetching game stats:", error);
        return null;
      }
      return data;
    },
    enabled: isOpen,
  });

  // Helper function to calculate confidence percentage
  const calculateConfidence = (tierAccuracy: number | null): number => {
    if (!tierAccuracy) return 50;
    
    // If below 0.5, invert it
    if (tierAccuracy < 0.5) {
      return (1 - tierAccuracy) * 100;
    }
    
    return tierAccuracy * 100;
  };

  // Calculate percentages for the O/U handle bar
  const calculateHandlePercentages = () => {
    const overHandle = Number(moneylineData?.Total_Over_Handle) || 0;
    const underHandle = Number(moneylineData?.Total_Under_Handle) || 0;
    
    const totalHandle = overHandle + underHandle;
    
    if (totalHandle === 0) {
      return { overPercentage: 50, underPercentage: 50 };
    }

    const overPercentage = (overHandle / totalHandle) * 100;
    const underPercentage = (underHandle / totalHandle) * 100;

    return { overPercentage, underPercentage };
  };

  // Calculate percentages for the O/U bets bar
  const calculateBetsPercentages = () => {
    const overBets = Number(moneylineData?.Total_Over_Bets) || 0;
    const underBets = Number(moneylineData?.Total_Under_Bets) || 0;
    
    const totalBets = overBets + underBets;
    
    if (totalBets === 0) {
      return { overPercentage: 50, underPercentage: 50 };
    }

    const overPercentage = (overBets / totalBets) * 100;
    const underPercentage = (underBets / totalBets) * 100;

    return { overPercentage, underPercentage };
  };

  // Calculate percentages for Moneyline Handle
  const calculateMLHandlePercentages = () => {
    const home = Number(moneylineData?.Handle_Home) || 0;
    const away = Number(moneylineData?.Handle_Away) || 0;
    const total = home + away;
    if (total === 0) return { homePct: 50, awayPct: 50 };
    return { homePct: (home / total) * 100, awayPct: (away / total) * 100 };
  };

  // Calculate percentages for Moneyline Bets
  const calculateMLBetsPercentages = () => {
    const home = Number(moneylineData?.Bets_Home) || 0;
    const away = Number(moneylineData?.Bets_Away) || 0;
    const total = home + away;
    if (total === 0) return { homePct: 50, awayPct: 50 };
    return { homePct: (home / total) * 100, awayPct: (away / total) * 100 };
  };
  const { homePct: mlHandleHomePct, awayPct: mlHandleAwayPct } = calculateMLHandlePercentages();
  const { homePct: mlBetsHomePct, awayPct: mlBetsAwayPct } = calculateMLBetsPercentages();

  // Calculate percentages for Runline Handle
  const calculateRLHandlePercentages = () => {
    const home = Number(moneylineData?.RL_Handle_Home) || 0;
    const away = Number(moneylineData?.RL_Handle_Away) || 0;
    const total = home + away;
    if (total === 0) return { homePct: 50, awayPct: 50 };
    return { homePct: (home / total) * 100, awayPct: (away / total) * 100 };
  };
  // Calculate percentages for Runline Bets
  const calculateRLBetsPercentages = () => {
    const home = Number(moneylineData?.RL_Bets_Home) || 0;
    const away = Number(moneylineData?.RL_Bets_Away) || 0;
    const total = home + away;
    if (total === 0) return { homePct: 50, awayPct: 50 };
    return { homePct: (home / total) * 100, awayPct: (away / total) * 100 };
  };
  const { homePct: rlHandleHomePct, awayPct: rlHandleAwayPct } = calculateRLHandlePercentages();
  const { homePct: rlBetsHomePct, awayPct: rlBetsAwayPct } = calculateRLBetsPercentages();

  const formatMoneyline = (ml: number | undefined): string => {
    if (!ml) return 'N/A';
    return ml > 0 ? `+${ml}` : ml.toString();
  };

  const formatRunline = (rl: number | undefined): string => {
    if (!rl) return 'N/A';
    return rl > 0 ? `+${rl}` : rl.toString();
  };

  // Helper to get team logo URL
  const getTeamLogo = (teamName: string) => {
    const espnLogoMap: { [key: string]: string } = {
      'Arizona': 'https://a.espncdn.com/i/teamlogos/mlb/500/ari.png',
      'Atlanta': 'https://a.espncdn.com/i/teamlogos/mlb/500/atl.png',
      'Baltimore': 'https://a.espncdn.com/i/teamlogos/mlb/500/bal.png',
      'Boston': 'https://a.espncdn.com/i/teamlogos/mlb/500/bos.png',
      'Cubs': 'https://a.espncdn.com/i/teamlogos/mlb/500/chc.png',
      'White Sox': 'https://a.espncdn.com/i/teamlogos/mlb/500/cws.png',
      'Cincinnati': 'https://a.espncdn.com/i/teamlogos/mlb/500/cin.png',
      'Cleveland': 'https://a.espncdn.com/i/teamlogos/mlb/500/cle.png',
      'Colorado': 'https://a.espncdn.com/i/teamlogos/mlb/500/col.png',
      'Detroit': 'https://a.espncdn.com/i/teamlogos/mlb/500/det.png',
      'Houston': 'https://a.espncdn.com/i/teamlogos/mlb/500/hou.png',
      'Kansas City': 'https://a.espncdn.com/i/teamlogos/mlb/500/kc.png',
      'Angels': 'https://a.espncdn.com/i/teamlogos/mlb/500/laa.png',
      'Dodgers': 'https://a.espncdn.com/i/teamlogos/mlb/500/lad.png',
      'Miami': 'https://a.espncdn.com/i/teamlogos/mlb/500/mia.png',
      'Milwaukee': 'https://a.espncdn.com/i/teamlogos/mlb/500/mil.png',
      'Minnesota': 'https://a.espncdn.com/i/teamlogos/mlb/500/min.png',
      'Mets': 'https://a.espncdn.com/i/teamlogos/mlb/500/nym.png',
      'Yankees': 'https://a.espncdn.com/i/teamlogos/mlb/500/nyy.png',
      'Athletics': 'https://a.espncdn.com/i/teamlogos/mlb/500/oak.png',
      'Philadelphia': 'https://a.espncdn.com/i/teamlogos/mlb/500/phi.png',
      'Pittsburgh': 'https://a.espncdn.com/i/teamlogos/mlb/500/pit.png',
      'San Diego': 'https://a.espncdn.com/i/teamlogos/mlb/500/sd.png',
      'San Francisco': 'https://a.espncdn.com/i/teamlogos/mlb/500/sf.png',
      'Seattle': 'https://a.espncdn.com/i/teamlogos/mlb/500/sea.png',
      'ST Louis': 'https://a.espncdn.com/i/teamlogos/mlb/500/stl.png',
      'Tampa Bay': 'https://a.espncdn.com/i/teamlogos/mlb/500/tb.png',
      'Texas': 'https://a.espncdn.com/i/teamlogos/mlb/500/tex.png',
      'Toronto': 'https://a.espncdn.com/i/teamlogos/mlb/500/tor.png',
      'Washington': 'https://a.espncdn.com/i/teamlogos/mlb/500/wsh.png',
    };
    return espnLogoMap[teamName];
  };

  // Helper to get team colors (primary and secondary)
  const getTeamColors = (teamName: string) => {
    const teamColors: { [key: string]: { primary: string; secondary: string } } = {
      'Arizona': { primary: '#A71931', secondary: '#E3D4AD' },
      'Atlanta': { primary: '#CE1141', secondary: '#13274F' },
      'Baltimore': { primary: '#DF4601', secondary: '#000000' },
      'Boston': { primary: '#BD3039', secondary: '#0C2340' },
      'Cubs': { primary: '#0E3386', secondary: '#CC3433' },
      'White Sox': { primary: '#000000', secondary: '#C4CED4' },
      'Cincinnati': { primary: '#C6011F', secondary: '#000000' },
      'Cleveland': { primary: '#0C2340', secondary: '#E31937' },
      'Colorado': { primary: '#33006F', secondary: '#C4CED4' },
      'Detroit': { primary: '#0C2340', secondary: '#FA4616' },
      'Houston': { primary: '#002D62', secondary: '#EB6E1F' },
      'Kansas City': { primary: '#004687', secondary: '#C09A5B' },
      'Angels': { primary: '#BA0021', secondary: '#003263' },
      'Dodgers': { primary: '#005A9C', secondary: '#A5ACAF' },
      'Miami': { primary: '#00A3E0', secondary: '#000000' },
      'Milwaukee': { primary: '#12284B', secondary: '#FFC72C' },
      'Minnesota': { primary: '#002B5C', secondary: '#D31145' },
      'Mets': { primary: '#002D72', secondary: '#FF5910' },
      'Yankees': { primary: '#0C2340', secondary: '#C4CED4' },
      'Athletics': { primary: '#003831', secondary: '#EFB21E' },
      'Philadelphia': { primary: '#E81828', secondary: '#002D72' },
      'Pittsburgh': { primary: '#FDB827', secondary: '#000000' },
      'San Diego': { primary: '#2F241D', secondary: '#FFC425' },
      'San Francisco': { primary: '#FD5A1E', secondary: '#000000' },
      'Seattle': { primary: '#0C2C56', secondary: '#005C5C' },
      'ST Louis': { primary: '#C41E3A', secondary: '#0C2340' },
      'Tampa Bay': { primary: '#092C5C', secondary: '#8FBCE6' },
      'Texas': { primary: '#003278', secondary: '#C0111F' },
      'Toronto': { primary: '#134A8E', secondary: '#E8291C' },
      'Washington': { primary: '#AB0003', secondary: '#14225A' },
    };
    return teamColors[teamName] || { primary: '#10b981', secondary: '#e5e7eb' };
  };

  // Helper to convert hex to RGB
  function hexToRgb(hex: string) {
    const match = hex.replace('#', '').match(/.{1,2}/g);
    if (!match) return [0, 0, 0];
    return match.map(x => parseInt(x, 16));
  }

  // Helper to calculate color distance
  function colorDistance(hex1: string, hex2: string) {
    const [r1, g1, b1] = hexToRgb(hex1);
    const [r2, g2, b2] = hexToRgb(hex2);
    return Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2);
  }

  // Get team colors and check similarity
  const homeColors = getTeamColors(homeTeam);
  const awayColors = getTeamColors(awayTeam);
  const colorDist = colorDistance(homeColors.primary, awayColors.primary);
  const SIMILARITY_THRESHOLD = 60; // tweak as needed

  const homeBarColor = homeColors.primary;
  const awayBarColor = colorDist < SIMILARITY_THRESHOLD ? awayColors.secondary : awayColors.primary;

  // Helper to format stat values
  const formatStat = (value, type) => {
    if (value === null || value === undefined) return "-";
    if (type === "pct") return Number(value).toFixed(3);
    if (type === "last_game") return value === 1 ? <span className="text-green-600 font-semibold">Won</span> : value === 0 ? <span className="text-red-600 font-semibold">Loss</span> : value;
    return value;
  };

  // Helper to determine which side gets the star icon
  const Star = () => <span className="ml-1 text-green-600 text-base align-middle">★</span>;
  const getStar = (row, awayVal, homeVal, side) => {
    if (awayVal === null || homeVal === null || awayVal === undefined || homeVal === undefined) return null;
    if (row.type === "last_game") return null;
    if (row.label === "Opponent OB + Slug (Last 3)") {
      if (Number(awayVal) < Number(homeVal) && side === "away") return <Star />;
      if (Number(homeVal) < Number(awayVal) && side === "home") return <Star />;
      return null;
    }
    if (row.type === "pct" || row.label === "Series Wins" || row.label === "Win Streak") {
      if (Number(awayVal) > Number(homeVal) && side === "away") return <Star />;
      if (Number(homeVal) > Number(awayVal) && side === "home") return <Star />;
      return null;
    }
    return null;
  };

  // Custom display names and mapping (with Series Wins at the top)
  const statRows = [
    { label: "Series Wins", away: "series_away_wins", home: "series_home_wins", type: "int" },
    { label: "OB + Slug (Last 3)", away: "away_team_last_3", home: "home_team_last_3", type: "pct" },
    { label: "Opponent OB + Slug (Last 3)", away: "away_ops_last_3", home: "home_ops_last_3", type: "pct" },
    { label: "Win %", away: "away_win_pct", home: "home_win_pct", type: "pct" },
    { label: "Win Streak", away: "away_streak", home: "streak", type: "int" },
    { label: "Last Game", away: "away_last_win", home: "home_last_win", type: "last_game" },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl font-inter bg-gradient-to-br from-background to-muted/20 border-border/50 shadow-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="text-center space-y-3 pb-2">
          <div className="flex flex-col items-center justify-center">
            {/* Divisional Game */}
            {gameStats?.same_division === 1 && (
              <div className="text-sm font-semibold text-primary mb-1">Divisional Game</div>
            )}
            {/* Team Logos with Game Number in between */}
            <div className="flex items-center justify-center gap-8 mb-2">
              <div className="flex flex-col items-center">
                <img src={getTeamLogo(awayTeam)} alt={awayTeam + ' logo'} className="w-24 h-24 rounded-full bg-white shadow-md border-2 border-primary object-contain p-1" />
                <span className="mt-2 text-base font-semibold">{awayTeam}</span>
              </div>
              <div className="flex flex-col items-center min-w-[80px]">
                <span className="text-lg font-bold text-primary">Game {gameStats?.series_game_number ?? "-"}</span>
              </div>
              <div className="flex flex-col items-center">
                <img src={getTeamLogo(homeTeam)} alt={homeTeam + ' logo'} className="w-24 h-24 rounded-full bg-white shadow-md border-2 border-primary object-contain p-1" />
                <span className="mt-2 text-base font-semibold">{homeTeam}</span>
              </div>
            </div>
            {/* Comparison Table */}
            <div className="w-full flex justify-center">
              <table className="w-auto border-collapse text-sm bg-background rounded-lg shadow">
                <tbody>
                  {statRows.map(row => {
                    const awayVal = gameStats?.[row.away];
                    const homeVal = gameStats?.[row.home];
                    return (
                      <tr key={row.label}>
                        <td className="px-6 py-2 text-center font-medium">
                          {formatStat(awayVal, row.type)}{getStar(row, awayVal, homeVal, "away")}
                        </td>
                        <td className="px-4 py-2 text-center text-muted-foreground whitespace-nowrap">{row.label}</td>
                        <td className="px-6 py-2 text-center font-medium">
                          {formatStat(homeVal, row.type)}{getStar(row, awayVal, homeVal, "home")}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </DialogHeader>
        
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center space-y-3">
              <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto"></div>
              <div className="text-muted-foreground font-medium">Loading Matchup...</div>
            </div>
          </div>
        ) : moneylineData ? (
          <div className="space-y-6">
            {/* Public Betting Distribution Header */}
            <h3 className="text-2xl font-bold text-center mb-2">Public Betting Distribution</h3>

            {/* O/U Distribution Card */}
            <div className="bg-gradient-to-br from-card to-accent/10 border-2 border-accent rounded-2xl p-6 shadow-xl backdrop-blur-sm flex flex-col mb-8">
              <div className="text-xl font-bold text-left w-full mb-4 text-primary drop-shadow-sm gradient-text-betting">O/U</div>
              {/* Handle Sub-header */}
              <div className="text-lg font-semibold text-center mb-2">Handle</div>
              {/* O/U Handle Distribution Chart */}
              <div className="flex items-center mb-6 w-full justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-lg text-rose-700">{calculateHandlePercentages().underPercentage.toFixed(1)}%</span>
                  <span className="font-semibold text-sm text-rose-600">Under</span>
                </div>
                <div className="flex-1 mx-2">
                  <div className="w-full h-8 bg-gradient-to-r from-muted/50 to-muted/30 rounded-full overflow-hidden shadow-inner border border-border/30 flex">
                    <div className="bg-gradient-rose h-full" style={{ width: `${calculateHandlePercentages().underPercentage}%` }} />
                    <div className="bg-gradient-emerald h-full" style={{ width: `${calculateHandlePercentages().overPercentage}%` }} />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm text-emerald-600">Over</span>
                  <span className="font-bold text-lg text-emerald-700">{calculateHandlePercentages().overPercentage.toFixed(1)}%</span>
                </div>
              </div>
              {/* Bets Sub-header */}
              <div className="text-lg font-semibold text-center mb-2">Bets</div>
              {/* O/U Bets Distribution Chart */}
              <div className="flex items-center mb-2 w-full justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-lg text-rose-700">{calculateBetsPercentages().underPercentage.toFixed(1)}%</span>
                  <span className="font-semibold text-sm text-rose-600">Under</span>
                </div>
                <div className="flex-1 mx-2">
                  <div className="w-full h-8 bg-gradient-to-r from-muted/50 to-muted/30 rounded-full overflow-hidden shadow-inner border border-border/30 flex">
                    <div className="bg-gradient-rose h-full" style={{ width: `${calculateBetsPercentages().underPercentage}%` }} />
                    <div className="bg-gradient-emerald h-full" style={{ width: `${calculateBetsPercentages().overPercentage}%` }} />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm text-emerald-600">Over</span>
                  <span className="font-bold text-lg text-emerald-700">{calculateBetsPercentages().overPercentage.toFixed(1)}%</span>
                </div>
              </div>
            </div>

            {/* Moneyline Distribution Card */}
            <div className="bg-gradient-to-br from-card to-primary/10 border-2 border-primary rounded-2xl p-6 shadow-xl backdrop-blur-sm flex flex-col mb-8">
              <div className="text-xl font-bold text-left w-full mb-4 text-primary drop-shadow-sm gradient-text-betting">Moneyline</div>
              {/* Handle Sub-header */}
              <div className="text-lg font-semibold text-center mb-2">Handle</div>
              {/* Moneyline Handle Distribution Chart */}
              <div className="flex items-center mb-6 w-full justify-between">
                <div className="flex items-center gap-2">
                  <img src={getTeamLogo(awayTeam)} alt={awayTeam + ' logo'} className="w-10 h-10 rounded-full bg-white shadow-md border-2 border-primary object-contain p-1" />
                  <span className="font-bold text-lg" style={{ color: awayBarColor }}>{mlHandleAwayPct.toFixed(1)}%</span>
                </div>
                <div className="flex-1 mx-2">
                  <div className="w-full h-8 bg-gradient-to-r from-muted/50 to-muted/30 rounded-full overflow-hidden shadow-inner border border-border/30 flex">
                    <div className="h-full" style={{ width: `${mlHandleAwayPct}%`, backgroundColor: awayBarColor }} />
                    <div className="h-full" style={{ width: `${mlHandleHomePct}%`, backgroundColor: homeBarColor }} />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-lg" style={{ color: homeBarColor }}>{mlHandleHomePct.toFixed(1)}%</span>
                  <img src={getTeamLogo(homeTeam)} alt={homeTeam + ' logo'} className="w-10 h-10 rounded-full bg-white shadow-md border-2 border-primary object-contain p-1" />
                </div>
              </div>
              {/* Bets Sub-header */}
              <div className="text-lg font-semibold text-center mb-2">Bets</div>
              {/* Moneyline Bets Distribution Chart */}
              <div className="flex items-center mb-2 w-full justify-between">
                <div className="flex items-center gap-2">
                  <img src={getTeamLogo(awayTeam)} alt={awayTeam + ' logo'} className="w-10 h-10 rounded-full bg-white shadow-md border-2 border-primary object-contain p-1" />
                  <span className="font-bold text-lg" style={{ color: awayBarColor }}>{mlBetsAwayPct.toFixed(1)}%</span>
                </div>
                <div className="flex-1 mx-2">
                  <div className="w-full h-8 bg-gradient-to-r from-muted/50 to-muted/30 rounded-full overflow-hidden shadow-inner border border-border/30 flex">
                    <div className="h-full" style={{ width: `${mlBetsAwayPct}%`, backgroundColor: awayBarColor }} />
                    <div className="h-full" style={{ width: `${mlBetsHomePct}%`, backgroundColor: homeBarColor }} />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-lg" style={{ color: homeBarColor }}>{mlBetsHomePct.toFixed(1)}%</span>
                  <img src={getTeamLogo(homeTeam)} alt={homeTeam + ' logo'} className="w-10 h-10 rounded-full bg-white shadow-md border-2 border-primary object-contain p-1" />
                </div>
              </div>
            </div>

            {/* Runline Distribution Card */}
            <div className="bg-gradient-to-br from-card to-success/10 border-2 border-success rounded-2xl p-6 shadow-xl backdrop-blur-sm flex flex-col mb-8">
              <div className="text-xl font-bold text-left w-full mb-4 text-success drop-shadow-sm gradient-text-betting">Runline</div>
              {/* Handle Sub-header */}
              <div className="text-lg font-semibold text-center mb-2">Handle</div>
              {/* Runline Handle Distribution Chart */}
              <div className="flex items-center mb-6 w-full justify-between">
                <div className="flex items-center gap-2">
                  <img src={getTeamLogo(awayTeam)} alt={awayTeam + ' logo'} className="w-10 h-10 rounded-full bg-white shadow-md border-2 border-primary object-contain p-1" />
                  <span className="font-bold text-lg" style={{ color: awayBarColor }}>{rlHandleAwayPct.toFixed(1)}%</span>
                </div>
                <div className="flex-1 mx-2">
                  <div className="w-full h-8 bg-gradient-to-r from-muted/50 to-muted/30 rounded-full overflow-hidden shadow-inner border border-border/30 flex">
                    <div className="h-full" style={{ width: `${rlHandleAwayPct}%`, backgroundColor: awayBarColor }} />
                    <div className="h-full" style={{ width: `${rlHandleHomePct}%`, backgroundColor: homeBarColor }} />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-lg" style={{ color: homeBarColor }}>{rlHandleHomePct.toFixed(1)}%</span>
                  <img src={getTeamLogo(homeTeam)} alt={homeTeam + ' logo'} className="w-10 h-10 rounded-full bg-white shadow-md border-2 border-primary object-contain p-1" />
                </div>
              </div>
              {/* Bets Sub-header */}
              <div className="text-lg font-semibold text-center mb-2">Bets</div>
              {/* Runline Bets Distribution Chart */}
              <div className="flex items-center mb-2 w-full justify-between">
                <div className="flex items-center gap-2">
                  <img src={getTeamLogo(awayTeam)} alt={awayTeam + ' logo'} className="w-10 h-10 rounded-full bg-white shadow-md border-2 border-primary object-contain p-1" />
                  <span className="font-bold text-lg" style={{ color: awayBarColor }}>{rlBetsAwayPct.toFixed(1)}%</span>
                </div>
                <div className="flex-1 mx-2">
                  <div className="w-full h-8 bg-gradient-to-r from-muted/50 to-muted/30 rounded-full overflow-hidden shadow-inner border border-border/30 flex">
                    <div className="h-full" style={{ width: `${rlBetsAwayPct}%`, backgroundColor: awayBarColor }} />
                    <div className="h-full" style={{ width: `${rlBetsHomePct}%`, backgroundColor: homeBarColor }} />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-lg" style={{ color: homeBarColor }}>{rlBetsHomePct.toFixed(1)}%</span>
                  <img src={getTeamLogo(homeTeam)} alt={homeTeam + ' logo'} className="w-10 h-10 rounded-full bg-white shadow-md border-2 border-primary object-contain p-1" />
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="text-muted-foreground text-lg font-medium">
              No predictions available for this game
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default PredictionsModal;
