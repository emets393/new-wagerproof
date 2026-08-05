import * as React from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import type { NflPropPlayerPage } from '../types';
import { resolveWhoHeIsTiles, tileBadge, type WhoHeIsTile } from '../whoHeIsStats';
import { StatTip } from './StatTip';

function StatTile({ tile }: { tile: WhoHeIsTile }) {
  const badge = tileBadge(tile);
  return (
    <div className="rounded-xl border border-black/5 bg-muted/30 px-3 py-2.5 dark:border-white/10">
      <div className="flex items-center gap-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
        {tile.tip ? <StatTip tip={tile.tip} label={tile.label} /> : tile.label}
      </div>
      <div className="mt-1 font-mono text-[22px] font-bold leading-none">{tile.display}</div>
      {badge && (
        <div
          className={cn(
            'mt-1 text-[11px] font-semibold',
            !tile.descriptive && tile.pctile != null && tile.pctile >= 70
              ? 'text-emerald-700 dark:text-emerald-300'
              : !tile.descriptive && tile.pctile != null && tile.pctile <= 30
                ? 'text-rose-700 dark:text-rose-300'
                : 'text-muted-foreground'
          )}
        >
          {badge}
        </div>
      )}
    </div>
  );
}

/** Locked 4-headline + More stats expander for the WHO HE IS card. */
export function WhoHeIsSection({
  page,
  marketKey,
}: {
  page: NflPropPlayerPage;
  marketKey: string;
}) {
  const baseline = page.baseline;
  const { headline, more } = resolveWhoHeIsTiles(page, marketKey);
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    setOpen(false);
  }, [marketKey, page.player_id]);

  if (!baseline) {
    return <p className="mt-3 text-[13px] text-muted-foreground">No NFL sample yet · 2026 rookie</p>;
  }

  if (headline.length === 0) {
    return (
      <p className="mt-3 text-[13px] text-muted-foreground">No baseline stats for this market.</p>
    );
  }

  return (
    <div className="mt-3 space-y-2">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {headline.map((tile) => (
          <StatTile key={tile.key} tile={tile} />
        ))}
      </div>

      {more.length > 0 && (
        <Collapsible open={open} onOpenChange={setOpen}>
          <CollapsibleTrigger className="flex w-full items-center justify-between rounded-xl border border-black/5 bg-muted/20 px-3 py-2 text-left text-[12px] font-bold text-muted-foreground transition-colors hover:bg-muted/40 dark:border-white/10">
            <span>More stats</span>
            <ChevronDown
              className={cn('h-4 w-4 transition-transform duration-200', open && 'rotate-180')}
            />
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {more.map((tile) => (
                <StatTile key={tile.key} tile={tile} />
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}
