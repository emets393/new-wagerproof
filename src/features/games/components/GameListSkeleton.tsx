import { GlassCard, SkeletonBlock, SkeletonCircle, SkeletonCapsule } from '@/components/ios';

/** Skeleton shaped like GameListCard (iOS pattern: mirror the real layout). */
function GameCardSkeleton() {
  return (
    <GlassCard className="px-3 py-2.5">
      <div className="flex items-start gap-2">
        <div className="flex items-center gap-3">
          <div className="flex items-center">
            <SkeletonCircle diameter={34} />
            <div className="-ml-2">
              <SkeletonCircle diameter={34} />
            </div>
          </div>
          <div className="space-y-1.5">
            <SkeletonBlock width={110} height={14} />
            <SkeletonBlock width={80} height={10} />
          </div>
        </div>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <SkeletonCapsule width={82} height={24} />
        <SkeletonCapsule width={64} height={24} />
      </div>
      <div className="mt-2 border-t border-black/5 dark:border-white/10" />
      <div className="mt-2 flex items-center gap-1">
        <SkeletonCapsule width={58} height={18} />
        <SkeletonCapsule width={66} height={18} />
        <SkeletonCapsule width={62} height={18} />
        <div className="flex-1" />
        <SkeletonCapsule width={54} height={18} />
      </div>
    </GlassCard>
  );
}

export function GameListSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }, (_, i) => (
        <GameCardSkeleton key={i} />
      ))}
    </div>
  );
}
