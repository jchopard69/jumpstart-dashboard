"use client";

import { useState } from "react";
import Link from "next/link";
import { Search, ExternalLink } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { PLATFORM_ICONS } from "@/lib/types";
import type { Platform, SyncStatus } from "@/lib/types";

export type ClientRow = {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
  platforms: Platform[];
  lastSyncStatus: SyncStatus | null;
  lastSyncAt: string | null;
};

interface ClientsListProps {
  clients: ClientRow[];
  deactivateAction: (formData: FormData) => Promise<void>;
}

export function ClientsList({ clients, deactivateAction }: ClientsListProps) {
  const [query, setQuery] = useState("");

  const filtered = query.trim()
    ? clients.filter(
        (c) =>
          c.name.toLowerCase().includes(query.toLowerCase()) ||
          c.slug.toLowerCase().includes(query.toLowerCase())
      )
    : clients;

  return (
    <div>
      {/* Search bar */}
      <div className="relative mb-5">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher un client..."
          className="w-full rounded-xl border border-border/70 bg-white/80 py-2.5 pl-10 pr-4 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-purple-300 focus:ring-1 focus:ring-purple-200"
        />
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <Table className="table-premium">
          <TableHeader>
            <TableRow>
              <TableHead>Client</TableHead>
              <TableHead>Plateformes</TableHead>
              <TableHead>Dernière sync</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                  {query ? "Aucun client trouvé" : "Aucun client"}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((client) => (
                <TableRow key={client.id} className={!client.is_active ? "opacity-50" : ""}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{client.name}</p>
                      <p className="text-xs text-muted-foreground">{client.slug}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    {client.platforms.length > 0 ? (
                      <div className="flex items-center gap-1">
                        {[...new Set(client.platforms)].map((p) => (
                          <span key={p} title={p} className="text-base">
                            {PLATFORM_ICONS[p]}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {client.lastSyncAt ? (
                      <span className="text-sm text-muted-foreground">
                        {new Date(client.lastSyncAt).toLocaleDateString("fr-FR")}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {!client.is_active ? (
                      <Badge variant="secondary">Inactif</Badge>
                    ) : client.lastSyncStatus === "success" ? (
                      <Badge variant="success">OK</Badge>
                    ) : client.lastSyncStatus === "failed" ? (
                      <Badge variant="danger">Erreur</Badge>
                    ) : client.lastSyncStatus === "running" ? (
                      <Badge variant="warning">Sync...</Badge>
                    ) : (
                      <Badge variant="secondary">-</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        href={`/client/dashboard?tenantId=${client.id}`}
                        className={cn(
                          buttonVariants({ variant: "ghost", size: "sm" }),
                          "gap-1.5 text-purple-700 hover:text-purple-800 hover:bg-purple-50"
                        )}
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        Dashboard
                      </Link>
                      <Link
                        className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                        href={`/admin/clients/${client.id}`}
                      >
                        Gérer
                      </Link>
                      {client.is_active && (
                        <form action={deactivateAction}>
                          <input type="hidden" name="tenantId" value={client.id} />
                          <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10" type="submit">
                            Désactiver
                          </Button>
                        </form>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Footer count */}
      <div className="mt-3 text-xs text-muted-foreground">
        {filtered.length} client{filtered.length > 1 ? "s" : ""}
        {query && ` sur ${clients.length}`}
      </div>
    </div>
  );
}
