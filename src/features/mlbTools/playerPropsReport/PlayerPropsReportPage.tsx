import * as React from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowUpRight, Sparkles } from 'lucide-react';
import { GlassCard, SegmentedControl } from '@/components/ios';
import { trackEvent } from '@/lib/mixpanel';
import { PerformancePanel } from './PerformancePanel';
import { TodaysPicksPanel } from './TodaysPicksPanel';
import { STAKE_LEGEND } from './format';

type Tab = 'picks' | 'performance';

const TAB_OPTIONS: { value: Tab; label: string }[] = [
  { value: 'picks', label: "Today's Picks" },
  { value: 'performance', label: 'Performance' },
];

/**
 * /mlb/picks-report — MLB Player Prop Report hub.
 *
 * Same product as iOS Best MLB Props: algorithm-ranked daily picks plus graded
 * performance. Cross-slate (not per-game), so this stays a scroll page rather
 * than the split-view shell used by Regression / F5 / Prop Matchups.
 *
 * `?tab=performance` deep-links the Performance segment (also the target of
 * the legacy `/mlb/picks-performance` redirect).
 */
export default function PlayerPropsReportPage() {
  const [params, setParams] = useSearchParams();
  const tab: Tab = params.get('tab') === 'performance' ? 'performance' : 'picks';

  React.useEffect(() => {
    trackEvent('MLB Player Prop Report Viewed', { tab });
  }, [tab]);

  const setTab = (next: Tab) => {
    const nextParams = new URLSearchParams(params);
    if (next === 'performance') nextParams.set('tab', 'performance');
    else nextParams.delete('tab');
    setParams(nextParams, { replace: true });
  };

  return (
    <div className="container mx-auto max-w-5xl space-y-5 overflow-x-hidden px-3 py-4 sm:space-y-6 sm:px-4 sm:py-6">
      <GlassCard radius={20} className="space-y-3 p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-1.5">
            <div className="flex items-center gap-2 text-primary">
              <Sparkles className="h-4 w-4" />
              <span className="text-[13px] font-semibold uppercase tracking-wide">
                Algorithm Best Picks
              </span>
            </div>
            <h1 className="text-xl font-bold leading-tight tracking-tight sm:text-2xl">
              Player Prop Report
            </h1>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Ranked MLB props from L10 hit rate, day/night splits, opposing archetype, and recent
              form. Stakes: {STAKE_LEGEND}.
            </p>
          </div>
          <Link
            to="/mlb/pitcher-matchups"
            className="inline-flex shrink-0 items-center gap-1 text-[12px] font-semibold text-primary hover:underline"
          >
            Prop Matchups
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <SegmentedControl
          options={TAB_OPTIONS}
          value={tab}
          onChange={setTab}
          layoutId="mlb-props-report-tab"
          className="w-full sm:w-auto"
        />
      </GlassCard>

      {tab === 'picks' ? <TodaysPicksPanel /> : <PerformancePanel />}
    </div>
  );
}
