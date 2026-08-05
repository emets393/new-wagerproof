import type { DefenseDim, NflPropPlayerPage } from '../types';
import { DEFENSE_LABELS, contentMapForMarket, type DefenseKey } from '../marketMap';
import { ALL_DEFENSE_KEYS, CLUSTER_TIPS, DEFENSE_TIPS } from '../statTips';
import { ClusterCard } from './ClusterCard';
import { PctileBar } from './PctileBar';
import { StatTip } from './StatTip';

function isDim(v: unknown): v is DefenseDim {
  return Boolean(v) && typeof v === 'object' && 'rate' in (v as object) && 'pctile' in (v as object);
}

export function DefenseCluster({
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
  const defense = page.scheme?.defense;
  if (!defense) {
    return null;
  }

  const focus = new Set(contentMapForMarket(marketKey).defense);
  // Full served profile — never invent missing keys (e.g. zone if absent).
  const dims = ALL_DEFENSE_KEYS.map((key) => {
    const raw = defense[key];
    if (!isDim(raw)) return null;
    return {
      key,
      label: DEFENSE_LABELS[key as DefenseKey] ?? key,
      rate: raw.rate,
      pctile: raw.pctile,
      tip: DEFENSE_TIPS[key],
      emphasized: focus.has(key as DefenseKey),
    };
  }).filter(Boolean) as {
    key: string;
    label: string;
    rate: number;
    pctile: number;
    tip?: string;
    emphasized: boolean;
  }[];

  return (
    <ClusterCard
      title="Defense he faces"
      titleExtra={<StatTip tip={CLUSTER_TIPS.defense} />}
      glow={glow}
      className={className}
      dense
    >
      {defense.identity && (
        <div className="mb-2.5 inline-flex rounded-full border border-amber-500/40 bg-amber-500/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-amber-800 dark:text-amber-200">
          {defense.identity}
        </div>
      )}
      {dims.length === 0 ? (
        <p className="text-[13px] text-muted-foreground">No defense profile for this opponent.</p>
      ) : (
        <div className="space-y-2">
          {dims.map((d) => (
            <PctileBar
              key={d.key}
              label={d.label}
              rate={d.rate}
              pctile={d.pctile}
              tip={d.tip}
              emphasized={d.emphasized}
            />
          ))}
        </div>
      )}
      <p className="mt-2.5 text-[10px] leading-snug text-muted-foreground/80">
        Rate = share of snaps · %ile = league rank. Key = most relevant to this market.
      </p>
    </ClusterCard>
  );
}
