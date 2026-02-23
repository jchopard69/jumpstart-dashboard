import { CardSkeleton, Skeleton } from "@/components/ui/skeleton";

export default function CollaborationLoading() {
  return (
    <div className="space-y-8 fade-in">
      {/* Header */}
      <section className="surface-panel p-8">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div>
            <Skeleton className="h-3 w-28 mb-2" />
            <Skeleton className="h-8 w-56 mb-2" />
            <Skeleton className="h-4 w-72" />
          </div>
          <div className="rounded-2xl border border-border/60 bg-white/80 px-5 py-4">
            <Skeleton className="h-3 w-32 mb-2" />
            <Skeleton className="h-9 w-16" />
          </div>
        </div>
      </section>

      {/* Shoots + Notes */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <CardSkeleton />
        <CardSkeleton />
      </section>

      {/* Documents */}
      <section>
        <div className="card-surface rounded-2xl border border-border/60 p-6">
          <Skeleton className="h-5 w-44 mb-1.5" />
          <Skeleton className="h-3.5 w-64 mb-5" />
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 rounded-xl border border-border/50 p-3.5">
                <Skeleton className="h-9 w-9 rounded-lg" />
                <div className="flex-1">
                  <Skeleton className="h-4 w-48 mb-1" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
