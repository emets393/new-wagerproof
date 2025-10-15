"use client";

import React, { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

import { cn } from "@/lib/utils";

export interface AnimatedListProps {
  className?: string;
  children: React.ReactNode;
  delay?: number;
  itemsToShow?: number;
}

export const AnimatedList = React.memo(
  ({ className, children, delay = 1000, itemsToShow = 3 }: AnimatedListProps) => {
    const [visibleItems, setVisibleItems] = useState<number[]>([]);
    const childrenArray = React.Children.toArray(children);

    useEffect(() => {
      // Initialize with first items
      if (visibleItems.length === 0) {
        setVisibleItems(Array.from({ length: Math.min(itemsToShow, childrenArray.length) }, (_, i) => i));
        return;
      }

      const interval = setInterval(() => {
        setVisibleItems((prev) => {
          const newItems = [...prev];
          // Remove the oldest item and add a new one
          newItems.shift();
          const nextIndex = (prev[prev.length - 1] + 1) % childrenArray.length;
          newItems.push(nextIndex);
          return newItems;
        });
      }, delay);

      return () => clearInterval(interval);
    }, [childrenArray.length, delay, itemsToShow, visibleItems.length]);

    return (
      <div
        className={cn(
          "flex flex-col gap-1 relative",
          className
        )}
        style={{ minHeight: `${itemsToShow * 40}px` }}
      >
        <AnimatePresence mode="popLayout">
          {visibleItems.map((itemIndex, position) => (
            <AnimatedListItem key={itemIndex} position={position}>
              {childrenArray[itemIndex]}
            </AnimatedListItem>
          ))}
        </AnimatePresence>
      </div>
    );
  }
);

AnimatedList.displayName = "AnimatedList";

export function AnimatedListItem({ children, position }: { children: React.ReactNode; position: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -20, scale: 0.9 }}
      animate={{ 
        opacity: 1, 
        y: position * 36, 
        scale: 1,
        transition: {
          type: "spring",
          stiffness: 350,
          damping: 25,
        }
      }}
      exit={{ 
        opacity: 0, 
        scale: 0.8,
        transition: { duration: 0.2 }
      }}
      className="absolute w-full"
      style={{ position: 'absolute', top: 0 }}
    >
      {children}
    </motion.div>
  );
}