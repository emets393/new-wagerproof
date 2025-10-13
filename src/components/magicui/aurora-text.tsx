import React from "react";
import { cn } from "@/lib/utils";

interface AuroraTextProps {
  className?: string;
  children: React.ReactNode;
  colors?: string[];
  speed?: number;
}

const AuroraText: React.FC<AuroraTextProps> = ({
  className,
  children,
  colors = ["#11d907", "#4f9777", "#3d7a61", "#11d907"],
  speed = 1,
}) => {
  const gradientStyle = {
    background: `linear-gradient(-45deg, ${colors.join(", ")})`,
    backgroundSize: "400% 400%",
    backgroundClip: "text",
    WebkitBackgroundClip: "text",
    color: "transparent",
    animation: `aurora ${8 / speed}s ease-in-out infinite alternate`,
  };

  return (
    <span
      className={cn("font-bold", className)}
      style={gradientStyle}
    >
      {children}
    </span>
  );
};

export { AuroraText };