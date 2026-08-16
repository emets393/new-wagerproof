import { Circle, Globe, Home, Moon, Plane, TrendingUp, Users } from 'lucide-react';
import { CLUSTER_TIPS } from '../statTips';
import { StatTip } from './StatTip';

type WindowRec = { h: number; l?: number; n: number; p?: number; pct: number };
type SituationBucket = Record<string, WindowRec>;

const BUCKET_LABELS: Record<string, string> = {
  overall: 'Overall',
  home: 'Home',
  away: 'Away',
  division: 'Division',
  non_division: 'Non-division',
  primetime: 'Primetime',
  regular: 'Regular',
};

const MARKET_LABELS: Record<string, string> = {
  player_anytime_td: 'Anytime TD',
  player_reception_yds: 'Receiving Yards',
  player_receptions: 'Receptions',
  player_rush_yds: 'Rushing Yards',
  player_rush_attempts: 'Rushing Attempts',
  player_pass_yds: 'Passing Yards',
  player_pass_tds: 'Passing TDs',
  player_pass_attempts: 'Passing Attempts',
  player_pass_completions: 'Pass Completions',
};

function heatColor(pct: number): string | undefined {
  if (pct > 0.75) return '#22C55E';
  if (pct >= 0.6) return '#F59E0B';
  return undefined;
}

function heatBg(pct: number): string {
  const color = heatColor(pct);
  if (color === '#22C55E') return 'rgba(34,197,94,0.14)';
  if (color === '#F59E0B') return 'rgba(245,158,11,0.14)';
  return 'rgba(128,128,128,0.12)';
}

function SituationIcon({ bucket, pct }: { bucket: string; pct: number }) {
  const Icon = bucket === 'home'
    ? Home
    : bucket === 'away'
      ? Plane
      : bucket === 'division'
        ? Users
        : bucket === 'non_division'
          ? Globe
          : bucket === 'primetime'
            ? Moon
            : bucket === 'regular'
              ? Circle
              : TrendingUp;
  return <Icon className="h-3.5 w-3.5 shrink-0" style={{ color: heatColor(pct) }} />;
}

/** Expandable situational records — render served windows only. */
export function SituationsDrawer({
  splits,
  marketKey,
}: {
  splits: unknown;
  marketKey: string;
}) {
  const byMarket =
    splits && typeof splits === 'object'
      ? (splits as Record<string, Record<string, SituationBucket>>)[marketKey]
      : undefined;

  if (!byMarket) return null;

  const buckets = Object.entries(byMarket)
    .filter(([k]) => BUCKET_LABELS[k])
    .map(([key, windows]) => ({ key, record: windows['5'] ?? windows['7'] ?? windows['3'] }))
    .filter((entry): entry is { key: string; record: WindowRec } => Boolean(entry.record));
  if (buckets.length === 0) return null;

  const overall = buckets.find((entry) => entry.key === 'overall')?.record ?? buckets[0].record;
  const marketLabel = MARKET_LABELS[marketKey] ?? 'Player prop';
  const action = marketKey === 'player_anytime_td' ? 'Scored' : 'Cleared the line';

  return (
    <div className="rounded-2xl border border-black/5 bg-[#F8FAFC] p-3 text-left dark:border-white/10 dark:bg-[#141414]">
      <div className="flex items-start gap-2.5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary ring-1 ring-primary/20">
          <TrendingUp className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="truncate text-sm font-extrabold text-foreground">{marketLabel} — Situations</p>
            <StatTip tip={CLUSTER_TIPS.situations} />
          </div>
          <p className="text-[11px] font-medium text-muted-foreground">Recent results by game setting</p>
        </div>
        <span
          className="shrink-0 rounded-full px-2 py-1 font-mono text-[12px] font-black tabular-nums"
          style={{ backgroundColor: heatBg(overall.pct), color: heatColor(overall.pct) }}
        >
          {Math.round(overall.pct * 100)}%
        </span>
      </div>

      <div className="my-2.5 h-px bg-black/5 dark:bg-white/10" />

      <div className="grid gap-x-5 gap-y-2 sm:grid-cols-2">
        {buckets.map(({ key, record }) => {
          const color = heatColor(record.pct);
          const windowLabel = record.n === 1 ? 'game' : 'games';
          return (
            <div key={key} className="flex min-w-0 items-start gap-1.5">
              <span className="mt-px">
                <SituationIcon bucket={key} pct={record.pct} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium leading-tight text-muted-foreground">
                  {action} in {record.h} of {record.n} {BUCKET_LABELS[key].toLowerCase()} {windowLabel}
                </p>
              </div>
              <span
                className="ml-auto min-w-[2.5rem] shrink-0 text-right font-mono text-xs font-black tabular-nums text-muted-foreground"
                style={color ? { color } : undefined}
              >
                {Math.round(record.pct * 100)}%
              </span>
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex items-center gap-2 border-t border-black/5 pt-2 dark:border-white/10">
        <span className="text-[10px] font-bold text-primary">Situational breakdown</span>
        <span className="ml-auto font-mono text-[10px] font-semibold text-muted-foreground">
          {overall.h}/{overall.n} overall
        </span>
      </div>
    </div>
  );
}
