"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowUpRight, Building2 } from "lucide-react";
import type { ClientInfo } from "@/components/admin/client-switcher";

type AdminClientContextProps = {
  clients: ClientInfo[];
};

export function AdminClientContext({ clients }: AdminClientContextProps) {
  const searchParams = useSearchParams();
  const tenantId = searchParams.get("tenantId");
  const client = tenantId ? clients.find((item) => item.id === tenantId) : null;

  if (!tenantId || !client) {
    return null;
  }

  return (
    <div className="mb-5 rounded-2xl border border-primary/15 bg-white/80 px-4 py-3 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-primary/15 bg-primary/5 text-primary">
            <Building2 className="h-4 w-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="section-label text-primary">Contexte client</p>
            <p className="truncate text-sm font-semibold text-foreground">{client.name}</p>
          </div>
        </div>
        <Link
          href={`/admin/clients/${encodeURIComponent(client.id)}`}
          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/5"
        >
          Gérer le client
          <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}
