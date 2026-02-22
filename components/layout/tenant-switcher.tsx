"use client";

import { useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { ChevronDown, Building2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import type { AccessibleTenant } from "@/lib/auth";
import { setActiveTenant } from "@/lib/tenant-actions";

interface TenantSwitcherProps {
  tenants: AccessibleTenant[];
  currentTenantId: string;
}

export function TenantSwitcher({ tenants, currentTenantId }: TenantSwitcherProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const currentTenant = tenants.find((t) => t.id === currentTenantId);

  const handleTenantChange = (tenantId: string) => {
    if (tenantId === currentTenantId) return;

    startTransition(async () => {
      await setActiveTenant(tenantId);
      const params = new URLSearchParams(searchParams.toString());
      params.set("tenantId", tenantId);
      router.push(`${pathname}?${params.toString()}`);
      router.refresh();
    });
  };

  if (tenants.length <= 1) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Building2 className="h-4 w-4" />
          <span className="max-w-[120px] truncate">{currentTenant?.name ?? "Sélectionner"}</span>
          <ChevronDown className="h-3 w-3 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[200px]">
        <DropdownMenuLabel>Changer de workspace</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {tenants.map((tenant) => (
          <DropdownMenuItem
            key={tenant.id}
            onClick={() => handleTenantChange(tenant.id)}
            className={tenant.id === currentTenantId ? "bg-muted" : ""}
          >
            <span className="truncate">{tenant.name}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
