import { Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

/** Compact info affordance — hover/tap for a plain-English definition. */
export function StatTip({
  tip,
  label,
  className,
}: {
  tip: string;
  label?: string;
  className?: string;
}) {
  return (
    <Tooltip delayDuration={200}>
      <TooltipTrigger asChild>
        <button
          type="button"
          className={cn(
            'inline-flex items-center gap-0.5 rounded-sm text-muted-foreground/80 hover:text-foreground',
            className
          )}
          aria-label={label ? `What is ${label}?` : 'What does this mean?'}
        >
          {label && <span>{label}</span>}
          <Info className="h-3.5 w-3.5 shrink-0 opacity-70" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[240px] text-[12px] leading-snug">
        {tip}
      </TooltipContent>
    </Tooltip>
  );
}
