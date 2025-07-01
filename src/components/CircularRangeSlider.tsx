import { useState, useEffect, useRef } from "react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";

interface CircularRangeSliderProps {
  label: string;
  field: string;
  value: any;
  onChange: (field: string, value: any) => void;
  min: number;
  max: number;
  step?: number;
  formatValue?: (value: number) => string;
}

export default function CircularRangeSlider({
  label,
  field,
  value,
  onChange,
  min,
  max,
  step = 1,
  formatValue = (v) => v.toString()
}: CircularRangeSliderProps) {
  const [rangeValue, setRangeValue] = useState<[number, number]>([min, max]);
  const [isDragging, setIsDragging] = useState<'min' | 'max' | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const radius = 60;
  const strokeWidth = 8;
  const center = 80;
  const circumference = 2 * Math.PI * radius;

  // Initialize range from existing value
  useEffect(() => {
    if (value && typeof value === 'string') {
      if (value.startsWith('between:')) {
        const [minVal, maxVal] = value.slice(8).split(',').map(Number);
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

  const valueToAngle = (val: number) => {
    const normalizedValue = (val - min) / (max - min);
    return normalizedValue * 360 - 90; // Start from top
  };

  const angleToValue = (angle: number) => {
    const normalizedAngle = (angle + 90) / 360; // Adjust for starting from top
    return min + normalizedAngle * (max - min);
  };

  const getCoordinatesFromAngle = (angle: number) => {
    const radian = (angle * Math.PI) / 180;
    return {
      x: center + radius * Math.cos(radian),
      y: center + radius * Math.sin(radian)
    };
  };

  const handleMouseDown = (handle: 'min' | 'max') => (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(handle);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging || !svgRef.current) return;

    const rect = svgRef.current.getBoundingClientRect();
    const centerX = rect.left + center;
    const centerY = rect.top + center;
    
    const angle = Math.atan2(e.clientY - centerY, e.clientX - centerX) * 180 / Math.PI;
    let newValue = angleToValue(angle);
    
    // Clamp to min/max and apply step
    newValue = Math.max(min, Math.min(max, newValue));
    newValue = Math.round(newValue / step) * step;

    const newRangeValue: [number, number] = [...rangeValue];
    
    if (isDragging === 'min') {
      newRangeValue[0] = Math.min(newValue, rangeValue[1]);
    } else {
      newRangeValue[1] = Math.max(newValue, rangeValue[0]);
    }

    setRangeValue(newRangeValue);
    handleRangeChange(newRangeValue);
  };

  const handleMouseUp = () => {
    setIsDragging(null);
  };

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, rangeValue]);

  const handleRangeChange = (newValue: [number, number]) => {
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
      onChange(field, `between:${newValue[0]},${newValue[1]}`);
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
      const [minVal, maxVal] = val.slice(8).split(",");
      return `${formatValue(Number(minVal))} - ${formatValue(Number(maxVal))}`;
    }
    return formatValue(Number(val));
  };

  const minAngle = valueToAngle(rangeValue[0]);
  const maxAngle = valueToAngle(rangeValue[1]);
  const minCoords = getCoordinatesFromAngle(minAngle);
  const maxCoords = getCoordinatesFromAngle(maxAngle);

  // Calculate arc path
  const largeArcFlag = maxAngle - minAngle > 180 ? 1 : 0;
  const arcPath = `M ${minCoords.x} ${minCoords.y} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${maxCoords.x} ${maxCoords.y}`;

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

      <div className="flex flex-col items-center">
        <svg
          ref={svgRef}
          width={center * 2}
          height={center * 2}
          className="cursor-pointer"
        >
          {/* Background circle */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            className="text-muted stroke-opacity-20"
          />
          
          {/* Active range arc */}
          <path
            d={arcPath}
            fill="none"
            stroke="hsl(var(--primary))"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
          
          {/* Min handle */}
          <circle
            cx={minCoords.x}
            cy={minCoords.y}
            r={8}
            fill="hsl(var(--primary))"
            stroke="white"
            strokeWidth={2}
            className="cursor-grab active:cursor-grabbing"
            onMouseDown={handleMouseDown('min')}
          />
          
          {/* Max handle */}
          <circle
            cx={maxCoords.x}
            cy={maxCoords.y}
            r={8}
            fill="hsl(var(--primary))"
            stroke="white"
            strokeWidth={2}
            className="cursor-grab active:cursor-grabbing"
            onMouseDown={handleMouseDown('max')}
          />
          
          {/* Center text */}
          <text
            x={center}
            y={center - 5}
            textAnchor="middle"
            className="text-xs fill-current font-medium"
          >
            {formatValue(rangeValue[0])}
          </text>
          <text
            x={center}
            y={center + 10}
            textAnchor="middle"
            className="text-xs fill-current font-medium"
          >
            {formatValue(rangeValue[1])}
          </text>
        </svg>
        
        <div className="text-xs text-muted-foreground mt-2 text-center">
          Range: {formatValue(min)} - {formatValue(max)}
        </div>
      </div>
    </div>
  );
}
