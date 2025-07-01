
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RangeSlider } from "@/components/ui/range-slider";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Target } from "lucide-react";

interface SituationalFiltersProps {
  filters: Record<string, string>;
  onFilterChange: (field: string, value: string) => void;
}

export default function SituationalFilters({ filters, onFilterChange }: SituationalFiltersProps) {
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
    <Card className="filter-section-situational">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="w-5 h-5 text-cyan-600" />
          <span className="gradient-text-situational">Situational Filters</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Range Filters */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Series Game Number */}
          <div className="space-y-3">
            <RangeSlider
              label="Series Game #"
              value={getCurrentRange('series_game_number', 1, 7)}
              onValueChange={(value) => handleRangeChange('series_game_number', value, 1, 7)}
              min={1}
              max={7}
              step={1}
              formatValue={(v) => v.toString()}
            />
          </div>

          {/* Days Between Games */}
          <div className="space-y-3">
            <RangeSlider
              label="Days Between Games"
              value={getCurrentRange('primary_days_between_games', 0, 10)}
              onValueChange={(value) => handleRangeChange('primary_days_between_games', value, 0, 10)}
              min={0}
              max={10}
              step={1}
              formatValue={(v) => v.toString()}
            />
          </div>

          {/* Primary Last Win */}
          <div className="space-y-3">
            <RangeSlider
              label="Primary Last Win"
              value={getCurrentRange('primary_last_win', 0, 1)}
              onValueChange={(value) => handleRangeChange('primary_last_win', value, 0, 1)}
              min={0}
              max={1}
              step={1}
              formatValue={(v) => v === 1 ? 'Won' : 'Lost'}
            />
          </div>

          {/* Opponent Last Win */}
          <div className="space-y-3">
            <RangeSlider
              label="Opponent Last Win"
              value={getCurrentRange('opponent_last_win', 0, 1)}
              onValueChange={(value) => handleRangeChange('opponent_last_win', value, 0, 1)}
              min={0}
              max={1}
              step={1}
              formatValue={(v) => v === 1 ? 'Won' : 'Lost'}
            />
          </div>
        </div>

        {/* Boolean Filters */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 pt-4 border-t border-cyan-200">
          {/* Same Division */}
          <div className="space-y-3">
            <Label className="text-sm font-medium text-cyan-700">Same Division</Label>
            <RadioGroup
              value={filters['same_division'] || ''}
              onValueChange={(value) => onFilterChange('same_division', value)}
              className="flex gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="1" id="same_div_yes" className="border-cyan-500 text-cyan-600" />
                <Label htmlFor="same_div_yes" className="text-sm cursor-pointer hover:text-cyan-600 transition-colors">Yes</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="0" id="same_div_no" className="border-cyan-500 text-cyan-600" />
                <Label htmlFor="same_div_no" className="text-sm cursor-pointer hover:text-cyan-600 transition-colors">No</Label>
              </div>
            </RadioGroup>
          </div>

          {/* Is Home Team */}
          <div className="space-y-3">
            <Label className="text-sm font-medium text-cyan-700">Home Team</Label>
            <RadioGroup
              value={filters['is_home_team'] || ''}
              onValueChange={(value) => onFilterChange('is_home_team', value)}
              className="flex gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="true" id="home_yes" className="border-cyan-500 text-cyan-600" />
                <Label htmlFor="home_yes" className="text-sm cursor-pointer hover:text-cyan-600 transition-colors">Yes</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="false" id="home_no" className="border-cyan-500 text-cyan-600" />
                <Label htmlFor="home_no" className="text-sm cursor-pointer hover:text-cyan-600 transition-colors">No</Label>
              </div>
            </RadioGroup>
          </div>

          {/* Team Pitcher Handedness */}
          <div className="space-y-3">
            <Label className="text-sm font-medium text-cyan-700">Team Pitcher Handedness</Label>
            <RadioGroup
              value={filters['primary_handedness'] || ''}
              onValueChange={(value) => onFilterChange('primary_handedness', value)}
              className="flex gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="2" id="primary_left" className="border-cyan-500 text-cyan-600" />
                <Label htmlFor="primary_left" className="text-sm cursor-pointer hover:text-cyan-600 transition-colors">L</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="1" id="primary_right" className="border-cyan-500 text-cyan-600" />
                <Label htmlFor="primary_right" className="text-sm cursor-pointer hover:text-cyan-600 transition-colors">R</Label>
              </div>
            </RadioGroup>
          </div>

          {/* Opponent Pitcher Handedness */}
          <div className="space-y-3">
            <Label className="text-sm font-medium text-cyan-700">Opponent Pitcher Handedness</Label>
            <RadioGroup
              value={filters['opponent_handedness'] || ''}
              onValueChange={(value) => onFilterChange('opponent_handedness', value)}
              className="flex gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="2" id="opponent_left" className="border-cyan-500 text-cyan-600" />
                <Label htmlFor="opponent_left" className="text-sm cursor-pointer hover:text-cyan-600 transition-colors">L</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="1" id="opponent_right" className="border-cyan-500 text-cyan-600" />
                <Label htmlFor="opponent_right" className="text-sm cursor-pointer hover:text-cyan-600 transition-colors">R</Label>
              </div>
            </RadioGroup>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
