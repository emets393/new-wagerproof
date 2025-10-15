"use client";

import React from "react";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/contexts/ThemeContext";

interface ThemeToggleProps {
  className?: string;
}

export function ThemeToggle({ className }: ThemeToggleProps) {
  const { theme, toggleTheme: contextToggleTheme } = useTheme();

  const handleToggle = async (e: React.MouseEvent<HTMLButtonElement>) => {
    // Get click position for circular transition
    const x = e.clientX;
    const y = e.clientY;
    
    // Calculate the maximum radius needed to cover the entire screen
    const endRadius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y)
    );

    // Check if browser supports View Transitions API
    if (!document.startViewTransition) {
      // Fallback for browsers that don't support View Transitions
      contextToggleTheme();
      return;
    }

    // Store the current theme BEFORE toggling
    const isDark = theme === "dark";

    // Use View Transitions API for smooth circular transition
    const transition = document.startViewTransition(() => {
      contextToggleTheme();
    });

    // Wait for the transition to be ready
    await transition.ready;

    // Animate the circular reveal
    const clipPath = [
      `circle(0px at ${x}px ${y}px)`,
      `circle(${endRadius}px at ${x}px ${y}px)`,
    ];

    // When going from dark to light, expand the new light theme
    // When going from light to dark, expand the new dark theme
    document.documentElement.animate(
      {
        clipPath: clipPath,
      },
      {
        duration: 500,
        easing: "ease-in-out",
        pseudoElement: "::view-transition-new(root)",
      }
    );
  };

  return (
    <button
      onClick={handleToggle}
      className={cn(
        "relative inline-flex h-8 w-8 items-center justify-center rounded-full",
        "transition-all duration-500",
        "hover:shadow-md focus:outline-none",
        "select-none touch-manipulation",
        "group",
        className
      )}
      style={{
        WebkitTapHighlightColor: 'transparent',
        WebkitUserSelect: 'none',
        MozUserSelect: 'none',
        msUserSelect: 'none',
        userSelect: 'none'
      }}
      aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
      title="Toggle theme"
    >
      {/* Icon Container */}
      <div className="relative z-10 flex items-center justify-center">
        {/* Sun Icon */}
        <Sun
          className={cn(
            "h-4 w-4 rotate-0 scale-100 transition-all duration-500",
            theme === "dark" && "rotate-90 scale-0",
            "text-yellow-600 dark:text-yellow-400",
            theme === "dark" && "absolute"
          )}
        />

        {/* Moon Icon */}
        <Moon
          className={cn(
            "h-4 w-4 rotate-90 scale-0 transition-all duration-500",
            theme === "dark" && "rotate-0 scale-100",
            "text-slate-700 dark:text-slate-200",
            theme === "light" && "absolute"
          )}
        />
      </div>

      {/* Hover effect ring */}
      <span
        className={cn(
          "absolute inset-0 rounded-full",
          "bg-gradient-to-tr transition-opacity duration-500",
          theme === "light"
            ? "from-honeydew-400/0 to-honeydew-600/0 group-hover:from-honeydew-400/15 group-hover:to-honeydew-600/15"
            : "from-honeydew-300/0 to-honeydew-500/0 group-hover:from-honeydew-300/15 group-hover:to-honeydew-500/15"
        )}
      />

      {/* Pulse animation on hover */}
      <span
        className={cn(
          "absolute inset-0 rounded-full animate-ping",
          "bg-gradient-to-tr opacity-0 group-hover:opacity-10",
          theme === "light"
            ? "from-honeydew-400 to-honeydew-600"
            : "from-honeydew-300 to-honeydew-500",
          "pointer-events-none"
        )}
      />
      <span className="sr-only">Toggle theme</span>
    </button>
  );
}

