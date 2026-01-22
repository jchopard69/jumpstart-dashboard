import { Platform } from "../types";

export type DashboardTotals = {
  followers: number;
  views: number;
  reach: number;
  engagements: number;
  posts_count: number;
};

export type DashboardDelta = {
  followers: number;
  views: number;
  reach: number;
  engagements: number;
  posts_count: number;
};

export type DashboardMetric = {
  date: string;
  followers: number | null;
  views: number | null;
  reach: number | null;
  engagements: number | null;
};

export type PlatformData = {
  platform: Platform;
  available: {
    views: boolean;
    reach: boolean;
    engagements: boolean;
  };
  totals: {
    followers: number;
    views: number;
    reach: number;
    engagements: number;
    posts_count: number;
  };
};

export type PostData = {
  id: string;
  platform?: Platform;
  thumbnail_url: string | null;
  caption: string | null;
  posted_at: string | null;
  url?: string | null;
  metrics: {
    impressions?: number;
    views?: number;
    engagements?: number;
    likes?: number;
  } | null;
};

export type AdsTotals = {
  spend: number;
  impressions: number;
  reach: number;
  clicks: number;
  ctr: number;
  cpc: number;
  cpm: number;
  conversions: number;
  results: number;
};

export type AdCampaign = {
  platform: string;
  name: string;
  impressions: number;
  reach: number;
  clicks: number;
  spend: number;
  conversions: number;
  results: number;
};

export type AdsPlatformBreakdown = {
  platform: string;
  impressions: number;
  reach: number;
  clicks: number;
  spend: number;
  conversions: number;
  results: number;
};

export type AdsData = {
  available: boolean;
  totals: AdsTotals | null;
  topCampaigns: AdCampaign[];
  platforms?: AdsPlatformBreakdown[];
};

export type CollaborationData = {
  shoot_days_remaining: number;
  notes: string | null;
  updated_at: string | null;
};

export type UpcomingShoot = {
  id: string;
  shoot_date: string;
  location: string | null;
  notes: string | null;
};

export type DocumentData = {
  id: string;
  file_name: string;
  tag: string;
};

export type SyncStatus = {
  status: "success" | "failed" | "running" | "idle";
  finished_at: string | null;
};

export type DashboardData = {
  range?: { start: Date; end: Date };
  prevRange?: { start: Date; end: Date };
  totals: DashboardTotals | null;
  delta: DashboardDelta;
  metrics: DashboardMetric[];
  prevMetrics?: DashboardMetric[];
  perPlatform: PlatformData[];
  posts: PostData[];
  ads: AdsData | null;
  collaboration: CollaborationData | null;
  shoots: UpcomingShoot[];
  documents: DocumentData[];
  lastSync: SyncStatus | null;
};

// Collab items types
export type CollabItemKind = "idea" | "shoot" | "edit" | "publish" | "next_step" | "monthly_priority";
export type CollabItemStatus = "backlog" | "planned" | "in_progress" | "review" | "done";
export type CollabItemPriority = "low" | "medium" | "high" | "critical";

export type CollabItem = {
  id: string;
  title: string;
  description: string | null;
  kind: CollabItemKind;
  status: CollabItemStatus;
  priority: CollabItemPriority;
  due_date: string | null;
  owner: string | null;
  sort_order: number;
  created_at: string;
};

// Trend data for charts
export type TrendPoint = {
  date: string;
  value: number;
  previousValue?: number;
};
