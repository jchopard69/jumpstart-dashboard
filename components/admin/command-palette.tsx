"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, ExternalLink, Settings, LayoutDashboard, Users, Heart, Cog } from "lucide-react";
import { PLATFORM_ICONS } from "@/lib/types";
import type { ClientInfo } from "./client-switcher";

interface CommandPaletteProps {
  clients: ClientInfo[];
}

type CommandItem = {
  id: string;
  label: string;
  sublabel?: string;
  icon: React.ReactNode;
  action: () => void;
  group: string;
};

export function CommandPalette({ clients }: CommandPaletteProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Toggle on Cmd+K / Ctrl+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const navigate = useCallback(
    (path: string) => {
      setOpen(false);
      router.push(path);
    },
    [router]
  );

  const allItems = useMemo<CommandItem[]>(() => {
    const nav: CommandItem[] = [
      {
        id: "nav-overview",
        label: "Vue d'ensemble",
        icon: <LayoutDashboard className="h-4 w-4" />,
        action: () => navigate("/admin"),
        group: "Navigation",
      },
      {
        id: "nav-clients",
        label: "Clients",
        icon: <Users className="h-4 w-4" />,
        action: () => navigate("/admin/clients"),
        group: "Navigation",
      },
      {
        id: "nav-users",
        label: "Utilisateurs",
        icon: <Users className="h-4 w-4" />,
        action: () => navigate("/admin/users"),
        group: "Navigation",
      },
      {
        id: "nav-health",
        label: "Santé",
        icon: <Heart className="h-4 w-4" />,
        action: () => navigate("/admin/health"),
        group: "Navigation",
      },
      {
        id: "nav-settings",
        label: "Réglages",
        icon: <Cog className="h-4 w-4" />,
        action: () => navigate("/admin/settings"),
        group: "Navigation",
      },
    ];

    const clientItems: CommandItem[] = clients.flatMap((client) => [
      {
        id: `client-dash-${client.id}`,
        label: `Dashboard ${client.name}`,
        sublabel: client.platforms.map((p) => PLATFORM_ICONS[p]).join(" ") || undefined,
        icon: <ExternalLink className="h-4 w-4" />,
        action: () => navigate(`/client/dashboard?tenantId=${client.id}`),
        group: "Dashboards clients",
      },
      {
        id: `client-manage-${client.id}`,
        label: `Gérer ${client.name}`,
        sublabel: client.slug,
        icon: <Settings className="h-4 w-4" />,
        action: () => navigate(`/admin/clients/${client.id}`),
        group: "Gestion clients",
      },
    ]);

    return [...nav, ...clientItems];
  }, [clients, navigate]);

  const filtered = useMemo(() => {
    if (!query.trim()) return allItems.slice(0, 12); // Show first 12 by default
    const q = query.toLowerCase();
    return allItems.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        item.sublabel?.toLowerCase().includes(q) ||
        item.group.toLowerCase().includes(q)
    );
  }, [allItems, query]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  // Scroll active into view
  useEffect(() => {
    if (!listRef.current) return;
    const el = listRef.current.querySelector(`[data-cmd-index="${activeIndex}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((prev) => Math.min(prev + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter" && filtered[activeIndex]) {
      e.preventDefault();
      filtered[activeIndex].action();
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  if (!open) return null;

  // Group items
  const groups = new Map<string, typeof filtered>();
  for (const item of filtered) {
    const existing = groups.get(item.group) ?? [];
    existing.push(item);
    groups.set(item.group, existing);
  }

  let flatIndex = 0;

  return (
    <div className="fixed inset-0 z-[100]">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={() => setOpen(false)}
      />

      {/* Palette */}
      <div className="relative mx-auto mt-[15vh] w-full max-w-lg px-4">
        <div className="overflow-hidden rounded-2xl border border-border/70 bg-white shadow-soft">
          {/* Search input */}
          <div className="flex items-center gap-3 border-b border-border/50 px-4 py-3.5">
            <Search className="h-5 w-5 text-muted-foreground" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Rechercher un client, une page..."
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            <kbd className="inline-flex h-5 items-center rounded border border-border/60 bg-muted/50 px-1.5 text-[10px] font-medium text-muted-foreground">
              ESC
            </kbd>
          </div>

          {/* Results */}
          <div ref={listRef} className="max-h-[360px] overflow-y-auto py-2">
            {filtered.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                Aucun résultat
              </p>
            ) : (
              Array.from(groups.entries()).map(([group, items]) => (
                <div key={group}>
                  <p className="px-4 pb-1 pt-3 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                    {group}
                  </p>
                  {items.map((item) => {
                    const idx = flatIndex++;
                    return (
                      <button
                        key={item.id}
                        data-cmd-index={idx}
                        onClick={item.action}
                        className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors ${
                          idx === activeIndex
                            ? "bg-purple-50 text-purple-900"
                            : "text-foreground hover:bg-muted/40"
                        }`}
                      >
                        <span className={idx === activeIndex ? "text-purple-600" : "text-muted-foreground"}>
                          {item.icon}
                        </span>
                        <span className="flex-1 truncate">{item.label}</span>
                        {item.sublabel && (
                          <span className="text-xs text-muted-foreground">{item.sublabel}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-border/50 px-4 py-2">
            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
              <span>{filtered.length} résultat{filtered.length > 1 ? "s" : ""}</span>
              <div className="flex items-center gap-3">
                <span>↑↓ naviguer</span>
                <span>↵ ouvrir</span>
                <span>esc fermer</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
