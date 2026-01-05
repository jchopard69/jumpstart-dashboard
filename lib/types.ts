export type UserRole = "agency_admin" | "client_manager" | "client_user";
export type Platform = "instagram" | "facebook" | "linkedin" | "tiktok" | "youtube" | "twitter";
export type DocumentTag = "contract" | "brief" | "report" | "other";
export type SyncStatus = "success" | "failed" | "running";
export type AuthStatus = "active" | "revoked" | "expired" | "pending";

export const PLATFORM_LABELS: Record<Platform, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  linkedin: "LinkedIn",
  tiktok: "TikTok",
  youtube: "YouTube",
  twitter: "X (Twitter)"
};

export const PLATFORM_ICONS: Record<Platform, string> = {
  instagram: "📸",
  facebook: "📘",
  linkedin: "💼",
  tiktok: "🎵",
  youtube: "▶️",
  twitter: "𝕏"
};
