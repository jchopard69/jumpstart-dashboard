import {
  KanbanColumnSkeleton,
  CardSkeleton,
  Skeleton
} from "@/components/ui/skeleton";

export default function OsLoading() {
  return (
    <div className="space-y-8 fade-in">
      {/* Header */}
      <section className="surface-panel p-8">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div>
            <Skeleton className="h-3 w-24 mb-2" />
            <Skeleton className="h-8 w-64 mb-2" />
            <Skeleton className="h-4 w-80" />
          </div>
          <div className="rounded-2xl border border-border/60 bg-white/80 px-4 py-3">
            <Skeleton className="h-3 w-32 mb-2" />
            <Skeleton className="h-8 w-12" />
          </div>
        </div>
      </section>

      {/* Priorities + Quick add */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="card-surface rounded-2xl border border-border/60 p-6 lg:col-span-2">
          <Skeleton className="h-5 w-48 mb-2" />
          <Skeleton className="h-4 w-64 mb-4" />
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-border/60 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1">
                    <Skeleton className="h-4 w-3/4 mb-2" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                  <Skeleton className="h-6 w-16 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="card-surface rounded-2xl border border-border/60 p-6">
          <Skeleton className="h-5 w-24 mb-2" />
          <Skeleton className="h-4 w-48 mb-4" />
          <div className="space-y-3">
            <Skeleton className="h-10 w-full rounded-xl" />
            <Skeleton className="h-10 w-full rounded-xl" />
            <Skeleton className="h-10 w-full rounded-xl" />
            <Skeleton className="h-10 w-full rounded-xl" />
            <Skeleton className="h-20 w-full rounded-xl" />
            <Skeleton className="h-10 w-full rounded-xl" />
          </div>
        </div>
      </section>

      {/* Next steps + Ideas */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <CardSkeleton />
        <CardSkeleton />
      </section>

      {/* Kanban */}
      <section className="card-surface rounded-3xl p-6">
        <Skeleton className="h-5 w-40 mb-2" />
        <Skeleton className="h-4 w-64 mb-6" />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <KanbanColumnSkeleton key={i} />
          ))}
        </div>
      </section>

      {/* Shoots + Notes */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <CardSkeleton />
        <CardSkeleton />
      </section>
    </div>
  );
}
