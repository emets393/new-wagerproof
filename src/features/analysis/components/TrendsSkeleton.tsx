import * as React from 'react';
import { GlassCard, SkeletonBlock, SkeletonCircle, SkeletonCapsule } from '@/components/ios';

/**
 * First-load scaffold for the results column — mirrors the real stack (hero → situations →
 * breakdown) so the page shape is there before data lands, instead of a lone box. Kept in sync
 * with TrendsHero / SituationsGrid / BreakdownTable; update this when their layout changes.
 */
export function TrendsSkeleton({ showsROI }: { showsROI: boolean }) {
  return (
    <div className="space-y-4">
      {/* hero — gauge ring + headline lines (mirrors TrendsHero) */}
      <GlassCard radius={24} className="p-6">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
          <SkeletonCircle diameter={120} className="shrink-0" />
          <div className="min-w-0 flex-1 space-y-3">
            <SkeletonBlock className="h-9 w-2/3" radius={10} />
            <SkeletonBlock className="h-4 w-1/2" />
            <SkeletonBlock className="h-4 w-5/6" />
            <SkeletonBlock className="h-3 w-2/5" />
          </div>
        </div>
      </GlassCard>

      {/* situations — header (+ market selector) and a bordered market panel (mirrors SituationsGrid) */}
      <GlassCard radius={24} className="space-y-4 p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <SkeletonCircle diameter={16} />
            <div className="space-y-1.5">
              <SkeletonBlock className="h-3 w-24" />
              <SkeletonBlock className="h-2.5 w-40" />
            </div>
          </div>
          <SkeletonCapsule width={92} height={28} />
        </div>
        <div className="rounded-2xl border border-black/5 p-3.5 dark:border-white/10">
          <SkeletonBlock className="mb-3 h-2.5 w-16" />
          <div className="space-y-3">
            {[0, 1].map((i) => (
              <div key={i} className="space-y-2">
                <div className="flex items-center justify-between">
                  <SkeletonBlock className="h-3 w-24" />
                  <SkeletonBlock className="h-3 w-16" />
                </div>
                <SkeletonCapsule height={10} className="w-full" />
              </div>
            ))}
          </div>
        </div>
      </GlassCard>

      {/* breakdown — folder tabs + search, sort picker, and rows (mirrors BreakdownTable) */}
      <div>
        <div className="flex items-end justify-between gap-3 border-b border-black/10 pb-2 dark:border-white/10">
          <div className="flex items-end gap-2">
            <SkeletonBlock className="h-8 w-20" radius={10} />
            <SkeletonBlock className="h-8 w-24" radius={10} />
            <SkeletonBlock className="h-8 w-24" radius={10} />
          </div>
          <SkeletonBlock className="h-8 w-44" radius={9} />
        </div>
        <div className="mt-3 flex justify-end">
          <SkeletonBlock className="h-8 w-44" radius={9} />
        </div>
        <div className="mt-1 divide-y divide-black/5 dark:divide-white/[0.07]">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-2 py-2.5">
              <SkeletonCircle diameter={24} />
              <SkeletonBlock className="h-3.5 w-24" />
              <div className="flex-1" />
              <SkeletonCapsule width={30} height={18} />
              <SkeletonCapsule width={96} height={6} className="hidden sm:block" />
              <SkeletonBlock className="h-3.5 w-11" />
              {showsROI && <SkeletonBlock className="h-3 w-11" />}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
