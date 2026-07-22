import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Entry banner that opens the Systems Leaderboard from Historical Trends. */
export function SystemsLeaderboardBanner({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group flex w-full items-center gap-3.5 overflow-hidden rounded-2xl border border-amber-500/20',
        'bg-gradient-to-br from-amber-50 via-amber-50/80 to-orange-50/90 px-4 py-3.5 text-left',
        'shadow-[0_1px_0_rgba(245,158,11,0.12)] transition-all duration-200',
        'hover:border-amber-500/35 hover:shadow-md hover:shadow-amber-500/10 active:scale-[0.99]',
        'dark:border-amber-400/15 dark:from-amber-950/40 dark:via-amber-950/25 dark:to-orange-950/30',
      )}
    >
      <span
        className={cn(
          'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl',
          'bg-gradient-to-br from-amber-400 to-amber-600 text-[22px] shadow-sm shadow-amber-600/25',
        )}
      >
        🏆
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[16px] font-bold tracking-tight text-foreground">
          Systems Leaderboard
        </span>
        <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">
          The most profitable systems users have shared
        </span>
      </span>
      <ChevronRight className="h-6 w-6 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </button>
  );
}
