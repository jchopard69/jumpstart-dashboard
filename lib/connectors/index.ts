import type { Platform } from "@/lib/types";
import { getMockConnectors } from "./mock";
import type { Connector } from "./types";

// Import connectors from new social-platforms structure
import { instagramConnector, facebookConnector } from "@/lib/social-platforms/meta/api";
import { youtubeConnector } from "@/lib/social-platforms/youtube/api";
import { tiktokConnector } from "@/lib/social-platforms/tiktok/api";
import { twitterConnector } from "@/lib/social-platforms/twitter/api";
import { linkedinConnector } from "@/lib/social-platforms/linkedin/api";

// Map of platform to connector
const connectors: Record<Platform, Connector> = {
  instagram: instagramConnector,
  facebook: facebookConnector,
  youtube: youtubeConnector,
  tiktok: tiktokConnector,
  twitter: twitterConnector,
  linkedin: linkedinConnector,
};

export function getConnector(platform: Platform): Connector {
  const demoMode = process.env.DEMO_MODE === "true";

  if (demoMode) {
    const mockConnector = getMockConnectors().find((item) => item.platform === platform);
    if (!mockConnector) {
      throw new Error(`Mock connector missing for ${platform}`);
    }
    return mockConnector;
  }

  const connector = connectors[platform];
  if (!connector) {
    throw new Error(`Connector not configured for ${platform}. Enable DEMO_MODE for mock data.`);
  }

  return connector;
}

// Export all connectors for direct use if needed
export {
  instagramConnector,
  facebookConnector,
  youtubeConnector,
  tiktokConnector,
  twitterConnector,
  linkedinConnector,
};
