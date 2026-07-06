import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Skeleton primitives matching the iOS shimmer system: shape blocks filled with
 * a muted surface swept by a 1.4s diagonal shimmer (`.ios-skeleton` in index.css).
 * Compose them into layouts mirroring the real card they stand in for.
 */

export function SkeletonBlock({
  width,
  height,
  radius = 6,
  className,
}: {
  width?: number | string;
  height?: number | string;
  radius?: number;
  className?: string;
}) {
  return (
    <div
      className={cn('ios-skeleton', className)}
      style={{ width, height, borderRadius: radius }}
    />
  );
}

export function SkeletonCircle({
  diameter,
  className,
}: {
  diameter: number;
  className?: string;
}) {
  return (
    <div
      className={cn('ios-skeleton rounded-full', className)}
      style={{ width: diameter, height: diameter }}
    />
  );
}

export function SkeletonCapsule({
  width,
  height,
  className,
}: {
  width?: number | string;
  height: number | string;
  className?: string;
}) {
  return (
    <div
      className={cn('ios-skeleton rounded-full', className)}
      style={{ width, height }}
    />
  );
}
