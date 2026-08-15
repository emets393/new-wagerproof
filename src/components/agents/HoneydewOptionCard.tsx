import * as React from 'react';
import {
  AlertTriangle,
  Check,
  Flag,
  Hand,
  HelpCircle,
  Inbox,
  Mail,
  MessageCircle,
  MessageSquare,
  MessagesSquare,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const DEFAULT_ICONS = [
  MessageSquare,
  AlertTriangle,
  HelpCircle,
  MessagesSquare,
  Hand,
  Flag,
  Inbox,
  Mail,
  Check,
  MessageCircle,
];

const LANES = [
  { y: 16, size: 18, rotate: -14, opacity: 0.72 },
  { y: 78, size: 23, rotate: 22, opacity: 0.78 },
  { y: 32, size: 21, rotate: -8, opacity: 0.76 },
  { y: 92, size: 16, rotate: 6, opacity: 0.74 },
  { y: 20, size: 25, rotate: 18, opacity: 0.82 },
  { y: 62, size: 18, rotate: -26, opacity: 0.80 },
  { y: 38, size: 21, rotate: 10, opacity: 0.80 },
  { y: 85, size: 23, rotate: -14, opacity: 0.85 },
  { y: 50, size: 16, rotate: 4, opacity: 0.75 },
  { y: 55, size: 14, rotate: -32, opacity: 0.70 },
];

export interface HoneydewOptionCardProps {
  title: string;
  subtitle: string;
  actionWord: string;
  primaryColor: string;
  secondaryColor: string;
  onClick: () => void;
  className?: string;
}

/**
 * Web port of Honeydew / WagerProof iOS `HoneydewOptionCard`: two-stop
 * horizontal gradient, drifting decorative icons, left-edge fade, white
 * title + subtitle, and a glass action pill.
 */
export function HoneydewOptionCard({
  title,
  subtitle,
  actionWord,
  primaryColor,
  secondaryColor,
  onClick,
  className,
}: HoneydewOptionCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'relative isolate flex min-h-16 w-full overflow-hidden rounded-[23px] text-left shadow-[0_3px_8px_rgba(0,0,0,0.10),0_1px_2px_rgba(0,0,0,0.04)]',
        className,
      )}
      style={{
        background: `linear-gradient(90deg, ${primaryColor} 0%, ${secondaryColor} 100%)`,
      }}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        {DEFAULT_ICONS.map((Icon, i) => {
          const lane = LANES[i];
          return (
            <span
              key={i}
              className="absolute motion-safe:animate-option-card-drift"
              style={{
                top: `${lane.y}%`,
                left: `${48 + ((i * 7) % 42)}%`,
                opacity: lane.opacity,
                color: primaryColor,
                animationDelay: `${-i * 1.6}s`,
              }}
            >
              <Icon
                style={{
                  width: lane.size,
                  height: lane.size,
                  transform: `rotate(${lane.rotate}deg)`,
                }}
              />
            </span>
          );
        })}
      </span>
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background: `linear-gradient(90deg, ${primaryColor} 0%, transparent 100%)`,
        }}
      />
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-[23px] ring-1 ring-inset ring-white/12"
      />

      <span className="relative z-10 flex w-full items-center gap-3 px-4 py-2.5">
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[17px] font-bold leading-tight text-white [text-shadow:0_1px_1px_rgba(0,0,0,0.12)]">
            {title}
          </span>
          <span className="block truncate text-[13px] font-medium leading-tight text-white/95 [text-shadow:0_1px_1px_rgba(0,0,0,0.08)]">
            {subtitle}
          </span>
        </span>
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-white/30 bg-white/75 px-3 py-1.5 text-[13px] font-semibold text-neutral-900 shadow-[0_1px_4px_rgba(0,0,0,0.18)] backdrop-blur-md">
          {actionWord}
          <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" aria-hidden>
            <path
              d="M4.2 2.4 8 6 4.2 9.6"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </span>
    </button>
  );
}
