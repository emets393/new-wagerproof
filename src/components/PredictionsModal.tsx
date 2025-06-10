
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
          circa_total_prediction_strength
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
