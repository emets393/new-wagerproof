
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import CircularRangeSlider from "./CircularRangeSlider";

interface BettingLinesFiltersProps {
  filters: Record<string, string>;
  onFilterChange: (field: string, value: string) => void;
}

interface FieldRange {
  min: number;
  max: number;
}

interface FieldRanges {
  [key: string]: FieldRange;
}

const bettingFields = [
  { key: 'o_u_line', label: 'O/U Line', formatValue: (v: number) => v.toFixed(1) },
  { key: 'primary_ml', label: 'Primary ML', formatValue: (v: number) => v > 0 ? `+${v}` : v.toString() },
  { key: 'opponent_ml', label: 'Opponent ML', formatValue: (v: number) => v > 0 ? `+${v}` : v.toString() },
  { key: 'primary_rl', label: 'Primary RL', formatValue: (v: number) => v > 0 ? `+${v.toFixed(1)}` : v.toFixed(1) },
  { key: 'opponent_rl', label: 'Opponent RL', formatValue: (v: number) => v > 0 ? `+${v.toFixed(1)}` : v.toFixed(1) },
  { key: 'primary_ml_handle', label: 'Primary ML Handle', formatValue: (v: number) => `$${(v/1000).toFixed(0)}K` },
  { key: 'primary_ml_bets', label: 'Primary ML Bets', formatValue: (v: number) => v.toFixed(0) },
  { key: 'primary_rl_handle', label: 'Primary RL Handle', formatValue: (v: number) => `$${(v/1000).toFixed(0)}K` },
  { key: 'primary_rl_bets', label: 'Primary RL Bets', formatValue: (v: number) => v.toFixed(0) },
  { key: 'opponent_ml_handle', label: 'Opponent ML Handle', formatValue: (v: number) => `$${(v/1000).toFixed(0)}K` },
  { key: 'opponent_ml_bets', label: 'Opponent ML Bets', formatValue: (v: number) => v.toFixed(0) },
  { key: 'opponent_rl_handle', label: 'Opponent RL Handle', formatValue: (v: number) => `$${(v/1000).toFixed(0)}K` },
  { key: 'opponent_rl_bets', label: 'Opponent RL Bets', formatValue: (v: number) => v.toFixed(0) },
  { key: 'ou_handle_over', label: 'O/U Handle Over', formatValue: (v: number) => `$${(v/1000).toFixed(0)}K` },
  { key: 'ou_bets_over', label: 'O/U Bets Over', formatValue: (v: number) => v.toFixed(0) }
];

export default function BettingLinesFilters({ filters, onFilterChange }: BettingLinesFiltersProps) {
  const [fieldRanges, setFieldRanges] = useState<FieldRanges>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchFieldRanges = async () => {
      try {
        console.log('Fetching field ranges...');
        const { data, error } = await supabase.functions.invoke('get-field-ranges');
        
        if (error) {
          console.error('Error fetching field ranges:', error);
          return;
        }

        console.log('Field ranges received:', data);
        setFieldRanges(data || {});
      } catch (error) {
        console.error('Error in fetchFieldRanges:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchFieldRanges();
  }, []);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Betting Lines</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="text-sm text-muted-foreground mt-2">Loading field ranges...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-gradient-to-r from-primary to-primary/70"></div>
          Betting Lines
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {bettingFields.map(({ key, label, formatValue }) => {
            const range = fieldRanges[key];
            if (!range) {
              return (
                <div key={key} className="space-y-3 p-4 border rounded-lg bg-muted/50">
                  <div className="text-sm font-medium text-muted-foreground">{label}</div>
                  <div className="text-xs text-center">No data available</div>
                </div>
              );
            }

            return (
              <CircularRangeSlider
                key={key}
                label={label}
                field={key}
                value={filters[key] || ''}
                onChange={onFilterChange}
                min={range.min}
                max={range.max}
                step={key === 'o_u_line' ? 0.5 : key.includes('handle') ? 1000 : 1}
                formatValue={formatValue}
              />
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
