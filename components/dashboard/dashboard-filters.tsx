"use client";

import { useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PLATFORM_LABELS, PLATFORM_ICONS, type Platform } from "@/lib/types";
import { cn } from "@/lib/utils";

const presets = [
  { value: "last_7_days", label: "7 jours" },
  { value: "last_30_days", label: "30 jours" },
  { value: "last_90_days", label: "90 jours" },
  { value: "last_365_days", label: "365 jours" },
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

  return (
    <div className={cn(
      "flex flex-wrap items-center gap-3 rounded-2xl border border-border/60 bg-white/70 p-3 transition-opacity duration-200",
      isPending && "opacity-60 pointer-events-none"
    )}>
      <div className="flex flex-wrap gap-2">
        {presets.map((item) => (
          <Button
            key={item.value}
            variant={preset === item.value ? "default" : "outline"}
            size="sm"
            onClick={() => updateParams({ preset: item.value, from: undefined, to: undefined })}
          >
            {item.label}
          </Button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <Input
          type="date"
          value={from ?? ""}
          onChange={(event) => updateParams({ preset: "custom", from: event.target.value })}
        />
        <Input
          type="date"
          value={to ?? ""}
          onChange={(event) => updateParams({ preset: "custom", to: event.target.value })}
        />
      </div>
      <Select
        value={platform ?? "all"}
        onValueChange={(value) => updateParams({ platform: value === "all" ? undefined : value })}
      >
      <SelectTrigger className="w-[180px]">
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
      <Select
        value={accountId ?? "all"}
        onValueChange={(value) => updateParams({ accountId: value === "all" ? undefined : value })}
      >
        <SelectTrigger className="w-[240px]">
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
    </div>
  );
}
