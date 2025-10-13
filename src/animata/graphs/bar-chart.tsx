import React from "react";
import { cn } from "@/lib/utils";

interface BarChartItem {
  progress: number;
  label: string;
  className?: string;
}

interface BarChartProps {
  items: BarChartItem[];
  height?: number;
}

export default function BarChart({ items, height = 100 }: BarChartProps) {
  return (
    <div className="flex items-end justify-between gap-1" style={{ height }}>
      {items.map((item, idx) => (
        <div key={idx} className="flex flex-col items-center gap-1">
          <div
            className={cn("w-4 transition-all duration-1000", item.className)}
            style={{
              height: `${item.progress}%`,
              minHeight: '4px'
            }}
          />
          <span className="text-xs text-gray-600">{item.label}</span>
        </div>
      ))}
    </div>
  );
}