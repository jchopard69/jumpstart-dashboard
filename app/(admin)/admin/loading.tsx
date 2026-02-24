import { Skeleton, CardSkeleton } from "@/components/ui/skeleton";

export default function AdminOverviewLoading() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="surface-panel p-8">
        <Skeleton className="h-3 w-28 mb-3" />
        <Skeleton className="h-9 w-48 mb-2" />
        <Skeleton className="h-4 w-72" />
        <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="card-surface rounded-2xl p-5">
              <Skeleton className="h-3 w-24 mb-3" />
              <Skeleton className="h-8 w-16" />
            </div>
          ))}
        </div>
      </div>

      {/* Sync logs */}
      <CardSkeleton />
    </div>
  );
}
