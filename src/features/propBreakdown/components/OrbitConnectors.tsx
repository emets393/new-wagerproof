import { useId } from 'react';
import { cn } from '@/lib/utils';

/** Subtle SVG spokes — compact orbit. */
export function OrbitConnectors({ className }: { className?: string }) {
  const id = useId();
  return (
    <svg
      aria-hidden
      viewBox="0 0 1000 560"
      className={cn(
        'pointer-events-none absolute inset-0 h-full w-full opacity-35 motion-safe:animate-pulse dark:opacity-45',
        'motion-reduce:animate-none',
        className
      )}
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id={`${id}-g`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.05" />
          <stop offset="50%" stopColor="currentColor" stopOpacity="0.4" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.05" />
        </linearGradient>
      </defs>
      <path d="M500 280 C 420 230, 320 180, 200 120" fill="none" stroke={`url(#${id}-g)`} strokeWidth="1.25" />
      <path d="M500 280 C 580 230, 680 180, 800 120" fill="none" stroke={`url(#${id}-g)`} strokeWidth="1.25" />
      <path d="M500 280 C 420 330, 320 390, 200 450" fill="none" stroke={`url(#${id}-g)`} strokeWidth="1.25" />
      <path d="M500 280 C 580 330, 680 390, 800 450" fill="none" stroke={`url(#${id}-g)`} strokeWidth="1.25" />
      <circle cx="500" cy="280" r="3" className="fill-current opacity-40" />
    </svg>
  );
}
