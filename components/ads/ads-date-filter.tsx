"use client";

import { useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const presets = [
  { value: "last_7_days", label: "7j", days: 6 },
  { value: "last_30_days", label: "30j", days: 29 },
  { value: "last_90_days", label: "90j", days: 89 }
];

function getPresetDates(days: number) {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - days);
  return {
    from: start.toISOString().slice(0, 10),
    to: end.toISOString().slice(0, 10)
  };
}

export function AdsDateFilter({
  from,
  to
}: {
  from: string;
  to: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const updateParams = (next: Record<string, string | undefined>) => {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(next).forEach(([key, value]) => {
      if (!value) {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    });

    // Validate: swap if from > to
    const fromVal = params.get("from");
    const toVal = params.get("to");
    if (fromVal && toVal && fromVal > toVal) {
      params.set("from", toVal);
      params.set("to", fromVal);
    }

    startTransition(() => {
      router.push(`/client/ads?${params.toString()}`);
    });
  };

  // Detect active preset
  const activePreset = presets.find((p) => {
    const { from: pFrom, to: pTo } = getPresetDates(p.days);
    return from === pFrom && to === pTo;
  });

  return (
    <div
      className={cn(
        "transition-content",
        isPending && "opacity-55 pointer-events-none"
      )}
      data-pending={isPending}
    >
      <div className="flex flex-wrap items-center gap-3 overflow-x-auto">
        {/* Period segmented control */}
        <div className="segmented-control overflow-x-auto shrink-0">
          {presets.map((item) => (
            <button
              key={item.value}
              type="button"
              data-active={activePreset?.value === item.value}
              onClick={() => {
                const { from: pFrom, to: pTo } = getPresetDates(item.days);
                updateParams({ from: pFrom, to: pTo });
              }}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Custom date range */}
        <div className="flex items-center gap-1.5">
          <Input
            type="date"
            className="h-8 w-[130px] text-xs"
            value={from}
            onChange={(event) => updateParams({ from: event.target.value })}
          />
          <span className="text-xs text-muted-foreground">-</span>
          <Input
            type="date"
            className="h-8 w-[130px] text-xs"
            value={to}
            onChange={(event) => updateParams({ to: event.target.value })}
          />
        </div>
      </div>
    </div>
  );
}
