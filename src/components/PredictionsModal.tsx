
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

  const { overPercentage, underPercentage } = calculateHandlePercentages();
  const { overPercentage: overBetsPercentage, underPercentage: underBetsPercentage } = calculateBetsPercentages();

  const formatMoneyline = (ml: number | undefined): string => {
    if (!ml) return 'N/A';
    return ml > 0 ? `+${ml}` : ml.toString();
  };

  const formatRunline = (rl: number | undefined): string => {
    if (!rl) return 'N/A';
    return rl > 0 ? `+${rl}` : rl.toString();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl font-inter bg-gradient-to-br from-background to-muted/20 border-border/50 shadow-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="text-center space-y-3 pb-2">
          <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
            Game Predictions
          </DialogTitle>
          <div className="flex items-center justify-center space-x-2 text-muted-foreground">
            <BarChart3 className="w-4 h-4" />
            <p className="text-base font-medium">
              {awayTeam} @ {homeTeam}
            </p>
          </div>
        </DialogHeader>
        
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center space-y-3">
              <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto"></div>
              <div className="text-muted-foreground font-medium">Loading predictions...</div>
            </div>
          </div>
        ) : predictions ? (
          <div className="space-y-6">
            {/* Betting Lines Section */}
            <div className="bg-gradient-to-br from-card to-card/30 border border-border/50 rounded-xl p-6 shadow-lg backdrop-blur-sm">
              <h4 className="font-bold text-lg text-foreground mb-4 text-center">Betting Lines</h4>
              
              <div className="grid grid-cols-3 gap-6">
                {/* Away Team Lines */}
                <div className="text-center">
                  <div className="text-sm font-semibold text-muted-foreground mb-3">{awayTeam}</div>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Moneyline:</span>
                      <span className="font-semibold">{formatMoneyline(predictions.away_ml)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Run Line:</span>
                      <span className="font-semibold">{formatRunline(predictions.away_rl)}</span>
                    </div>
                  </div>
                </div>
                
                {/* O/U Line */}
                <div className="text-center">
                  <div className="text-sm font-semibold text-muted-foreground mb-3">Total</div>
                  <div className="text-3xl font-bold text-foreground">
                    {predictions.o_u_line || 'N/A'}
                  </div>
                </div>
                
                {/* Home Team Lines */}
                <div className="text-center">
                  <div className="text-sm font-semibold text-muted-foreground mb-3">{homeTeam}</div>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Moneyline:</span>
                      <span className="font-semibold">{formatMoneyline(predictions.home_ml)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Run Line:</span>
                      <span className="font-semibold">{formatRunline(predictions.home_rl)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Prediction Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {predictions.moneyline_prediction && (
                <TeamPredictionCard
                  title="Moneyline Prediction"
                  predictedTeam={predictions.moneyline_prediction}
                  confidence={calculateConfidence(predictions.ml_tier_accuracy)}
                  homeTeam={homeTeam}
                  awayTeam={awayTeam}
                />
              )}
              
              {predictions.runline_prediction && (
                <TeamPredictionCard
                  title="Runline Prediction"
                  predictedTeam={predictions.runline_prediction}
                  confidence={calculateConfidence(predictions.run_line_tier_accuracy)}
                  homeTeam={homeTeam}
                  awayTeam={awayTeam}
                />
              )}

              {predictions.ou_prediction && predictions.o_u_line && (
                <TotalPredictionCard
                  prediction={predictions.ou_prediction}
                  total={predictions.o_u_line}
                  confidence={calculateConfidence(predictions.ou_tier_accuracy)}
                />
              )}
            </div>

            {/* Handle Distribution Chart */}
            <div className="bg-gradient-to-br from-card to-card/30 border border-border/50 rounded-xl p-6 shadow-lg backdrop-blur-sm">
              <div className="flex items-center space-x-2 mb-4">
                <TrendingUp className="w-5 h-5 text-primary" />
                <h4 className="font-bold text-lg text-foreground">O/U Handle Distribution</h4>
              </div>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <div className="flex items-center space-x-2">
                    <TrendingDown className="w-4 h-4 text-rose-500" />
                    <span className="font-semibold text-sm text-rose-600">Under</span>
                    <span className="font-bold text-lg text-rose-700">{underPercentage.toFixed(1)}%</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-lg text-emerald-700">{overPercentage.toFixed(1)}%</span>
                    <span className="font-semibold text-sm text-emerald-600">Over</span>
                    <TrendingUp className="w-4 h-4 text-emerald-500" />
                  </div>
                </div>
                
                <div className="relative">
                  <div className="w-full h-8 bg-gradient-to-r from-muted/50 to-muted/30 rounded-full overflow-hidden shadow-inner border border-border/30">
                    <div className="flex h-full">
                      <div 
                        className="bg-gradient-rose h-full transition-all duration-700 ease-out shadow-lg hover:shadow-rose-500/25 relative overflow-hidden"
                        style={{ width: `${underPercentage}%` }}
                      >
                        <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent"></div>
                      </div>
                      <div 
                        className="bg-gradient-emerald h-full transition-all duration-700 ease-out shadow-lg hover:shadow-emerald-500/25 relative overflow-hidden"
                        style={{ width: `${overPercentage}%` }}
                      >
                        <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent"></div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Percentage labels inside bars */}
                  {underPercentage > 15 && (
                    <div 
                      className="absolute top-1/2 transform -translate-y-1/2 left-2 text-white font-bold text-sm drop-shadow-lg"
                    >
                      {underPercentage.toFixed(0)}%
                    </div>
                  )}
                  {overPercentage > 15 && (
                    <div 
                      className="absolute top-1/2 transform -translate-y-1/2 right-2 text-white font-bold text-sm drop-shadow-lg"
                    >
                      {overPercentage.toFixed(0)}%
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Bets Distribution Chart */}
            <div className="bg-gradient-to-br from-card to-card/30 border border-border/50 rounded-xl p-6 shadow-lg backdrop-blur-sm">
              <div className="flex items-center space-x-2 mb-4">
                <BarChart3 className="w-5 h-5 text-primary" />
                <h4 className="font-bold text-lg text-foreground">O/U Bets Distribution</h4>
              </div>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <div className="flex items-center space-x-2">
                    <TrendingDown className="w-4 h-4 text-rose-500" />
                    <span className="font-semibold text-sm text-rose-600">Under</span>
                    <span className="font-bold text-lg text-rose-700">{underBetsPercentage.toFixed(1)}%</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-lg text-emerald-700">{overBetsPercentage.toFixed(1)}%</span>
                    <span className="font-semibold text-sm text-emerald-600">Over</span>
                    <TrendingUp className="w-4 h-4 text-emerald-500" />
                  </div>
                </div>
                
                <div className="relative">
                  <div className="w-full h-8 bg-gradient-to-r from-muted/50 to-muted/30 rounded-full overflow-hidden shadow-inner border border-border/30">
                    <div className="flex h-full">
                      <div 
                        className="bg-gradient-rose h-full transition-all duration-700 ease-out shadow-lg hover:shadow-rose-500/25 relative overflow-hidden"
                        style={{ width: `${underBetsPercentage}%` }}
                      >
                        <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent"></div>
                      </div>
                      <div 
                        className="bg-gradient-emerald h-full transition-all duration-700 ease-out shadow-lg hover:shadow-emerald-500/25 relative overflow-hidden"
                        style={{ width: `${overBetsPercentage}%` }}
                      >
                        <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent"></div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Percentage labels inside bars */}
                  {underBetsPercentage > 15 && (
                    <div 
                      className="absolute top-1/2 transform -translate-y-1/2 left-2 text-white font-bold text-sm drop-shadow-lg"
                    >
                      {underBetsPercentage.toFixed(0)}%
                    </div>
                  )}
                  {overBetsPercentage > 15 && (
                    <div 
                      className="absolute top-1/2 transform -translate-y-1/2 right-2 text-white font-bold text-sm drop-shadow-lg"
                    >
                      {overBetsPercentage.toFixed(0)}%
                    </div>
                  )}
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
