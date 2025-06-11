
import ConfidenceChart from './ConfidenceChart';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface TotalPredictionCardProps {
  prediction: string;
  total: number;
  confidence: number;
}

const TotalPredictionCard = ({ prediction, total, confidence }: TotalPredictionCardProps) => {
  const isOver = prediction?.toLowerCase().includes('over');
  const displayText = `${prediction} ${total}`;
  
  return (
    <div className="bg-gradient-to-br from-card to-card/30 border border-border/50 rounded-xl p-6 shadow-lg backdrop-blur-sm">
      <h4 className="font-bold text-lg text-foreground mb-4 text-center">Total Prediction</h4>
      
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
            {isOver ? (
              <TrendingUp className="w-6 h-6 text-emerald-600" />
            ) : (
              <TrendingDown className="w-6 h-6 text-rose-600" />
            )}
          </div>
          <div>
            <div className="font-semibold text-foreground">{displayText}</div>
            <div className="text-sm text-muted-foreground">Predicted Total</div>
          </div>
        </div>
        
        <div className="text-center">
          <div className="text-xs font-medium text-muted-foreground mb-1">Confidence %</div>
          <ConfidenceChart 
            confidence={confidence} 
            teamColors={isOver ? ['#10b981', '#e5e7eb'] : ['#ef4444', '#e5e7eb']} 
          />
        </div>
      </div>
    </div>
  );
};

export default TotalPredictionCard;
