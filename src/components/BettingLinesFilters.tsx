
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { RangeSlider } from "@/components/ui/range-slider";
import { supabase } from "@/integrations/supabase/client";
import { TrendingUp } from "lucide-react";

interface BettingLinesFiltersProps {
  filters: Record<string, string>;
  onFilterChange: (field: string, value: string) => void;
}

interface FieldRange {
  min: number;
  max: number;
}

export default function BettingLinesFilters({ filters, onFilterChange }: BettingLinesFiltersProps) {
  const [ouRange, setOuRange] = useState<FieldRange | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchOuRange = async () => {
      try {
        console.log('Fetching O/U line range...');
        const { data, error } = await supabase.functions.invoke('get-field-ranges', {
          method: 'POST'
        });
        
        if (error) {
          console.error('Error fetching field ranges:', error);
          return;
        }

        if (data && data.o_u_line) {
          setOuRange(data.o_u_line);
        }
      } catch (error) {
        console.error('Error in fetchOuRange:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchOuRange();
  }, []);

  const handleOuLineChange = (value: [number, number]) => {
    onFilterChange('o_u_line', `between:${value[0]},${value[1]}`);
  };

  const getCurrentOuRange = (): [number, number] => {
    const filter = filters['o_u_line'];
    if (filter && filter.startsWith('between:')) {
      const [min, max] = filter.slice(8).split(',').map(Number);
      return [min, max];
    }
    return ouRange ? [ouRange.min, ouRange.max] : [6, 15];
  };

  if (isLoading) {
    return (
      <Card className="filter-section-betting">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-purple-600" />
            <span className="gradient-text-betting">Betting Lines</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500 mx-auto"></div>
            <p className="text-sm text-purple-600 mt-2">Loading ranges...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="filter-section-betting">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-purple-600" />
          <span className="gradient-text-betting">Betting Lines</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* O/U Line Range Slider */}
        {ouRange && (
          <div className="space-y-3">
            <RangeSlider
              label="Over/Under Line"
              value={getCurrentOuRange()}
              onValueChange={handleOuLineChange}
              min={ouRange.min}
              max={ouRange.max}
              step={0.5}
              formatValue={(v) => v.toFixed(1)}
              className="w-full"
            />
          </div>
        )}

        {/* Favored/Underdog Selection */}
        <div className="space-y-3">
          <Label className="text-sm font-medium text-purple-700">Team Status</Label>
          <RadioGroup
            value={filters['team_status'] || ''}
            onValueChange={(value) => onFilterChange('team_status', value)}
            className="flex gap-6"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="favored" id="favored" className="border-purple-500 text-purple-600" />
              <Label htmlFor="favored" className="text-sm font-medium cursor-pointer hover:text-purple-600 transition-colors">
                Favored
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="underdog" id="underdog" className="border-purple-500 text-purple-600" />
              <Label htmlFor="underdog" className="text-sm font-medium cursor-pointer hover:text-purple-600 transition-colors">
                Underdog
              </Label>
            </div>
          </RadioGroup>
        </div>
      </CardContent>
    </Card>
  );
}
