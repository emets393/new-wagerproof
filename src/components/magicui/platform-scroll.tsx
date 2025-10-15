import React, { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

interface PlatformScrollProps {
  platforms: string[];
  speed?: number;
  className?: string;
}

export const PlatformScroll: React.FC<PlatformScrollProps> = ({
  platforms,
  speed = 30,
  className
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const scrollContainer = scrollRef.current;
    const scrollContent = contentRef.current;
    
    if (!scrollContainer || !scrollContent) return;

    let animationId: number;
    let scrollPos = 0;

    const animate = () => {
      scrollPos -= 1;
      
      // Reset when first set scrolls out of view
      if (Math.abs(scrollPos) >= scrollContent.offsetWidth / 2) {
        scrollPos = 0;
      }
      
      scrollContent.style.transform = `translateX(${scrollPos}px)`;
      animationId = requestAnimationFrame(animate);
    };

    // Start animation after a brief delay
    const timeoutId = setTimeout(() => {
      animationId = requestAnimationFrame(animate);
    }, 100);

    return () => {
      clearTimeout(timeoutId);
      cancelAnimationFrame(animationId);
    };
  }, [speed]);

  // Double the platforms for seamless loop
  const duplicatedPlatforms = [...platforms, ...platforms];

  return (
    <div 
      ref={scrollRef}
      className={cn(
        "overflow-hidden whitespace-nowrap",
        className
      )}
    >
      <div 
        ref={contentRef}
        className="inline-flex gap-2"
      >
        {duplicatedPlatforms.map((platform, index) => (
          <span
            key={`${platform}-${index}`}
            className="inline-block px-2 py-0.5 bg-pink-500/20 dark:bg-pink-400/20 rounded-full text-xs font-medium text-pink-800 dark:text-pink-200"
          >
            {platform}
          </span>
        ))}
      </div>
    </div>
  );
};