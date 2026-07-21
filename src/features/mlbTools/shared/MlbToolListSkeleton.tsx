import { GlassCard, SkeletonBlock, SkeletonCapsule, SkeletonCircle } from '@/components/ios';

/** Skeleton shaped like MlbToolListCard, so nothing shifts when data lands. */
function MlbToolCardSkeleton() {
  return (
    <GlassCard className="px-3 py-2.5">
      <div className="flex items-center gap-2.5">
        <div className="flex items-center">
          <SkeletonCircle diameter={32} />
          <div className="-ml-2">
            <SkeletonCircle diameter={32} />
          </div>
        </div>
        <div className="flex-1 space-y-1.5">
          <SkeletonBlock width={96} height={14} />
          <SkeletonBlock width={72} height={10} />
        </div>
        <SkeletonCapsule width={62} height={18} />
      </div>
      <div className="mt-2 border-t border-black/5 dark:border-white/10" />
      <div className="mt-2 flex items-center gap-1.5">
        <SkeletonCapsule width={88} height={20} />
        <SkeletonCapsule width={96} height={20} />
      </div>
    </GlassCard>
  );
}

export function MlbToolListSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }, (_, i) => (
        <MlbToolCardSkeleton key={i} />
      ))}
    </div>
  );
}
