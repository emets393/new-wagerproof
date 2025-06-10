
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

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
          Total_Under_Handle
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
    if (!predictions?.Total_Over_Handle || !predictions?.Total_Under_Handle) {
      return { overPercentage: 50, underPercentage: 50 };
    }

    const totalHandle = Number(predictions.Total_Over_Handle) + Number(predictions.Total_Under_Handle);
    if (totalHandle === 0) {
      return { overPercentage: 50, underPercentage: 50 };
    }

    const overPercentage = (Number(predictions.Total_Over_Handle) / totalHandle) * 100;
    const underPercentage = (Number(predictions.Total_Under_Handle) / totalHandle) * 100;

    return { overPercentage, underPercentage };
  };

  const { overPercentage, underPercentage } = calculateHandlePercentages();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center">
            Game Predictions
          </DialogTitle>
          <p className="text-center text-muted-foreground">
            {awayTeam} @ {homeTeam}
          </p>
        </DialogHeader>
        
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-muted-foreground">Loading predictions...</div>
          </div>
        ) : predictions ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3">
              <div className="border rounded-lg p-3">
                <h4 className="font-semibold text-sm mb-2">Model Total</h4>
                <p className="text-lg font-bold">{predictions.ou_prediction || 'N/A'}</p>
              </div>
              
              <div className="border rounded-lg p-3">
                <h4 className="font-semibold text-sm mb-2">Strong O/U Prediction</h4>
                <p className="text-lg font-bold">{predictions.strong_ou_prediction || 'N/A'}</p>
              </div>
              
              <div className="border rounded-lg p-3">
                <h4 className="font-semibold text-sm mb-2">Circa Total Prediction</h4>
                <p className="text-lg font-bold">{predictions.circa_total_prediction || 'N/A'}</p>
              </div>
              
              <div className="border rounded-lg p-3">
                <h4 className="font-semibold text-sm mb-2">Circa Prediction Strength</h4>
                <p className="text-lg font-bold">{predictions.circa_total_prediction_strength || 'N/A'}</p>
              </div>

              <div className="border rounded-lg p-3">
                <h4 className="font-semibold text-sm mb-3">O/U Handle Distribution</h4>
                <div className="space-y-2">
                  <div className="flex justify-between text-xs text-muted-foreground mb-1">
                    <span>Under ({underPercentage.toFixed(1)}%)</span>
                    <span>Over ({overPercentage.toFixed(1)}%)</span>
                  </div>
                  <div className="w-full h-6 bg-gray-200 rounded-full overflow-hidden flex">
                    <div 
                      className="bg-red-500 h-full transition-all duration-300"
                      style={{ width: `${underPercentage}%` }}
                    />
                    <div 
                      className="bg-green-500 h-full transition-all duration-300"
                      style={{ width: `${overPercentage}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs font-medium">
                    <span className="text-red-600">Under</span>
                    <span className="text-green-600">Over</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            No predictions available for this game
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default PredictionsModal;
