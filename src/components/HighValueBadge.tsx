import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Sparkles } from 'lucide-react';

interface HighValueBadgeProps {
  pick: string;
  confidence: number;
  tooltipText: string;
}

export function HighValueBadge({ pick, confidence, tooltipText }: HighValueBadgeProps) {
  // Color based on confidence level
  const getBadgeColor = (conf: number) => {
    if (conf >= 8) return 'bg-gradient-to-r from-green-600 to-emerald-600';
    if (conf >= 6) return 'bg-gradient-to-r from-yellow-600 to-amber-600';
    return 'bg-gradient-to-r from-orange-600 to-red-600';
  };

  const confidenceStars = '⭐'.repeat(Math.min(confidence, 10));

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            className={`${getBadgeColor(confidence)} text-white border-none cursor-help hover:scale-105 transition-transform duration-200 flex items-center gap-1.5 px-3 py-1.5 shadow-lg`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span className="font-semibold">High Value</span>
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-sm p-4 bg-gray-900 border-gray-700">
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-4">
              <p className="font-semibold text-white">{pick}</p>
              <span className="text-sm text-yellow-400">{confidenceStars}</span>
            </div>
            <p className="text-sm text-gray-300 leading-relaxed">{tooltipText}</p>
            <div className="flex items-center gap-1 text-xs text-gray-400 mt-2">
              <span>Confidence:</span>
              <span className="font-semibold text-white">{confidence}/10</span>
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

