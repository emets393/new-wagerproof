import { SkeletonBlock, SkeletonCircle } from '@/components/ios';

export function PropBreakdownSkeleton() {
  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <div className="flex justify-center gap-2">
        <SkeletonBlock width={110} height={36} radius={999} />
        <SkeletonBlock width={130} height={36} radius={999} />
        <SkeletonBlock width={110} height={36} radius={999} />
        <SkeletonBlock width={120} height={36} radius={999} />
      </div>
      <div className="flex flex-col items-center gap-3">
        <SkeletonCircle diameter={140} />
        <SkeletonBlock width={220} height={28} radius={8} />
        <SkeletonBlock width={180} height={16} radius={6} />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <SkeletonBlock height={180} radius={20} className="w-full" />
        <SkeletonBlock height={180} radius={20} className="w-full" />
        <SkeletonBlock height={160} radius={20} className="w-full" />
        <SkeletonBlock height={160} radius={20} className="w-full" />
      </div>
      <SkeletonBlock height={88} radius={16} className="w-full" />
    </div>
  );
}
