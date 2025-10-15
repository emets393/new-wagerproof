import React from "react";
import { cn } from "@/lib/utils";
import { Calendar } from "lucide-react";

interface WideCardProps {
  className?: string;
}

export default function WideCard({ className }: WideCardProps) {
  return (
    <div className={cn("w-full h-24 bg-white rounded-lg shadow-sm border border-gray-200 flex items-center justify-center mb-4", className)}>
      <Calendar className="w-8 h-8 text-blue-500" />
    </div>
  );
}