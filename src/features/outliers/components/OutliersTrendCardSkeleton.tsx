// Web port of OutliersTrendCardShimmer.swift — mirrors the compact card's
// fixed 300x240 chrome (avatar + title block, betting-line chip, three trend
// rows, footer divider) so the crossfade to real cards never shifts layout.
import { SkeletonBlock, SkeletonCapsule, SkeletonCircle } from '@/components/ios';

export function OutliersTrendCardSkeleton() {
  return (
    <div className="flex h-[240px] w-[300px] shrink-0 flex-col gap-[9px] rounded-2xl border border-black/5 bg-[#F8FAFC] p-3 dark:border-white/10 dark:bg-[#141414]">
      {/* Header */}
      <div className="flex items-start gap-2.5">
        <SkeletonCircle diameter={36} />
        <div className="flex flex-1 flex-col gap-1.5">
          <SkeletonBlock width={150} height={13} />
          <SkeletonBlock width={100} height={11} />
        </div>
        <div className="flex flex-col items-end gap-1">
          <SkeletonBlock width={36} height={9} />
          <SkeletonBlock width={30} height={9} />
        </div>
      </div>

      {/* Betting-line chip row */}
      <SkeletonBlock height={36} radius={10} />

      {/* Trend rows */}
      <div className="flex flex-col gap-1.5">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-center gap-1.5">
            <SkeletonBlock width={14} height={14} radius={4} />
            <SkeletonBlock height={10} className="flex-1" />
            <SkeletonBlock width={26} height={10} />
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="mt-auto flex flex-col gap-1.5">
        <div className="h-px bg-black/5 dark:bg-white/10" />
        <div className="flex items-center gap-1.5">
          <SkeletonCapsule width={36} height={16} />
          <SkeletonCapsule width={36} height={16} />
          <SkeletonCapsule width={36} height={16} />
          <span className="flex-1" />
          <SkeletonBlock width={60} height={11} />
        </div>
      </div>
    </div>
  );
}
