"use client";

import React, { CSSProperties } from "react";
import { cn } from "@/lib/utils";

type ShineBorderProps = {
  borderRadius?: number;
  borderWidth?: number;
  duration?: number;
  color?: string | string[];
  className?: string;
  children: React.ReactNode;
};

/**
 * @name Shine Border
 * @description It is an animated background border effect component with easy to use and configurable props.
 * @param borderRadius defines the radius of the border.
 * @param borderWidth defines the width of the border.
 * @param duration defines the animation duration to be applied on the shining border.
 * @param color a string or string array to define border color.
 * @param className defines the class name to be applied to the component.
 * @param children contains react node elements.
 */
export default function ShineBorder({
  borderRadius = 8,
  borderWidth = 1,
  duration = 14,
  color = "#000000",
  className,
  children,
}: ShineBorderProps) {
  return (
    <div
      style={
        {
          "--border-radius": `${borderRadius}px`,
        } as CSSProperties
      }
      className={cn(
        // grid-cols-[minmax(0,1fr)] pins the inner track to the container width — without it,
        // the implicit grid track auto-sizes to min-content and oversized children (wide MLB
        // card panels) spill past the ShineBorder, overlapping neighbors in the page grid.
        // overflow-hidden is belt-and-suspenders to clip the rounded corners cleanly.
        "relative grid grid-cols-[minmax(0,1fr)] overflow-hidden min-h-[60px] w-full min-w-0 place-items-center rounded-[--border-radius] bg-white p-0 text-black dark:bg-black dark:text-white",
        className,
      )}
    >
      <div
        style={
          {
            "--border-width": `${borderWidth}px`,
            "--border-radius": `${borderRadius}px`,
            "--duration": `${duration}s`,
            "--mask-linear-gradient": `linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)`,
            "--background-radial-gradient": `radial-gradient(transparent,transparent, ${color instanceof Array ? color.join(",") : color},transparent,transparent)`,
          } as CSSProperties
        }
        className={`before:bg-shine-size before:absolute before:inset-[0] before:aspect-square before:size-full before:rounded-[--border-radius] before:p-[--border-width] before:will-change-[background-position] before:content-[""] before:![-webkit-mask-composite:xor] before:[background-image:--background-radial-gradient] before:[background-size:300%_300%] before:[mask-composite:exclude] before:[mask:--mask-linear-gradient] motion-safe:before:[animation:shine_var(--duration)_infinite_linear]`}
      />
      {children}
    </div>
  );
}

export { ShineBorder };