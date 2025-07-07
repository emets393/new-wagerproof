
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { X, Filter } from "lucide-react";

interface FilterSummaryProps {
  filters: Record<string, string>;
  onClearFilter: (field: string) => void;
  onClearAll: () => void;
}

export default function FilterSummary({ filters, onClearFilter, onClearAll }: FilterSummaryProps) {
  const activeFilters = Object.entries(filters).filter(([_, value]) => 
    value && value.toString().trim() !== ''
  );

  if (activeFilters.length === 0) return null;

  const formatFilterValue = (key: string, value: string) => {
    const label = key.replace(/_/g, ' ');
    
    if (value.startsWith("lt:")) return `${label} < ${value.slice(3)}`;
    if (value.startsWith("gt:")) return `${label} > ${value.slice(3)}`;
    if (value.startsWith("between:")) {
      const [min, max] = value.slice(8).split("-");
      return `${label}: ${min} - ${max}`;
    }
    return `${label}: ${value}`;
  };

  return (
    <div className="flex items-center gap-2 p-3 bg-muted/30 rounded-lg border">
      <Filter className="h-4 w-4 text-muted-foreground" />
      <span className="text-sm font-medium text-muted-foreground">
        Active Filters ({activeFilters.length}):
      </span>
      
      <div className="flex flex-wrap gap-1">
        {activeFilters.map(([key, value]) => (
          <Badge key={key} variant="secondary" className="text-xs">
            {formatFilterValue(key, value)}
            <Button
              variant="ghost"
              size="sm"
              className="h-4 w-4 p-0 ml-1 hover:bg-destructive hover:text-destructive-foreground"
              onClick={() => onClearFilter(key)}
            >
              <X className="h-3 w-3" />
            </Button>
          </Badge>
        ))}
      </div>

      <Button
        variant="outline"
        size="sm"
        onClick={onClearAll}
        className="ml-auto text-xs"
      >
        Clear All
      </Button>
    </div>
  );
}
