"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PLATFORM_LABELS, PLATFORM_ICONS, type Platform } from "@/lib/types";

interface ConnectedAccount {
  id: string;
  platform: Platform;
  account_name: string;
  external_account_id: string;
  auth_status: string;
  last_sync_at: string | null;
}

interface PlatformConfig {
  id: Platform;
  name: string;
  icon: string;
  accentBar: string;
  accentText: string;
  description: string;
  oauthPath: string;
  configured: boolean;
}

const PLATFORMS: PlatformConfig[] = [
  {
    id: "facebook",
    name: "Facebook + Instagram",
    icon: "📘",
    accentBar: "bg-gradient-to-r from-blue-500 via-sky-500 to-indigo-500",
    accentText: "text-blue-700",
    description: "Connecte les Pages Facebook et comptes Instagram Business liés",
    oauthPath: "/api/oauth/meta/start",
    configured: true,
  },
  {
    id: "tiktok",
    name: "TikTok",
    icon: "🎵",
    accentBar: "bg-gradient-to-r from-slate-700 via-slate-800 to-black",
    accentText: "text-slate-800",
    description: "Connecte un compte TikTok Business",
    oauthPath: "/api/oauth/tiktok/start",
    configured: true,
  },
  {
    id: "youtube",
    name: "YouTube",
    icon: "▶️",
    accentBar: "bg-gradient-to-r from-red-500 via-rose-500 to-orange-400",
    accentText: "text-red-600",
    description: "Connecte une chaîne YouTube avec Analytics",
    oauthPath: "/api/oauth/youtube/start",
    configured: true,
  },
  {
    id: "twitter",
    name: "X (Twitter)",
    icon: "𝕏",
    accentBar: "bg-gradient-to-r from-slate-800 via-slate-900 to-black",
    accentText: "text-slate-800",
    description: "Connecte un compte X/Twitter",
    oauthPath: "/api/oauth/twitter/start",
    configured: true,
  },
  {
    id: "linkedin",
    name: "LinkedIn",
    icon: "💼",
    accentBar: "bg-gradient-to-r from-sky-500 via-blue-600 to-indigo-600",
    accentText: "text-blue-700",
    description: "Connecte un profil et/ou pages LinkedIn",
    oauthPath: "/api/oauth/linkedin/start",
    configured: true,
  },
];

interface Props {
  tenantId: string;
  accounts: ConnectedAccount[];
  onDelete: (accountId: string) => void;
}

