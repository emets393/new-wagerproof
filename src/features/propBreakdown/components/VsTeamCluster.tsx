import type { NflPropPlayerTrends, TrendMatchupMarket } from '../types';
import { CLUSTER_TIPS } from '../statTips';
import { ClusterCard } from './ClusterCard';
import { StatTip } from './StatTip';

function isMarket(v: unknown): v is TrendMatchupMarket {
  return Boolean(v) && typeof v === 'object' && 'h' in (v as object) && 'n' in (v as object);
}

export function VsTeamCluster({
  trends,
  opponent,
  marketKey,
  marketLabel,
  glow,
  className,
}: {
  trends: NflPropPlayerTrends | null | undefined;
  opponent: string;
  marketKey: string;
  marketLabel: string;
  glow?: 'up' | 'down' | null;
  className?: string;
}) {
  const matchup = trends?.matchups?.[opponent];
  if (!matchup || typeof matchup.meetings !== 'number' || matchup.meetings < 2) {
    return (
      <ClusterCard
        title="Vs this team"
        titleExtra={<StatTip tip={CLUSTER_TIPS.team} />}
        glow={glow}
        className={className}
        dense
      >
        <div className="flex min-h-[88px] flex-col items-center justify-center rounded-xl border border-dashed border-black/10 bg-muted/20 px-3 text-center dark:border-white/10">
          <p className="text-[13px] font-semibold">No H2H sample yet</p>
          <p className="mt-1 text-[12px] text-muted-foreground">
            Needs 2+ career meetings vs {opponent}.
          </p>
        </div>
      </ClusterCard>
    );
  }

  const raw = matchup[marketKey];
  if (!isMarket(raw) || raw.n < 2) {
    return (
      <ClusterCard
        title="Vs this team"
        titleExtra={<StatTip tip={CLUSTER_TIPS.team} />}
        glow={glow}
        className={className}
        dense
      >
        <div className="flex min-h-[88px] flex-col items-center justify-center rounded-xl border border-dashed border-black/10 bg-muted/20 px-3 text-center dark:border-white/10">
          <p className="text-[13px] font-semibold">No {marketLabel.toLowerCase()} sample</p>
          <p className="mt-1 text-[12px] text-muted-foreground">
            Not enough graded lines vs {opponent}.
          </p>
        </div>
      </ClusterCard>
    );
  }

  const isTd = marketKey.includes('anytime_td') || marketKey.includes('pass_td');
  const verb = isTd ? 'scored' : 'over';

  return (
    <ClusterCard
      title="Vs this team"
      titleExtra={<StatTip tip={CLUSTER_TIPS.team} />}
      glow={glow}
      className={className}
      dense
    >
      <div className="flex min-h-[88px] flex-col justify-center">
        <div className="font-mono text-3xl font-black tracking-tight">
          {raw.h}
          <span className="text-muted-foreground">/{raw.n}</span>
        </div>
        <p className="mt-1 text-[13px] text-muted-foreground">
          {verb} vs {opponent}
          {typeof raw.pct === 'number' ? ` · ${Math.round(raw.pct * 100)}%` : ''}
        </p>
        <p className="mt-2 text-[11px] text-muted-foreground">{matchup.meetings} career meetings</p>
      </div>
    </ClusterCard>
  );
}
