/**
 * Loading UI for assistants page
 * Shown while Server Component fetches data
 */
export default function Loading() {
  return (
    <div className="flex h-full gap-4">
      {/* Master Panel Skeleton */}
      <div className="w-full md:w-[45%] lg:w-[400px] space-y-2">
        <div className="h-12 bg-muted animate-pulse rounded-lg" />
        {[...Array(8)].map((_, i) => (
          <div
            key={i}
            className="h-20 bg-muted animate-pulse rounded-lg"
            style={{ animationDelay: `${i * 50}ms` }}
          />
        ))}
      </div>

      {/* Detail Panel Skeleton - Hidden on mobile */}
      <div className="hidden md:block md:w-[55%] lg:flex-1 space-y-4">
        <div className="h-12 bg-muted animate-pulse rounded-lg" />
        <div className="h-64 bg-muted animate-pulse rounded-lg" />
        <div className="h-32 bg-muted animate-pulse rounded-lg" />
      </div>
    </div>
  );
}
