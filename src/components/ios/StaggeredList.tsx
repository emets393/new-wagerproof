import * as React from 'react';
import { motion, useReducedMotion } from 'framer-motion';

// Mirrors iOS .staggeredAppear: 40ms/item delay, capped so only the first
// screenful visibly cascades.
const DELAY_PER_ITEM = 0.04;
const MAX_STAGGERED = 6;

/**
 * Wrap each list item: fades in with a 12px lift, staggered by index.
 */
export function StaggeredItem({
  index,
  children,
  className,
}: {
  index: number;
  children: React.ReactNode;
  className?: string;
}) {
  const reduceMotion = useReducedMotion();
  if (reduceMotion) return <div className={className}>{children}</div>;

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        type: 'spring',
        duration: 0.42,
        bounce: 0.15,
        delay: Math.min(index, MAX_STAGGERED) * DELAY_PER_ITEM,
      }}
    >
      {children}
    </motion.div>
  );
}
