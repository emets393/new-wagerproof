import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { mlbHeadshotUrl } from '@/utils/mlbPitcherMatchups';

interface HeadshotProps {
  playerId: number | null | undefined;
  /** CSS pixel render size — we request 3× that from MLB so retina stays sharp. */
  size?: number;
  alt: string;
  className?: string;
}

export function Headshot({ playerId, size = 48, alt, className }: HeadshotProps) {
  const [errored, setErrored] = useState(false);
  const id = playerId != null ? Math.trunc(Number(playerId)) : 0;
  const valid = Number.isFinite(id) && id > 0;
  // Request 3× the display size so retina (and zoomed-in) screens stay crisp.
  const cdnWidth = Math.min(420, Math.max(120, Math.round(size * 3)));
  const style = { width: size, height: size };

  if (errored || !valid) {
    return (
      <div
        className={cn('rounded-full bg-muted border-2 border-border shrink-0', className)}
        style={style}
        aria-label={alt}
        role="img"
      />
    );
  }

  return (
    <img
      key={`${id}-${cdnWidth}`}
      src={mlbHeadshotUrl(id, cdnWidth as 60 | 213)}
      alt={alt}
      width={size}
      height={size}
      className={cn('rounded-full object-cover border-2 border-background shrink-0', className)}
      style={style}
      onError={() => setErrored(true)}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
    />
  );
}
