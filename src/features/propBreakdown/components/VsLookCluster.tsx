import type { NflPropPlayerPage, PlayerCoverageSplit } from '../types';
import { COVERAGE_LABELS, contentMapForMarket, type CoverageKey } from '../marketMap';
import { formatPerGame, topBadge } from '../format';
import { CLUSTER_TIPS, COVERAGE_TIPS } from '../statTips';
import { ClusterCard } from './ClusterCard';
import { StatTip } from './StatTip';

function isReceivingSplit(v: unknown): v is PlayerCoverageSplit {
  return (
    Boolean(v) &&
    typeof v === 'object' &&
    'ypt' in (v as object) &&
    'targets' in (v as object) &&
    (v as PlayerCoverageSplit).ypt != null &&
    ((v as PlayerCoverageSplit).targets ?? 0) >= 1
  );
}

/** Legacy orbit cluster — receiving ypt only. Prefer ComparisonBlock for the full layer. */
export function VsLookCluster({
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
  const map = contentMapForMarket(marketKey);
  if (map.coverage.length === 0) return null;

  const splits = page.scheme?.player_splits;
  if (!splits) {
    return (
      <ClusterCard
        title="Vs this look"
        titleExtra={<StatTip tip={CLUSTER_TIPS.look} />}
        empty
        emptyMessage="Not enough NFL sample vs this look yet."
        glow={glow}
        className={className}
        dense
      />
    );
  }

  const rows = map.coverage
    .map((key) => {
      const raw = splits[key as CoverageKey];
      if (!isReceivingSplit(raw)) return null;
      return {
        key,
        label: COVERAGE_LABELS[key as CoverageKey],
        ypt: raw.ypt as number,
        targets: raw.targets,
        pctile: raw.pctile,
        tip: COVERAGE_TIPS[key],
      };
    })
    .filter(Boolean) as {
    key: string;
    label: string;
    ypt: number;
    targets: number;
    pctile: number | null;
    tip?: string;
  }[];

  if (rows.length === 0) {
    return (
      <ClusterCard
        title="Vs this look"
        titleExtra={<StatTip tip={CLUSTER_TIPS.look} />}
        empty
        emptyMessage="Not enough NFL sample vs this look yet."
        glow={glow}
        className={className}
        dense
      />
    );
  }

  return (
    <ClusterCard
      title="Vs this look"
      titleExtra={<StatTip tip={CLUSTER_TIPS.look} />}
      glow={glow}
      className={className}
      dense
    >
      <div className="space-y-2">
        {rows.map((row) => (
          <div
            key={row.key}
            className="flex items-center justify-between gap-2.5 rounded-xl border border-black/5 bg-muted/40 px-2.5 py-2 dark:border-white/10"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                {row.tip ? <StatTip tip={row.tip} label={row.label} /> : row.label}
              </div>
              <div className="font-mono text-[14px] font-bold leading-tight">
                {formatPerGame(row.ypt, 1)} ypt
              </div>
              <div className="text-[10px] text-muted-foreground">{row.targets} tgt</div>
            </div>
            <span className="shrink-0 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold tracking-wide text-emerald-700 dark:text-emerald-300">
              {topBadge(row.pctile)}
            </span>
          </div>
        ))}
      </div>
    </ClusterCard>
  );
}
