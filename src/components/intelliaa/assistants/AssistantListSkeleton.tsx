import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";

/**
 * Skeleton loader for assistant list items
 * Matches the expected structure of AssistantListItem
 */
export function AssistantListItemSkeleton() {
  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-start gap-3">
        {/* Avatar skeleton */}
        <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />

        <div className="flex-1 space-y-2 min-w-0">
          {/* Name and badge skeleton */}
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-5 w-20" />
          </div>

          {/* Status and timestamp skeleton */}
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-4 rounded-full" />
            <Skeleton className="h-4 w-24" />
          </div>
        </div>
      </div>
    </Card>
  );
}

/**
 * Skeleton loader for master panel list
 * Shows multiple item skeletons
 */
interface AssistantListSkeletonProps {
  count?: number;
}

export function AssistantListSkeleton({ count = 8 }: AssistantListSkeletonProps) {
  return (
    <div className="space-y-2">
      {[...Array(count)].map((_, i) => (
        <AssistantListItemSkeleton key={i} />
      ))}
    </div>
  );
}
