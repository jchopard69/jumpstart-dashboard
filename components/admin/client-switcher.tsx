"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Search, ChevronDown, ExternalLink, Settings, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PLATFORM_ICONS } from "@/lib/types";
import type { Platform, SyncStatus } from "@/lib/types";

export type ClientInfo = {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
  platforms: Platform[];
  lastSyncStatus: SyncStatus | null;
  lastSyncAt: string | null;
};

interface ClientSwitcherProps {
  clients: ClientInfo[];
  compact?: boolean;
}

export function ClientSwitcher({ clients, compact }: ClientSwitcherProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    if (!query.trim()) return clients;
    const q = query.toLowerCase();
    return clients.filter(
      (c) => c.name.toLowerCase().includes(q) || c.slug.toLowerCase().includes(q)
    );
  }, [clients, query]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery("");
    }
  }, [open]);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const navigateTo = (clientId: string, target: "dashboard" | "manage") => {
    setOpen(false);
    if (target === "dashboard") {
      router.push(`/client/dashboard?tenantId=${clientId}`);
    } else {
      router.push(`/admin/clients/${clientId}`);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((prev) => Math.min(prev + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter" && filtered[activeIndex]) {
      e.preventDefault();
      navigateTo(filtered[activeIndex].id, "dashboard");
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  // Scroll active item into view
  useEffect(() => {
    if (!listRef.current) return;
    const active = listRef.current.querySelector(`[data-index="${activeIndex}"]`);
    active?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  const getSyncBadge = (status: SyncStatus | null) => {
    if (!status) return null;
    const variant = status === "success" ? "success" : status === "failed" ? "danger" : "warning";
    const label = status === "success" ? "OK" : status === "failed" ? "Erreur" : "Sync...";
    return <Badge variant={variant} className="text-[10px] px-1.5 py-0">{label}</Badge>;
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-2 rounded-xl border border-border/70 bg-white/80 px-3 py-2 text-sm font-medium text-foreground transition-all hover:border-purple-300 hover:bg-white/95 ${
          compact ? "w-full" : ""
        }`}
      >
        <Users className="h-4 w-4 text-muted-foreground" />
        <span className="truncate">{compact ? "Clients" : "Accès rapide client"}</span>
        <ChevronDown className={`ml-auto h-3.5 w-3.5 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-2 w-[360px] rounded-2xl border border-border/70 bg-white shadow-soft animate-in fade-in-0 zoom-in-95 duration-150">
          {/* Search */}
          <div className="flex items-center gap-2 border-b border-border/50 px-4 py-3">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Rechercher un client..."
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            <kbd className="hidden sm:inline-flex h-5 items-center rounded border border-border/60 bg-muted/50 px-1.5 text-[10px] font-medium text-muted-foreground">
              ESC
            </kbd>
          </div>

          {/* Client list */}
          <div ref={listRef} className="max-h-[320px] overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                Aucun client trouvé
              </p>
            ) : (
              filtered.map((client, index) => (
                <div
                  key={client.id}
                  data-index={index}
                  className={`group flex items-center justify-between px-4 py-2.5 transition-colors ${
                    index === activeIndex ? "bg-purple-50" : "hover:bg-muted/40"
                  } ${!client.is_active ? "opacity-50" : ""}`}
                >
                  <button
                    className="flex flex-1 items-start gap-3 text-left"
                    onClick={() => navigateTo(client.id, "dashboard")}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium">{client.name}</span>
                        {getSyncBadge(client.lastSyncStatus)}
                      </div>
                      <div className="mt-0.5 flex items-center gap-1.5">
                        {client.platforms.length > 0 ? (
                          <span className="text-xs">
                            {[...new Set(client.platforms)].map((p) => PLATFORM_ICONS[p]).join(" ")}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">Aucune plateforme</span>
                        )}
                        {client.lastSyncAt && (
                          <>
                            <span className="text-muted-foreground">·</span>
                            <span className="text-[11px] text-muted-foreground">
                              {new Date(client.lastSyncAt).toLocaleDateString("fr-FR")}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </button>
                  <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      onClick={() => navigateTo(client.id, "dashboard")}
                      className="rounded-lg p-1.5 text-muted-foreground hover:bg-purple-100 hover:text-purple-700"
                      title="Dashboard"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => navigateTo(client.id, "manage")}
                      className="rounded-lg p-1.5 text-muted-foreground hover:bg-purple-100 hover:text-purple-700"
                      title="Gérer"
                    >
                      <Settings className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-border/50 px-4 py-2">
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span>{filtered.length} client{filtered.length > 1 ? "s" : ""}</span>
              <div className="flex items-center gap-2">
                <span>↑↓ naviguer</span>
                <span>↵ dashboard</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
