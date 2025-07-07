
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RangeSlider } from "@/components/ui/range-slider";
import { Calendar } from "lucide-react";

interface DateFiltersProps {
  filters: Record<string, string>;
  onFilterChange: (field: string, value: string) => void;
}

export default function DateFilters({ filters, onFilterChange }: DateFiltersProps) {
  const handleRangeChange = (field: string, value: [number, number], min: number, max: number) => {
    if (value[0] === min && value[1] === max) {
      onFilterChange(field, '');
    } else {
      onFilterChange(field, `between:${value[0]},${value[1]}`);
    }
  };

  const getCurrentRange = (field: string, defaultMin: number, defaultMax: number): [number, number] => {
    const filter = filters[field];
    if (filter && filter.startsWith('between:')) {
      const [min, max] = filter.slice(8).split(',').map(Number);
      return [min, max];
    }
    return [defaultMin, defaultMax];
  };

  return (
    <Card className="filter-section-date">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-pink-600" />
          <span className="gradient-text-date">Date Filters</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Season */}
          <div className="space-y-3">
            <RangeSlider
              label="Season"
              value={getCurrentRange('season', 2020, 2025)}
              onValueChange={(value) => handleRangeChange('season', value, 2020, 2025)}
              min={2020}
              max={2025}
              step={1}
              formatValue={(v) => v.toString()}
            />
          </div>

          {/* Month */}
          <div className="space-y-3">
            <RangeSlider
              label="Month"
              value={getCurrentRange('month', 1, 12)}
              onValueChange={(value) => handleRangeChange('month', value, 1, 12)}
              min={1}
              max={12}
              step={1}
              formatValue={(v) => {
                const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                               'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                return months[v - 1] || v.toString();
              }}
            />
          </div>

          {/* Day */}
          <div className="space-y-3">
            <RangeSlider
              label="Day"
              value={getCurrentRange('day', 1, 31)}
              onValueChange={(value) => handleRangeChange('day', value, 1, 31)}
              min={1}
              max={31}
              step={1}
              formatValue={(v) => v.toString()}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
