import { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";
import { RangeSlider } from "@/components/ui/range-slider";

interface NumericRangeFilterProps {
  label: string;
  field: string;
  value: any;
  onChange: (field: string, value: any) => void;
  min?: number;
  max?: number;
  step?: number;
  formatValue?: (value: number) => string;
}

export default function NumericRangeFilter({
  label,
  field,
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  formatValue = (v) => v.toString()
}: NumericRangeFilterProps) {
  const [rangeValue, setRangeValue] = useState<[number, number]>([min, max]);

  // Initialize range from existing value
  useEffect(() => {
    if (value && typeof value === 'string') {
      if (value.startsWith('between:')) {
        const [minVal, maxVal] = value.slice(8).split('-').map(Number);
        if (!isNaN(minVal) && !isNaN(maxVal)) {
          setRangeValue([minVal, maxVal]);
        }
      } else if (!isNaN(Number(value))) {
        const numValue = Number(value);
        setRangeValue([numValue, numValue]);
      }
    } else if (!value) {
      setRangeValue([min, max]);
    }
  }, [value, min, max]);

  const handleRangeChange = (newValue: [number, number]) => {
    setRangeValue(newValue);
    
    // If both values are the same, treat as exact match
    if (newValue[0] === newValue[1]) {
      onChange(field, newValue[0].toString());
    } 
    // If both values are at min/max, clear the filter
    else if (newValue[0] === min && newValue[1] === max) {
      onChange(field, "");
    }
    // Otherwise, use between format
    else {
      onChange(field, `between:${newValue[0]}-${newValue[1]}`);
    }
  };

  const clearFilter = () => {
    onChange(field, "");
    setRangeValue([min, max]);
  };

  const isActive = value && value.toString().trim() !== "";

  const getDisplayValue = () => {
    if (!isActive) return null;
    
    const val = value.toString();
    if (val.startsWith("between:")) {
      const [minVal, maxVal] = val.slice(8).split("-");
      return `${formatValue(Number(minVal))} - ${formatValue(Number(maxVal))}`;
    }
    return formatValue(Number(val));
  };

  return (
    <div className="space-y-3 p-4 border rounded-lg bg-card">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">{label}</Label>
        {isActive && (
          <Badge variant="secondary" className="text-xs">
            {getDisplayValue()}
            <Button
              variant="ghost"
              size="sm"
              className="h-4 w-4 p-0 ml-1"
              onClick={clearFilter}
            >
              <X className="h-3 w-3" />
            </Button>
          </Badge>
        )}
      </div>

      <RangeSlider
        value={rangeValue}
        onValueChange={handleRangeChange}
        min={min}
        max={max}
        step={step}
        formatValue={formatValue}
      />
    </div>
  );
}
