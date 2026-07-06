import { Activity } from 'lucide-react';
import { WidgetCard } from '@/components/ios';
import {
  combineSignalsOrdered,
  signalsRowForGamePk,
  type MLBGameSignalsRow,
  type MLBPredictionRow,
} from '../../../api/mlbGames';
import { isOfficialDateToday, SignalCategoryIcon, signalSeverityPillClass } from './shared';

/**
 * Supplemental betting-signal pills from mlb_game_signals (game-level first,
 * then home, then away). Like the legacy card, only rendered for games whose
 * official_date is today in ET — signals are refreshed for the current slate.
 */
export function MlbSignalsSection({
  raw,
  signalsByGamePk,
}: {
  raw: MLBPredictionRow;
  signalsByGamePk: Map<string, MLBGameSignalsRow>;
}) {
  if (!isOfficialDateToday(raw.official_date)) return null;

  const allSignals = combineSignalsOrdered(signalsRowForGamePk(signalsByGamePk, raw.game_pk));

  return (
    <WidgetCard icon={<Activity />} title="Game Signals">
      {allSignals.length > 0 ? (
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 [scrollbar-width:thin]">
          {allSignals.map((sig, si) => (
            <div
              key={`${raw.game_pk}-sig-${si}`}
              className={`inline-flex max-w-[min(100%,22rem)] flex-shrink-0 items-start gap-1.5 rounded-2xl border px-2.5 py-1.5 text-left text-[11px] leading-snug ${signalSeverityPillClass(sig.severity)}`}
            >
              <SignalCategoryIcon category={sig.category} />
              <span className="min-w-0">{sig.message}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="rounded-lg border border-black/5 bg-black/[0.03] px-3 py-2.5 text-left text-[11px] leading-relaxed text-muted-foreground dark:border-white/10 dark:bg-white/[0.04]">
          No supplemental betting signals for this matchup right now. Your projections and edges above are the same full model outputs—this block only adds extra situational or trend context when our system surfaces it.
        </p>
      )}
    </WidgetCard>
  );
}
