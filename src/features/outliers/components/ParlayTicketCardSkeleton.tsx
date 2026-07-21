// Skeleton mirroring ParlayTicketCard's 300×244 chrome (category header, four
// leg rows, footer divider) so the crossfade to real tickets never shifts.
// Port of ParlayGodCardShimmer. See specs/outliers_spec.md §4c.
import { SkeletonBlock, SkeletonCapsule, SkeletonCircle } from '@/components/ios';

export function ParlayTicketCardSkeleton() {
  return (
    <div className="flex h-[244px] w-[300px] shrink-0 flex-col gap-2.5 rounded-2xl border border-black/5 bg-[#F8FAFC] p-3 dark:border-white/10 dark:bg-[#141414]">
      {/* Header: category icon tile + title + combined-odds capsule */}
      <div className="flex items-center gap-1.5">
        <SkeletonBlock width={22} height={22} radius={7} />
        <SkeletonBlock width={120} height={13} />
        <span className="flex-1" />
        <SkeletonCapsule width={52} height={24} />
      </div>

      {/* Leg rows */}
      <div className="flex flex-col gap-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-2">
            <SkeletonCircle diameter={22} />
            <SkeletonBlock height={12} className="flex-1" />
            <SkeletonCapsule width={34} height={16} />
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="mt-auto flex flex-col gap-1.5">
        <div className="h-px bg-black/5 dark:bg-white/10" />
        <div className="flex items-center gap-1.5">
          <SkeletonBlock width={14} height={14} radius={4} />
          <SkeletonBlock width={170} height={11} />
        </div>
      </div>
    </div>
  );
}
