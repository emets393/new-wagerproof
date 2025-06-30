
import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";

type FilterMode = "exact" | "lt" | "gt" | "between";

interface AdvancedNumericFilterProps {
  label: string;
  field: string;
  value: any;
  onChange: (field: string, value: any) => void;
  min?: number;
  max?: number;
  step?: number;
}

export default function AdvancedNumericFilter({
  label,
  field,
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1
}: AdvancedNumericFilterProps) {
  const [mode, setMode] = useState<FilterMode>("exact");
  const [sliderValue, setSliderValue] = useState([min]);
  const [rangeValue, setRangeValue] = useState([min, max]);
  const [inputValue, setInputValue] = useState("");

  const handleModeChange = (newMode: string) => {
    if (!newMode) return;
    setMode(newMode as FilterMode);
    
    // Clear the filter when mode changes
    onChange(field, "");
    setInputValue("");
  };

  const handleSliderChange = (values: number[]) => {
    setSliderValue(values);
    const filterValue = values[0];
    
    if (mode === "lt") {
      onChange(field, `lt:${filterValue}`);
    } else if (mode === "gt") {
      onChange(field, `gt:${filterValue}`);
    }
  };

  const handleRangeChange = (values: number[]) => {
    setRangeValue(values);
    if (mode === "between") {
      onChange(field, `between:${values[0]}-${values[1]}`);
    }
  };

  const handleInputChange = (inputVal: string) => {
    setInputValue(inputVal);
    if (mode === "exact") {
      onChange(field, inputVal);
    }
  };

  const clearFilter = () => {
    onChange(field, "");
    setInputValue("");
    setSliderValue([min]);
    setRangeValue([min, max]);
  };

  const isActive = value && value.toString().trim() !== "";

  const getDisplayValue = () => {
    if (!isActive) return null;
    
    const val = value.toString();
    if (val.startsWith("lt:")) return `< ${val.slice(3)}`;
    if (val.startsWith("gt:")) return `> ${val.slice(3)}`;
    if (val.startsWith("between:")) {
      const [min, max] = val.slice(8).split("-");
      return `${min} - ${max}`;
    }
    return val;
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

      <ToggleGroup
        type="single"
        value={mode}
        onValueChange={handleModeChange}
        className="grid grid-cols-4 gap-1"
        size="sm"
      >
        <ToggleGroupItem value="exact" className="text-xs">
          =
        </ToggleGroupItem>
        <ToggleGroupItem value="lt" className="text-xs">
          &lt;
        </ToggleGroupItem>
        <ToggleGroupItem value="gt" className="text-xs">
          &gt;
        </ToggleGroupItem>
        <ToggleGroupItem value="between" className="text-xs">
          ⇄
        </ToggleGroupItem>
      </ToggleGroup>

      {mode === "exact" && (
        <Input
          type="number"
          value={inputValue}
          onChange={(e) => handleInputChange(e.target.value)}
          placeholder={`Enter ${label.toLowerCase()}`}
          className="h-8"
        />
      )}

      {(mode === "lt" || mode === "gt") && (
        <div className="space-y-2">
          <Slider
            value={sliderValue}
            onValueChange={handleSliderChange}
            min={min}
            max={max}
            step={step}
            className="w-full"
          />
          <div className="text-xs text-muted-foreground text-center">
            {mode === "lt" ? "Less than" : "Greater than"}: {sliderValue[0]}
          </div>
        </div>
      )}

      {mode === "between" && (
        <div className="space-y-2">
          <Slider
            value={rangeValue}
            onValueChange={handleRangeChange}
            min={min}
            max={max}
            step={step}
            className="w-full"
          />
          <div className="text-xs text-muted-foreground text-center">
            Between: {rangeValue[0]} - {rangeValue[1]}
          </div>
        </div>
      )}
    </div>
  );
}