export function PlatformConnections({ tenantId, accounts, onDelete }: Props) {
  const searchParams = useSearchParams();
  const [notification, setNotification] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Check for OAuth result in URL params
  useEffect(() => {
    // Meta
    if (searchParams.get("meta_success")) {
      const pages = searchParams.get("meta_pages") || "0";
      const ig = searchParams.get("meta_ig") || "0";
      setNotification({
        type: "success",
        message: `Meta connecté avec succès ! ${pages} page(s) Facebook et ${ig} compte(s) Instagram ajoutés.`,
      });
    } else if (searchParams.get("meta_error")) {
      setNotification({
        type: "error",
        message: `Erreur Meta: ${searchParams.get("meta_error")}`,
      });
    }
    // TikTok
    else if (searchParams.get("tiktok_success")) {
      setNotification({
        type: "success",
        message: `TikTok connecté: ${searchParams.get("tiktok_account")}`,
      });
    } else if (searchParams.get("tiktok_error")) {
      setNotification({
        type: "error",
        message: `Erreur TikTok: ${searchParams.get("tiktok_error")}`,
      });
    }
    // YouTube
    else if (searchParams.get("youtube_success")) {
      setNotification({
        type: "success",
        message: `YouTube connecté: ${searchParams.get("youtube_channel")}`,
      });
    } else if (searchParams.get("youtube_error")) {
      setNotification({
        type: "error",
        message: `Erreur YouTube: ${searchParams.get("youtube_error")}`,
      });
    }
    // Twitter
    else if (searchParams.get("twitter_success")) {
      setNotification({
        type: "success",
        message: `Twitter connecté: ${searchParams.get("twitter_account")}`,
      });
    } else if (searchParams.get("twitter_error")) {
      setNotification({
        type: "error",
        message: `Erreur Twitter: ${searchParams.get("twitter_error")}`,
      });
    }
    // LinkedIn
    else if (searchParams.get("linkedin_success")) {
      const count = searchParams.get("linkedin_accounts") || "1";
      setNotification({
        type: "success",
        message: `LinkedIn connecté ! ${count} compte(s) ajouté(s).`,
      });
    } else if (searchParams.get("linkedin_error")) {
      setNotification({
        type: "error",
        message: `Erreur LinkedIn: ${searchParams.get("linkedin_error")}`,
      });
    }

  }, [searchParams]);

  useEffect(() => {
    if (!notification) return;
    const timer = setTimeout(() => setNotification(null), 8000);
    return () => clearTimeout(timer);
  }, [notification]);

  const getAccountsForPlatform = (platform: Platform) => {
    if (platform === "facebook") {
      // Include both Facebook and Instagram for Meta
      return accounts.filter((a) => a.platform === "facebook" || a.platform === "instagram");
    }
    return accounts.filter((a) => a.platform === platform);
  };

  const handleDelete = async (accountId: string) => {
    setDeleting(accountId);
    try {
      onDelete(accountId);
    } finally {
      setDeleting(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge variant="success">Actif</Badge>;
      case "expired":
        return <Badge variant="warning">Expiré</Badge>;
      case "revoked":
        return <Badge variant="danger">Révoqué</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Notification Toast */}
      {notification && (
        <div
          className={`rounded-lg p-4 ${
            notification.type === "success"
              ? "bg-emerald-50 border border-emerald-200 text-emerald-800"
              : "bg-rose-50 border border-rose-200 text-rose-800"
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span>{notification.type === "success" ? "✅" : "❌"}</span>
              <p className="text-sm font-medium">{notification.message}</p>
            </div>
            <button
              onClick={() => setNotification(null)}
              className="text-gray-500 hover:text-gray-700"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Platform Cards Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {PLATFORMS.map((platform) => {
          const platformAccounts = getAccountsForPlatform(platform.id);
          const isConnected = platformAccounts.length > 0;

          return (
            <Card
              key={platform.id}
              className={`relative overflow-hidden border border-border/60 bg-white/85 p-5 shadow-card transition-all ${
                isConnected ? "ring-1 ring-emerald-200" : ""
              }`}
            >
              <div className={`absolute inset-x-0 top-0 h-1 ${platform.accentBar}`} />
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{platform.icon}</span>
                  <div>
                    <h3 className={`font-semibold ${platform.accentText}`}>{platform.name}</h3>
                    <p className="mt-0.5 text-xs text-muted-foreground">{platform.description}</p>
                  </div>
                </div>
              </div>

              {/* Connected Accounts */}
              {platformAccounts.length > 0 && (
                <div className="mt-4 space-y-2">
                  {platformAccounts.map((account) => (
                    <div
                      key={account.id}
                      className="flex items-center justify-between rounded-2xl border border-border/60 bg-white/70 p-3"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm">
                          {account.platform === "instagram" ? "📸" : PLATFORM_ICONS[account.platform]}
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{account.account_name}</p>
                          <div className="flex items-center gap-2">
                            {getStatusBadge(account.auth_status)}
                            {account.last_sync_at && (
                              <span className="text-xs text-muted-foreground">
                                Synchro : {new Date(account.last_sync_at).toLocaleDateString("fr-FR")}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-rose-600 hover:text-rose-700 hover:bg-rose-100"
                        onClick={() => handleDelete(account.id)}
                        disabled={deleting === account.id}
                      >
                        {deleting === account.id ? "..." : "✕"}
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {/* Connect Button */}
              <div className="mt-4">
                <a href={`${platform.oauthPath}?tenantId=${tenantId}`}>
                  <Button
                    variant={isConnected ? "secondary" : "default"}
                    className="w-full"
                  >
                    {isConnected ? "Ajouter un autre compte" : "Connecter"}
                  </Button>
                </a>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Summary */}
      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <span>
          <strong>{accounts.length}</strong> compte(s) connecté(s)
        </span>
        <span>•</span>
        <span>
          <strong>{accounts.filter((a) => a.auth_status === "active").length}</strong> actif(s)
        </span>
        {accounts.some((a) => a.auth_status === "expired") && (
          <>
            <span>•</span>
            <span className="text-yellow-600">
              <strong>{accounts.filter((a) => a.auth_status === "expired").length}</strong> expiré(s)
            </span>
          </>
        )}
      </div>
    </div>
  );
}
