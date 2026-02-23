import {
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

      {/* Shoots + Notes */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <CardSkeleton />
        <CardSkeleton />
      </section>
    </div>
  );
}
