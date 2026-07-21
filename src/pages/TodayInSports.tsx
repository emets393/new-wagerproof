import { Lock } from 'lucide-react';
import { GlassCard } from '@/components/ios';
import { FreemiumUpgradeBanner } from '@/components/FreemiumUpgradeBanner';
import { useFreemiumAccess } from '@/hooks/useFreemiumAccess';
import { OutliersDashboard } from '@/features/outliers/components/OutliersDashboard';

/**
 * Today's Outliers — the iOS Outliers Trends experience (see
 * src/features/outliers/). The legacy "Today in Sports" dashboard sections
 * (games marquee, value/fade alerts) were retired in favor of a page focused
 * entirely on trend outliers.
 */
export default function TodayInSports() {
  const { isFreemiumUser } = useFreemiumAccess();

  return (
    <div className="mx-auto w-full min-w-0 max-w-6xl">
      <div className="mb-5">
        <h1 className="text-2xl font-bold md:text-3xl">Today's Outliers</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Statistical trend outliers across the slate — teams, coaches, refs, and players.
        </p>
      </div>

      {isFreemiumUser ? (
        <GlassCard className="flex flex-col items-center gap-3 px-6 py-10 text-center">
          <Lock className="h-10 w-10 text-muted-foreground" />
          <h3 className="text-lg font-bold text-foreground">Premium Feature</h3>
          <p className="max-w-sm text-sm text-muted-foreground">
            Upgrade to access trend outliers across today's slate.
          </p>
          <FreemiumUpgradeBanner totalGames={0} visibleGames={0} />
        </GlassCard>
      ) : (
        <OutliersDashboard />
      )}
    </div>
  );
}
