import { Skeleton, TableSkeleton, CardSkeleton } from "@/components/ui/skeleton";

export default function ClientDetailLoading() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="surface-panel p-8">
        <Skeleton className="h-3 w-32 mb-3" />
        <Skeleton className="h-9 w-48 mb-2" />
        <Skeleton className="h-4 w-24" />
        <div className="mt-6 flex items-center gap-3">
          <Skeleton className="h-10 w-36 rounded-xl" />
          <Skeleton className="h-10 w-32 rounded-xl" />
        </div>
      </div>

      {/* Cards */}
      <CardSkeleton />
      <CardSkeleton />

      {/* Table */}
      <div className="card-surface rounded-2xl p-6">
        <Skeleton className="h-5 w-40 mb-4" />
        <TableSkeleton rows={4} cols={6} />
      </div>
    </div>
  );
}
