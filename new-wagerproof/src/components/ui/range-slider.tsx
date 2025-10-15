
import * as React from "react";
import { Slider } from "./slider";
import { cn } from "@/lib/utils";

interface RangeSliderProps {
  value: [number, number];
  onValueChange: (value: [number, number]) => void;
  min: number;
  max: number;
  step?: number;
  className?: string;
  label?: string;
  formatValue?: (value: number) => string;
}

export function RangeSlider({
  value,
  onValueChange,
  min,
  max,
  step = 1,
  className,
  label,
  formatValue = (v) => v.toString()
}: RangeSliderProps) {
  const handleValueChange = (newValue: number[]) => {
    if (newValue.length === 2) {
      onValueChange([newValue[0], newValue[1]]);
    }
  };

  return (
    <div className={cn("space-y-2", className)}>
      {label && (
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium">{label}</span>
          <span className="text-sm text-muted-foreground">
            {formatValue(value[0])} - {formatValue(value[1])}
          </span>
        </div>
      )}
      <Slider
        value={value}
        onValueChange={handleValueChange}
        min={min}
        max={max}
        step={step}
        className="w-full"
      />
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{formatValue(min)}</span>
        <span>{formatValue(max)}</span>
      </div>
    </div>
  );
}
