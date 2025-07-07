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
  const { data: predictions, isLoading } = useQuery({
    queryKey: ['predictions', uniqueId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('latest_predictions_with_circa')
        .select(`
          ou_prediction,
          moneyline_prediction,
          ml_tier_accuracy,
          runline_prediction,
          run_line_tier_accuracy,
          ou_tier_accuracy,
          o_u_line,
          home_ml,
          away_ml,
          home_rl,
          away_rl,
          Total_Over_Handle,
          Total_Under_Handle,
          Total_Over_Bets,
          Total_Under_Bets
        `)
        .eq('unique_id', uniqueId)
        .single();

      if (error) {
        console.error('Error fetching predictions:', error);
        throw error;
      }
      
      return data;
    },
    enabled: isOpen,
  });

  // Fetch moneyline handle and bets from circa_lines
  const normalizedId = uniqueId.replace(/\+/g, ' ');
  const { data: moneylineData } = useQuery({
    queryKey: ["circa_lines", uniqueId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("circa_lines")
        .select("Handle_Home, Handle_Away, Bets_Home, Bets_Away, RL_Handle_Home, RL_Handle_Away, RL_Bets_Home, RL_Bets_Away")
        .eq("unique_id", normalizedId)
        .single();
      if (error) {
        console.error("Error fetching circa_lines:", error);
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

  // Calculate percentages for the handle bar
  const calculateHandlePercentages = () => {
    const overHandle = Number(predictions?.Total_Over_Handle) || 0;
    const underHandle = Number(predictions?.Total_Under_Handle) || 0;
    
    const totalHandle = overHandle + underHandle;
    
    if (totalHandle === 0) {
      return { overPercentage: 50, underPercentage: 50 };
    }

    const overPercentage = (overHandle / totalHandle) * 100;
    const underPercentage = (underHandle / totalHandle) * 100;

    return { overPercentage, underPercentage };
  };

  // Calculate percentages for the bets bar
  const calculateBetsPercentages = () => {
    const overBets = Number(predictions?.Total_Over_Bets) || 0;
    const underBets = Number(predictions?.Total_Under_Bets) || 0;
    
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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl font-inter bg-gradient-to-br from-background to-muted/20 border-border/50 shadow-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="text-center space-y-2 pb-2">
          <div className="flex items-center justify-center space-x-2 text-muted-foreground">
            <BarChart3 className="w-4 h-4" />
            <p className="text-base font-medium">
              {awayTeam} @ {homeTeam}
            </p>
          </div>
        </DialogHeader>
        
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-center space-y-3">
              <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto"></div>
              <div className="text-muted-foreground font-medium">Loading predictions...</div>
            </div>
          </div>
        ) : predictions ? (
          <div className="space-y-4">
            {/* Public Betting Distribution Header */}
            <h3 className="text-xl font-bold text-center mb-3">Public Betting Distribution</h3>

            {/* O/U Distribution Card */}
            <div className="bg-gradient-to-br from-card to-accent/10 border-2 border-accent rounded-2xl p-4 shadow-xl backdrop-blur-sm flex flex-col mb-4">
              <div className="text-lg font-bold text-left w-full mb-3 text-primary drop-shadow-sm gradient-text-betting">O/U</div>
              {/* Handle Sub-header */}
              <div className="text-base font-semibold text-center mb-2">Handle</div>
              {/* O/U Handle Distribution Chart */}
              <div className="flex items-center mb-4 w-full justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm text-emerald-600">Over</span>
                  <span className="font-bold text-lg text-emerald-700">{calculateHandlePercentages().overPercentage.toFixed(1)}%</span>
                </div>
                <div className="flex-1 mx-2">
                  <div className="w-full h-8 bg-gradient-to-r from-muted/50 to-muted/30 rounded-full overflow-hidden shadow-inner border border-border/30 flex">
                    <div className="bg-gradient-emerald h-full" style={{ width: `${calculateHandlePercentages().overPercentage}%` }} />
                    <div className="bg-gradient-rose h-full" style={{ width: `${calculateHandlePercentages().underPercentage}%` }} />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-lg text-rose-700">{calculateHandlePercentages().underPercentage.toFixed(1)}%</span>
                  <span className="font-semibold text-sm text-rose-600">Under</span>
                </div>
              </div>
              {/* Bets Sub-header */}
              <div className="text-base font-semibold text-center mb-2">Bets</div>
              {/* O/U Bets Distribution Chart */}
              <div className="flex items-center mb-1 w-full justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm text-emerald-600">Over</span>
                  <span className="font-bold text-lg text-emerald-700">{calculateBetsPercentages().overPercentage.toFixed(1)}%</span>
                </div>
                <div className="flex-1 mx-2">
                  <div className="w-full h-8 bg-gradient-to-r from-muted/50 to-muted/30 rounded-full overflow-hidden shadow-inner border border-border/30 flex">
                    <div className="bg-gradient-emerald h-full" style={{ width: `${calculateBetsPercentages().overPercentage}%` }} />
                    <div className="bg-gradient-rose h-full" style={{ width: `${calculateBetsPercentages().underPercentage}%` }} />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-lg text-rose-700">{calculateBetsPercentages().underPercentage.toFixed(1)}%</span>
                  <span className="font-semibold text-sm text-rose-600">Under</span>
                </div>
              </div>
            </div>

            {/* Moneyline Distribution Card */}
            <div className="bg-gradient-to-br from-card to-primary/10 border-2 border-primary rounded-2xl p-4 shadow-xl backdrop-blur-sm flex flex-col mb-4">
              <div className="text-lg font-bold text-left w-full mb-3 text-primary drop-shadow-sm gradient-text-betting">Moneyline</div>
              {/* Handle Sub-header */}
              <div className="text-base font-semibold text-center mb-2">Handle</div>
              {/* Moneyline Handle Distribution Chart */}
              <div className="flex items-center mb-4 w-full justify-between">
                <div className="flex items-center gap-2">
                  <img src={getTeamLogo(homeTeam)} alt={homeTeam + ' logo'} className="w-10 h-10 rounded-full bg-white shadow-md border-2 border-primary object-contain p-1" />
                  <span className="font-bold text-lg text-emerald-700">{mlHandleHomePct.toFixed(1)}%</span>
                </div>
                <div className="flex-1 mx-2">
                  <div className="w-full h-8 bg-gradient-to-r from-muted/50 to-muted/30 rounded-full overflow-hidden shadow-inner border border-border/30 flex">
                    <div className="bg-gradient-emerald h-full" style={{ width: `${mlHandleHomePct}%` }} />
                    <div className="bg-gradient-rose h-full" style={{ width: `${mlHandleAwayPct}%` }} />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-lg text-rose-700">{mlHandleAwayPct.toFixed(1)}%</span>
                  <img src={getTeamLogo(awayTeam)} alt={awayTeam + ' logo'} className="w-10 h-10 rounded-full bg-white shadow-md border-2 border-primary object-contain p-1" />
                </div>
              </div>
              {/* Bets Sub-header */}
              <div className="text-base font-semibold text-center mb-2">Bets</div>
              {/* Moneyline Bets Distribution Chart */}
              <div className="flex items-center mb-1 w-full justify-between">
                <div className="flex items-center gap-2">
                  <img src={getTeamLogo(homeTeam)} alt={homeTeam + ' logo'} className="w-10 h-10 rounded-full bg-white shadow-md border-2 border-primary object-contain p-1" />
                  <span className="font-bold text-lg text-emerald-700">{mlBetsHomePct.toFixed(1)}%</span>
                </div>
                <div className="flex-1 mx-2">
                  <div className="w-full h-8 bg-gradient-to-r from-muted/50 to-muted/30 rounded-full overflow-hidden shadow-inner border border-border/30 flex">
                    <div className="bg-gradient-emerald h-full" style={{ width: `${mlBetsHomePct}%` }} />
                    <div className="bg-gradient-rose h-full" style={{ width: `${mlBetsAwayPct}%` }} />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-lg text-rose-700">{mlBetsAwayPct.toFixed(1)}%</span>
                  <img src={getTeamLogo(awayTeam)} alt={awayTeam + ' logo'} className="w-10 h-10 rounded-full bg-white shadow-md border-2 border-primary object-contain p-1" />
                </div>
              </div>
            </div>

            {/* Runline Distribution Card */}
            <div className="bg-gradient-to-br from-card to-success/10 border-2 border-success rounded-2xl p-4 shadow-xl backdrop-blur-sm flex flex-col mb-4">
              <div className="text-lg font-bold text-left w-full mb-3 text-success drop-shadow-sm gradient-text-betting">Runline</div>
              {/* Handle Sub-header */}
              <div className="text-base font-semibold text-center mb-2">Handle</div>
              {/* Runline Handle Distribution Chart */}
              <div className="flex items-center mb-4 w-full justify-between">
                <div className="flex items-center gap-2">
                  <img src={getTeamLogo(homeTeam)} alt={homeTeam + ' logo'} className="w-10 h-10 rounded-full bg-white shadow-md border-2 border-primary object-contain p-1" />
                  <span className="font-bold text-lg text-emerald-700">{rlHandleHomePct.toFixed(1)}%</span>
                </div>
                <div className="flex-1 mx-2">
                  <div className="w-full h-8 bg-gradient-to-r from-muted/50 to-muted/30 rounded-full overflow-hidden shadow-inner border border-border/30 flex">
                    <div className="bg-gradient-emerald h-full" style={{ width: `${rlHandleHomePct}%` }} />
                    <div className="bg-gradient-rose h-full" style={{ width: `${rlHandleAwayPct}%` }} />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-lg text-rose-700">{rlHandleAwayPct.toFixed(1)}%</span>
                  <img src={getTeamLogo(awayTeam)} alt={awayTeam + ' logo'} className="w-10 h-10 rounded-full bg-white shadow-md border-2 border-primary object-contain p-1" />
                </div>
              </div>
              {/* Bets Sub-header */}
              <div className="text-base font-semibold text-center mb-2">Bets</div>
              {/* Runline Bets Distribution Chart */}
              <div className="flex items-center mb-1 w-full justify-between">
                <div className="flex items-center gap-2">
                  <img src={getTeamLogo(homeTeam)} alt={homeTeam + ' logo'} className="w-10 h-10 rounded-full bg-white shadow-md border-2 border-primary object-contain p-1" />
                  <span className="font-bold text-lg text-emerald-700">{rlBetsHomePct.toFixed(1)}%</span>
                </div>
                <div className="flex-1 mx-2">
                  <div className="w-full h-8 bg-gradient-to-r from-muted/50 to-muted/30 rounded-full overflow-hidden shadow-inner border border-border/30 flex">
                    <div className="bg-gradient-emerald h-full" style={{ width: `${rlBetsHomePct}%` }} />
                    <div className="bg-gradient-rose h-full" style={{ width: `${rlBetsAwayPct}%` }} />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-lg text-rose-700">{rlBetsAwayPct.toFixed(1)}%</span>
                  <img src={getTeamLogo(awayTeam)} alt={awayTeam + ' logo'} className="w-10 h-10 rounded-full bg-white shadow-md border-2 border-primary object-contain p-1" />
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
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
