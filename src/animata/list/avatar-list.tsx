import React from "react";
import { cn } from "@/lib/utils";

interface AvatarListProps {
  size?: "sm" | "md";
  className?: string;
}

export default function AvatarList({ size = "sm", className }: AvatarListProps) {
  const avatars = [
    "/lovable-uploads/8a000537-7973-40d2-ba62-5436a3e070fc.png",
    "/lovable-uploads/12547965-6873-4a5b-bf55-0089ced2142f.png",
    "/lovable-uploads/a6513e7c-1c85-4430-b1a2-02ca70bfe99c.png",
    "/lovable-uploads/13d1c2fe-0ec6-494c-81ae-edb70c8c8b34.png"
  ];

  return (
    <div className={cn("flex -space-x-2", className)}>
      {avatars.map((avatar, idx) => (
        <div
          key={idx}
          className={cn(
            "rounded-full border-2 border-white bg-gray-200 flex items-center justify-center",
            size === "sm" ? "w-8 h-8" : "w-10 h-10"
          )}
        >
          <img src={avatar} alt="User" className="w-full h-full rounded-full object-cover" />
        </div>
      ))}
    </div>
  );
}