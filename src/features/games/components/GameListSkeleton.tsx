import { GlassCard, SkeletonBlock, SkeletonCircle, SkeletonCapsule } from '@/components/ios';

/** Skeleton shaped like GameListCard (iOS pattern: mirror the real layout). */
function GameCardSkeleton() {
  return (
    <GlassCard className="px-4 py-3.5">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3">
          <div className="flex items-center">
            <SkeletonCircle diameter={42} />
            <div className="-ml-2.5">
              <SkeletonCircle diameter={42} />
            </div>
          </div>
          <div className="space-y-1.5">
            <SkeletonBlock width={110} height={14} />
            <SkeletonBlock width={80} height={10} />
          </div>
        </div>
        <SkeletonCapsule width={64} height={18} />
      </div>
      <div className="mt-2.5 flex items-center gap-2">
        <SkeletonCapsule width={90} height={30} />
        <SkeletonCapsule width={70} height={30} />
      </div>
      <div className="mt-2.5 border-t border-black/5 dark:border-white/10" />
      <div className="mt-2.5 flex items-center gap-1.5">
        <SkeletonCapsule width={64} height={22} />
        <SkeletonCapsule width={72} height={22} />
        <SkeletonCapsule width={68} height={22} />
      </div>
    </GlassCard>
  );
}

export function GameListSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="space-y-2.5">
      {Array.from({ length: count }, (_, i) => (
        <GameCardSkeleton key={i} />
      ))}
    </div>
  );
}
