import React from 'react';
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface PublicBettingDistributionProps {
  uniqueId: string;
  homeTeam: string;
  awayTeam: string;
  target: string; // 'moneyline', 'runline', or 'over_under'
}

const PublicBettingDistribution: React.FC<PublicBettingDistributionProps> = ({ 
  uniqueId, 
  homeTeam, 
  awayTeam, 
  target 
}) => {
  // Fetch moneyline handle and bets from circa_lines
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
    enabled: !!uniqueId,
  });

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

  // Helper to get team colors
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
      'Dodgers': { primary: '#005A9C', secondary: '#EF3E42' },
      'Miami': { primary: '#00A3E0', secondary: '#ED6F2E' },
      'Milwaukee': { primary: '#12284B', secondary: '#FFC72C' },
      'Minnesota': { primary: '#002B5C', secondary: '#D31145' },
      'Mets': { primary: '#002D72', secondary: '#FF5910' },
      'Yankees': { primary: '#003087', secondary: '#E4002C' },
      'Athletics': { primary: '#003831', secondary: '#EFB21E' },
      'Philadelphia': { primary: '#E81828', secondary: '#284898' },
      'Pittsburgh': { primary: '#FDB827', secondary: '#27251F' },
      'San Diego': { primary: '#2F241D', secondary: '#FFC425' },
      'San Francisco': { primary: '#FD5A1E', secondary: '#000000' },
      'Seattle': { primary: '#0C2C56', secondary: '#005C5C' },
      'ST Louis': { primary: '#C41E3A', secondary: '#0C2340' },
      'Tampa Bay': { primary: '#092C5C', secondary: '#8FBCE6' },
      'Texas': { primary: '#003278', secondary: '#C0111F' },
      'Toronto': { primary: '#134A8E', secondary: '#E8291C' },
      'Washington': { primary: '#AB0003', secondary: '#14225A' },
    };
    return teamColors[teamName] || { primary: '#666666', secondary: '#999999' };
  };

  // Helper to get bar color based on percentage
  const getBarColor = (percentage: number) => {
    console.log(`getBarColor called with percentage: ${percentage}`);
    if (percentage < 33.3) {
      console.log(`Returning red for ${percentage}%`);
      return '#ef4444'; // red
    }
    if (percentage < 66.6) {
      console.log(`Returning orange for ${percentage}%`);
      return '#f59e42'; // orange
    }
    console.log(`Returning green for ${percentage}%`);
    return '#22c55e'; // green
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

  const { homePct: mlHandleHomePct, awayPct: mlHandleAwayPct } = calculateMLHandlePercentages();
  const { homePct: mlBetsHomePct, awayPct: mlBetsAwayPct } = calculateMLBetsPercentages();
  const { homePct: rlHandleHomePct, awayPct: rlHandleAwayPct } = calculateRLHandlePercentages();
  const { homePct: rlBetsHomePct, awayPct: rlBetsAwayPct } = calculateRLBetsPercentages();

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

  // Get team colors and pick the most distinct pair
  const homeColors = getTeamColors(homeTeam);
  const awayColors = getTeamColors(awayTeam);
  const colorPairs = [
    { home: homeColors.primary, away: awayColors.primary },
    { home: homeColors.primary, away: awayColors.secondary },
    { home: homeColors.secondary, away: awayColors.primary },
    { home: homeColors.secondary, away: awayColors.secondary },
  ];
  let maxDist = -1;
  let bestPair = colorPairs[0];
  colorPairs.forEach(pair => {
    const dist = colorDistance(pair.home, pair.away);
    if (dist > maxDist) {
      maxDist = dist;
      bestPair = pair;
    }
  });
  const SIMILARITY_THRESHOLD = 60;
  const homeBarColor = bestPair.home;
  // If still too similar, use a neutral fallback for away
  const awayBarColor = maxDist < SIMILARITY_THRESHOLD ? '#888888' : bestPair.away;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto"></div>
          <div className="text-muted-foreground font-medium">Loading betting distribution...</div>
        </div>
      </div>
    );
  }

  if (!moneylineData) {
    return (
      <div className="text-center py-8">
        <div className="text-muted-foreground text-lg font-medium">
          No betting distribution data available for this game
        </div>
      </div>
    );
  }

  // Render the appropriate distribution based on target
  const renderDistribution = () => {
    switch (target) {
      case 'over_under':
        return (
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
                  <div className="h-full" style={{ width: `${calculateHandlePercentages().underPercentage}%`, backgroundColor: getBarColor(calculateHandlePercentages().underPercentage) }} />
                  <div className="h-full" style={{ width: `${calculateHandlePercentages().overPercentage}%`, backgroundColor: getBarColor(calculateHandlePercentages().overPercentage) }} />
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
                  <div className="h-full" style={{ width: `${calculateBetsPercentages().underPercentage}%`, backgroundColor: getBarColor(calculateBetsPercentages().underPercentage) }} />
                  <div className="h-full" style={{ width: `${calculateBetsPercentages().overPercentage}%`, backgroundColor: getBarColor(calculateBetsPercentages().overPercentage) }} />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm text-emerald-600">Over</span>
                <span className="font-bold text-lg text-emerald-700">{calculateBetsPercentages().overPercentage.toFixed(1)}%</span>
              </div>
            </div>
          </div>
        );

      case 'moneyline':
        return (
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
                  <div className="h-full" style={{ width: `${mlHandleAwayPct}%`, backgroundColor: getBarColor(mlHandleAwayPct) }} />
                  <div className="h-full" style={{ width: `${mlHandleHomePct}%`, backgroundColor: getBarColor(mlHandleHomePct) }} />
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
                  <div className="h-full" style={{ width: `${mlBetsAwayPct}%`, backgroundColor: getBarColor(mlBetsAwayPct) }} />
                  <div className="h-full" style={{ width: `${mlBetsHomePct}%`, backgroundColor: getBarColor(mlBetsHomePct) }} />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg" style={{ color: homeBarColor }}>{mlBetsHomePct.toFixed(1)}%</span>
                <img src={getTeamLogo(homeTeam)} alt={homeTeam + ' logo'} className="w-10 h-10 rounded-full bg-white shadow-md border-2 border-primary object-contain p-1" />
              </div>
            </div>
          </div>
        );

      case 'runline':
        return (
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
                  <div className="h-full" style={{ width: `${rlHandleAwayPct}%`, backgroundColor: getBarColor(rlHandleAwayPct) }} />
                  <div className="h-full" style={{ width: `${rlHandleHomePct}%`, backgroundColor: getBarColor(rlHandleHomePct) }} />
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
                  <div className="h-full" style={{ width: `${rlBetsAwayPct}%`, backgroundColor: getBarColor(rlBetsAwayPct) }} />
                  <div className="h-full" style={{ width: `${rlBetsHomePct}%`, backgroundColor: getBarColor(rlBetsHomePct) }} />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg" style={{ color: homeBarColor }}>{rlBetsHomePct.toFixed(1)}%</span>
                <img src={getTeamLogo(homeTeam)} alt={homeTeam + ' logo'} className="w-10 h-10 rounded-full bg-white shadow-md border-2 border-primary object-contain p-1" />
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Public Betting Distribution Header */}
      <h3 className="text-2xl font-bold text-center mb-2">Public Betting Distribution</h3>
      {renderDistribution()}
    </div>
  );
};

export default PublicBettingDistribution; 