import * as React from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import type { NflPropPlayerPage } from '../types';
import { resolveWhoHeIsTiles, tileBadge } from '../whoHeIsStats';
import { CLUSTER_TIPS } from '../statTips';
import { ClusterCard } from './ClusterCard';
import { StatTip } from './StatTip';

/** Legacy orbit cluster — same locked tile map as WhoHeIsSection. */
export function WhoHeIsCluster({
  page,
  marketKey,
  glow,
  className,
}: {
  page: NflPropPlayerPage;
  marketKey: string;
  glow?: 'up' | 'down' | null;
  className?: string;
}) {
  const baseline = page.baseline;
  const { headline, more } = resolveWhoHeIsTiles(page, marketKey);
  const [open, setOpen] = React.useState(false);

  if (!baseline) {
    return (
      <ClusterCard
        title="Who he is"
        titleExtra={<StatTip tip={CLUSTER_TIPS.who} />}
        empty
        emptyMessage="No NFL sample yet · 2026 rookie"
        glow={glow}
        className={className}
        dense
      />
    );
  }

  return (
    <ClusterCard
      title="Who he is"
      titleExtra={<StatTip tip={CLUSTER_TIPS.who} />}
      glow={glow}
      className={className}
      dense
    >
      <div className="mb-2 text-[11px] text-muted-foreground">
        {baseline.season} · {baseline.games} g
      </div>
      {headline.length === 0 ? (
        <p className="text-[13px] text-muted-foreground">No baseline stats for this market.</p>
      ) : (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            {headline.map((tile) => {
              const badge = tileBadge(tile);
              return (
                <div
                  key={tile.key}
                  className="rounded-xl border border-black/5 bg-muted/40 px-2.5 py-2 dark:border-white/10"
                >
                  <div className="flex items-center gap-0.5 text-[9px] font-bold uppercase tracking-wide text-muted-foreground">
                    {tile.tip ? <StatTip tip={tile.tip} label={tile.label} /> : tile.label}
                  </div>
                  <div className="font-mono text-lg font-bold leading-tight">{tile.display}</div>
                  {badge && (
                    <div className="mt-0.5 text-[10px] font-semibold text-muted-foreground">{badge}</div>
                  )}
                </div>
              );
            })}
          </div>
          {more.length > 0 && (
            <Collapsible open={open} onOpenChange={setOpen}>
              <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg px-1 py-1.5 text-[11px] font-bold text-muted-foreground">
                More stats
                <ChevronDown
                  className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-180')}
                />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="grid grid-cols-2 gap-2 pt-1">
                  {more.map((tile) => {
                    const badge = tileBadge(tile);
                    return (
                      <div
                        key={tile.key}
                        className="rounded-xl border border-black/5 bg-muted/40 px-2.5 py-2 dark:border-white/10"
                      >
                        <div className="flex items-center gap-0.5 text-[9px] font-bold uppercase tracking-wide text-muted-foreground">
                          {tile.tip ? <StatTip tip={tile.tip} label={tile.label} /> : tile.label}
                        </div>
                        <div className="font-mono text-lg font-bold leading-tight">{tile.display}</div>
                        {badge && (
                          <div className="mt-0.5 text-[10px] font-semibold text-muted-foreground">
                            {badge}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}
        </div>
      )}
    </ClusterCard>
  );
}
