import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { mlbHeadshotUrl } from '@/utils/mlbPitcherMatchups';

interface HeadshotProps {
  playerId: number | null | undefined;
  size?: 60 | 213;
  alt: string;
  className?: string;
}

export function Headshot({ playerId, size = 60, alt, className }: HeadshotProps) {
  const [errored, setErrored] = useState(false);
  const dim = size === 60 ? 'h-12 w-12' : 'h-32 w-32';
  const id = playerId != null ? Math.trunc(Number(playerId)) : 0;
  const valid = Number.isFinite(id) && id > 0;

  if (errored || !valid) {
    return (
      <div
        className={cn('rounded-full bg-muted border-2 border-border shrink-0', dim, className)}
        aria-label={alt}
        role="img"
      />
    );
  }

  return (
    <img
      key={id}
      src={mlbHeadshotUrl(id, size)}
      alt={alt}
      className={cn('rounded-full object-cover border-2 border-background shrink-0', dim, className)}
      onError={() => setErrored(true)}
      loading="lazy"
      referrerPolicy="no-referrer"
    />
  );
}
