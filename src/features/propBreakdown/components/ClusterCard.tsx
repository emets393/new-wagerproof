import { cn } from '@/lib/utils';
import { GlassCard } from '@/components/ios';

export function ClusterCard({
  title,
  titleExtra,
  children,
  glow,
  className,
  empty,
  emptyMessage,
  dense = false,
}: {
  title: string;
  titleExtra?: React.ReactNode;
  children?: React.ReactNode;
  glow?: 'up' | 'down' | null;
  className?: string;
  empty?: boolean;
  emptyMessage?: string;
  /** Tighter padding only — keep type readable. */
  dense?: boolean;
}) {
  return (
    <GlassCard
      radius={18}
      className={cn(
        'relative transition-[box-shadow,border-color] duration-300',
        dense ? 'p-3' : 'p-3.5',
        glow === 'up' &&
          'border-emerald-500/50 shadow-[0_0_22px_rgba(16,185,129,0.24)] dark:border-emerald-400/40',
        glow === 'down' &&
          'border-rose-500/50 shadow-[0_0_22px_rgba(244,63,94,0.24)] dark:border-rose-400/40',
        className
      )}
    >
      <div className="mb-2.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
        <span>{title}</span>
        {titleExtra}
      </div>
      {empty ? (
        <p className="text-[13px] leading-snug text-muted-foreground">
          {emptyMessage ?? 'Not enough sample yet.'}
        </p>
      ) : (
        children
      )}
    </GlassCard>
  );
}
