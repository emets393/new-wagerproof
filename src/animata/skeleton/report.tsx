import React from "react";
import { cn } from "@/lib/utils";
import { FileText } from "lucide-react";

interface ReportProps {
  className?: string;
}

export default function Report({ className }: ReportProps) {
  return (
    <div className={cn("w-40 h-24 bg-white rounded-lg shadow-sm border border-gray-200 flex items-center justify-center", className)}>
      <FileText className="w-8 h-8 text-gray-400" />
    </div>
  );
}