'use client';

import * as React from 'react';
import { motion, type HTMLMotionProps } from 'motion/react';

interface LiquidButtonProps extends Omit<HTMLMotionProps<'button'>, 'style'> {
  delay?: number;
  fillHeight?: string;
  hoverScale?: number;
  tapScale?: number;
}

function LiquidButton({
  children,
  delay = 0,
  fillHeight = '3px',
  hoverScale = 1.05,
  tapScale = 0.95,
  className,
  ...props
}: LiquidButtonProps) {
  const [isHovered, setIsHovered] = React.useState(false);

  return (
    <motion.button
      className={className}
      style={{
        position: 'relative',
        overflow: 'hidden',
      }}
      whileHover={{ scale: hoverScale }}
      whileTap={{ scale: tapScale }}
      transition={{ duration: 0.2 }}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      {...props}
    >
      <motion.span
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: 'var(--liquid-button-background-color, currentColor)',
          zIndex: 0,
        }}
        initial={{ height: fillHeight }}
        animate={{ height: isHovered ? '100%' : fillHeight }}
        transition={{ duration: 0.3, delay: isHovered ? delay : 0 }}
      />
      <span 
        style={{ 
          position: 'relative', 
          zIndex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 'inherit',
        }}
      >
        {children as React.ReactNode}
      </span>
    </motion.button>
  );
}

export { LiquidButton, type LiquidButtonProps };

