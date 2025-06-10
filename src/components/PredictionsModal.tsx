import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { TrendingUp, TrendingDown, BarChart3 } from "lucide-react";

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
          strong_ou_prediction,
          circa_total_prediction,
          circa_total_prediction_strength,
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

  // Calculate percentages for the handle bar
  const calculateHandlePercentages = () => {
    // Convert to numbers, treating null/undefined as 0
    const overHandle = Number(predictions?.Total_Over_Handle) || 0;
    const underHandle = Number(predictions?.Total_Under_Handle) || 0;
    
    const totalHandle = overHandle + underHandle;
    
    // If no handle data at all, default to 50/50
    if (totalHandle === 0) {
      return { overPercentage: 50, underPercentage: 50 };
    }

    const overPercentage = (overHandle / totalHandle) * 100;
    const underPercentage = (underHandle / totalHandle) * 100;

    return { overPercentage, underPercentage };
  };

  // Calculate percentages for the bets bar
  const calculateBetsPercentages = () => {
    // Convert to numbers, treating null/undefined as 0
    const overBets = Number(predictions?.Total_Over_Bets) || 0;
    const underBets = Number(predictions?.Total_Under_Bets) || 0;
    
    const totalBets = overBets + underBets;
    
    // If no bets data at all, default to 50/50
    if (totalBets === 0) {
      return { overPercentage: 50, underPercentage: 50 };
    }

    const overPercentage = (overBets / totalBets) * 100;
    const underPercentage = (underBets / totalBets) * 100;

    return { overPercentage, underPercentage };
  };

  const { overPercentage, underPercentage } = calculateHandlePercentages();
  const { overPercentage: overBetsPercentage, underPercentage: underBetsPercentage } = calculateBetsPercentages();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg font-inter bg-gradient-to-br from-background to-muted/20 border-border/50 shadow-2xl">
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
            <div className="grid grid-cols-1 gap-4">
              {/* Prediction Cards */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gradient-to-br from-card to-card/50 border border-border/50 rounded-xl p-4 shadow-lg hover:shadow-xl transition-all duration-300">
                  <h4 className="font-semibold text-sm text-muted-foreground mb-1 uppercase tracking-wide">Model Total</h4>
                  <p className="text-2xl font-bold text-foreground">{predictions.ou_prediction || 'N/A'}</p>
                </div>
                
                <div className="bg-gradient-to-br from-card to-card/50 border border-border/50 rounded-xl p-4 shadow-lg hover:shadow-xl transition-all duration-300">
                  <h4 className="font-semibold text-sm text-muted-foreground mb-1 uppercase tracking-wide">Strong O/U</h4>
                  <p className="text-2xl font-bold text-foreground">{predictions.strong_ou_prediction || 'N/A'}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gradient-to-br from-card to-card/50 border border-border/50 rounded-xl p-4 shadow-lg hover:shadow-xl transition-all duration-300">
                  <h4 className="font-semibold text-sm text-muted-foreground mb-1 uppercase tracking-wide">Circa Total</h4>
                  <p className="text-2xl font-bold text-foreground">{predictions.circa_total_prediction || 'N/A'}</p>
                </div>
                
                <div className="bg-gradient-to-br from-card to-card/50 border border-border/50 rounded-xl p-4 shadow-lg hover:shadow-xl transition-all duration-300">
                  <h4 className="font-semibold text-sm text-muted-foreground mb-1 uppercase tracking-wide">Circa Strength</h4>
                  <p className="text-2xl font-bold text-foreground">{predictions.circa_total_prediction_strength || 'N/A'}</p>
                </div>
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
