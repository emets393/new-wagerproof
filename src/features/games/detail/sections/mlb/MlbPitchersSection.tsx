import { Lock, Users } from 'lucide-react';
import { WidgetCard } from '@/components/ios';
import { getConfidenceTier, type MLBPredictionRow } from '../../../api/mlbGames';
import { formatMoneyline, formatSpread, toNum } from './shared';

const CONFIDENCE_LABEL: Record<ReturnType<typeof getConfidenceTier>, string> = {
  full: 'Full',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

function PitcherColumn({
  abbrev,
  role,
  spName,
  confirmed,
  ml,
  spread,
}: {
  abbrev: string;
  role: 'Away' | 'Home';
  spName: string | null;
  confirmed: boolean | null | undefined;
  ml: number | null;
  spread: number | null | undefined;
}) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-xl border border-black/5 bg-black/[0.03] p-3 text-center dark:border-white/10 dark:bg-white/[0.04]">
      <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
        {abbrev} · {role}
      </div>
      {/* Same per-team ML(+spread) coloring as the legacy matchup block: away blue, home green */}
      <div className={`text-sm font-bold ${role === 'Away' ? 'text-blue-600 dark:text-blue-400' : 'text-green-600 dark:text-green-400'}`}>
        {formatMoneyline(ml)}
        {toNum(spread) !== null ? (
          <span className="ml-1 font-semibold text-slate-500 dark:text-slate-400 tabular-nums">
            ({formatSpread(spread)})
          </span>
        ) : null}
      </div>
      <div className="text-sm font-semibold text-foreground">{spName || 'TBD'}</div>
      <span
        title={confirmed ? 'Starter confirmed' : 'Starter TBD'}
        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
          confirmed
            ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
            : 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300'
        }`}
      >
        {confirmed ? 'SP ✓' : 'SP TBD'}
      </span>
    </div>
  );
}

/**
 * Compact starters card: away/home SP names + confirmation chips, with the
 * Final vs Preliminary prediction badge (from the legacy card header) as the
 * widget accessory and status / projection-label / confidence meta below.
 */
export function MlbPitchersSection({
  raw,
  awayAbbrev,
  homeAbbrev,
}: {
  raw: MLBPredictionRow;
  awayAbbrev: string;
  homeAbbrev: string;
}) {
  const tier = getConfidenceTier(raw);

  const finalBadge = (
    <span
      title={raw.is_final_prediction
        ? 'Final prediction — locked in at game time'
        : 'Preliminary projection — may update as game data finalizes'}
      className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full ${
        raw.is_final_prediction
          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
          : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
      }`}
    >
      {raw.is_final_prediction ? <Lock className="h-3 w-3" /> : null}
      {raw.is_final_prediction ? 'Final Prediction' : 'Preliminary Projection'}
    </span>
  );

  return (
    <WidgetCard icon={<Users />} title="Starting Pitchers" accessory={finalBadge}>
      <div className="grid grid-cols-2 gap-3">
        <PitcherColumn
          abbrev={awayAbbrev}
          role="Away"
          spName={raw.away_sp_name}
          confirmed={raw.away_sp_confirmed}
          ml={raw.away_ml}
          spread={raw.away_spread}
        />
        <PitcherColumn
          abbrev={homeAbbrev}
          role="Home"
          spName={raw.home_sp_name}
          confirmed={raw.home_sp_confirmed}
          ml={raw.home_ml}
          spread={raw.home_spread}
        />
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
        <span>Status: {raw.status || 'Scheduled'}</span>
        <span>Model confidence: {CONFIDENCE_LABEL[tier]}</span>
        {raw.projection_label && <span>{raw.projection_label}</span>}
      </div>
    </WidgetCard>
  );
}
