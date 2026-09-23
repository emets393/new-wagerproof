import { cn } from '@/lib/utils';
import type { FpModel, NflPropPlayerPage, PropReport } from '../types';
import { formatPerGame } from '../format';
import { StatTip } from './StatTip';

const FIRES_TIP =
  'This market has a threshold the model had to clear to show an edge in backtesting on 2023-25 ' +
  'priced lines. "Fires" means the projection clears it on this line. Below the threshold the ' +
  'model was not profitable, so no edge is claimed.';

const COVERAGE_TIP =
  'The prop model only covers the markets that held up in backtesting — passing yards, passing ' +
  'touchdowns, completions, receptions and receiving yards. Rushing markets and anytime touchdown ' +
  'were tested and did not beat the price, so they are deliberately left out.';

/**
 * Fantasy-Points research, rendered UNDER the WagerProof projection rather than replacing it.
 * The two cover different ground: `projection` runs on nearly every player and market, this runs
 * on ~a third of players across five markets. Showing an empty state here is normal and is why
 * this never swaps out the strip above it.
 */
export function FpResearchStrip({
  page,
  marketKey,
}: {
  page: NflPropPlayerPage;
  marketKey: string;
}) {
  const research = page.research?.[marketKey];
  const model = research?.fp_model;
  const report = research?.prop_report;
  if (!model && !report) return null;

  return (
    <div className="rounded-2xl border border-black/5 bg-white/55 px-3.5 py-3 backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.05]">
      <div className="flex items-center justify-between gap-2">
        <StatTip tip={COVERAGE_TIP} label="Prop model">
          <span className="inline-flex cursor-help text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
            Prop model &amp; report
          </span>
        </StatTip>
        {model && <FiresChip fires={model.fires} tier={model.tier} />}
      </div>

      {model && <ModelLine model={model} marketKey={marketKey} />}
      {report && <ReportBlock report={report} />}
    </div>
  );
}

function FiresChip({ fires, tier }: { fires: boolean; tier: string }) {
  // `tier` is a backtested hit rate like "61.0%", or the word "robust" where no single rate was
  // pinned — show it only when it reads as a rate, otherwise it looks like a typo in the UI.
  const rate = /\d/.test(tier) ? tier : null;
  return (
    <StatTip tip={FIRES_TIP} label={fires ? 'Edge live' : 'No edge'}>
      <span
        className={cn(
          'inline-flex cursor-help items-center gap-1.5 rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em]',
          fires
            ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
            : 'border-black/10 bg-muted text-muted-foreground dark:border-white/10',
        )}
      >
        {fires ? 'Edge live' : 'No edge'}
        {fires && rate && <span className="font-mono normal-case tracking-normal">{rate}</span>}
      </span>
    </StatTip>
  );
}

function ModelLine({ model, marketKey }: { model: FpModel; marketKey: string }) {
  const over = model.edge > 0;
  const unit = marketKey.includes('yds')
    ? 'yds'
    : marketKey.includes('completions')
      ? 'cmp'
      : marketKey.includes('receptions')
        ? 'rec'
        : marketKey.includes('tds')
          ? 'TDs'
          : '';
  const dp = Math.abs(model.edge) < 1 ? 2 : 1;
  const sentence = model.line == null
    ? `Projects ${formatPerGame(model.pred, 1)} ${unit}.`
    : `Projects ${formatPerGame(model.pred, 1)} ${unit} against a ${formatPerGame(model.line, 1)} line — ` +
      `${formatPerGame(Math.abs(model.edge), dp)} ${over ? 'over' : 'under'}.`;

  return (
    <div className="mt-2.5">
      <p className="text-[13px] font-semibold leading-snug text-foreground">{sentence}</p>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span
          className={cn(
            'rounded-full px-2 py-0.5 font-mono text-[11px] font-bold',
            over
              ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
              : 'bg-rose-500/15 text-rose-700 dark:text-rose-300',
          )}
        >
          {model.edge > 0 ? '+' : ''}
          {formatPerGame(model.edge, dp)} edge
        </span>
        <span className="rounded-full bg-muted px-2 py-0.5 font-mono text-[11px] font-bold text-muted-foreground">
          needs {formatPerGame(model.threshold, Math.abs(model.threshold) < 1 ? 2 : 0)}
        </span>
      </div>
    </div>
  );
}

function ReportBlock({ report }: { report: PropReport }) {
  const tells = report.tells ?? [];
  const under = String(report.read).toLowerCase() === 'under';
  return (
    <div className="mt-3 border-t border-black/5 pt-3 dark:border-white/10">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[9px] font-black uppercase tracking-[0.14em] text-muted-foreground">
          Player Prop Report
        </span>
        <span
          className={cn(
            'rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.1em]',
            under
              ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300'
              : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
          )}
        >
          {report.read}
          {report.line != null && ` ${formatPerGame(report.line, 1)}`}
        </span>
        {/* n_for / n_against are INDEPENDENT tells, so the split is the honest confidence read */}
        <span className="font-mono text-[11px] font-bold text-muted-foreground">
          {report.n_for} for · {report.n_against} against
        </span>
      </div>

      {report.summary && (
        <p className="mt-2 text-[13px] leading-snug text-foreground">{report.summary}</p>
      )}

      {tells.length > 0 && (
        <ul className="mt-2 space-y-1.5">
          {tells.map((tell, i) => {
            const agrees = String(tell.dir).toLowerCase() === String(report.read).toLowerCase();
            return (
              <li key={`${tell.src}-${i}`} className="flex gap-2 text-[12px] leading-snug">
                <span
                  className={cn(
                    'mt-[6px] h-1.5 w-1.5 shrink-0 rounded-full',
                    agrees ? 'bg-emerald-500' : 'bg-rose-500',
                  )}
                />
                <span className="text-muted-foreground">
                  <span className="font-bold uppercase tracking-wide text-foreground/70">
                    {tell.src}
                  </span>{' '}
                  {tell.text}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
