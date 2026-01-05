"use client";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ExportButtons({ query }: { query: string }) {
  return (
    <div className="flex items-center gap-2">
      <a
        className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
        href={`/api/export/pdf?${query}`}
      >
        Exporter PDF
      </a>
      <a
        className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
        href={`/api/export/csv?${query}`}
      >
        Exporter CSV
      </a>
    </div>
  );
}
