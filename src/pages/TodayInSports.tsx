import { Lock, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useFreemiumAccess } from '@/hooks/useFreemiumAccess';
import { OutliersDashboard } from '@/features/outliers/components/OutliersDashboard';
import { PAYWALL_ROUTE } from '@/lib/routes';

/**
 * Today's Outliers — the iOS Outliers Trends experience (see
 * src/features/outliers/). The legacy "Today in Sports" dashboard sections
 * (games marquee, value/fade alerts) were retired in favor of a page focused
 * entirely on trend outliers.
 */
export default function TodayInSports() {
  const { isFreemiumUser } = useFreemiumAccess();
  const navigate = useNavigate();

  return (
    <div className="mx-auto w-full min-w-0 max-w-[1440px]">
      <div className="mb-5">
        <h1 className="text-2xl font-bold md:text-3xl">Today's Outliers</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Statistical trend outliers across the slate — teams, coaches, refs, and players.
        </p>
      </div>

      {isFreemiumUser ? (
        <div className="relative min-h-[520px] overflow-hidden rounded-[24px]">
          <div
            aria-hidden
            className="pointer-events-none select-none opacity-45 blur-[6px]"
          >
            <OutliersDashboard />
          </div>
          <div className="absolute inset-0 z-20 flex items-start justify-center bg-background/20 px-4 pt-24 backdrop-blur-[2px] sm:pt-32">
            <div className="flex max-w-md flex-col items-center gap-3 rounded-[24px] border border-border/70 bg-background/90 px-6 py-7 text-center shadow-2xl backdrop-blur-xl">
              <span className="grid size-12 place-items-center rounded-full bg-primary/15 text-primary">
                <Lock className="size-5" />
              </span>
              <div>
                <h3 className="text-lg font-black text-foreground">Unlock Today's Outliers</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Subscribe to reveal every team, coach, ref, and player trend across today's slate.
                </p>
              </div>
              <Button
                onClick={() => navigate(PAYWALL_ROUTE)}
                className="mt-1 rounded-full bg-[#00C968] font-bold text-black hover:bg-[#00B95F]"
              >
                <Sparkles className="mr-2 size-4" />
                View Plans
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <OutliersDashboard />
      )}
    </div>
  );
}
