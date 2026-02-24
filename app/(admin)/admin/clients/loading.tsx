import { Skeleton, TableSkeleton } from "@/components/ui/skeleton";

export default function AdminClientsLoading() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="surface-panel p-8">
        <Skeleton className="h-3 w-24 mb-3" />
        <Skeleton className="h-9 w-32 mb-2" />
        <Skeleton className="h-4 w-64" />
        <div className="mt-6 grid gap-4 md:grid-cols-[1.4fr_1fr_auto]">
          <Skeleton className="h-10 rounded-xl" />
          <Skeleton className="h-10 rounded-xl" />
          <Skeleton className="h-10 w-20 rounded-xl" />
        </div>
      </div>

      {/* Table */}
      <div className="card-surface rounded-2xl p-6">
        <Skeleton className="h-10 w-full rounded-xl mb-5" />
        <TableSkeleton rows={6} cols={5} />
      </div>
    </div>
  );
}
