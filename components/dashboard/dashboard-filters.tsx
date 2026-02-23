"use client";

import { useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PLATFORM_LABELS, PLATFORM_ICONS, type Platform } from "@/lib/types";
import { cn } from "@/lib/utils";

const presets = [
  { value: "last_7_days", label: "7j" },
  { value: "last_30_days", label: "30j" },
  { value: "last_90_days", label: "90j" },
  { value: "last_365_days", label: "1 an" },
  { value: "this_month", label: "Ce mois" },
  { value: "last_month", label: "Mois dernier" }
];

export function DashboardFilters({
  preset,
  from,
  to,
  platform,
  accountId,
  accounts
}: {
  preset: string;
  from?: string;
  to?: string;
  platform?: string;
  accountId?: string;
  accounts: Array<{ id: string; platform: Platform; account_name: string }>;
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
    startTransition(() => {
      router.push(`/client/dashboard?${params.toString()}`);
    });
  };

  const hasActiveFilters = (platform && platform !== "all") || accountId || preset === "custom";

  const resetFilters = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("platform");
    params.delete("accountId");
    params.delete("from");
    params.delete("to");
    params.set("preset", "last_30_days");
    startTransition(() => {
      router.push(`/client/dashboard?${params.toString()}`);
    });
  };

  return (
    <div
      className={cn(
        "transition-content",
        isPending && "opacity-55 pointer-events-none"
      )}
      data-pending={isPending}
    >
      <div className="flex flex-wrap items-center gap-3">
        {/* Period segmented control */}
        <div className="segmented-control">
          {presets.map((item) => (
            <button
              key={item.value}
              type="button"
              data-active={preset === item.value}
              onClick={() => updateParams({ preset: item.value, from: undefined, to: undefined })}
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
            value={from ?? ""}
            onChange={(event) => updateParams({ preset: "custom", from: event.target.value })}
          />
          <span className="text-xs text-muted-foreground">-</span>
          <Input
            type="date"
            className="h-8 w-[130px] text-xs"
            value={to ?? ""}
            onChange={(event) => updateParams({ preset: "custom", to: event.target.value })}
          />
        </div>

        <div className="h-5 w-px bg-border/60 hidden sm:block" />

        {/* Platform filter */}
        <Select
          value={platform ?? "all"}
          onValueChange={(value) => updateParams({ platform: value === "all" ? undefined : value })}
        >
          <SelectTrigger className="h-8 w-[160px] text-xs">
            <SelectValue placeholder="Toutes les plateformes" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les plateformes</SelectItem>
            {Object.entries(PLATFORM_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                <span className="inline-flex items-center gap-2">
                  <span>{PLATFORM_ICONS[value as Platform]}</span>
                  {label}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Account filter */}
        {accounts.length > 1 && (
          <Select
            value={accountId ?? "all"}
            onValueChange={(value) => updateParams({ accountId: value === "all" ? undefined : value })}
          >
            <SelectTrigger className="h-8 w-[200px] text-xs">
              <SelectValue placeholder="Tous les comptes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les comptes</SelectItem>
              {accounts.map((account) => (
                <SelectItem key={account.id} value={account.id}>
                  <span className="inline-flex items-center gap-2">
                    <span>{PLATFORM_ICONS[account.platform]}</span>
                    {account.account_name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Reset filters */}
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs text-muted-foreground hover:text-foreground gap-1"
            onClick={resetFilters}
          >
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
            Réinitialiser
          </Button>
        )}
      </div>
    </div>
  );
}
